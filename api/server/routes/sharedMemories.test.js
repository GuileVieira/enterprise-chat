const express = require('express');
const request = require('supertest');
const mongoose = require('mongoose');
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
beforeEach(async () =>
  Promise.all(
    [
      'SharedMemory',
      'SharedMemoryImportOperation',
      'SharedMemoryLibraryState',
      'MemoryEntry',
      'Project',
      'User',
    ].map((name) => mongoose.models[name].deleteMany({})),
  ),
);

const auth = (req, tenant, user = new mongoose.Types.ObjectId().toString()) =>
  req.set('x-tenant', tenant).set('x-user', user);

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
  expect(library.body.items.map((item) => item.key)).toEqual(['library_key']);
  expect(personal.body.items.map((item) => item.key)).toEqual(['personal_key']);
  expect(project.body.items.map((item) => item.key)).toEqual(['project_key']);
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
