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
  _calculateMetricsForTest,
  _getMetaAdsMonthRangeForTest,
  _resolveTargetResultTypeForTest,
  _resolveStatusPeriodForTest,
  _buildCreativePauseRecommendationsForTest,
  _resolveMonthlyBudgetForTest,
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

  it('decreases when the configured target result type has no conversions', () => {
    const result = proposeBudget({
      currentDailyBudget: 100,
      cpa: null,
      roas: 3,
      spend: 200,
      resultCount: 0,
      resultType: 'onsite_conversion.messaging_conversation_started_7d',
      rules: {
        ...DEFAULT_RULES,
        targetResultType: 'onsite_conversion.messaging_conversation_started_7d',
      },
    });

    expect(result.action).toBe('decrease');
    expect(result.proposedDailyBudget).toBe(75);
    expect(result.reason).toContain('Resultado alvo');
  });

  it('calculates ThruPlay as the video result metric', () => {
    const metrics = _calculateMetricsForTest(
      {
        spend: '80',
        impressions: '1000',
        video_thruplay_watched_actions: [{ value: '10' }],
        actions: [{ action_type: 'video_view', value: '20' }],
        cost_per_action_type: [{ action_type: 'video_view', value: '4' }],
      },
      'thruplay',
    );

    expect(metrics.resultType).toBe('thruplay');
    expect(metrics.resultCount).toBe(10);
    expect(metrics.cpa).toBe(8);
    expect(metrics.resultTypeBreakdown).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          resultType: 'thruplay',
          totalResults: 10,
          averageCostPerResult: 8,
        }),
      ]),
    );
  });

  it('uses the full remaining month when the monthly investment is for a future month', () => {
    expect(
      _getMetaAdsMonthRangeForTest(
        '2026-07',
        'America/Sao_Paulo',
        new Date('2026-06-23T12:00:00.000Z'),
      ),
    ).toEqual({
      since: '2026-07-01',
      until: '2026-07-31',
      remainingDays: 31,
    });
  });

  it('resolves monthly investment from the selected month first', () => {
    expect(
      _resolveMonthlyBudgetForTest(
        {
          monthlyBudget: {
            month: '2026-07',
            baseAmount: 9999,
            additionalAmount: 0,
            allowedOverspendPct: 0,
          },
          monthlyBudgets: {
            '2026-06': {
              baseAmount: 5000,
              additionalAmount: 1000,
              allowedOverspendPct: 10,
            },
            '2026-07': {
              baseAmount: 7000,
              additionalAmount: 500,
              allowedOverspendPct: 5,
            },
          },
        },
        '2026-07',
      ),
    ).toEqual({
      month: '2026-07',
      baseAmount: 7000,
      additionalAmount: 500,
      allowedOverspendPct: 5,
    });
  });

  it('inherits monthly investment from the latest previous configured month', () => {
    expect(
      _resolveMonthlyBudgetForTest(
        {
          monthlyBudgets: {
            '2026-04': {
              baseAmount: 3000,
              additionalAmount: 0,
              allowedOverspendPct: 0,
            },
            '2026-06': {
              baseAmount: 5000,
              additionalAmount: 1000,
              allowedOverspendPct: 10,
            },
          },
        },
        '2026-08',
      ),
    ).toEqual({
      month: '2026-08',
      baseAmount: 5000,
      additionalAmount: 1000,
      allowedOverspendPct: 10,
    });
  });

  it('uses ROAS as the primary metric for ecommerce-style rules', () => {
    const result = proposeBudget({
      currentDailyBudget: 100,
      cpa: 120,
      roas: 3,
      spend: 200,
      resultCount: 2,
      resultType: 'purchase',
      rules: {
        ...DEFAULT_RULES,
        primaryMetric: 'roas',
        targetResultType: 'purchase',
        minRoas: 2,
      },
    });

    expect(result.action).toBe('increase');
    expect(result.proposedDailyBudget).toBe(125);
  });

  it('uses only purchase actions for purchase target results', () => {
    const result = _calculateMetricsForTest(
      {
        spend: '230',
        actions: [
          { action_type: 'purchase', value: '23' },
          { action_type: 'link_click', value: '38' },
        ],
        cost_per_action_type: [
          { action_type: 'purchase', value: '10' },
          { action_type: 'link_click', value: '6.05' },
        ],
      },
      'purchase',
    );

    expect(result.resultType).toBe('purchase');
    expect(result.resultCount).toBe(23);
    expect(result.cpa).toBe(10);
    expect(result.resultTypeBreakdown).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ resultType: 'purchase', totalResults: 23 }),
        expect.objectContaining({ resultType: 'link_click', totalResults: 38 }),
      ]),
    );
  });

  it('does not add overlapping purchase aliases to purchase result breakdowns', () => {
    const result = _calculateMetricsForTest(
      {
        spend: '340',
        actions: [
          { action_type: 'purchase', value: '34' },
          { action_type: 'omni_purchase', value: '40' },
          { action_type: 'offsite_conversion.fb_pixel_purchase', value: '34' },
        ],
      },
      'purchase',
    );

    expect(result.resultType).toBe('purchase');
    expect(result.resultCount).toBe(34);
    expect(result.cpa).toBe(10);
    expect(result.resultTypeBreakdown).toEqual([
      {
        resultType: 'purchase',
        totalSpend: 340,
        totalResults: 34,
        averageCostPerResult: 10,
      },
    ]);
  });

  it('does not use link clicks as purchase fallback when purchases are missing', () => {
    const result = _calculateMetricsForTest(
      {
        spend: '120',
        actions: [{ action_type: 'link_click', value: '38' }],
        cost_per_action_type: [{ action_type: 'link_click', value: '3.16' }],
      },
      'purchase',
    );

    expect(result.resultType).toBe('purchase');
    expect(result.resultCount).toBe(0);
    expect(result.cpa).toBeNull();
  });

  it('canonicalizes equivalent purchase and lead actions for target results', () => {
    expect(
      _calculateMetricsForTest(
        {
          spend: '230',
          actions: [{ action_type: 'omni_purchase', value: '23' }],
        },
        'purchase',
      ),
    ).toEqual(expect.objectContaining({ resultType: 'purchase', resultCount: 23 }));

    expect(
      _calculateMetricsForTest(
        {
          spend: '60',
          actions: [{ action_type: 'leadgen_grouped', value: '6' }],
        },
        'lead',
      ),
    ).toEqual(expect.objectContaining({ resultType: 'lead', resultCount: 6 }));
  });

  it('resolves purchase as the default target for ecommerce and sales campaigns', () => {
    expect(_resolveTargetResultTypeForTest({ accountProfile: 'ecommerce' })).toBe('purchase');
    expect(_resolveTargetResultTypeForTest({ campaignObjective: 'OUTCOME_SALES' })).toBe(
      'purchase',
    );
    expect(
      _resolveTargetResultTypeForTest({
        accountProfile: 'ecommerce',
        rules: { targetResultType: 'lead' },
      }),
    ).toBe('lead');
  });

  it('uses purchase action values as ROAS fallback', () => {
    expect(
      _calculateMetricsForTest({
        spend: '100',
        actions: [{ action_type: 'purchase', value: '5' }],
        action_values: [{ action_type: 'purchase', value: '250' }],
      }),
    ).toEqual(expect.objectContaining({ roas: 2.5 }));
  });

  it('prefers Meta purchase_roas over action value ROAS fallback', () => {
    expect(
      _calculateMetricsForTest({
        spend: '100',
        purchase_roas: [{ value: '3.1' }],
        action_values: [{ action_type: 'purchase', value: '250' }],
      }),
    ).toEqual(expect.objectContaining({ roas: 3.1 }));
  });

  it('holds budget when the primary metric is healthy but CPC guardrail is high', () => {
    const result = proposeBudget({
      currentDailyBudget: 100,
      cpa: 20,
      roas: 3,
      spend: 200,
      cpc: 2,
      rules: {
        ...DEFAULT_RULES,
        maxCpc: 1,
      },
    });

    expect(result.action).toBe('hold');
    expect(result.proposedDailyBudget).toBe(100);
    expect(result.reason).toContain('CPC 2.00 acima do máximo 1');
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

  it('resolves short daily presets for local business creative rules', () => {
    const now = new Date('2026-06-23T12:00:00.000Z');

    expect(_resolveStatusPeriodForTest({ datePreset: 'last_1d' }, now)).toEqual({
      since: '2026-06-23',
      until: '2026-06-23',
    });
    expect(_resolveStatusPeriodForTest({ datePreset: 'last_2d' }, now)).toEqual({
      since: '2026-06-22',
      until: '2026-06-23',
    });
    expect(_resolveStatusPeriodForTest({ datePreset: 'last_3d' }, now)).toEqual({
      since: '2026-06-21',
      until: '2026-06-23',
    });
  });

  it('builds creative pause recommendations without leaving fewer than two active ads', () => {
    const recommendations = _buildCreativePauseRecommendationsForTest({
      ads: [
        { id: 'ad-1', name: 'Good', effective_status: 'ACTIVE', adset_id: 'adset-1' },
        { id: 'ad-2', name: 'Bad', effective_status: 'ACTIVE', adset_id: 'adset-1' },
        { id: 'ad-3', name: 'Also active', effective_status: 'ACTIVE', adset_id: 'adset-1' },
      ],
      adInsights: [
        { ad_id: 'ad-1', spend: '100', actions: [{ action_type: 'lead', value: '10' }] },
        { ad_id: 'ad-2', spend: '100', actions: [{ action_type: 'lead', value: '1' }] },
        { ad_id: 'ad-3', spend: '100', actions: [{ action_type: 'lead', value: '1' }] },
      ],
      ruleContext: {
        ruleSourceType: 'group',
        ruleId: 'g1',
        ruleName: 'Criativos locais',
        campaignId: 'campaign-1',
        campaignName: 'Campanha local',
        adsetId: 'adset-1',
        adsetName: 'Conjunto local',
      },
      creativeRules: {
        pauseHighCost: {
          enabled: true,
          maxCostPerResult: 45,
          minCreativesInScope: 3,
          minSpend: 20,
          targetResultType: 'lead',
        },
      },
    });

    expect(recommendations).toHaveLength(1);
    expect(recommendations[0]).toEqual(
      expect.objectContaining({
        entityLevel: 'ad',
        entityId: 'ad-2',
        action: 'pause',
        proposedStatus: 'PAUSED',
        ruleSourceType: 'group',
        ruleId: 'g1',
      }),
    );
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
    campaignInsights = [],
    campaigns = [],
    adsets = [],
    snapshots = [],
    recommendations = [],
    changes = [],
    actions = [],
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
    const createAutomationAction = jest.fn(async (payload) => payload);
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
            if (query?.__collection === 'actions') {
              return actions;
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
    const findActions = jest.fn((query) => makeFindChain({ ...query, __collection: 'actions' }));
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
        MetaAdsAutomationAction: {
          schema: {},
          create: createAutomationAction,
          find: findActions,
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
    const updateMetaEntityStatus = jest.fn(async () => ({}));
    const getAdSetDailyBudget = jest.fn(async () => latestBudget);
    const getEntityDailyBudget = jest.fn(async () => latestEntityBudget);
    const getAdAccountCurrency = jest.fn(async () => 'BRL');
    const listCampaigns = jest.fn(async () => campaigns);
    const listAdSets = jest.fn(async () => adsets);
    const listAds = jest.fn(async () => ads);
    const listAdInsights = jest.fn(async (options) =>
      typeof adInsights === 'function' ? adInsights(options) : adInsights,
    );
    const listCampaignInsights = jest.fn(async () => campaignInsights);
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
      listCampaignInsights,
      listAdSets,
      listAdSetInsights,
      metaPost,
      updateMetaEntityStatus,
    }));

    const budget = require('./budget');
    return {
      budget,
      createChange,
      createRecommendation,
      createSnapshot,
      createAutomationAction,
      findByIdAndUpdate,
      getAdSetDailyBudget,
      getEntityDailyBudget,
      getAdAccountCurrency,
      listAdInsights,
      listCampaignInsights,
      listAds,
      listCampaigns,
      listAdSets,
      listAdSetInsights,
      makeFindChain,
      metaPost,
      updateMetaEntityStatus,
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
          impressions: 1000,
          frequency: 2,
          createdAt: '2026-06-03T12:00:00.000Z',
        },
        {
          _id: 's2',
          projectId: 'p1',
          tenantId: 'tenant-a',
          entityId: 'adset-2',
          entityName: 'Retarget',
          campaignId: 'campaign-1',
          campaignName: 'Messages Floripa',
          campaignObjective: 'OUTCOME_ENGAGEMENT',
          dailyBudget: 15,
          spend: 50,
          cpa: 25,
          resultCount: 2,
          resultType: 'onsite_conversion.messaging_conversation_started_7d',
          impressions: 100,
          frequency: 3,
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
        spend: 250,
        resultCount: 12,
        frequency: 2.09,
        adSets: expect.arrayContaining([
          expect.objectContaining({
            entityId: 'adset-1',
            entityName: 'Topo',
            latestRecommendation: expect.objectContaining({
              action: 'increase',
              proposedDailyBudget: 60,
            }),
          }),
          expect.objectContaining({
            entityId: 'adset-2',
            entityName: 'Retarget',
          }),
        ]),
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
          campaignObjective: 'OUTCOME_ENGAGEMENT',
          spend: 200,
          cpa: 20,
          resultCount: 10,
          resultType: 'onsite_conversion.messaging_conversation_started_7d',
          impressions: 1000,
          frequency: 2,
          createdAt: '2026-06-03T12:00:00.000Z',
        },
        {
          entityId: 'adset-3',
          entityName: 'Lead form',
          campaignId: 'campaign-1',
          campaignName: 'Messages Floripa',
          campaignObjective: 'OUTCOME_ENGAGEMENT',
          spend: 50,
          cpa: 25,
          resultCount: 2,
          resultType: 'lead',
          impressions: 100,
          frequency: 3,
          createdAt: '2026-06-03T12:00:00.000Z',
        },
        {
          entityId: 'adset-2',
          entityName: 'Retarget',
          campaignId: 'campaign-2',
          campaignName: 'Sales SP',
          campaignObjective: 'OUTCOME_SALES',
          spend: 100,
          cpa: 50,
          resultCount: 2,
          resultType: 'purchase',
          impressions: 100,
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
      totalSpend: 350,
      totalResults: null,
      averageCostPerResult: null,
      averageFrequency: 2.25,
      bestCampaignByCost: expect.objectContaining({ campaignId: 'campaign-1' }),
      worstCampaignByCost: expect.objectContaining({ campaignId: 'campaign-2' }),
      objectives: [
        expect.objectContaining({
          objective: 'OUTCOME_ENGAGEMENT',
          campaignCount: 1,
          totalSpend: 250,
          totalResults: null,
          averageCostPerResult: null,
          averageFrequency: 2.09,
          resultTypes: expect.arrayContaining([
            expect.objectContaining({
              resultType: 'onsite_conversion.messaging_conversation_started_7d',
              totalResults: 10,
            }),
            expect.objectContaining({
              resultType: 'lead',
              totalResults: 2,
            }),
          ]),
        }),
        expect.objectContaining({
          objective: 'OUTCOME_SALES',
          campaignCount: 1,
          totalSpend: 100,
          totalResults: 2,
          averageCostPerResult: 50,
        }),
      ],
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

  it('uses nested creative media fallbacks when Meta omits direct media fields', async () => {
    const { budget, listAds } = loadBudgetWithMocks({
      project: {
        projectId: 'p1',
        tenantId: 'tenant-a',
        metaAds: { adAccountId: 'act_123' },
      },
      campaigns: [{ id: 'campaign-1', name: 'Messages', objective: 'OUTCOME_ENGAGEMENT' }],
      adsets: [{ id: 'adset-1', name: 'Topo', campaign_id: 'campaign-1' }],
      insights: [
        {
          adset_id: 'adset-1',
          adset_name: 'Topo',
          campaign_id: 'campaign-1',
          spend: '20',
        },
      ],
      adInsights: [
        {
          ad_id: 'ad-1',
          ad_name: 'Dynamic creative',
          adset_id: 'adset-1',
          campaign_id: 'campaign-1',
          spend: '20',
          impressions: '100',
        },
      ],
      ads: [
        {
          id: 'ad-1',
          name: 'Dynamic creative',
          effective_status: 'ACTIVE',
          adset_id: 'adset-1',
          campaign_id: 'campaign-1',
          creative: {
            id: 'creative-1',
            object_story_spec: {
              link_data: {
                child_attachments: [{ picture: 'https://example.com/child.jpg' }],
              },
            },
            asset_feed_spec: {
              images: [{ url: 'https://example.com/asset.jpg' }],
            },
          },
        },
      ],
    });

    const status = await budget.getProjectMetaAdsStatus('p1', 'request-tenant', {
      datePreset: 'last_7d',
    });

    expect(listAds).toHaveBeenCalledWith(
      expect.objectContaining({
        adIds: ['ad-1'],
      }),
    );
    expect(status.campaigns?.[0]?.adSets?.[0]?.ads?.[0]).toEqual(
      expect.objectContaining({
        thumbnailUrl: 'https://example.com/child.jpg',
        imageUrl: 'https://example.com/child.jpg',
      }),
    );
  });

  it('extracts template creative fields when Meta omits direct and link data fields', async () => {
    const { budget } = loadBudgetWithMocks({
      project: {
        projectId: 'p1',
        tenantId: 'tenant-a',
        metaAds: { adAccountId: 'act_123' },
      },
      campaigns: [{ id: 'campaign-1', name: 'Templates', objective: 'OUTCOME_ENGAGEMENT' }],
      adsets: [{ id: 'adset-1', name: 'Retargeting', campaign_id: 'campaign-1' }],
      insights: [
        {
          adset_id: 'adset-1',
          adset_name: 'Retargeting',
          campaign_id: 'campaign-1',
          spend: '32',
        },
      ],
      adInsights: [
        {
          ad_id: 'ad-template',
          ad_name: 'Template creative',
          adset_id: 'adset-1',
          campaign_id: 'campaign-1',
          spend: '32',
        },
      ],
      ads: [
        {
          id: 'ad-template',
          name: 'Template creative',
          adset_id: 'adset-1',
          campaign_id: 'campaign-1',
          creative: {
            id: 'creative-template',
            object_story_spec: {
              template_data: {
                name: 'Template headline',
                message: 'Template body',
                description: 'Template description',
                link: 'https://example.com/template',
                picture: 'https://example.com/template.jpg',
                call_to_action: { type: 'SHOP_NOW' },
              },
            },
          },
        },
      ],
    });

    const status = await budget.getProjectMetaAdsStatus('p1', 'request-tenant', {
      datePreset: 'last_7d',
    });

    expect(status.campaigns?.[0]?.adSets?.[0]?.ads?.[0]).toEqual(
      expect.objectContaining({
        creativeId: 'creative-template',
        title: 'Template headline',
        body: 'Template body',
        description: 'Template description',
        thumbnailUrl: 'https://example.com/template.jpg',
        imageUrl: 'https://example.com/template.jpg',
        linkUrl: 'https://example.com/template',
        callToActionType: 'SHOP_NOW',
      }),
    );
  });

  it('extracts asset feed text, link, CTA, and video thumbnail fallbacks', async () => {
    const { budget } = loadBudgetWithMocks({
      project: {
        projectId: 'p1',
        tenantId: 'tenant-a',
        metaAds: { adAccountId: 'act_123' },
      },
      campaigns: [{ id: 'campaign-1', name: 'Dynamic', objective: 'OUTCOME_SALES' }],
      adsets: [{ id: 'adset-1', name: 'Products', campaign_id: 'campaign-1' }],
      insights: [
        {
          adset_id: 'adset-1',
          adset_name: 'Products',
          campaign_id: 'campaign-1',
          spend: '64',
        },
      ],
      adInsights: [
        {
          ad_id: 'ad-feed',
          ad_name: 'Feed creative',
          adset_id: 'adset-1',
          campaign_id: 'campaign-1',
          spend: '64',
        },
      ],
      ads: [
        {
          id: 'ad-feed',
          name: 'Feed creative',
          adset_id: 'adset-1',
          campaign_id: 'campaign-1',
          creative: {
            id: 'creative-feed',
            asset_feed_spec: {
              titles: [{ text: 'Feed headline' }],
              bodies: [{ text: 'Feed body' }],
              descriptions: [{ text: 'Feed description' }],
              link_urls: [{ website_url: 'https://example.com/feed' }],
              call_to_action_types: ['BUY_NOW'],
              videos: [
                {
                  thumbnail_url: 'https://example.com/feed-video.jpg',
                  video_id: 'v-1',
                },
              ],
            },
          },
        },
      ],
    });

    const status = await budget.getProjectMetaAdsStatus('p1', 'request-tenant', {
      datePreset: 'last_7d',
    });

    expect(status.campaigns?.[0]?.adSets?.[0]?.ads?.[0]).toEqual(
      expect.objectContaining({
        creativeId: 'creative-feed',
        title: 'Feed headline',
        body: 'Feed body',
        description: 'Feed description',
        thumbnailUrl: 'https://example.com/feed-video.jpg',
        imageUrl: 'https://example.com/feed-video.jpg',
        videoId: 'v-1',
        linkUrl: 'https://example.com/feed',
        callToActionType: 'BUY_NOW',
      }),
    );
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
          impressions: 100,
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
          impressions: 200,
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
          impressions: 50,
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
          impressions: 100,
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

    expect(status.trend).toEqual(
      expect.objectContaining({
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
            frequency: 3.5,
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
      }),
    );
  });

  it('returns daily ad trend series from period ad insights', async () => {
    const { budget, listAdInsights } = loadBudgetWithMocks({
      project: {
        projectId: 'p1',
        tenantId: 'tenant-a',
        metaAds: { adAccountId: 'act_123', tokenSecretName: 'meta-token' },
      },
      campaigns: [{ id: 'campaign-1', name: 'Messages', objective: 'OUTCOME_ENGAGEMENT' }],
      adsets: [{ id: 'adset-1', name: 'Audience', campaign_id: 'campaign-1' }],
      ads: [{ id: 'ad-1', name: 'Creative A', adset_id: 'adset-1', campaign_id: 'campaign-1' }],
      insights: [
        {
          adset_id: 'adset-1',
          adset_name: 'Audience',
          campaign_id: 'campaign-1',
          campaign_name: 'Messages',
          spend: '30',
          actions: [{ action_type: 'lead', value: '3' }],
        },
      ],
      adInsights: (options) =>
        options.timeIncrement
          ? [
              {
                date_start: '2026-06-01',
                ad_id: 'ad-1',
                ad_name: 'Creative A',
                adset_id: 'adset-1',
                adset_name: 'Audience',
                campaign_id: 'campaign-1',
                campaign_name: 'Messages',
                spend: '10',
                impressions: '100',
                clicks: '5',
                actions: [{ action_type: 'lead', value: '1' }],
              },
              {
                date_start: '2026-06-02',
                ad_id: 'ad-1',
                ad_name: 'Creative A',
                adset_id: 'adset-1',
                adset_name: 'Audience',
                campaign_id: 'campaign-1',
                campaign_name: 'Messages',
                spend: '20',
                impressions: '200',
                clicks: '8',
                actions: [{ action_type: 'lead', value: '2' }],
              },
            ]
          : [
              {
                ad_id: 'ad-1',
                ad_name: 'Creative A',
                adset_id: 'adset-1',
                campaign_id: 'campaign-1',
                campaign_name: 'Messages',
                spend: '30',
                actions: [{ action_type: 'lead', value: '3' }],
              },
            ],
    });

    const status = await budget.getProjectMetaAdsStatus('p1', 'request-tenant', {
      since: '2026-06-01',
      until: '2026-06-02',
    });

    expect(listAdInsights).toHaveBeenCalledWith(expect.objectContaining({ timeIncrement: 1 }));
    expect(status.trend.series).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          level: 'ad',
          entityId: 'ad-1',
          entityName: 'Creative A',
          parentCampaignName: 'Audience',
          objective: 'OUTCOME_ENGAGEMENT',
          points: [
            expect.objectContaining({ date: '2026-06-01', spend: 10, resultCount: 1, cpa: 10 }),
            expect.objectContaining({ date: '2026-06-02', spend: 20, resultCount: 2, cpa: 10 }),
          ],
        }),
      ]),
    );
    expect(status.trend.entityDeltas).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          level: 'ad',
          entityId: 'ad-1',
          spendDelta: 10,
          resultDelta: 1,
        }),
      ]),
    );
  });

  it('returns entities grouped by rule performance', async () => {
    const { budget } = loadBudgetWithMocks({
      project: {
        projectId: 'p1',
        tenantId: 'tenant-a',
        metaAds: { adAccountId: 'act_123', tokenSecretName: 'meta-token' },
      },
      actions: [
        {
          actionType: 'pause_ad',
          entityLevel: 'ad',
          entityId: 'ad-1',
          entityName: 'Creative A',
          campaignName: 'Campaign A',
          adsetName: 'Ad set A',
          spend: 30,
          cpa: 15,
          roas: 2,
          actor: 'cron',
          ruleSourceType: 'group',
          ruleId: 'group-1',
          ruleName: 'Validos junho',
          ruleScope: 'campaign:campaign-1',
          createdAt: '2026-06-24T14:03:00.000Z',
        },
        {
          actionType: 'budget_change',
          entityLevel: 'ad',
          entityId: 'ad-1',
          entityName: 'Creative A',
          campaignName: 'Campaign A',
          adsetName: 'Ad set A',
          spend: 50,
          cpa: 25,
          roas: 4,
          actor: 'cron',
          ruleSourceType: 'group',
          ruleId: 'group-1',
          ruleName: 'Validos junho',
          ruleScope: 'campaign:campaign-1',
          createdAt: '2026-06-24T15:10:00.000Z',
        },
        {
          actionType: 'pause_ad',
          entityLevel: 'adset',
          entityId: 'adset-2',
          entityName: 'Audience B',
          campaignName: 'Campaign B',
          spend: 20,
          cpa: 10,
          roas: 1,
          actor: 'user',
          ruleSourceType: 'group',
          ruleId: 'group-1',
          ruleName: 'Validos junho',
          ruleScope: 'campaign:campaign-1',
          createdAt: '2026-06-23T08:00:00.000Z',
        },
      ],
    });

    const performance = await budget.getProjectMetaAdsRulePerformance('p1', 'tenant-a');

    expect(performance.rules).toEqual([
      expect.objectContaining({
        ruleKey: 'group:group-1',
        actionCount: 3,
        pausedAdCount: 2,
        entities: [
          expect.objectContaining({
            entityLevel: 'ad',
            entityId: 'ad-1',
            entityName: 'Creative A',
            campaignName: 'Campaign A',
            adsetName: 'Ad set A',
            actionCount: 2,
            pausedAdCount: 1,
            totalSpend: 80,
            averageCpa: 20,
            averageRoas: 3,
            lastActionAt: '2026-06-24T15:10:00.000Z',
          }),
          expect.objectContaining({
            entityLevel: 'adset',
            entityId: 'adset-2',
            entityName: 'Audience B',
            campaignName: 'Campaign B',
            actionCount: 1,
            pausedAdCount: 1,
            totalSpend: 20,
            averageCpa: 10,
            averageRoas: 1,
            lastActionAt: '2026-06-23T08:00:00.000Z',
          }),
        ],
      }),
    ]);
  });

  it('calculates rule performance evolution from oldest to newest actions', async () => {
    const { budget } = loadBudgetWithMocks({
      project: {
        projectId: 'p1',
        tenantId: 'tenant-a',
        metaAds: { adAccountId: 'act_123', tokenSecretName: 'meta-token' },
      },
      actions: [
        {
          actionType: 'pause_ad',
          entityLevel: 'ad',
          entityId: 'ad-1',
          entityName: 'Creative A',
          spend: 30,
          cpa: 20,
          roas: 4,
          actor: 'cron',
          ruleSourceType: 'group',
          ruleId: 'group-1',
          ruleName: 'Validos junho',
          createdAt: '2026-06-24T15:10:00.000Z',
        },
        {
          actionType: 'pause_ad',
          entityLevel: 'ad',
          entityId: 'ad-1',
          entityName: 'Creative A',
          spend: 30,
          cpa: 40,
          roas: 2,
          actor: 'cron',
          ruleSourceType: 'group',
          ruleId: 'group-1',
          ruleName: 'Validos junho',
          createdAt: '2026-06-24T14:03:00.000Z',
        },
      ],
    });

    const performance = await budget.getProjectMetaAdsRulePerformance('p1', 'tenant-a');

    expect(performance.rules[0]).toEqual(
      expect.objectContaining({
        status: 'improved',
        firstCpa: 40,
        lastCpa: 20,
        cpaDelta: -20,
        firstRoas: 2,
        lastRoas: 4,
        roasDelta: 2,
        firstActionAt: '2026-06-24T14:03:00.000Z',
        lastActionAt: '2026-06-24T15:10:00.000Z',
        comparisonBasis: 'period_first_last',
      }),
    );
    expect(performance.rules[0].entities[0]).toEqual(
      expect.objectContaining({
        status: 'improved',
        firstCpa: 40,
        lastCpa: 20,
        cpaDelta: -20,
        firstRoas: 2,
        lastRoas: 4,
        roasDelta: 2,
        firstActionAt: '2026-06-24T14:03:00.000Z',
        lastActionAt: '2026-06-24T15:10:00.000Z',
        comparisonBasis: 'period_first_last',
      }),
    );
  });

  it('uses real before and after metrics when available for rule performance', async () => {
    const { budget } = loadBudgetWithMocks({
      project: {
        projectId: 'p1',
        tenantId: 'tenant-a',
        metaAds: { adAccountId: 'act_123', tokenSecretName: 'meta-token' },
      },
      actions: [
        {
          actionType: 'pause_ad',
          entityLevel: 'ad',
          entityId: 'ad-1',
          entityName: 'Creative A',
          spend: 30,
          cpa: 20,
          roas: 4,
          beforeMetrics: { cpa: 18, roas: 5 },
          afterMetrics: { cpa: 24, roas: 3 },
          afterMeasuredAt: '2026-06-24T16:10:00.000Z',
          actor: 'cron',
          ruleSourceType: 'group',
          ruleId: 'group-1',
          ruleName: 'Validos junho',
          createdAt: '2026-06-24T15:10:00.000Z',
        },
      ],
    });

    const performance = await budget.getProjectMetaAdsRulePerformance('p1', 'tenant-a');

    expect(performance.rules[0]).toEqual(
      expect.objectContaining({
        status: 'regressed',
        firstCpa: 18,
        lastCpa: 24,
        cpaDelta: 6,
        firstRoas: 5,
        lastRoas: 3,
        roasDelta: -2,
        comparisonBasis: 'real_before_after',
      }),
    );
  });

  it('builds status metrics from Meta insights for the selected period and returns currency', async () => {
    const { budget, getAdAccountCurrency, listCampaignInsights, listAdSetInsights } =
      loadBudgetWithMocks({
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
        campaignInsights: [
          {
            campaign_id: 'campaign-1',
            campaign_name: 'Messages',
            spend: '85.76',
            impressions: '4020',
            reach: '1000',
            frequency: '4.02',
            actions: [
              {
                action_type: 'onsite_conversion.messaging_conversation_started_7d',
                value: '8',
              },
              {
                action_type: 'link_click',
                value: '16',
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
            impressions: '1000',
            reach: '204',
            frequency: '4.90',
            actions: [
              {
                action_type: 'onsite_conversion.messaging_conversation_started_7d',
                value: '8',
              },
              {
                action_type: 'link_click',
                value: '16',
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

    expect(listCampaignInsights).toHaveBeenCalledWith(
      expect.objectContaining({ since: '2026-06-10', until: '2026-06-15' }),
    );
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
        totalResults: null,
        averageCostPerResult: null,
        objectives: [
          expect.objectContaining({
            resultTypes: expect.arrayContaining([
              expect.objectContaining({
                resultType: 'onsite_conversion.messaging_conversation_started_7d',
                totalSpend: 85.76,
                totalResults: 8,
                averageCostPerResult: 10.72,
              }),
              expect.objectContaining({
                resultType: 'link_click',
                totalSpend: 85.76,
                totalResults: 16,
                averageCostPerResult: 5.36,
              }),
            ]),
          }),
        ],
      }),
    );
    expect(status.campaigns[0].adSets[0]).toEqual(
      expect.objectContaining({
        entityName: 'Audience real',
        resultCount: 8,
        cpa: 10.72,
        resultType: 'onsite_conversion.messaging_conversation_started_7d',
        resultTypeBreakdown: expect.arrayContaining([
          expect.objectContaining({ resultType: 'link_click', totalResults: 16 }),
        ]),
        frequency: 4.9,
      }),
    );
    expect(status.campaigns[0]).toEqual(
      expect.objectContaining({
        resultCount: 8,
        cpa: 10.72,
        impressions: 4020,
        reach: 1000,
        frequency: 4.02,
      }),
    );
  });

  it('keeps ad-level insights even when the Meta ads listing does not return the ad creative', async () => {
    const { budget } = loadBudgetWithMocks({
      project: { projectId: 'p1', tenantId: 'tenant-a', metaAds: { adAccountId: 'act_123' } },
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
        },
      ],
      ads: [],
      adInsights: [
        {
          ad_id: 'ad-1',
          ad_name: 'Message creative from insights',
          adset_id: 'adset-1',
          campaign_id: 'campaign-1',
          campaign_name: 'Messages',
          spend: '50',
          actions: [
            {
              action_type: 'onsite_conversion.messaging_conversation_started_7d',
              value: '5',
            },
          ],
          cost_per_action_type: [
            {
              action_type: 'onsite_conversion.messaging_conversation_started_7d',
              value: '10',
            },
          ],
        },
      ],
    });

    const status = await budget.getProjectMetaAdsStatus('p1', 'request-tenant', {
      since: '2026-06-10',
      until: '2026-06-15',
    });

    expect(status.campaigns[0].adSets[0].ads).toEqual([
      expect.objectContaining({
        adId: 'ad-1',
        adName: 'Message creative from insights',
        adSetId: 'adset-1',
        spend: 50,
        resultCount: 5,
        cpa: 10,
        resultType: 'onsite_conversion.messaging_conversation_started_7d',
      }),
    ]);
    expect(status.adDiagnostics).toEqual({
      adsFetched: 0,
      adInsightsFetched: 1,
      adsWithInsights: 0,
      insightOnlyAds: 1,
      adsAttachedToAdSets: 1,
    });
  });

  it('keeps period insights when historical ad set config is rate limited', async () => {
    const { budget, listAdSets, listAdSetInsights } = loadBudgetWithMocks({
      project: { projectId: 'p1', tenantId: 'tenant-a', metaAds: { adAccountId: 'act_123' } },
      campaigns: [{ id: 'campaign-1', name: 'Messages', objective: 'OUTCOME_ENGAGEMENT' }],
      insights: [
        {
          campaign_id: 'campaign-1',
          campaign_name: 'Messages',
          adset_id: 'adset-1',
          adset_name: 'Audience from insight',
          spend: '170.00',
          impressions: '1000',
          reach: '300',
          frequency: '3.33',
          actions: [
            {
              action_type: 'onsite_conversion.messaging_conversation_started_7d',
              value: '10',
            },
          ],
          cost_per_action_type: [
            {
              action_type: 'onsite_conversion.messaging_conversation_started_7d',
              value: '17',
            },
          ],
        },
      ],
    });
    listAdSets.mockRejectedValueOnce(new Error('User request limit reached'));

    const status = await budget.getProjectMetaAdsStatus('p1', 'request-tenant', {
      since: '2026-06-10',
      until: '2026-06-15',
    });

    expect(listAdSets).toHaveBeenCalledWith(expect.objectContaining({ includeInactive: true }));
    expect(listAdSetInsights).toHaveBeenCalledWith(
      expect.objectContaining({ since: '2026-06-10', until: '2026-06-15' }),
    );
    expect(status.summary.totalSpend).toBe(170);
    expect(status.campaigns[0].adSets[0]).toEqual(
      expect.objectContaining({
        entityName: 'Audience from insight',
        resultCount: 10,
        cpa: 17,
      }),
    );
  });

  it('removes overlapping Meta engagement rollups from objective result breakdowns', async () => {
    const { budget } = loadBudgetWithMocks({
      project: { projectId: 'p1', tenantId: 'tenant-a', metaAds: { adAccountId: 'act_123' } },
      campaigns: [{ id: 'campaign-1', name: 'Engagement', objective: 'OUTCOME_ENGAGEMENT' }],
      campaignInsights: [
        {
          campaign_id: 'campaign-1',
          campaign_name: 'Engagement',
          spend: '105.48',
          impressions: '10000',
          reach: '6500',
          clicks: '61',
          ctr: '0.61',
          actions: [
            { action_type: 'page_engagement', value: '2727' },
            { action_type: 'post_engagement', value: '2727' },
            { action_type: 'video_view', value: '2678' },
            { action_type: 'post_reaction', value: '49' },
          ],
        },
      ],
      insights: [
        {
          campaign_id: 'campaign-1',
          campaign_name: 'Engagement',
          adset_id: 'adset-1',
          adset_name: 'Audience',
          spend: '105.48',
          actions: [
            { action_type: 'page_engagement', value: '2727' },
            { action_type: 'post_engagement', value: '2727' },
            { action_type: 'video_view', value: '2678' },
            { action_type: 'post_reaction', value: '49' },
          ],
        },
      ],
    });

    const status = await budget.getProjectMetaAdsStatus('p1', 'request-tenant', {
      since: '2026-06-01',
      until: '2026-06-07',
    });
    const resultTypes = status.summary.objectives[0].resultTypes.map(
      (resultType) => resultType.resultType,
    );

    expect(resultTypes).toEqual(expect.arrayContaining(['thruplay', 'post_reaction']));
    expect(resultTypes).not.toEqual(expect.arrayContaining(['page_engagement', 'post_engagement']));
    expect(status.campaigns[0].resultType).toBe('post_reaction');
    expect(status.campaigns[0].resultCount).toBe(49);
    expect(status.campaigns[0].adSets[0].resultType).toBe('post_reaction');
    expect(status.campaigns[0].adSets[0].videoP75Watched).toBe(0);
  });

  it('caches live period status to avoid repeated Meta reads for the same period', async () => {
    const { budget, listCampaigns, listAdSets, listAdSetInsights, listCampaignInsights } =
      loadBudgetWithMocks({
        project: { projectId: 'p1', tenantId: 'tenant-a', metaAds: { adAccountId: 'act_123' } },
        campaigns: [{ id: 'campaign-1', name: 'Messages', objective: 'OUTCOME_ENGAGEMENT' }],
        adsets: [
          {
            id: 'adset-1',
            name: 'Audience real',
            campaign_id: 'campaign-1',
          },
        ],
        campaignInsights: [
          {
            campaign_id: 'campaign-1',
            campaign_name: 'Messages',
            spend: '30.00',
            impressions: '100',
            reach: '90',
            frequency: '1.11',
          },
        ],
        insights: [
          {
            campaign_id: 'campaign-1',
            campaign_name: 'Messages',
            adset_id: 'adset-1',
            adset_name: 'Audience real',
            spend: '30.00',
            impressions: '100',
            reach: '90',
            frequency: '1.11',
            actions: [
              {
                action_type: 'link_click',
                value: '6',
              },
            ],
            cost_per_action_type: [
              {
                action_type: 'link_click',
                value: '5',
              },
            ],
          },
        ],
      });

    await budget.getProjectMetaAdsStatus('p1', 'request-tenant', {
      since: '2026-06-10',
      until: '2026-06-15',
    });
    const cachedStatus = await budget.getProjectMetaAdsStatus('p1', 'request-tenant', {
      since: '2026-06-10',
      until: '2026-06-15',
    });

    expect(listCampaigns).toHaveBeenCalledTimes(1);
    expect(listAdSets).toHaveBeenCalledTimes(1);
    expect(listCampaignInsights).toHaveBeenCalledTimes(1);
    expect(listAdSetInsights).toHaveBeenCalledTimes(1);
    expect(cachedStatus.summary.totalSpend).toBe(30);
    expect(cachedStatus.summary.objectives[0].resultTypes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          resultType: 'link_click',
          totalResults: 6,
          averageCostPerResult: 5,
        }),
      ]),
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

  it('blocks manual budget increases that exceed the monthly investment cap', async () => {
    const { budget, metaPost } = loadBudgetWithMocks({
      project: {
        projectId: 'p1',
        tenantId: 'tenant-a',
        metaAds: {
          tokenSecretName: 'secret',
          adAccountId: 'act_123',
          rules: { ...DEFAULT_RULES, maxDailyBudget: 2000 },
          monthlyBudget: {
            month: '2026-07',
            baseAmount: 100,
            additionalAmount: 0,
            allowedOverspendPct: 0,
          },
        },
      },
      latestEntityBudget: { dailyBudget: 10 },
      campaignInsights: [{ campaign_id: 'campaign-1', spend: '95' }],
    });

    await expect(
      budget.applyManualBudgetChange({
        projectId: 'p1',
        tenantId: 'tenant-a',
        entityLevel: 'campaign',
        entityId: 'campaign-1',
        entityName: 'CBO Campaign',
        dailyBudget: 100,
        actor: 'user',
        actorUserId: 'u1',
        reason: 'Manual scale',
      }),
    ).rejects.toThrow('Bloqueado pelo limite mensal');
    expect(metaPost).not.toHaveBeenCalled();
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

  it('uses the configured target result type when creating cron recommendations', async () => {
    const { budget, createRecommendation } = loadBudgetWithMocks({
      project: {
        projectId: 'p1',
        tenantId: 'tenant-a',
        metaAds: {
          adAccountId: 'act_123',
          rules: {
            ...DEFAULT_RULES,
            targetResultType: 'lead',
            targetCpa: 45,
          },
        },
      },
      campaigns: [{ id: 'campaign-1', name: 'Messages', objective: 'OUTCOME_ENGAGEMENT' }],
      adsets: [
        {
          id: 'adset-1',
          name: 'Messages set',
          campaign_id: 'campaign-1',
          daily_budget: '10000',
        },
      ],
      insights: [
        {
          campaign_id: 'campaign-1',
          campaign_name: 'Messages',
          adset_id: 'adset-1',
          adset_name: 'Messages set',
          spend: '200',
          actions: [
            { action_type: 'onsite_conversion.messaging_conversation_started_7d', value: '20' },
          ],
        },
      ],
    });

    await budget.analyzeProject({ projectId: 'p1', actor: 'cron', applyAuto: false });

    expect(createRecommendation).toHaveBeenCalledWith(
      expect.objectContaining({
        entityId: 'adset-1',
        action: 'decrease',
        proposedDailyBudget: 75,
        reason: 'Resultado alvo lead sem conversões no período.',
      }),
    );
  });

  it('uses the configured Meta Ads timezone for cron insight date ranges', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-06-18T02:30:00.000Z'));
    process.env.META_ADS_TIME_ZONE = 'America/Sao_Paulo';
    try {
      const { budget, listAdSetInsights } = loadBudgetWithMocks({
        project: {
          projectId: 'p1',
          tenantId: 'tenant-a',
          metaAds: { adAccountId: 'act_123' },
        },
        campaigns: [],
        adsets: [],
        insights: [],
      });

      await budget.analyzeProject({ projectId: 'p1', actor: 'cron', applyAuto: false });

      expect(listAdSetInsights).toHaveBeenCalledWith(
        expect.objectContaining({
          since: '2026-06-16',
          until: '2026-06-17',
        }),
      );
    } finally {
      delete process.env.META_ADS_TIME_ZONE;
      jest.useRealTimers();
    }
  });

  it('uses campaign-level metrics for CBO recommendations when campaign insights are available', async () => {
    const { budget, createRecommendation } = loadBudgetWithMocks({
      project: {
        projectId: 'p1',
        tenantId: 'tenant-a',
        metaAds: {
          adAccountId: 'act_123',
          rules: { ...DEFAULT_RULES, targetCpa: 45 },
        },
      },
      campaigns: [{ id: 'campaign-cbo', name: 'CBO Campaign', daily_budget: '10000' }],
      adsets: [
        { id: 'adset-good', name: 'Good child', campaign_id: 'campaign-cbo', daily_budget: '0' },
        { id: 'adset-bad', name: 'Bad child', campaign_id: 'campaign-cbo', daily_budget: '0' },
      ],
      insights: [
        {
          campaign_id: 'campaign-cbo',
          campaign_name: 'CBO Campaign',
          adset_id: 'adset-good',
          adset_name: 'Good child',
          spend: '100',
          actions: [{ action_type: 'lead', value: '10' }],
        },
        {
          campaign_id: 'campaign-cbo',
          campaign_name: 'CBO Campaign',
          adset_id: 'adset-bad',
          adset_name: 'Bad child',
          spend: '900',
          actions: [{ action_type: 'lead', value: '5' }],
        },
      ],
      campaignInsights: [
        {
          campaign_id: 'campaign-cbo',
          campaign_name: 'CBO Campaign',
          spend: '1000',
          actions: [{ action_type: 'lead', value: '15' }],
        },
      ],
    });

    await budget.analyzeProject({ projectId: 'p1', actor: 'cron', applyAuto: false });

    expect(createRecommendation).toHaveBeenCalledWith(
      expect.objectContaining({
        entityLevel: 'campaign',
        entityId: 'campaign-cbo',
        spend: 1000,
        cpa: 66.66666666666667,
        action: 'decrease',
        proposedDailyBudget: 75,
      }),
    );
    expect(createRecommendation).toHaveBeenCalledTimes(1);
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
