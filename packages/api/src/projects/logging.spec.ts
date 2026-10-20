import express from 'express';
import request from 'supertest';
import { EventEmitter } from 'events';
import { logger } from '@librechat/data-schemas';
import type { Request, Response } from 'express';
import { logProjectFailure, projectRequestLogging } from './logging';

type UserRequest = Request & { user?: { id?: string; tenantId?: string } };
interface ProjectLogContext {
  tenantId?: string;
  userId?: string;
  projectId?: string;
}

function createApp() {
  const app = express();
  app.use((req, _res, next) => {
    Object.assign(req, {
      user: {
        id: req.header('x-user-id'),
        tenantId: req.header('x-tenant-id'),
      },
    });
    next();
  });
  const projectRouter = express.Router();
  projectRouter.use(projectRequestLogging('projects'));
  projectRouter.get('/:projectId', async (req, res) => {
    await new Promise((resolve) => setTimeout(resolve, req.header('x-delay') === 'slow' ? 20 : 1));
    res.json({ projectId: req.params.projectId });
  });
  projectRouter.get('/:projectId/not-found', (_req, res) => {
    res.status(404).json({ ok: false });
  });
  const meetingRouter = express.Router();
  meetingRouter.put('/:meetingId/chunks/:index', (_req, res) => {
    res.status(204).send();
  });
  projectRouter.use('/meetings', meetingRouter);
  projectRouter.post('/:projectId', (req, res) => {
    res.status(req.header('x-status') ? Number(req.header('x-status')) : 201).json({ ok: true });
  });
  projectRouter.get('/failure/:projectId', (req, res) => {
    logProjectFailure(req as UserRequest, 'project operation failed', req.app.locals.failure);
    res.status(500).json({ ok: false });
  });
  app.use('/projects', projectRouter);
  return app;
}

describe('project request logging', () => {
  let debug: jest.SpyInstance;
  let info: jest.SpyInstance;
  let warn: jest.SpyInstance;
  let error: jest.SpyInstance;

  beforeEach(() => {
    debug = jest.spyOn(logger, 'debug').mockImplementation(() => logger);
    info = jest.spyOn(logger, 'info').mockImplementation(() => logger);
    warn = jest.spyOn(logger, 'warn').mockImplementation(() => logger);
    error = jest.spyOn(logger, 'error').mockImplementation(() => logger);
  });

  afterEach(() => jest.restoreAllMocks());

  it('keeps interleaved tenant request context scoped to each request', async () => {
    const app = createApp();
    const slow = request(app)
      .get('/projects/project-a')
      .set('x-tenant-id', 'tenant-a')
      .set('x-user-id', 'user-a')
      .set('x-delay', 'slow');
    const fast = request(app)
      .get('/projects/project-b')
      .set('x-tenant-id', 'tenant-b')
      .set('x-user-id', 'user-b');

    const [slowResponse, fastResponse] = await Promise.all([slow, fast]);

    expect(slowResponse.status).toBe(200);
    expect(fastResponse.status).toBe(200);
    const contexts = debug.mock.calls.map(([, context]) => context as ProjectLogContext);
    expect(contexts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ tenantId: 'tenant-a', userId: 'user-a', projectId: 'project-a' }),
        expect.objectContaining({ tenantId: 'tenant-b', userId: 'user-b', projectId: 'project-b' }),
      ]),
    );
  });

  it('uses debug for reads and meeting chunk writes, info for mutations, and status-based levels', async () => {
    const app = createApp();

    expect((await request(app).get('/projects/read').set('x-tenant-id', 'tenant')).status).toBe(
      200,
    );
    expect(
      (await request(app).put('/projects/meetings/m/chunks/2').set('x-tenant-id', 'tenant')).status,
    ).toBe(204);
    expect((await request(app).post('/projects/write').set('x-tenant-id', 'tenant')).status).toBe(
      201,
    );
    expect(
      (
        await request(app)
          .post('/projects/accepted')
          .set('x-tenant-id', 'tenant')
          .set('x-status', '202')
      ).status,
    ).toBe(202);
    expect((await request(app).get('/projects/missing/not-found')).status).toBe(404);
    expect((await request(app).post('/projects/server-error').set('x-status', '503')).status).toBe(
      503,
    );

    expect(debug).toHaveBeenCalledTimes(2);
    expect(info).toHaveBeenCalledTimes(2);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalledTimes(1);
    expect(info.mock.calls[1][1]).toEqual(
      expect.objectContaining({ outcome: 'accepted', statusCode: 202 }),
    );
    expect(warn.mock.calls[0][1]).toEqual(
      expect.objectContaining({ outcome: 'failed', statusCode: 404 }),
    );
    expect(error.mock.calls[0][1]).toEqual(
      expect.objectContaining({ outcome: 'failed', statusCode: 503 }),
    );
  });

  it('preserves original stack and bounds cyclic cause context', async () => {
    const app = createApp();
    const root = Object.assign(new Error('root failure'), {
      code: 11000,
      details: ['rules.minSpend'],
    });
    root.stack = 'Error: root failure\nORIGINAL_STACK_SENTINEL';
    const cause = new Error('cause one');
    const nested = new Error('cause two');
    Object.defineProperty(root, 'cause', { value: cause });
    Object.defineProperty(cause, 'cause', { value: nested });
    Object.defineProperty(nested, 'cause', { value: root });
    app.locals.failure = root;

    const response = await request(app)
      .get('/projects/failure/project-1')
      .set('x-tenant-id', 'tenant-1');

    expect(response.status).toBe(500);
    expect(error.mock.calls[0][1]).toEqual(
      expect.objectContaining({
        error: expect.objectContaining({ code: 11000, validationFields: ['rules.minSpend'] }),
      }),
    );
    const context = error.mock.calls[0][1] as {
      error: { stack: string; cause: { cause: { cause: { truncated: boolean } } } };
    };
    expect(context.error.stack).toContain('ORIGINAL_STACK_SENTINEL');
    expect(context.error.cause.cause.cause.truncated).toBe(true);
  });

  it('omits query secrets and redacts provider tokens from serialized failure logs', async () => {
    const app = createApp();
    const token = `EAA${'s'.repeat(48)}`;
    app.locals.failure = new Error(`provider failed with access_token=query-secret and ${token}`);

    const response = await request(app)
      .get(`/projects/failure/${token}?access_token=query-secret&private_value=query-secret`)
      .set('x-tenant-id', 'tenant-1');

    expect(response.status).toBe(500);
    const serialized = JSON.stringify([...error.mock.calls, ...debug.mock.calls]);
    expect(serialized).not.toContain('query-secret');
    expect(serialized).not.toContain(token);
  });

  it('keeps HTTP response intact when the logger throws', async () => {
    debug.mockImplementation(() => {
      throw new Error('logger unavailable');
    });

    const response = await request(createApp()).get('/projects/project-1');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ projectId: 'project-1' });
  });

  it('logs aborted close once even if finish fires afterward', () => {
    const req = {
      method: 'GET',
      params: { projectId: 'project-1' },
      user: { id: 'user-1', tenantId: 'tenant-1' },
    } as unknown as Request;
    const res = Object.assign(new EventEmitter(), {
      statusCode: 200,
      writableFinished: false,
    }) as unknown as Response;
    const next = jest.fn();

    projectRequestLogging('projects')(req, res, next);
    res.emit('close');
    Object.assign(res, { writableFinished: true });
    res.emit('finish');

    expect(next).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalledTimes(1);
    expect(error.mock.calls[0][1]).toEqual(
      expect.objectContaining({ outcome: 'unknown', statusCode: 200 }),
    );
  });

  it('contains primitive and cyclic rejection details without serializing code objects', async () => {
    const app = createApp();
    app.locals.failure = null;
    await request(app).get('/projects/failure/project-1');
    expect(error.mock.calls[0][1]).toEqual(
      expect.objectContaining({ error: { name: 'NonErrorRejection', message: 'null' } }),
    );

    const cyclic: { name: string; message: string; code: unknown; cause?: unknown } = {
      name: 'MalformedRejection',
      message: 'cyclic rejection',
      code: { toJSON: () => 'CODE_OBJECT_SENTINEL' },
    };
    cyclic.cause = cyclic;
    app.locals.failure = cyclic;
    await request(app).get('/projects/failure/project-2');

    const serialized = JSON.stringify(error.mock.calls);
    expect(serialized).toContain('MalformedRejection');
    expect(serialized).toContain('truncated');
    expect(serialized).not.toContain('CODE_OBJECT_SENTINEL');
  });
});
