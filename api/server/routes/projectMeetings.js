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
  return {
    ...value,
    id: String(value._id),
    speakerNames: speakerNames ?? {},
  };
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
    const submitted = await submitAudio(audioPath);
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
  try {
    const project = await getProject(req);
    const submitted = await submitAudio(req.file.path);
    const duration = Number(req.body.duration);
    const recordedAt = new Date(req.body.recordedAt);
    const meeting = await getMeetingModel().create({
      projectId: project.projectId,
      tenantId: project.tenantId,
      userId: req.user.id,
      title: req.body.title?.trim() || `Reunião de ${new Date().toLocaleDateString('pt-BR')}`,
      status: 'processing',
      duration: Number.isFinite(duration) && duration >= 0 ? duration : 0,
      assemblyTranscriptId: submitted.id,
      recordedAt: Number.isNaN(recordedAt.getTime()) ? new Date() : recordedAt,
    });
    res.status(202).json(serialize(meeting));
  } catch (error) {
    logger.error('[projectMeetings] create failed', error);
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
    meeting.utterances = (transcript.utterances || []).map(({ speaker, text, start, end }) => ({
      speaker,
      text,
      start,
      end,
    }));
    meeting.speakerNames = new Map(
      [...new Set(meeting.utterances.map((item) => item.speaker))].map((speaker) => [
        speaker,
        `Speaker ${speaker}`,
      ]),
    );
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
