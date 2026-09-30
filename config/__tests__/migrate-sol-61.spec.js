const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');
const { MongoMemoryServer } = require('mongodb-memory-server');

test('Sol migration previews, scopes OpenRouter across tenants, and is idempotent', async () => {
  const server = await MongoMemoryServer.create();
  const client = new MongoClient(server.getUri());
  try {
    await client.connect();
    const database = client.db('Orqest');
    const history = [{ model: 'openai/gpt-6-sol' }];
    await database.collection('agents').insertMany([
      {
        _id: 'a',
        tenantId: 'a',
        provider: 'OpenRouter',
        model: 'openai/gpt-6-sol',
        versions: history,
      },
      {
        _id: 'b',
        tenantId: 'b',
        provider: 'OpenRouter',
        model: 'gpt-5.6-sol',
        model_parameters: { model: 'gpt-6-sol', temperature: 0.5 },
      },
      { _id: 'other', tenantId: 'a', provider: 'openAI', model: 'gpt-6-sol' },
      {
        _id: 'sonnet',
        tenantId: 'b',
        provider: 'OpenRouter',
        model: 'anthropic/claude-sonnet-5.5',
      },
    ]);
    for (const collection of ['conversations', 'presets']) {
      await database.collection(collection).insertMany([
        {
          _id: 'old',
          tenantId: 'a',
          endpoint: 'OpenRouter',
          model: 'openai/gpt-6-sol',
          spec: 'gpt-6-sol',
          projectId: 'project-1',
        },
        { _id: 'other', tenantId: 'b', endpoint: 'openAI', model: 'gpt-6-sol', spec: 'gpt-6-sol' },
      ]);
    }
    const source = fs.readFileSync(path.join(__dirname, '../migrate-sol-61.mongosh.js'), 'utf8');
    const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
    const run = new AsyncFunction('db', 'process', 'printjson', source);
    const output = [];
    const db = { getCollection: (name) => database.collection(name) };
    await run(db, { env: {} }, (result) => output.push(result));
    expect(output[0].matches).toEqual(
      expect.arrayContaining([
        { _id: { tenantId: 'a', model: 'openai/gpt-6-sol' }, count: 1 },
        { _id: { tenantId: 'b', model: 'gpt-5.6-sol' }, count: 1 },
      ]),
    );
    expect((await database.collection('agents').findOne({ _id: 'a' })).model).toBe(
      'openai/gpt-6-sol',
    );

    await run(db, { env: { APPLY_SOL_61: 'true' } }, () => {});
    const agents = database.collection('agents');
    expect(await agents.findOne({ _id: 'a' })).toMatchObject({
      model: 'openai/gpt-6.1-sol',
      versions: history,
    });
    expect(await agents.findOne({ _id: 'b' })).toMatchObject({
      model: 'openai/gpt-6.1-sol',
      model_parameters: { model: 'openai/gpt-6.1-sol', temperature: 0.5 },
    });
    expect((await agents.findOne({ _id: 'other' })).model).toBe('gpt-6-sol');
    expect((await agents.findOne({ _id: 'sonnet' })).model).toBe('anthropic/claude-sonnet-5.5');
    for (const collection of ['conversations', 'presets']) {
      expect(await database.collection(collection).findOne({ _id: 'old' })).toMatchObject({
        model: 'openai/gpt-6.1-sol',
        spec: 'gpt-6.1-sol',
        projectId: 'project-1',
      });
      expect((await database.collection(collection).findOne({ _id: 'other' })).model).toBe(
        'gpt-6-sol',
      );
    }
    output.length = 0;
    await run(db, { env: { APPLY_SOL_61: 'true' } }, (result) => output.push(result));
    expect(
      output
        .filter((result) => 'modifiedCount' in result)
        .every((result) => result.modifiedCount === 0),
    ).toBe(true);
  } finally {
    await client.close();
    await server.stop();
  }
}, 30000);
