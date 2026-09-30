import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import type { ISharedMemory } from '~/types';
import { createModels } from '~/models';
import { runAsSystem } from '~/config/tenantContext';

let server: MongoMemoryServer;
let SharedMemory: mongoose.Model<ISharedMemory>;

beforeAll(async () => {
  server = await MongoMemoryServer.create();
  createModels(mongoose);
  SharedMemory = mongoose.models.SharedMemory as mongoose.Model<ISharedMemory>;
  await mongoose.connect(server.getUri());
  await SharedMemory.syncIndexes();
});

afterAll(async () => {
  await mongoose.disconnect();
  await server.stop();
});

beforeEach(async () => {
  await runAsSystem(() =>
    Promise.all([SharedMemory.deleteMany({}), mongoose.models.User.deleteMany({})]),
  );
});

describe('SharedMemory durability', () => {
  it('isolates active keys by tenant and generates destination IDs', async () => {
    const [source, destination] = await runAsSystem(() =>
      Promise.all([
        SharedMemory.create({ tenantId: 'tenant-a', key: 'tone', value: 'direct', tokenCount: 1 }),
        SharedMemory.create({ tenantId: 'tenant-b', key: 'tone', value: 'direct', tokenCount: 1 }),
      ]),
    );
    expect(String(destination._id)).not.toBe(String(source._id));
    await expect(
      runAsSystem(() =>
        SharedMemory.create({ tenantId: 'tenant-a', key: 'tone', value: 'other', tokenCount: 1 }),
      ),
    ).rejects.toMatchObject({ code: 11000 });
  });

  it('returns one creation after a response is lost before retry', async () => {
    const operation = { tenantId: 'tenant-a', importOperationId: 'op-1', importRef: 'm1' };
    const create = () =>
      runAsSystem(() =>
        SharedMemory.findOneAndUpdate(
          operation,
          { $setOnInsert: { ...operation, key: 'tone', value: 'direct', tokenCount: 1 } },
          { upsert: true, new: true },
        ),
      );
    const first = await create(); // Simulates committed write followed by lost HTTP response.
    const retry = await create();
    expect(String(retry?._id)).toBe(String(first?._id));
    expect(await runAsSystem(() => SharedMemory.countDocuments(operation))).toBe(1);
  });

  it('survives author deletion', async () => {
    const author = await runAsSystem(() =>
      mongoose.models.User.create({ email: 'author@example.com', tenantId: 'tenant-a' }),
    );
    const memory = await runAsSystem(() =>
      SharedMemory.create({
        tenantId: 'tenant-a',
        key: 'tone',
        value: 'direct',
        tokenCount: 1,
        authorId: author._id,
      }),
    );
    await runAsSystem(() => mongoose.models.User.deleteOne({ _id: author._id }));
    expect(
      await runAsSystem(() => SharedMemory.exists({ _id: memory._id, tenantId: 'tenant-a' })),
    ).toBeTruthy();
  });
});
