import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import {
  createModels,
  createMethods as createDatabaseMethods,
  runAsSystem,
  tenantStorage,
} from '@librechat/data-schemas';
import { PrincipalModel, PrincipalType, ResourceType, SystemRoles } from 'librechat-data-provider';
import type { PipelineStage } from 'mongoose';
import { ensureDirectoryPrincipalUser, getResourcePermissionEntries } from './principals';

const createMethods = () => ({
  findUserBySourceId: jest.fn().mockResolvedValue(null),
  findUserByEmail: jest.fn().mockResolvedValue(null),
  createUser: jest.fn().mockResolvedValue('created-user'),
});

describe('getResourcePermissionEntries across shared tenants', () => {
  let server: MongoMemoryServer;
  let methods: ReturnType<typeof createDatabaseMethods>;

  beforeAll(async () => {
    server = await MongoMemoryServer.create();
    await mongoose.connect(server.getUri());
    createModels(mongoose);
    methods = createDatabaseMethods(mongoose);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await server.stop();
  });

  beforeEach(async () => {
    await runAsSystem(async () => mongoose.models.AclEntry.deleteMany({}));
  });

  it.each([ResourceType.AGENT, ResourceType.PROMPTGROUP])(
    'reloads all destination tenants for an admin sharing %s, keeping other principals scoped',
    async (resourceType) => {
      const resourceId = new mongoose.Types.ObjectId();
      const anotherResourceId = new mongoose.Types.ObjectId();
      const ownerId = new mongoose.Types.ObjectId();
      const foreignUserId = new mongoose.Types.ObjectId();
      await runAsSystem(async () =>
        mongoose.models.AclEntry.insertMany([
          {
            tenantId: 'tenant-a',
            principalType: PrincipalType.USER,
            principalModel: PrincipalModel.USER,
            principalId: ownerId,
            resourceType,
            resourceId,
            permBits: 15,
          },
          {
            tenantId: 'tenant-a',
            principalType: PrincipalType.TENANT,
            principalId: 'tenant-a',
            resourceType,
            resourceId,
            permBits: 1,
          },
          {
            tenantId: 'tenant-b',
            principalType: PrincipalType.TENANT,
            principalId: 'tenant-b',
            resourceType,
            resourceId: resourceId.toString(),
            permBits: 1,
          },
          {
            tenantId: 'tenant-c',
            principalType: PrincipalType.TENANT,
            principalId: 'tenant-c',
            resourceType,
            resourceId,
            permBits: 17,
          },
          {
            tenantId: 'tenant-b',
            principalType: PrincipalType.USER,
            principalModel: PrincipalModel.USER,
            principalId: foreignUserId,
            resourceType,
            resourceId,
            permBits: 1,
          },
          {
            tenantId: 'tenant-b',
            principalType: PrincipalType.PUBLIC,
            resourceType,
            resourceId,
            permBits: 1,
          },
          {
            tenantId: 'tenant-d',
            principalType: PrincipalType.TENANT,
            principalId: 'tenant-d',
            resourceType,
            resourceId: anotherResourceId,
            permBits: 1,
          },
          {
            tenantId: 'tenant-e',
            principalType: PrincipalType.TENANT,
            principalId: 'tenant-e',
            resourceType: ResourceType.PROJECT,
            resourceId,
            permBits: 1,
          },
        ]),
      );
      const pipeline: PipelineStage[] = [
        { $match: { resourceType, resourceId: { $in: [resourceId, resourceId.toString()] } } },
      ];
      await tenantStorage.run({ tenantId: 'tenant-a' }, async () => {
        // Reproduce the old read: persisted destination grants are hidden by tenant middleware.
        expect(await methods.aggregateAclEntries(pipeline)).toHaveLength(2);
        const entries = await getResourcePermissionEntries({
          resourceType,
          userRole: SystemRoles.ADMIN,
          pipeline,
          aggregateAclEntries: methods.aggregateAclEntries,
        });
        expect(entries).toHaveLength(4);
        expect(entries).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ principalId: ownerId }),
            expect.objectContaining({ principalId: 'tenant-a' }),
            expect.objectContaining({ principalId: 'tenant-b' }),
            expect.objectContaining({ principalId: 'tenant-c', permBits: 17 }),
          ]),
        );
        expect(tenantStorage.getStore()?.tenantId).toBe('tenant-a');
        for (const userRole of [SystemRoles.USER, SystemRoles.OWNER]) {
          expect(
            await getResourcePermissionEntries({
              resourceType,
              userRole,
              pipeline,
              aggregateAclEntries: methods.aggregateAclEntries,
            }),
          ).toHaveLength(2);
        }
        expect(
          await getResourcePermissionEntries({
            resourceType: ResourceType.PROJECT,
            userRole: SystemRoles.ADMIN,
            pipeline: [{ $match: { resourceType: ResourceType.PROJECT, resourceId } }],
            aggregateAclEntries: methods.aggregateAclEntries,
          }),
        ).toEqual([]);
      });
    },
  );
});

const principal = {
  name: 'Directory User',
  email: 'Directory-User@Example.com',
  idOnTheSource: 'directory-user-id',
};

describe('ensureDirectoryPrincipalUser', () => {
  it('returns a user already linked to the directory source ID without an email lookup', async () => {
    const methods = createMethods();
    methods.findUserBySourceId.mockResolvedValue({ id: 'source-user' });

    await expect(ensureDirectoryPrincipalUser(principal, methods)).resolves.toBe('source-user');
    expect(methods.findUserByEmail).not.toHaveBeenCalled();
    expect(methods.createUser).not.toHaveBeenCalled();
  });

  it('returns an existing user found by email without creating a placeholder', async () => {
    const methods = createMethods();
    methods.findUserByEmail.mockResolvedValue({ id: 'email-user' });

    await expect(ensureDirectoryPrincipalUser(principal, methods)).resolves.toBe('email-user');
    expect(methods.createUser).not.toHaveBeenCalled();
  });

  it('creates a normalized directory placeholder when neither identifier matches', async () => {
    const methods = createMethods();

    await expect(ensureDirectoryPrincipalUser(principal, methods)).resolves.toBe('created-user');
    expect(methods.createUser).toHaveBeenCalledWith({
      name: principal.name,
      email: 'directory-user@example.com',
      emailVerified: false,
      provider: 'openid',
      idOnTheSource: principal.idOnTheSource,
    });
  });

  it('rejects incomplete directory principals before database access', async () => {
    const methods = createMethods();

    await expect(ensureDirectoryPrincipalUser({ name: 'Incomplete' }, methods)).rejects.toThrow(
      'Directory user principals must have email and idOnTheSource',
    );
    expect(methods.findUserBySourceId).not.toHaveBeenCalled();
  });
});
