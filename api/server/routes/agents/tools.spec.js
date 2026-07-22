const express = require('express');
const request = require('supertest');

const mockGetTenantFunctions = jest.fn();

jest.mock('~/models', () => ({
  getTenantFunctions: (...args) => mockGetTenantFunctions(...args),
}));

jest.mock('~/server/controllers/tools', () => ({
  callTool: jest.fn((_req, res) => res.json({ ok: true })),
  verifyToolAuth: jest.fn((_req, res) => res.json({ authenticated: true })),
  getToolCalls: jest.fn((_req, res) => res.json({ calls: [] })),
}));

jest.mock('~/server/controllers/PluginController', () => ({
  getAvailableTools: jest.fn((_req, res) => res.json([])),
}));

jest.mock('~/server/middleware', () => ({
  toolCallLimiter: (_req, _res, next) => next(),
}));

const router = require('./tools');

function createApp(user) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = user;
    next();
  });
  app.use('/agents/tools', router);
  return app;
}

describe('agents tools routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns sanitized tenant functions for tenant users', async () => {
    mockGetTenantFunctions.mockResolvedValue([
      {
        _id: 'mongo-id',
        tenantId: 'tenant-x',
        id: 'tenant_report',
        name: 'Tenant report',
        description: 'Build report',
        details: 'Visible details',
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
      },
    ]);

    const response = await request(createApp({ id: 'user-1', tenantId: 'tenant-x' }))
      .get('/agents/tools/tenant-functions')
      .expect(200);

    expect(mockGetTenantFunctions).toHaveBeenCalledWith({
      tenantId: 'tenant-x',
      isActive: true,
    });
    expect(response.body).toEqual({
      functions: [
        {
          id: 'tenant_report',
          name: 'Tenant report',
          description: 'Build report',
          details: 'Visible details',
          inputSchema: { accountId: { type: 'string', required: true } },
          isActive: true,
        },
      ],
    });
  });

  it('returns 400 when user has no tenant', async () => {
    const response = await request(createApp({ id: 'user-1' }))
      .get('/agents/tools/tenant-functions')
      .expect(400);

    expect(response.body).toEqual({ message: 'User has no tenant' });
    expect(mockGetTenantFunctions).not.toHaveBeenCalled();
  });
});
