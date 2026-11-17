import express from 'express';
import request from 'supertest';
import mongoose, { Types } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createMethods, createModels, runAsSystem, tenantStorage } from '@librechat/data-schemas';
import { PermissionBits, PrincipalType, ResourceType } from 'librechat-data-provider';
import type { AllMethods, AppConfig, IUser } from '@librechat/data-schemas';
import type { IntegrationRequest } from './contracts';
import { createIntegrationAuth } from './auth';
import { createIntegrationReaders } from './reads';
import { createIntegrationSkills } from './skills';
import { createIntegrationContent } from './content';
import { createIntegrationHistory } from './history';
import { createIntegrationContext } from './context';

let mongo: MongoMemoryServer;
let db: AllMethods;
let user: IUser;
let token: string;
let config: AppConfig;
let app: express.Express;
const tenant = 'integration-a';
const inTenant = <T>(work: () => T) => tenantStorage.run({ tenantId: tenant }, work);
const effective = async ({
  userId,
  role,
  resourceType,
  resourceId,
}: {
  userId: string;
  role?: string;
  resourceType: ResourceType;
  resourceId: string | Types.ObjectId;
}) =>
  db.getEffectivePermissions(
    await db.getUserPrincipals({ userId, role }),
    resourceType,
    typeof resourceId === 'string' ? new Types.ObjectId(resourceId) : resourceId,
  );
async function grant(type: ResourceType, id: Types.ObjectId, bits = PermissionBits.VIEW) {
  return inTenant(() =>
    db.grantPermission(
      PrincipalType.USER,
      user._id as Types.ObjectId,
      type,
      id,
      bits,
      user._id as Types.ObjectId,
    ),
  );
}
const get = (path: string, key = token) =>
  request(app).get(path).set('Authorization', `Bearer ${key}`);
beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  createModels(mongoose);
  db = createMethods(mongoose);
});
afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});
beforeEach(async () => {
  await mongoose.connection.dropDatabase();
  await runAsSystem(() => db.initializeRoles());
  await runAsSystem(() =>
    mongoose.models.Role.updateOne(
      { name: 'OWNER' },
      {
        $set: {
          'permissions.REMOTE_AGENTS.USE': true,
          'permissions.AGENTS.USE': true,
          'permissions.SKILLS.USE': true,
          'permissions.PROMPTS.USE': true,
          'permissions.MEMORIES.READ': true,
          'permissions.SHARED_MEMORIES.READ': true,
        },
      },
    ),
  );
  user = await inTenant(() =>
    mongoose.models.User.create({
      email: 'owner@integration.test',
      provider: 'local',
      role: 'OWNER',
      tenantId: tenant,
    }),
  );
  user.id = String(user._id);
  token = (
    await inTenant(() =>
      db.createAgentApiKey({
        userId: user._id as Types.ObjectId,
        tenantId: tenant,
        scope: 'tenant',
        name: 'test',
      }),
    )
  ).key;
  config = {
    memory: { disabled: false },
    interfaceConfig: { skills: true },
    endpoints: {
      agents: {
        remoteApi: { auth: { apiKey: { enabled: true } } },
        managementApi: {
          auth: {
            oidc: { enabled: true, issuer: 'https://issuer.test', audience: 'test' },
            clients: [{ clientId: 'machine', userId: user.id, tenantId: tenant }],
          },
        },
      },
    },
  } as AppConfig;
  const readers = createIntegrationReaders({
    ...db,
    getEffectivePermissions: effective,
    findAccessibleResources: async (params) =>
      db.findAccessibleResources(
        await db.getUserPrincipals({ userId: params.userId, role: params.role }),
        params.resourceType,
        params.requiredPermissions,
      ),
    checkPermission: async (params) =>
      ((await effective(params)) & params.requiredPermission) === params.requiredPermission,
    hasCapability: async () => false,
    fileAccess: async (req, files) =>
      new Set(
        files.filter((file) => String(file.user) === req.user.id).map((file) => file.file_id),
      ),
  });
  const skills = createIntegrationSkills(
    {
      ...db,
      findAccessibleResources: async (params) =>
        db.findAccessibleResources(
          await db.getUserPrincipals({ userId: params.userId, role: params.role }),
          params.resourceType,
          params.requiredPermissions,
        ),
      readSkillFile: async () => null,
      skillsCapability: async () => true,
    },
    readers,
  );
  const content = createIntegrationContent(readers);
  const handlers = {
    ...readers.handlers,
    ...skills.handlers,
    ...content.handlers,
    ...createIntegrationHistory(readers).handlers,
  };
  app = express();
  app.use(express.json());
  app.use(
    createIntegrationAuth({
      ...db,
      isPrincipalActive: db.isAgentTriggerPrincipalActive,
      getAppConfig: async () => config,
      verifyAccessToken: async (value) => {
        if (value !== 'm2m-token') throw new Error('invalid');
        return { sub: 'machine@clients', azp: 'machine', exp: Math.floor(Date.now() / 1000) + 60 };
      },
    }),
  );
  app.get('/identity', handlers.identity);
  app.get('/agents', handlers.agents);
  app.get('/agents/:id', handlers.agent);
  app.get('/agents/:id/context', createIntegrationContext(readers, skills, content));
  app.get('/projects', handlers.projects);
  app.get('/projects/:projectId', handlers.project);
  app.get('/projects/:projectId/files', handlers.projectFiles);
  app.get('/projects/:projectId/prompts', handlers.projectPrompts);
  app.get('/projects/:projectId/memories', handlers.projectMemories);
  app.get('/prompts/:id', handlers.prompt);
  app.get('/skills', handlers.skills);
  app.get('/skills/:id', handlers.skill);
  app.get('/skills/:id/files', handlers.skillFiles);
  app.get('/skills/:id/files/*relativePath', handlers.skillFile);
  app.get('/memories', handlers.memories);
  app.get('/conversations', handlers.conversations);
  app.get('/conversations/:id/messages', handlers.messages);
});

it('accepts tenant OWNER key and bound M2M; rejects personal, revoked, role-changed, disabled, policy-denied and conflicting tenant credentials', async () => {
  const identity = await get('/identity').expect(200);
  expect(identity.body).toMatchObject({
    principalId: user.id,
    tenantId: tenant,
    method: 'tenant_api_key',
  });
  expect(JSON.stringify(identity.body)).not.toContain(token);
  await get('/identity', 'm2m-token').expect(200);
  config.endpoints!.agents!.managementApi!.auth!.clients[0].tenantId = 'wrong';
  await get('/identity', 'm2m-token').expect(401);
  config.endpoints!.agents!.managementApi!.auth!.clients[0].tenantId = tenant;
  const personal = await inTenant(() =>
    db.createAgentApiKey({ userId: user._id as Types.ObjectId, name: 'personal' }),
  );
  await get('/identity', personal.key).expect(401);
  await get('/identity').set('X-Tenant-Id', 'other').expect(403);
  config.endpoints!.agents!.remoteApi!.auth!.apiKey!.enabled = false;
  await get('/identity').expect(403);
  config.endpoints!.agents!.remoteApi!.auth!.apiKey!.enabled = true;
  await inTenant(() => mongoose.models.User.updateOne({ _id: user._id }, { disabled: true }));
  await get('/identity').expect(401);
  await get('/identity', 'm2m-token').expect(401);
  await inTenant(() =>
    mongoose.models.User.updateOne({ _id: user._id }, { disabled: false, role: 'USER' }),
  );
  await get('/identity').expect(401);
  await inTenant(() => mongoose.models.User.updateOne({ _id: user._id }, { role: 'OWNER' }));
  await inTenant(() => db.deleteAllAgentApiKeys(user.id));
  await get('/identity').expect(401);
});

it('requires AGENT EDIT for export, remote ACL independently; projects grant inherited linked files and prompts without leaking foreign IDs or storage fields', async () => {
  const agent = await inTenant(() =>
    mongoose.models.Agent.create({
      id: 'agent',
      tenantId: tenant,
      provider: 'openAI',
      model: 'test',
      author: user._id,
      instructions: 'Useful instructions',
      model_parameters: { apiKey: 'SECRET' },
      tool_options: { SECRET: true },
      git_identity: { name: 'secret', email: 'secret@test' },
    }),
  );
  await grant(ResourceType.AGENT, agent._id);
  await get('/agents/agent').expect(404);
  await grant(ResourceType.AGENT, agent._id, PermissionBits.VIEW | PermissionBits.EDIT);
  const exported = await get('/agents/agent').expect(200);
  const probe = createIntegrationReaders({
    ...db,
    getEffectivePermissions: effective,
    findAccessibleResources: async (params) =>
      db.findAccessibleResources(
        await db.getUserPrincipals({ userId: params.userId, role: params.role }),
        params.resourceType,
        params.requiredPermissions,
      ),
    checkPermission: async (params) =>
      ((await effective(params)) & params.requiredPermission) === params.requiredPermission,
    hasCapability: async () => false,
    fileAccess: async () => new Set(),
  });
  const probeReq = { user, config } as IntegrationRequest;
  await expect(inTenant(() => probe.agent(probeReq, 'agent', true))).rejects.toMatchObject({
    status: 404,
  });
  await grant(ResourceType.REMOTE_AGENT, agent._id);
  await expect(inTenant(() => probe.agent(probeReq, 'agent', true))).resolves.toMatchObject({
    id: 'agent',
  });
  expect(exported.body.instructions).toBe('Useful instructions');
  expect(JSON.stringify(exported.body)).not.toMatch(
    /SECRET|git_identity|model_parameters|tool_options/,
  );
  const group = await inTenant(() =>
    mongoose.models.PromptGroup.create({
      name: 'Prompt',
      tenantId: tenant,
      productionId: new Types.ObjectId(),
      author: user._id,
      authorName: 'Owner',
    }),
  );
  const prompt = await inTenant(() =>
    mongoose.models.Prompt.create({
      groupId: group._id,
      tenantId: tenant,
      author: user._id,
      prompt: 'Full production text',
      type: 'text',
    }),
  );
  await inTenant(() =>
    mongoose.models.PromptGroup.updateOne({ _id: group._id }, { productionId: prompt._id }),
  );
  const project = await inTenant(() =>
    mongoose.models.Project.create({
      projectId: 'project',
      name: 'Project',
      user: 'other',
      tenantId: tenant,
      instructions: 'Project instructions',
      promptGroupIds: [String(group._id)],
      fileIds: ['legacy', 'foreign'],
    }),
  );
  await grant(ResourceType.PROJECT, project._id);
  await inTenant(() =>
    mongoose.models.File.create({
      tenantId: tenant,
      file_id: 'legacy',
      user: new Types.ObjectId(),
      filename: 'plan.txt',
      filepath: '/SECRET/private',
      type: 'text/plain',
      bytes: 8,
      embedded: true,
    }),
  );
  await tenantStorage.run({ tenantId: 'integration-b' }, () =>
    mongoose.models.File.create({
      tenantId: 'integration-b',
      file_id: 'foreign',
      user: new Types.ObjectId(),
      filename: 'foreign.txt',
      filepath: '/private',
      type: 'text/plain',
      bytes: 8,
    }),
  );
  const files = await get('/projects/project/files').expect(200);
  expect(files.body.items.map((file: { id: string }) => file.id)).toEqual(['legacy']);
  expect(files.body.items[0]).toMatchObject({ embedded: true, indexStatus: 'unknown' });
  expect(JSON.stringify(files.body)).not.toMatch(/filepath|SECRET|foreign/);
  const prompts = await get('/projects/project/prompts').expect(200);
  expect(prompts.body.items[0]).toMatchObject({ prompt: 'Full production text', production: true });
  await get(`/prompts/${prompt._id}`).expect(200);
  const first = await get('/projects?limit=1').expect(200);
  expect(first.body.items).toHaveLength(1);
});

it('exports skill text and honest incompleteness, validates paths, applies activation in context and fingerprints selection', async () => {
  const skill = await inTenant(() =>
    mongoose.models.Skill.create({
      tenantId: tenant,
      name: 'test-skill',
      description: 'Use for tests',
      body: 'Skill body',
      author: user._id,
      authorName: 'Owner',
      source: 'inline',
      fileCount: 2,
      frontmatter: { compatibility: 'CLI', metadata: { SECRET: 'hidden' } },
    }),
  );
  await grant(ResourceType.SKILL, skill._id);
  await inTenant(() =>
    mongoose.models.SkillFile.create({
      tenantId: tenant,
      skillId: skill._id,
      relativePath: 'references/guide.md',
      file_id: 'skill-file',
      filename: 'guide.md',
      filepath: '/private',
      source: 'local',
      mimeType: 'text/markdown',
      bytes: 4,
      author: user._id,
      content: 'Text',
    }),
  );
  const detail = await get(`/skills/${skill._id}`).expect(200);
  expect(detail.body).toMatchObject({
    body: 'Skill body',
    complete: false,
    frontmatter: { compatibility: 'CLI' },
  });
  expect(JSON.stringify(detail.body)).not.toContain('SECRET');
  const file = await get(`/skills/${skill._id}/files/references/guide.md`).expect(200);
  expect(file.body).toMatchObject({ content: 'Text', complete: true });
  await get(`/skills/${skill._id}/files/%2e%2e%2fsecret`).expect(400);
  const agent = await inTenant(() =>
    mongoose.models.Agent.create({
      id: 'context-agent',
      tenantId: tenant,
      provider: 'openAI',
      model: 'test',
      author: user._id,
      instructions: 'Agent instructions',
      skills_enabled: true,
      skills_scope: 'selected',
      skills: [String(skill._id)],
    }),
  );
  await grant(ResourceType.AGENT, agent._id, PermissionBits.VIEW | PermissionBits.EDIT);
  const first = await get('/agents/context-agent/context?include=instructions,skills').expect(200);
  expect(first.body.skills).toHaveLength(1);
  await inTenant(() =>
    mongoose.models.User.updateOne(
      { _id: user._id },
      { skillStates: { [String(skill._id)]: false } },
    ),
  );
  const inactive = await get('/agents/context-agent/context?include=instructions,skills').expect(
    200,
  );
  expect(inactive.body.skills).toHaveLength(0);
  expect(first.body.contextFingerprint).not.toBe(inactive.body.contextFingerprint);
  await get('/agents/context-agent/context?projectId=foreign').expect(404);
});

it('scopes memories by OWNER/agent/project links and history by owner; strips message artifacts/free content', async () => {
  const other = new Types.ObjectId();
  await inTenant(() =>
    mongoose.models.MemoryEntry.create([
      { tenantId: tenant, userId: user._id, key: 'shared_key', value: 'owner memory' },
      {
        tenantId: tenant,
        userId: user._id,
        agentId: 'foreign-agent',
        key: 'shared_key',
        value: 'other partition',
      },
      { tenantId: tenant, userId: other, key: 'shared_key', value: 'other owner' },
    ]),
  );
  const linked = await inTenant(() =>
    mongoose.models.SharedMemory.create({
      tenantId: tenant,
      key: 'linked',
      value: 'linked value',
      tokenCount: 3,
    }),
  );
  await inTenant(() =>
    mongoose.models.SharedMemory.create({
      tenantId: tenant,
      key: 'unlinked',
      value: 'do not expose',
      tokenCount: 3,
    }),
  );
  const project = await inTenant(() =>
    mongoose.models.Project.create({
      tenantId: tenant,
      projectId: 'memory-project',
      name: 'Project',
      user: user.id,
      memoryKeys: ['shared_key'],
      sharedMemoryIds: [String(linked._id)],
    }),
  );
  await grant(ResourceType.PROJECT, project._id);
  const memories = await get('/projects/memory-project/memories').expect(200);
  expect(memories.body.items.map((memory: { value: string }) => memory.value).sort()).toEqual([
    'linked value',
    'owner memory',
  ]);
  await inTenant(() =>
    mongoose.models.Conversation.create([
      {
        tenantId: tenant,
        conversationId: 'mine',
        endpoint: 'agents',
        title: 'Mine',
        user: user.id,
      },
      {
        tenantId: tenant,
        conversationId: 'theirs',
        endpoint: 'agents',
        title: 'Theirs',
        user: String(other),
        projectId: 'memory-project',
      },
    ]),
  );
  await inTenant(() =>
    mongoose.models.Message.create({
      tenantId: tenant,
      conversationId: 'mine',
      messageId: 'message',
      user: user.id,
      text: 'Visible',
      content: [
        { type: 'text', text: 'Safe text' },
        { type: 'tool_call', tool_call: { output: 'SECRET' } },
      ],
      artifacts: { SECRET: true },
    }),
  );
  const conversations = await get('/conversations').expect(200);
  expect(conversations.body.items.map((row: { id: string }) => row.id)).toEqual(['mine']);
  await get('/conversations/theirs/messages').expect(404);
  const messages = await get('/conversations/mine/messages').expect(200);
  expect(messages.body.items[0]).toMatchObject({ text: 'Visible', omittedParts: 1 });
  expect(JSON.stringify(messages.body)).not.toContain('SECRET');
});

it('paginates owned history and memories at DB boundary; rejects cross-scope cursors and revalidates ACL after a page', async () => {
  const date = new Date('2026-11-01T00:00:00.000Z');
  await inTenant(() =>
    mongoose.models.Conversation.create(
      ['A', 'Z', 'a'].map((id) => ({
        tenantId: tenant,
        user: user.id,
        conversationId: id,
        title: id,
        endpoint: 'agents',
        createdAt: date,
      })),
    ),
  );
  const one = await get('/conversations?limit=1').expect(200);
  const two = await get(
    `/conversations?limit=1&cursor=${encodeURIComponent(one.body.nextCursor)}`,
  ).expect(200);
  const three = await get(
    `/conversations?limit=1&cursor=${encodeURIComponent(two.body.nextCursor)}`,
  ).expect(200);
  expect([one.body.items[0].id, two.body.items[0].id, three.body.items[0].id]).toEqual([
    'A',
    'Z',
    'a',
  ]);
  expect(three.body.nextCursor).toBeNull();
  await get(`/memories?cursor=${encodeURIComponent(one.body.nextCursor)}`).expect(400);
  await inTenant(() =>
    mongoose.models.MemoryEntry.create(
      ['first', 'second', 'third'].map((key) => ({
        tenantId: tenant,
        userId: user._id,
        key,
        value: key,
      })),
    ),
  );
  const memoriesOne = await get('/memories?limit=2').expect(200);
  const memoriesTwo = await get(
    `/memories?limit=2&cursor=${encodeURIComponent(memoriesOne.body.nextCursor)}`,
  ).expect(200);
  expect(
    new Set([...memoriesOne.body.items, ...memoriesTwo.body.items].map((row) => row.id)).size,
  ).toBe(3);
  const projects = await inTenant(() =>
    mongoose.models.Project.create(
      ['one', 'two'].map((projectId) => ({
        projectId,
        name: projectId,
        tenantId: tenant,
        user: user.id,
      })),
    ),
  );
  for (const project of projects) await grant(ResourceType.PROJECT, project._id);
  const firstProject = await get('/projects?limit=1').expect(200);
  await inTenant(() => mongoose.models.AclEntry.deleteMany({ resourceType: ResourceType.PROJECT }));
  const revoked = await get(
    `/projects?limit=1&cursor=${encodeURIComponent(firstProject.body.nextCursor)}`,
  ).expect(200);
  expect(revoked.body.items).toEqual([]);
});

it('applies current policy to agent instructions, skill text, filenames and memory projections', async () => {
  config.filters = {
    agentInstructions: {
      pii: {
        fields: ['instructions'],
        starterPatterns: [],
        customPatterns: [{ id: 'blocked', label: 'blocked', regex: 'BLOCKED' }],
      },
    },
    skills: {
      pii: {
        fields: ['file_text'],
        starterPatterns: [],
        customPatterns: [{ id: 'blocked', label: 'blocked', regex: 'BLOCKED' }],
      },
    },
    files: {
      pii: {
        fields: ['name'],
        starterPatterns: [],
        customPatterns: [{ id: 'blocked', label: 'blocked', regex: 'BLOCKED' }],
      },
    },
    memories: {
      pii: {
        fields: ['value'],
        starterPatterns: [],
        customPatterns: [{ id: 'blocked', label: 'blocked', regex: 'BLOCKED' }],
      },
    },
  };
  const agent = await inTenant(() =>
    mongoose.models.Agent.create({
      tenantId: tenant,
      id: 'filtered',
      provider: 'openAI',
      model: 'test',
      author: user._id,
      instructions: 'BLOCKED',
    }),
  );
  await grant(ResourceType.AGENT, agent._id, PermissionBits.VIEW | PermissionBits.EDIT);
  await get('/agents/filtered').expect(403);
  const project = await inTenant(() =>
    mongoose.models.Project.create({
      tenantId: tenant,
      projectId: 'filtered-project',
      name: 'Safe',
      user: user.id,
      fileIds: ['filtered-file'],
    }),
  );
  await grant(ResourceType.PROJECT, project._id);
  await inTenant(() =>
    mongoose.models.File.create({
      tenantId: tenant,
      file_id: 'filtered-file',
      filename: 'BLOCKED.pdf',
      user: user._id,
      bytes: 4,
      filepath: '/private',
      type: 'application/pdf',
    }),
  );
  const inventory = await get('/projects/filtered-project/files').expect(200);
  expect(inventory.body.items[0]).toMatchObject({ name: '', contentFilterBlocked: true });
  const skill = await inTenant(() =>
    mongoose.models.Skill.create({
      tenantId: tenant,
      name: 'filtered-skill',
      description: 'Safe',
      body: 'Safe',
      author: user._id,
      authorName: 'Owner',
      source: 'inline',
      fileCount: 1,
    }),
  );
  await grant(ResourceType.SKILL, skill._id);
  await inTenant(() =>
    mongoose.models.SkillFile.create({
      tenantId: tenant,
      skillId: skill._id,
      file_id: 'text',
      relativePath: 'reference.md',
      filename: 'reference.md',
      filepath: '/private',
      source: 'local',
      mimeType: 'text/markdown',
      bytes: 7,
      content: 'BLOCKED',
      author: user._id,
    }),
  );
  const text = await get(`/skills/${skill._id}/files/reference.md`).expect(403);
  expect(text.body.error.code).toBe('content_filtered');
  await inTenant(() =>
    mongoose.models.MemoryEntry.create({
      tenantId: tenant,
      userId: user._id,
      key: 'safe',
      value: 'BLOCKED',
    }),
  );
  const memories = await get('/memories').expect(200);
  expect(memories.body.items[0]).toMatchObject({ value: '', contentFilterBlocked: true });
  expect(JSON.stringify(memories.body)).not.toContain('BLOCKED');
});
