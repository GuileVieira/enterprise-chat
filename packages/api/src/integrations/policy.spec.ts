import { assertIntegrationToolPolicy } from './policy';
import type { IAgent } from '@librechat/data-schemas';
import type { IntegrationRequest } from './contracts';
import { registerToolApprovalHook } from '~/agents/hitl/hooks';
const agent = { id: 'agent', tools: ['calculator'] } as IAgent;
const req = (policy: object): IntegrationRequest =>
  ({
    user: { id: 'owner', tenantId: 'tenant' },
    integrationAuth: { tenantId: 'tenant' },
    config: { endpoints: { agents: { toolApproval: policy } } },
  }) as IntegrationRequest;
it('approval ask/deny and canonical aliases fail closed, automatic permitted policy stays callable', () => {
  expect(() =>
    assertIntegrationToolPolicy(
      req({ enabled: true, mode: 'bypass', deny: ['canonical'] }),
      agent,
      'legacy',
      ['canonical'],
    ),
  ).toThrow('blocked');
  expect(() =>
    assertIntegrationToolPolicy(req({ enabled: true, ask: ['calculator'] }), agent, 'calculator'),
  ).toThrow('interactive');
  expect(() =>
    assertIntegrationToolPolicy(req({ enabled: true, mode: 'bypass' }), agent, 'calculator'),
  ).not.toThrow();
});
it('code-only caller does not become direct headless and matching host hook cannot be bypassed', () => {
  expect(() =>
    assertIntegrationToolPolicy(
      req({ enabled: false }),
      { ...agent, tool_options: { calculator: { allowed_callers: ['code_execution'] } } },
      'calculator',
    ),
  ).toThrow('programmatic');
  const dispose = registerToolApprovalHook(() => async () => ({}), { matcher: '^calculator$' });
  try {
    expect(() => assertIntegrationToolPolicy(req({ enabled: false }), agent, 'calculator')).toThrow(
      'interactive',
    );
  } finally {
    dispose();
  }
});
