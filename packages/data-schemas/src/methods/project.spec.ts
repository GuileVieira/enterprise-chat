import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { tenantStorage } from '~/config/tenantContext';
import { createProjectMethods } from './project';
import { createModels } from '~/models';
import { IProject } from '~/types';

jest.mock('~/config/winston', () => ({
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
}));

let mongoServer: InstanceType<typeof MongoMemoryServer>;
let Project: mongoose.Model<IProject>;
let Conversation: mongoose.Model<unknown>;

let getProjects: ReturnType<typeof createProjectMethods>['getProjects'];
let getProjectById: ReturnType<typeof createProjectMethods>['getProjectById'];
let createProject: ReturnType<typeof createProjectMethods>['createProject'];
let updateProject: ReturnType<typeof createProjectMethods>['updateProject'];
let deleteProject: ReturnType<typeof createProjectMethods>['deleteProject'];
let archiveProject: ReturnType<typeof createProjectMethods>['archiveProject'];

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();

  const models = createModels(mongoose);
  Object.assign(mongoose.models, models);

  Project = mongoose.models.Project;
  Conversation = mongoose.models.Conversation;

  const methods = createProjectMethods(mongoose);
  getProjects = methods.getProjects;
  getProjectById = methods.getProjectById;
  createProject = methods.createProject;
  updateProject = methods.updateProject;
  deleteProject = methods.deleteProject;
  archiveProject = methods.archiveProject;

  await mongoose.connect(mongoUri);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
  await Project.deleteMany({});
  await Conversation.deleteMany({});
});

describe('ProjectMethods', () => {
  const userId = new mongoose.Types.ObjectId().toString();
  const tenantA = 'tenant-a';
  const tenantB = 'tenant-b';

  describe('createProject', () => {
    it('creates a project with all fields and tenantId', async () => {
      await tenantStorage.run({ tenantId: tenantA }, async () => {
        const result = await createProject(userId, {
          name: 'My Project',
          description: 'A test project',
          endpoint: 'openAI',
          model: 'gpt-4',
          instructions: 'Be helpful',
          memories: [{ key: 'topic', value: 'AI' }],
          memoryKeys: ['user_pref_1'],
          promptSnippets: [{ title: 'Greeting', content: 'Hello!' }],
          promptGroupIds: ['group1'],
          fileIds: ['file1'],
          iconURL: 'https://example.com/icon.png',
        });

        expect(result).toBeDefined();
        expect(result.name).toBe('My Project');
        expect(result.projectId).toBeDefined();
        expect(result.user).toBe(userId);
        expect(result.tenantId).toBe(tenantA);
      });
    });

    it('creates a project with minimal fields', async () => {
      const result = await createProject(userId, { name: 'Minimal' });
      expect(result.name).toBe('Minimal');
      expect(result.projectId).toBeDefined();
    });
  });

  describe('getProjects', () => {
    it('returns projects for the current tenant', async () => {
      await tenantStorage.run({ tenantId: tenantA }, async () => {
        await createProject(userId, { name: 'Project A' });
      });
      await tenantStorage.run({ tenantId: tenantB }, async () => {
        await createProject(userId, { name: 'Project B' });
      });

      await tenantStorage.run({ tenantId: tenantA }, async () => {
        const results = await getProjects();
        expect(results).toHaveLength(1);
        expect(results[0].name).toBe('Project A');
      });

      await tenantStorage.run({ tenantId: tenantB }, async () => {
        const results = await getProjects();
        expect(results).toHaveLength(1);
        expect(results[0].name).toBe('Project B');
      });
    });
  });

  describe('getProjectById', () => {
    it('returns the project by id', async () => {
      const created = await createProject(userId, { name: 'Target' });
      const result = await getProjectById(created.projectId);
      expect(result).toBeDefined();
      expect(result!.name).toBe('Target');
    });

    it('returns null for non-existent project', async () => {
      const result = await getProjectById('non-existent');
      expect(result).toBeNull();
    });

    it('prevents cross-tenant access', async () => {
      let projectId = '';
      await tenantStorage.run({ tenantId: tenantA }, async () => {
        const created = await createProject(userId, { name: 'Secret' });
        projectId = created.projectId;
      });

      await tenantStorage.run({ tenantId: tenantB }, async () => {
        const result = await getProjectById(projectId);
        expect(result).toBeNull();
      });
    });
  });

  describe('updateProject', () => {
    it('updates project fields within same tenant', async () => {
      await tenantStorage.run({ tenantId: tenantA }, async () => {
        const created = await createProject(userId, { name: 'Old' });
        const result = await updateProject(created.projectId, {
          name: 'New',
          instructions: 'New instructions',
        });
        expect(result).toBeDefined();
        expect(result!.name).toBe('New');
        expect(result!.instructions).toBe('New instructions');
      });
    });

    it('prevents cross-tenant update', async () => {
      let projectId = '';
      await tenantStorage.run({ tenantId: tenantA }, async () => {
        const created = await createProject(userId, { name: 'Untouchable' });
        projectId = created.projectId;
      });

      await tenantStorage.run({ tenantId: tenantB }, async () => {
        const result = await updateProject(projectId, { name: 'Hacked' });
        expect(result).toBeNull();
      });
    });
  });

  describe('deleteProject', () => {
    it('deletes the project and clears conversation projectIds', async () => {
      const created = await createProject(userId, { name: 'ToDelete' });
      await Conversation.create({
        conversationId: 'conv1',
        user: userId,
        endpoint: 'openAI',
        projectId: created.projectId,
      });

      const result = await deleteProject(created.projectId);
      expect(result).toBeDefined();
      expect(result!.name).toBe('ToDelete');

      const remaining = await Project.find({}).lean();
      expect(remaining).toHaveLength(0);

      const convo = await Conversation.findOne({ conversationId: 'conv1' }).lean();
      expect(convo).toBeDefined();
      expect((convo as Record<string, unknown>).projectId).toBeUndefined();
    });
  });

  describe('archiveProject', () => {
    it('archives and unarchives a project', async () => {
      const created = await createProject(userId, { name: 'ArchiveMe' });

      let result = await archiveProject(created.projectId, true);
      expect(result!.isArchived).toBe(true);

      result = await archiveProject(created.projectId, false);
      expect(result!.isArchived).toBe(false);
    });
  });
});
