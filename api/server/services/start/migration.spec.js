const mockCollection = {
  createIndex: jest.fn(),
  dropIndex: jest.fn(),
  indexes: jest.fn(),
  updateMany: jest.fn(),
};

jest.mock('mongoose', () => ({
  connection: {
    db: {
      collection: jest.fn(() => mockCollection),
    },
  },
  models: {},
}));

jest.mock('@librechat/data-schemas', () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  },
  runAsSystem: (fn) => fn(),
}));

jest.mock('@librechat/api', () => ({
  checkAgentPermissionsMigration: jest.fn(),
  checkPromptPermissionsMigration: jest.fn(),
  logAgentMigrationWarning: jest.fn(),
  logPromptMigrationWarning: jest.fn(),
}));

jest.mock('~/models', () => ({
  findRoleByIdentifier: jest.fn(),
}));

jest.mock('~/server/services/Projects/access', () => ({
  ensureTenantProjectAccess: jest.fn(),
}));

const { migrateTrafficDiaryIndexes } = require('./migration');

describe('migrateTrafficDiaryIndexes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCollection.updateMany.mockResolvedValue({ modifiedCount: 2 });
    mockCollection.indexes.mockResolvedValue([
      {
        name: 'legacy_diary_identity',
        key: { projectId: 1, userId: 1, date: 1 },
        unique: true,
      },
    ]);
    mockCollection.dropIndex.mockResolvedValue(undefined);
    mockCollection.createIndex.mockResolvedValue('projectId_1_userId_1_kind_1_date_1');
  });

  it('backfills legacy manager kind and replaces the old unique index', async () => {
    await migrateTrafficDiaryIndexes();

    expect(mockCollection.updateMany).toHaveBeenCalledWith(
      { $or: [{ kind: { $exists: false } }, { kind: null }] },
      { $set: { kind: 'manager' } },
    );
    expect(mockCollection.dropIndex).toHaveBeenCalledWith('legacy_diary_identity');
    expect(mockCollection.createIndex).toHaveBeenCalledWith(
      { projectId: 1, userId: 1, kind: 1, date: 1 },
      { unique: false },
    );
    expect(mockCollection.dropIndex.mock.invocationCallOrder[0]).toBeLessThan(
      mockCollection.createIndex.mock.invocationCallOrder[0],
    );
  });

  it('replaces the unique diary identity index', async () => {
    mockCollection.indexes.mockResolvedValue([
      {
        name: 'diary_identity',
        key: { projectId: 1, userId: 1, kind: 1, date: 1 },
        unique: true,
      },
    ]);

    await migrateTrafficDiaryIndexes();

    expect(mockCollection.dropIndex).toHaveBeenCalledWith('diary_identity');
    expect(mockCollection.createIndex).toHaveBeenCalledWith(
      { projectId: 1, userId: 1, kind: 1, date: 1 },
      { unique: false },
    );
  });

  it('upgrades a real unique index without changing existing entries', async () => {
    const mongoose = jest.requireActual('mongoose');
    const { MongoMemoryServer } = require('mongodb-memory-server');
    const server = await MongoMemoryServer.create();
    const connection = await mongoose.createConnection(server.getUri()).asPromise();
    const collection = connection.db.collection('trafficdiaryentries');
    const row = {
      projectId: 'p1',
      tenantId: 'tenant-a',
      userId: 'u1',
      kind: 'manager',
      date: '2026-09-30',
    };
    try {
      const { insertedId } = await collection.insertOne({ ...row });
      await collection.createIndex({ projectId: 1, userId: 1, kind: 1, date: 1 }, { unique: true });
      require('mongoose').connection.db.collection.mockReturnValueOnce(collection);
      await migrateTrafficDiaryIndexes();
      expect(await collection.findOne({ _id: insertedId })).toEqual({ _id: insertedId, ...row });
      await collection.insertOne({ ...row });
      expect(await collection.countDocuments(row)).toBe(2);
      expect((await collection.indexes()).find((index) => index.key.kind === 1).unique).not.toBe(
        true,
      );
    } finally {
      await connection.close();
      await server.stop();
    }
  });

  it('keeps the non-unique diary index on later startups', async () => {
    mockCollection.indexes.mockResolvedValue([
      { name: 'diary_identity', key: { projectId: 1, userId: 1, kind: 1, date: 1 } },
    ]);
    await migrateTrafficDiaryIndexes();
    expect(mockCollection.dropIndex).not.toHaveBeenCalled();
    expect(mockCollection.createIndex).not.toHaveBeenCalled();
  });
});
