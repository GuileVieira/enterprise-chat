const mongoose = require('mongoose');
const path = require('path');
const { logger } = require('@librechat/data-schemas');
const { MongoMemoryServer } = require('mongodb-memory-server');
const {
  ResourceType,
  PrincipalType,
  AccessRoleIds,
  PrincipalModel,
  PermissionBits,
} = require('librechat-data-provider');

require('module-alias')({ base: path.resolve(__dirname, '..', '..', 'api') });

jest.mock('../connect', () => jest.fn().mockResolvedValue(true));

logger.silent = true;

describe('Project Permission Migration Script', () => {
  let mongoServer;
  let Project, AclEntry, AccessRole, User;
  let migrateProjectPermissions;
  let ownerUser;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());

    const dbModels = require('../../api/db/models');
    Project = dbModels.Project;
    AclEntry = dbModels.AclEntry;
    AccessRole = dbModels.AccessRole;
    User = dbModels.User;

    ownerUser = await User.create({
      name: 'Project Owner',
      email: 'owner@test.com',
      role: 'USER',
    });

    await AccessRole.create({
      accessRoleId: AccessRoleIds.PROJECT_OWNER,
      name: 'Project Owner',
      resourceType: ResourceType.PROJECT,
      permBits:
        PermissionBits.VIEW | PermissionBits.EDIT | PermissionBits.DELETE | PermissionBits.SHARE,
    });
    await AccessRole.create({
      accessRoleId: AccessRoleIds.PROJECT_EDITOR,
      name: 'Project Editor',
      resourceType: ResourceType.PROJECT,
      permBits: PermissionBits.VIEW | PermissionBits.EDIT,
    });

    jest.doMock('~/db/models', () => dbModels, { virtual: true });
    jest.doMock(
      '~/models',
      () => ({
        findRoleByIdentifier: (accessRoleId) => AccessRole.findOne({ accessRoleId }).lean(),
      }),
      { virtual: true },
    );
    jest.doMock(
      '~/server/services/PermissionService',
      () => ({
        grantPermission: async ({
          principalType,
          principalId,
          resourceType,
          resourceId,
          accessRoleId,
          grantedBy,
        }) => {
          const role = await AccessRole.findOne({ accessRoleId }).lean();
          const storedPrincipalId =
            principalType === PrincipalType.USER && mongoose.Types.ObjectId.isValid(principalId)
              ? new mongoose.Types.ObjectId(principalId)
              : principalId;
          const principalModel =
            principalType === PrincipalType.USER ? PrincipalModel.USER : undefined;
          return await AclEntry.findOneAndUpdate(
            {
              principalType,
              principalId: storedPrincipalId,
              resourceType,
              resourceId,
            },
            {
              $set: {
                principalType,
                principalId: storedPrincipalId,
                ...(principalModel ? { principalModel } : {}),
                resourceType,
                resourceId,
                permBits: role.permBits,
                roleId: role._id,
                grantedBy,
                grantedAt: new Date(),
              },
            },
            { upsert: true, new: true },
          );
        },
      }),
      { virtual: true },
    );

    migrateProjectPermissions = require('../migrate-project-permissions').migrateProjectPermissions;
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    await Project.deleteMany({});
    await AclEntry.deleteMany({});
  });

  it('reports missing user and tenant project ACLs in dry run without writing', async () => {
    await Project.create({
      projectId: 'proj-1',
      name: 'Legacy Project',
      user: ownerUser._id.toString(),
      tenantId: 'tenant-1',
    });

    const result = await migrateProjectPermissions({ dryRun: true });

    expect(result).toEqual(
      expect.objectContaining({
        dryRun: true,
        checked: 1,
        ownerGrants: 1,
        tenantGrants: 1,
        errors: 0,
      }),
    );
    expect(await AclEntry.countDocuments({})).toBe(0);
  });

  it('grants missing owner and tenant project ACLs when applied', async () => {
    const project = await Project.create({
      projectId: 'proj-1',
      name: 'Legacy Project',
      user: ownerUser._id.toString(),
      tenantId: 'tenant-1',
    });

    const result = await migrateProjectPermissions({ dryRun: false });

    expect(result).toEqual(
      expect.objectContaining({
        dryRun: false,
        checked: 1,
        ownerGrants: 1,
        tenantGrants: 1,
        errors: 0,
      }),
    );
    await expect(
      AclEntry.findOne({
        principalType: PrincipalType.USER,
        principalId: ownerUser._id,
        principalModel: PrincipalModel.USER,
        resourceType: ResourceType.PROJECT,
        resourceId: project._id,
      }).lean(),
    ).resolves.toEqual(expect.objectContaining({ permBits: 15 }));
    await expect(
      AclEntry.findOne({
        principalType: PrincipalType.TENANT,
        principalId: 'tenant-1',
        resourceType: ResourceType.PROJECT,
        resourceId: project._id,
      }).lean(),
    ).resolves.toEqual(expect.objectContaining({ permBits: 3 }));
  });

  it('is idempotent when project ACLs already exist', async () => {
    await Project.create({
      projectId: 'proj-1',
      name: 'Migrated Project',
      user: ownerUser._id.toString(),
      tenantId: 'tenant-1',
    });

    await migrateProjectPermissions({ dryRun: false });
    const secondRun = await migrateProjectPermissions({ dryRun: false });

    expect(secondRun).toEqual(
      expect.objectContaining({
        checked: 1,
        ownerGrants: 0,
        tenantGrants: 0,
        errors: 0,
      }),
    );
    expect(await AclEntry.countDocuments({ resourceType: ResourceType.PROJECT })).toBe(2);
  });
});
