import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createModels } from '~/models';
import { tenantStorage } from '~/config/tenantContext';
import { createMemoryMethods } from './memory';

let server: MongoMemoryServer;
let userId: string;
const memory = createMemoryMethods(mongoose);
beforeAll(async () => {
  server = await MongoMemoryServer.create();
  await mongoose.connect(server.getUri());
  createModels(mongoose);
});
beforeEach(async () => {
  userId = (await mongoose.models.User.create({ email: 'memory@test.dev' })).id;
});
afterEach(async () => {
  await mongoose.models.MemoryEntry.deleteMany({});
  await mongoose.models.User.deleteMany({});
});
afterAll(async () => {
  await mongoose.disconnect();
  await server?.stop();
});
const save = (key: string, tokenCount: number) =>
  memory.setMemory({ userId, key, value: 'Memory value', tokenCount, tokenLimit: 10 });

it('enforces total quota on creates and edits, permitting reductions at the limit', async () => {
  await save('first', 6);
  await save('second', 4);
  await expect(save('first', 7)).rejects.toMatchObject({ code: 'MEMORY_LIMIT' });
  await save('first', 3);
  await save('third', 3);
  expect(
    (await memory.getAllUserMemories(userId)).reduce((sum, m) => sum + (m.tokenCount || 0), 0),
  ).toBe(10);
});

it('serializes independent concurrent writers in standalone MongoDB', async () => {
  const otherWorker = createMemoryMethods(mongoose);
  const results = await Promise.allSettled([
    save('first', 6),
    otherWorker.createMemory({
      userId,
      key: 'second',
      value: 'Value',
      tokenCount: 6,
      tokenLimit: 10,
    }),
  ]);
  expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
  expect(
    (await memory.getAllUserMemories(userId)).reduce((sum, m) => sum + (m.tokenCount || 0), 0),
  ).toBe(6);
  expect(
    (await mongoose.models.User.findById(userId).select('+memoryWriteLock')).memoryWriteLock,
  ).toBeUndefined();
});

it('renames the same document atomically and rejects stale versions and duplicate keys', async () => {
  await save('first', 4);
  await save('second', 2);
  const original = (await memory.getAllUserMemories(userId)).find((m) => m.key === 'first')!;
  await expect(
    memory.updateMemory({ userId, originalKey: 'first', key: 'second', value: 'Value' }),
  ).rejects.toMatchObject({ code: 'MEMORY_DUPLICATE' });
  await memory.updateMemory({
    userId,
    originalKey: 'first',
    key: 'renamed',
    value: 'Value',
    tokenCount: 4,
    tokenLimit: 10,
    expectedUpdatedAt: original.updated_at!.toISOString(),
  });
  const renamed = (await memory.getAllUserMemories(userId)).find((m) => m.key === 'renamed')!;
  expect(renamed._id.toString()).toBe(original._id.toString());
  expect(await memory.getAllUserMemories(userId)).toHaveLength(2);
  await expect(
    memory.updateMemory({
      userId,
      originalKey: 'renamed',
      key: 'renamed',
      value: 'Stale',
      expectedUpdatedAt: original.updated_at!.toISOString(),
    }),
  ).rejects.toMatchObject({ code: 'MEMORY_CONFLICT' });
  expect((await memory.getAllUserMemories(userId)).find((m) => m.key === 'renamed')?.value).toBe(
    'Value',
  );
});

it('rejects over-budget renames without changing either key', async () => {
  await save('first', 6);
  await save('second', 4);
  await expect(
    memory.updateMemory({
      userId,
      originalKey: 'first',
      key: 'renamed',
      value: 'Value',
      tokenCount: 8,
      tokenLimit: 10,
    }),
  ).rejects.toMatchObject({ code: 'MEMORY_LIMIT' });
  expect((await memory.getAllUserMemories(userId)).map((m) => m.key).sort()).toEqual([
    'first',
    'second',
  ]);
});

it('does not mutate a user outside the tenant context', async () => {
  await tenantStorage.run({ tenantId: 'other-tenant' }, async () => {
    await expect(save('first', 1)).rejects.toMatchObject({ code: 'MEMORY_BUSY' });
  });
  expect(await memory.getAllUserMemories(userId)).toHaveLength(0);
});
