import express from 'express';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { PermissionBits, PrincipalType, ResourceType } from 'librechat-data-provider';
import { createModels, createMethods, runAsSystem, tenantStorage } from '@librechat/data-schemas';
import type { AllMethods, IUser } from '@librechat/data-schemas';
import { createImageAuthorizationMiddleware } from './authorization';

const cookie = jest.requireActual<{
  parse: (header: string) => Record<string, string | undefined>;
}>('cookie');

let mongo: MongoMemoryServer;
let db: AllMethods;
let owner: IUser;
let viewer: IUser;
let outsider: IUser;
let app: express.Express;
let avatar: string;
let agentId: mongoose.Types.ObjectId;
let token: string;
let outsiderToken: string;
beforeAll(async () => {
  process.env.JWT_REFRESH_SECRET = 'avatar-test-only';
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
  owner = await runAsSystem(() =>
    mongoose.models.User.create({
      email: 'admin@avatar.test',
      provider: 'local',
      role: 'ADMIN',
      tenantId: '__SYSTEM__',
    }),
  );
  viewer = await tenantStorage.run({ tenantId: 'shared-tenant' }, () =>
    mongoose.models.User.create({
      email: 'viewer@avatar.test',
      provider: 'local',
      role: 'USER',
      tenantId: 'shared-tenant',
    }),
  );
  outsider = await tenantStorage.run({ tenantId: 'outside-tenant' }, () =>
    mongoose.models.User.create({
      email: 'outside@avatar.test',
      provider: 'local',
      role: 'USER',
      tenantId: 'outside-tenant',
    }),
  );
  avatar = `/images/${owner._id}/agent-agent_global-avatar-12345.png`;
  const agent = await runAsSystem(() =>
    mongoose.models.Agent.create({
      id: 'agent_global',
      name: 'Shared agent',
      author: owner._id,
      provider: 'openAI',
      model: 'test',
      avatar: { filepath: avatar, source: 'local' },
    }),
  );
  agentId = agent._id;
  token = (await runAsSystem(() => db.createSession(String(viewer._id)))).refreshToken;
  outsiderToken = (await runAsSystem(() => db.createSession(String(outsider._id)))).refreshToken;
  app = express();
  app.use(
    createImageAuthorizationMiddleware(
      { secureImageLinks: true },
      {
        ...db,
        parseCookies: cookie.parse,
        isOpenIdReuseEnabled: () => false,
        getBasePath: () => '',
      },
    ),
  );
  app.get('/images/:owner/:filename', (_req, res) => {
    res
      .type('png')
      .send(
        Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/b9sAAAAASUVORK5CYII=',
          'base64',
        ),
      );
  });
});
it('serves the exact avatar of a global agent shared with the viewer tenant; denies outsiders and revoked access', async () => {
  await runAsSystem(() =>
    db.grantPermission(
      PrincipalType.TENANT,
      'shared-tenant',
      ResourceType.AGENT,
      agentId,
      PermissionBits.VIEW,
      owner._id,
    ),
  );
  const response = await request(app)
    .get(avatar)
    .set('Cookie', `refreshToken=${token}`)
    .expect(200)
    .expect('Content-Type', /image\/png/);
  expect(response.status).toBe(200);
  await request(app).get(avatar).set('Cookie', `refreshToken=${outsiderToken}`).expect(403);
  await request(app).get(avatar).expect(401);
  await request(app)
    .get(avatar.replace('12345', '99999'))
    .set('Cookie', `refreshToken=${token}`)
    .expect(403);
  await runAsSystem(() => mongoose.models.AclEntry.deleteMany({ resourceId: agentId }));
  await request(app).get(avatar).set('Cookie', `refreshToken=${token}`).expect(403);
});
it('never imports role/group or management permissions from the viewer tenant', async () => {
  await runAsSystem(() =>
    db.grantPermission(
      PrincipalType.ROLE,
      'USER',
      ResourceType.AGENT,
      agentId,
      PermissionBits.VIEW,
      owner._id,
    ),
  );
  const response = await request(app)
    .get(avatar)
    .set('Cookie', `refreshToken=${token}`)
    .expect(403);
  expect(response.status).toBe(403);
});
