const express = require('express');
const request = require('supertest');

const mockGetTenantFunctions = jest.fn();

jest.mock('~/models', () => ({
  getTenantFunctions: (...args) => mockGetTenantFunctions(...args),
  getTenantFunctionById: jest.fn(),
  createTenantFunction: jest.fn(),
  updateTenantFunction: jest.fn(),
  toggleTenantFunction: jest.fn(),
  deleteTenantFunction: jest.fn(),
}));

jest.mock('~/server/middleware', () => ({
  requireJwtAuth: (_req, _res, next) => next(),
}));

jest.mock('~/server/middleware/roles/capabilities', () => ({
  requireCapability: () => (_req, _res, next) => next(),
}));

const router = require('./functions');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/admin/functions', router);
  return app;
}

describe('admin functions routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('keeps returning full tenant function payloads to admins', async () => {
    const fullFunction = {
      _id: 'mongo-id',
      tenantId: 'tenant-x',
      id: 'tenant_report',
      name: 'Tenant report',
      description: 'Build report',
      type: 'http',
      config: {
        baseUrl: 'https://internal.example.com',
        method: 'POST',
        path: '/reports',
        headers: { 'X-Internal': 'true' },
        auth: { type: 'bearer', secretName: 'meta-token' },
      },
      inputSchema: { accountId: { type: 'string', required: true } },
      postProcess: '(data) => data',
      isActive: true,
    };
    mockGetTenantFunctions.mockResolvedValue([fullFunction]);

    const response = await request(createApp())
      .get('/admin/functions?tenantId=tenant-x')
      .expect(200);

    expect(mockGetTenantFunctions).toHaveBeenCalledWith({ tenantId: 'tenant-x' });
    expect(response.body).toEqual({ functions: [fullFunction] });
  });
});
