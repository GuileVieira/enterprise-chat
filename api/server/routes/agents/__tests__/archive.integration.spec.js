process.env.TENANT_ISOLATION_STRICT = 'true';

const express = require('express');
const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { tenantStorage } = require('@librechat/data-schemas');
const { encodeAgentArchive } = require('@librechat/api');
const {
  ResourceType,
  AccessRoleIds,
  PrincipalType,
  PermissionBits,
} = require('librechat-data-provider');

const mockSaveBuffer = jest.fn();
const mockDeleteFile = jest.fn();
const mockCreateAgent = jest.fn();
jest.mock('~/server/controllers/agents/v1', () => ({
  createAgent: (...args) => mockCreateAgent(...args),
}));
jest.mock('~/server/services/Config', () => ({
  checkCapability: jest.fn().mockResolvedValue(true),
}));
jest.mock('~/server/middleware/roles/capabilities', () => ({
  hasCapability: jest.fn().mockResolvedValue(false),
}));
jest.mock('~/server/utils/getFileStrategy', () => ({ getFileStrategy: () => 'local' }));
jest.mock('~/server/services/Files/strategies', () => ({
  getStrategyFunctions: () => ({ saveBuffer: mockSaveBuffer, deleteFile: mockDeleteFile }),
}));
jest.mock('~/server/services/Endpoints/agents/skillDeps', () => ({
  getSkillDbMethods: () => require('~/models'),
  getSkillStrategyFunctions: () => ({}),
  withDeploymentSkillIds: (ids) => ids,
}));
jest.mock('~/models', () => {
  const mongoose = require('mongoose');
  const { createMethods } = require('@librechat/data-schemas');
  return {
    ...createMethods(mongoose, {
      removeAllPermissions: async ({ resourceType, resourceId }) =>
        mongoose.models.AclEntry.deleteMany({ resourceType, resourceId }),
    }),
    getRoleByName: jest.fn().mockResolvedValue({
      permissions: {
        AGENTS: { USE: true, CREATE: true },
        SKILLS: { USE: true, CREATE: true },
      },
    }),
  };
});

let mongo;
let app;
let user;
let models;
const tenant = 'archive-test';
let auth = true;
let filters;
const withinTenant = (fn) => tenantStorage.run({ tenantId: tenant }, fn);

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  models = require('~/db/models');
  await withinTenant(async () => {
    user = await models.User.create({
      name: 'Archive user',
      email: 'archive@example.com',
      role: 'USER',
      tenantId: tenant,
    });
    for (const [accessRoleId, resourceType, permBits] of [
      [AccessRoleIds.AGENT_VIEWER, ResourceType.AGENT, PermissionBits.VIEW],
      [AccessRoleIds.AGENT_EDITOR, ResourceType.AGENT, PermissionBits.VIEW | PermissionBits.EDIT],
      [
        AccessRoleIds.SKILL_OWNER,
        ResourceType.SKILL,
        PermissionBits.VIEW | PermissionBits.EDIT | PermissionBits.DELETE | PermissionBits.SHARE,
      ],
    ])
      await models.AccessRole.create({
        accessRoleId,
        resourceType,
        permBits,
        name: accessRoleId,
        tenantId: tenant,
      });
  });
  const { handlers, upload, handleError } = require('../archive');
  app = express();
  app.use((req, res, next) => {
    if (!auth) return res.status(401).end();
    req.user = { id: String(user._id), _id: user._id, role: 'USER', tenantId: tenant };
    req.config = { fileStrategy: 'local', filters };
    return withinTenant(next);
  });
  app.get('/api/agents/:id/export', handlers.export, handleError);
  app.post('/api/agents/import/preview', upload, handlers.preview, handleError);
  app.post('/api/agents/import', upload, handlers.import, handleError);
});

afterEach(async () => {
  await withinTenant(async () => {
    await models.Agent.deleteMany({});
    await models.Skill.deleteMany({});
    await models.SkillFile.deleteMany({});
    await models.AclEntry.deleteMany({});
  });
  auth = true;
  filters = undefined;
  jest.clearAllMocks();
});
afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
  delete process.env.TENANT_ISOLATION_STRICT;
});

function bundle(files = []) {
  return {
    agent: {
      name: 'Archive Agent',
      provider: 'openAI',
      model: 'gpt-5',
      skills_enabled: true,
      skills_scope: 'selected',
    },
    instructions: 'Safe instructions',
    skills: [
      {
        name: 'portable-skill',
        files: [
          {
            path: 'SKILL.md',
            data: Buffer.from(
              '---\nname: portable-skill\ndescription: A portable skill for tests\n---\nInstructions',
            ),
          },
          ...files,
        ],
      },
    ],
    tools: [{ name: 'private-mcp', kind: 'mcp' }],
  };
}

it('rejects VIEW-only export and allows EDIT', async () => {
  const service = require('~/server/services/PermissionService');
  const agent = await withinTenant(() =>
    models.Agent.create({
      id: 'agent-1',
      name: 'Secret',
      provider: 'openAI',
      model: 'gpt-5',
      instructions: 'sensitive',
      author: user._id,
      tenantId: tenant,
    }),
  );
  const grant = (accessRoleId) =>
    withinTenant(() =>
      service.grantPermission({
        principalType: PrincipalType.USER,
        principalId: String(user._id),
        resourceType: ResourceType.AGENT,
        resourceId: agent._id,
        accessRoleId,
        grantedBy: String(user._id),
      }),
    );
  await grant(AccessRoleIds.AGENT_VIEWER);
  expect((await request(app).get('/api/agents/agent-1/export')).status).toBe(404);
  await grant(AccessRoleIds.AGENT_EDITOR);
  const result = await request(app).get('/api/agents/agent-1/export');
  expect(result.status).toBe(200);
  expect(result.headers['content-type']).toMatch(/application\/zip/);
});

it('does not disclose a foreign tenant agent or bypass authentication', async () => {
  await tenantStorage.run({ tenantId: 'foreign-tenant' }, async () =>
    models.Agent.create({
      id: 'foreign-agent',
      name: 'Foreign',
      provider: 'openAI',
      model: 'gpt-5',
      instructions: 'private',
      author: user._id,
      tenantId: 'foreign-tenant',
    }),
  );
  expect((await request(app).get('/api/agents/foreign-agent/export')).status).toBe(404);
  auth = false;
  expect((await request(app).get('/api/agents/foreign-agent/export')).status).toBe(401);
});

it('requires skill VIEW before exporting its content', async () => {
  const service = require('~/server/services/PermissionService');
  const skill = await withinTenant(
    async () =>
      (
        await require('~/models').createSkill({
          name: 'private-skill',
          description: 'Private skill for export testing',
          body: 'secret',
          authorName: 'Archive user',
          author: user._id,
          tenantId: tenant,
        })
      ).skill,
  );
  const agent = await withinTenant(() =>
    models.Agent.create({
      id: 'agent-skill',
      name: 'Agent',
      provider: 'openAI',
      model: 'gpt-5',
      author: user._id,
      tenantId: tenant,
      skills: [String(skill._id)],
      skills_enabled: true,
      skills_scope: 'selected',
    }),
  );
  const grant = (resourceType, resourceId, accessRoleId) =>
    withinTenant(() =>
      service.grantPermission({
        principalType: PrincipalType.USER,
        principalId: String(user._id),
        resourceType,
        resourceId,
        accessRoleId,
        grantedBy: String(user._id),
      }),
    );
  await grant(ResourceType.AGENT, agent._id, AccessRoleIds.AGENT_EDITOR);
  expect((await request(app).get('/api/agents/agent-skill/export')).status).toBe(403);
  await grant(ResourceType.SKILL, skill._id, AccessRoleIds.SKILL_OWNER);
  const response = await request(app).get('/api/agents/agent-skill/export');
  expect(response.status).toBe(200);
});

it('blocks filtered skill content during preview without storing records', async () => {
  filters = {
    skills: {
      pii: {
        fields: ['instructions'],
        starterPatterns: [],
        customPatterns: [{ id: 'private_token', label: 'private token', regex: 'PRIVATE-\\d+' }],
      },
    },
  };
  const data = bundle();
  data.skills[0].files[0].data = Buffer.from(
    '---\nname: portable-skill\ndescription: A portable skill for tests\n---\nPRIVATE-1234',
  );
  const result = await request(app)
    .post('/api/agents/import/preview')
    .attach('file', await encodeAgentArchive(data), 'agent.zip');
  expect(result.status).toBe(400);
  expect(await withinTenant(async () => await models.Skill.countDocuments({}))).toBe(0);
  expect(mockSaveBuffer).not.toHaveBeenCalled();
});

it('requires skill CREATE before previewing an archive that contains skills', async () => {
  require('~/models').getRoleByName.mockResolvedValueOnce({
    permissions: {
      AGENTS: { USE: true, CREATE: true },
      SKILLS: { USE: true, CREATE: false },
    },
  });
  const response = await request(app)
    .post('/api/agents/import/preview')
    .attach('file', await encodeAgentArchive(bundle()), 'agent.zip');
  expect(response.status).toBe(403);
  expect(await withinTenant(async () => await models.Skill.countDocuments({}))).toBe(0);
});

it('never resolves inherited object properties as authorized native tools', async () => {
  const source = bundle();
  source.skills = [];
  source.tools = [
    { name: 'constructor', kind: 'builtin' },
    { name: 'toString', kind: 'builtin' },
  ];
  mockCreateAgent.mockImplementation(async (req, res) =>
    res.status(201).json({ id: 'fresh-agent', ...req.body }),
  );
  const imported = await request(app)
    .post('/api/agents/import')
    .attach('file', await encodeAgentArchive(source), 'agent.zip');
  expect(imported.status).toBe(201);
  expect(imported.body.tools).toEqual([]);
});

it('previews without writes, rejects code and imports fresh IDs without external tools', async () => {
  const archive = await encodeAgentArchive(bundle());
  const before = await withinTenant(async () => await models.Skill.countDocuments({}));
  const preview = await request(app)
    .post('/api/agents/import/preview')
    .attach('file', archive, 'agent.zip');
  expect(preview.status).toBe(200);
  expect(preview.body).toMatchObject({
    name: 'Archive Agent',
    skills: ['portable-skill'],
    tools: ['private-mcp'],
  });
  expect(await withinTenant(async () => await models.Skill.countDocuments({}))).toBe(before);
  const code = await encodeAgentArchive(
    bundle([{ path: 'run.py', data: Buffer.from('print(1)') }]),
  );
  expect(
    (await request(app).post('/api/agents/import/preview').attach('file', code, 'agent.zip'))
      .status,
  ).toBe(400);
  mockCreateAgent.mockImplementation(async (req, res) =>
    res.status(201).json({ id: 'fresh-agent', ...req.body }),
  );
  const imported = await request(app)
    .post('/api/agents/import')
    .attach('file', archive, 'agent.zip');
  expect(imported.status).toBe(201);
  expect(imported.body.id).toBe('fresh-agent');
  expect(imported.body.skills).toHaveLength(1);
  expect(imported.body.tools).toEqual([]);
  const skill = await withinTenant(
    async () => await models.Skill.findById(imported.body.skills[0]).lean(),
  );
  expect(skill.tenantId).toBe(tenant);
  expect(String(skill.author)).toBe(String(user._id));
});

it('reuses only an identical owned skill and keeps it when a later agent creation fails', async () => {
  const archive = await encodeAgentArchive(bundle());
  mockCreateAgent.mockImplementationOnce(async (_req, res) =>
    res.status(201).json({ id: 'first-agent' }),
  );
  expect(
    (await request(app).post('/api/agents/import').attach('file', archive, 'agent.zip')).status,
  ).toBe(201);
  const firstSkill = await withinTenant(
    async () => await models.Skill.findOne({ name: 'portable-skill' }).lean(),
  );
  const preview = await request(app)
    .post('/api/agents/import/preview')
    .attach('file', archive, 'agent.zip');
  expect(preview.status).toBe(200);
  expect(preview.body.warnings.join(' ')).toMatch(/portable-skill/);
  mockCreateAgent.mockImplementationOnce(async (_req, res) =>
    res.status(500).json({ error: 'failed' }),
  );
  expect(
    (await request(app).post('/api/agents/import').attach('file', archive, 'agent.zip')).status,
  ).toBe(500);
  expect(await withinTenant(async () => await models.Skill.countDocuments({}))).toBe(1);
  expect(
    await withinTenant(async () => await models.Skill.findById(firstSkill._id).lean()),
  ).not.toBeNull();
  await withinTenant(
    async () =>
      await models.Skill.updateOne(
        { _id: firstSkill._id },
        { $set: { 'frontmatter.disable-model-invocation': true } },
      ),
  );
  expect(
    (await request(app).post('/api/agents/import/preview').attach('file', archive, 'agent.zip'))
      .status,
  ).toBe(409);
  const changed = bundle();
  changed.skills[0].files[0].data = Buffer.from(
    '---\nname: portable-skill\ndescription: A different skill for tests\n---\nInstructions',
  );
  expect(
    (
      await request(app)
        .post('/api/agents/import/preview')
        .attach('file', await encodeAgentArchive(changed), 'agent.zip')
    ).status,
  ).toBe(409);
});

it('removes created skill rows and stored files when agent creation fails', async () => {
  mockSaveBuffer.mockResolvedValue('/uploads/archive-file');
  mockDeleteFile.mockResolvedValue(undefined);
  mockCreateAgent.mockImplementation(async (_req, res) =>
    res.status(500).json({ error: 'failed' }),
  );
  const archive = await encodeAgentArchive(
    bundle([{ path: 'references/guide.md', data: Buffer.from('Guide') }]),
  );
  const response = await request(app)
    .post('/api/agents/import')
    .attach('file', archive, 'agent.zip');
  expect(response.status).toBe(500);
  expect(await withinTenant(async () => await models.Skill.countDocuments({}))).toBe(0);
  expect(await withinTenant(async () => await models.SkillFile.countDocuments({}))).toBe(0);
  expect(mockDeleteFile).toHaveBeenCalledTimes(1);
});
