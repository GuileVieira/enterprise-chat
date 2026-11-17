import http from 'node:http';
import mongoose from 'mongoose';
import { Validator } from '@cfworker/json-schema';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createMethods, createModels, tenantStorage } from '@librechat/data-schemas';
import { AuthTypeEnum, AuthorizationTypeEnum, actionDelimiter } from 'librechat-data-provider';
import type { IAgent, AllMethods } from '@librechat/data-schemas';
import type { AddressInfo } from 'node:net';
import type { IntegrationRequest } from './contracts';
import {
  actionInputSchema,
  discoverIntegrationActionAdapters,
  resolveActionIntegrationEffects,
} from './actions';

let mongo: MongoMemoryServer;
let server: http.Server;
let db: AllMethods;
let origin: string;
let received: Array<{ authorization?: string; path: string; body: string }>;
const tenant = 'actions-a';
const inTenant = <T>(work: () => T) => tenantStorage.run({ tenantId: tenant }, work);
beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  createModels(mongoose);
  db = createMethods(mongoose);
  server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
    });
    req.on('end', () => {
      received.push({ authorization: req.headers.authorization, path: req.url ?? '', body });
      if (req.url?.startsWith('/drop')) {
        req.socket.destroy();
        return;
      }
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ accepted: true }));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await mongoose.disconnect();
  await mongo.stop();
});
beforeEach(async () => {
  received = [];
  await mongoose.connection.dropDatabase();
});
function spec(path = '/read', method = 'get') {
  return JSON.stringify({
    openapi: '3.0.3',
    info: { title: 'Test', version: '1.0' },
    servers: [{ url: origin }],
    paths: {
      [path]: {
        [method]: {
          operationId: 'operation',
          parameters: [
            {
              name: 'count',
              in: 'query',
              required: true,
              schema: { type: 'integer', minimum: 1, maximum: 3 },
            },
          ],
          responses: { 200: { description: 'Success' } },
        },
      },
    },
  });
}
async function discover(
  options: {
    effect?: 'read' | 'write';
    auth?: boolean;
    oauth?: boolean;
    path?: string;
    tokenExpires?: number;
    rawSpec?: string;
    authHeader?: string;
  } = {},
) {
  const actor = new mongoose.Types.ObjectId();
  const name = `operation${actionDelimiter}local`;
  const agent = { id: 'agent', tools: [name] } as IAgent;
  let authType = AuthTypeEnum.None;
  if (options.oauth) authType = AuthTypeEnum.OAuth;
  else if (options.auth) authType = AuthTypeEnum.ServiceHttp;
  await inTenant(() =>
    mongoose.models.Action.create({
      action_id: 'action',
      agent_id: agent.id,
      user: actor,
      tenantId: tenant,
      metadata: {
        domain: origin,
        raw_spec:
          options.rawSpec ?? spec(options.path, options.effect === 'write' ? 'post' : 'get'),
        ...(options.effect ? { integrationEffects: { operation: options.effect } } : {}),
        auth: {
          type: authType,
          authorization_type: options.authHeader
            ? AuthorizationTypeEnum.Custom
            : AuthorizationTypeEnum.Bearer,
          ...(options.authHeader ? { custom_auth_header: options.authHeader } : {}),
          ...(options.oauth
            ? {
                authorization_url: `${origin}/authorize`,
                client_url: `${origin}/token`,
                scope: 'read',
                token_exchange_method: 'default_post',
              }
            : {}),
        },
        ...(options.auth ? { api_key: 'server-secret' } : {}),
        ...(options.oauth
          ? { oauth_client_id: 'client', oauth_client_secret: 'client-secret' }
          : {}),
      },
    }),
  );
  if (options.tokenExpires !== undefined)
    await inTenant(() =>
      db.createToken({
        userId: actor,
        type: 'oauth',
        identifier: `${actor}:action`,
        token: 'oauth-secret',
        expiresIn: options.tokenExpires!,
      }),
    );
  const req = {
    user: { id: String(actor), tenantId: tenant },
    config: {
      actions: { allowedAddresses: [`127.0.0.1:${(server.address() as AddressInfo).port}`] },
    },
  } as unknown as IntegrationRequest;
  return inTenant(() =>
    discoverIntegrationActionAdapters({
      req,
      agent,
      prepareActionSnapshotForTools: async () => {
        const actions = await db.getActions({ agentId: agent.id }, true);
        return { storedActions: actions, actionSets: actions };
      },
      domainParser: async () => 'local',
      legacyDomainEncode: () => 'legacy',
      loadOAuthToken: async (userId, actionId) => {
        const saved = await db.findToken({
          userId,
          type: 'oauth',
          identifier: `${userId}:${actionId}`,
        });
        return saved ? { token: saved.token, expiresAt: saved.expiresAt } : null;
      },
    }),
  );
}
it('discovers without HTTP/OAuth; executes assessed action with server credential, validation, before-dispatch and bounded transport', async () => {
  const [tool] = await discover({ effect: 'read', auth: true });
  expect(received).toHaveLength(0);
  expect(tool.callable).toBe(true);
  expect(() => tool.validate!({ count: 0 })).toThrow('Invalid request');
  expect(() => tool.validate!({ count: 1, extra: true })).toThrow('Invalid request');
  let dispatches = 0;
  const outcome = await tool.execute!(tool.validate!({ count: 2 }), {
    beforeDispatch: async () => {
      dispatches++;
    },
    signal: new AbortController().signal,
  });
  expect(outcome).toMatchObject({ status: 'completed', data: { accepted: true } });
  expect(dispatches).toBe(1);
  expect(received).toEqual([
    { authorization: 'Bearer server-secret', path: '/read?count=2', body: '' },
  ]);
  expect(JSON.stringify({ ...tool, execute: undefined, validate: undefined })).not.toContain(
    'server-secret',
  );
});
it('blocks unassessed operations and missing OAuth; reports writes with lost upstream response as ambiguous', async () => {
  const [unassessed] = await discover();
  expect(unassessed).toMatchObject({ callable: false, reason: 'effect_unclassified' });
  await mongoose.connection.dropDatabase();
  const [oauth] = await discover({ effect: 'read', oauth: true });
  expect(oauth).toMatchObject({ callable: false, reason: 'credentials_unavailable' });
  expect(received).toHaveLength(0);
  await mongoose.connection.dropDatabase();
  const [write] = await discover({ effect: 'write', path: '/drop' });
  const outcome = await write.execute!(
    { count: 1 },
    { beforeDispatch: async () => {}, signal: new AbortController().signal },
  );
  expect(outcome).toMatchObject({
    status: 'ambiguous',
    effect: 'unknown',
    error: { code: 'action_upstream_error' },
  });
  expect(received).toHaveLength(1);
});
it('uses only cached unexpired OAuth; expired cached token never starts login or provider request', async () => {
  const [active] = await discover({ effect: 'read', oauth: true, tokenExpires: 60 });
  expect(active.callable).toBe(true);
  expect(received).toHaveLength(0);
  await active.execute!(
    { count: 1 },
    { beforeDispatch: async () => {}, signal: new AbortController().signal },
  );
  expect(received[0].authorization).toBe('Bearer oauth-secret');
  await mongoose.connection.dropDatabase();
  received = [];
  const [expired] = await discover({ effect: 'read', oauth: true, tokenExpires: -60 });
  expect(expired).toMatchObject({ callable: false, reason: 'credentials_unavailable' });
  expect(received).toHaveLength(0);
});
it('validates full declared JSON Schema constraints, nullable and local refs without exposing unrelated components', () => {
  const schema = actionInputSchema(
    {
      type: 'object',
      properties: {
        choice: {
          oneOf: [
            { type: 'integer', minimum: 2 },
            { type: 'string', enum: ['yes'] },
          ],
        },
        optional: { type: 'string', nullable: true, default: 'ok' },
        nested: { $ref: '#/components/schemas/Nested' },
      },
      required: ['choice', 'nested'],
    },
    {
      Nested: {
        type: 'object',
        properties: { email: { type: 'string', format: 'email' } },
        required: ['email'],
        additionalProperties: false,
      },
      Secret: { const: 'do-not-export' },
    },
  );
  const validator = new Validator(schema);
  expect(
    validator.validate({ choice: 'yes', optional: null, nested: { email: 'a@example.com' } }).valid,
  ).toBe(true);
  expect(validator.validate({ choice: 1, nested: { email: 'not-email' } }).valid).toBe(false);
  expect(
    validator.validate({ choice: 'yes', nested: { email: 'a@example.com', extra: true } }).valid,
  ).toBe(false);
  expect(JSON.stringify(schema)).not.toContain('do-not-export');
  expect(() => actionInputSchema({ $ref: 'https://foreign/schema' })).toThrow();
});
it('validates original Action request-body root constraints before any HTTP dispatch', async () => {
  const rawSpec = JSON.stringify({
    openapi: '3.0.3',
    info: { title: 'Body', version: '1.0' },
    servers: [{ url: origin }],
    paths: {
      '/write': {
        post: {
          operationId: 'operation',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { count: { type: 'integer' } },
                  required: ['count'],
                  minProperties: 1,
                  additionalProperties: false,
                  oneOf: [
                    { properties: { count: { enum: [1] } } },
                    { properties: { count: { enum: [3] } } },
                  ],
                },
              },
            },
          },
          responses: { 200: { description: 'Success' } },
        },
      },
    },
  });
  const [adapter] = await discover({ effect: 'write', rawSpec });
  expect(adapter.callable).toBe(true);
  expect(() => adapter.validate!({ count: 2 })).toThrow('Invalid request');
  expect(() => adapter.validate!({ count: 1, extra: true })).toThrow('Invalid request');
  expect(received).toHaveLength(0);
  const result = await adapter.execute!(adapter.validate!({ count: 3 }), {
    signal: new AbortController().signal,
    beforeDispatch: async () => {},
  });
  expect(result.status).toBe('completed');
  expect(JSON.parse(received[0].body)).toEqual({ count: 3 });
});
it('faithfully serializes body-only oneOf and rejects unsupported array bodies before dispatch', async () => {
  const document = {
    openapi: '3.0.3',
    info: { title: 'Body', version: '1.0' },
    servers: [{ url: origin }],
    paths: {
      '/write': {
        post: {
          operationId: 'operation',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  oneOf: [
                    {
                      type: 'object',
                      properties: { count: { type: 'integer', enum: [1] } },
                      required: ['count'],
                      additionalProperties: false,
                    },
                    {
                      type: 'object',
                      properties: { count: { type: 'integer', enum: [3] } },
                      required: ['count'],
                      additionalProperties: false,
                    },
                  ],
                },
              },
            },
          },
          responses: { 200: { description: 'Success' } },
        },
      },
    },
  };
  const [adapter] = await discover({ effect: 'write', rawSpec: JSON.stringify(document) });
  expect(adapter.callable).toBe(true);
  expect(() => adapter.validate!({ count: 2 })).toThrow('Invalid request');
  await adapter.execute!(adapter.validate!({ count: 3 }), {
    signal: new AbortController().signal,
    beforeDispatch: async () => {},
  });
  expect(JSON.parse(received[0].body)).toEqual({ count: 3 });
  await mongoose.connection.dropDatabase();
  received = [];
  const mapDocument = {
    ...document,
    paths: {
      '/write': {
        post: {
          ...document.paths['/write'].post,
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  additionalProperties: { type: 'integer' },
                  minProperties: 1,
                },
              },
            },
          },
        },
      },
    },
  };
  const [mapAdapter] = await discover({ effect: 'write', rawSpec: JSON.stringify(mapDocument) });
  expect(mapAdapter.callable).toBe(true);
  expect(() => mapAdapter.validate!({ count: 'invalid' })).toThrow('Invalid request');
  await mapAdapter.execute!(mapAdapter.validate!({ count: 7 }), {
    signal: new AbortController().signal,
    beforeDispatch: async () => {},
  });
  expect(JSON.parse(received[0].body)).toEqual({ count: 7 });
  await mongoose.connection.dropDatabase();
  received = [];
  const arrayDocument = {
    ...document,
    paths: {
      '/write': {
        post: {
          ...document.paths['/write'].post,
          requestBody: {
            required: true,
            content: {
              'application/json': { schema: { type: 'array', items: { type: 'integer' } } },
            },
          },
        },
      },
    },
  };
  const [arrayAdapter] = await discover({
    effect: 'write',
    rawSpec: JSON.stringify(arrayDocument),
  });
  expect(arrayAdapter).toMatchObject({ callable: false, reason: 'unsupported_schema' });
  expect(received).toHaveLength(0);
});
it('rejects declared case-insensitive auth-header overrides before barrier or HTTP, including custom server headers', async () => {
  for (const header of ['aUtHoRiZaTiOn', 'x-SeRvEr-KeY']) {
    await mongoose.connection.dropDatabase();
    received = [];
    const rawSpec = JSON.stringify({
      openapi: '3.0.3',
      info: { title: 'Auth', version: '1.0' },
      servers: [{ url: origin }],
      paths: {
        '/read': {
          get: {
            operationId: 'operation',
            parameters: [{ name: header, in: 'header', schema: { type: 'string' } }],
            responses: { 200: { description: 'Success' } },
          },
        },
      },
    });
    const [adapter] = await discover({
      effect: 'read',
      auth: true,
      rawSpec,
      ...(header.startsWith('x') ? { authHeader: 'X-Server-Key' } : {}),
    });
    expect(adapter).toMatchObject({ callable: false, reason: 'credential_header_conflict' });
    expect(() => adapter.validate!({ [header]: 'attacker-value' })).toThrow('Invalid request');
    expect(received).toHaveLength(0);
  }
});
it('blocks flattened parameter/body and duplicate-location name collisions before HTTP', async () => {
  for (const bodyOverlap of [true, false]) {
    await mongoose.connection.dropDatabase();
    received = [];
    const rawSpec = JSON.stringify({
      openapi: '3.0.3',
      info: { title: 'Collision', version: '1.0' },
      servers: [{ url: origin }],
      paths: {
        '/write': {
          post: {
            operationId: 'operation',
            parameters: [
              { name: 'id', in: 'query', schema: { type: 'string' } },
              ...(!bodyOverlap ? [{ name: 'id', in: 'header', schema: { type: 'integer' } }] : []),
            ],
            ...(bodyOverlap
              ? {
                  requestBody: {
                    content: {
                      'application/json': {
                        schema: { type: 'object', properties: { id: { type: 'integer' } } },
                      },
                    },
                  },
                }
              : {}),
            responses: { 200: { description: 'Success' } },
          },
        },
      },
    });
    const [adapter] = await discover({ effect: 'write', rawSpec });
    expect(adapter).toMatchObject({ callable: false, reason: 'unsupported_schema' });
    expect(received).toHaveLength(0);
  }
});
it('only operators assess effects; changing executable spec/config invalidates assessment unless explicitly reassessed', () => {
  const stored = {
    domain: origin,
    raw_spec: 'old',
    integrationEffects: { operation: 'read' as const },
  };
  expect(() =>
    resolveActionIntegrationEffects({
      role: 'USER',
      incoming: { integrationEffects: { operation: 'read' } },
    }),
  ).toThrow('Only administrators');
  expect(() =>
    resolveActionIntegrationEffects({
      role: 'OWNER',
      incoming: { integrationEffects: { operation: 'delete' as 'read' } },
    }),
  ).toThrow('Invalid Action');
  expect(
    resolveActionIntegrationEffects({ role: 'USER', stored, incoming: { domain: origin } }),
  ).toEqual(stored.integrationEffects);
  expect(
    resolveActionIntegrationEffects({ role: 'USER', stored, incoming: { raw_spec: 'new' } }),
  ).toBeUndefined();
  expect(
    resolveActionIntegrationEffects({
      role: 'OWNER',
      stored,
      incoming: { raw_spec: 'new', integrationEffects: { operation: 'write' } },
    }),
  ).toEqual({ operation: 'write' });
});
