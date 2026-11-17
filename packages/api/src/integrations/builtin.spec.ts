import {
  integrationCalculator,
  integrationKnownEffectIds,
  projectIntegrationBudgetOutput,
} from './builtin';
it('builtin calculator executes actual registered implementation with strict input', async () => {
  const tool = integrationCalculator();
  expect(() => tool.validate!({ input: '1+2', extra: 'forged' })).toThrow();
  const result = await tool.execute!(tool.validate!({ input: '1+2' }), {
    signal: new AbortController().signal,
    beforeDispatch: async () => {
      throw new Error('Read must not dispatch write');
    },
  });
  expect(result).toMatchObject({ status: 'completed', effect: 'not_dispatched' });
  expect(String(result.data)).toBe('3');
});
it('budget projection preserves status/metrics/recommendation reasons and known IDs while excluding credentials and project internals', () => {
  const output = projectIntegrationBudgetOutput({
    ok: true,
    projectId: 'project-a',
    source: 'snapshot',
    currency: 'BRL',
    credentials: { accessToken: 'secret', tokenSecretName: 'private' },
    project: { metaAds: { accessToken: 'secret' } },
    tenantId: 'private-tenant',
    latestSnapshots: [
      {
        _id: 'snapshot-a',
        entityId: 'adset-a',
        spend: 120,
        resultCount: 4,
        cpa: 30,
        raw: { token: 'secret' },
        tenantId: 'private-tenant',
      },
    ],
    campaigns: [
      {
        id: 'campaign-a',
        name: 'Campaign',
        spend: 120,
        impressions: 1000,
        clicks: 20,
        status: 'ACTIVE',
      },
    ],
    recommendations: [
      {
        _id: 'recommendation-a',
        entityId: 'adset-a',
        action: 'increase',
        currentDailyBudget: 30,
        proposedDailyBudget: 35,
        reason: 'CPA below target',
        canAct: true,
      },
    ],
    summary: { spend: 120, resultCount: 4 },
    period: { since: '2026-11-01', until: '2026-11-07' },
    run: { id: 'run-a', status: 'completed', evaluatedCount: 3, recommendationCount: 1 },
    confirmation: { confirmed: true, entityId: 'created-a' },
    entityId: 'created-a',
  });
  expect(output).toMatchObject({
    ok: true,
    projectId: 'project-a',
    currency: 'BRL',
    latestSnapshots: [{ entityId: 'adset-a', spend: 120, resultCount: 4, cpa: 30 }],
    campaigns: [{ id: 'campaign-a', spend: 120 }],
    recommendations: [
      { _id: 'recommendation-a', reason: 'CPA below target', proposedDailyBudget: 35 },
    ],
    run: { id: 'run-a', evaluatedCount: 3 },
    confirmation: { entityId: 'created-a' },
    projection: { truncated: false },
  });
  expect(JSON.stringify(output)).not.toMatch(
    /secret|private-tenant|credentials|tokenSecretName|metaAds|"raw"/,
  );
  expect(integrationKnownEffectIds(output)).toEqual({ entityId: ['created-a'] });
});
it('budget bounds announce truncation and only explicitly known effect IDs survive', () => {
  const output = projectIntegrationBudgetOutput({
    recommendations: Array.from({ length: 251 }, () => ({ reason: 'x'.repeat(16001) })),
  });
  expect(output).toMatchObject({
    projection: { truncated: true, maxRows: 250, maxTextChars: 16000 },
  });
  expect((output as { recommendations: object[] }).recommendations).toHaveLength(250);
  expect(
    integrationKnownEffectIds({
      entityId: '900',
      adId: '55',
      duplicatedEntityId: '901',
      sourceEntityId: '54',
      accessToken: 'must-not-survive',
    }),
  ).toEqual({
    entityId: ['900'],
    adId: ['55'],
    duplicatedEntityId: ['901'],
    sourceEntityId: ['54'],
  });
  expect(
    integrationKnownEffectIds({ entityId: 'bad/value', accessToken: 'secret' }),
  ).toBeUndefined();
});
