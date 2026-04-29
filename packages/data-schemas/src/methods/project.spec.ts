import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
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
  const otherUserId = new mongoose.Types.ObjectId().toString();

  describe('createProject', () => {
    it('creates a project with all fields', async () => {
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
      expect(result.description).toBe('A test project');
      expect(result.endpoint).toBe('openAI');
      expect(result.model).toBe('gpt-4');
      expect(result.instructions).toBe('Be helpful');
      expect(result.memories).toEqual([{ key: 'topic', value: 'AI' }]);
      expect(result.memoryKeys).toEqual(['user_pref_1']);
      expect(result.promptSnippets).toEqual([{ title: 'Greeting', content: 'Hello!' }]);
      expect(result.promptGroupIds).toEqual(['group1']);
      expect(result.fileIds).toEqual(['file1']);
      expect(result.iconURL).toBe('https://example.com/icon.png');
      expect(result.isArchived).toBe(false);
    });

    it('creates a project with minimal fields', async () => {
      const result = await createProject(userId, { name: 'Minimal' });
      expect(result.name).toBe('Minimal');
      expect(result.projectId).toBeDefined();
    });
  });

  describe('getProjects', () => {
    it('returns projects sorted by updatedAt desc', async () => {
      await createProject(userId, { name: 'Alpha' });
      await new Promise((r) => setTimeout(r, 10));
      await createProject(userId, { name: 'Beta' });

      const results = await getProjects(userId);
      expect(results).toHaveLength(2);
      expect(results[0].name).toBe('Beta');
      expect(results[1].name).toBe('Alpha');
    });

    it('does not return other users projects', async () => {
      await createProject(userId, { name: 'Mine' });
      await createProject(otherUserId, { name: 'Yours' });

      const results = await getProjects(userId);
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Mine');
    });
  });

  describe('getProjectById', () => {
    it('returns the project by id', async () => {
      const created = await createProject(userId, { name: 'Target' });
      const result = await getProjectById(userId, created.projectId);
      expect(result).toBeDefined();
      expect(result!.name).toBe('Target');
    });

    it('returns null for non-existent project', async () => {
      const result = await getProjectById(userId, 'non-existent');
      expect(result).toBeNull();
    });

    it('prevents cross-user access', async () => {
      const created = await createProject(userId, { name: 'Secret' });
      const result = await getProjectById(otherUserId, created.projectId);
      expect(result).toBeNull();
    });
  });

  describe('updateProject', () => {
    it('updates project fields', async () => {
      const created = await createProject(userId, { name: 'Old' });
      const result = await updateProject(userId, created.projectId, {
        name: 'New',
        instructions: 'New instructions',
      });
      expect(result).toBeDefined();
      expect(result!.name).toBe('New');
      expect(result!.instructions).toBe('New instructions');
    });

    it('returns null for non-existent project', async () => {
      const result = await updateProject(userId, 'non-existent', { name: 'X' });
      expect(result).toBeNull();
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

      const result = await deleteProject(userId, created.projectId);
      expect(result).toBeDefined();
      expect(result!.name).toBe('ToDelete');

      const remaining = await Project.find({ user: userId }).lean();
      expect(remaining).toHaveLength(0);

      const convo = await Conversation.findOne({ conversationId: 'conv1' }).lean();
      expect(convo).toBeDefined();
      expect((convo as Record<string, unknown>).projectId).toBeUndefined();
    });

    it('returns null for non-existent project', async () => {
      const result = await deleteProject(userId, 'non-existent');
      expect(result).toBeNull();
    });
  });

  describe('archiveProject', () => {
    it('archives and unarchives a project', async () => {
      const created = await createProject(userId, { name: 'ArchiveMe' });

      let result = await archiveProject(userId, created.projectId, true);
      expect(result!.isArchived).toBe(true);

      result = await archiveProject(userId, created.projectId, false);
      expect(result!.isArchived).toBe(false);
    });

    it('returns null for non-existent project', async () => {
      const result = await archiveProject(userId, 'non-existent', true);
      expect(result).toBeNull();
    });
  });
});
