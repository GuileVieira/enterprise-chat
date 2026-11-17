import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import {
  createModels,
  createMethods,
  createIntegrationCallMethods,
  tenantStorage,
} from '@librechat/data-schemas';
import type { IntegrationCallMethods } from '@librechat/data-schemas';
import { executeIntegrationWrite } from './calls';
import type { IntegrationToolOutcome } from './calls';

let mongo: MongoMemoryServer;
let first: IntegrationCallMethods;
let second: IntegrationCallMethods;
const scoped = <T>(fn: () => Promise<T>, tenantId = 'tenant-a') =>
  tenantStorage.run({ tenantId }, fn);
const options = (
  store: IntegrationCallMethods,
  execute: (dispatch: () => Promise<void>) => Promise<IntegrationToolOutcome>,
  key = 'key-a',
) => ({
  store,
  tenantId: 'tenant-a',
  principalId: 'owner-a',
  key,
  envelope: { agentId: 'agent-a', arguments: { b: 2, a: 1 } },
  execute,
  inspectResult: async (result: IntegrationToolOutcome) => result,
});
beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  createModels(mongoose);
  await mongoose.models.IntegrationCall.init();
  first = createIntegrationCallMethods(mongoose);
  second = createIntegrationCallMethods(mongoose);
});
afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});
beforeEach(async () => {
  await scoped(() => mongoose.models.IntegrationCall.deleteMany({}));
});
it('two service instances reserve same key once; replay canonical args; different payload conflicts', async () => {
  let effects = 0;
  const execute = async (dispatch: () => Promise<void>): Promise<IntegrationToolOutcome> => {
    await dispatch();
    effects++;
    return { status: 'completed', effect: 'completed', data: { id: 'known' } };
  };
  const results = await scoped(() =>
    Promise.all([
      executeIntegrationWrite(options(first, execute)),
      executeIntegrationWrite(options(second, execute)),
    ]),
  );
  expect(effects).toBe(1);
  expect(results.some((result) => result.replayed)).toBe(true);
  const replay = await scoped(() =>
    executeIntegrationWrite({
      ...options(second, execute),
      envelope: { arguments: { a: 1, b: 2 }, agentId: 'agent-a' },
    }),
  );
  expect(replay).toMatchObject({ status: 'completed', replayed: true, data: { id: 'known' } });
  await expect(
    scoped(() =>
      executeIntegrationWrite({ ...options(first, execute), envelope: { agentId: 'different' } }),
    ),
  ).rejects.toMatchObject({ status: 409 });
  expect(effects).toBe(1);
});
it('dispatch crash and stale lease become ambiguous and never execute again', async () => {
  let effects = 0;
  const execute = async (dispatch: () => Promise<void>): Promise<IntegrationToolOutcome> => {
    await dispatch();
    effects++;
    throw new Error('timeout');
  };
  const result = await scoped(() => executeIntegrationWrite(options(first, execute)));
  expect(result).toMatchObject({ status: 'ambiguous', effect: 'unknown' });
  await scoped(() =>
    mongoose.models.IntegrationCall.updateOne(
      { key: 'key-a' },
      { $set: { state: 'in_progress', leaseUntil: new Date(0), resultJson: undefined } },
    ),
  );
  const replay = await scoped(() => executeIntegrationWrite(options(second, execute)));
  expect(replay.status).toBe('ambiguous');
  expect(effects).toBe(1);
});
it('missing index or wrong tenant fails closed before external dispatch', async () => {
  await mongoose.models.IntegrationCall.collection.dropIndex('integration_idempotency');
  let effects = 0;
  const execute = async (): Promise<IntegrationToolOutcome> => {
    effects++;
    return { status: 'completed', effect: 'completed' };
  };
  await expect(
    scoped(() => executeIntegrationWrite(options(first, execute))),
  ).rejects.toMatchObject({ status: 503 });
  expect(effects).toBe(0);
  await mongoose.models.IntegrationCall.createIndexes();
  await expect(
    scoped(() => executeIntegrationWrite(options(first, execute)), 'tenant-b'),
  ).rejects.toMatchObject({ status: 503 });
});
it('post-effect persistence failure reports ambiguity; permanent key blocks retry', async () => {
  let effects = 0;
  const execute = async (dispatch: () => Promise<void>): Promise<IntegrationToolOutcome> => {
    await dispatch();
    effects++;
    return {
      status: 'completed',
      effect: 'completed',
      knownIds: { created: ['known-after-effect'] },
      data: { id: 'known-after-effect' },
    };
  };
  const failure = jest
    .spyOn(first, 'finishIntegrationCall')
    .mockRejectedValueOnce(new Error('disk unavailable'));
  const result = await scoped(() => executeIntegrationWrite(options(first, execute)));
  expect(result).toMatchObject({
    status: 'ambiguous',
    knownIds: { created: ['known-after-effect'] },
    data: { id: 'known-after-effect' },
    error: { code: 'result_persistence_failed' },
  });
  failure.mockRestore();
  await scoped(() => executeIntegrationWrite(options(second, execute)));
  expect(effects).toBe(1);
});
it('safe partial result replays; expired response keeps tombstone', async () => {
  const execute = async (dispatch: () => Promise<void>): Promise<IntegrationToolOutcome> => {
    await dispatch();
    return {
      status: 'partial',
      effect: 'completed',
      knownIds: { created: ['id-a'] },
      error: { code: 'postprocess', message: 'Partial result' },
    };
  };
  const result = await scoped(() => executeIntegrationWrite(options(first, execute)));
  expect(result.status).toBe('partial');
  await scoped(() =>
    mongoose.models.IntegrationCall.updateOne(
      { key: 'key-a' },
      { $set: { resultAvailableUntil: new Date(0) } },
    ),
  );
  const replay = await scoped(() => executeIntegrationWrite(options(second, execute)));
  expect(replay).toMatchObject({ status: 'partial', replayed: true, resultExpired: true });
  const indexes = await mongoose.models.IntegrationCall.listIndexes();
  expect(indexes.some((index) => index.expireAfterSeconds !== undefined)).toBe(false);
});

it('tenant function config/schema/postprocess changes invalidate previous effect assessment', async () => {
  const methods = createMethods(mongoose);
  await scoped(() =>
    methods.createTenantFunction({
      id: 'assessed',
      name: 'Assessed',
      description: 'Fixture',
      tenantId: 'tenant-a',
      type: 'http',
      isActive: true,
      integrationEffect: 'read',
      config: { baseUrl: 'https://provider.test', path: '/read', method: 'GET' },
      inputSchema: {},
    }),
  );
  for (const update of [
    { config: { baseUrl: 'https://changed.test', path: '/mutate', method: 'POST' as const } },
    { inputSchema: { newField: { type: 'string' } } },
    { postProcess: 'return input;' },
  ]) {
    await scoped(() =>
      methods.updateTenantFunction('tenant-a', 'assessed', { integrationEffect: 'read' }),
    );
    const changed = await scoped(() =>
      methods.updateTenantFunction('tenant-a', 'assessed', update),
    );
    expect(changed?.integrationEffect).toBeUndefined();
  }
  const reassessed = await scoped(() =>
    methods.updateTenantFunction('tenant-a', 'assessed', {
      integrationEffect: 'write',
      config: { baseUrl: 'https://changed.test', path: '/mutate', method: 'POST' },
    }),
  );
  expect(reassessed?.integrationEffect).toBe('write');
});

it('tenant function rejects dotted assessment bypass and empty configured authentication', async () => {
  const methods = createMethods(mongoose);
  await expect(
    scoped(() =>
      methods.updateTenantFunction('tenant-a', 'assessed', { 'config.method': 'POST' } as object),
    ),
  ).rejects.toThrow('Invalid tenant function update field');
  await expect(
    scoped(() =>
      mongoose.models.TenantFunction.create({
        id: 'empty-auth',
        name: 'Empty',
        description: 'Fixture',
        tenantId: 'tenant-a',
        type: 'http',
        isActive: true,
        config: { baseUrl: 'https://provider.test', path: '/', method: 'GET', auth: {} },
        inputSchema: {},
      }),
    ),
  ).rejects.toThrow('secretName');
});
