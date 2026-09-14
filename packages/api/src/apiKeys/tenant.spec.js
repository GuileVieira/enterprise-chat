import express from 'express';
import mongoose from 'mongoose';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createMethods, createModels, runAsSystem, tenantStorage } from '@librechat/data-schemas';
import { PermissionBits, PrincipalType, ResourceType } from 'librechat-data-provider';
import { createTenantApiHandlers } from './tenant';
import { createRequireApiKeyAuth } from './middleware';
import { preAuthTenantMiddleware } from '../middleware/preAuthTenant';
import { loadProjectMemories } from '../utils/projectContext';

const db = createMethods(mongoose);
const handlers = createTenantApiHandlers({
  ...db,
  getEffectivePermissions: async ({ userId, resourceType, resourceId }) =>
    db.getEffectivePermissions(
      [{ principalType: PrincipalType.USER, principalId: userId }],
      resourceType,
      new mongoose.Types.ObjectId(resourceId),
    ),
});
const app = express();
app.use(express.json());
// Test-only session boundary: resolve real persisted actors, then test management authorization.
app.use('/keys', async (req, res, next) => {
  const user = await runAsSystem(() => db.findUser({ email: req.get('X-Test-User') }));
  if (!user) return res.sendStatus(401);
  req.user = user;
  next();
});
app.get('/keys/catalog', handlers.manage);
app.get('/keys', handlers.manage);
app.post('/keys', handlers.manage);
app.delete('/keys/:id', handlers.manage);
app.use('/remote', preAuthTenantMiddleware, createRequireApiKeyAuth(db));
app.get('/remote/catalog', handlers.remoteCatalog);
app.get('/remote/projects', handlers.remoteCatalog);
app.get('/remote/models', handlers.remoteCatalog);
app.post('/remote/run', handlers.requireProjectAccess, async (req, res) => {
  const project = await db.getProjectById(req.body.projectId);
  res.json({
    tenantId: tenantStorage.getStore()?.tenantId,
    instructions: project?.instructions,
    memories: await loadProjectMemories(project),
    files: project?.fileIds,
  });
});

let server;
let ownerA;
beforeAll(async () => {
  server = await MongoMemoryServer.create();
  await mongoose.connect(server.getUri());
  createModels(mongoose);
});
afterAll(async () => {
  await mongoose.disconnect();
  await server?.stop();
});
beforeEach(async () => {
  await mongoose.connection.dropDatabase();
  await runAsSystem(async () => {
    for (const [email, role, tenantId] of [
      ['owner-a@test.local', 'OWNER', 'tenant-a'],
      ['owner-b@test.local', 'OWNER', 'tenant-b'],
      ['member@test.local', 'USER', 'tenant-a'],
      ['admin@test.local', 'ADMIN', 'admin-tenant'],
    ]) {
      await mongoose.models.User.create({ email, role, tenantId, provider: 'local' });
    }
  });
  ownerA = await runAsSystem(() => db.findUser({ email: 'owner-a@test.local' }));
  for (const tenantId of ['tenant-a', 'tenant-b']) {
    await tenantStorage.run({ tenantId }, async () => {
      const principal = (await db.findUsers({ role: 'OWNER' }))[0];
      const project = await mongoose.models.Project.create({
        user: String(principal._id),
        projectId: `project-${tenantId}`,
        name: `Project ${tenantId}`,
        instructions: 'instruction-canary',
        memories: [{ key: 'canary', value: 'memory-canary' }],
        fileIds: ['file-canary'],
      });
      const agent = await mongoose.models.Agent.create({
        id: `agent-${tenantId}`,
        name: `Agent ${tenantId}`,
        provider: 'openai',
        model: 'test',
        author: principal._id,
      });
      await db.grantPermission(
        PrincipalType.USER,
        principal._id,
        ResourceType.PROJECT,
        project._id,
        PermissionBits.VIEW,
        principal._id,
      );
      await db.grantPermission(
        PrincipalType.USER,
        principal._id,
        ResourceType.AGENT,
        agent._id,
        PermissionBits.SHARE,
        principal._id,
      );
    });
  }
});

const create = (tenant = 'tenant-a', actor = 'owner-a@test.local') =>
  request(app)
    .post(`/keys?tenantId=${tenant}`)
    .set('X-Test-User', actor)
    .send({ name: 'Integration' });

it('allows only OWNER of the target tenant or ADMIN to manage tenant keys', async () => {
  await create('tenant-a', 'member@test.local').expect(403);
  await create('tenant-b').expect(403);
  await create('__SYSTEM__', 'admin@test.local').expect(403);
  await create('missing-tenant', 'admin@test.local').expect(409);
  const result = await create('tenant-b', 'admin@test.local').expect(201);
  const key = await db.validateAgentApiKey(result.body.key);
  const principal = await runAsSystem(() => db.findUser({ _id: key.userId }));
  expect(principal).toMatchObject({ role: 'OWNER', tenantId: 'tenant-b' });
});

it('stores only a hash, exposes no secret in catalogs/listing and revokes within the target tenant', async () => {
  const result = await create().expect(201);
  const secret = result.body.key;
  const stored = await runAsSystem(async () =>
    mongoose.models.AgentApiKey.findById(result.body.id).select('+keyHash').lean(),
  );
  expect(stored).toMatchObject({ scope: 'tenant', tenantId: 'tenant-a', userId: ownerA._id });
  expect(JSON.stringify(stored)).not.toContain(secret);
  const listed = await request(app)
    .get('/keys?tenantId=tenant-a')
    .set('X-Test-User', 'owner-a@test.local')
    .expect(200);
  expect(listed.body.keys).toHaveLength(1);
  expect(listed.body.keys[0]).not.toHaveProperty('key');
  expect(listed.body.keys[0]).not.toHaveProperty('keyHash');
  await tenantStorage.run({ tenantId: 'tenant-a' }, async () => {
    expect(await db.listAgentApiKeys(ownerA._id)).toEqual([]);
    expect(await db.deleteAgentApiKey(result.body.id, ownerA._id)).toBe(false);
  });
  await request(app)
    .delete(`/keys/${result.body.id}?tenantId=tenant-b`)
    .set('X-Test-User', 'owner-b@test.local')
    .expect(404);
  expect(await db.validateAgentApiKey(secret)).not.toBeNull();
  await request(app)
    .delete(`/keys/${result.body.id}?tenantId=tenant-a`)
    .set('X-Test-User', 'owner-a@test.local')
    .expect(204);
  expect(await db.validateAgentApiKey(secret)).toBeNull();
});

it('uses the same tenant and ACL for preview, key catalog and project context', async () => {
  const { body } = await create().expect(201);
  const preview = await request(app)
    .get('/keys/catalog?tenantId=tenant-a')
    .set('X-Test-User', 'owner-a@test.local')
    .expect(200);
  const remote = await request(app)
    .get('/remote/catalog')
    .set('X-Tenant-Id', 'tenant-b')
    .set('Authorization', `Bearer ${body.key}`)
    .expect(200);
  expect(remote.body).toEqual(preview.body);
  expect(remote.body.agents.map((agent) => agent.id)).toEqual(['agent-tenant-a']);
  expect(remote.body.projects.map((project) => project.projectId)).toEqual(['project-tenant-a']);
  expect(JSON.stringify(remote.body)).not.toContain(body.key);
  const projects = await request(app)
    .get('/remote/projects')
    .set('Authorization', `Bearer ${body.key}`)
    .expect(200);
  expect(projects.body.data).toEqual(remote.body.projects);
  const models = await request(app)
    .get('/remote/models')
    .set('Authorization', `Bearer ${body.key}`)
    .expect(200);
  expect(models.body.data[0]).toMatchObject({ id: 'agent-tenant-a', object: 'model' });
  const run = await request(app)
    .post('/remote/run')
    .set('Authorization', `Bearer ${body.key}`)
    .send({ projectId: 'project-tenant-a' })
    .expect(200);
  expect(run.body).toMatchObject({
    tenantId: 'tenant-a',
    instructions: 'instruction-canary',
    files: ['file-canary'],
  });
  expect(run.body.memories).toContain('memory-canary');
  await request(app)
    .post('/remote/run')
    .set('Authorization', `Bearer ${body.key}`)
    .send({ projectId: 'project-tenant-b' })
    .expect(404);
  await tenantStorage.run({ tenantId: 'tenant-a' }, async () => {
    await mongoose.models.AclEntry.deleteMany({ resourceType: ResourceType.PROJECT });
  });
  await request(app)
    .post('/remote/run')
    .set('Authorization', `Bearer ${body.key}`)
    .send({ projectId: 'project-tenant-a' })
    .expect(403);
});

it.each([
  ['role', 'USER'],
  ['tenantId', 'tenant-b'],
  ['disabled', true],
])('invalidates tenant keys after responsible owner changes %s', async (field, value) => {
  const { body } = await create().expect(201);
  await runAsSystem(async () =>
    mongoose.models.User.updateOne({ _id: ownerA._id }, { $set: { [field]: value } }),
  );
  expect(await db.validateAgentApiKey(body.key)).toBeNull();
  await request(app).get('/remote/catalog').set('Authorization', `Bearer ${body.key}`).expect(401);
});

it('rejects missing, expired and personal keys on the tenant catalog', async () => {
  await request(app).get('/remote/catalog').expect(401);
  const { body } = await create().expect(201);
  await runAsSystem(async () =>
    mongoose.models.AgentApiKey.updateOne(
      { _id: body.id },
      { $set: { expiresAt: new Date(Date.now() - 1000) } },
    ),
  );
  await request(app).get('/remote/catalog').set('Authorization', `Bearer ${body.key}`).expect(401);
  const personal = await tenantStorage.run({ tenantId: 'tenant-a' }, async () =>
    db.createAgentApiKey({ userId: ownerA._id, name: 'Personal' }),
  );
  expect(await db.validateAgentApiKey(personal.key)).not.toBeNull();
  await request(app)
    .get('/remote/catalog')
    .set('Authorization', `Bearer ${personal.key}`)
    .expect(403);
});
