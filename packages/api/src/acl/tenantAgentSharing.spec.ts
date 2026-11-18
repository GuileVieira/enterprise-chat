import mongoose, { Types } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createModels, createMethods, runAsSystem, tenantStorage } from '@librechat/data-schemas';
import { AccessRoleIds, PrincipalType, ResourceType } from 'librechat-data-provider';
import { AccessControlService } from './accessControlService';

describe('automatic API access for explicit tenant agent shares', () => {
  let mongo: MongoMemoryServer;
  let methods: ReturnType<typeof createMethods>;
  let service: AccessControlService;
  const resourceId = new Types.ObjectId();
  const grantedBy = new Types.ObjectId();
  const tenantId = 'destination';
  const within = <T>(tenant: string, fn: () => Promise<T>) =>
    tenantStorage.run({ tenantId: tenant }, fn);
  const share = (viewInsights?: boolean) =>
    within('source', () =>
      service.bulkUpdateResourcePermissions({
        resourceType: ResourceType.AGENT,
        resourceId,
        grantedBy,
        tenantAgentApiAccess: true,
        updatedPrincipals: [
          {
            type: PrincipalType.TENANT,
            id: tenantId,
            accessRoleId: AccessRoleIds.AGENT_VIEWER,
            ...(viewInsights === undefined ? {} : { viewInsights }),
          },
        ],
      }),
    );
  const revoke = () =>
    within('source', () =>
      service.bulkUpdateResourcePermissions({
        resourceType: ResourceType.AGENT,
        resourceId,
        grantedBy,
        revokedPrincipals: [{ type: PrincipalType.TENANT, id: tenantId }],
      }),
    );
  const entries = (type: ResourceType) =>
    within(tenantId, () => methods.findEntriesByResource(type, resourceId));

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri());
    createModels(mongoose);
    methods = createMethods(mongoose);
    await runAsSystem(() => methods.seedDefaultRoles());
    service = new AccessControlService(mongoose, methods);
  });
  beforeEach(async () => {
    await runAsSystem(() => mongoose.models.AclEntry.deleteMany({}));
  });
  afterAll(async () => {
    await mongoose.disconnect();
    await mongo.stop();
  });

  it('grants EDIT and only remote VIEW to the destination, idempotently; removes automatic access on revoke', async () => {
    expect((await share()).errors).toEqual([]);
    expect((await share()).errors).toEqual([]);
    expect(await entries(ResourceType.AGENT)).toEqual([
      expect.objectContaining({
        principalType: PrincipalType.TENANT,
        principalId: tenantId,
        tenantId,
        permBits: 3,
      }),
    ]);
    expect(await entries(ResourceType.REMOTE_AGENT)).toEqual([
      expect.objectContaining({
        principalId: tenantId,
        tenantId,
        permBits: 1,
        inheritedFrom: resourceId,
      }),
    ]);
    expect(
      await within('other', () =>
        methods.findEntriesByResource(ResourceType.REMOTE_AGENT, resourceId),
      ),
    ).toEqual([]);
    await revoke();
    expect(await entries(ResourceType.AGENT)).toEqual([]);
    expect(await entries(ResourceType.REMOTE_AGENT)).toEqual([]);
  });

  it('preserves stronger manual remote access when sharing and revoking the agent', async () => {
    await within(tenantId, () =>
      mongoose.models.AclEntry.create({
        principalType: PrincipalType.TENANT,
        principalId: tenantId,
        tenantId,
        resourceType: ResourceType.REMOTE_AGENT,
        resourceId,
        permBits: 15,
      }),
    );
    await share();
    expect(await entries(ResourceType.REMOTE_AGENT)).toEqual([
      expect.objectContaining({ permBits: 15 }),
    ]);
    await revoke();
    expect(await entries(ResourceType.REMOTE_AGENT)).toEqual([
      expect.objectContaining({ permBits: 15 }),
    ]);
  });

  it('keeps ordinary tenant viewer grants unchanged without the trusted admin policy', async () => {
    await within('source', () =>
      service.bulkUpdateResourcePermissions({
        resourceType: ResourceType.AGENT,
        resourceId,
        grantedBy,
        updatedPrincipals: [
          { type: PrincipalType.TENANT, id: tenantId, accessRoleId: AccessRoleIds.AGENT_VIEWER },
        ],
      }),
    );
    expect((await entries(ResourceType.AGENT))[0].permBits).toBe(1);
    expect(await entries(ResourceType.REMOTE_AGENT)).toEqual([]);
  });

  it('does not write the editor grant if the remote viewer role is missing', async () => {
    await runAsSystem(() =>
      mongoose.models.AccessRole.deleteMany({ accessRoleId: AccessRoleIds.REMOTE_AGENT_VIEWER }),
    );
    try {
      expect((await share()).errors).toHaveLength(1);
      expect(await entries(ResourceType.AGENT)).toEqual([]);
      expect(await entries(ResourceType.REMOTE_AGENT)).toEqual([]);
    } finally {
      await runAsSystem(() => methods.seedDefaultRoles());
    }
  });

  it('makes explicit API sharing independent from the automatic grant', async () => {
    await share();
    await within('source', () =>
      service.bulkUpdateResourcePermissions({
        resourceType: ResourceType.REMOTE_AGENT,
        resourceId,
        grantedBy,
        updatedPrincipals: [
          {
            type: PrincipalType.TENANT,
            id: tenantId,
            accessRoleId: AccessRoleIds.REMOTE_AGENT_VIEWER,
          },
        ],
      }),
    );
    expect((await entries(ResourceType.REMOTE_AGENT))[0].inheritedFrom).toBeUndefined();
    await revoke();
    expect(await entries(ResourceType.REMOTE_AGENT)).toHaveLength(1);
  });

  it('does not couple user or public shares to remote execution', async () => {
    await within('source', () =>
      service.bulkUpdateResourcePermissions({
        resourceType: ResourceType.AGENT,
        resourceId,
        grantedBy,
        updatedPrincipals: [
          {
            type: PrincipalType.USER,
            id: new Types.ObjectId().toString(),
            accessRoleId: AccessRoleIds.AGENT_VIEWER,
          },
          { type: PrincipalType.PUBLIC, accessRoleId: AccessRoleIds.AGENT_VIEWER },
        ],
      }),
    );
    expect(
      await runAsSystem(() =>
        mongoose.models.AclEntry.countDocuments({ resourceType: ResourceType.REMOTE_AGENT }),
      ),
    ).toBe(0);
  });

  it('inherits source expiration and removes derived access when an audited share is rolled back', async () => {
    const expiry = new Date(Date.now() + 600000);
    await within(tenantId, () =>
      mongoose.models.AclEntry.create({
        principalType: PrincipalType.TENANT,
        principalId: tenantId,
        tenantId,
        resourceType: ResourceType.AGENT,
        resourceId,
        permBits: 1,
        expiredAt: expiry,
      }),
    );
    const result = await share(true);
    expect(result.errors).toEqual([]);
    expect((await entries(ResourceType.REMOTE_AGENT))[0].expiredAt).toEqual(expiry);
    await within('source', () =>
      service.restoreInsightsPermissionChanges({
        resourceType: ResourceType.AGENT,
        resourceId,
        changes: result.insightsChanges,
      }),
    );
    expect((await entries(ResourceType.AGENT))[0].permBits).toBe(1);
    expect(await entries(ResourceType.REMOTE_AGENT)).toEqual([]);
  });
});
