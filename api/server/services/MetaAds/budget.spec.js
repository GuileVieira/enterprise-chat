const {
  DEFAULT_RULES,
  normalizeAdAccountId,
  proposeBudget,
  getEffectiveRules,
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

  it('uses ad set rule overrides before campaign and project rules', () => {
    const projectRules = {
      ...DEFAULT_RULES,
      targetCpa: 45,
      maxDailyBudget: 500,
    };
    const campaignRules = {
      targetCpa: 60,
      maxDailyBudget: 800,
    };
    const adsetRules = {
      targetCpa: 30,
    };

    expect(
      getEffectiveRules({
        projectRules,
        ruleOverrides: [
          {
            entityLevel: 'campaign',
            entityId: 'campaign-1',
            enabled: true,
            rules: campaignRules,
          },
          {
            entityLevel: 'adset',
            entityId: 'adset-1',
            enabled: true,
            rules: adsetRules,
          },
        ],
        campaignId: 'campaign-1',
        adsetId: 'adset-1',
      }),
    ).toEqual(
      expect.objectContaining({
        targetCpa: 30,
        maxDailyBudget: 800,
      }),
    );
  });
});

describe('Meta Ads budget service persistence safety', () => {
  const loadBudgetWithMocks = ({
    recommendation,
    project,
    latestBudget,
    insights = [],
    adsets = [],
    snapshots = [],
    recommendations = [],
    changes = [],
  } = {}) => {
    jest.resetModules();

    const findRecommendationLean = jest.fn(async () => recommendation);
    const findById = jest.fn(() => ({ lean: findRecommendationLean }));
    const findByIdAndUpdate = jest.fn(async (_id, update) => ({
      ...recommendation,
      ...update,
    }));
    const updateMany = jest.fn(async () => ({ modifiedCount: 1 }));
    const createRecommendation = jest.fn(async (payload) => ({
      _id: 'new-rec',
      ...payload,
      toObject: () => ({ _id: 'new-rec', ...payload }),
    }));
    const createSnapshot = jest.fn(async (payload) => payload);
    const createChange = jest.fn(async (payload) => payload);
    const findChangeOne = jest.fn(() => ({ lean: async () => null }));
    const makeFindChain = jest.fn((query) => ({
      sort: () => ({
        limit: () => ({
          lean: async () => {
            if (query?.__collection === 'snapshots') {
              return snapshots;
            }
            if (query?.__collection === 'recommendations') {
              return recommendations;
            }
            if (query?.__collection === 'changes') {
              return changes;
            }
            return [];
          },
        }),
      }),
    }));
    const findSnapshots = jest.fn((query) =>
      makeFindChain({ ...query, __collection: 'snapshots' }),
    );
    const findRecommendations = jest.fn((query) =>
      makeFindChain({ ...query, __collection: 'recommendations' }),
    );
    const findChanges = jest.fn((query) => makeFindChain({ ...query, __collection: 'changes' }));

    jest.doMock('mongoose', () => ({
      models: {
        MetaAdsSnapshot: {
          schema: {},
          create: createSnapshot,
          find: findSnapshots,
        },
        MetaAdsRecommendation: {
          schema: {},
          create: createRecommendation,
          find: findRecommendations,
          findById,
          findByIdAndUpdate,
          updateMany,
        },
        MetaAdsBudgetChange: {
          schema: {},
          create: createChange,
          find: findChanges,
          findOne: findChangeOne,
        },
      },
      Schema: function Schema() {},
      model: jest.fn(),
    }));

    const getProjectById = jest.fn(async () => project);
    const findProjectById = jest.fn(async () => project);
    const getTenantSecret = jest.fn(async () => ({ value: 'meta-token' }));

    jest.doMock('~/models', () => ({
      getProjectById,
      findProjectById,
      getTenantSecret,
    }));
    jest.doMock('@librechat/data-schemas', () => ({
      logger: {
        debug: jest.fn(),
        error: jest.fn(),
      },
      runAsSystem: (fn) => fn(),
      getTenantId: () => 'fallback-tenant',
    }));
    jest.doMock('~/server/services/Config/app', () => ({
      getAppConfig: jest.fn(async () => ({ interfaceConfig: { metaAds: true } })),
    }));

    const metaPost = jest.fn(async () => ({}));
    const getAdSetDailyBudget = jest.fn(async () => latestBudget);
    const listCampaigns = jest.fn(async () => []);
    const listAdSets = jest.fn(async () => adsets);
    const listAdSetInsights = jest.fn(async () => insights);

    jest.doMock('~/server/services/MetaAds/graph', () => ({
      getMetaGraphVersion: (value) => value || 'v25.0',
      getAdSetDailyBudget,
      listCampaigns,
      listAdSets,
      listAdSetInsights,
      metaPost,
    }));

    const budget = require('./budget');
    return {
      budget,
      createChange,
      createRecommendation,
      findByIdAndUpdate,
      getAdSetDailyBudget,
      makeFindChain,
      metaPost,
      updateMany,
    };
  };

  afterEach(() => {
    jest.resetModules();
    jest.dontMock('mongoose');
    jest.dontMock('~/models');
    jest.dontMock('@librechat/data-schemas');
    jest.dontMock('~/server/services/Config/app');
    jest.dontMock('~/server/services/MetaAds/graph');
  });

  it('rejects applying a recommendation from another tenant', async () => {
    const { budget, metaPost } = loadBudgetWithMocks({
      project: { projectId: 'p1', tenantId: 'tenant-a', metaAds: {} },
      recommendation: {
        _id: 'rec1',
        tenantId: 'tenant-a',
        projectId: 'p1',
        entityId: 'adset-1',
        action: 'increase',
        status: 'pending',
        currentDailyBudget: 100,
        proposedDailyBudget: 115,
      },
      latestBudget: 100,
    });

    await expect(
      budget.applyRecommendation({
        recommendationId: 'rec1',
        projectId: 'p1',
        tenantId: 'tenant-b',
        actor: 'user',
      }),
    ).rejects.toThrow('Recommendation does not belong to this tenant.');
    expect(metaPost).not.toHaveBeenCalled();
  });

  it('blocks stale recommendations when the Meta daily budget changed', async () => {
    const { budget, findByIdAndUpdate, metaPost } = loadBudgetWithMocks({
      project: { projectId: 'p1', tenantId: 'tenant-a', metaAds: {} },
      recommendation: {
        _id: 'rec1',
        tenantId: 'tenant-a',
        projectId: 'p1',
        entityId: 'adset-1',
        action: 'increase',
        status: 'pending',
        currentDailyBudget: 100,
        proposedDailyBudget: 115,
      },
      latestBudget: 130,
    });

    const result = await budget.applyRecommendation({
      recommendationId: 'rec1',
      projectId: 'p1',
      tenantId: 'tenant-a',
      actor: 'user',
    });

    expect(metaPost).not.toHaveBeenCalled();
    expect(findByIdAndUpdate).toHaveBeenCalledWith(
      'rec1',
      expect.objectContaining({
        action: 'hold',
        status: 'blocked',
      }),
      { new: true, lean: true },
    );
    expect(result.status).toBe('blocked');
  });

  it('queries Meta Ads status by project and tenant', async () => {
    const { budget, makeFindChain } = loadBudgetWithMocks({
      project: { projectId: 'p1', tenantId: 'tenant-a', metaAds: {} },
    });

    await budget.getProjectMetaAdsStatus('p1', 'request-tenant');

    expect(makeFindChain).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: 'p1', tenantId: 'tenant-a' }),
    );
  });

  it('returns campaigns grouped with active ad sets and pending recommendations', async () => {
    const { budget } = loadBudgetWithMocks({
      project: { projectId: 'p1', tenantId: 'tenant-a', metaAds: {} },
      snapshots: [
        {
          _id: 's1',
          projectId: 'p1',
          tenantId: 'tenant-a',
          entityId: 'adset-1',
          entityName: 'Topo',
          campaignId: 'campaign-1',
          campaignName: 'Messages Floripa',
          campaignObjective: 'OUTCOME_ENGAGEMENT',
          dailyBudget: 50,
          spend: 200,
          cpa: 20,
          resultCount: 10,
          resultType: 'onsite_conversion.messaging_conversation_started_7d',
          createdAt: '2026-06-03T12:00:00.000Z',
        },
      ],
      recommendations: [
        {
          _id: 'r1',
          entityId: 'adset-1',
          campaignId: 'campaign-1',
          action: 'increase',
          status: 'pending',
          proposedDailyBudget: 60,
          createdAt: '2026-06-03T12:05:00.000Z',
        },
      ],
    });

    const status = await budget.getProjectMetaAdsStatus('p1', 'request-tenant');

    expect(status.campaigns).toEqual([
      expect.objectContaining({
        campaignId: 'campaign-1',
        campaignName: 'Messages Floripa',
        objective: 'OUTCOME_ENGAGEMENT',
        spend: 200,
        resultCount: 10,
        adSets: [
          expect.objectContaining({
            entityId: 'adset-1',
            entityName: 'Topo',
            latestRecommendation: expect.objectContaining({
              action: 'increase',
              proposedDailyBudget: 60,
            }),
          }),
        ],
      }),
    ]);
  });

  it('uses only the latest snapshot per ad set when building campaign summaries', async () => {
    const { budget } = loadBudgetWithMocks({
      project: { projectId: 'p1', tenantId: 'tenant-a', metaAds: {} },
      snapshots: [
        {
          entityId: 'adset-1',
          entityName: 'Topo',
          campaignId: 'campaign-1',
          campaignName: 'Messages Floripa',
          spend: 100,
          resultCount: 2,
          createdAt: '2026-06-03T10:00:00.000Z',
        },
        {
          entityId: 'adset-1',
          entityName: 'Topo',
          campaignId: 'campaign-1',
          campaignName: 'Messages Floripa',
          spend: 200,
          resultCount: 4,
          createdAt: '2026-06-03T12:00:00.000Z',
        },
      ],
    });

    const status = await budget.getProjectMetaAdsStatus('p1', 'request-tenant');

    expect(status.campaigns[0]).toEqual(
      expect.objectContaining({
        spend: 200,
        resultCount: 4,
        adSets: [expect.objectContaining({ spend: 200 })],
      }),
    );
  });

  it('ignores older pending recommendations before creating a new one for an ad set', async () => {
    const { budget, updateMany } = loadBudgetWithMocks({
      project: {
        projectId: 'p1',
        tenantId: 'tenant-a',
        metaAds: {
          adAccountId: 'act_123',
          rules: {
            targetCpa: 45,
            minRoas: 2,
            maxIncreasePct: 15,
            maxDecreasePct: 20,
            minDailyBudget: 20,
            maxDailyBudget: 500,
            cooldownHours: 24,
            minSpend: 10,
          },
        },
      },
      adsets: [{ id: 'adset-1', name: 'Prospecting', daily_budget: '10000' }],
      insights: [
        {
          adset_id: 'adset-1',
          adset_name: 'Prospecting',
          spend: '200',
          actions: [{ action_type: 'purchase', value: '10' }],
          purchase_roas: [{ value: '3' }],
        },
      ],
    });

    await budget.analyzeProject({ projectId: 'p1', actor: 'cron', applyAuto: false });

    expect(updateMany).toHaveBeenCalledWith(
      {
        tenantId: 'tenant-a',
        projectId: 'p1',
        entityId: 'adset-1',
        status: 'pending',
      },
      {
        $set: {
          status: 'ignored',
        },
      },
    );
  });
});
