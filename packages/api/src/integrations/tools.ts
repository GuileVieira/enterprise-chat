import { z } from 'zod';
import type { RequestHandler } from 'express';
import type {
  IAgent,
  TenantFunctionMethods,
  TenantSecretMethods,
  IntegrationCallMethods,
} from '@librechat/data-schemas';
import type { SearchFile } from '~/files/search';
import type { IntegrationRequest } from './contracts';
import type { IntegrationToolOutcome } from './calls';
import { fileSearchArguments, searchFiles, FileSearchLimitError } from '~/files/search';
import {
  buildTenantFunctionZodSchema,
  convertToJsonSchema,
} from '~/tools/tenant-functions/schema-parser';
import { executeTenantFunctionResult } from '~/tools/tenant-functions/executor';
import { IntegrationError, notFound, invalid } from './contracts';
import { executeIntegrationWrite } from './calls';
import { isContentFilterError } from '~/middleware/contentFilter';

export interface IntegrationToolAdapter {
  name: string;
  description: string;
  assignment?: string;
  identity?: string;
  policyNames?: string[];
  bindProject?: boolean;
  operationEffects?: { [operation: string]: string };
  effectForArguments?: (args: object) => 'read' | 'write';
  family: 'builtin' | 'action' | 'mcp' | 'tenant_function';
  inputSchema?: object;
  callable: boolean;
  reason?: string;
  effect?: 'read' | 'write';
  validate?: (args: object) => object;
  execute?: (
    args: object,
    context: { beforeDispatch: () => Promise<void>; signal: AbortSignal },
  ) => Promise<IntegrationToolOutcome>;
}
export interface IntegrationToolDependencies {
  resolveExportAgent: (req: IntegrationRequest, id: string) => Promise<IAgent>;
  resolveAgent: (req: IntegrationRequest, id: string) => Promise<IAgent>;
  resolveProject: (
    req: IntegrationRequest,
    id: string,
    permission?: 'view' | 'edit',
  ) => Promise<object>;
  resolveFiles: (
    req: IntegrationRequest,
    agent: IAgent,
    projectId?: string,
  ) => Promise<SearchFile[]>;
  requireFileSearch: (req: IntegrationRequest, agent: IAgent) => Promise<void>;
  authorizeTool: (
    req: IntegrationRequest,
    agent: IAgent,
    name: string,
    aliases?: string[],
  ) => Promise<void>;
  inspect: (
    req: IntegrationRequest,
    name: string,
    phase: 'arguments' | 'result',
    value: unknown,
  ) => Promise<void>;
  discoverTools: (
    req: IntegrationRequest,
    agent: IAgent,
    projectId?: string,
  ) => Promise<IntegrationToolAdapter[]>;
  integrationCalls: IntegrationCallMethods;
  getTenantFunctions: TenantFunctionMethods['getTenantFunctions'];
  getTenantSecret: TenantSecretMethods['getTenantSecret'];
}
const envelopeSchema = z
  .object({
    agentId: z.string().min(1).max(512),
    projectId: z.string().min(1).max(512).optional(),
    arguments: z.record(z.unknown()),
  })
  .strict();
const fileSearchDefinition = {
  name: 'file_search',
  description: 'Search authorized agent and project files',
  family: 'builtin' as const,
  inputSchema: {
    type: 'object',
    properties: { query: { type: 'string', minLength: 1, maxLength: 4000 } },
    required: ['query'],
    additionalProperties: false,
  },
  callable: true,
  effect: 'read' as const,
};

function abortable<T>(operation: () => Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const abort = () =>
      reject(new IntegrationError(504, 'tool_timeout', 'Tool execution deadline exceeded'));
    if (signal.aborted) {
      abort();
      return;
    }
    signal.addEventListener('abort', abort, { once: true });
    void operation()
      .then(resolve, reject)
      .finally(() => signal.removeEventListener('abort', abort));
  });
}

export function createIntegrationToolHandlers(deps: IntegrationToolDependencies): {
  catalog: RequestHandler;
  call: RequestHandler;
} {
  const adapters = async (
    req: IntegrationRequest,
    agent: IAgent,
    projectId?: string,
  ): Promise<IntegrationToolAdapter[]> => {
    const assigned = new Set(agent.tools ?? []);
    if (projectId && !assigned.has('file_search')) {
      const projectFiles = await deps.resolveFiles(
        req,
        { ...agent, tool_resources: {} },
        projectId,
      );
      if (projectFiles.length) {
        assigned.add('file_search');
      }
    }
    const found = (await deps.discoverTools(req, agent, projectId)).map((adapter) => ({
      ...adapter,
    }));
    if (assigned.has('file_search')) {
      try {
        await deps.requireFileSearch(req, agent);
        found.push({ ...fileSearchDefinition });
      } catch {
        found.push({ ...fileSearchDefinition, callable: false, reason: 'permission_denied' });
      }
    }
    const functions = await deps.getTenantFunctions({
      tenantId: req.integrationAuth!.tenantId,
      isActive: true,
    });
    for (const fn of functions) {
      if (!assigned.has(fn.id)) {
        continue;
      }
      let schema: ReturnType<typeof buildTenantFunctionZodSchema>;
      try {
        schema = buildTenantFunctionZodSchema(fn.inputSchema, true);
      } catch {
        found.push({
          name: fn.id,
          description: fn.description,
          family: 'tenant_function',
          callable: false,
          reason: 'invalid_schema',
        });
        continue;
      }
      const configured =
        !fn.config.auth || !!(await deps.getTenantSecret(fn.tenantId, fn.config.auth.secretName));
      let reason: string | undefined;
      if (!configured) {
        reason = 'credentials_unavailable';
      } else if (!fn.integrationEffect) {
        reason = 'effect_unclassified';
      }
      found.push({
        name: fn.id,
        description: fn.description,
        family: 'tenant_function',
        inputSchema: convertToJsonSchema(fn.inputSchema, true),
        effect: fn.integrationEffect,
        callable: configured && !!fn.integrationEffect,
        reason,
        validate: (args) => schema.parse(args),
        execute: async (args, context) => {
          const result = await executeTenantFunctionResult(
            fn,
            args as { [key: string]: unknown },
            { getTenantSecret: deps.getTenantSecret },
            { ...context, maxBytes: 1048576 },
          );
          if (result.response.ok) {
            return { status: 'completed', effect: result.effect, data: result.response.data };
          }
          let status: 'failed' | 'partial' | 'ambiguous' = 'failed';
          if (result.effect === 'unknown') {
            status = 'ambiguous';
          } else if (result.effect === 'completed') {
            status = 'partial';
          }
          return {
            status,
            effect: result.effect,
            error: {
              code: 'tenant_function_failed',
              message: 'Tenant function did not complete successfully',
            },
          };
        },
      });
    }
    const grouped = new Map<string, IntegrationToolAdapter[]>();
    for (const tool of found.filter((tool) => assigned.has(tool.assignment ?? tool.name))) {
      const matches = grouped.get(tool.name) ?? [];
      matches.push(tool);
      grouped.set(tool.name, matches);
    }
    const unique = [...grouped.values()].map((matches) =>
      matches.length === 1 ||
      matches.every(
        (adapter) =>
          adapter.family === matches[0].family &&
          adapter.identity &&
          adapter.identity === matches[0].identity,
      )
        ? matches[0]
        : {
            name: matches[0].name,
            description: 'Tool name collision',
            family: matches[0].family,
            callable: false,
            reason: 'tool_name_collision',
          },
    );
    for (const adapter of unique) {
      try {
        await deps.authorizeTool(req, agent, adapter.name, adapter.policyNames);
      } catch (error) {
        adapter.callable = false;
        adapter.reason = error instanceof IntegrationError ? error.code : 'policy_denied';
      }
    }
    if (unique.length > 200) {
      throw new IntegrationError(429, 'catalog_limit', 'Tool catalog exceeds 200 entries');
    }
    return unique;
  };
  const handle =
    (fn: (req: IntegrationRequest, signal: AbortSignal) => Promise<object>): RequestHandler =>
    async (request, response) => {
      const controller = new AbortController();
      const abort = () => controller.abort();
      const timer = setTimeout(abort, 30000);
      request.once('aborted', abort);
      response.once('close', abort);
      try {
        response.json(await fn(request as IntegrationRequest, controller.signal));
      } catch (error) {
        let failure = new IntegrationError(500, 'internal_error', 'Tool request failed');
        if (error instanceof IntegrationError) {
          failure = error;
        } else if (isContentFilterError(error)) {
          failure = new IntegrationError(
            403,
            'content_filtered',
            'Content blocked by current policy',
          );
        } else if (error instanceof z.ZodError) {
          failure = invalid();
        } else if (error instanceof FileSearchLimitError) {
          failure = new IntegrationError(429, 'file_scope_limit', error.message);
        }
        response
          .status(failure.status)
          .json({ error: { code: failure.code, message: failure.message } });
      } finally {
        clearTimeout(timer);
        request.off('aborted', abort);
        response.off('close', abort);
      }
    };
  return {
    catalog: handle(async (req) => {
      if (Object.keys(req.query).length) {
        throw invalid();
      }
      const agent = await deps.resolveExportAgent(req, req.params.id);
      const definitions = await adapters(req, agent);
      try {
        await deps.resolveAgent(req, req.params.id);
      } catch (error) {
        if (!(error instanceof IntegrationError) || ![403, 404].includes(error.status)) {
          throw error;
        }
        for (const tool of definitions) {
          tool.callable = false;
          tool.reason = 'remote_access_denied';
        }
      }
      const tools = definitions.map(
        ({
          validate: _validate,
          execute: _execute,
          assignment: _assignment,
          identity: _identity,
          policyNames: _policyNames,
          bindProject: _bindProject,
          effectForArguments: _effectForArguments,
          ...definition
        }) => definition,
      );
      return { tools, nextCursor: null };
    }),
    call: handle(async (req, signal) => {
      if (Object.keys(req.query).length) {
        throw invalid();
      }
      if (!req.integrationAuth) {
        throw new IntegrationError(401, 'unauthorized', 'Authentication required');
      }
      const envelope = envelopeSchema.parse(req.body);
      if (Buffer.byteLength(JSON.stringify(envelope)) > 1048576) {
        throw invalid();
      }
      const agent = await deps.resolveAgent(req, envelope.agentId);
      if (envelope.projectId) {
        await deps.resolveProject(req, envelope.projectId);
      }
      const adapter = (await adapters(req, agent, envelope.projectId)).find(
        (tool) => tool.name === req.params.toolName,
      );
      if (!adapter) {
        throw notFound();
      }
      await deps.authorizeTool(req, agent, adapter.name, adapter.policyNames);
      if (!adapter.callable) {
        throw new IntegrationError(
          409,
          adapter.reason ?? 'tool_unavailable',
          'Tool unavailable for headless execution',
        );
      }
      if (adapter.name === 'file_search') {
        const args = fileSearchArguments.parse(envelope.arguments);
        await deps.requireFileSearch(req, agent);
        await deps.inspect(req, adapter.name, 'arguments', args);
        const scopedAgent = {
          ...agent,
          tool_resources: { file_search: agent.tool_resources?.file_search },
        };
        const files = await deps.resolveFiles(req, scopedAgent, envelope.projectId);
        const agentFiles = new Set(agent.tool_resources?.file_search?.file_ids ?? []);
        const result = await searchFiles({
          userId: req.integrationAuth.principalId,
          query: args.query,
          entityId: agent.id,
          signal,
          files: files.map((file) => ({ ...file, fromAgent: agentFiles.has(file.file_id) })),
        });
        await deps.inspect(req, adapter.name, 'result', result);
        if (result.status === 'failed') {
          const deadline = result.failures.some((failure) =>
            ['timeout', 'cancelled'].includes(failure.code),
          );
          let code = 'rag_unavailable';
          if (deadline) {
            code = 'rag_timeout';
          } else if (result.failures.some((failure) => failure.code === 'rag_auth')) {
            code = 'rag_auth';
          }
          throw new IntegrationError(
            deadline ? 504 : 502,
            code,
            'File search provider unavailable',
          );
        }
        return {
          status: result.status === 'partial' ? 'partial' : 'completed',
          effect: 'not_dispatched',
          data: result,
          artifact: { file_search: { sources: result.sources } },
        };
      }
      if (!adapter.validate || !adapter.execute || !adapter.effect) {
        throw new IntegrationError(409, 'tool_unavailable', 'Tool unavailable');
      }
      let input = envelope.arguments;
      if (adapter.bindProject) {
        if (
          !envelope.projectId ||
          (input.project_id !== undefined && input.project_id !== envelope.projectId)
        ) {
          throw invalid();
        }
        input = { ...input, project_id: envelope.projectId };
      }
      const args = adapter.validate(input);
      const effect = adapter.effectForArguments?.(args) ?? adapter.effect;
      if (effect === 'write' && adapter.bindProject && envelope.projectId) {
        await deps.resolveProject(req, envelope.projectId, 'edit');
      }
      await deps.inspect(req, adapter.name, 'arguments', args);
      const inspectResult = async (
        outcome: IntegrationToolOutcome,
      ): Promise<IntegrationToolOutcome> => {
        await deps.inspect(req, adapter.name, 'result', outcome);
        if (Buffer.byteLength(JSON.stringify(outcome)) > 1048576) {
          throw new Error('Tool output exceeds limit');
        }
        return outcome;
      };
      if (effect === 'write') {
        return await executeIntegrationWrite({
          store: deps.integrationCalls,
          tenantId: req.integrationAuth.tenantId,
          principalId: req.integrationAuth.principalId,
          key: req.get('Idempotency-Key'),
          envelope: { ...envelope, toolName: adapter.name, arguments: args },
          inspectResult,
          execute: (beforeDispatch) =>
            abortable(
              () =>
                adapter.execute!(args, {
                  beforeDispatch: async () => {
                    signal.throwIfAborted();
                    await beforeDispatch();
                  },
                  signal,
                }),
              signal,
            ),
        });
      }
      return await inspectResult(
        await abortable(
          () => adapter.execute!(args, { beforeDispatch: async () => {}, signal }),
          signal,
        ),
      );
    }),
  };
}
