import { Types } from 'mongoose';
import { SystemRoles } from 'librechat-data-provider';
import type { IConfig, IUser } from '@librechat/data-schemas';
import type { Response } from 'express';
import type { ServerRequest } from '~/types/http';
import type { AdminOverviewDeps } from './overview';
import { createAdminOverviewHandlers } from './overview';

jest.mock('@librechat/data-schemas', () => ({
  ...jest.requireActual('@librechat/data-schemas'),
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

function mockUser(overrides: Partial<IUser> = {}): IUser {
  return {
    _id: new Types.ObjectId(),
    name: 'Test User',
    username: 'testuser',
    email: 'test@example.com',
    avatar: '',
    role: SystemRoles.USER,
    provider: 'local',
    tenantId: 'tenant-a',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-02'),
    ...overrides,
  } as IUser;
}

function createReqRes() {
  const req = { params: {}, query: {}, body: {} } as unknown as ServerRequest;
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const res = { status, json } as unknown as Response;

  return { req, res, status, json };
}

function createDeps(overrides: Partial<AdminOverviewDeps> = {}): AdminOverviewDeps {
  return {
    findUsers: jest.fn().mockResolvedValue([]),
    countUsers: jest.fn().mockResolvedValue(0),
    countRoles: jest.fn().mockResolvedValue(0),
    countGroups: jest.fn().mockResolvedValue(0),
    listAllConfigs: jest.fn().mockResolvedValue([]),
    countTenantFunctions: jest.fn().mockResolvedValue(0),
    countTenantSecrets: jest.fn().mockResolvedValue(0),
    ...overrides,
  };
}

describe('createAdminOverviewHandlers', () => {
  it('returns aggregated overview metrics with top tenants and recent users', async () => {
    const recentUser = mockUser({ role: SystemRoles.ADMIN, tenantId: 'tenant-b' });
    const tenantUsers = [
      mockUser({ tenantId: 'tenant-a' }),
      mockUser({ tenantId: 'tenant-a' }),
      mockUser({ tenantId: 'tenant-b' }),
      mockUser({ tenantId: undefined }),
    ];
    const deps = createDeps({
      countUsers: jest.fn().mockResolvedValueOnce(4).mockResolvedValueOnce(1),
      countRoles: jest.fn().mockResolvedValue(3),
      countGroups: jest.fn().mockResolvedValue(2),
      listAllConfigs: jest
        .fn()
        .mockResolvedValueOnce([{} as IConfig, {} as IConfig])
        .mockResolvedValueOnce([{} as IConfig]),
      countTenantFunctions: jest.fn().mockResolvedValueOnce(5).mockResolvedValueOnce(4),
      countTenantSecrets: jest.fn().mockResolvedValue(7),
      findUsers: jest.fn().mockResolvedValueOnce([recentUser]).mockResolvedValueOnce(tenantUsers),
    });
    const handlers = createAdminOverviewHandlers(deps);
    const { req, res, status, json } = createReqRes();

    await handlers.getOverview(req, res);

    expect(status).toHaveBeenCalledWith(200);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        usersTotal: 4,
        adminsTotal: 1,
        tenantsTotal: 3,
        rolesTotal: 3,
        groupsTotal: 2,
        configOverridesTotal: 2,
        activeConfigOverridesTotal: 1,
        functionsTotal: 5,
        activeFunctionsTotal: 4,
        secretsTotal: 7,
      }),
    );
    const response = json.mock.calls[0][0];
    expect(response.topTenants[0]).toEqual({ id: 'tenant-a', userCount: 2 });
    expect(response.recentUsers[0]).toMatchObject({
      email: 'test@example.com',
      role: SystemRoles.ADMIN,
      tenantId: 'tenant-b',
    });
  });

  it('returns 500 when aggregation fails', async () => {
    const deps = createDeps({ countUsers: jest.fn().mockRejectedValue(new Error('count failed')) });
    const handlers = createAdminOverviewHandlers(deps);
    const { req, res, status, json } = createReqRes();

    await handlers.getOverview(req, res);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({ message: 'Failed to get admin overview' });
  });
});
