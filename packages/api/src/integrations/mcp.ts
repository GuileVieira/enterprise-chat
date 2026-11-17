import { validate } from '@cfworker/json-schema';
import {
  Constants,
  normalizeServerName,
  buildServerNameAliases,
  splitMCPToolKey,
  stripServerNamePrefix,
} from 'librechat-data-provider';
import type { Schema } from '@cfworker/json-schema';
import type { IAgent } from '@librechat/data-schemas';
import type { ParsedServerConfig, LCAvailableTools } from '~/mcp/types';
import type { MCPManager } from '~/mcp/MCPManager';
import type { IntegrationRequest } from './contracts';
import type { IntegrationToolAdapter } from './tools';
import {
  getMissingCustomUserVars,
  requiresOAuthMachinery,
  requiresEphemeralUserConnection,
  hasRuntimeContextPlaceholders,
  getRuntimeBodyPlaceholderFields,
} from '~/mcp/utils';
import { usesDirectOpenIDBearerRecovery } from '~/mcp/openid';
import { integrationInputSchema } from './schema';
import { isMCPDomainAllowed } from '~/auth/domain';
import { processMCPEnv } from '~/utils/env';
import { findShadowedServerNames, isUserSourced } from '~/mcp/utils';
import { invalid } from './contracts';

export interface IntegrationMCPDependencies {
  resolveConfigs(req: IntegrationRequest): Promise<{ [serverName: string]: ParsedServerConfig }>;
  getCached(
    userId: string,
    serverName: string,
    config: ParsedServerConfig,
  ): Promise<LCAvailableTools | null>;
  getAuth(
    req: IntegrationRequest,
    servers: string[],
  ): Promise<{ [server: string]: { [key: string]: string } }>;
  canUse(req: IntegrationRequest): Promise<boolean>;
  manager(): MCPManager;
  flowManager(): Parameters<MCPManager['callTool']>[0]['flowManager'];
}

/** Cache-only discovery: transport/OAuth and tool dispatch happen solely in execute. */
export async function discoverIntegrationMCPTools(
  deps: IntegrationMCPDependencies,
  req: IntegrationRequest,
  agent: IAgent,
): Promise<IntegrationToolAdapter[]> {
  const requested = (agent.tools ?? []).filter((name) => name.includes(Constants.mcp_delimiter));
  if (!requested.length) {
    return [];
  }
  const configs = await deps.resolveConfigs(req);
  const names = Object.keys(configs);
  const aliases = buildServerNameAliases(names);
  const shadowed = findShadowedServerNames(names);
  const auth = await deps.getAuth(req, names);
  const canUse = await deps.canUse(req);
  const found: IntegrationToolAdapter[] = [];
  for (const assignment of requested) {
    const [rawToolName, parsedServer] = splitMCPToolKey(assignment, [...names, ...aliases.keys()]);
    let serverName = parsedServer;
    if (serverName && !configs[serverName]) {
      serverName = aliases.get(serverName);
    }
    const config = serverName ? configs[serverName] : undefined;
    if (!serverName || !config || shadowed.has(serverName)) {
      found.push({
        name: assignment,
        family: 'mcp',
        description: '',
        callable: false,
        reason: 'server_unavailable',
      });
      continue;
    }
    const userVars = auth[`${Constants.mcp_prefix}${serverName}`];
    let reason: string | undefined;
    if (!canUse) {
      reason = 'permission_denied';
    } else if (requiresOAuthMachinery(config) || usesDirectOpenIDBearerRecovery(config)) {
      reason = 'authentication_lifecycle_required';
    } else if (
      requiresEphemeralUserConnection(config) ||
      hasRuntimeContextPlaceholders(config) ||
      getRuntimeBodyPlaceholderFields(config).length > 0
    ) {
      reason = 'runtime_context_required';
    } else if (getMissingCustomUserVars(config, userVars).length) {
      reason = 'credentials_unavailable';
    }
    if (!reason) {
      try {
        const processed = processMCPEnv({
          user: req.user,
          options: config,
          dbSourced: isUserSourced(config),
          customUserVars: userVars,
        });
        if (
          !(await isMCPDomainAllowed(
            processed,
            req.config?.mcpSettings?.allowedDomains,
            req.config?.mcpSettings?.allowedAddresses,
          ))
        ) {
          reason = 'domain_denied';
        }
      } catch {
        reason = 'configuration_unavailable';
      }
    }
    const cached = await deps.getCached(req.user.id, serverName, config);
    const normalized = normalizeServerName(serverName);
    const candidates = [assignment, `${rawToolName}${Constants.mcp_delimiter}${normalized}`];
    const stripped = stripServerNamePrefix(rawToolName, normalized);
    if (stripped !== rawToolName) {
      candidates.push(`${stripped}${Constants.mcp_delimiter}${normalized}`);
    }
    const pin = rawToolName === Constants.mcp_all;
    if (rawToolName === Constants.mcp_server) {
      continue;
    }
    const entries = pin
      ? Object.entries(cached ?? {})
      : candidates
          .flatMap((key) => {
            const entry = cached?.[key];
            if (
              !entry?.function ||
              (key === `${stripped}${Constants.mcp_delimiter}${normalized}` &&
                stripped !== rawToolName &&
                entry.serverToolName !== rawToolName)
            ) {
              return [];
            }
            return [[key, entry] as const];
          })
          .slice(0, 1);
    if (!entries.length) {
      found.push({
        name: assignment,
        family: 'mcp',
        description: '',
        callable: false,
        reason: reason ?? 'schema_unavailable',
      });
      continue;
    }
    for (const [key, entry] of entries) {
      const name = pin ? key : assignment;
      const [entryName] = splitMCPToolKey(key, [normalized]);
      const upstreamName = entry.serverToolName ?? entryName;
      const assessment =
        config.integrationEffects &&
        Object.prototype.hasOwnProperty.call(config.integrationEffects, upstreamName)
          ? config.integrationEffects[upstreamName]
          : undefined;
      const effect = assessment === 'read' || assessment === 'write' ? assessment : undefined;
      let entryReason = reason;
      let schema: Schema | undefined;
      try {
        schema = entry.function.parameters
          ? integrationInputSchema(entry.function.parameters)
          : undefined;
      } catch {
        entryReason = 'invalid_schema';
      }
      if (!entryReason && !effect) {
        entryReason = 'effect_unclassified';
      }
      if (!entryReason && !schema) {
        entryReason = 'schema_unavailable';
      }
      found.push({
        name,
        identity: `mcp:${serverName}:${upstreamName}`,
        policyNames: [key, `${upstreamName}${Constants.mcp_delimiter}${normalized}`],
        assignment: pin ? assignment : undefined,
        family: 'mcp',
        description: entry.function.description ?? '',
        inputSchema: schema,
        callable: !entryReason && !!effect && !!schema,
        reason: entryReason,
        effect,
        validate: (args) => {
          if (!schema || !validate(args, schema).valid) {
            throw invalid();
          }
          return args;
        },
        execute: async (args, context) => {
          let dispatched = false;
          let upstreamError = false;
          try {
            const data = await deps.manager().callTool({
              serverName,
              serverConfig: config,
              toolName: upstreamName,
              provider: 'openai',
              user: req.user,
              toolArguments: args as { [key: string]: unknown },
              options: { signal: context.signal, timeout: 30000 },
              customUserVars: userVars,
              headless: true,
              flowManager: deps.flowManager(),
              beforeDispatch: async () => {
                await context.beforeDispatch();
                dispatched = true;
              },
              onHeadlessResult: (error) => {
                upstreamError = error;
              },
            });
            return upstreamError
              ? {
                  status: 'ambiguous',
                  effect: 'unknown',
                  error: { code: 'mcp_tool_failed', message: 'MCP tool returned an error' },
                }
              : { status: 'completed', effect: 'completed', data };
          } catch {
            return {
              status: dispatched ? 'ambiguous' : 'failed',
              effect: dispatched ? 'unknown' : 'not_dispatched',
              error: { code: 'mcp_execution_failed', message: 'MCP tool could not complete' },
            };
          }
        },
      });
    }
  }
  return found;
}
