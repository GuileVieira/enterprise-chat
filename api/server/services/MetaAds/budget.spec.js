const {
  DEFAULT_RULES,
  normalizeAdAccountId,
  proposeBudget,
  resolveMetaAccessToken,
} = require('./budget');

describe('Meta Ads budget service', () => {
  it('holds when spend is below the minimum sample', () => {
    const result = proposeBudget({
      currentDailyBudget: 100,
      cpa: 10,
      roas: 5,
      spend: 1,
      rules: DEFAULT_RULES,
    });

    expect(result.action).toBe('hold');
    expect(result.proposedDailyBudget).toBe(100);
  });

  it('increases budget when CPA and ROAS are healthy', () => {
    const result = proposeBudget({
      currentDailyBudget: 100,
      cpa: 20,
      roas: 3,
      spend: 200,
      rules: DEFAULT_RULES,
    });

    expect(result.action).toBe('increase');
    expect(result.proposedDailyBudget).toBe(115);
  });

  it('decreases budget when performance is below rule', () => {
    const result = proposeBudget({
      currentDailyBudget: 100,
      cpa: 80,
      roas: 1,
      spend: 200,
      rules: DEFAULT_RULES,
    });

    expect(result.action).toBe('decrease');
    expect(result.proposedDailyBudget).toBe(80);
  });

  it('uses project token secret before tenant default', async () => {
    const getSecret = jest.fn(async () => ({ value: 'project-token' }));

    const result = await resolveMetaAccessToken({
      tenantId: 'tenant-x',
      metaAds: { tokenSecretName: 'meta_graph_access_token_project_p1' },
      getSecret,
    });

    expect(getSecret).toHaveBeenCalledWith('tenant-x', 'meta_graph_access_token_project_p1');
    expect(result).toEqual({
      accessToken: 'project-token',
      secretName: 'meta_graph_access_token_project_p1',
      source: 'project',
    });
  });

  it('falls back to tenant default when project token secret is empty', async () => {
    const getSecret = jest.fn(async () => ({ value: 'tenant-token' }));

    const result = await resolveMetaAccessToken({
      tenantId: 'tenant-x',
      metaAds: { tokenSecretName: '' },
      getSecret,
    });

    expect(getSecret).toHaveBeenCalledWith('tenant-x', 'meta_graph_access_token');
    expect(result).toEqual({
      accessToken: 'tenant-token',
      secretName: 'meta_graph_access_token',
      source: 'tenant',
    });
  });

  it('returns a clear error when the configured project secret is missing', async () => {
    const getSecret = jest.fn(async () => null);

    await expect(
      resolveMetaAccessToken({
        tenantId: 'tenant-x',
        metaAds: { tokenSecretName: 'missing-project-secret' },
        getSecret,
      }),
    ).rejects.toThrow('Meta access token not configured for project or tenant.');
  });

  it('normalizes numeric Meta account ids to act_ format', () => {
    expect(normalizeAdAccountId('123456789')).toBe('act_123456789');
    expect(normalizeAdAccountId('act_123456789')).toBe('act_123456789');
    expect(normalizeAdAccountId('act_123 456-789')).toBe('act_123456789');
  });
});
