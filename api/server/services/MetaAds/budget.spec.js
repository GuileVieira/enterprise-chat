const {
  DEFAULT_RULES,
  normalizeAdAccountId,
  proposeBudget,
  getScheduleIntervalMinutes,
  getProjectTenantId,
  withImplicitProjectTokenSecret,
  getProjectMetaTokenSecretName,
  isProjectDueForMetaAdsRun,
  resolveMetaAccessToken,
  resolveMetaCredentialStatus,
} = require('./budget');

describe('Meta Ads budget service', () => {
  beforeEach(() => {
    delete process.env.META_GRAPH_API_VERSION;
  });

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

  it('falls back to tenant default when the configured project secret is missing', async () => {
    const getSecret = jest.fn(async (_tenantId, secretName) =>
      secretName === 'meta_graph_access_token' ? { value: 'tenant-token' } : null,
    );

    const result = await resolveMetaAccessToken({
      tenantId: 'tenant-x',
      metaAds: { tokenSecretName: 'missing-project-secret' },
      getSecret,
    });

    expect(getSecret).toHaveBeenCalledWith('tenant-x', 'missing-project-secret');
    expect(getSecret).toHaveBeenCalledWith('tenant-x', 'meta_graph_access_token');
    expect(result).toEqual({
      accessToken: 'tenant-token',
      secretName: 'meta_graph_access_token',
      source: 'tenant',
    });
  });

  it('returns a clear error when project and tenant secrets are missing', async () => {
    const getSecret = jest.fn(async () => null);

    await expect(
      resolveMetaAccessToken({
        tenantId: 'tenant-x',
        metaAds: { tokenSecretName: 'missing-project-secret' },
        getSecret,
      }),
    ).rejects.toThrow('Meta access token not configured for project or tenant.');
  });

  it('reports masked tenant credential status without exposing the token', async () => {
    const getSecret = jest.fn(async () => ({ value: 'tenant-token' }));

    const result = await resolveMetaCredentialStatus({
      tenantId: 'tenant-x',
      metaAds: { tokenSecretName: '' },
      getSecret,
    });

    expect(getSecret).toHaveBeenCalledWith('tenant-x', 'meta_graph_access_token');
    expect(result).toEqual({
      effectiveSource: 'tenant',
      projectConfigured: false,
      tenantConfigured: true,
      secretName: 'meta_graph_access_token',
    });
  });

  it('reports missing project credential status while still checking tenant fallback', async () => {
    const getSecret = jest.fn(async () => null);

    const result = await resolveMetaCredentialStatus({
      tenantId: 'tenant-x',
      metaAds: { tokenSecretName: 'missing-project-secret' },
      getSecret,
    });

    expect(getSecret).toHaveBeenCalledWith('tenant-x', 'missing-project-secret');
    expect(getSecret).toHaveBeenCalledWith('tenant-x', 'meta_graph_access_token');
    expect(result).toEqual({
      effectiveSource: 'missing',
      projectConfigured: false,
      tenantConfigured: false,
      secretName: 'missing-project-secret',
    });
  });

  it('reports project credential status when project and tenant tokens exist', async () => {
    const getSecret = jest.fn(async (_tenantId, secretName) => ({
      value: `${secretName}-value`,
    }));

    const result = await resolveMetaCredentialStatus({
      tenantId: 'tenant-x',
      metaAds: { tokenSecretName: 'meta_graph_access_token_project_p1' },
      getSecret,
    });

    expect(result).toEqual({
      effectiveSource: 'project',
      projectConfigured: true,
      tenantConfigured: true,
      secretName: 'meta_graph_access_token_project_p1',
    });
  });

  it('uses request tenant fallback for legacy projects without tenantId', () => {
    expect(getProjectTenantId({ projectId: 'legacy-project' }, 'orqest-admin')).toBe(
      'orqest-admin',
    );
    expect(
      getProjectTenantId({ projectId: 'tenant-project', tenantId: 'tenant-x' }, 'fallback'),
    ).toBe('tenant-x');
  });

  it('infers the generated project token secret when legacy project metaAds has no reference', () => {
    expect(getProjectMetaTokenSecretName('p1')).toBe('meta_graph_access_token_project_p1');
    expect(withImplicitProjectTokenSecret('p1', { adAccountId: 'act_123' })).toEqual({
      adAccountId: 'act_123',
      tokenSecretName: 'meta_graph_access_token_project_p1',
    });
    expect(
      withImplicitProjectTokenSecret('p1', { tokenSecretName: 'custom-project-secret' }),
    ).toEqual({
      tokenSecretName: 'custom-project-secret',
    });
  });

  it('normalizes numeric Meta account ids to act_ format', () => {
    expect(normalizeAdAccountId('123456789')).toBe('act_123456789');
    expect(normalizeAdAccountId('act_123456789')).toBe('act_123456789');
    expect(normalizeAdAccountId('act_123 456-789')).toBe('act_123456789');
  });

  it('defaults project cron interval to 180 minutes and respects due windows', () => {
    const now = new Date('2026-06-02T12:00:00.000Z');

    expect(getScheduleIntervalMinutes({})).toBe(180);
    expect(
      isProjectDueForMetaAdsRun({ metaAds: { lastRunAt: '2026-06-02T09:00:00.000Z' } }, now),
    ).toBe(true);
    expect(
      isProjectDueForMetaAdsRun(
        { metaAds: { scheduleIntervalMinutes: 180, lastRunAt: '2026-06-02T10:00:00.000Z' } },
        now,
      ),
    ).toBe(false);
    expect(
      isProjectDueForMetaAdsRun(
        { metaAds: { scheduleIntervalMinutes: 30, lastRunAt: '2026-06-02T11:30:00.000Z' } },
        now,
      ),
    ).toBe(true);
  });
});
