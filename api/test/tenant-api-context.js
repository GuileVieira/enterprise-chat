/* Run from repository root: node api/test/tenant-api-context.js */
process.env.NODE_ENV = 'test';
process.env.SEARCH = 'false';
process.env.MEILI_HOST = '';
process.env.MEILI_MASTER_KEY = '';
const assert = require('node:assert/strict');
const path = require('node:path');
require('module-alias').addAlias('~', path.resolve(__dirname, '..'));
const express = require('express');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { createModels, tenantStorage } = require('@librechat/data-schemas');
const { PermissionBits, PrincipalType, ResourceType } = require('librechat-data-provider');
const { createRequireApiKeyAuth, createTenantApiHandlers } = require('@librechat/api');
const { getEffectivePermissions } = require('~/server/services/PermissionService');
const { loadProjectContext } = require('~/server/services/Projects/context');
const db = require('~/models');

async function main() {
  const mongo = await MongoMemoryServer.create();
  let server;
  try {
    await mongoose.connect(mongo.getUri());
    createModels(mongoose);
    let secret;
    let projectId;
    await tenantStorage.run({ tenantId: 'context-test' }, async () => {
      const user = await mongoose.models.User.create({
        email: 'context@test.local',
        role: 'OWNER',
      });
      const project = await mongoose.models.Project.create({
        projectId: 'context-project',
        name: 'Context test',
        user: String(user._id),
        instructions: 'instructions-canary',
        memories: [{ key: 'embedded', value: 'memory-canary' }],
        memoryKeys: ['referenced'],
        fileIds: ['linked-file'],
      });
      projectId = project.projectId;
      await db.grantPermission(
        PrincipalType.USER,
        user._id,
        ResourceType.PROJECT,
        project._id,
        PermissionBits.VIEW,
        user._id,
      );
      await db.createMemory({
        userId: String(user._id),
        key: 'referenced',
        value: 'referenced-canary',
        tokenCount: 1,
      });
      for (const file_id of ['linked-file', 'project-file']) {
        await mongoose.models.File.create({
          user: user._id,
          file_id,
          ...(file_id === 'project-file' ? { projectId } : {}),
          bytes: 1,
          filename: 'test.txt',
          filepath: '/test.txt',
          object: 'file',
          type: 'text/plain',
          usage: 0,
        });
      }
      secret = (
        await db.createAgentApiKey({
          userId: user._id,
          name: 'Context test',
          tenantId: 'context-test',
          scope: 'tenant',
        })
      ).key;
    });
    const handlers = createTenantApiHandlers({ ...db, getEffectivePermissions });
    const app = express();
    app.use(express.json(), createRequireApiKeyAuth(db));
    app.post('/context', handlers.requireProjectAccess, async (req, res, next) => {
      try {
        res.json(await loadProjectContext({ req, projectId: req.body.projectId }));
      } catch (error) {
        next(error);
      }
    });
    server = app.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    const endpoint = `http://127.0.0.1:${server.address().port}/context`;
    const call = (id) =>
      fetch(endpoint, {
        method: 'POST',
        headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: id }),
      });
    const response = await call(projectId);
    assert.equal(response.status, 200);
    const context = await response.json();
    assert.equal(context.projectInstructions, 'instructions-canary');
    assert.match(context.projectMemories, /memory-canary/);
    assert.match(context.projectMemories, /referenced-canary/);
    assert.deepEqual(context.projectFileIds.sort(), ['linked-file', 'project-file']);
    assert.equal((await call('foreign-project')).status, 404);
    await tenantStorage.run({ tenantId: 'context-test' }, async () => {
      await mongoose.models.AclEntry.deleteMany({ resourceType: ResourceType.PROJECT });
    });
    assert.equal((await call(projectId)).status, 403);
    console.log(
      'Tenant key + real project loader: instructions, both memory sources, linked/project files and ACL passed.',
    );
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    await mongoose.disconnect();
    await mongo.stop();
  }
}

main().then(
  () => process.exit(0),
  (error) => {
    console.error(error);
    process.exit(1);
  },
);
