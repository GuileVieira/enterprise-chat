const mongoose = require('mongoose');

const mockLogger = { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() };

jest.mock('@librechat/data-schemas', () => ({
  logger: mockLogger,
  runAsSystem: (fn) => fn(),
}));

const { ResourceType, PrincipalType, AccessRoleIds, SystemRoles } =
  jest.requireActual('librechat-data-provider');

jest.mock('librechat-data-provider', () => ({
  ...jest.requireActual('librechat-data-provider'),
}));

jest.mock('@librechat/api', () => ({
  enrichRemoteAgentPrincipals: jest.fn(),
  backfillRemoteAgentPermissions: jest.fn(),
}));

const mockBulkUpdateResourcePermissions = jest.fn();
const mockGrantPermission = jest.fn();
const mockEnsurePrincipalExists = jest.fn();
const mockFindProjectForRequest = jest.fn();

jest.mock('~/server/services/PermissionService', () => ({
  bulkUpdateResourcePermissions: (...args) => mockBulkUpdateResourcePermissions(...args),
  grantPermission: (...args) => mockGrantPermission(...args),
  ensureGroupPrincipalExists: jest.fn(),
  getEffectivePermissions: jest.fn(),
  ensurePrincipalExists: (...args) => mockEnsurePrincipalExists(...args),
  getAvailableRoles: jest.fn(),
  findAccessibleResources: jest.fn(),
  getResourcePermissionsMap: jest.fn(),
}));

jest.mock('~/server/services/Projects/access', () => ({
  findProjectForRequest: (...args) => mockFindProjectForRequest(...args),
}));

const mockRemoveAgentFromUserFavorites = jest.fn();
const mockUpdateAgent = jest.fn();

jest.mock('~/models', () => ({
  aggregateAclEntries: jest.fn(),
  searchPrincipals: jest.fn(),
  sortPrincipalsByRelevance: jest.fn(),
  calculateRelevanceScore: jest.fn(),
  removeAgentFromUserFavorites: (...args) => mockRemoveAgentFromUserFavorites(...args),
  updateAgent: (...args) => mockUpdateAgent(...args),
  getAgent: jest.fn(),
  getUserById: jest.fn(),
  findProjectById: jest.fn(),
}));

jest.mock('~/server/services/GraphApiService', () => ({
  entraIdPrincipalFeatureEnabled: jest.fn(() => false),
  searchEntraIdPrincipals: jest.fn(),
}));

const {
  updateResourcePermissions,
  getResourcePermissions,
  getUserEffectivePermissions,
  searchPrincipals,
} = require('../PermissionsController');
const PermissionService = require('~/server/services/PermissionService');
const db = require('~/models');

const createMockReq = (overrides = {}) => ({
  params: { resourceType: ResourceType.AGENT, resourceId: '507f1f77bcf86cd799439011' },
  body: { updated: [], removed: [], public: false },
  user: { id: 'user-1', role: 'USER' },
  headers: { authorization: '' },
  ...overrides,
});

const createMockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const flushPromises = () => new Promise((resolve) => setImmediate(resolve));

describe('PermissionsController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    db.getUserById.mockResolvedValue(null);
  });

  describe('getResourcePermissions', () => {
    const agentObjectId = new mongoose.Types.ObjectId();
    const authorObjectId = new mongoose.Types.ObjectId();

    it('backfills and returns agent author as owner when ACL has no owner', async () => {
      db.aggregateAclEntries.mockResolvedValue([
        {
          principalType: PrincipalType.TENANT,
          principalId: 'mm-marketing',
          accessRoleId: AccessRoleIds.AGENT_VIEWER,
        },
      ]);
      db.getAgent.mockResolvedValue({
        _id: agentObjectId,
        id: 'agent_test',
        author: authorObjectId,
      });
      mockGrantPermission.mockResolvedValue({});

      const req = createMockReq({
        params: { resourceType: ResourceType.AGENT, resourceId: agentObjectId.toString() },
        user: { id: authorObjectId.toString(), role: 'ADMIN' },
      });
      const res = createMockRes();

      await getResourcePermissions(req, res);

      expect(db.aggregateAclEntries).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            $match: expect.objectContaining({
              resourceId: {
                $in: expect.arrayContaining([agentObjectId.toString(), agentObjectId]),
              },
            }),
          }),
        ]),
      );
      expect(mockGrantPermission).toHaveBeenCalledWith({
        principalType: PrincipalType.USER,
        principalId: authorObjectId.toString(),
        resourceType: ResourceType.AGENT,
        resourceId: agentObjectId.toString(),
        accessRoleId: AccessRoleIds.AGENT_OWNER,
        grantedBy: authorObjectId.toString(),
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          principals: expect.arrayContaining([
            expect.objectContaining({
              type: PrincipalType.USER,
              id: authorObjectId.toString(),
              accessRoleId: AccessRoleIds.AGENT_OWNER,
            }),
            expect.objectContaining({
              type: PrincipalType.TENANT,
              id: 'mm-marketing',
              accessRoleId: AccessRoleIds.AGENT_VIEWER,
            }),
          ]),
        }),
      );
    });
  });

  describe('updateResourcePermissions — favorites cleanup', () => {
    const agentObjectId = new mongoose.Types.ObjectId().toString();
    const revokedUserId = new mongoose.Types.ObjectId().toString();

    beforeEach(() => {
      mockBulkUpdateResourcePermissions.mockResolvedValue({
        granted: [],
        updated: [],
        revoked: [{ type: PrincipalType.USER, id: revokedUserId, name: 'Revoked User' }],
        errors: [],
      });

      mockRemoveAgentFromUserFavorites.mockResolvedValue(undefined);
      mockUpdateAgent.mockResolvedValue({});
      mockEnsurePrincipalExists.mockImplementation((principal) => principal.id);
    });

    it('passes tenant principals through to the permission service', async () => {
      const tenantPrincipal = {
        type: PrincipalType.TENANT,
        id: 'tenant-2',
        name: 'Tenant: tenant-2',
        source: 'local',
        idOnTheSource: 'tenant-2',
        accessRoleId: AccessRoleIds.AGENT_VIEWER,
      };

      mockBulkUpdateResourcePermissions.mockResolvedValue({
        granted: [tenantPrincipal],
        updated: [],
        revoked: [],
        errors: [],
      });

      const req = createMockReq({
        params: { resourceType: ResourceType.AGENT, resourceId: agentObjectId },
        body: {
          updated: [tenantPrincipal],
          removed: [],
          public: false,
        },
      });
      const res = createMockRes();

      await updateResourcePermissions(req, res);

      expect(mockUpdateAgent).toHaveBeenCalledWith(
        { _id: agentObjectId },
        { $unset: { tenantId: '' } },
        { updatingUserId: 'user-1', skipVersioning: true },
      );
      expect(mockBulkUpdateResourcePermissions).toHaveBeenCalledWith(
        expect.objectContaining({
          resourceType: ResourceType.AGENT,
          resourceId: agentObjectId,
          updatedPrincipals: [tenantPrincipal],
        }),
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('normalizes agent tenant principals to viewer access', async () => {
      const requestTenantPrincipal = {
        type: PrincipalType.TENANT,
        id: 'tenant-2',
        accessRoleId: AccessRoleIds.AGENT_OWNER,
      };
      const normalizedTenantPrincipal = {
        ...requestTenantPrincipal,
        accessRoleId: AccessRoleIds.AGENT_VIEWER,
      };

      mockBulkUpdateResourcePermissions.mockResolvedValue({
        granted: [normalizedTenantPrincipal],
        updated: [],
        revoked: [],
        errors: [],
      });

      const req = createMockReq({
        params: { resourceType: ResourceType.AGENT, resourceId: agentObjectId },
        body: {
          updated: [requestTenantPrincipal],
          removed: [],
          public: false,
        },
      });
      const res = createMockRes();

      await updateResourcePermissions(req, res);

      expect(mockBulkUpdateResourcePermissions).toHaveBeenCalledWith(
        expect.objectContaining({
          updatedPrincipals: [normalizedTenantPrincipal],
        }),
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('allows admin to grant multiple promptGroup tenants as viewer access', async () => {
      const requestTenantPrincipals = [
        {
          type: PrincipalType.TENANT,
          id: 'tenant-a',
          accessRoleId: AccessRoleIds.PROMPTGROUP_OWNER,
        },
        {
          type: PrincipalType.TENANT,
          id: 'tenant-b',
          accessRoleId: AccessRoleIds.PROMPTGROUP_EDITOR,
        },
      ];
      const normalizedTenantPrincipals = requestTenantPrincipals.map((principal) => ({
        ...principal,
        accessRoleId: AccessRoleIds.PROMPTGROUP_VIEWER,
      }));

      mockBulkUpdateResourcePermissions.mockResolvedValue({
        granted: normalizedTenantPrincipals,
        updated: [],
        revoked: [],
        errors: [],
      });

      const req = createMockReq({
        params: { resourceType: ResourceType.PROMPTGROUP, resourceId: agentObjectId },
        body: {
          updated: requestTenantPrincipals,
          removed: [],
          public: false,
        },
        user: { id: 'admin-1', role: SystemRoles.ADMIN },
      });
      const res = createMockRes();

      await updateResourcePermissions(req, res);

      expect(mockBulkUpdateResourcePermissions).toHaveBeenCalledWith(
        expect.objectContaining({
          resourceType: ResourceType.PROMPTGROUP,
          updatedPrincipals: normalizedTenantPrincipals,
        }),
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('rejects promptGroup tenant grants from non-admin users', async () => {
      const req = createMockReq({
        params: { resourceType: ResourceType.PROMPTGROUP, resourceId: agentObjectId },
        body: {
          updated: [
            {
              type: PrincipalType.TENANT,
              id: 'tenant-a',
              accessRoleId: AccessRoleIds.PROMPTGROUP_VIEWER,
            },
          ],
          removed: [],
          public: false,
        },
        user: { id: 'user-1', role: SystemRoles.USER, tenantId: 'tenant-a' },
      });
      const res = createMockRes();

      await updateResourcePermissions(req, res);

      expect(mockBulkUpdateResourcePermissions).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('normalizes non-admin promptGroup user shares to viewer access', async () => {
      const targetUserId = new mongoose.Types.ObjectId().toString();
      mockEnsurePrincipalExists.mockResolvedValue(targetUserId);
      db.getUserById.mockResolvedValue({ _id: targetUserId, tenantId: 'tenant-a' });

      mockBulkUpdateResourcePermissions.mockResolvedValue({
        granted: [
          {
            type: PrincipalType.USER,
            id: targetUserId,
            accessRoleId: AccessRoleIds.PROMPTGROUP_VIEWER,
          },
        ],
        updated: [],
        revoked: [],
        errors: [],
      });

      const req = createMockReq({
        params: { resourceType: ResourceType.PROMPTGROUP, resourceId: agentObjectId },
        body: {
          updated: [
            {
              type: PrincipalType.USER,
              id: targetUserId,
              accessRoleId: AccessRoleIds.PROMPTGROUP_OWNER,
            },
          ],
          removed: [],
          public: false,
        },
        user: { id: 'user-1', role: SystemRoles.USER, tenantId: 'tenant-a' },
      });
      const res = createMockRes();

      await updateResourcePermissions(req, res);

      expect(mockBulkUpdateResourcePermissions).toHaveBeenCalledWith(
        expect.objectContaining({
          updatedPrincipals: [
            {
              type: PrincipalType.USER,
              id: targetUserId,
              accessRoleId: AccessRoleIds.PROMPTGROUP_VIEWER,
            },
          ],
        }),
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('rejects non-admin promptGroup user shares outside caller tenant', async () => {
      const targetUserId = new mongoose.Types.ObjectId().toString();
      mockEnsurePrincipalExists.mockResolvedValue(targetUserId);
      db.getUserById.mockResolvedValue({ _id: targetUserId, tenantId: 'tenant-b' });

      const req = createMockReq({
        params: { resourceType: ResourceType.PROMPTGROUP, resourceId: agentObjectId },
        body: {
          updated: [
            {
              type: PrincipalType.USER,
              id: targetUserId,
              accessRoleId: AccessRoleIds.PROMPTGROUP_VIEWER,
            },
          ],
          removed: [],
          public: false,
        },
        user: { id: 'user-1', role: SystemRoles.USER, tenantId: 'tenant-a' },
      });
      const res = createMockRes();

      await updateResourcePermissions(req, res);

      expect(mockBulkUpdateResourcePermissions).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('returns an error when permission service reports failed grants', async () => {
      mockBulkUpdateResourcePermissions.mockResolvedValue({
        granted: [],
        updated: [],
        revoked: [],
        errors: [
          {
            principal: { type: PrincipalType.USER, id: 'invalid-user-id' },
            error: 'Invalid principal ID',
          },
        ],
      });

      const req = createMockReq({
        params: { resourceType: ResourceType.AGENT, resourceId: agentObjectId },
        body: {
          updated: [
            {
              type: PrincipalType.USER,
              id: 'invalid-user-id',
              accessRoleId: AccessRoleIds.AGENT_VIEWER,
            },
          ],
          removed: [],
          public: false,
        },
      });
      const res = createMockRes();

      await updateResourcePermissions(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Failed to update permissions',
          details: 'One or more permission updates failed',
        }),
      );
    });

    it('removes agent from revoked users favorites on AGENT resource type', async () => {
      const req = createMockReq({
        params: { resourceType: ResourceType.AGENT, resourceId: agentObjectId },
        body: {
          updated: [],
          removed: [{ type: PrincipalType.USER, id: revokedUserId }],
          public: false,
        },
      });
      const res = createMockRes();

      await updateResourcePermissions(req, res);
      await flushPromises();

      expect(res.status).toHaveBeenCalledWith(200);
      expect(mockRemoveAgentFromUserFavorites).toHaveBeenCalledWith(agentObjectId, [revokedUserId]);
    });

    it('removes agent from revoked users favorites on REMOTE_AGENT resource type', async () => {
      const req = createMockReq({
        params: { resourceType: ResourceType.REMOTE_AGENT, resourceId: agentObjectId },
        body: {
          updated: [],
          removed: [{ type: PrincipalType.USER, id: revokedUserId }],
          public: false,
        },
      });
      const res = createMockRes();

      await updateResourcePermissions(req, res);
      await flushPromises();

      expect(mockRemoveAgentFromUserFavorites).toHaveBeenCalledWith(agentObjectId, [revokedUserId]);
    });

    it('uses results.revoked (validated) not raw request payload', async () => {
      const validId = new mongoose.Types.ObjectId().toString();
      const invalidId = 'not-a-valid-id';

      mockBulkUpdateResourcePermissions.mockResolvedValue({
        granted: [],
        updated: [],
        revoked: [{ type: PrincipalType.USER, id: validId }],
        errors: [],
      });

      const req = createMockReq({
        params: { resourceType: ResourceType.AGENT, resourceId: agentObjectId },
        body: {
          updated: [],
          removed: [
            { type: PrincipalType.USER, id: validId },
            { type: PrincipalType.USER, id: invalidId },
          ],
          public: false,
        },
      });
      const res = createMockRes();

      await updateResourcePermissions(req, res);
      await flushPromises();

      expect(mockRemoveAgentFromUserFavorites).toHaveBeenCalledWith(agentObjectId, [validId]);
    });

    it('skips cleanup when no USER principals are revoked', async () => {
      mockBulkUpdateResourcePermissions.mockResolvedValue({
        granted: [],
        updated: [],
        revoked: [{ type: PrincipalType.GROUP, id: 'group-1' }],
        errors: [],
      });

      const req = createMockReq({
        params: { resourceType: ResourceType.AGENT, resourceId: agentObjectId },
        body: {
          updated: [],
          removed: [{ type: PrincipalType.GROUP, id: 'group-1' }],
          public: false,
        },
      });
      const res = createMockRes();

      await updateResourcePermissions(req, res);
      await flushPromises();

      expect(mockRemoveAgentFromUserFavorites).not.toHaveBeenCalled();
    });

    it('skips cleanup for non-agent resource types', async () => {
      mockBulkUpdateResourcePermissions.mockResolvedValue({
        granted: [],
        updated: [],
        revoked: [{ type: PrincipalType.USER, id: revokedUserId }],
        errors: [],
      });

      const req = createMockReq({
        params: { resourceType: ResourceType.PROMPTGROUP, resourceId: agentObjectId },
        user: { id: 'admin-1', role: SystemRoles.ADMIN },
        body: {
          updated: [],
          removed: [{ type: PrincipalType.USER, id: revokedUserId }],
          public: false,
        },
      });
      const res = createMockRes();

      await updateResourcePermissions(req, res);
      await flushPromises();

      expect(res.status).toHaveBeenCalledWith(200);
      expect(mockRemoveAgentFromUserFavorites).not.toHaveBeenCalled();
    });

    it('handles agent not found gracefully', async () => {
      mockRemoveAgentFromUserFavorites.mockResolvedValue(undefined);

      const req = createMockReq({
        params: { resourceType: ResourceType.AGENT, resourceId: agentObjectId },
        body: {
          updated: [],
          removed: [{ type: PrincipalType.USER, id: revokedUserId }],
          public: false,
        },
      });
      const res = createMockRes();

      await updateResourcePermissions(req, res);
      await flushPromises();

      expect(mockRemoveAgentFromUserFavorites).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('logs error when removeAgentFromUserFavorites fails without blocking response', async () => {
      mockRemoveAgentFromUserFavorites.mockRejectedValue(new Error('DB connection lost'));

      const req = createMockReq({
        params: { resourceType: ResourceType.AGENT, resourceId: agentObjectId },
        body: {
          updated: [],
          removed: [{ type: PrincipalType.USER, id: revokedUserId }],
          public: false,
        },
      });
      const res = createMockRes();

      await updateResourcePermissions(req, res);
      await flushPromises();

      expect(res.status).toHaveBeenCalledWith(200);
      expect(mockLogger.error).toHaveBeenCalledWith(
        '[removeRevokedAgentFromFavorites] Error cleaning up favorites',
        expect.any(Error),
      );
    });
  });

  describe('getUserEffectivePermissions', () => {
    const userId = 'user-1';
    const role = 'USER';
    const projectUuid = 'project-uuid-123';
    const projectObjectId = new mongoose.Types.ObjectId();

    beforeEach(() => {
      PermissionService.getEffectivePermissions.mockResolvedValue(7); // VIEW | EDIT | DELETE
      mockFindProjectForRequest.mockResolvedValue(null);
    });

    it('resolves project UUID to MongoDB _id', async () => {
      mockFindProjectForRequest.mockResolvedValue({ _id: projectObjectId, projectId: projectUuid });

      const req = createMockReq({
        params: { resourceType: ResourceType.PROJECT, resourceId: projectUuid },
        user: { id: userId, role },
      });
      const res = createMockRes();

      await getUserEffectivePermissions(req, res);

      expect(mockFindProjectForRequest).toHaveBeenCalledWith({
        projectId: projectUuid,
        user: { id: userId, role },
      });
      expect(PermissionService.getEffectivePermissions).toHaveBeenCalledWith({
        userId,
        role,
        resourceType: ResourceType.PROJECT,
        resourceId: projectObjectId.toString(),
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ permissionBits: 7 });
    });

    it('uses original resourceId if project is not found', async () => {
      const req = createMockReq({
        params: { resourceType: ResourceType.PROJECT, resourceId: projectUuid },
        user: { id: userId, role },
      });
      const res = createMockRes();

      await getUserEffectivePermissions(req, res);

      expect(PermissionService.getEffectivePermissions).toHaveBeenCalledWith({
        userId,
        role,
        resourceType: ResourceType.PROJECT,
        resourceId: projectUuid,
      });
    });

    it('uses original resourceId for non-project resource types', async () => {
      const agentId = new mongoose.Types.ObjectId().toString();
      const req = createMockReq({
        params: { resourceType: ResourceType.AGENT, resourceId: agentId },
        user: { id: userId, role },
      });
      const res = createMockRes();

      await getUserEffectivePermissions(req, res);

      expect(mockFindProjectForRequest).not.toHaveBeenCalled();
      expect(PermissionService.getEffectivePermissions).toHaveBeenCalledWith({
        userId,
        role,
        resourceType: ResourceType.AGENT,
        resourceId: agentId,
      });
    });
  });

  describe('searchPrincipals', () => {
    it('scopes non-admin local search to caller tenant', async () => {
      db.searchPrincipals.mockResolvedValue([]);
      db.sortPrincipalsByRelevance.mockImplementation((items) => items);
      db.calculateRelevanceScore.mockReturnValue(1);
      const req = createMockReq({
        query: { q: 'jo', limit: '10', types: PrincipalType.USER },
        user: { id: 'user-1', role: SystemRoles.USER, tenantId: 'tenant-a' },
      });
      const res = createMockRes();

      await searchPrincipals(req, res);

      expect(db.searchPrincipals).toHaveBeenCalledWith('jo', 10, [PrincipalType.USER], {
        tenantId: 'tenant-a',
        global: false,
      });
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('allows admin local search across tenants', async () => {
      db.searchPrincipals.mockResolvedValue([]);
      db.sortPrincipalsByRelevance.mockImplementation((items) => items);
      db.calculateRelevanceScore.mockReturnValue(1);
      const req = createMockReq({
        query: { q: 'jo', limit: '10', types: PrincipalType.USER },
        user: { id: 'admin-1', role: SystemRoles.ADMIN },
      });
      const res = createMockRes();

      await searchPrincipals(req, res);

      expect(db.searchPrincipals).toHaveBeenCalledWith('jo', 10, [PrincipalType.USER], {
        tenantId: undefined,
        global: true,
      });
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });
});
