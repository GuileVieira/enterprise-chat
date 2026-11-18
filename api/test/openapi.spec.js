const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { zodToJsonSchema } = require('zod-to-json-schema');
const {
  agentManagementResponseSchema,
  agentManagementListResponseSchema,
  agentManagementErrorSchema,
  skillManagementResponseSchema,
  validateRequest,
} = require('@librechat/api');

const root = path.resolve(__dirname, '../..');
const read = (filename) => fs.readFileSync(path.join(root, filename), 'utf8');
const current = yaml.load(read('docs/openapi/orqest-current.openapi.yaml'));
const proposed = yaml.load(read('docs/openapi/orqest-integration.proposed.openapi.yaml'));
const mounts = {
  'api/server/routes/integrations.js': '/api/integrations/v1',
  'api/server/routes/agents/management.js': '/api/agents/v1/agents',
  'api/server/routes/agents/skills.js': '/api/agents/v1/skills',
  'api/server/routes/agents/openai.js': '/api/agents/v1',
  'api/server/routes/agents/tools.js': '/api/agents/tools',
  'api/server/routes/projects.js': '/api/projects',
  'api/server/routes/files/files.js': '/api/files',
  'api/server/routes/prompts.js': '/api/prompts',
  'api/server/routes/user.js': '/api/user',
  'api/server/routes/tenantApiKeys.js': '/api/tenant-api-keys',
  'api/server/routes/mcp.js': '/api/mcp',
  'api/server/routes/memories.js': '/api/memories',
  'api/server/routes/convos.js': '/api/convos',
  'api/server/routes/messages.js': '/api/messages',
  'api/server/routes/sharedMemories.js': '/api',
};
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const registration = (receiver, method, route) =>
  new RegExp(`${receiver}\\.${method}\\(\\s*['"]${escapeRegex(route)}['"]`);
const normalizeRoute = (route) =>
  route.replace(/:([a-zA-Z_]+)/g, '{$1}').replace(/\*([a-zA-Z_]+)/g, '{$1}');
const operations = (document) =>
  Object.entries(document.paths).flatMap(([route, item]) =>
    Object.entries(item)
      .filter(([method]) => ['get', 'post', 'put', 'patch', 'delete'].includes(method))
      .map(([method, operation]) => ({ route, method, operation })),
  );

function inspectRefs(node, document) {
  if (!node || typeof node !== 'object') return;
  if (typeof node.$ref === 'string') {
    expect(node.$ref.startsWith('#/')).toBe(true);
    const target = node.$ref
      .slice(2)
      .split('/')
      .map((part) => part.replace(/~1/g, '/').replace(/~0/g, '~'))
      .reduce((value, part) => value?.[part], document);
    expect(target).toBeDefined();
  }
  for (const value of Object.values(node)) inspectRefs(value, document);
}

describe('Orqest OpenAPI source review', () => {
  it.each([
    ['current', current, 'implemented'],
    ['integrations', proposed, 'implemented'],
  ])(
    '%s resolves all schema references and requires explicit authentication',
    (_name, doc, state) => {
      const ids = new Set();
      for (const { operation } of operations(doc)) {
        expect(ids.has(operation.operationId)).toBe(false);
        ids.add(operation.operationId);
        expect(operation['x-orqest-status']).toBe(state);
        const security = operation.security ?? doc.security;
        expect(security.length).toBeGreaterThan(0);
        for (const requirement of security) {
          expect(Object.keys(requirement).length).toBeGreaterThan(0);
          for (const scheme of Object.keys(requirement)) {
            expect(doc.components.securitySchemes[scheme]).toBeDefined();
          }
        }
      }
      inspectRefs(doc, doc);
    },
  );

  it('documents only registered paths/methods in the current contract', () => {
    for (const { route, method, operation } of operations(current)) {
      const source = operation['x-orqest-source'];
      const router = read(source.routerFile);
      expect(read(source.file)).not.toHaveLength(0);
      expect(router).toMatch(registration('router', method, source.route));
      expect(mounts[source.routerFile]).toBeDefined();
      const actualPath = `${mounts[source.routerFile]}${normalizeRoute(source.route)}`.replace(
        /\/$/,
        '',
      );
      expect(route).toBe(actualPath);
    }
  });

  it('checks the nested mounts used by the documented routes', () => {
    const server = read('api/server/index.js');
    for (const mount of [
      '/api/integrations/v1',
      '/api/agents',
      '/api/projects',
      '/api/files',
      '/api/prompts',
      '/api/user',
      '/api/tenant-api-keys',
      '/api/mcp',
      '/api/memories',
      '/api/convos',
      '/api/messages',
      '/api',
    ]) {
      expect(server).toMatch(registration('app', 'use', mount));
    }
    const agents = read('api/server/routes/agents/index.js');
    for (const mount of ['/v1/agents', '/v1/skills', '/v1', '/']) {
      expect(agents).toMatch(registration('router', 'use', mount));
    }
    expect(read('api/server/routes/agents/v1.js')).toMatch(registration('router', 'use', '/tools'));
    expect(read('api/server/routes/files/index.js')).toMatch(registration('router', 'use', '/'));
  });

  it.each([
    ['Agent', agentManagementResponseSchema],
    ['AgentPage', agentManagementListResponseSchema],
    ['ManagementError', agentManagementErrorSchema],
    ['Skill', skillManagementResponseSchema],
  ])('%s remains aligned with the exported Zod response contract', (name, schema) => {
    const generated = zodToJsonSchema(schema, { name, target: 'openApi3' });
    const expected = JSON.parse(
      JSON.stringify(generated.definitions[name]).replaceAll(
        '#/definitions/',
        '#/components/schemas/',
      ),
    );
    expect(current.components.schemas[name]).toEqual(expected);
  });

  it('does not advertise session routes as execution-key or management-key routes', () => {
    expect(current.paths['/api/projects/{projectId}'].get.security).toEqual([{ BrowserJwt: [] }]);
    expect(current.paths['/api/files/download/{userId}/{file_id}'].get.security).toEqual([
      { BrowserJwt: [] },
    ]);
    expect(current.paths['/api/agents/v1/agents/{id}'].get.security).toEqual([
      { ManagementOidc: [] },
    ]);
    expect(current.paths['/api/agents/v1/catalog'].get.security).toEqual([
      { TenantExecutionKey: [] },
    ]);
    expect(current.paths['/api/agents/tools/{toolId}/call'].post.parameters[0].schema.enum).toEqual(
      ['execute_code'],
    );
    expect(read('api/server/controllers/tools.js')).toMatch(
      /directCallableTools = new Set\(\[Tools.execute_code\]\)/,
    );
  });

  it('distinguishes skill text reads from document chunk retrieval', () => {
    expect(current.components.schemas.Skill.required).toContain('body');
    expect(current.components.schemas.SkillSummary.properties.body).toBeUndefined();
    expect(current.components.schemas.SkillFileContent.allOf[1].properties.content).toEqual({
      type: 'string',
    });
    expect(current.components.schemas.SkillFileContent.allOf[1].required).not.toContain('content');
    expect(
      current.paths['/api/agents/v1/skills/{id}/files/{relativePath}'].get.responses['200'].content[
        'application/json'
      ],
    ).toBeDefined();
    expect(current.paths['/api/agents/v1/agents/{id}/files/{file_id}/content']).toBeUndefined();
    for (const route of [
      '/api/integrations/v1/files/{id}/content',
      '/api/integrations/v1/files/{id}/preview',
      '/api/integrations/v1/skills/{id}/file-content',
    ])
      expect(proposed.paths[route]).toBeUndefined();
    expect(proposed.components.schemas.File.properties.downloadPath).toBeUndefined();
  });

  it('preserves the file_search query schema, chunk artifact and current limits', () => {
    expect(proposed.components.schemas.FileSearchInput.properties.query).toMatchObject({
      type: 'string',
      minLength: 1,
      maxLength: 4000,
    });
    expect(proposed.components.schemas.FileSearchInput.required).toEqual(['query']);
    expect(proposed.components.schemas.FileSearchInput.additionalProperties).toBe(false);
    const call = proposed.paths['/api/integrations/v1/tools/{toolName}/call'].post;
    expect(call['x-orqest-file-search'].currentLimits).toEqual({ perFileK: 5, globalSources: 10 });
    expect(proposed.components.schemas.FileSearchSources.properties.sources.maxItems).toBe(10);
    const sample = call.responses['200'].content['application/json'].examples.fileSearch.value;
    expect(sample.artifact.file_search.sources[0]).toMatchObject({
      fileId: 'file-1',
      fileName: 'contrato.pdf',
      pages: [3],
    });
    expect(sample).toMatchObject({
      status: 'completed',
      effect: 'not_dispatched',
      data: { indexStatus: 'index_status_unknown' },
    });
    expect(sample.artifact.file_search.sources[0].content).toContain('30 dias');
    expect(proposed.components.schemas.FileSearchSource.properties.chunkId).toBeUndefined();
    expect(
      proposed.components.schemas.ToolResult.properties.artifact.properties.file_search.$ref,
    ).toBe('#/components/schemas/FileSearchSources');
    expect(read('packages/api/src/files/search.ts')).toMatch(/k: 5/);
    expect(read('packages/api/src/files/search.ts')).toMatch(/slice\(0, 10\)/);
  });

  it('implements tenant-bound credentials without changing legacy management authentication', () => {
    expect(proposed.security).toEqual([{ TenantExecutionKey: [] }, { ManagementOidc: [] }]);
    expect(proposed.components.schemas.Agent.properties.instructions.type).toBe('string');
    for (const field of [
      'model_parameters',
      'tool_options',
      'git_identity',
      'skills',
      'agent_ids',
      'tool_resources',
    ])
      expect(proposed.components.schemas.Agent.properties[field]).toBeUndefined();
    const identity = proposed.components.schemas.Identity;
    expect(identity.required).toEqual(['tenantId', 'principalId', 'method']);
    expect(identity.required).not.toContain('keyId');
    expect(identity.properties.key).toBeUndefined();
    expect(current.paths['/api/agents/v1/agents/{id}'].get.security).toEqual([
      { ManagementOidc: [] },
    ]);
  });

  it('documents integrations, OpenAPI discovery and existing agent execution without claiming deploy', () => {
    expect(proposed['x-orqest-status']).toBe('implemented-source-only');
    expect(proposed['x-orqest-worktree-changes']).toBe(true);
    expect(operations(proposed)).toHaveLength(22);
    for (const { route } of operations(proposed)) {
      expect(
        route.startsWith('/api/integrations/v1/') || route === '/api/agents/v1/chat/completions',
      ).toBe(true);
      expect(current.paths[route]).toBeDefined();
    }
    const execution = proposed.paths['/api/agents/v1/chat/completions'].post;
    expect(execution.security).toEqual([{ TenantExecutionKey: [] }]);
    const example = execution.requestBody.content['application/json'].example;
    expect(validateRequest(example).request.model).toBe(example.model);
    expect(proposed.components.schemas.AgentSummary.properties.exportable.enum).toEqual([false]);
    expect(proposed.components.schemas.AgentSummary.properties.instructions).toBeUndefined();
    const context = proposed.components.schemas.Context;
    expect(context.required).toEqual(
      expect.arrayContaining(['agent', 'selection', 'complete', 'warnings', 'contextFingerprint']),
    );
    expect(context.required).not.toContain('project');
    expect(context.properties.tools).toBeUndefined();
    expect(context.properties.limits.properties.tools.type).toBe('string');
    expect(proposed.components.schemas.Tool.required).not.toContain('inputSchema');
    expect(proposed.components.schemas.Tool.required).toContain('callable');
    expect(proposed.components.schemas.SkillDetail.properties.completeProjection.enum).toEqual([
      'body_inventory_and_file_references',
    ]);
    expect(proposed.components.schemas.SkillFileContent.properties.representation.enum).toEqual([
      'body_only',
    ]);
    expect(proposed.components.schemas.Message.additionalProperties).toBe(false);
    expect(proposed.components.schemas.Message.properties.artifacts).toBeUndefined();
    expect(proposed.components.schemas.ToolCall.properties.conversationId).toBeUndefined();
    expect(proposed.components.schemas.ToolResult.properties.status.enum).toEqual([
      'in_progress',
      'completed',
      'failed',
      'partial',
      'ambiguous',
    ]);
    expect(
      proposed.components.schemas.ToolResult.properties.error.properties.error,
    ).toBeUndefined();
    expect(current.paths['/api/integrations/v1/agents/{id}/context'].get['x-orqest-status']).toBe(
      'implemented',
    );
  });

  it('ships the canonical OpenAPI HTTP asset without depending on the Docker-excluded docs directory', () => {
    const asset = JSON.parse(read('api/server/openapi/integrations.json'));
    expect(asset).toEqual(proposed);
    expect(proposed.paths['/api/integrations/v1/openapi.json'].get).toBeDefined();
    expect(read('api/server/routes/integrations.js')).toContain(
      "require('../openapi/integrations.json')",
    );
  });

  it('keeps one canonical integration contract with equivalent prefixed current schemas', () => {
    const prefix = (value) =>
      JSON.parse(
        JSON.stringify(value).replaceAll(
          '#/components/schemas/',
          '#/components/schemas/Integration',
        ),
      );
    for (const [name, schema] of Object.entries(proposed.components.schemas))
      expect(current.components.schemas[`Integration${name}`]).toEqual(prefix(schema));
    for (const [route, operation] of Object.entries(proposed.paths))
      expect(current.paths[route]).toEqual(prefix(operation));
    const skillList =
      proposed.paths['/api/integrations/v1/skills'].get.responses['200'].content['application/json']
        .schema;
    expect(skillList.properties.items.items.$ref).toBe('#/components/schemas/SkillSummary');
    expect(proposed.components.schemas.SkillSummary.properties.body).toBeUndefined();
    expect(read('docs/openapi/README.md')).toContain('não comprova deploy');
  });

  it('documents per-key resource restrictions and JWT-only management', () => {
    expect(proposed.components.schemas.Identity.properties.resourceAccess.$ref).toBe(
      '#/components/schemas/KeyResources',
    );
    const schema = proposed.components.schemas.KeyResources;
    expect(schema.required).toBeUndefined();
    expect(schema.properties.agentIds.type).toBe('array');
    expect(schema.properties.projectIds.type).toBe('array');
    expect(schema.properties.agentIds.minItems).toBeUndefined();
    expect(current.paths['/api/tenant-api-keys'].post.security).toEqual([{ BrowserJwt: [] }]);
    expect(current.paths['/api/tenant-api-keys/{id}'].patch.security).toEqual([{ BrowserJwt: [] }]);
  });
});
