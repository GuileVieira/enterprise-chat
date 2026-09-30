const express = require('express');
const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

jest.mock('~/server/middleware', () => ({
  requireJwtAuth: (req, _res, next) => {
    req.user = { id: req.headers['x-user'], tenantId: req.headers['x-tenant'], role: 'USER' };
    require('@librechat/data-schemas').tenantStorage.run(
      { tenantId: req.user.tenantId, userId: req.user.id },
      next,
    );
  },
  configMiddleware: (req, _res, next) => {
    req.config = { memory: { tokenLimit: 10000 } };
    next();
  },
}));

let mongo;
let app;
const tenant = 'tenant-acl';

process.env.SHARED_MEMORY_LIBRARY_TENANTS = '*';

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  require('@librechat/data-schemas').createModels(mongoose);
  const router = require('./sharedMemories');
  app = express();
  app.use('/api', router);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  await Promise.all(
    ['AccessRole', 'AclEntry', 'User', 'Project', 'SharedMemory'].map((name) =>
      mongoose.models[name].deleteMany({}),
    ),
  );
  const { AccessRoleIds, PermissionBits, ResourceType } = require('librechat-data-provider');
  await mongoose.models.AccessRole.create([
    {
      accessRoleId: AccessRoleIds.PROJECT_VIEWER,
      name: 'Viewer',
      resourceType: ResourceType.PROJECT,
      permBits: PermissionBits.VIEW,
      tenantId: tenant,
    },
    {
      accessRoleId: AccessRoleIds.PROJECT_EDITOR,
      name: 'Editor',
      resourceType: ResourceType.PROJECT,
      permBits: PermissionBits.VIEW | PermissionBits.EDIT,
      tenantId: tenant,
    },
  ]);
});

const auth = (req, userId, tenantId = tenant) =>
  req.set('x-user', userId).set('x-tenant', tenantId);

it('uses real project grants: viewer denied, editor allowed, foreign tenant denied', async () => {
  const { grantPermission } = require('~/server/services/PermissionService');
  const { AccessRoleIds, PrincipalType, ResourceType } = require('librechat-data-provider');
  const [viewer, editor, foreign] = await mongoose.models.User.create([
    { email: 'viewer@example.com', tenantId: tenant, role: 'USER' },
    { email: 'editor@example.com', tenantId: tenant, role: 'USER' },
    { email: 'foreign@example.com', tenantId: 'tenant-foreign', role: 'USER' },
  ]);
  const project = await mongoose.models.Project.create({
    projectId: 'acl-project',
    name: 'ACL',
    tenantId: tenant,
  });
  const memory = await mongoose.models.SharedMemory.create({
    tenantId: tenant,
    key: 'shared_key',
    value: 'value',
    tokenCount: 5,
  });
  await require('@librechat/data-schemas').tenantStorage.run({ tenantId: tenant }, async () => {
    await grantPermission({
      principalType: PrincipalType.USER,
      principalId: viewer._id,
      resourceType: ResourceType.PROJECT,
      resourceId: project._id,
      accessRoleId: AccessRoleIds.PROJECT_VIEWER,
      grantedBy: viewer._id,
    });
    await grantPermission({
      principalType: PrincipalType.USER,
      principalId: editor._id,
      resourceType: ResourceType.PROJECT,
      resourceId: project._id,
      accessRoleId: AccessRoleIds.PROJECT_EDITOR,
      grantedBy: editor._id,
    });
  });

  expect(
    (
      await auth(
        request(app).post('/api/projects/acl-project/shared-memories'),
        String(viewer._id),
      ).send({ memoryIds: [String(memory._id)] })
    ).status,
  ).toBe(403);
  expect(
    (
      await auth(
        request(app).post('/api/projects/acl-project/shared-memories'),
        String(editor._id),
      ).send({ memoryIds: [String(memory._id)] })
    ).status,
  ).toBe(200);
  expect(
    (
      await auth(
        request(app).post('/api/projects/acl-project/shared-memories'),
        String(foreign._id),
        'tenant-foreign',
      ).send({ memoryIds: [String(memory._id)] })
    ).status,
  ).toBe(403);
});
