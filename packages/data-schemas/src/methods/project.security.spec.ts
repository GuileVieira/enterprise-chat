import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createModels } from '~/models';
import { tenantStorage, runAsSystem } from '~/config/tenantContext';
import { createProjectMethods } from './project';
import { createFileMethods } from './file';

let server: MongoMemoryServer;
const projects = createProjectMethods(mongoose);
const files = createFileMethods(mongoose);
const inTenant = <T>(tenantId: string, fn: () => Promise<T>) => tenantStorage.run({ tenantId }, fn);

beforeAll(async () => {
  server = await MongoMemoryServer.create();
  await mongoose.connect(server.getUri());
  createModels(mongoose);
});
afterAll(async () => {
  await mongoose.disconnect();
  await server?.stop();
});
afterEach(async () => {
  await runAsSystem(async () => {
    await Promise.all([
      mongoose.models.Project.deleteMany({}),
      mongoose.models.File.deleteMany({}),
      mongoose.models.User.deleteMany({}),
    ]);
  });
});

it('rejects identity and dotted fields, preserving project identity', async () => {
  await inTenant('a', async () => {
    const project = await projects.createProject('owner', { name: 'Project' });
    for (const field of ['user', 'tenantId', 'projectId', '_id', 'fileIds.0', 'accessLevel']) {
      await expect(
        projects.createProject('owner', { name: 'Invalid', [field]: 'bad' }),
      ).rejects.toThrow();
      await expect(projects.updateProject(project.projectId, { [field]: 'bad' })).rejects.toThrow();
    }
    expect((await projects.getProjectById(project.projectId))?.user).toBe('owner');
  });
});

it('excludes foreign linked files and keeps tenant-owned legacy files', async () => {
  const ownerA = await inTenant('a', async () =>
    mongoose.models.User.create({ email: 'a@test.dev' }),
  );
  const ownerB = await inTenant('b', async () =>
    mongoose.models.User.create({ email: 'b@test.dev' }),
  );
  await runAsSystem(async () => {
    for (const [fileId, user, tenantId] of [
      ['current', ownerA._id, 'a'],
      ['legacy', ownerA._id, undefined],
      ['foreign', ownerB._id, 'b'],
      ['foreign_legacy', ownerB._id, undefined],
    ] as const) {
      await mongoose.models.File.create({
        file_id: fileId,
        user,
        tenantId,
        filename: 'file.txt',
        filepath: '/file.txt',
        bytes: 1,
        type: 'text/plain',
      });
    }
  });
  const result = await inTenant('a', async () =>
    files.getTenantFiles('a', {
      file_id: { $in: ['current', 'legacy', 'foreign', 'foreign_legacy'] },
    }),
  );
  expect(result.map((f) => f.file_id).sort()).toEqual(['current', 'legacy']);
});
