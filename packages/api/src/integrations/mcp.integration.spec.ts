import * as http from 'http';
import mongoose from 'mongoose';
import { Keyv } from 'keyv';
import { randomUUID } from 'crypto';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { z } from 'zod';
import { Constants } from 'librechat-data-provider';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { IAgent, IUser } from '@librechat/data-schemas';
import type { Schema } from '@cfworker/json-schema';
import type { IntegrationRequest } from './contracts';
import type { IntegrationMCPDependencies } from './mcp';
import type { MCPManager } from '~/mcp/MCPManager';
import type { ParsedServerConfig } from '~/mcp/types';
import type { FlowStateManager } from '~/flow/manager';
import type { MCPOAuthTokens } from '~/mcp/oauth';

jest.setTimeout(30000);
let mongo: MongoMemoryServer;
let server: http.Server;
let manager: MCPManager;
let flow: FlowStateManager<MCPOAuthTokens | null>;
let deps: IntegrationMCPDependencies;
let discover: (typeof import('./mcp'))['discoverIntegrationMCPTools'];
let config: ParsedServerConfig;
let requests = 0;
let calls = 0;
let barrier = 0;
let failProvider = false;
const transports = new Set<StreamableHTTPServerTransport>();
const servers = new Set<McpServer>();
const sockets = new Set<import('net').Socket>();
const user = {
  id: 'integration-owner',
  role: 'OWNER',
  tenantId: 'tenant-a',
  provider: 'local',
} as IUser;
const request = {
  user,
  integrationAuth: { principalId: user.id, tenantId: 'tenant-a', method: 'tenant_api_key' },
  config: { mcpSettings: {} },
} as IntegrationRequest;
const agent = { id: 'agent-a', tools: ['echo_mcp_Headless Test'] } as IAgent;
beforeAll(async () => {
  process.env.CREDS_KEY = '0123456789abcdef'.repeat(4);
  process.env.CREDS_IV = '0123456789abcdef'.repeat(2);
  const sessions = new Map<string, StreamableHTTPServerTransport>();
  server = http.createServer(async (req, res) => {
    requests++;
    const session = req.headers['mcp-session-id'];
    let transport = typeof session === 'string' ? sessions.get(session) : undefined;
    if (!transport) {
      transport = new StreamableHTTPServerTransport({ sessionIdGenerator: () => randomUUID() });
      const mcp = new McpServer({ name: 'headless-test', version: '1.0.0' });
      mcp.tool('echo', { value: z.string() }, async ({ value }) => {
        calls++;
        if (!barrier) {
          throw new Error('Missing durable barrier');
        }
        return { isError: failProvider, content: [{ type: 'text', text: value }] };
      });
      await mcp.connect(transport);
      transports.add(transport);
      servers.add(mcp);
    }
    await transport.handleRequest(req, res);
    if (transport.sessionId) {
      sessions.set(transport.sessionId, transport);
    }
  });
  server.on('connection', (socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('No port');
  }
  const allowedAddress = `127.0.0.1:${address.port}`;
  request.config!.mcpSettings = { allowedAddresses: [allowedAddress] };
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  const schemas = await import('@librechat/data-schemas');
  schemas.createModels(mongoose);
  const { MCPServersRegistry } = await import('~/mcp/registry/MCPServersRegistry');
  const { MCPManager: Manager } = await import('~/mcp/MCPManager');
  const { ConnectionsRepository } = await import('~/mcp/ConnectionsRepository');
  const { FlowStateManager: Flow } = await import('~/flow/manager');
  const { createMCPToolCacheService } = await import('~/mcp/tools');
  const { createMCPCatalogStore } = await import('~/mcp/catalog/store');
  const { CacheKeys } = await import('librechat-data-provider');
  const { getMCPAppToolsPublicationGeneration } = await import('~/mcp/toolsChanged');
  const registry = MCPServersRegistry.createInstance(mongoose, null, [allowedAddress]);
  await registry.addServer(
    'Headless Test',
    {
      type: 'streamable-http',
      url: `http://${allowedAddress}/mcp`,
      requiresOAuth: false,
      integrationEffects: { echo: 'write' },
    },
    'CACHE',
  );
  config = (await registry.getServerConfig('Headless Test', user.id))!;
  manager = new Manager();
  manager.appConnections = new ConnectionsRepository();
  flow = new Flow(new Keyv(), { ci: true, ttl: 60000 });
  const cache = new Map<string, unknown>();
  const store = createMCPCatalogStore({
    cacheConfig: { FORCED_IN_MEMORY_CACHE_NAMESPACES: [CacheKeys.TOOL_CACHE] },
    getCache: () => ({
      get: async (key) => cache.get(key),
      set: async (key, value) => {
        cache.set(key, value);
        return true;
      },
      delete: async (key) => cache.delete(key),
    }),
  });
  const service = createMCPToolCacheService({
    ...store,
    getServerConfig: async () => config,
    getAllServerConfigs: async () => ({ 'Headless Test': config }),
    isAppServerConfig: async () => true,
  });
  const publicationGeneration = getMCPAppToolsPublicationGeneration(config);
  const publicationRevision = await store.getNextAppToolsPublicationRevision(
    'Headless Test',
    publicationGeneration,
  );
  await service.updateMCPServerTools({
    serverName: 'Headless Test',
    serverConfig: config,
    publicationGeneration,
    publicationRevision,
    tools: [
      {
        name: 'echo',
        description: 'Echo',
        inputSchema: {
          type: 'object',
          properties: { value: { type: 'string' } },
          required: ['value'],
          additionalProperties: false,
        },
      },
    ],
  });
  deps = {
    resolveConfigs: async () => ({ 'Headless Test': config }),
    getCached: service.getMCPServerTools,
    getAuth: async () => ({}),
    canUse: async () => true,
    manager: () => manager,
    flowManager: () => flow,
  };
  discover = (await import('./mcp')).discoverIntegrationMCPTools;
});
afterAll(async () => {
  await manager?.disconnectAppServers();
  await Promise.all([...transports].map((transport) => transport.close().catch(() => {})));
  await Promise.all([...servers].map((mcp) => mcp.close().catch(() => {})));
  for (const socket of sockets) {
    socket.destroy();
  }
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await mongoose.disconnect();
  await mongo?.stop();
});
beforeEach(() => {
  calls = 0;
  barrier = 0;
  failProvider = false;
});
it('catalog remains cache-only; real manager calls HTTP once after barrier with legacy server alias', async () => {
  const before = requests;
  const tools = await discover(deps, request, agent);
  expect(requests).toBe(before);
  expect(calls).toBe(0);
  expect(tools[0].reason).toBeUndefined();
  expect(tools[0]).toMatchObject({ callable: true, effect: 'write' });
  expect(() => tools[0].validate!({ value: 'x', extra: 1 })).toThrow();
  const result = await tools[0].execute!(
    { value: 'hello' },
    {
      signal: new AbortController().signal,
      beforeDispatch: async () => {
        barrier++;
      },
    },
  );
  expect(result.status).toBe('completed');
  expect(barrier).toBe(1);
  expect(calls).toBe(1);
  expect(JSON.stringify(result)).toContain('hello');
});
it('advertises and executes valid composed MCP arguments without closing sibling branches', async () => {
  const tools = await discover(
    {
      ...deps,
      getCached: async (...args) => {
        const cached = await deps.getCached(...args);
        if (!cached) return null;
        const composed = structuredClone(cached);
        for (const entry of Object.values(composed)) {
          const parameters = {
            type: 'object',
            allOf: [
              { type: 'object', properties: { value: { type: 'string' } }, required: ['value'] },
              { type: 'object', properties: { label: { type: 'string' } }, required: ['label'] },
            ],
          } satisfies Schema;
          entry.function.parameters = parameters;
        }
        return composed;
      },
    },
    request,
    agent,
  );
  expect(tools[0].callable).toBe(true);
  const args = tools[0].validate!({ value: 'composed', label: 'valid' });
  expect(() => tools[0].validate!({ value: 'missing label' })).toThrow();
  const result = await tools[0].execute!(args, {
    signal: new AbortController().signal,
    beforeDispatch: async () => {
      barrier++;
    },
  });
  expect(result.status).toBe('completed');
  expect(JSON.stringify(result)).toContain('composed');
  expect(calls).toBe(1);
  expect(barrier).toBe(1);
});
it('wildcard expands cached identity; upstream error never reports completed or retries', async () => {
  failProvider = true;
  const tools = await discover(deps, request, {
    ...agent,
    tools: [`${Constants.mcp_all}_mcp_Headless Test`],
  });
  expect(tools).toHaveLength(1);
  expect(tools[0].assignment).toBe(`${Constants.mcp_all}_mcp_Headless Test`);
  const result = await tools[0].execute!(
    { value: 'fail' },
    {
      signal: new AbortController().signal,
      beforeDispatch: async () => {
        barrier++;
      },
    },
  );
  expect(result.status).toBe('ambiguous');
  expect(calls).toBe(1);
  expect(barrier).toBe(1);
});
it('OAuth, untrusted assessment and missing cache are unavailable without transport activity', async () => {
  const before = requests;
  config = { ...config, requiresOAuth: true };
  const oauth = await discover(deps, request, agent);
  expect(oauth[0].callable).toBe(false);
  config = { ...config, requiresOAuth: false, source: 'user' };
  const userSourced = await discover(deps, request, agent);
  expect(userSourced[0].callable).toBe(false);
  config = { ...config, source: 'yaml' };
  const missing = await discover({ ...deps, getCached: async () => null }, request, agent);
  expect(missing[0]).toMatchObject({ callable: false, reason: 'schema_unavailable' });
  expect(requests).toBe(before);
});
