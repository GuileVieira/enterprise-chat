const express = require('express');
const request = require('supertest');

const mockImportHandler = jest.fn((req, res) => res.json({ destination: req.body.destination }));

jest.mock('@librechat/api', () => ({
  ...jest.requireActual('@librechat/api'),
  createSharedImportHandler: () => mockImportHandler,
}));
jest.mock('~/server/middleware', () => ({
  requireJwtAuth: (req, _res, next) => {
    req.user = { id: 'user-a', tenantId: 'tenant-a', role: 'OWNER' };
    next();
  },
  configMiddleware: (_req, _res, next) => next(),
}));
jest.mock('~/models', () => ({ getRoleByName: jest.fn(), getAgent: jest.fn() }));
jest.mock('~/server/middleware/roles/capabilities', () => ({ hasCapability: jest.fn() }));
jest.mock('~/server/services/PermissionService', () => ({
  checkPermission: jest.fn(),
  grantPermission: jest.fn(),
}));
jest.mock('~/server/services/Projects/access', () => ({ findProjectForRequest: jest.fn() }));

const app = express();
app.use('/api', require('./sharedMemories'));
const previousAllowlist = process.env.SHARED_MEMORY_LIBRARY_TENANTS;
const payload = (destination) => ({
  operationId: 'operation-1',
  destination,
  format: 'csv',
  content: 'key,value\ntone,warm\n',
});

beforeEach(() => {
  process.env.SHARED_MEMORY_LIBRARY_TENANTS = '';
  mockImportHandler.mockClear();
});
afterAll(() => {
  if (previousAllowlist === undefined) delete process.env.SHARED_MEMORY_LIBRARY_TENANTS;
  else process.env.SHARED_MEMORY_LIBRARY_TENANTS = previousAllowlist;
});

it.each([{ type: 'project', projectId: 'project-a' }, { type: 'personal' }])(
  'routes imports to %j when the shared library is disabled',
  async (destination) => {
    const response = await request(app)
      .post('/api/shared-memories/import')
      .send(payload(destination));
    expect(response.status).toBe(200);
    expect(mockImportHandler).toHaveBeenCalledTimes(1);
    expect(response.body.destination).toEqual(destination);
  },
);

it('keeps imports into the shared library disabled by default', async () => {
  const response = await request(app)
    .post('/api/shared-memories/import')
    .send(payload({ type: 'library' }));
  expect(response.status).toBe(404);
  expect(response.body.error).toBe('Shared memory library writes are not enabled.');
  expect(mockImportHandler).not.toHaveBeenCalled();
});

it.each(['tenant-a', '*'])(
  'allows library imports only with a matching allowlist: %s',
  async (allowlist) => {
    process.env.SHARED_MEMORY_LIBRARY_TENANTS = allowlist;
    const response = await request(app)
      .post('/api/shared-memories/import')
      .send(payload({ type: 'library' }));
    expect(response.status).toBe(200);
    expect(mockImportHandler).toHaveBeenCalledTimes(1);
  },
);

it('does not let another tenant allowlist enable this tenant', async () => {
  process.env.SHARED_MEMORY_LIBRARY_TENANTS = 'tenant-b';
  const response = await request(app)
    .post('/api/shared-memories/import')
    .send(payload({ type: 'library' }));
  expect(response.status).toBe(404);
  expect(mockImportHandler).not.toHaveBeenCalled();
});

it('rejects an invalid destination before evaluating the library gate', async () => {
  const response = await request(app)
    .post('/api/shared-memories/import')
    .send(payload({ type: 'project' }));
  expect(response.status).toBe(400);
  expect(mockImportHandler).not.toHaveBeenCalled();
});
