const express = require('express');
const request = require('supertest');

const mockFindOne = jest.fn();
const mockCreate = jest.fn();
const mockCreateFile = jest.fn();
const mockGenerateInsights = jest.fn();
const mockGetTranscript = jest.fn();
const mockSubmitAudio = jest.fn();
const mockSyncMeetingIndex = jest.fn();
const mockUploadConfig = jest.fn();

jest.mock('mongoose', () => ({
  models: {
    Meeting: {
      create: (...args) => mockCreate(...args),
      findOne: (...args) => mockFindOne(...args),
    },
  },
}));

jest.mock('@librechat/data-schemas', () => ({
  logger: { error: jest.fn() },
}));

jest.mock('~/models', () => ({
  createFile: (...args) => mockCreateFile(...args),
}));

jest.mock('~/server/middleware', () => ({
  requireJwtAuth: (req, _res, next) => {
    req.user = { id: 'user-1', role: 'USER' };
    next();
  },
  configMiddleware: (req, _res, next) => {
    req.config = { paths: { uploads: '/tmp' } };
    mockUploadConfig();
    next();
  },
}));

jest.mock('~/server/middleware/accessResources/canAccessProject', () => ({
  canAccessProjectResource: () => (req, _res, next) => {
    req.resourceAccess = {
      resourceInfo: { projectId: req.params.projectId, name: 'Projeto', tenantId: 'tenant-1' },
    };
    next();
  },
}));

jest.mock('~/server/services/Projects/access', () => ({
  findProjectForRequest: jest.fn(),
}));

jest.mock('~/server/services/Projects/assembly', () => ({
  generateInsights: (...args) => mockGenerateInsights(...args),
  getTranscript: (...args) => mockGetTranscript(...args),
  submitAudio: (...args) => mockSubmitAudio(...args),
}));

jest.mock('~/server/services/Projects/meetingIndex', () => ({
  syncMeetingIndex: (...args) => mockSyncMeetingIndex(...args),
}));

jest.mock('~/server/routes/files/multer', () => ({
  storage: {
    _handleFile: (_req, file, callback) => {
      if (!_req.config?.paths?.uploads) {
        return callback(new Error('Missing upload config'));
      }
      file.stream.resume();
      file.stream.on('end', () => callback(null, { path: '/tmp/test-meeting.webm' }));
    },
    _removeFile: (_req, _file, callback) => callback(null),
  },
}));

const router = require('./projectMeetings');

const serializeDocument = (meeting) => ({
  ...meeting,
  toObject: undefined,
  save: undefined,
});

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/projects/:projectId/meetings', router);
  return app;
}

describe('project meetings routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('submits browser audio and persists project meeting ownership and timing', async () => {
    const meeting = {
      _id: 'meeting-1',
      projectId: 'project-1',
      userId: 'user-1',
      title: 'Reunião',
      status: 'processing',
      duration: 75,
      speakerNames: new Map(),
      recordedAt: new Date('2026-07-23T13:00:00.000Z'),
      toObject() {
        return serializeDocument(this);
      },
    };
    mockSubmitAudio.mockResolvedValue({ id: 'transcript-1' });
    mockCreate.mockResolvedValue(meeting);

    const response = await request(createApp())
      .post('/api/projects/project-1/meetings')
      .field('duration', '75')
      .field('recordedAt', '2026-07-23T13:00:00.000Z')
      .attach('audio', Buffer.from('audio'), {
        filename: 'meeting.webm',
        contentType: 'audio/webm',
      });

    expect(response.status).toBe(202);
    expect(mockUploadConfig).toHaveBeenCalledTimes(1);
    expect(mockSubmitAudio).toHaveBeenCalledWith('/tmp/test-meeting.webm');
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: 'project-1',
        tenantId: 'tenant-1',
        userId: 'user-1',
        duration: 75,
        assemblyTranscriptId: 'transcript-1',
        recordedAt: new Date('2026-07-23T13:00:00.000Z'),
      }),
    );
  });

  it('finalizes a completed AssemblyAI transcript and indexes project context', async () => {
    const meeting = {
      _id: 'meeting-1',
      projectId: 'project-1',
      userId: 'user-1',
      title: 'Reunião',
      status: 'processing',
      duration: 60,
      assemblyTranscriptId: 'transcript-1',
      utterances: [],
      speakerNames: new Map(),
      insights: {},
      recordedAt: new Date('2026-07-23T13:00:00.000Z'),
      save: jest.fn().mockResolvedValue(undefined),
      toObject() {
        return serializeDocument(this);
      },
    };
    mockFindOne.mockResolvedValue(meeting);
    mockGetTranscript.mockResolvedValue({
      status: 'completed',
      text: 'Bom dia.',
      utterances: [{ speaker: 'A', text: 'Bom dia.', start: 0, end: 1000 }],
    });
    mockGenerateInsights.mockResolvedValue({
      summary: 'Abertura.',
      decisions: [],
      nextSteps: [],
      tasks: [],
    });
    mockSyncMeetingIndex.mockResolvedValue({});

    const response = await request(createApp()).get('/api/projects/project-1/meetings/meeting-1');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      id: 'meeting-1',
      status: 'completed',
      transcript: 'Bom dia.',
      speakerNames: { A: 'Speaker A' },
    });
    expect(meeting.save).toHaveBeenCalledTimes(2);
    expect(mockSyncMeetingIndex).toHaveBeenCalledWith(
      expect.objectContaining({
        meeting,
        project: expect.objectContaining({ projectId: 'project-1' }),
      }),
    );
  });

  it('renames every speaker occurrence through the shared label map and reindexes', async () => {
    const meeting = {
      _id: 'meeting-1',
      projectId: 'project-1',
      userId: 'user-1',
      status: 'completed',
      utterances: [
        { speaker: 'A', text: 'Primeira fala.', start: 0, end: 1000 },
        { speaker: 'A', text: 'Segunda fala.', start: 2000, end: 3000 },
      ],
      speakerNames: new Map([['A', 'Speaker A']]),
      insights: { summary: '', decisions: [], nextSteps: [], tasks: [] },
      recordedAt: new Date('2026-07-23T13:00:00.000Z'),
      save: jest.fn().mockResolvedValue(undefined),
      toObject() {
        return serializeDocument(this);
      },
    };
    mockFindOne.mockResolvedValue(meeting);

    const response = await request(createApp())
      .patch('/api/projects/project-1/meetings/meeting-1/speakers')
      .send({ speakerNames: { A: 'Ana' } });

    expect(response.status).toBe(200);
    expect(response.body.speakerNames).toEqual({ A: 'Ana' });
    expect(meeting.speakerNames.get('A')).toBe('Ana');
    expect(mockSyncMeetingIndex).toHaveBeenCalledWith(expect.objectContaining({ meeting }));
  });
});
