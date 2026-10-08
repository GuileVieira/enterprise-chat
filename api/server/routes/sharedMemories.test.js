const express = require('express');
const request = require('supertest');
const mongoose = require('mongoose');
const path = require('node:path');
const { promisify } = require('node:util');
const { execFile } = require('node:child_process');
const { MongoMemoryServer } = require('mongodb-memory-server');

jest.mock('@librechat/api', () => ({
  ...jest.requireActual('@librechat/api'),
  Tokenizer: { getTokenCount: (value) => value.length },
}));

jest.mock('~/server/middleware', () => ({
  requireJwtAuth: (req, _res, next) => {
    req.user = {
      id: req.headers['x-user'] || '111111111111111111111111',
      tenantId: req.headers['x-tenant'],
      role: 'OWNER',
    };
    require('@librechat/data-schemas').tenantStorage.run(
      { tenantId: req.user.tenantId, userId: req.user.id },
      next,
    );
  },
  configMiddleware: (req, _res, next) => {
    req.config = { memory: { tokenLimit: Number(req.headers['x-limit']) || 10000 } };
    if (req.headers['x-memory-policy'] === 'private')
      req.config.filters = {
        memories: {
          pii: {
            fields: ['value'],
            starterPatterns: [],
            customPatterns: [{ id: 'private', label: 'private value', regex: 'PRIVATE-[A-Z]+' }],
          },
        },
      };
    next();
  },
}));
jest.mock('~/models', () => ({
  getRoleByName: jest.fn(async () => ({
    permissions: {
      SHARED_MEMORIES: { READ: true, CREATE: true, UPDATE: true },
      MEMORIES: { USE: true, READ: true, CREATE: true },
    },
  })),
  getAgent: jest.fn(),
}));
jest.mock('~/server/middleware/roles/capabilities', () => ({
  hasCapability: jest.fn(async () => true),
}));
jest.mock('~/server/services/PermissionService', () => ({
  checkPermission: jest.fn(async ({ userId }) => userId !== '000000000000000000000000'),
  grantPermission: jest.fn(async () => ({})),
}));
jest.mock('~/server/services/Projects/access', () => ({
  findProjectForRequest: jest.fn(async ({ projectId, user }) =>
    require('mongoose').models.Project.findOne({ projectId, tenantId: user.tenantId }).lean(),
  ),
}));

let mongo;
let app;

process.env.SHARED_MEMORY_LIBRARY_TENANTS = '*';

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  require('@librechat/data-schemas').createModels(mongoose);
  await Promise.all(
    [
      'SharedMemory',
      'SharedMemoryImportOperation',
      'SharedMemoryLibraryState',
      'MemoryEntry',
      'Project',
    ].map((name) => mongoose.models[name].syncIndexes()),
  );
  const router = require('./sharedMemories');
  app = express();
  app.use('/api', router);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});
beforeEach(async () => {
  require('~/models')
    .getRoleByName.mockReset()
    .mockResolvedValue({
      permissions: {
        SHARED_MEMORIES: { READ: true, CREATE: true, UPDATE: true },
        MEMORIES: { USE: true, READ: true, CREATE: true },
      },
    });
  require('~/server/services/PermissionService')
    .checkPermission.mockReset()
    .mockImplementation(async ({ userId }) => userId !== '000000000000000000000000');
  await Promise.all(
    [
      'SharedMemory',
      'SharedMemoryImportOperation',
      'SharedMemoryLibraryState',
      'MemoryEntry',
      'Project',
      'User',
    ].map((name) => mongoose.models[name].deleteMany({})),
  );
});

const auth = (req, tenant, user = new mongoose.Types.ObjectId().toString()) =>
  req.set('x-tenant', tenant).set('x-user', user);

it('fails closed for authenticated requests without tenant context', async () => {
  const response = await request(app)
    .post('/api/shared-memories')
    .send({ key: 'tone', value: 'value' });
  expect(response.status).toBe(403);
  expect(response.body.error).toBe('Tenant context is required for shared memories.');
  expect(await mongoose.models.SharedMemory.countDocuments({})).toBe(0);
});

it.each([
  { format: ['json'] },
  { destination: { type: ['library'] } },
  { decisions: { m1: { action: ['replace'], expectedVersion: 1 } } },
])('rejects array values where import enum strings are required: %j', async (override) => {
  const response = await auth(request(app).post('/api/shared-memories/import'), 'tenant-a').send({
    operationId: 'invalid-enum',
    destination: { type: 'library' },
    format: 'json',
    content: JSON.stringify({
      format: 'orqest-memories',
      version: 1,
      items: [{ ref: 'm1', key: 'tone', value: 'safe' }],
    }),
    ...override,
  });
  expect(response.status).toBe(400);
  expect(await mongoose.models.SharedMemoryImportOperation.countDocuments({})).toBe(0);
});

it('preserves a concurrent local edit while publishing its earlier snapshot', async () => {
  const project = await mongoose.models.Project.create({
    projectId: 'publish-race',
    name: 'Publish race',
    tenantId: 'tenant-a',
    memories: [{ key: 'tone', value: 'original' }],
  });
  const create = mongoose.models.SharedMemory.create.bind(mongoose.models.SharedMemory);
  const spy = jest
    .spyOn(mongoose.models.SharedMemory, 'create')
    .mockImplementationOnce(async (...args) => {
      const doc = await create(...args);
      await mongoose.models.Project.updateOne(
        { _id: project._id },
        { $set: { 'memories.0.value': 'concurrent edit' } },
      );
      return doc;
    });
  try {
    const published = await auth(
      request(app).post('/api/shared-memories/publish'),
      'tenant-a',
    ).send({
      source: { type: 'project', projectId: project.projectId, key: 'tone' },
      replaceWithLink: true,
    });
    expect(published.status).toBe(201);
    expect(published.body.sourceReplaced).toBe(false);
    expect(published.body.memory.value).toBe('original');
    const after = await mongoose.models.Project.findById(project._id).lean();
    expect(after.memories[0].value).toBe('concurrent edit');
    expect(after.sharedMemoryIds).toEqual([]);
  } finally {
    spy.mockRestore();
  }
});

it('does not reveal stored content blocked by a new policy through import conflict previews', async () => {
  await mongoose.models.SharedMemory.create({
    tenantId: 'tenant-a',
    key: 'tone',
    value: 'PRIVATE-STORED',
    tokenCount: 14,
  });
  const preview = await auth(request(app).post('/api/shared-memories/import/preview'), 'tenant-a')
    .set('x-memory-policy', 'private')
    .send({
      destination: { type: 'library' },
      format: 'json',
      content: JSON.stringify({
        format: 'orqest-memories',
        version: 1,
        items: [{ ref: 'm1', key: 'tone', value: 'safe new value' }],
      }),
    });
  expect(preview.status).toBe(200);
  expect(preview.body.items[0]).toMatchObject({
    status: 'invalid',
    error: 'Existing memory is blocked by memory policy.',
  });
  expect(preview.body.items[0].existing).toBeUndefined();
  expect(JSON.stringify(preview.body)).not.toContain('PRIVATE-STORED');
});

it.each(['keep-local', 'use-shared'])(
  'requires explicit choice for legacy references before linking: %s',
  async (conflictResolution) => {
    const memory = await mongoose.models.SharedMemory.create({
      tenantId: 'tenant-a',
      key: 'tone',
      value: 'shared',
      tokenCount: 6,
    });
    await mongoose.models.Project.create({
      projectId: 'legacy-link',
      name: 'Legacy link',
      tenantId: 'tenant-a',
      memoryKeys: ['tone', 'untouched'],
    });
    const memoryIds = [String(memory._id)];
    const preview = await auth(
      request(app).post('/api/projects/legacy-link/shared-memories'),
      'tenant-a',
    ).send({ memoryIds });
    expect(preview.status).toBe(409);
    const result = await auth(
      request(app).post('/api/projects/legacy-link/shared-memories'),
      'tenant-a',
    ).send({ memoryIds, conflictResolution, expectedUpdatedAt: preview.body.expectedUpdatedAt });
    expect(result.status).toBe(200);
    const project = await mongoose.models.Project.findOne({ projectId: 'legacy-link' }).lean();
    expect(project.memoryKeys).toEqual(
      conflictResolution === 'keep-local' ? ['tone', 'untouched'] : ['untouched'],
    );
    expect(project.sharedMemoryIds).toEqual(conflictResolution === 'keep-local' ? [] : memoryIds);
  },
);

it('returns controlled update failures for quota, duplicate keys and oversized values', async () => {
  const memory = await mongoose.models.SharedMemory.create({
    tenantId: 'tenant-a',
    key: 'tone',
    value: '12345',
    tokenCount: 5,
  });
  await mongoose.models.SharedMemory.create({
    tenantId: 'tenant-a',
    key: 'other',
    value: 'x',
    tokenCount: 1,
  });
  const update = (key, value, limit) =>
    auth(request(app).patch(`/api/shared-memories/${memory._id}`), 'tenant-a')
      .set('x-limit', String(limit))
      .send({ key, value, expectedUpdatedAt: memory.updatedAt.toISOString() });
  const quota = await update('tone', '123456', 6);
  expect(quota.status).toBe(400);
  expect(quota.body.error).toContain('token limit');
  const duplicate = await update('other', '12345', 10000);
  expect(duplicate.status).toBe(409);
  expect(duplicate.body.error).toBe('Active key already exists.');
  expect((await update('tone', 'x'.repeat(10001), 100000)).status).toBe(400);
  expect((await mongoose.models.SharedMemory.findById(memory._id).lean()).value).toBe('12345');
});

it('does not charge an active restore twice and charges archived edits only when restored', async () => {
  const memory = await mongoose.models.SharedMemory.create({
    tenantId: 'tenant-a',
    key: 'tone',
    value: '12345',
    tokenCount: 5,
  });
  const restored = await auth(
    request(app).post(`/api/shared-memories/${memory._id}/restore`),
    'tenant-a',
  )
    .set('x-limit', '5')
    .send({ expectedUpdatedAt: memory.updatedAt.toISOString() });
  expect(restored.status).toBe(200);
  const archived = await auth(
    request(app).post(`/api/shared-memories/${memory._id}/archive`),
    'tenant-a',
  ).send({ expectedUpdatedAt: restored.body.updatedAt });
  expect(archived.status).toBe(200);
  const edited = await auth(request(app).patch(`/api/shared-memories/${memory._id}`), 'tenant-a')
    .set('x-limit', '5')
    .send({ key: 'tone', value: '12345678', expectedUpdatedAt: archived.body.updatedAt });
  expect(edited.status).toBe(200);
  const oversizedRestore = await auth(
    request(app).post(`/api/shared-memories/${memory._id}/restore`),
    'tenant-a',
  )
    .set('x-limit', '5')
    .send({ expectedUpdatedAt: edited.body.updatedAt });
  expect(oversizedRestore.status).toBe(400);
  expect((await mongoose.models.SharedMemory.findById(memory._id).lean()).status).toBe('archived');
});

it('rejects an import preview after a regular project memory save increments its version', async () => {
  const user = new mongoose.Types.ObjectId().toString();
  const project = await mongoose.models.Project.create({
    projectId: 'regular-save',
    name: 'Regular save',
    tenantId: 'tenant-a',
    memories: [{ key: 'tone', value: 'original' }],
  });
  const payload = {
    destination: { type: 'project', projectId: project.projectId },
    format: 'json',
    content: JSON.stringify({
      format: 'orqest-memories',
      version: 1,
      items: [{ ref: 'm1', key: 'tone', value: 'imported' }],
    }),
  };
  const preview = await auth(
    request(app).post('/api/shared-memories/import/preview'),
    'tenant-a',
    user,
  ).send(payload);
  expect(preview.status).toBe(200);
  const { createMethods, tenantStorage } = require('@librechat/data-schemas');
  await tenantStorage.run({ tenantId: 'tenant-a' }, () =>
    createMethods(mongoose).updateProject(project.projectId, {
      memories: [{ key: 'tone', value: 'new local edit' }],
    }),
  );
  const imported = await auth(
    request(app).post('/api/shared-memories/import'),
    'tenant-a',
    user,
  ).send({
    ...payload,
    operationId: 'stale-after-regular-save',
    decisions: {
      m1: { action: 'replace', expectedVersion: preview.body.items[0].existing.version },
    },
  });
  expect(imported.body.items[0]).toMatchObject({
    status: 'failed',
    error: 'Memory changed since preview.',
  });
  expect((await mongoose.models.Project.findById(project._id).lean()).memories[0].value).toBe(
    'new local edit',
  );
});

it.each(['keep-local', 'use-shared'])(
  'resolves local link conflicts only by explicit choice: %s',
  async (conflictResolution) => {
    const memories = await mongoose.models.SharedMemory.create([
      { tenantId: 'tenant-a', key: 'tone', value: 'shared', tokenCount: 6 },
      { tenantId: 'tenant-a', key: 'other', value: 'other', tokenCount: 5 },
    ]);
    await mongoose.models.Project.create({
      projectId: 'conflict-project',
      tenantId: 'tenant-a',
      name: 'Conflict',
      memories: [{ key: 'tone', value: 'local' }],
    });
    const memoryIds = memories.map((memory) => String(memory._id));
    const preview = await auth(
      request(app).post('/api/projects/conflict-project/shared-memories'),
      'tenant-a',
    ).send({ memoryIds });
    expect(preview.status).toBe(409);
    expect(preview.body.conflicts).toEqual([{ memoryId: memoryIds[0], key: 'tone' }]);
    const resolved = await auth(
      request(app).post('/api/projects/conflict-project/shared-memories'),
      'tenant-a',
    ).send({ memoryIds, conflictResolution, expectedUpdatedAt: preview.body.expectedUpdatedAt });
    expect(resolved.status).toBe(200);
    const project = await mongoose.models.Project.findOne({ projectId: 'conflict-project' }).lean();
    expect(project.memories.map((memory) => memory.value)).toEqual(
      conflictResolution === 'keep-local' ? ['local'] : [],
    );
    expect(project.sharedMemoryIds).toEqual(
      conflictResolution === 'keep-local' ? [memoryIds[1]] : memoryIds,
    );
  },
);

it('rejects conflict resolution after the project changes and retains edited local content', async () => {
  const memory = await mongoose.models.SharedMemory.create({
    tenantId: 'tenant-a',
    key: 'tone',
    value: 'shared',
    tokenCount: 6,
  });
  const project = await mongoose.models.Project.create({
    projectId: 'concurrent-project',
    tenantId: 'tenant-a',
    name: 'Concurrent',
    memories: [{ key: 'tone', value: 'local' }],
  });
  const memoryIds = [String(memory._id)];
  const preview = await auth(
    request(app).post('/api/projects/concurrent-project/shared-memories'),
    'tenant-a',
  ).send({ memoryIds });
  await mongoose.models.Project.updateOne(
    { _id: project._id },
    {
      $set: {
        'memories.0.value': 'concurrent edit',
        updatedAt: new Date(Date.parse(preview.body.expectedUpdatedAt) + 1000),
      },
    },
    { timestamps: false },
  );
  const resolved = await auth(
    request(app).post('/api/projects/concurrent-project/shared-memories'),
    'tenant-a',
  ).send({
    memoryIds,
    conflictResolution: 'use-shared',
    expectedUpdatedAt: preview.body.expectedUpdatedAt,
  });
  expect(resolved.status).toBe(409);
  const after = await mongoose.models.Project.findById(project._id).lean();
  expect(after.memories[0].value).toBe('concurrent edit');
  expect(after.sharedMemoryIds).toEqual([]);
});

it('refuses known IDs from another tenant and hides project linkage without ACL', async () => {
  const created = await auth(request(app).post('/api/shared-memories'), 'tenant-a').send({
    key: 'tone',
    value: 'direct',
  });
  expect(created.status).toBe(201);
  expect((await auth(request(app).get('/api/shared-memories'), 'tenant-b')).body.items).toEqual([]);
  expect(
    (
      await auth(request(app).patch(`/api/shared-memories/${created.body.id}`), 'tenant-b').send({
        key: 'tone',
        value: 'stolen',
        expectedUpdatedAt: created.body.updatedAt,
      })
    ).status,
  ).toBe(409);
  await mongoose.models.Project.create({
    projectId: 'secret',
    name: 'Secret',
    tenantId: 'tenant-a',
    sharedMemoryIds: [created.body.id],
  });
  expect(
    (
      await auth(
        request(app).get('/api/shared-memories?projectId=secret'),
        'tenant-a',
        '000000000000000000000000',
      )
    ).status,
  ).toBe(403);
  expect(require('~/server/services/PermissionService').checkPermission).toHaveBeenCalledWith(
    expect.objectContaining({
      userId: '000000000000000000000000',
      resourceType: require('librechat-data-provider').ResourceType.PROJECT,
      requiredPermission: require('librechat-data-provider').PermissionBits.VIEW,
    }),
  );
});

it('imports across tenants with a new ID and retries a lost response once', async () => {
  const user = new mongoose.Types.ObjectId().toString();
  const source = await auth(request(app).post('/api/shared-memories'), 'tenant-a').send({
    key: 'tone',
    value: 'direct',
  });
  const content = JSON.stringify({
    format: 'orqest-memories',
    version: 1,
    items: [{ ref: 'm1', key: 'tone', value: 'direct' }],
  });
  const payload = {
    operationId: 'op-1',
    destination: { type: 'library' },
    format: 'json',
    content,
  };
  const first = await auth(request(app).post('/api/shared-memories/import'), 'tenant-b', user).send(
    payload,
  );
  const retry = await auth(request(app).post('/api/shared-memories/import'), 'tenant-b', user).send(
    payload,
  );
  expect(first.status).toBe(200);
  expect(first.body.items[0].memoryId).not.toBe(source.body.id);
  expect(retry.body).toEqual(first.body);
  expect(await mongoose.models.SharedMemory.countDocuments({ tenantId: 'tenant-b' })).toBe(1);
});

it('binds operation IDs to actor and exact payload', async () => {
  const user = new mongoose.Types.ObjectId().toString();
  const base = { operationId: 'op-1', destination: { type: 'library' }, format: 'json' };
  const content = (value) =>
    JSON.stringify({
      format: 'orqest-memories',
      version: 1,
      items: [{ ref: 'm1', key: 'tone', value }],
    });
  expect(
    (
      await auth(request(app).post('/api/shared-memories/import'), 'tenant-a', user).send({
        ...base,
        content: content('one'),
      })
    ).status,
  ).toBe(200);
  expect(
    (
      await auth(request(app).post('/api/shared-memories/import'), 'tenant-a', user).send({
        ...base,
        content: content('two'),
      })
    ).status,
  ).toBe(409);
  expect(
    (
      await auth(
        request(app).post('/api/shared-memories/import'),
        'tenant-a',
        new mongoose.Types.ObjectId().toString(),
      ).send({ ...base, content: content('one') })
    ).status,
  ).toBe(409);
});

it('recovers after item creation commits but operation result persistence fails', async () => {
  const user = new mongoose.Types.ObjectId().toString();
  const payload = {
    operationId: 'lost-result',
    destination: { type: 'library' },
    format: 'json',
    content: JSON.stringify({
      format: 'orqest-memories',
      version: 1,
      items: [{ ref: 'm1', key: 'tone', value: 'direct' }],
    }),
  };
  const original = mongoose.models.SharedMemoryImportOperation.updateOne.bind(
    mongoose.models.SharedMemoryImportOperation,
  );
  const spy = jest
    .spyOn(mongoose.models.SharedMemoryImportOperation, 'updateOne')
    .mockRejectedValueOnce(new Error('lost response'));
  expect(
    (await auth(request(app).post('/api/shared-memories/import'), 'tenant-a', user).send(payload))
      .status,
  ).toBe(400);
  spy.mockImplementation(original);
  const retry = await auth(request(app).post('/api/shared-memories/import'), 'tenant-a', user).send(
    payload,
  );
  expect(retry.status).toBe(200);
  expect(await mongoose.models.SharedMemory.countDocuments({ tenantId: 'tenant-a' })).toBe(1);
  spy.mockRestore();
});

it('enforces tenant library quota and imports idempotently to personal and project destinations', async () => {
  expect(
    (
      await auth(request(app).post('/api/shared-memories'), 'tenant-a')
        .set('x-limit', '5')
        .send({ key: 'tone', value: '123456' })
    ).status,
  ).toBe(400);
  const user = new mongoose.Types.ObjectId().toString();
  await mongoose.models.User.create({
    _id: user,
    email: 'importer@example.com',
    tenantId: 'tenant-a',
  });
  const content = JSON.stringify({
    format: 'orqest-memories',
    version: 1,
    items: [{ ref: 'm1', key: 'tone', value: 'direct' }],
  });
  const personal = {
    operationId: 'personal-op',
    destination: { type: 'personal' },
    format: 'json',
    content,
  };
  expect(
    (await auth(request(app).post('/api/shared-memories/import'), 'tenant-a', user).send(personal))
      .status,
  ).toBe(200);
  expect(
    (await auth(request(app).post('/api/shared-memories/import'), 'tenant-a', user).send(personal))
      .status,
  ).toBe(200);
  expect(
    await mongoose.models.MemoryEntry.countDocuments({ tenantId: 'tenant-a', userId: user }),
  ).toBe(1);
  await mongoose.models.Project.create({
    projectId: 'p1',
    name: 'Project',
    tenantId: 'tenant-a',
    memories: [],
  });
  const project = {
    operationId: 'project-op',
    destination: { type: 'project', projectId: 'p1' },
    format: 'json',
    content,
  };
  expect(
    (await auth(request(app).post('/api/shared-memories/import'), 'tenant-a', user).send(project))
      .status,
  ).toBe(200);
  expect(
    (await auth(request(app).post('/api/shared-memories/import'), 'tenant-a', user).send(project))
      .status,
  ).toBe(200);
  expect((await mongoose.models.Project.findOne({ projectId: 'p1' }).lean()).memories).toHaveLength(
    1,
  );
  await mongoose.models.Project.create({
    projectId: 'p2',
    name: 'Limited',
    tenantId: 'tenant-a',
    memories: [],
  });
  const limitedProject = await auth(
    request(app).post('/api/shared-memories/import'),
    'tenant-a',
    user,
  )
    .set('x-limit', '5')
    .send({
      ...project,
      operationId: 'project-quota',
      destination: { type: 'project', projectId: 'p2' },
    });
  expect(limitedProject.body.totals.failed).toBe(1);
  expect((await mongoose.models.Project.findOne({ projectId: 'p2' }).lean()).memories).toHaveLength(
    0,
  );
  const limitedPersonal = await auth(
    request(app).post('/api/shared-memories/import'),
    'tenant-a',
    user,
  )
    .set('x-limit', '5')
    .send({
      ...personal,
      operationId: 'personal-quota',
      content: JSON.stringify({
        format: 'orqest-memories',
        version: 1,
        items: [{ ref: 'm2', key: 'quota_key', value: '123456' }],
      }),
    });
  expect(limitedPersonal.body.totals.failed).toBe(1);
});

it.each(['personal', 'project'])(
  'recovers %s import after write commits before result persistence',
  async (type) => {
    const user = new mongoose.Types.ObjectId().toString();
    await mongoose.models.User.create({
      _id: user,
      email: `${type}@example.com`,
      tenantId: 'tenant-a',
    });
    if (type === 'project')
      await mongoose.models.Project.create({
        projectId: 'retry-project',
        name: 'Retry',
        tenantId: 'tenant-a',
        memories: [],
      });
    const destination = type === 'project' ? { type, projectId: 'retry-project' } : { type };
    const payload = {
      operationId: `lost-${type}`,
      destination,
      format: 'json',
      content: JSON.stringify({
        format: 'orqest-memories',
        version: 1,
        items: [{ ref: 'm1', key: 'retry_key', value: 'value' }],
      }),
    };
    const original = mongoose.models.SharedMemoryImportOperation.updateOne.bind(
      mongoose.models.SharedMemoryImportOperation,
    );
    const spy = jest
      .spyOn(mongoose.models.SharedMemoryImportOperation, 'updateOne')
      .mockRejectedValueOnce(new Error('lost response'));
    expect(
      (await auth(request(app).post('/api/shared-memories/import'), 'tenant-a', user).send(payload))
        .status,
    ).toBe(400);
    spy.mockImplementation(original);
    expect(
      (await auth(request(app).post('/api/shared-memories/import'), 'tenant-a', user).send(payload))
        .status,
    ).toBe(200);
    if (type === 'personal')
      expect(
        await mongoose.models.MemoryEntry.countDocuments({
          tenantId: 'tenant-a',
          userId: user,
          key: 'retry_key',
        }),
      ).toBe(1);
    else
      expect(
        (await mongoose.models.Project.findOne({ projectId: 'retry-project' }).lean()).memories,
      ).toHaveLength(1);
    spy.mockRestore();
  },
);

it('requires optimistic version for archive and restore', async () => {
  const created = await auth(request(app).post('/api/shared-memories'), 'tenant-a').send({
    key: 'tone',
    value: 'direct',
  });
  expect(
    (
      await auth(
        request(app).post(`/api/shared-memories/${created.body.id}/archive`),
        'tenant-a',
      ).send({})
    ).status,
  ).toBe(400);
  const archived = await auth(
    request(app).post(`/api/shared-memories/${created.body.id}/archive`),
    'tenant-a',
  ).send({ expectedUpdatedAt: created.body.updatedAt });
  expect(archived.status).toBe(200);
  expect(
    (
      await auth(
        request(app).post(`/api/shared-memories/${created.body.id}/restore`),
        'tenant-a',
      ).send({ expectedUpdatedAt: created.body.updatedAt })
    ).status,
  ).toBe(409);
});

it('retries only failed import refs while preserving prior successes', async () => {
  const user = new mongoose.Types.ObjectId().toString();
  const content = JSON.stringify({
    format: 'orqest-memories',
    version: 1,
    items: [
      { ref: 'm1', key: 'first', value: 'one' },
      { ref: 'm2', key: 'second', value: 'two' },
    ],
  });
  const payload = {
    operationId: 'partial-retry',
    destination: { type: 'library' },
    format: 'json',
    content,
  };
  const original = mongoose.models.SharedMemory.findOneAndUpdate.bind(mongoose.models.SharedMemory);
  let failed = false;
  const spy = jest
    .spyOn(mongoose.models.SharedMemory, 'findOneAndUpdate')
    .mockImplementation((filter, update, options) => {
      if (!failed && update?.$setOnInsert?.key === 'second') {
        failed = true;
        throw new Error('transient write failure');
      }
      return original(filter, update, options);
    });
  const first = await auth(request(app).post('/api/shared-memories/import'), 'tenant-a', user).send(
    payload,
  );
  expect(first.body.totals).toEqual({ created: 1, updated: 0, skipped: 0, failed: 1 });
  const retry = await auth(request(app).post('/api/shared-memories/import'), 'tenant-a', user).send(
    { ...payload, selectedRefs: ['m2'] },
  );
  expect(retry.body.totals).toEqual({ created: 2, updated: 0, skipped: 0, failed: 0 });
  expect(await mongoose.models.SharedMemory.countDocuments({ tenantId: 'tenant-a' })).toBe(2);
  spy.mockRestore();
});

it('replaces a legacy project memory whose version field is absent', async () => {
  const user = new mongoose.Types.ObjectId().toString();
  const project = await mongoose.models.Project.create({
    projectId: 'legacy-project',
    name: 'Legacy',
    tenantId: 'tenant-a',
    memories: [{ key: 'tone', value: 'old' }],
  });
  await mongoose.models.Project.updateOne(
    { _id: project._id },
    { $unset: { 'memories.0.version': 1 } },
  );
  const content = JSON.stringify({
    format: 'orqest-memories',
    version: 1,
    items: [{ ref: 'm1', key: 'tone', value: 'new' }],
  });
  const preview = await auth(
    request(app).post('/api/shared-memories/import/preview'),
    'tenant-a',
    user,
  ).send({
    destination: { type: 'project', projectId: 'legacy-project' },
    format: 'json',
    content,
  });
  expect(preview.body.items[0].existing.version).toBe(1);
  const result = await auth(
    request(app).post('/api/shared-memories/import'),
    'tenant-a',
    user,
  ).send({
    operationId: 'legacy-replace',
    destination: { type: 'project', projectId: 'legacy-project' },
    format: 'json',
    content,
    decisions: { m1: { action: 'replace', expectedVersion: 1 } },
  });
  expect(result.body.items[0].status).toBe('updated');
  expect(
    (await mongoose.models.Project.findOne({ projectId: 'legacy-project' }).lean()).memories[0]
      .value,
  ).toBe('new');
});

it('exports library, project and personal scopes with filters', async () => {
  const user = new mongoose.Types.ObjectId().toString();
  await mongoose.models.User.create({
    _id: user,
    email: 'exporter@example.com',
    tenantId: 'tenant-a',
  });
  const shared = await mongoose.models.SharedMemory.create({
    tenantId: 'tenant-a',
    key: 'library_key',
    value: 'needle shared',
    tokenCount: 13,
    authorId: user,
  });
  await mongoose.models.MemoryEntry.create({
    tenantId: 'tenant-a',
    userId: user,
    agentId: null,
    key: 'personal_key',
    value: 'needle personal',
    tokenCount: 15,
  });
  await mongoose.models.Project.create({
    projectId: 'export-project',
    name: 'Export',
    tenantId: 'tenant-a',
    memories: [{ key: 'project_key', value: 'needle project' }],
  });
  const library = await auth(
    request(app).get(`/api/shared-memories/export?scope=library&ids=${shared._id}&search=needle`),
    'tenant-a',
    user,
  );
  const personal = await auth(
    request(app).get('/api/shared-memories/export?scope=personal&search=needle'),
    'tenant-a',
    user,
  );
  const project = await auth(
    request(app).get(
      '/api/shared-memories/export?scope=project&projectId=export-project&ids=project_key&search=needle',
    ),
    'tenant-a',
    user,
  );
  expect(library.body).toHaveProperty('items');
  expect(library.body.items.map((item) => item.key)).toEqual(['library_key']);
  expect(personal.body.items.map((item) => item.key)).toEqual(['personal_key']);
  expect(project.body.items.map((item) => item.key)).toEqual(['project_key']);
});

it('requires library UPDATE permission when an import replaces existing content', async () => {
  const memory = await mongoose.models.SharedMemory.create({
    tenantId: 'tenant-a',
    key: 'tone',
    value: 'original',
    tokenCount: 8,
  });
  require('~/models')
    .getRoleByName.mockResolvedValueOnce({
      permissions: { SHARED_MEMORIES: { READ: true, CREATE: true, UPDATE: false } },
    })
    .mockResolvedValueOnce({
      permissions: { SHARED_MEMORIES: { READ: true, CREATE: true, UPDATE: false } },
    })
    .mockResolvedValueOnce({
      permissions: { SHARED_MEMORIES: { READ: true, CREATE: true, UPDATE: false } },
    });
  const response = await auth(request(app).post('/api/shared-memories/import'), 'tenant-a').send({
    operationId: 'cannot-replace',
    destination: { type: 'library' },
    format: 'json',
    content: JSON.stringify({
      format: 'orqest-memories',
      version: 1,
      items: [{ ref: 'm1', key: 'tone', value: 'replacement' }],
    }),
    decisions: { m1: { action: 'replace', expectedVersion: memory.version } },
  });
  expect(response.status).toBe(403);
  expect(response.body.error).toBe('Library update permission required.');
  expect((await mongoose.models.SharedMemory.findById(memory._id)).value).toBe('original');
});

it('enforces project quota when copying library memories', async () => {
  const memory = await mongoose.models.SharedMemory.create({
    tenantId: 'tenant-a',
    key: 'tone',
    value: 'replacement',
    tokenCount: 11,
  });
  await mongoose.models.Project.create({
    projectId: 'copy-project',
    name: 'Copy',
    tenantId: 'tenant-a',
    memories: [{ key: 'existing', value: '12345' }],
  });
  const copied = await auth(
    request(app).post(`/api/shared-memories/${memory._id}/copy`),
    'tenant-a',
  )
    .set('x-limit', '10')
    .send({ projectId: 'copy-project' });
  expect(copied.status).toBe(400);
  expect(
    (await mongoose.models.Project.findOne({ projectId: 'copy-project' })).memories,
  ).toHaveLength(1);
});

it('reports visible consumers without disclosing private project names or counts', async () => {
  const memory = await mongoose.models.SharedMemory.create({
    tenantId: 'tenant-a',
    key: 'tone',
    value: 'value',
    tokenCount: 5,
  });
  const projects = await mongoose.models.Project.create([
    {
      projectId: 'visible-project',
      name: 'Visible',
      tenantId: 'tenant-a',
      sharedMemoryIds: [String(memory._id)],
    },
    {
      projectId: 'private-one',
      name: 'Secret one',
      tenantId: 'tenant-a',
      sharedMemoryIds: [String(memory._id)],
    },
    {
      projectId: 'private-two',
      name: 'Secret two',
      tenantId: 'tenant-a',
      sharedMemoryIds: [String(memory._id)],
    },
  ]);
  const permission = require('~/server/services/PermissionService').checkPermission;
  const visible = projects.find((project) => project.projectId === 'visible-project');
  permission.mockImplementation(
    async ({ resourceId }) => String(resourceId) === String(visible._id),
  );
  const response = await auth(
    request(app).get(`/api/shared-memories/${memory._id}/consumers`),
    'tenant-a',
  );
  expect(response.status).toBe(200);
  expect(response.body).toEqual({
    total: 1,
    visible: [{ projectId: 'visible-project', name: 'Visible' }],
    hasOtherConsumers: true,
  });
  expect(JSON.stringify(response.body)).not.toContain('Secret');
});

it('exports all filtered memories beyond the library page size', async () => {
  await mongoose.models.SharedMemory.create(
    Array.from({ length: 75 }, (_, index) => ({
      tenantId: 'tenant-a',
      key: `tone_${String.fromCharCode(97 + Math.floor(index / 26), 97 + (index % 26))}`,
      value: index < 73 ? 'needle' : 'other',
      tokenCount: 1,
    })),
  );
  const listed = await auth(request(app).get('/api/shared-memories?search=needle'), 'tenant-a');
  expect(listed.body.items).toHaveLength(50);
  expect(listed.body.total).toBe(73);
  const exported = await auth(
    request(app).get('/api/shared-memories/export?scope=library&search=needle'),
    'tenant-a',
  );
  expect(exported.status).toBe(200);
  expect(exported.body.items).toHaveLength(73);
});

it.each(['ids[$ne]=x', 'search[$ne]=x', 'format=xml', 'status=unknown'])(
  'rejects malformed export filters: %s',
  async (query) => {
    const response = await auth(
      request(app).get(`/api/shared-memories/export?scope=project&projectId=p1&${query}`),
      'tenant-a',
    );
    expect(response.status).toBe(400);
  },
);

it('round-trips an exported tenant package into another tenant with new local identities', async () => {
  const actorA = new mongoose.Types.ObjectId().toString();
  const actorB = new mongoose.Types.ObjectId().toString();
  const first = await auth(request(app).post('/api/shared-memories'), 'tenant-a', actorA).send({
    key: 'tone',
    value: 'Olá, "time"\nLinha dois',
  });
  const second = await auth(request(app).post('/api/shared-memories'), 'tenant-a', actorA).send({
    key: 'formula',
    value: '=SUM(A1:A2)',
  });
  expect(first.status).toBe(201);
  expect(second.status).toBe(201);
  const exported = await auth(
    request(app).get('/api/shared-memories/export?scope=library'),
    'tenant-a',
    actorA,
  );
  expect(exported.status).toBe(200);
  expect(JSON.stringify(exported.body)).not.toContain(first.body.id);
  expect(JSON.stringify(exported.body)).not.toContain('tenant-a');
  const payload = {
    operationId: 'round-trip',
    destination: { type: 'library' },
    format: 'json',
    content: JSON.stringify(exported.body),
  };
  const preview = await auth(
    request(app).post('/api/shared-memories/import/preview'),
    'tenant-b',
    actorB,
  ).send(payload);
  expect(preview.body.totals).toEqual({ new: 2, identical: 0, conflict: 0, invalid: 0 });
  const imported = await auth(
    request(app).post('/api/shared-memories/import'),
    'tenant-b',
    actorB,
  ).send(payload);
  expect(imported.status).toBe(200);
  expect(imported.body.totals.created).toBe(2);
  const destination = await mongoose.models.SharedMemory.find({ tenantId: 'tenant-b' }).lean();
  expect(destination).toHaveLength(2);
  for (const memory of destination) {
    expect(String(memory.authorId)).toBe(actorB);
    expect([first.body.id, second.body.id]).not.toContain(String(memory._id));
  }
  const reexported = await auth(
    request(app).get('/api/shared-memories/export?scope=library'),
    'tenant-b',
    actorB,
  );
  expect(reexported.body).toEqual(exported.body);
  const retry = await auth(
    request(app).post('/api/shared-memories/import'),
    'tenant-b',
    actorB,
  ).send(payload);
  expect(retry.body).toEqual(imported.body);
  expect(await mongoose.models.SharedMemory.countDocuments({ tenantId: 'tenant-b' })).toBe(2);
});

it('runs inventory without creating collections or indexes in a fresh database', async () => {
  const inventoryDatabase = mongoose.connection.useDb('inventory_read_only');
  const { stdout } = await promisify(execFile)(
    process.execPath,
    [path.resolve(__dirname, '../../../config/shared-memory-inventory.js'), '--tenant=tenant-a'],
    { env: { ...process.env, MONGO_URI: mongo.getUri('inventory_read_only') } },
  );
  expect(JSON.parse(stdout)).toMatchObject({
    dryRun: true,
    counts: { personal: 0, shared: 0, projects: 0 },
  });
  expect(await inventoryDatabase.db.listCollections().toArray()).toEqual([]);
});

it('inventories partitions, orphans and ambiguous references without exposing memory values', async () => {
  const owner = await mongoose.models.User.create({
    email: 'inventory@test.local',
    tenantId: 'tenant-a',
  });
  const absent = new mongoose.Types.ObjectId();
  await mongoose.models.MemoryEntry.create([
    {
      userId: owner._id,
      tenantId: 'tenant-a',
      key: 'tone',
      value: 'SECRET-INVENTORY-ONE',
      tokenCount: 1,
    },
    {
      userId: owner._id,
      tenantId: 'tenant-a',
      agentId: 'agent-a',
      key: 'tone',
      value: 'SECRET-INVENTORY-TWO',
      tokenCount: 1,
    },
    {
      userId: absent,
      tenantId: 'tenant-a',
      key: 'orphan',
      value: 'SECRET-INVENTORY-THREE',
      tokenCount: 1,
    },
  ]);
  const shared = await mongoose.models.SharedMemory.create({
    tenantId: 'tenant-a',
    key: 'shared',
    value: 'SECRET-INVENTORY-SHARED',
    tokenCount: 1,
    status: 'archived',
  });
  await mongoose.models.Project.create({
    projectId: 'inventory-project',
    name: 'Inventory',
    tenantId: 'tenant-a',
    user: String(absent),
    memories: [{ key: 'local', value: 'SECRET-INVENTORY-LOCAL' }],
    memoryKeys: ['tone', 'missing'],
    sharedMemoryIds: [String(shared._id), String(new mongoose.Types.ObjectId())],
  });
  const { stdout } = await promisify(execFile)(
    process.execPath,
    [path.resolve(__dirname, '../../../config/shared-memory-inventory.js'), '--tenant=tenant-a'],
    { env: { ...process.env, MONGO_URI: mongo.getUri(mongoose.connection.name) } },
  );
  const report = JSON.parse(stdout);
  expect(report.counts).toMatchObject({
    personal: 3,
    orphanedPersonal: 1,
    projectsWithoutOwner: 1,
    localProjectMemories: 1,
    legacyReferences: 2,
  });
  expect(report.partitions).toEqual(
    expect.arrayContaining([
      { agentId: null, count: 2 },
      { agentId: 'agent-a', count: 1 },
    ]),
  );
  expect(report.projects[0]).toMatchObject({
    ownerExists: false,
    missingSharedLinks: 1,
    archivedSharedLinks: 1,
    legacy: [
      { key: 'tone', candidates: 2, status: 'ambiguous' },
      { key: 'missing', candidates: 0, status: 'missing' },
    ],
  });
  expect(stdout).not.toContain('SECRET-INVENTORY');
  expect(await mongoose.models.MemoryEntry.countDocuments({ tenantId: 'tenant-a' })).toBe(3);
});

it('rejects object injection at import, project and ID boundaries', async () => {
  const content = JSON.stringify({
    format: 'orqest-memories',
    version: 1,
    items: [{ ref: 'm1', key: 'tone', value: 'one' }],
  });
  expect(
    (
      await auth(request(app).post('/api/shared-memories/import'), 'tenant-a').send({
        operationId: { $ne: null },
        destination: { type: 'library' },
        format: 'json',
        content,
      })
    ).status,
  ).toBe(400);
  expect(
    (
      await auth(request(app).post('/api/shared-memories/import/preview'), 'tenant-a').send({
        destination: { type: 'project', projectId: { $ne: null } },
        format: 'json',
        content,
      })
    ).status,
  ).toBe(400);
  expect(
    (
      await auth(request(app).post('/api/projects/p1/shared-memories'), 'tenant-a').send({
        memoryIds: [{ $ne: null }],
      })
    ).status,
  ).toBe(400);
});

it('resolves only an owned legacy memory and retries idempotently', async () => {
  const user = new mongoose.Types.ObjectId().toString();
  const source = await mongoose.models.MemoryEntry.create({
    tenantId: 'tenant-a',
    userId: user,
    agentId: null,
    key: 'legacy_key',
    value: 'owned value',
    tokenCount: 11,
  });
  await mongoose.models.Project.create({
    projectId: 'legacy-resolution',
    name: 'Legacy',
    tenantId: 'tenant-a',
    memoryKeys: ['legacy_key'],
  });
  const payload = { resolutions: [{ key: 'legacy_key', memoryId: String(source._id) }] };
  const first = await auth(
    request(app).post('/api/projects/legacy-resolution/shared-memories/legacy-resolutions'),
    'tenant-a',
    user,
  ).send(payload);
  const retry = await auth(
    request(app).post('/api/projects/legacy-resolution/shared-memories/legacy-resolutions'),
    'tenant-a',
    user,
  ).send(payload);
  expect(first.status).toBe(200);
  expect(retry.body).toEqual(first.body);
  expect(
    await mongoose.models.SharedMemory.countDocuments({ tenantId: 'tenant-a', key: 'legacy_key' }),
  ).toBe(1);
  const project = await mongoose.models.Project.findOne({ projectId: 'legacy-resolution' }).lean();
  expect(project.memoryKeys).toEqual([]);
  expect(project.sharedMemoryIds).toEqual(first.body.memoryIds);
});

it('reports archived, missing and token-limited project context links', async () => {
  const user = new mongoose.Types.ObjectId().toString();
  const active = await mongoose.models.SharedMemory.create({
    tenantId: 'tenant-a',
    key: 'active_key',
    value: '123456',
    tokenCount: 6,
    authorId: user,
  });
  const archived = await mongoose.models.SharedMemory.create({
    tenantId: 'tenant-a',
    key: 'old_key',
    value: 'old',
    tokenCount: 3,
    authorId: user,
    status: 'archived',
  });
  const missing = new mongoose.Types.ObjectId().toString();
  await mongoose.models.Project.create({
    projectId: 'context-status',
    name: 'Context',
    tenantId: 'tenant-a',
    sharedMemoryIds: [String(active._id), String(archived._id), missing],
  });
  const result = await auth(
    request(app).get('/api/projects/context-status/shared-memories/context-status'),
    'tenant-a',
    user,
  ).set('x-limit', '5');
  expect(result.body).toEqual({
    linked: 3,
    available: 0,
    archived: 1,
    missing: 1,
    filtered: 0,
    omittedByLimit: 1,
  });
});

it('defaults writes off while preserving reads and supports explicit wildcard enablement', async () => {
  const previous = process.env.SHARED_MEMORY_LIBRARY_TENANTS;
  process.env.SHARED_MEMORY_LIBRARY_TENANTS = '';
  expect(
    (
      await auth(request(app).post('/api/shared-memories'), 'tenant-a').send({
        key: 'disabled_key',
        value: 'value',
      })
    ).status,
  ).toBe(404);
  expect((await auth(request(app).get('/api/shared-memories'), 'tenant-a')).status).toBe(200);
  process.env.SHARED_MEMORY_LIBRARY_TENANTS = previous;
  expect(
    (
      await auth(request(app).post('/api/shared-memories'), 'tenant-a').send({
        key: 'enabled_key',
        value: 'value',
      })
    ).status,
  ).toBe(201);
});
