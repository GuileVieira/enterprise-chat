const mongoose = require('mongoose');
const path = require('path');
const { logger, fileSchema, projectSchema } = require('@librechat/data-schemas');
const { MongoMemoryServer } = require('mongodb-memory-server');

require('module-alias')({ base: path.resolve(__dirname, '..', '..', 'api') });

jest.mock('../connect', () => jest.fn().mockResolvedValue(true));
jest.mock('@librechat/api', () => ({
  ensureRequiredCollectionsExist: jest.fn().mockResolvedValue(undefined),
}));

logger.silent = true;
jest.setTimeout(30000);

describe('Project Files Migration Script', () => {
  let mongoServer;
  let Project, File;
  let migrateProjectFiles;
  let userId;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());

    Project = mongoose.models.Project || mongoose.model('Project', projectSchema);
    File = mongoose.models.File || mongoose.model('File', fileSchema);

    jest.doMock('~/db/models', () => ({ Project, File }), { virtual: true });

    migrateProjectFiles = require('../migrate-project-files').migrateProjectFiles;
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    await Project.deleteMany({});
    await File.deleteMany({});
    userId = new mongoose.Types.ObjectId();
  });

  const createFile = (overrides = {}) =>
    File.create({
      file_id: overrides.file_id ?? `file-${Math.random().toString(36).slice(2)}`,
      user: userId,
      filename: overrides.filename ?? 'file.txt',
      filepath: overrides.filepath ?? '/tmp/file.txt',
      type: overrides.type ?? 'text/plain',
      bytes: overrides.bytes ?? 10,
      ...overrides,
    });

  it('reports legacy project file repairs in dry run without writing', async () => {
    await createFile({ file_id: 'file-1' });
    await Project.create({
      projectId: 'project-1',
      name: 'Legacy Project',
      tenantId: 'tenant-1',
      fileIds: ['file-1', 'missing-file'],
    });

    const result = await migrateProjectFiles({ dryRun: true });

    expect(result).toEqual(
      expect.objectContaining({
        dryRun: true,
        checked: 1,
        filesUpdated: 1,
        deadRefsRemoved: 1,
        projectFileIdsUpdated: 1,
        errors: 0,
      }),
    );

    const file = await File.findOne({ file_id: 'file-1' }).lean();
    expect(file).not.toHaveProperty('projectId');
    expect(file).not.toHaveProperty('tenantId');
    await expect(Project.findOne({ projectId: 'project-1' }).lean()).resolves.toEqual(
      expect.objectContaining({ fileIds: ['file-1', 'missing-file'] }),
    );
  });

  it('links declared project files and removes dead refs when applied', async () => {
    await createFile({ file_id: 'file-1' });
    await Project.create({
      projectId: 'project-1',
      name: 'Legacy Project',
      tenantId: 'tenant-1',
      fileIds: ['file-1', 'missing-file'],
    });

    const result = await migrateProjectFiles({ dryRun: false });

    expect(result).toEqual(
      expect.objectContaining({
        dryRun: false,
        filesUpdated: 1,
        deadRefsRemoved: 1,
        projectFileIdsUpdated: 1,
        errors: 0,
      }),
    );

    await expect(File.findOne({ file_id: 'file-1' }).lean()).resolves.toEqual(
      expect.objectContaining({ projectId: 'project-1', tenantId: 'tenant-1' }),
    );
    await expect(Project.findOne({ projectId: 'project-1' }).lean()).resolves.toEqual(
      expect.objectContaining({ fileIds: ['file-1'] }),
    );
  });

  it('repairs temp file ids to canonical file ids', async () => {
    await createFile({ file_id: 'canonical-file', temp_file_id: 'temp-file' });
    await Project.create({
      projectId: 'project-1',
      name: 'Temp Ref Project',
      tenantId: 'tenant-1',
      fileIds: ['temp-file'],
    });

    const result = await migrateProjectFiles({ dryRun: false });

    expect(result).toEqual(
      expect.objectContaining({
        projectRefsRepaired: 1,
        projectFileIdsUpdated: 1,
        errors: 0,
      }),
    );
    await expect(Project.findOne({ projectId: 'project-1' }).lean()).resolves.toEqual(
      expect.objectContaining({ fileIds: ['canonical-file'] }),
    );
  });

  it('adds already-linked files back into Project.fileIds and is idempotent', async () => {
    await createFile({ file_id: 'linked-file', projectId: 'project-1' });
    await Project.create({
      projectId: 'project-1',
      name: 'Linked Project',
      tenantId: 'tenant-1',
      fileIds: [],
    });

    await migrateProjectFiles({ dryRun: false });
    const secondRun = await migrateProjectFiles({ dryRun: false });

    await expect(Project.findOne({ projectId: 'project-1' }).lean()).resolves.toEqual(
      expect.objectContaining({ fileIds: ['linked-file'] }),
    );
    expect(secondRun).toEqual(
      expect.objectContaining({
        filesUpdated: 0,
        projectRefsRepaired: 0,
        deadRefsRemoved: 0,
        projectFileIdsUpdated: 0,
        alreadyOk: 1,
        errors: 0,
      }),
    );
  });
});
