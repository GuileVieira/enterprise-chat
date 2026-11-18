process.env.OPENWEATHER_API_KEY = 'fixture-weather-key';
process.env.CREDS_KEY = '0123456789abcdef0123456789abcdef';
process.env.CREDS_IV = '0123456789abcdef0123456789abcdef';
const http = require('http');
const express = require('express');
const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { createModels, runAsSystem, tenantStorage } = require('@librechat/data-schemas');
const {
  PermissionBits,
  PrincipalType,
  ResourceType,
  CacheKeys,
  AgentCapabilities,
} = require('librechat-data-provider');
const { capabilityContextMiddleware } = require('@librechat/api');
const db = require('~/models');
const getLogStores = require('~/cache/getLogStores');
const { clearOverrideCache } = require('~/server/services/Config');

let mongo;
let upstream;
let app;
let owner;
let key;
let remoteAgent;
let exportAgent;
let calls;
let base;
const tenant = 'integration-router-a';
const inTenant = (fn) => tenantStorage.run({ tenantId: tenant }, fn);
const call = (name, body, idempotency) => {
  const req = request(app)
    .post(`/api/integrations/v1/tools/${name}/call`)
    .set('Authorization', `Bearer ${key}`)
    .send(body);
  return idempotency ? req.set('Idempotency-Key', idempotency) : req;
};
const get = (path) =>
  request(app).get(`/api/integrations/v1${path}`).set('Authorization', `Bearer ${key}`);
const grant = (type, id, bits = PermissionBits.VIEW) =>
  inTenant(() => db.grantPermission(PrincipalType.USER, owner._id, type, id, bits, owner._id));

beforeAll(async () => {
  process.env.BAN_VIOLATIONS = 'false';
  process.env.ENDPOINTS = 'agents';
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  createModels(mongoose);
  upstream = http.createServer((req, res) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
    });
    req.on('end', () => {
      calls.push({
        url: req.url,
        authorization: req.headers.authorization,
        body: data ? JSON.parse(data) : {},
      });
      res.setHeader('Content-Type', 'application/json');
      if (req.url === '/query') {
        const body = JSON.parse(data);
        if (body.file_id === 'legacy-project-file' && body.entity_id !== 'project-context') {
          res.end('[]');
          return;
        }
        res.end(
          JSON.stringify([
            [
              {
                page_content: `Chunk for ${body.file_id}`,
                metadata: { page: 0, source: '/private/storage' },
              },
              0.25,
            ],
          ]),
        );
      } else res.end(JSON.stringify({ accepted: true }));
    });
  });
  await new Promise((resolve) => upstream.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${upstream.address().port}`;
  process.env.RAG_API_URL = base;
  app = express();
  app.use(express.json());
  app.use(capabilityContextMiddleware);
  app.use('/api/integrations/v1', require('./integrations'));
});
afterAll(async () => {
  await new Promise((resolve) => upstream.close(resolve));
  await mongoose.disconnect();
  await mongo.stop();
});
beforeEach(async () => {
  calls = [];
  await mongoose.connection.dropDatabase();
  await runAsSystem(() => db.initializeRoles());
  await runAsSystem(() => db.seedDefaultRoles());
  await runAsSystem(() =>
    mongoose.models.Role.updateOne(
      { name: 'OWNER' },
      {
        $set: {
          'permissions.REMOTE_AGENTS.USE': true,
          'permissions.AGENTS.USE': true,
          'permissions.FILE_SEARCH.USE': true,
          'permissions.SKILLS.USE': true,
          'permissions.MEMORIES.READ': true,
          'permissions.SHARED_MEMORIES.READ': true,
        },
      },
    ),
  );
  await getLogStores(CacheKeys.ROLES).clear();
  await getLogStores(CacheKeys.USER_PRINCIPALS).clear();
  await getLogStores(CacheKeys.APP_CONFIG).clear();
  await clearOverrideCache();
  await getLogStores(CacheKeys.APP_CONFIG).set('_BASE_', {
    interfaceConfig: { skills: true },
    memory: { disabled: false },
    endpoints: {
      agents: {
        capabilities: [
          AgentCapabilities.file_search,
          AgentCapabilities.skills,
          AgentCapabilities.tools,
          AgentCapabilities.actions,
        ],
        remoteApi: { auth: { apiKey: { enabled: true } } },
      },
    },
  });
  owner = await inTenant(() =>
    mongoose.models.User.create({
      email: 'router-owner@example.test',
      role: 'OWNER',
      provider: 'local',
      tenantId: tenant,
    }),
  );
  key = (
    await inTenant(() =>
      db.createAgentApiKey({
        userId: owner._id,
        tenantId: tenant,
        scope: 'tenant',
        name: 'router',
      }),
    )
  ).key;
  remoteAgent = await inTenant(() =>
    mongoose.models.Agent.create({
      tenantId: tenant,
      id: 'remote-only',
      provider: 'openAI',
      model: 'external',
      author: new mongoose.Types.ObjectId(),
      instructions: 'Private agent instructions',
      tools: ['file_search', 'fn-read', 'fn-write'],
      tool_resources: { file_search: { file_ids: ['agent-file', 'foreign-file'] } },
    }),
  );
  exportAgent = await inTenant(() =>
    mongoose.models.Agent.create({
      tenantId: tenant,
      id: 'export-only',
      provider: 'openAI',
      model: 'external',
      author: new mongoose.Types.ObjectId(),
      instructions: 'Exportable instructions',
      tools: ['file_search'],
    }),
  );
  await grant(ResourceType.REMOTE_AGENT, remoteAgent._id);
  await grant(ResourceType.AGENT, exportAgent._id, PermissionBits.VIEW | PermissionBits.EDIT);
  await inTenant(() =>
    mongoose.models.File.create({
      tenantId: tenant,
      file_id: 'agent-file',
      user: remoteAgent.author,
      filename: 'report.pdf',
      filepath: '/private/report.pdf',
      type: 'application/pdf',
      bytes: 10,
    }),
  );
  await tenantStorage.run({ tenantId: 'integration-router-b' }, () =>
    mongoose.models.File.create({
      tenantId: 'integration-router-b',
      file_id: 'foreign-file',
      user: new mongoose.Types.ObjectId(),
      filename: 'foreign.pdf',
      filepath: '/private',
      type: 'application/pdf',
      bytes: 10,
    }),
  );
  await inTenant(() =>
    db.upsertTenantSecret(tenant, 'fixture', 'fixture-upstream-secret', 'api_key'),
  );
  for (const [id, method, effect] of [
    ['fn-read', 'GET', 'read'],
    ['fn-write', 'POST', 'write'],
  ]) {
    await inTenant(() =>
      mongoose.models.TenantFunction.create({
        tenantId: tenant,
        id,
        name: id,
        description: 'Fixture HTTP function',
        isActive: true,
        integrationEffect: effect,
        config: {
          baseUrl: base,
          path: '/function',
          method,
          auth: { type: 'bearer', secretName: 'fixture' },
        },
        inputSchema: { count: { type: 'integer', required: true } },
      }),
    );
  }
  await inTenant(() => mongoose.models.IntegrationCall.createIndexes());
});

it('enforces saved key resource restrictions on lists, direct reads and tool calls', async () => {
  await get('/agents/export-only').expect(200);
  await call(
    'fn-write',
    { agentId: 'remote-only', arguments: { count: 1 } },
    'scoped-replay',
  ).expect(200);
  await inTenant(() =>
    mongoose.models.AgentApiKey.updateOne(
      { scope: 'tenant' },
      {
        $set: { resourceAccess: { agentIds: [], projectIds: [] } },
      },
    ),
  );
  await get('/identity').expect(200);
  const agents = await get('/agents').expect(200);
  expect(agents.body.items).toEqual([]);
  await get('/agents/export-only').expect(404);
  const before = calls.length;
  await request(app)
    .post('/api/integrations/v1/tools/fn-read/call')
    .set('Authorization', `Bearer ${key}`)
    .send({ agentId: 'remote-only', arguments: { count: 1 } })
    .expect(404);
  expect(calls).toHaveLength(before);
  await call(
    'fn-write',
    { agentId: 'remote-only', arguments: { count: 1 } },
    'scoped-replay',
  ).expect(404);
  expect(calls).toHaveLength(before);
});

it('restricts linked files, prompts, skills and history without weakening the OWNER ACL', async () => {
  const projects = [];
  const prompts = [];
  const skills = [];
  for (const name of ['allowed', 'denied']) {
    const group = await inTenant(() =>
      mongoose.models.PromptGroup.create({
        name,
        tenantId: tenant,
        author: owner._id,
        authorName: 'Owner',
        productionId: new mongoose.Types.ObjectId(),
      }),
    );
    const prompt = await inTenant(() =>
      mongoose.models.Prompt.create({
        groupId: group._id,
        tenantId: tenant,
        author: owner._id,
        prompt: name,
        type: 'text',
      }),
    );
    await inTenant(() =>
      mongoose.models.PromptGroup.updateOne({ _id: group._id }, { productionId: prompt._id }),
    );
    const project = await inTenant(() =>
      mongoose.models.Project.create({
        projectId: name,
        name,
        tenantId: tenant,
        user: String(owner._id),
        promptGroupIds: [String(group._id)],
      }),
    );
    const skill = await inTenant(() =>
      mongoose.models.Skill.create({
        name,
        description: name,
        body: name,
        tenantId: tenant,
        author: owner._id,
        authorName: 'Owner',
        productionId: new mongoose.Types.ObjectId(),
        source: 'inline',
      }),
    );
    await grant(ResourceType.PROJECT, project._id);
    await grant(ResourceType.PROMPTGROUP, group._id);
    await grant(ResourceType.SKILL, skill._id);
    await inTenant(() =>
      mongoose.models.Conversation.create({
        conversationId: `${name}-chat`,
        endpoint: 'agents',
        title: name,
        tenantId: tenant,
        user: String(owner._id),
        agent_id: 'export-only',
        projectId: name,
      }),
    );
    projects.push(project);
    prompts.push(prompt);
    skills.push(skill);
  }
  await inTenant(() =>
    mongoose.models.File.create({
      file_id: 'denied-file',
      filename: 'private.txt',
      filepath: '/private',
      type: 'text/plain',
      bytes: 1,
      user: owner._id,
      tenantId: tenant,
      projectId: 'denied',
    }),
  );
  await inTenant(() =>
    mongoose.models.Agent.updateOne(
      { _id: exportAgent._id },
      {
        skills_enabled: true,
        skills_scope: 'selected',
        skills: [String(skills[0]._id)],
        tool_resources: { file_search: { file_ids: ['denied-file'] } },
      },
    ),
  );
  await inTenant(() =>
    mongoose.models.AgentApiKey.updateOne(
      { scope: 'tenant' },
      { resourceAccess: { agentIds: ['export-only'], projectIds: ['allowed'] } },
    ),
  );
  expect((await get('/projects').expect(200)).body.items.map((item) => item.id)).toEqual([
    'allowed',
  ]);
  await get('/projects/denied').expect(404);
  await get(`/projects/${projects[1]._id}`).expect(404);
  expect((await get('/agents/export-only/files').expect(200)).body.items).toEqual([]);
  await get(`/prompts/${prompts[0]._id}`).expect(200);
  await get(`/prompts/${prompts[1]._id}`).expect(404);
  await get(`/skills/${skills[0]._id}`).expect(200);
  await get(`/skills/${skills[1]._id}`).expect(404);
  expect((await get('/skills').expect(200)).body.items.map((item) => item.id)).toEqual([
    String(skills[0]._id),
  ]);
  expect((await get('/conversations').expect(200)).body.items.map((item) => item.id)).toEqual([
    'allowed-chat',
  ]);
  await get('/conversations/denied-chat/messages').expect(404);
  await get('/memories').expect(403);
  await get('/memories?agentId=remote-only').expect(404);
});

it('actual router authenticates key, exports context independently, searches only remote-authorized files and executes real tenant function', async () => {
  await request(app).get('/api/integrations/v1/openapi.json').expect(401);
  const contract = await get('/openapi.json').expect(200).expect('Content-Type', /json/);
  expect(contract.body).toEqual(require('../openapi/integrations.json'));
  expect(contract.body.paths['/api/integrations/v1/tools/{toolName}/call']).toBeDefined();
  const identity = await get('/identity').expect(200);
  expect(identity.body).toMatchObject({
    tenantId: tenant,
    principalId: String(owner._id),
    method: 'tenant_api_key',
  });
  await get('/agents/remote-only/context').expect(404);
  const context = await get('/agents/export-only/context?include=instructions').expect(200);
  expect(context.body.agent.instructions).toBe('Exportable instructions');
  const exportCatalog = await get('/agents/export-only/tools').expect(200);
  expect(exportCatalog.body.tools).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        name: 'file_search',
        callable: false,
        reason: 'remote_access_denied',
      }),
    ]),
  );
  const remoteCatalog = await get('/agents/remote-only/tools').expect(200);
  expect(remoteCatalog.body.tools).toEqual(
    expect.arrayContaining([expect.objectContaining({ name: 'file_search', callable: true })]),
  );
  expect(JSON.stringify(remoteCatalog.body)).not.toContain('Private agent instructions');
  const result = await call('file_search', {
    agentId: 'remote-only',
    arguments: { query: 'revenue' },
  });
  expect(result.body).not.toHaveProperty('error');
  expect(result.status).toBe(200);
  expect(result.body.data.sources).toEqual([
    expect.objectContaining({ fileId: 'agent-file', pages: [1], relevance: 0.75 }),
  ]);
  expect(JSON.stringify(result.body)).not.toMatch(/foreign-file|private\/storage/);
  const rag = calls.filter((item) => item.url === '/query');
  expect(rag).toHaveLength(1);
  expect(rag[0].authorization).not.toBe(`Bearer ${key}`);
  await get('/agents/remote-only/tools').expect(200);
  await get('/agents/remote-only/context').expect(404);
  expect(rag[0].body).toMatchObject({ file_id: 'agent-file', entity_id: 'remote-only', k: 5 });
  const fn = await call('fn-read', { agentId: 'remote-only', arguments: { count: 2 } }).expect(200);
  expect(fn.body).toMatchObject({ status: 'completed' });
  expect(calls.filter((item) => item.url.startsWith('/function'))).toHaveLength(1);
  const write = await call(
    'fn-write',
    { agentId: 'remote-only', arguments: { count: 2 } },
    'once',
  ).expect(200);
  const replay = await call(
    'fn-write',
    { agentId: 'remote-only', arguments: { count: 2 } },
    'once',
  ).expect(200);
  expect(write.body).toMatchObject({ status: 'completed', replayed: false });
  expect(replay.body).toMatchObject({ status: 'completed', replayed: true });
  expect(calls.filter((item) => item.url === '/function')).toHaveLength(1);
});

it('actual router revalidates remote grants and role on every call; conflicts and forged execution scope fail before provider HTTP', async () => {
  await call('file_search', {
    agentId: 'remote-only',
    arguments: { query: 'q', file_ids: ['foreign-file'] },
  }).expect(400);
  await call('fn-read', {
    agentId: 'remote-only',
    conversationId: 'foreign',
    arguments: { count: 1 },
  }).expect(400);
  await call('fn-read', {
    agentId: 'remote-only',
    projectId: 'foreign-project',
    arguments: { count: 1 },
  }).expect(404);
  await get('/identity').set('X-Tenant-Id', 'foreign').expect(403);
  await get('/identity?tenantId=foreign').expect(403);
  await call('fn-read', {
    tenantId: 'foreign',
    agentId: 'remote-only',
    arguments: { count: 1 },
  }).expect(403);
  expect(calls).toHaveLength(0);
  await inTenant(() =>
    mongoose.models.AclEntry.deleteMany({
      resourceType: ResourceType.REMOTE_AGENT,
      resourceId: remoteAgent._id,
    }),
  );
  await call('file_search', { agentId: 'remote-only', arguments: { query: 'q' } }).expect(404);
  await runAsSystem(() =>
    mongoose.models.Role.updateOne(
      { name: 'OWNER' },
      { $set: { 'permissions.REMOTE_AGENTS.USE': false } },
    ),
  );
  await getLogStores(CacheKeys.ROLES).clear();
  await get('/identity').expect(200);
  await call('fn-read', { agentId: 'remote-only', arguments: { count: 1 } }).expect(403);
  expect(calls).toHaveLength(0);
});

it('uses real builtin loader for calculator/weather help and durable project pause; PROJECT VIEW cannot mutate', async () => {
  await inTenant(() =>
    mongoose.models.Agent.updateOne(
      { _id: remoteAgent._id },
      { $push: { tools: { $each: ['calculator', 'open_weather', 'meta_ads_budget_manager'] } } },
    ),
  );
  const calculation = await call('calculator', {
    agentId: 'remote-only',
    arguments: { input: '1 + 2' },
  }).expect(200);
  expect(calculation.body).toMatchObject({ status: 'completed', data: '3' });
  const weather = await call('open_weather', {
    agentId: 'remote-only',
    arguments: { action: 'help' },
  }).expect(200);
  expect(weather.body.status).toBe('completed');
  expect(calls).toHaveLength(0);
  const project = await inTenant(() =>
    mongoose.models.Project.create({
      tenantId: tenant,
      projectId: 'budget-project',
      name: 'Budget',
      user: String(owner._id),
      metaAds: { enabled: true, tokenSecretName: 'PRIVATE-SECRET-NAME' },
    }),
  );
  await grant(ResourceType.PROJECT, project._id);
  await call(
    'meta_ads_budget_manager',
    {
      agentId: 'remote-only',
      projectId: 'budget-project',
      arguments: { action: 'pause_automation' },
    },
    'pause',
  ).expect(404);
  expect(
    await inTenant(() => mongoose.models.IntegrationCall.countDocuments({ key: 'pause' })),
  ).toBe(0);
  await grant(ResourceType.PROJECT, project._id, PermissionBits.VIEW | PermissionBits.EDIT);
  const pause = await call(
    'meta_ads_budget_manager',
    {
      agentId: 'remote-only',
      projectId: 'budget-project',
      arguments: { action: 'pause_automation' },
    },
    'pause',
  ).expect(200);
  expect(pause.body).toMatchObject({ status: 'completed', data: { automationEnabled: false } });
  expect(JSON.stringify(pause.body)).not.toContain('PRIVATE-SECRET-NAME');
  expect((await inTenant(() => db.getProjectById('budget-project'))).metaAds.enabled).toBe(false);
  const replay = await call(
    'meta_ads_budget_manager',
    {
      agentId: 'remote-only',
      projectId: 'budget-project',
      arguments: { action: 'pause_automation' },
    },
    'pause',
  ).expect(200);
  expect(replay.body.replayed).toBe(true);
});

it('searches authorized legacy linked files under selected project entity without client-controlled file IDs', async () => {
  const project = await inTenant(() =>
    mongoose.models.Project.create({
      tenantId: tenant,
      projectId: 'project-context',
      name: 'Legacy project',
      user: String(owner._id),
      fileIds: ['legacy-project-file', 'foreign-file'],
    }),
  );
  await grant(ResourceType.PROJECT, project._id);
  await inTenant(() =>
    mongoose.models.File.create({
      tenantId: tenant,
      file_id: 'legacy-project-file',
      user: new mongoose.Types.ObjectId(),
      filename: 'legacy.pdf',
      filepath: '/private/legacy.pdf',
      type: 'application/pdf',
      bytes: 10,
    }),
  );
  const result = await call('file_search', {
    agentId: 'remote-only',
    projectId: 'project-context',
    arguments: { query: 'legacy clause' },
  }).expect(200);
  expect(result.body.data.sources).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        fileId: 'legacy-project-file',
        content: 'Chunk for legacy-project-file',
      }),
    ]),
  );
  expect(calls.filter((item) => item.body.file_id === 'legacy-project-file')).toEqual([
    expect.objectContaining({
      body: expect.objectContaining({
        file_id: 'legacy-project-file',
        entity_id: 'project-context',
      }),
    }),
  ]);
  expect(JSON.stringify(result.body)).not.toMatch(/foreign-file|private\/legacy/);
});

it.each([undefined, 'orqest'])(
  'lists VIEW shares from %s without exporting instructions; EDIT enables export',
  async (sourceTenant) => {
    await runAsSystem(async () => {
      for (const [id, bits] of [
        ['agent-global-editor', PermissionBits.EDIT],
        ['agent-global-viewer', PermissionBits.VIEW],
        ['agent-global-hidden', 0],
      ]) {
        const agent = await mongoose.models.Agent.create({
          id,
          tenantId: sourceTenant,
          name: id,
          author: owner._id,
          provider: 'openai',
          model: 'test',
          instructions: 'shared instruction',
        });
        if (bits)
          await inTenant(() =>
            db.grantPermission(
              PrincipalType.TENANT,
              tenant,
              ResourceType.AGENT,
              agent._id,
              bits,
              owner._id,
            ),
          );
      }
    });
    await get('/agents/agent-global-editor').expect(200);
    await get('/agents/agent-global-viewer').expect(404);
    await get('/agents/agent-global-hidden').expect(404);
    const result = await get('/agents').expect(200);
    expect(result.body.items.map((agent) => agent.id)).toContain('agent-global-editor');
    expect(result.body.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'agent-global-viewer', exportable: false }),
      ]),
    );
    expect(
      result.body.items.find((agent) => agent.id === 'agent-global-viewer').instructions,
    ).toBeUndefined();
    expect(result.body.items.map((agent) => agent.id)).not.toContain('agent-global-hidden');
  },
);

it('allows authenticated discovery and authorized reads with remote execution disabled; tool calls remain denied', async () => {
  await runAsSystem(async () => {
    await mongoose.models.Role.updateOne(
      { name: 'OWNER' },
      { $set: { 'permissions.REMOTE_AGENTS.USE': false } },
    );
  });
  await getLogStores(CacheKeys.ROLES).clear();
  await get('/identity').expect(200);
  await get('/openapi.json').expect(200);
  await get('/agents/export-only').expect(200);
  await get('/projects').expect(200);
  await call('fn-read', { agentId: 'remote-only', arguments: { count: 1 } }).expect(403);
  expect(calls).toHaveLength(0);
  await request(app)
    .get('/api/integrations/v1/identity')
    .set('Authorization', 'Bearer sk-invalid')
    .expect(401);
});

it.each([false, true])(
  'searches with no agent-level file resources (project=%s) instead of crashing before RAG',
  async (withProject) => {
    await inTenant(async () => {
      await mongoose.models.Agent.updateOne(
        { _id: remoteAgent._id },
        { $set: { tool_resources: {} } },
      );
      if (withProject) {
        const project = await mongoose.models.Project.create({
          user: String(owner._id),
          projectId: 'project-empty-agent',
          name: 'Project files',
          fileIds: ['agent-file'],
        });
        await db.grantPermission(
          PrincipalType.USER,
          owner._id,
          ResourceType.PROJECT,
          project._id,
          PermissionBits.VIEW,
          owner._id,
        );
      }
    });
    const response = await call('file_search', {
      agentId: 'remote-only',
      ...(withProject ? { projectId: 'project-empty-agent' } : {}),
      arguments: { query: 'q' },
    });
    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe(withProject ? 'success' : 'no_files');
    expect(calls.filter((entry) => entry.url === '/query')).toHaveLength(withProject ? 1 : 0);
  },
);

it('searches all 60 authorized project files without invoking an agent LLM or accepting file overrides', async () => {
  const ids = Array.from({ length: 60 }, (_, i) => `large-project-file-${i}`);
  await inTenant(async () => {
    await mongoose.models.Agent.updateOne(
      { _id: remoteAgent._id },
      { $set: { tool_resources: {} } },
    );
    await mongoose.models.File.insertMany(
      ids.map((id) => ({
        file_id: id,
        filename: `${id}.txt`,
        user: owner._id,
        filepath: '/private/project-files',
        type: 'text/plain',
        bytes: 10,
      })),
    );
    const project = await mongoose.models.Project.create({
      user: String(owner._id),
      projectId: 'project-60',
      name: '60 files',
      fileIds: ids,
    });
    await db.grantPermission(
      PrincipalType.USER,
      owner._id,
      ResourceType.PROJECT,
      project._id,
      PermissionBits.VIEW,
      owner._id,
    );
  });
  const response = await call('file_search', {
    agentId: 'remote-only',
    projectId: 'project-60',
    arguments: { query: 'Find the meeting' },
  }).expect(200);
  expect(response.body.data.status).toBe('success');
  expect(response.body.data.sources).toHaveLength(10);
  expect(response.body.data.limits.files).toBe(200);
  expect(calls).toHaveLength(60);
  expect(
    calls.every(
      (entry) =>
        entry.url === '/query' &&
        ids.includes(entry.body.file_id) &&
        entry.body.entity_id === 'project-60',
    ),
  ).toBe(true);
  await call('file_search', {
    agentId: 'remote-only',
    projectId: 'project-60',
    arguments: { query: 'q', file_ids: ['foreign-file'] },
  }).expect(400);
  expect(calls).toHaveLength(60);
});
