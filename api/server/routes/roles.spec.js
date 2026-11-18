const express = require('express');
const request = require('supertest');
const passport = require('passport');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const {
  createModels,
  runAsSystem,
  tenantStorage,
  SystemCapabilities,
} = require('@librechat/data-schemas');
const { PrincipalType, CacheKeys } = require('librechat-data-provider');
const { capabilityContextMiddleware } = require('@librechat/api');
const db = require('~/models');
const getLogStores = require('~/cache/getLogStores');

let mongo;
let app;
let admin;
let manager;
const tenantId = 'orqest';
const auth = (user) =>
  `Bearer ${jwt.sign({ id: String(user._id) }, process.env.JWT_SECRET, { expiresIn: '5m' })}`;
beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  createModels(mongoose);
  passport.use(require('~/strategies/jwtStrategy')());
  app = express();
  app.use(express.json(), passport.initialize(), capabilityContextMiddleware);
  app.use('/api/roles', require('./roles'));
});
afterAll(async () => {
  passport.unuse('jwt');
  await mongoose.disconnect();
  await mongo.stop();
});
beforeEach(async () => {
  await mongoose.connection.dropDatabase();
  await getLogStores(CacheKeys.ROLES).clear();
  await getLogStores(CacheKeys.USER_PRINCIPALS).clear();
  await runAsSystem(async () => {
    await db.initializeRoles();
    admin = await mongoose.models.User.create({
      email: 'admin@roles.test',
      role: 'ADMIN',
      tenantId,
      provider: 'local',
    });
    manager = await mongoose.models.User.create({
      email: 'manager@roles.test',
      role: 'USER',
      tenantId,
      provider: 'local',
    });
  });
  await tenantStorage.run({ tenantId }, async () => {
    await db.grantCapability({
      principalType: PrincipalType.USER,
      principalId: admin._id,
      capability: SystemCapabilities.MANAGE_ROLES,
      tenantId,
    });
    await db.grantCapability({
      principalType: PrincipalType.USER,
      principalId: manager._id,
      capability: SystemCapabilities.MANAGE_ROLES,
      tenantId,
    });
    await db.createRoleByName({ name: 'local-role', description: 'Tenant role' });
  });
});
it('lets an authenticated ADMIN in a tenant save the global OWNER remote permissions', async () => {
  const before = await request(app).get('/api/roles/OWNER').set('Authorization', auth(admin));
  expect(before.body.permissions.REMOTE_AGENTS.USE).toBe(false);
  const response = await request(app)
    .put('/api/roles/OWNER/remote-agents')
    .set('Authorization', auth(admin))
    .send({ USE: true, CREATE: false, SHARE: false, SHARE_PUBLIC: false });
  expect(response.status).toBe(200);
  expect(response.body.permissions.REMOTE_AGENTS.USE).toBe(true);
  const saved = await runAsSystem(async () =>
    mongoose.models.Role.findOne({ name: 'OWNER', tenantId: null }).lean(),
  );
  expect(saved.permissions.REMOTE_AGENTS.USE).toBe(true);
  expect(saved.tenantId).toBeUndefined();
  const after = await request(app).get('/api/roles/OWNER').set('Authorization', auth(admin));
  expect(after.body.permissions.REMOTE_AGENTS.USE).toBe(true);
});
it('keeps a delegated role manager in its tenant and denies mutations of global system roles', async () => {
  await request(app)
    .put('/api/roles/OWNER/remote-agents')
    .set('Authorization', auth(manager))
    .send({ USE: true })
    .expect(403);
  const response = await request(app)
    .put('/api/roles/local-role/remote-agents')
    .set('Authorization', auth(manager))
    .send({ USE: true })
    .expect(200);
  expect(response.body.tenantId).toBe(tenantId);
  expect(response.body.permissions.REMOTE_AGENTS.USE).toBe(true);
});

it('retains authentication, body validation and foreign custom-role isolation', async () => {
  await request(app).put('/api/roles/OWNER/remote-agents').send({ USE: true }).expect(401);
  await request(app)
    .put('/api/roles/OWNER/remote-agents')
    .set('Authorization', auth(admin))
    .send({ USE: 'true' })
    .expect(400);
  await tenantStorage.run({ tenantId: 'other-tenant' }, async () => {
    await db.createRoleByName({ name: 'foreign-role', description: 'Other tenant' });
  });
  const response = await request(app)
    .put('/api/roles/foreign-role/remote-agents')
    .set('Authorization', auth(manager))
    .send({ USE: true });
  expect(response.status).toBe(404);
});
