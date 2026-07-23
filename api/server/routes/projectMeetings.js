const fs = require('fs');
const multer = require('multer');
const mongoose = require('mongoose');
const { logger } = require('@librechat/data-schemas');
const { PermissionBits } = require('librechat-data-provider');
const { createFile } = require('~/models');
const { requireJwtAuth } = require('~/server/middleware');
const {
  canAccessProjectResource,
} = require('~/server/middleware/accessResources/canAccessProject');
const { findProjectForRequest } = require('~/server/services/Projects/access');
const {
  generateInsights,
  getTranscript,
  submitAudio,
} = require('~/server/services/Projects/assembly');
const { syncMeetingIndex } = require('~/server/services/Projects/meetingIndex');
const { storage } = require('~/server/routes/files/multer');

const router = require('express').Router({ mergeParams: true });
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

const projectAccess = (permission) =>
  canAccessProjectResource({
    requiredPermission: permission,
  });

const getMeetingModel = () => mongoose.models.Meeting;

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
    meeting.insights = await generateInsights(transcript);
    await meeting.save();
    const project = await getProject(req);
    await syncMeetingIndex({ meeting, project, req, createFile });
    meeting.status = 'completed';
    await meeting.save();
    res.json(serialize(meeting));
  } catch (error) {
    logger.error('[projectMeetings] status failed', error);
    res.status(502).json({ error: error.message || 'Failed to process meeting' });
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
    await syncMeetingIndex({ meeting, project, req, createFile });
    res.json(serialize(meeting));
  } catch (error) {
    logger.error('[projectMeetings] speaker update failed', error);
    res.status(500).json({ error: 'Failed to update speakers' });
  }
});

module.exports = router;
