const {
  DEFAULT_RULES,
  normalizeAdAccountId,
  proposeBudget,
  getEffectiveRules,
  detectBudgetMode,
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
    expect(result.proposedDailyBudget).toBe(125);
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
    expect(result.proposedDailyBudget).toBe(75);
  });

  it('creates a creative alert instead of increasing when frequency is high', () => {
    const result = proposeBudget({
      currentDailyBudget: 100,
      cpa: 20,
      roas: 3,
      spend: 200,
      frequency: 5.4,
      rules: DEFAULT_RULES,
      creativeRules: { maxFrequency: 5 },
    });

    expect(result.action).toBe('hold');
    expect(result.proposedDailyBudget).toBe(100);
    expect(result.reason).toContain('Frequência 5.40 acima do limite 5.00');
  });

  it('still decreases budget when performance is bad and frequency is high', () => {
    const result = proposeBudget({
      currentDailyBudget: 100,
      cpa: 80,
      roas: 1,
      spend: 200,
      frequency: 5.4,
      rules: DEFAULT_RULES,
      creativeRules: { maxFrequency: 5 },
    });

    expect(result.action).toBe('decrease');
    expect(result.proposedDailyBudget).toBe(75);
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

  it('uses rule groups before project rules and after direct overrides', () => {
    const projectRules = { ...DEFAULT_RULES, targetCpa: 80, maxDailyBudget: 500 };
    const ruleGroups = [
      {
        id: 'group-1',
        name: 'Floripa',
        entityLevel: 'campaign',
        entityIds: ['campaign-1'],
        enabled: true,
        rules: { targetCpa: 60, maxDailyBudget: 900 },
      },
    ];

    expect(
      getEffectiveRules({
        projectRules,
        ruleGroups,
        ruleOverrides: [],
        campaignId: 'campaign-1',
        adsetId: 'adset-1',
      }),
    ).toEqual(expect.objectContaining({ targetCpa: 60, maxDailyBudget: 900 }));

    expect(
      getEffectiveRules({
        projectRules,
        ruleGroups,
        ruleOverrides: [
          {
            entityLevel: 'adset',
            entityId: 'adset-1',
            enabled: true,
            rules: { targetCpa: 35 },
          },
        ],
        campaignId: 'campaign-1',
        adsetId: 'adset-1',
      }),
    ).toEqual(expect.objectContaining({ targetCpa: 35, maxDailyBudget: 900 }));
  });

  it('detects CBO when campaign has budget and ABO when ad sets carry budget', () => {
    expect(
      detectBudgetMode({
        campaign: { id: 'campaign-1', daily_budget: '7000' },
        adsets: [{ id: 'adset-1', daily_budget: '0' }],
      }),
    ).toEqual({ budgetLevel: 'campaign', editableBudgetLevel: 'campaign', budgetMode: 'CBO' });

    expect(
      detectBudgetMode({
        campaign: { id: 'campaign-1' },
        adsets: [{ id: 'adset-1', daily_budget: '5000' }],
      }),
    ).toEqual({ budgetLevel: 'adset', editableBudgetLevel: 'adset', budgetMode: 'ABO' });
  });
});

describe('Meta Ads budget service persistence safety', () => {
  const deferred = () => {
    let resolve;
    let reject;
    const promise = new Promise((promiseResolve, promiseReject) => {
      resolve = promiseResolve;
      reject = promiseReject;
    });
    return { promise, resolve, reject };
  };

  const loadBudgetWithMocks = ({
    recommendation,
    project,
    latestBudget,
    latestEntityBudget,
    insights = [],
    ads = [],
    adInsights = [],
    campaigns = [],
    adsets = [],
    snapshots = [],
    recommendations = [],
    changes = [],
    projects = [],
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
    const projectFind = jest.fn(() => ({ lean: async () => projects }));
    const projectUpdateOne = jest.fn(async () => ({ modifiedCount: 1 }));

    jest.doMock('mongoose', () => ({
      models: {
        Project: {
          find: projectFind,
          updateOne: projectUpdateOne,
        },
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
    const findProjectById = jest.fn(async (projectId) => {
      if (project) {
        return project;
      }
      return projects.find((item) => item.projectId === projectId) ?? null;
    });
    getProjectById.mockImplementation(async (projectId) => {
      if (project) {
        return project;
      }
      return projects.find((item) => item.projectId === projectId) ?? null;
    });
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
        info: jest.fn(),
      },
      runAsSystem: (fn) => fn(),
      getTenantId: () => 'fallback-tenant',
    }));
    jest.doMock('~/server/services/Config/app', () => ({
      getAppConfig: jest.fn(async () => ({ interfaceConfig: { metaAds: true } })),
    }));

    const metaPost = jest.fn(async () => ({}));
    const getAdSetDailyBudget = jest.fn(async () => latestBudget);
    const getEntityDailyBudget = jest.fn(async () => latestEntityBudget);
    const getAdAccountCurrency = jest.fn(async () => 'BRL');
    const listCampaigns = jest.fn(async () => campaigns);
    const listAdSets = jest.fn(async () => adsets);
    const listAds = jest.fn(async () => ads);
    const listAdInsights = jest.fn(async () => adInsights);
    const listAdSetInsights = jest.fn(async () => insights);

    jest.doMock('~/server/services/MetaAds/graph', () => ({
      getMetaGraphVersion: (value) => value || 'v25.0',
      isSupportedMetaGraphVersion: (value) => /^v(2[4-9]|\d{3,})\.0$/.test(value),
      getAdSetDailyBudget,
      getEntityDailyBudget,
      getAdAccountCurrency,
      listCampaigns,
      listAds,
      listAdInsights,
      listAdSets,
      listAdSetInsights,
      metaPost,
    }));

    const budget = require('./budget');
    return {
      budget,
      createChange,
      createRecommendation,
      createSnapshot,
      findByIdAndUpdate,
      getAdSetDailyBudget,
      getEntityDailyBudget,
      getAdAccountCurrency,
      listAdInsights,
      listAds,
      listCampaigns,
      listAdSets,
      listAdSetInsights,
      makeFindChain,
      metaPost,
      projectFind,
      projectUpdateOne,
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
      project: { projectId: 'p1', tenantId: 'tenant-a', metaAds: { adAccountId: 'act_123' } },
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
      project: { projectId: 'p1', tenantId: 'tenant-a', metaAds: { adAccountId: 'act_123' } },
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
      project: { projectId: 'p1', tenantId: 'tenant-a', metaAds: { adAccountId: 'act_123' } },
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

  it('returns period and summary metrics for the campaign dashboard', async () => {
    const { budget } = loadBudgetWithMocks({
      project: { projectId: 'p1', tenantId: 'tenant-a', metaAds: {} },
      snapshots: [
        {
          entityId: 'adset-1',
          entityName: 'Topo',
          campaignId: 'campaign-1',
          campaignName: 'Messages Floripa',
          spend: 200,
          cpa: 20,
          resultCount: 10,
          frequency: 2,
          createdAt: '2026-06-03T12:00:00.000Z',
        },
        {
          entityId: 'adset-2',
          entityName: 'Retarget',
          campaignId: 'campaign-2',
          campaignName: 'Sales SP',
          spend: 100,
          cpa: 50,
          resultCount: 2,
          frequency: 4,
          createdAt: '2026-06-03T12:00:00.000Z',
        },
      ],
    });

    const status = await budget.getProjectMetaAdsStatus('p1', 'request-tenant', {
      datePreset: 'last_7d',
    });

    expect(status.period).toEqual({ datePreset: 'last_7d' });
    expect(status.summary).toEqual({
      totalSpend: 300,
      totalResults: 12,
      averageCostPerResult: 25,
      averageFrequency: 3,
      bestCampaignByCost: expect.objectContaining({ campaignId: 'campaign-1' }),
      worstCampaignByCost: expect.objectContaining({ campaignId: 'campaign-2' }),
    });
  });

  it('attaches live ads with creative previews and metrics to their ad sets', async () => {
    const { budget } = loadBudgetWithMocks({
      project: {
        projectId: 'p1',
        tenantId: 'tenant-a',
        metaAds: { adAccountId: 'act_123' },
      },
      campaigns: [
        {
          id: 'campaign-1',
          name: 'Messages Floripa',
          objective: 'OUTCOME_ENGAGEMENT',
          effective_status: 'ACTIVE',
        },
      ],
      adsets: [
        {
          id: 'adset-1',
          name: 'Topo',
          campaign_id: 'campaign-1',
          effective_status: 'ACTIVE',
          daily_budget: '5000',
        },
      ],
      insights: [
        {
          adset_id: 'adset-1',
          adset_name: 'Topo',
          campaign_id: 'campaign-1',
          campaign_name: 'Messages Floripa',
          spend: '120',
          actions: [{ action_type: 'lead', value: '6' }],
        },
      ],
      ads: [
        {
          id: 'ad-1',
          name: 'Lead form video',
          effective_status: 'ACTIVE',
          adset_id: 'adset-1',
          campaign_id: 'campaign-1',
          creative: {
            id: 'creative-1',
            title: 'Reserve a visit',
            body: 'See available units today.',
            thumbnail_url: 'https://example.com/thumb.jpg',
            image_url: 'https://example.com/image.jpg',
            object_story_spec: {
              link_data: {
                description: 'Limited schedule',
                link: 'https://example.com/visit',
                call_to_action: { type: 'LEARN_MORE' },
              },
            },
          },
        },
      ],
      adInsights: [
        {
          ad_id: 'ad-1',
          ad_name: 'Lead form video',
          adset_id: 'adset-1',
          campaign_id: 'campaign-1',
          spend: '48',
          impressions: '1800',
          clicks: '72',
          ctr: '4',
          actions: [{ action_type: 'lead', value: '4' }],
          cost_per_action_type: [{ action_type: 'lead', value: '12' }],
        },
      ],
    });

    const status = await budget.getProjectMetaAdsStatus('p1', 'request-tenant', {
      datePreset: 'last_7d',
    });

    expect(status.campaigns?.[0]?.adSets?.[0]?.ads).toEqual([
      expect.objectContaining({
        adId: 'ad-1',
        adName: 'Lead form video',
        adSetId: 'adset-1',
        campaignId: 'campaign-1',
        creativeId: 'creative-1',
        title: 'Reserve a visit',
        body: 'See available units today.',
        description: 'Limited schedule',
        thumbnailUrl: 'https://example.com/thumb.jpg',
        imageUrl: 'https://example.com/image.jpg',
        linkUrl: 'https://example.com/visit',
        callToActionType: 'LEARN_MORE',
        spend: 48,
        resultCount: 4,
        cpa: 12,
        impressions: 1800,
        clicks: 72,
        ctr: 4,
      }),
    ]);
  });

  it('returns daily campaign trend and evolution deltas from historical snapshots', async () => {
    const { budget } = loadBudgetWithMocks({
      project: { projectId: 'p1', tenantId: 'tenant-a', metaAds: {} },
      snapshots: [
        {
          entityId: 'adset-1',
          entityName: 'Topo',
          campaignId: 'campaign-1',
          campaignName: 'Messages Floripa',
          dailyBudget: 50,
          spend: 100,
          cpa: 25,
          resultCount: 4,
          frequency: 2,
          createdAt: '2026-06-01T10:00:00.000Z',
        },
        {
          entityId: 'adset-1',
          entityName: 'Topo',
          campaignId: 'campaign-1',
          campaignName: 'Messages Floripa',
          dailyBudget: 60,
          spend: 180,
          cpa: 30,
          resultCount: 6,
          frequency: 3,
          createdAt: '2026-06-02T10:00:00.000Z',
        },
        {
          entityId: 'adset-2',
          entityName: 'Retarget',
          campaignId: 'campaign-1',
          campaignName: 'Messages Floripa',
          dailyBudget: 40,
          spend: 80,
          cpa: 20,
          resultCount: 4,
          frequency: 4,
          createdAt: '2026-06-02T11:00:00.000Z',
        },
        {
          entityId: 'adset-2',
          entityName: 'Retarget',
          campaignId: 'campaign-1',
          campaignName: 'Messages Floripa',
          dailyBudget: 40,
          spend: 90,
          cpa: 18,
          resultCount: 5,
          frequency: 4.5,
          createdAt: '2026-06-02T12:00:00.000Z',
        },
      ],
      changes: [
        {
          _id: 'change-1',
          entityId: 'adset-1',
          entityName: 'Topo',
          campaignId: 'campaign-1',
          campaignName: 'Messages Floripa',
          previousDailyBudget: 50,
          newDailyBudget: 60,
          deltaDailyBudget: 10,
          deltaPercent: 20,
          actor: 'cron',
          createdAt: '2026-06-02T09:00:00.000Z',
        },
      ],
    });

    const status = await budget.getProjectMetaAdsStatus('p1', 'request-tenant');

    expect(status.trend).toEqual({
      points: [
        expect.objectContaining({
          date: '2026-06-01',
          campaignId: 'campaign-1',
          campaignName: 'Messages Floripa',
          spend: 100,
          resultCount: 4,
          cpa: 25,
          dailyBudget: 50,
          frequency: 2,
        }),
        expect.objectContaining({
          date: '2026-06-02',
          campaignId: 'campaign-1',
          campaignName: 'Messages Floripa',
          spend: 270,
          resultCount: 11,
          cpa: 24.55,
          dailyBudget: 100,
          frequency: 4.5,
        }),
      ],
      campaignDeltas: [
        expect.objectContaining({
          campaignId: 'campaign-1',
          campaignName: 'Messages Floripa',
          spendDelta: 170,
          resultDelta: 7,
          cpaDelta: -0.45,
          budgetDelta: 50,
          latestChange: expect.objectContaining({
            entityId: 'adset-1',
            deltaDailyBudget: 10,
          }),
        }),
      ],
      changesByDay: [
        expect.objectContaining({
          date: '2026-06-02',
          totalDeltaDailyBudget: 10,
          changeCount: 1,
        }),
      ],
    });
  });

  it('builds status metrics from Meta insights for the selected period and returns currency', async () => {
    const { budget, getAdAccountCurrency, listAdSetInsights } = loadBudgetWithMocks({
      project: { projectId: 'p1', tenantId: 'tenant-a', metaAds: { adAccountId: 'act_123' } },
      snapshots: [
        {
          entityId: 'adset-old',
          entityName: 'Old',
          campaignId: 'campaign-old',
          campaignName: 'Old Campaign',
          spend: 999,
          resultCount: 99,
          createdAt: '2026-06-01T12:00:00.000Z',
        },
      ],
      campaigns: [{ id: 'campaign-1', name: 'Messages', objective: 'OUTCOME_ENGAGEMENT' }],
      adsets: [
        {
          id: 'adset-1',
          name: 'Audience real',
          daily_budget: '5000',
          campaign_id: 'campaign-1',
        },
      ],
      insights: [
        {
          campaign_id: 'campaign-1',
          campaign_name: 'Messages',
          adset_id: 'adset-1',
          adset_name: 'Audience real',
          spend: '85.76',
          actions: [
            {
              action_type: 'onsite_conversion.messaging_conversation_started_7d',
              value: '8',
            },
          ],
          cost_per_action_type: [
            {
              action_type: 'onsite_conversion.messaging_conversation_started_7d',
              value: '10.72',
            },
          ],
        },
      ],
    });

    const status = await budget.getProjectMetaAdsStatus('p1', 'request-tenant', {
      since: '2026-06-10',
      until: '2026-06-15',
    });

    expect(listAdSetInsights).toHaveBeenCalledWith(
      expect.objectContaining({ since: '2026-06-10', until: '2026-06-15' }),
    );
    expect(getAdAccountCurrency).toHaveBeenCalledWith(
      expect.objectContaining({ adAccountId: 'act_123' }),
    );
    expect(status.currency).toBe('BRL');
    expect(status.summary).toEqual(
      expect.objectContaining({
        totalSpend: 85.76,
        totalResults: 8,
        averageCostPerResult: 10.72,
      }),
    );
    expect(status.campaigns[0].adSets[0]).toEqual(
      expect.objectContaining({
        entityName: 'Audience real',
        resultCount: 8,
        cpa: 10.72,
      }),
    );
  });

  it('marks CBO campaigns as campaign-editable and ABO campaigns as adset-editable', async () => {
    const { budget, listCampaigns } = loadBudgetWithMocks({
      project: { projectId: 'p1', tenantId: 'tenant-a', metaAds: { adAccountId: 'act_123' } },
      snapshots: [
        {
          entityId: 'adset-cbo',
          entityName: 'CBO child',
          campaignId: 'campaign-cbo',
          campaignName: 'CBO Campaign',
          dailyBudget: 0,
          spend: 100,
          createdAt: '2026-06-03T12:00:00.000Z',
        },
        {
          entityId: 'adset-abo',
          entityName: 'ABO child',
          campaignId: 'campaign-abo',
          campaignName: 'ABO Campaign',
          dailyBudget: 50,
          spend: 80,
          createdAt: '2026-06-03T12:00:00.000Z',
        },
      ],
      campaigns: [
        { id: 'campaign-cbo', name: 'CBO Campaign', daily_budget: '7000' },
        { id: 'campaign-abo', name: 'ABO Campaign' },
      ],
    });

    const status = await budget.getProjectMetaAdsStatus('p1', 'request-tenant');

    expect(listCampaigns).toHaveBeenCalledWith(
      expect.objectContaining({ adAccountId: 'act_123', token: 'meta-token' }),
    );
    expect(status.campaigns).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          campaignId: 'campaign-cbo',
          budgetMode: 'CBO',
          editableBudgetLevel: 'campaign',
          dailyBudget: 70,
        }),
        expect.objectContaining({
          campaignId: 'campaign-abo',
          budgetMode: 'ABO',
          editableBudgetLevel: 'adset',
          dailyBudget: 50,
        }),
      ]),
    );
  });

  it('calculates message result cost and video 75 percent metrics from Meta insights', async () => {
    const { budget, createSnapshot } = loadBudgetWithMocks({
      project: {
        projectId: 'p1',
        tenantId: 'tenant-a',
        metaAds: { adAccountId: 'act_123', rules: { ...DEFAULT_RULES, targetCpa: 10 } },
      },
      campaigns: [{ id: 'campaign-1', name: 'Messages', objective: 'OUTCOME_ENGAGEMENT' }],
      adsets: [
        {
          id: 'adset-1',
          name: 'Messages set',
          daily_budget: '5000',
          campaign_id: 'campaign-1',
        },
      ],
      insights: [
        {
          campaign_id: 'campaign-1',
          campaign_name: 'Messages',
          adset_id: 'adset-1',
          adset_name: 'Messages set',
          spend: '120',
          impressions: '1000',
          clicks: '50',
          ctr: '5',
          cost_per_action_type: [
            {
              action_type: 'onsite_conversion.messaging_conversation_started_7d',
              value: '6',
            },
          ],
          actions: [
            {
              action_type: 'onsite_conversion.messaging_conversation_started_7d',
              value: '20',
            },
          ],
          video_p75_watched_actions: [{ value: '250' }],
        },
      ],
    });

    await budget.analyzeProject({ projectId: 'p1', actor: 'cron', applyAuto: false });

    expect(createSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        resultType: 'onsite_conversion.messaging_conversation_started_7d',
        resultCount: 20,
        cpa: 6,
        ctr: 5,
        videoP75Watched: 250,
      }),
    );
  });

  it('uses the insight ad set name when the ad set listing repeats the campaign name', async () => {
    const { budget, createRecommendation, createSnapshot } = loadBudgetWithMocks({
      project: {
        projectId: 'p1',
        tenantId: 'tenant-a',
        metaAds: { adAccountId: 'act_123', rules: { ...DEFAULT_RULES, targetCpa: 10 } },
      },
      campaigns: [{ id: 'campaign-1', name: 'FB/IG - REMARKETING', objective: 'OUTCOME_SALES' }],
      adsets: [
        {
          id: 'adset-1',
          name: 'FB/IG - REMARKETING',
          daily_budget: '5000',
          campaign_id: 'campaign-1',
        },
      ],
      insights: [
        {
          campaign_id: 'campaign-1',
          campaign_name: 'FB/IG - REMARKETING',
          adset_id: 'adset-1',
          adset_name: '25 65+ ARTES',
          spend: '120',
          actions: [{ action_type: 'purchase', value: '20' }],
          purchase_roas: [{ value: '3' }],
        },
      ],
    });

    await budget.analyzeProject({ projectId: 'p1', actor: 'cron', applyAuto: false });

    expect(createSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({ entityName: '25 65+ ARTES' }),
    );
    expect(createRecommendation).toHaveBeenCalledWith(
      expect.objectContaining({ entityName: '25 65+ ARTES' }),
    );
  });

  it('applies a manual campaign budget update and records the change', async () => {
    const { budget, createChange, metaPost } = loadBudgetWithMocks({
      project: {
        projectId: 'p1',
        tenantId: 'tenant-a',
        metaAds: { tokenSecretName: 'secret', rules: { ...DEFAULT_RULES, maxDailyBudget: 500 } },
      },
      latestEntityBudget: { dailyBudget: 70 },
    });

    const result = await budget.applyManualBudgetChange({
      projectId: 'p1',
      tenantId: 'tenant-a',
      entityLevel: 'campaign',
      entityId: 'campaign-1',
      entityName: 'CBO Campaign',
      dailyBudget: 100,
      actor: 'user',
      actorUserId: 'u1',
      reason: 'Manual scale',
    });

    expect(metaPost).toHaveBeenCalledWith(
      expect.objectContaining({
        path: 'campaign-1',
        body: { daily_budget: 10000 },
      }),
    );
    expect(createChange).toHaveBeenCalledWith(
      expect.objectContaining({
        entityLevel: 'campaign',
        entityId: 'campaign-1',
        previousDailyBudget: 70,
        newDailyBudget: 100,
        deltaDailyBudget: 30,
        deltaPercent: 42.86,
        reason: 'Manual scale',
      }),
    );
    expect(result.change).toEqual(expect.objectContaining({ newDailyBudget: 100 }));
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

  it('recovers ad set names from raw insights when old snapshots stored the campaign name', async () => {
    const { budget } = loadBudgetWithMocks({
      project: { projectId: 'p1', tenantId: 'tenant-a', metaAds: {} },
      snapshots: [
        {
          entityId: 'adset-1',
          entityName: 'FB/IG - REMARKETING',
          campaignId: 'campaign-1',
          campaignName: 'FB/IG - REMARKETING',
          spend: 200,
          resultCount: 4,
          raw: {
            adset_name: '25 65+ ARTES',
          },
          createdAt: '2026-06-03T12:00:00.000Z',
        },
      ],
    });

    const status = await budget.getProjectMetaAdsStatus('p1', 'request-tenant');

    expect(status.campaigns[0].adSets[0]).toEqual(
      expect.objectContaining({ entityName: '25 65+ ARTES' }),
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

  it('creates CBO recommendations at campaign level and ABO recommendations at ad set level', async () => {
    const { budget, createRecommendation } = loadBudgetWithMocks({
      project: {
        projectId: 'p1',
        tenantId: 'tenant-a',
        metaAds: {
          adAccountId: 'act_123',
          rules: { ...DEFAULT_RULES },
        },
      },
      campaigns: [
        { id: 'campaign-cbo', name: 'CBO Campaign', daily_budget: '10000' },
        { id: 'campaign-abo', name: 'ABO Campaign' },
      ],
      adsets: [
        { id: 'adset-cbo', name: 'CBO Child', campaign_id: 'campaign-cbo', daily_budget: '0' },
        { id: 'adset-abo', name: 'ABO Child', campaign_id: 'campaign-abo', daily_budget: '7000' },
      ],
      insights: [
        {
          campaign_id: 'campaign-cbo',
          campaign_name: 'CBO Campaign',
          adset_id: 'adset-cbo',
          adset_name: 'CBO Child',
          spend: '200',
          actions: [{ action_type: 'purchase', value: '10' }],
          purchase_roas: [{ value: '3' }],
        },
        {
          campaign_id: 'campaign-abo',
          campaign_name: 'ABO Campaign',
          adset_id: 'adset-abo',
          adset_name: 'ABO Child',
          spend: '200',
          actions: [{ action_type: 'purchase', value: '10' }],
          purchase_roas: [{ value: '3' }],
        },
      ],
    });

    await budget.analyzeProject({ projectId: 'p1', actor: 'cron', applyAuto: false });

    expect(createRecommendation).toHaveBeenCalledWith(
      expect.objectContaining({
        entityLevel: 'campaign',
        entityId: 'campaign-cbo',
        entityName: 'CBO Campaign',
        currentDailyBudget: 100,
        proposedDailyBudget: 125,
      }),
    );
    expect(createRecommendation).toHaveBeenCalledWith(
      expect.objectContaining({
        entityLevel: 'adset',
        entityId: 'adset-abo',
        entityName: 'ABO Child',
        currentDailyBudget: 70,
        proposedDailyBudget: 87.5,
      }),
    );
  });

  it('fails a slow project by timeout and continues the cron run', async () => {
    jest.useFakeTimers();
    const { budget, listAdSets, projectUpdateOne } = loadBudgetWithMocks({
      project: {
        projectId: 'slow-project',
        tenantId: 'tenant-a',
        metaAds: { adAccountId: 'act_123' },
      },
      projects: [
        {
          projectId: 'slow-project',
          tenantId: 'tenant-a',
          metaAds: { enabled: true, adAccountId: 'act_123' },
        },
        {
          projectId: 'not-due-project',
          tenantId: 'tenant-a',
          metaAds: {
            enabled: true,
            adAccountId: 'act_456',
            lastRunAt: new Date(),
            scheduleIntervalMinutes: 180,
          },
        },
      ],
    });
    listAdSets.mockImplementationOnce(
      () =>
        new Promise(() => {
          // pending Meta request
        }),
    );

    const run = budget.runCron({ projectTimeoutMs: 25 });
    await jest.advanceTimersByTimeAsync(25);
    const results = await run;

    expect(results).toEqual([
      {
        projectId: 'slow-project',
        ok: false,
        error: 'Meta Ads project slow-project timed out after 25ms.',
      },
      { projectId: 'not-due-project', ok: true, skipped: true, reason: 'not_due' },
    ]);
    expect(projectUpdateOne).not.toHaveBeenCalled();
    jest.useRealTimers();
  });

  it('runs due projects with bounded concurrency so one slow project does not block another', async () => {
    jest.useFakeTimers();
    const slowAdSets = deferred();
    const { budget, listAdSets, projectUpdateOne } = loadBudgetWithMocks({
      projects: [
        {
          projectId: 'slow-project',
          tenantId: 'tenant-a',
          metaAds: { enabled: true, adAccountId: 'act_123' },
        },
        {
          projectId: 'fast-project',
          tenantId: 'tenant-a',
          metaAds: { enabled: true, adAccountId: 'act_456' },
        },
      ],
      adsets: [],
      insights: [],
    });
    listAdSets.mockImplementation(({ adAccountId }) => {
      if (adAccountId === 'act_123') {
        return slowAdSets.promise;
      }
      return Promise.resolve([]);
    });

    const run = budget.runCron({
      projectConcurrency: 2,
      projectTimeoutMs: 100,
    });
    await jest.advanceTimersByTimeAsync(50);

    expect(projectUpdateOne).toHaveBeenCalledWith(
      { projectId: 'fast-project' },
      { $set: { 'metaAds.lastRunAt': expect.any(Date) } },
    );

    await jest.advanceTimersByTimeAsync(50);
    const results = await run;

    expect(results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ projectId: 'fast-project', adAccountId: 'act_456' }),
        expect.objectContaining({ projectId: 'slow-project', ok: false }),
      ]),
    );
    jest.useRealTimers();
  });

  it('starts independent Meta reads for a project in parallel', async () => {
    const campaigns = deferred();
    const adsets = deferred();
    const insights = deferred();
    const { budget, listCampaigns, listAdSets, listAdSetInsights } = loadBudgetWithMocks({
      project: {
        projectId: 'p1',
        tenantId: 'tenant-a',
        metaAds: { adAccountId: 'act_123' },
      },
    });
    listCampaigns.mockReturnValueOnce(campaigns.promise);
    listAdSets.mockReturnValueOnce(adsets.promise);
    listAdSetInsights.mockReturnValueOnce(insights.promise);

    const analysis = budget.analyzeProject({ projectId: 'p1', actor: 'cron', applyAuto: false });
    for (let i = 0; i < 5; i += 1) {
      await Promise.resolve();
    }

    expect(listCampaigns).toHaveBeenCalledTimes(1);
    expect(listAdSets).toHaveBeenCalledTimes(1);
    expect(listAdSetInsights).toHaveBeenCalledTimes(1);

    campaigns.resolve([]);
    adsets.resolve([]);
    insights.resolve([]);
    await analysis;
  });
});
