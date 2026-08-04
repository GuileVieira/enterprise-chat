const express = require('express');
const fs = require('fs');
const request = require('supertest');

const uploadRoot = '/tmp/orqest-project-meeting-tests';

const mockFindOne = jest.fn();
const mockCreate = jest.fn();
const mockCreateFile = jest.fn();
const mockDeleteMeetingIndex = jest.fn();
const mockDeleteTranscript = jest.fn();
const mockGenerateInsights = jest.fn();
const mockGetTranscript = jest.fn();
const mockSubmitAudio = jest.fn();
const mockSyncMeetingIndex = jest.fn();
const mockUploadConfig = jest.fn();

jest.mock('mongoose', () => ({
  Types: {
    ObjectId: class {
      toString() {
        return 'meeting-1';
      }
    },
  },
  models: {
    Meeting: {
      create: (...args) => mockCreate(...args),
      findOne: (...args) => mockFindOne(...args),
    },
  },
}));

jest.mock('@librechat/data-schemas', () => ({
  logger: { error: jest.fn(), warn: jest.fn() },
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
    req.config = { paths: { uploads: uploadRoot } };
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
  deleteTranscript: (...args) => mockDeleteTranscript(...args),
  generateInsights: (...args) => mockGenerateInsights(...args),
  getTranscript: (...args) => mockGetTranscript(...args),
  submitAudio: (...args) => mockSubmitAudio(...args),
}));

jest.mock('~/server/services/Projects/meetingIndex', () => ({
  deleteMeetingIndex: (...args) => mockDeleteMeetingIndex(...args),
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
    mockSyncMeetingIndex.mockResolvedValue({});
    mockDeleteMeetingIndex.mockResolvedValue({});
    mockDeleteTranscript.mockResolvedValue(undefined);
  });

  afterEach(async () => {
    await fs.promises.rm(uploadRoot, { recursive: true, force: true });
  });

  it('persists an upload session before receiving recorded audio', async () => {
    const meeting = {
      _id: 'meeting-1',
      projectId: 'project-1',
      userId: 'user-1',
      status: 'uploading',
      assemblyTranscriptId: 'upload:meeting-1',
      speakerNames: new Map(),
      toObject() {
        return serializeDocument(this);
      },
    };
    mockCreate.mockResolvedValue(meeting);

    const response = await request(createApp())
      .post('/api/projects/project-1/meetings/uploads')
      .send({
        duration: 0,
        recordedAt: '2026-08-04T15:00:00.000Z',
        mimeType: 'audio/webm',
      });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ id: 'meeting-1', status: 'uploading' });
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: expect.anything(),
        status: 'uploading',
        assemblyTranscriptId: 'upload:meeting-1',
        mimeType: 'audio/webm',
      }),
    );
  });

  it('stores idempotent chunks, assembles them by streaming, and submits the persisted meeting', async () => {
    const meeting = {
      _id: 'meeting-1',
      projectId: 'project-1',
      userId: 'user-1',
      status: 'uploading',
      duration: 0,
      assemblyTranscriptId: 'upload:meeting-1',
      speakerNames: new Map(),
      save: jest.fn().mockResolvedValue(undefined),
      toObject() {
        return serializeDocument(this);
      },
    };
    mockFindOne.mockResolvedValue(meeting);
    mockSubmitAudio.mockImplementation(async (filePath) => {
      expect(await fs.promises.readFile(filePath, 'utf8')).toBe('first-second');
      return { id: 'transcript-1' };
    });

    const first = await request(createApp())
      .put('/api/projects/project-1/meetings/meeting-1/chunks/0')
      .set('Content-Type', 'application/octet-stream')
      .send(Buffer.from('first-'));
    const duplicate = await request(createApp())
      .put('/api/projects/project-1/meetings/meeting-1/chunks/0')
      .set('Content-Type', 'application/octet-stream')
      .send(Buffer.from('ignored'));
    const second = await request(createApp())
      .put('/api/projects/project-1/meetings/meeting-1/chunks/1')
      .set('Content-Type', 'application/octet-stream')
      .send(Buffer.from('second'));
    const completed = await request(createApp())
      .post('/api/projects/project-1/meetings/meeting-1/complete')
      .send({ totalChunks: 2, duration: 3600 });
    const repeated = await request(createApp())
      .post('/api/projects/project-1/meetings/meeting-1/complete')
      .send({ totalChunks: 2, duration: 3600 });

    expect([first.status, duplicate.status, second.status]).toEqual([204, 204, 204]);
    expect(completed.status).toBe(202);
    expect(repeated.status).toBe(202);
    expect(completed.body).toMatchObject({ status: 'processing', duration: 3600 });
    expect(meeting.assemblyTranscriptId).toBe('transcript-1');
    expect(meeting.save).toHaveBeenCalledTimes(2);
    expect(mockSubmitAudio).toHaveBeenCalledTimes(1);
  });

  it('submits browser audio and persists project meeting ownership and timing', async () => {
    const meeting = {
      _id: 'meeting-1',
      projectId: 'project-1',
      userId: 'user-1',
      assemblyTranscriptId: 'transcript-1',
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
    expect(meeting.save).toHaveBeenCalledTimes(3);
    expect(mockSyncMeetingIndex).toHaveBeenCalledWith(
      expect.objectContaining({
        meeting,
        project: expect.objectContaining({ projectId: 'project-1' }),
      }),
    );
  });

  it('completes the transcript when optional insights and indexing are unavailable', async () => {
    const meeting = {
      _id: 'meeting-1',
      projectId: 'project-1',
      userId: 'user-1',
      title: 'Reunião',
      status: 'processing',
      duration: 5,
      assemblyTranscriptId: 'transcript-1',
      utterances: [],
      speakerNames: new Map(),
      insights: {},
      recordedAt: new Date('2026-07-29T20:00:06.645Z'),
      save: jest.fn().mockResolvedValue(undefined),
      toObject() {
        return serializeDocument(this);
      },
    };
    mockFindOne.mockResolvedValue(meeting);
    mockGetTranscript.mockResolvedValue({
      status: 'completed',
      text: 'Teste.',
      utterances: [{ speaker: 'A', text: 'Teste.', start: 0, end: 5000 }],
    });
    mockGenerateInsights.mockRejectedValue(
      new Error('Your account does not have access to LLM Gateway.'),
    );
    mockSyncMeetingIndex.mockRejectedValue(new Error('File embedding failed.'));

    const response = await request(createApp()).get('/api/projects/project-1/meetings/meeting-1');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      status: 'completed',
      transcript: 'Teste.',
      insights: { summary: '', decisions: [], nextSteps: [], tasks: [] },
    });
    expect(meeting.save).toHaveBeenCalledTimes(3);
    expect(mockSyncMeetingIndex).toHaveBeenCalledWith(expect.objectContaining({ meeting }));
  });

  it('renames a completed meeting and reindexes its project file', async () => {
    const meeting = {
      _id: 'meeting-1',
      projectId: 'project-1',
      userId: 'user-1',
      title: 'Reunião',
      status: 'completed',
      speakerNames: new Map(),
      utterances: [],
      insights: { summary: '', decisions: [], nextSteps: [], tasks: [] },
      recordedAt: new Date('2026-07-23T13:00:00.000Z'),
      save: jest.fn().mockResolvedValue(undefined),
      toObject() {
        return serializeDocument(this);
      },
    };
    mockFindOne.mockResolvedValue(meeting);

    const response = await request(createApp())
      .patch('/api/projects/project-1/meetings/meeting-1')
      .send({ title: 'Planejamento semanal' });

    expect(response.status).toBe(200);
    expect(response.body.title).toBe('Planejamento semanal');
    expect(response.body.indexStatus).toBe('indexed');
    expect(mockSyncMeetingIndex).toHaveBeenCalledWith(expect.objectContaining({ meeting }));
  });

  it('keeps a failed index visible and allows retrying it', async () => {
    const meeting = {
      _id: 'meeting-1',
      projectId: 'project-1',
      userId: 'user-1',
      title: 'Reunião',
      status: 'completed',
      indexStatus: 'failed',
      speakerNames: new Map(),
      utterances: [],
      insights: { summary: '', decisions: [], nextSteps: [], tasks: [] },
      recordedAt: new Date('2026-07-23T13:00:00.000Z'),
      save: jest.fn().mockResolvedValue(undefined),
      toObject() {
        return serializeDocument(this);
      },
    };
    mockFindOne.mockResolvedValue(meeting);
    mockSyncMeetingIndex.mockRejectedValue(new Error('File embedding failed.'));

    const response = await request(createApp()).post(
      '/api/projects/project-1/meetings/meeting-1/index',
    );

    expect(response.status).toBe(200);
    expect(response.body.indexStatus).toBe('failed');
    expect(response.body.indexError).toBe('File embedding failed.');
  });

  it('regenerates missing insights and refreshes the project index', async () => {
    const meeting = {
      _id: 'meeting-1',
      projectId: 'project-1',
      userId: 'user-1',
      title: 'Reunião',
      status: 'completed',
      speakerNames: new Map([['A', 'Teste']]),
      utterances: [{ speaker: 'A', text: 'Vamos enviar amanhã.', start: 0, end: 1000 }],
      insights: { summary: '', decisions: [], nextSteps: [], tasks: [] },
      recordedAt: new Date('2026-07-23T13:00:00.000Z'),
      save: jest.fn().mockResolvedValue(undefined),
      toObject() {
        return serializeDocument(this);
      },
    };
    mockFindOne.mockResolvedValue(meeting);
    mockGenerateInsights.mockResolvedValue({
      summary: 'Envio combinado.',
      decisions: [],
      nextSteps: ['Enviar amanhã.'],
      tasks: [],
    });

    const response = await request(createApp()).post(
      '/api/projects/project-1/meetings/meeting-1/insights',
    );

    expect(response.status).toBe(200);
    expect(response.body.insights.summary).toBe('Envio combinado.');
    expect(mockGenerateInsights).toHaveBeenCalledWith(meeting);
    expect(mockSyncMeetingIndex).toHaveBeenCalledWith(expect.objectContaining({ meeting }));
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

  it('lets only the meeting creator delete it and removes its project index', async () => {
    const meeting = {
      _id: 'meeting-1',
      projectId: 'project-1',
      userId: 'user-1',
      assemblyTranscriptId: 'transcript-1',
      deleteOne: jest.fn().mockResolvedValue(undefined),
    };
    mockFindOne.mockResolvedValue(meeting);

    const response = await request(createApp()).delete(
      '/api/projects/project-1/meetings/meeting-1',
    );

    expect(response.status).toBe(204);
    expect(mockDeleteTranscript).toHaveBeenCalledWith('transcript-1');
    expect(mockDeleteMeetingIndex).toHaveBeenCalledWith(
      expect.objectContaining({
        meeting,
        req: expect.objectContaining({ user: { id: 'user-1', role: 'USER' } }),
      }),
    );
    expect(meeting.deleteOne).toHaveBeenCalledTimes(1);
  });

  it('rejects deletion by another project editor', async () => {
    const meeting = {
      _id: 'meeting-1',
      projectId: 'project-1',
      userId: 'user-2',
      assemblyTranscriptId: 'transcript-1',
      deleteOne: jest.fn(),
    };
    mockFindOne.mockResolvedValue(meeting);

    const response = await request(createApp()).delete(
      '/api/projects/project-1/meetings/meeting-1',
    );

    expect(response.status).toBe(403);
    expect(mockDeleteMeetingIndex).not.toHaveBeenCalled();
    expect(mockDeleteTranscript).not.toHaveBeenCalled();
    expect(meeting.deleteOne).not.toHaveBeenCalled();
  });
});
