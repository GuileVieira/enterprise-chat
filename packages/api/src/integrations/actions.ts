import { z } from 'zod';
import { Validator } from '@cfworker/json-schema';
import type { Schema } from '@cfworker/json-schema';
import { isDeepStrictEqual } from 'node:util';
import {
  AuthTypeEnum,
  AuthorizationTypeEnum,
  TokenExchangeMethodEnum,
  SystemRoles,
  actionDelimiter,
  actionDomainSeparator,
  normalizeActionToolName,
  openapiToFunction,
  resolveRef,
  validateActionDomain,
  validateAndParseOpenAPISpec,
} from 'librechat-data-provider';
import type { ActionMetadata, ActionRequest, FunctionSignature } from 'librechat-data-provider';
import type { OpenAPIV3 } from 'openapi-types';
import type { IAgent, IAction } from '@librechat/data-schemas';
import type { IntegrationToolAdapter } from './tools';
import type { IntegrationRequest } from './contracts';
import { isActionDomainAllowed } from '../auth/domain';
import { createSSRFSafeAgents } from '../auth/agent';
import { IntegrationError, invalid } from './contracts';

const effectsSchema = z.record(
  z.string().regex(/^[a-zA-Z0-9_-]{1,200}$/),
  z.enum(['read', 'write']),
);
export function resolveActionIntegrationEffects(options: {
  role: string;
  incoming: ActionMetadata;
  stored?: ActionMetadata;
}): ActionMetadata['integrationEffects'] {
  const { incoming, stored, role } = options;
  if (Object.prototype.hasOwnProperty.call(incoming, 'integrationEffects')) {
    if (![SystemRoles.ADMIN, SystemRoles.OWNER].includes(role as SystemRoles))
      throw new IntegrationError(
        403,
        'permission_denied',
        'Only administrators or tenant owners may assess Action effects',
      );
    const parsed = effectsSchema.safeParse(incoming.integrationEffects);
    if (!parsed.success)
      throw new IntegrationError(400, 'invalid_effects', 'Invalid Action integration effects');
    return parsed.data;
  }
  const changed = (
    ['domain', 'raw_spec', 'auth', 'api_key', 'oauth_client_id', 'oauth_client_secret'] as const
  ).some(
    (key) =>
      Object.prototype.hasOwnProperty.call(incoming, key) &&
      !isDeepStrictEqual(stored?.[key], incoming[key]),
  );
  return changed ? undefined : stored?.integrationEffects;
}

const actionAuthSchema = z
  .object({
    type: z.nativeEnum(AuthTypeEnum),
    authorization_type: z.nativeEnum(AuthorizationTypeEnum).optional(),
    custom_auth_header: z.string().optional(),
    authorization_content_type: z.string().optional(),
    authorization_url: z.string().optional(),
    client_url: z.string().optional(),
    scope: z.string().optional(),
    token_exchange_method: z.nativeEnum(TokenExchangeMethodEnum).nullish(),
  })
  .optional();
interface ActionSnapshot {
  storedActions: IAction[];
  actionSets: IAction[];
}
interface ActionDiscoveryDeps {
  req: IntegrationRequest;
  agent: IAgent;
  prepareActionSnapshotForTools: (input: {
    agentId: string;
    toolNames: string[];
    filters: NonNullable<IntegrationRequest['config']>['filters'];
    decrypt: boolean;
  }) => Promise<ActionSnapshot | null>;
  domainParser: (domain: string, inverse: boolean) => Promise<string | undefined>;
  legacyDomainEncode: (domain: string) => string;
  loadOAuthToken: (
    userId: string,
    actionId: string,
  ) => Promise<{ token: string; expiresAt: Date } | null>;
}
export function actionInputSchema(parameters: object, schemas: object = {}, strict = true): Schema {
  const root = structuredClone(parameters) as { [key: string]: unknown };
  const components: { [key: string]: unknown } = Object.create(null);
  const source = schemas as { [key: string]: unknown };
  let nodes = 0;
  const visit = (value: unknown, depth = 0): void => {
    if (++nodes > 5000 || depth > 40) throw invalid();
    if (Array.isArray(value)) {
      for (const item of value) visit(item, depth + 1);
      return;
    }
    if (!value || typeof value !== 'object') return;
    const node = value as { [key: string]: unknown };
    if (typeof node.$ref === 'string') {
      const match = /^#\/components\/schemas\/([^/]+)$/.exec(node.$ref);
      if (!match) throw invalid();
      const name = match[1].replace(/~1/g, '/').replace(/~0/g, '~');
      if (!Object.prototype.hasOwnProperty.call(source, name)) throw invalid();
      if (!Object.prototype.hasOwnProperty.call(components, name)) {
        components[name] = structuredClone(source[name]);
        visit(components[name], depth + 1);
      }
    }
    if (node.nullable === true && typeof node.type === 'string') node.type = [node.type, 'null'];
    delete node.nullable;
    for (const [key, child] of Object.entries(node)) if (key !== '$ref') visit(child, depth + 1);
  };
  visit(root);
  if (strict && root.additionalProperties === undefined) root.additionalProperties = false;
  if (Object.keys(components).length) root.components = { schemas: components };
  return root as Schema;
}
function operationInputSchema(
  spec: OpenAPIV3.Document,
  builder: ActionRequest,
  signature: FunctionSignature,
): Schema {
  const path = spec.paths[builder.path];
  if (path?.parameters?.length || path?.$ref) throw invalid();
  const operation = path?.[builder.method.toLowerCase() as OpenAPIV3.HttpMethods];
  if (!operation) throw invalid();
  const parameterNames = new Set<string>();
  for (const parameter of operation.parameters ?? []) {
    const name = resolveRef(parameter, spec.components).name;
    if (parameterNames.has(name)) throw invalid();
    parameterNames.add(name);
  }
  if (!operation.requestBody)
    return actionInputSchema(signature.parameters, spec.components?.schemas);
  if (!['post', 'put', 'patch', 'delete'].includes(builder.method.toLowerCase())) throw invalid();
  const requestBody = resolveRef(operation.requestBody, spec.components);
  const raw = requestBody.content[builder.contentType]?.schema;
  if (!raw) throw invalid();
  const resolved = resolveRef(raw, spec.components);
  if (resolved.type !== undefined && resolved.type !== 'object') throw invalid();
  if (!operation.parameters?.length) return actionInputSchema(raw, spec.components?.schemas, false);
  if (
    [...parameterNames].some((name) =>
      Object.prototype.hasOwnProperty.call(resolved.properties ?? {}, name),
    )
  )
    throw invalid();
  const flatBodyKeys = new Set([
    'type',
    'properties',
    'required',
    'description',
    'title',
    'additionalProperties',
    'example',
    'examples',
    'nullable',
    'default',
  ]);
  // Mixed flat arguments cannot faithfully represent body-root composition or cardinality constraints.
  if (Object.keys(resolved).some((key) => !flatBodyKeys.has(key))) throw invalid();
  return actionInputSchema(signature.parameters, spec.components?.schemas);
}
export async function discoverIntegrationActionAdapters(
  deps: ActionDiscoveryDeps,
): Promise<IntegrationToolAdapter[]> {
  const { req, agent } = deps;
  const names = agent.tools ?? [];
  const snapshot = await deps.prepareActionSnapshotForTools({
    agentId: agent.id,
    toolNames: names,
    filters: req.config?.filters,
    decrypt: true,
  });
  if (!snapshot) return [];
  const adapters = new Map<string, IntegrationToolAdapter>();
  for (const action of snapshot.actionSets) {
    if (action.tenantId !== req.user.tenantId || action.agent_id !== agent.id) continue;
    const parsedAuth = actionAuthSchema.safeParse(action.metadata.auth);
    if (!parsedAuth.success) continue;
    const metadata = {
      ...action.metadata,
      auth: parsedAuth.data
        ? {
            ...parsedAuth.data,
            token_exchange_method: parsedAuth.data.token_exchange_method ?? undefined,
          }
        : undefined,
    };
    const parsed = validateAndParseOpenAPISpec(metadata.raw_spec ?? '');
    if (
      !parsed.spec ||
      !parsed.serverUrl ||
      !metadata.domain ||
      !validateActionDomain(metadata.domain, parsed.serverUrl).isValid
    )
      continue;
    const spec = parsed.spec;
    if (
      !(await isActionDomainAllowed(
        metadata.domain,
        req.config?.actions?.allowedDomains,
        req.config?.actions?.allowedAddresses,
      ))
    )
      continue;
    const encoded = await deps.domainParser(metadata.domain, true);
    if (!encoded) continue;
    const canonicalDomain = encoded.replace(new RegExp(actionDomainSeparator, 'g'), '_');
    const legacyDomain = deps
      .legacyDomainEncode(metadata.domain)
      .replace(new RegExp(actionDomainSeparator, 'g'), '_');
    const compiled = openapiToFunction(spec);
    let runtimeMetadata: ActionMetadata & {
      oauth_access_token?: string;
      oauth_token_expires_at?: Date;
    } = metadata;
    let credentials =
      metadata.auth?.type !== AuthTypeEnum.ServiceHttp ||
      !!(
        metadata.api_key &&
        ([AuthorizationTypeEnum.Basic, AuthorizationTypeEnum.Bearer].includes(
          metadata.auth.authorization_type as AuthorizationTypeEnum,
        ) ||
          (metadata.auth.authorization_type === AuthorizationTypeEnum.Custom &&
            metadata.auth.custom_auth_header))
      );
    if (metadata.auth?.type === AuthTypeEnum.OAuth) {
      const token = await deps.loadOAuthToken(req.user.id, action.action_id);
      credentials = !!(
        token &&
        token.expiresAt.getTime() > Date.now() &&
        metadata.oauth_client_id &&
        metadata.oauth_client_secret &&
        metadata.auth.authorization_url &&
        metadata.auth.client_url &&
        metadata.auth.scope &&
        metadata.auth.token_exchange_method
      );
      if (token && credentials)
        runtimeMetadata = {
          ...metadata,
          oauth_access_token: token.token,
          oauth_token_expires_at: token.expiresAt,
        };
    }
    for (const signature of compiled.functionSignatures) {
      const builder = compiled.requestBuilders[signature.name];
      if (
        !['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'trace'].includes(
          builder.method.toLowerCase(),
        )
      )
        continue;
      const aliases = [
        `${signature.name}${actionDelimiter}${canonicalDomain}`,
        `${signature.name}${actionDelimiter}${legacyDomain}`,
      ];
      const assigned = names.filter((name) => aliases.includes(normalizeActionToolName(name)));
      if (!assigned.length) continue;
      const effect = metadata.integrationEffects?.[signature.name];
      let protectedHeader: string | undefined;
      if (
        metadata.auth?.type === AuthTypeEnum.OAuth ||
        (metadata.auth?.type === AuthTypeEnum.ServiceHttp &&
          metadata.auth.authorization_type !== AuthorizationTypeEnum.Custom)
      )
        protectedHeader = 'authorization';
      else if (metadata.auth?.type === AuthTypeEnum.ServiceHttp)
        protectedHeader = metadata.auth.custom_auth_header?.toLowerCase();
      const operation =
        spec.paths[builder.path]?.[builder.method.toLowerCase() as OpenAPIV3.HttpMethods];
      const credentialHeaders = new Set(
        (operation?.parameters ?? [])
          .map((parameter) => resolveRef(parameter, spec.components))
          .filter(
            (parameter) =>
              parameter.in === 'header' && parameter.name.toLowerCase() === protectedHeader,
          )
          .map((parameter) => parameter.name),
      );
      let inputSchema: Schema | undefined;
      let validator: Validator | undefined;
      try {
        inputSchema = operationInputSchema(spec, builder, signature);
        validator = new Validator(inputSchema);
      } catch {
        /* Unresolvable or oversized schemas remain non-callable. */
      }
      let reason: string | undefined;
      if (!effect) reason = 'effect_unclassified';
      else if (!validator) reason = 'unsupported_schema';
      else if (!credentials) reason = 'credentials_unavailable';
      else if (credentialHeaders.size) reason = 'credential_header_conflict';
      else if (!['get', 'post', 'put', 'patch', 'delete'].includes(builder.method.toLowerCase()))
        reason = 'unsupported_http_method';
      else if (builder.isConsequential) reason = 'approval_required';
      for (const name of assigned) {
        if (adapters.has(name)) {
          adapters.set(name, {
            name,
            description: '',
            family: 'action',
            callable: false,
            reason: 'ambiguous_action',
          });
          continue;
        }
        adapters.set(name, {
          name,
          assignment: name,
          policyNames: [...new Set([name, ...aliases])],
          family: 'action',
          description: signature.description,
          inputSchema,
          effect,
          callable: reason === undefined,
          reason,
          validate: (args) => {
            if (credentialHeaders.size) throw invalid();
            if (!validator || !validator.validate(args).valid) throw invalid();
            return args;
          },
          execute: async (args, context) => {
            const executor = builder.createExecutor().setParams(args as { [key: string]: unknown });
            await executor.setAuth(runtimeMetadata);
            context.signal.throwIfAborted();
            await context.beforeDispatch();
            try {
              const response = await executor.execute({
                ...createSSRFSafeAgents(req.config?.actions?.allowedAddresses),
                signal: context.signal,
                timeout: 30000,
                maxContentLength: 1024 * 1024,
                maxBodyLength: 1024 * 1024,
              });
              if (response.status < 200 || response.status >= 300)
                return {
                  status: effect === 'write' ? 'ambiguous' : 'failed',
                  effect: effect === 'write' ? 'unknown' : 'not_dispatched',
                  error: {
                    code: 'action_upstream_rejected',
                    message: 'Action provider did not complete the request',
                  },
                };
              return {
                status: 'completed',
                effect: effect === 'write' ? 'completed' : 'not_dispatched',
                data: response.data,
              };
            } catch {
              return {
                status: effect === 'write' ? 'ambiguous' : 'failed',
                effect: effect === 'write' ? 'unknown' : 'not_dispatched',
                error: {
                  code: context.signal.aborted ? 'action_cancelled' : 'action_upstream_error',
                  message: 'Action provider request did not complete',
                },
              };
            }
          },
        });
      }
    }
  }
  return [...adapters.values()];
}
