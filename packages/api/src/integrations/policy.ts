import { normalizeMCPToolKey } from 'librechat-data-provider';
import type { IAgent } from '@librechat/data-schemas';
import type { IntegrationRequest } from './contracts';
import { getPluginHookSource } from '~/agents/hooks/source';
import { buildToolApprovalHooks, resolvedToolApprovalHooksCanMatch } from '~/agents/hitl/hooks';
import {
  resolveToolApprovalPolicy,
  isToolDeniedByApprovalPolicy,
  isToolApprovalPauseCapable,
} from '~/agents/hitl/policy';
import { IntegrationError } from './contracts';

/** A headless request cannot satisfy a review or run chat-scoped hook lifecycles. */
export function assertIntegrationToolPolicy(
  req: IntegrationRequest,
  agent: IAgent,
  name: string,
  aliases: string[] = [],
): void {
  for (const candidate of [name, ...aliases]) {
    const options = agent.tool_options?.[candidate];
    if (options?.allowed_callers?.length && !options.allowed_callers.includes('direct')) {
      throw new IntegrationError(
        409,
        'direct_execution_disabled',
        'Tool only supports programmatic invocation',
      );
    }
  }
  const policy = resolveToolApprovalPolicy({
    endpoint: req.config?.endpoints?.agents?.toolApproval,
  });
  const names = [...new Set([name, normalizeMCPToolKey(name, []), ...aliases])];
  const hooks = buildToolApprovalHooks({
    userId: req.user.id,
    tenantId: req.integrationAuth?.tenantId,
    appConfig: req.config,
  });
  const plugin = getPluginHookSource();
  if (names.some((candidate) => isToolDeniedByApprovalPolicy(policy, candidate))) {
    throw new IntegrationError(403, 'tool_policy_denied', 'Tool blocked by approval policy');
  }
  const matches =
    resolvedToolApprovalHooksCanMatch(hooks, names, agent.id) ||
    plugin?.hasToolApprovalHooks?.(names) === true;
  if (isToolApprovalPauseCapable(policy, matches, names) || matches) {
    throw new IntegrationError(
      409,
      'approval_lifecycle_required',
      'Tool requires an interactive approval lifecycle',
    );
  }
}
