const express = require('express');
const request = require('supertest');

const mockUpsertTenantSecret = jest.fn();

jest.mock('~/models', () => ({
  listTenantSecrets: jest.fn(),
  upsertTenantSecret: (...args) => mockUpsertTenantSecret(...args),
  deleteTenantSecret: jest.fn(),
  isSecretInUse: jest.fn(),
}));

jest.mock('~/server/middleware', () => ({
  requireJwtAuth: (_req, _res, next) => next(),
}));

jest.mock('~/server/middleware/roles/capabilities', () => ({
  requireCapability: () => (_req, _res, next) => next(),
}));

const router = require('./secrets');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/admin/secrets', router);
  return app;
}

describe('admin secrets routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUpsertTenantSecret.mockResolvedValue({
      tenantId: 'tenant-x',
      name: 'meta_graph_access_token',
      type: 'meta_access_token',
    });
  });

  it('uses the canonical secret name for Meta access token secrets', async () => {
    await request(createApp())
      .post('/admin/secrets')
      .send({
        tenantId: 'tenant-x',
        type: 'meta_access_token',
        value: 'meta-token',
      })
      .expect(201);

    expect(mockUpsertTenantSecret).toHaveBeenCalledWith(
      'tenant-x',
      'meta_graph_access_token',
      'meta-token',
      'meta_access_token',
    );
  });
});
