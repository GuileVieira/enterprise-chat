import { z } from 'zod';
import { validate } from '@cfworker/json-schema';
import { Calculator } from '@librechat/agents';
import type { IAgent } from '@librechat/data-schemas';
import type { IntegrationToolAdapter } from './tools';
import type { IntegrationRequest } from './contracts';
import { getToolDefinition } from '~/tools/registry/definitions';
import { integrationInputSchema } from './schema';
import { IntegrationError, invalid } from './contracts';

const calculatorArgs = z.object({ input: z.string().min(1).max(4000) }).strict();
export function integrationCalculator(): IntegrationToolAdapter {
  return {
    name: 'calculator',
    family: 'builtin',
    description: 'Evaluate a mathematical expression',
    callable: true,
    effect: 'read',
    inputSchema: {
      type: 'object',
      properties: { input: { type: 'string', minLength: 1, maxLength: 4000 } },
      required: ['input'],
      additionalProperties: false,
    },
    validate: (args) => calculatorArgs.parse(args),
    execute: async (args, { signal }) => {
      signal.throwIfAborted();
      try {
        return {
          status: 'completed',
          effect: 'not_dispatched',
          data: await new Calculator().invoke(calculatorArgs.parse(args), { signal }),
        };
      } catch {
        return {
          status: 'failed',
          effect: 'not_dispatched',
          error: { code: 'calculator_failed', message: 'Expression could not be evaluated' },
        };
      }
    },
  };
}

// These concrete implementations query providers; none invokes Orqest's agent/model runtime.
const readTools = new Set([
  'google',
  'duckduckgo_search',
  'fetch_url',
  'open_weather',
  'wolfram',
  'azure-ai-search',
  'traversaal_search',
  'tavily_search_results_json',
  'web_search',
  'meta_ads_get_insights',
]);
const budgetReads = new Set(['get_status', 'list_recommendations']);
const budgetWrites = new Set([
  'run_now',
  'approve_change',
  'pause_automation',
  'update_budget',
  'pause_campaign',
  'activate_campaign',
  'duplicate_adset',
  'update_entity',
  'set_status',
  'duplicate_entity',
  'create_campaign',
  'create_adset',
  'create_ad',
  'create_creative',
  'update_ad_creative',
  'delete_custom_audience',
]);
export interface IntegrationBuiltinDependencies {
  authenticated(req: IntegrationRequest, names: string[]): Promise<string[]>;
  execute(
    req: IntegrationRequest,
    agent: IAgent,
    name: string,
    args: object,
    signal: AbortSignal,
    projectId?: string,
  ): Promise<unknown>;
}
const providerResult = z
  .object({ ok: z.boolean().optional(), error: z.unknown().optional() })
  .passthrough();

/** Builtin schemas come from the registry; the existing loader retains auth/SSRF/domain guards. */
export async function discoverIntegrationBuiltins(
  deps: IntegrationBuiltinDependencies,
  req: IntegrationRequest,
  agent: IAgent,
  projectId?: string,
): Promise<IntegrationToolAdapter[]> {
  const selected = (agent.tools ?? []).filter(
    (name) => readTools.has(name) || name === 'meta_ads_budget_manager',
  );
  const available = new Set(await deps.authenticated(req, selected));
  return selected.flatMap((name) => {
    const definition = getToolDefinition(name);
    if (!definition) {
      return [];
    }
    const schema = integrationInputSchema(definition.schema);
    const projectBound = name.startsWith('meta_ads_');
    let reason: string | undefined;
    if (!available.has(name)) {
      reason = 'credentials_unavailable';
    } else if (projectBound && !projectId) {
      reason = 'project_context_required';
    }
    return [
      {
        name,
        family: 'builtin' as const,
        description: definition.description,
        inputSchema: schema,
        callable: available.has(name) && (!projectBound || !!projectId),
        reason,
        effect: name === 'meta_ads_budget_manager' ? ('write' as const) : ('read' as const),
        operationEffects:
          name === 'meta_ads_budget_manager'
            ? Object.fromEntries(
                [...budgetReads]
                  .map((action) => [action, 'read'])
                  .concat([...budgetWrites].map((action) => [action, 'write'])),
              )
            : undefined,
        bindProject: projectBound,
        effectForArguments: (args) => {
          if (name !== 'meta_ads_budget_manager') {
            return 'read';
          }
          const action = (args as { action?: string }).action ?? '';
          if (budgetReads.has(action)) {
            return 'read';
          }
          if (budgetWrites.has(action)) {
            return 'write';
          }
          throw invalid();
        },
        validate: (args) => {
          if (!validate(args, schema).valid) {
            throw invalid();
          }
          return args;
        },
        execute: async (args, context) => {
          const action = (args as { action?: string }).action;
          const writes = name === 'meta_ads_budget_manager' && budgetWrites.has(action ?? '');
          let dispatched = false;
          try {
            context.signal.throwIfAborted();
            if (writes) {
              await context.beforeDispatch();
              dispatched = true;
            }
            let data = await deps.execute(req, agent, name, args, context.signal, projectId);
            if (typeof data === 'string') {
              try {
                data = JSON.parse(data);
              } catch {
                /* Text is a valid builtin response. */
              }
            }
            const parsed = providerResult.safeParse(data);
            if (parsed.success && (parsed.data.ok === false || parsed.data.error !== undefined)) {
              const knownIds = integrationKnownEffectIds(parsed.data.effectIds);
              let status: 'failed' | 'partial' | 'ambiguous' = 'failed';
              if (dispatched) {
                status = knownIds ? 'partial' : 'ambiguous';
              }
              return {
                status,
                knownIds,
                effect: dispatched ? 'unknown' : 'not_dispatched',
                error: {
                  code: 'builtin_provider_failed',
                  message: 'Builtin provider could not complete the operation',
                },
              };
            }
            if (name === 'meta_ads_budget_manager') {
              // The chat tool's pause response contains a full Project document, including private config.
              if (action === 'pause_automation') {
                data = { ok: true, projectId, automationEnabled: false };
              } else {
                data = projectIntegrationBudgetOutput(data);
              }
            }
            return {
              status: 'completed',
              effect: dispatched ? 'completed' : 'not_dispatched',
              data,
              knownIds: writes ? integrationKnownEffectIds(data) : undefined,
            };
          } catch (error) {
            if (error instanceof IntegrationError) {
              throw error;
            }
            return {
              status: dispatched ? 'ambiguous' : 'failed',
              effect: dispatched ? 'unknown' : 'not_dispatched',
              error: { code: 'builtin_execution_failed', message: 'Builtin could not complete' },
            };
          }
        },
      } satisfies IntegrationToolAdapter,
    ];
  });
}

const budgetFields = new Set([
  'ok',
  'source',
  'id',
  '_id',
  'projectId',
  'adAccountId',
  'entityId',
  'entityName',
  'entityLevel',
  'campaignId',
  'campaignName',
  'campaignObjective',
  'adsetId',
  'adsetName',
  'adId',
  'adName',
  'level',
  'name',
  'status',
  'currentStatus',
  'proposedStatus',
  'action',
  'reason',
  'decisionReason',
  'ruleName',
  'ruleSourceType',
  'primaryMetric',
  'canAct',
  'automationRunId',
  'createdAt',
  'updatedAt',
  'startedAt',
  'finishedAt',
  'dailyBudget',
  'currentDailyBudget',
  'proposedDailyBudget',
  'previousDailyBudget',
  'newDailyBudget',
  'previousBudget',
  'deltaDailyBudget',
  'deltaPercent',
  'spend',
  'cpa',
  'roas',
  'conversionValue',
  'resultCount',
  'resultType',
  'configuredResultType',
  'resultTypeBreakdown',
  'totalSpend',
  'totalResults',
  'averageCostPerResult',
  'impressions',
  'reach',
  'frequency',
  'clicks',
  'ctr',
  'cpc',
  'cpm',
  'videoP75Watched',
  'videoP75Rate',
  'currency',
  'targetMetricValue',
  'evidenceSpend',
  'evidenceSpendThreshold',
  'evidenceSpendBasis',
  'evidenceMultiplier',
  'latestSnapshots',
  'recommendations',
  'recommendation',
  'change',
  'changes',
  'campaigns',
  'adsets',
  'ads',
  'period',
  'date',
  'datePreset',
  'since',
  'until',
  'monthlyBudget',
  'goalProgress',
  'summary',
  'trend',
  'month',
  'day',
  'investment',
  'result',
  'target',
  'actual',
  'remaining',
  'remainingDays',
  'elapsedDays',
  'daysInMonth',
  'limit',
  'projectedSpend',
  'projectedTotal',
  'progress',
  'progressPercent',
  'targetReached',
  'targetExceeded',
  'total',
  'count',
  'results',
  'costPerResult',
  'averageCpa',
  'averageRoas',
  'averageCtr',
  'averageCpc',
  'averageCpm',
  'run',
  'outcome',
  'mode',
  'evaluatedCount',
  'recommendationCount',
  'holdCount',
  'blockedCount',
  'appliedCount',
  'autoApplySummary',
  'messages',
  'message',
  'adjustedToMetaMinimumCount',
  'durationMs',
  'confirmation',
  'confirmed',
  'sourceEntityId',
  'duplicatedEntityId',
  'duplicatedEntityName',
  'updatedFields',
  'current',
  'configured_status',
  'effective_status',
  'daily_budget',
  'lifetime_budget',
  'budget_remaining',
  'account_id',
  'deleted',
  'adId',
  'creative',
  'creative_id',
  'objective',
  'buying_type',
  'billing_event',
  'optimization_goal',
  'start_time',
  'end_time',
]);
export function projectIntegrationBudgetOutput(value: unknown): object {
  let truncated = false;
  const project = (child: unknown, depth: number): unknown => {
    if (depth > 12) {
      truncated = true;
      return null;
    }
    if (child === null || typeof child === 'boolean' || typeof child === 'number') {
      return child;
    }
    if (typeof child === 'string') {
      if (child.length > 16000) {
        truncated = true;
      }
      return child.slice(0, 16000);
    }
    if (Array.isArray(child)) {
      if (child.length > 250) {
        truncated = true;
      }
      return child.slice(0, 250).map((item) => project(item, depth + 1));
    }
    if (!child || typeof child !== 'object') {
      return null;
    }
    const result: { [key: string]: unknown } = {};
    for (const [key, entry] of Object.entries(child)) {
      if (budgetFields.has(key)) {
        result[key] = project(entry, depth + 1);
      }
    }
    return result;
  };
  const data = project(value, 0) as object;
  return { ...data, projection: { truncated, maxRows: 250, maxTextChars: 16000, maxDepth: 12 } };
}

export function integrationKnownEffectIds(
  value: unknown,
): { [kind: string]: string[] } | undefined {
  if (!value || typeof value !== 'object') {
    return;
  }
  const ids: { [kind: string]: string[] } = {};
  for (const key of ['entityId', 'adId', 'duplicatedEntityId', 'sourceEntityId']) {
    const id = (value as { [key: string]: unknown })[key];
    if (typeof id === 'string' && /^[a-zA-Z0-9_-]{1,200}$/.test(id)) {
      ids[key] = [id];
    }
  }
  return Object.keys(ids).length ? ids : undefined;
}
