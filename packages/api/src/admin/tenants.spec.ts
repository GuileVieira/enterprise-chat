import type { IUser } from '@librechat/data-schemas';
import type { Response } from 'express';
import type { ServerRequest } from '~/types/http';
import type { AdminTenantsDeps } from './tenants';
import { createAdminTenantsHandlers } from './tenants';

jest.mock('@librechat/data-schemas', () => ({
  ...jest.requireActual('@librechat/data-schemas'),
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

function createReqRes(overrides: { params?: Record<string, string> } = {}) {
  const req = {
    params: overrides.params ?? {},
    query: {},
    body: {},
  } as unknown as ServerRequest;
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const res = { status, json } as unknown as Response;

  return { req, res, status, json };
}

function createDeps(overrides: Partial<AdminTenantsDeps> = {}): AdminTenantsDeps {
  return {
    findUsers: jest.fn().mockResolvedValue([]),
    countUsers: jest.fn().mockResolvedValue(0),
    countTenantFunctions: jest.fn().mockResolvedValue(0),
    countTenantSecrets: jest.fn().mockResolvedValue(0),
    ...overrides,
  };
}

describe('createAdminTenantsHandlers', () => {
  it('returns tenant stats with real user, function, and secret counts', async () => {
    const deps = createDeps({
      countUsers: jest.fn().mockResolvedValue(3),
      countTenantFunctions: jest.fn().mockResolvedValue(4),
      countTenantSecrets: jest.fn().mockResolvedValue(5),
    });
    const handlers = createAdminTenantsHandlers(deps);
    const { req, res, status, json } = createReqRes({ params: { tenantId: 'tenant-a' } });

    await handlers.getTenantStats(req, res);

    expect(deps.countUsers).toHaveBeenCalledWith({ tenantId: 'tenant-a' });
    expect(deps.countTenantFunctions).toHaveBeenCalledWith({ tenantId: 'tenant-a' });
    expect(deps.countTenantSecrets).toHaveBeenCalledWith({ tenantId: 'tenant-a' });
    expect(status).toHaveBeenCalledWith(200);
    expect(json).toHaveBeenCalledWith({
      tenantId: 'tenant-a',
      stats: {
        users: 3,
        conversations: 0,
        agents: 0,
        functions: 4,
        secrets: 5,
      },
    });
  });

  it('keeps default tenant user filter compatible with missing tenantId', async () => {
    const deps = createDeps();
    const handlers = createAdminTenantsHandlers(deps);
    const { req, res } = createReqRes({ params: { tenantId: 'default' } });

    await handlers.getTenantStats(req, res);

    expect(deps.countUsers).toHaveBeenCalledWith({ tenantId: { $exists: false } });
    expect(deps.countTenantFunctions).toHaveBeenCalledWith({ tenantId: 'default' });
    expect(deps.countTenantSecrets).toHaveBeenCalledWith({ tenantId: 'default' });
  });

  it('lists tenants by user counts', async () => {
    const users = [
      { tenantId: 'tenant-a' },
      { tenantId: 'tenant-a' },
      { tenantId: 'tenant-b' },
      {},
    ] as IUser[];
    const deps = createDeps({ findUsers: jest.fn().mockResolvedValue(users) });
    const handlers = createAdminTenantsHandlers(deps);
    const { req, res, json } = createReqRes();

    await handlers.listTenants(req, res);

    expect(json).toHaveBeenCalledWith({
      tenants: [
        { id: 'tenant-a', userCount: 2 },
        { id: 'tenant-b', userCount: 1 },
        { id: 'default', userCount: 1 },
      ],
    });
  });
});
