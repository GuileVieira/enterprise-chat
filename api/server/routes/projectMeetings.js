const fs = require('fs');
const path = require('path');
const multer = require('multer');
const mongoose = require('mongoose');
const { pipeline } = require('stream/promises');
const { logger } = require('@librechat/data-schemas');
const { PermissionBits } = require('librechat-data-provider');
const { createFile } = require('~/models');
const { configMiddleware, requireJwtAuth } = require('~/server/middleware');
const {
  canAccessProjectResource,
} = require('~/server/middleware/accessResources/canAccessProject');
const { findProjectForRequest } = require('~/server/services/Projects/access');
const {
  deleteTranscript,
  generateInsights,
  getTranscript,
  submitAudio,
} = require('~/server/services/Projects/assembly');
const { deleteMeetingIndex, syncMeetingIndex } = require('~/server/services/Projects/meetingIndex');
const { storage } = require('~/server/routes/files/multer');

const router = require('express').Router({ mergeParams: true });
const MAX_CHUNK_BYTES = 8 * 1024 * 1024;
const MAX_AUDIO_BYTES = 1024 * 1024 * 1024;
const MAX_CHUNKS = 8640;
const upload = multer({
  storage,
  limits: { fileSize: 1024 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    if (!file.mimetype.startsWith('audio/')) {
      return callback(new Error('Audio file required'), false);
    }
    callback(null, true);
  },
});

router.use(requireJwtAuth);
router.use(configMiddleware);

const projectAccess = (permission) =>
  canAccessProjectResource({
    requiredPermission: permission,
  });

const getMeetingModel = () => mongoose.models.Meeting;

const getUploadDirectory = (req, meetingId) =>
  path.join(req.config.paths.uploads, 'meeting-chunks', req.user.id, meetingId);

async function findOwnedMeeting(req) {
  return getMeetingModel().findOne({
    _id: req.params.meetingId,
    projectId: req.params.projectId,
    userId: req.user.id,
  });
}

async function assembleChunks(directory, totalChunks) {
  const outputPath = path.join(directory, 'meeting.audio');
  let totalBytes = 0;
  async function* chunks() {
    for (let index = 0; index < totalChunks; index++) {
      const chunkPath = path.join(directory, `${index}.chunk`);
      const stat = await fs.promises.stat(chunkPath);
      totalBytes += stat.size;
      if (totalBytes > MAX_AUDIO_BYTES) {
        throw new Error('Meeting audio exceeds the 1 GB limit');
      }
      yield* fs.createReadStream(chunkPath);
    }
  }
  try {
    await pipeline(chunks(), fs.createWriteStream(`${outputPath}.part`));
    await fs.promises.rename(`${outputPath}.part`, outputPath);
    return outputPath;
  } catch (error) {
    await fs.promises.rm(`${outputPath}.part`, { force: true });
    throw error;
  }
}

async function getProject(req) {
  return (
    req.resourceAccess?.resourceInfo ||
    findProjectForRequest({ projectId: req.params.projectId, user: req.user })
  );
}

function serialize(meeting) {
  const value = meeting.toObject ? meeting.toObject() : meeting;
  const speakerNames =
    value.speakerNames instanceof Map ? Object.fromEntries(value.speakerNames) : value.speakerNames;
  const speakerIdentifications =
    value.speakerIdentifications instanceof Map
      ? Object.fromEntries(value.speakerIdentifications)
      : value.speakerIdentifications;
  return {
    ...value,
    id: String(value._id),
    speakerNames: speakerNames ?? {},
    speakerIdentifications: speakerIdentifications ?? {},
  };
}

function parseParticipants(value, source = 'manual') {
  let candidates = value;
  if (typeof value === 'string') {
    try {
      candidates = JSON.parse(value);
    } catch {
      candidates = value.split(',');
    }
  }
  if (!Array.isArray(candidates)) {
    return [];
  }
  const allowedSources = new Set(['manual', 'google_meet', 'zoom', 'teams']);
  const unique = new Map();
  for (const candidate of candidates) {
    const name = (typeof candidate === 'string' ? candidate : candidate?.name)?.trim().slice(0, 35);
    if (!name) {
      continue;
    }
    let participantSource = allowedSources.has(source) ? source : 'manual';
    if (typeof candidate === 'object' && allowedSources.has(candidate?.source)) {
      participantSource = candidate.source;
    }
    const channel = Number(typeof candidate === 'object' ? candidate?.channel : undefined);
    unique.set(name.toLocaleLowerCase(), {
      name,
      source: participantSource,
      ...(Number.isInteger(channel) && channel >= 1 && channel <= 32 ? { channel } : {}),
    });
  }
  return [...unique.values()].slice(0, 50);
}

function mapTranscriptSpeakers(transcript, participants) {
  const mapping = transcript.speech_understanding?.response?.speaker_identification?.mapping ?? {};
  const participantNames = new Set(participants.map((participant) => participant.name));
  const reverseMapping = new Map(
    Object.entries(mapping)
      .filter(([, name]) => participantNames.has(name))
      .map(([speaker, name]) => [name, speaker]),
  );
  const utterances = (transcript.utterances || []).map(
    ({ speaker, text, start, end, confidence }) => ({
      speaker: reverseMapping.get(speaker) ?? speaker,
      text,
      start,
      end,
      ...(Number.isFinite(confidence) ? { confidence } : {}),
    }),
  );
  const speakers = [...new Set(utterances.map((item) => item.speaker))];
  const speakerNames = new Map();
  const speakerIdentifications = new Map();
  for (const speaker of speakers) {
    const channel = Number(String(speaker).match(/^\d+/)?.[0]);
    const channelParticipant = Number.isInteger(channel)
      ? participants.find((participant) => participant.channel === channel)
      : undefined;
    const identifiedName = participantNames.has(mapping[speaker]) ? mapping[speaker] : '';
    const name = channelParticipant?.name || identifiedName || `Speaker ${speaker}`;
    let source = 'unidentified';
    if (channelParticipant) {
      source = 'channel';
    } else if (identifiedName) {
      source = 'assemblyai_participants';
    }
    speakerNames.set(speaker, name);
    speakerIdentifications.set(speaker, {
      name,
      source,
      confidence: channelParticipant ? 1 : null,
      confirmed: Boolean(channelParticipant),
    });
  }
  return { speakerIdentifications, speakerNames, utterances };
}

async function syncMeetingIndexStatus({ meeting, project, req }) {
  meeting.indexStatus = 'pending';
  meeting.indexError = undefined;
  meeting.indexedAt = undefined;
  await meeting.save();
  try {
    await syncMeetingIndex({ meeting, project, req, createFile });
    meeting.indexStatus = 'indexed';
    meeting.indexedAt = new Date();
  } catch (error) {
    meeting.indexStatus = 'failed';
    meeting.indexError = error.message || 'Meeting indexing failed';
    logger.warn('[projectMeetings] indexing unavailable; transcript remains accessible', {
      error: meeting.indexError,
      meetingId: String(meeting._id),
    });
  }
  await meeting.save();
}

router.get('/', projectAccess(PermissionBits.VIEW), async (req, res) => {
  try {
    const meetings = await getMeetingModel()
      .find({ projectId: req.params.projectId })
      .sort({ recordedAt: -1 });
    res.json(meetings.map(serialize));
  } catch (error) {
    logger.error('[projectMeetings] list failed', error);
    res.status(500).json({ error: 'Failed to list meetings' });
  }
});

router.post('/uploads', projectAccess(PermissionBits.EDIT), async (req, res) => {
  try {
    const project = await getProject(req);
    const duration = Number(req.body.duration);
    const recordedAt = new Date(req.body.recordedAt);
    const mimeType = typeof req.body.mimeType === 'string' ? req.body.mimeType : '';
    const participants = parseParticipants(req.body.participants, req.body.participantSource);
    const multichannel =
      req.body.multichannel === true || participants.some(({ channel }) => channel);
    if (!mimeType.startsWith('audio/')) {
      return res.status(400).json({ error: 'Audio MIME type required' });
    }
    const meetingId = new mongoose.Types.ObjectId();
    const meeting = await getMeetingModel().create({
      _id: meetingId,
      projectId: project.projectId,
      tenantId: project.tenantId,
      userId: req.user.id,
      title: `Reunião de ${new Date().toLocaleDateString('pt-BR')}`,
      status: 'uploading',
      assemblyTranscriptId: `upload:${meetingId}`,
      duration: Number.isFinite(duration) && duration >= 0 ? duration : 0,
      mimeType,
      participants,
      multichannel,
      recordedAt: Number.isNaN(recordedAt.getTime()) ? new Date() : recordedAt,
    });
    await fs.promises.mkdir(getUploadDirectory(req, String(meeting._id)), { recursive: true });
    res.status(201).json(serialize(meeting));
  } catch (error) {
    logger.error('[projectMeetings] upload initialization failed', error);
    res.status(500).json({ error: 'Failed to initialize meeting upload' });
  }
});

router.put('/:meetingId/chunks/:index', projectAccess(PermissionBits.EDIT), async (req, res) => {
  const index = Number(req.params.index);
  const contentLength = Number(req.headers['content-length']);
  if (!Number.isInteger(index) || index < 0 || index >= MAX_CHUNKS) {
    return res.status(400).json({ error: 'Invalid chunk index' });
  }
  if (!Number.isFinite(contentLength) || contentLength <= 0 || contentLength > MAX_CHUNK_BYTES) {
    return res.status(413).json({ error: 'Meeting chunk must be between 1 byte and 8 MB' });
  }
  try {
    const meeting = await findOwnedMeeting(req);
    if (!meeting || !['uploading', 'upload_failed'].includes(meeting.status)) {
      return res.status(404).json({ error: 'Active meeting upload not found' });
    }
    const directory = getUploadDirectory(req, String(meeting._id));
    const chunkPath = path.join(directory, `${index}.chunk`);
    await fs.promises.mkdir(directory, { recursive: true });
    if (fs.existsSync(chunkPath)) {
      req.resume();
      return res.status(204).end();
    }
    const temporaryPath = `${chunkPath}.part`;
    await pipeline(req, fs.createWriteStream(temporaryPath));
    const stat = await fs.promises.stat(temporaryPath);
    if (stat.size !== contentLength) {
      await fs.promises.rm(temporaryPath, { force: true });
      return res.status(400).json({ error: 'Incomplete meeting chunk' });
    }
    await fs.promises.rename(temporaryPath, chunkPath);
    res.status(204).end();
  } catch (error) {
    logger.error('[projectMeetings] chunk upload failed', error);
    res.status(500).json({ error: 'Failed to store meeting chunk' });
  }
});

router.post('/:meetingId/complete', projectAccess(PermissionBits.EDIT), async (req, res) => {
  const totalChunks = Number(req.body.totalChunks);
  const duration = Number(req.body.duration);
  try {
    const meeting = await findOwnedMeeting(req);
    if (!meeting) {
      return res.status(404).json({ error: 'Active meeting upload not found' });
    }
    if (['processing', 'completed'].includes(meeting.status)) {
      return res.status(202).json(serialize(meeting));
    }
    if (meeting.status === 'submitting') {
      return res.status(409).json({ error: 'Meeting upload is already being submitted' });
    }
    if (!['uploading', 'upload_failed'].includes(meeting.status)) {
      return res.status(409).json({ error: 'Meeting upload cannot be completed' });
    }
    if (!Number.isInteger(totalChunks) || totalChunks <= 0 || totalChunks > MAX_CHUNKS) {
      return res.status(400).json({ error: 'Invalid meeting chunk count' });
    }
    const directory = getUploadDirectory(req, String(meeting._id));
    const audioPath = await assembleChunks(directory, totalChunks);
    meeting.status = 'submitting';
    meeting.error = undefined;
    meeting.duration = Number.isFinite(duration) && duration >= 0 ? duration : meeting.duration;
    await meeting.save();
    const submitted = await submitAudio(audioPath, {
      participants: meeting.participants,
      multichannel: meeting.multichannel,
    });
    meeting.assemblyTranscriptId = submitted.id;
    meeting.status = 'processing';
    await meeting.save();
    await fs.promises.rm(directory, { recursive: true, force: true });
    res.status(202).json(serialize(meeting));
  } catch (error) {
    logger.error('[projectMeetings] upload completion failed', error);
    const meeting = await findOwnedMeeting(req).catch(() => null);
    if (meeting) {
      meeting.status = 'upload_failed';
      meeting.error = error.message || 'Failed to submit meeting';
      await meeting.save().catch(() => undefined);
    }
    res.status(502).json({ error: error.message || 'Failed to submit meeting' });
  }
});

router.post('/', projectAccess(PermissionBits.EDIT), upload.single('audio'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Audio file required' });
  }
  let meeting;
  try {
    const project = await getProject(req);
    const participants = parseParticipants(req.body.participants, req.body.participantSource);
    const multichannel =
      req.body.multichannel === 'true' || participants.some(({ channel }) => channel);
    const duration = Number(req.body.duration);
    const recordedAt = new Date(req.body.recordedAt);
    const meetingId = new mongoose.Types.ObjectId();
    meeting = await getMeetingModel().create({
      _id: meetingId,
      projectId: project.projectId,
      tenantId: project.tenantId,
      userId: req.user.id,
      title: req.body.title?.trim() || `Reunião de ${new Date().toLocaleDateString('pt-BR')}`,
      status: 'submitting',
      duration: Number.isFinite(duration) && duration >= 0 ? duration : 0,
      assemblyTranscriptId: `upload:${meetingId}`,
      mimeType: req.file.mimetype,
      participants,
      multichannel,
      recordedAt: Number.isNaN(recordedAt.getTime()) ? new Date() : recordedAt,
    });
    const submitted = await submitAudio(req.file.path, { participants, multichannel });
    meeting.assemblyTranscriptId = submitted.id;
    meeting.status = 'processing';
    await meeting.save();
    res.status(202).json(serialize(meeting));
  } catch (error) {
    logger.error('[projectMeetings] create failed', error);
    if (meeting) {
      meeting.status = 'failed';
      meeting.error = error.message || 'Failed to submit meeting';
      await meeting.save().catch(() => undefined);
    }
    res.status(502).json({ error: error.message || 'Failed to submit meeting' });
  } finally {
    await fs.promises.rm(req.file.path, { force: true });
  }
});

router.get('/:meetingId', projectAccess(PermissionBits.VIEW), async (req, res) => {
  try {
    const meeting = await getMeetingModel().findOne({
      _id: req.params.meetingId,
      projectId: req.params.projectId,
    });
    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }
    if (meeting.status !== 'processing') {
      return res.json(serialize(meeting));
    }

    const transcript = await getTranscript(meeting.assemblyTranscriptId);
    if (transcript.status === 'error') {
      meeting.status = 'failed';
      meeting.error = transcript.error || 'Transcription failed';
      await meeting.save();
      return res.json(serialize(meeting));
    }
    if (transcript.status !== 'completed') {
      return res.json(serialize(meeting));
    }

    meeting.transcript = transcript.text || '';
    const identified = mapTranscriptSpeakers(transcript, meeting.participants ?? []);
    meeting.utterances = identified.utterances;
    meeting.speakerNames = identified.speakerNames;
    meeting.speakerIdentifications = identified.speakerIdentifications;
    try {
      meeting.insights = await generateInsights(transcript);
    } catch (error) {
      logger.warn('[projectMeetings] insights unavailable; completing transcript without them', {
        error: error.message,
        meetingId: String(meeting._id),
      });
      meeting.insights = { summary: '', decisions: [], nextSteps: [], tasks: [] };
    }
    meeting.status = 'completed';
    await meeting.save();
    const project = await getProject(req);
    await syncMeetingIndexStatus({ meeting, project, req });
    res.json(serialize(meeting));
  } catch (error) {
    logger.error('[projectMeetings] status failed', error);
    res.status(502).json({ error: error.message || 'Failed to process meeting' });
  }
});

router.patch('/:meetingId', projectAccess(PermissionBits.EDIT), async (req, res) => {
  try {
    const title = typeof req.body?.title === 'string' ? req.body.title.trim().slice(0, 150) : '';
    if (!title) {
      return res.status(400).json({ error: 'Meeting title is required' });
    }
    const meeting = await getMeetingModel().findOne({
      _id: req.params.meetingId,
      projectId: req.params.projectId,
    });
    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }
    meeting.title = title;
    await meeting.save();
    if (meeting.status === 'completed') {
      const project = await getProject(req);
      await syncMeetingIndexStatus({ meeting, project, req });
    }
    res.json(serialize(meeting));
  } catch (error) {
    logger.error('[projectMeetings] title update failed', error);
    res.status(500).json({ error: 'Failed to update meeting title' });
  }
});

router.patch('/:meetingId/speakers', projectAccess(PermissionBits.EDIT), async (req, res) => {
  try {
    const names = req.body?.speakerNames;
    if (!names || typeof names !== 'object' || Array.isArray(names)) {
      return res.status(400).json({ error: 'speakerNames must be an object' });
    }
    const meeting = await getMeetingModel().findOne({
      _id: req.params.meetingId,
      projectId: req.params.projectId,
    });
    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }
    const speakers = new Set(meeting.utterances.map((item) => item.speaker));
    meeting.speakerNames = new Map(
      [...speakers].map((speaker) => {
        const name = typeof names[speaker] === 'string' ? names[speaker].trim().slice(0, 100) : '';
        return [speaker, name || `Speaker ${speaker}`];
      }),
    );
    meeting.speakerIdentifications = new Map(
      [...speakers].map((speaker) => {
        const name = meeting.speakerNames.get(speaker);
        const isNamed = name !== `Speaker ${speaker}`;
        return [
          speaker,
          {
            name,
            source: isNamed ? 'manual' : 'unidentified',
            confidence: isNamed ? 1 : null,
            confirmed: isNamed,
          },
        ];
      }),
    );
    await meeting.save();
    const project = await getProject(req);
    await syncMeetingIndexStatus({ meeting, project, req });
    res.json(serialize(meeting));
  } catch (error) {
    logger.error('[projectMeetings] speaker update failed', error);
    res.status(500).json({ error: 'Failed to update speakers' });
  }
});

router.delete('/:meetingId', projectAccess(PermissionBits.EDIT), async (req, res) => {
  try {
    const meeting = await getMeetingModel().findOne({
      _id: req.params.meetingId,
      projectId: req.params.projectId,
    });
    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }
    if (String(meeting.userId) !== String(req.user.id)) {
      return res.status(403).json({ error: 'Only the meeting creator can delete it' });
    }
    if (meeting.assemblyTranscriptId && !meeting.assemblyTranscriptId.startsWith('upload:')) {
      await deleteTranscript(meeting.assemblyTranscriptId);
    }
    await fs.promises.rm(getUploadDirectory(req, String(meeting._id)), {
      recursive: true,
      force: true,
    });
    await deleteMeetingIndex({ meeting, req });
    await meeting.deleteOne();
    res.status(204).end();
  } catch (error) {
    logger.error('[projectMeetings] delete failed', error);
    res.status(500).json({ error: 'Failed to delete meeting' });
  }
});

router.post('/:meetingId/insights', projectAccess(PermissionBits.EDIT), async (req, res) => {
  try {
    const meeting = await getMeetingModel().findOne({
      _id: req.params.meetingId,
      projectId: req.params.projectId,
    });
    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }
    if (meeting.status !== 'completed') {
      return res.status(409).json({ error: 'Meeting transcript is not completed' });
    }
    meeting.insights = await generateInsights(meeting);
    await meeting.save();
    const project = await getProject(req);
    await syncMeetingIndexStatus({ meeting, project, req });
    res.json(serialize(meeting));
  } catch (error) {
    logger.error('[projectMeetings] insights retry failed', error);
    res.status(502).json({ error: error.message || 'Failed to generate meeting insights' });
  }
});

router.post('/:meetingId/index', projectAccess(PermissionBits.EDIT), async (req, res) => {
  try {
    const meeting = await getMeetingModel().findOne({
      _id: req.params.meetingId,
      projectId: req.params.projectId,
    });
    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }
    if (meeting.status !== 'completed') {
      return res.status(409).json({ error: 'Meeting transcript is not completed' });
    }
    const project = await getProject(req);
    await syncMeetingIndexStatus({ meeting, project, req });
    res.json(serialize(meeting));
  } catch (error) {
    logger.error('[projectMeetings] index retry failed', error);
    res.status(500).json({ error: 'Failed to retry meeting indexing' });
  }
});

module.exports = router;
