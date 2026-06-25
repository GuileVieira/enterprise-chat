const express = require('express');
const request = require('supertest');
const { SystemRoles } = require('librechat-data-provider');

let mockRouteUser = { id: 'user-1', role: SystemRoles.ADMIN, tenantId: 'tenant-x' };
const mockCanAccessProjectResource = jest.fn(() => (_req, _res, next) => next());
const mockGetRoleByName = jest.fn();

jest.mock('~/models', () => ({
  findProjectById: jest.fn(),
  getProjectById: jest.fn(),
  getRoleByName: (...args) => mockGetRoleByName(...args),
  updateProject: jest.fn(),
  upsertTenantSecret: jest.fn(),
}));

jest.mock('~/server/middleware', () => ({
  requireJwtAuth: (req, _res, next) => {
    req.user = mockRouteUser;
    next();
  },
}));

jest.mock('~/server/middleware/roles/capabilities', () => ({
  requireCapability: () => (_req, _res, next) => next(),
}));

jest.mock('~/server/middleware/accessResources/canAccessProject', () => ({
  canAccessProjectResource: (...args) => mockCanAccessProjectResource(...args),
}));

jest.mock('~/server/services/Config/app', () => ({
  getAppConfig: jest.fn(async () => ({ interfaceConfig: { metaAds: true } })),
}));

jest.mock('~/server/services/MetaAds/budget', () => ({
  analyzeProject: jest.fn(),
  applyManualBudgetChange: jest.fn(),
  applyRecommendation: jest.fn(),
  duplicateProjectMetaAdsEntity: jest.fn(),
  getProjectMetaAdsPerformance: jest.fn(),
  getProjectMetaAdsRankings: jest.fn(),
  getProjectMetaAdsRuleHistory: jest.fn(),
  getProjectMetaAdsRulePerformance: jest.fn(),
  getProjectMetaAdsStatus: jest.fn(),
  recordProjectMetaAdsRuleChange: jest.fn(),
  updateProjectMetaAdsEntityStatus: jest.fn(),
}));

const router = require('./projectMetaAds');
const { upsertTenantSecret } = require('~/models');
const {
  analyzeProject,
  duplicateProjectMetaAdsEntity,
  getProjectMetaAdsPerformance,
  getProjectMetaAdsRankings,
  getProjectMetaAdsRulePerformance,
  getProjectMetaAdsStatus,
  updateProjectMetaAdsEntityStatus,
} = require('~/server/services/MetaAds/budget');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/projects/:projectId/meta-ads', router);
  return app;
}

beforeEach(() => {
  mockRouteUser = { id: 'user-1', role: SystemRoles.ADMIN, tenantId: 'tenant-x' };
  mockGetRoleByName.mockImplementation(async (roleName) => ({
    name: roleName,
    permissions: {
      META_ADS: {
        USE:
          roleName === SystemRoles.ADMIN ||
          roleName === SystemRoles.OWNER ||
          roleName === SystemRoles.AD_MANAGER,
      },
    },
  }));
});

describe('projectMetaAds settings normalization', () => {
  it('rejects a Meta token value pasted into tokenSecretName', () => {
    expect(() =>
      router._normalizeMetaAdsForTest({
        tokenSecretName: `EAA${'a'.repeat(48)}`,
      }),
    ).toThrow('Token secret name must be a secret name, not the Meta access token value.');
  });

  it('accepts a secret name and marks it as a project secret', () => {
    expect(
      router._normalizeMetaAdsForTest({
        adAccountId: '123-456',
        tokenSecretName: 'meta_graph_access_token_project_p1',
      }),
    ).toEqual(
      expect.objectContaining({
        adAccountId: 'act_123456',
        tokenSecretName: 'meta_graph_access_token_project_p1',
        credentialMode: 'project_secret',
      }),
    );
  });

  it('normalizes valid graph versions and drops invalid ones', () => {
    expect(
      router._normalizeMetaAdsForTest({
        graphVersion: ' v24.0 ',
      }),
    ).toEqual(expect.objectContaining({ graphVersion: 'v24.0' }));
    expect(
      router._normalizeMetaAdsForTest({
        graphVersion: 'v23.0',
      }),
    ).not.toHaveProperty('graphVersion');
    expect(
      router._normalizeMetaAdsForTest({
        graphVersion: '23',
      }),
    ).not.toHaveProperty('graphVersion');
  });

  it('rejects invalid budget rules before saving settings', () => {
    expect(() =>
      router._normalizeMetaAdsForTest({
        rules: {
          targetCpa: 45,
          minRoas: 2,
          maxIncreasePct: 150,
          maxDecreasePct: 20,
          minDailyBudget: 500,
          maxDailyBudget: 20,
          cooldownHours: 0,
          minSpend: 10,
        },
      }),
    ).toThrow('Invalid Meta Ads budget rules.');
  });

  it('defaults max daily budget to 2000 and normalizes monthly budget', () => {
    expect(
      router._normalizeMetaAdsForTest({
        monthlyBudget: {
          month: '2026-07',
          baseAmount: 5000,
          additionalAmount: 1000,
          allowedOverspendPct: 10,
        },
      }),
    ).toEqual(
      expect.objectContaining({
        rules: expect.objectContaining({ maxDailyBudget: 2000 }),
        monthlyBudget: {
          month: '2026-07',
          baseAmount: 5000,
          additionalAmount: 1000,
          allowedOverspendPct: 10,
        },
      }),
    );
  });

  it('normalizes client goal, analysis preset, enabled sections, and no-result cap', () => {
    expect(
      router._normalizeMetaAdsForTest({
        clientGoal: {
          resultType: 'purchase',
          monthlyTarget: 350,
        },
        automationAnalysisPreset: 'today',
        rules: {
          targetResultType: 'purchase',
          enabledSections: {
            performance: true,
            creatives: false,
            noResultSpendCap: true,
          },
          noResultSpendCap: {
            enabled: true,
            minSpend: 100,
          },
        },
      }),
    ).toEqual(
      expect.objectContaining({
        automationAnalysisPreset: 'today',
        clientGoal: {
          resultType: 'purchase',
          monthlyTarget: 350,
        },
        rules: expect.objectContaining({
          targetResultType: 'purchase',
          enabledSections: {
            performance: true,
            creatives: false,
            noResultSpendCap: true,
          },
          noResultSpendCap: {
            enabled: true,
            minSpend: 100,
          },
        }),
      }),
    );
  });

  it('rejects invalid monthly budget values', () => {
    expect(() =>
      router._normalizeMetaAdsForTest({
        monthlyBudget: {
          month: '2026-07',
          baseAmount: -1,
          additionalAmount: 0,
          allowedOverspendPct: 0,
        },
      }),
    ).toThrow('Invalid Meta Ads monthly budget.');
  });

  it('normalizes monthly budget history without changing prior months', () => {
    expect(
      router._normalizeMetaAdsForTest({
        monthlyBudget: {
          month: '2026-07',
          baseAmount: 7000,
          additionalAmount: 500,
          allowedOverspendPct: 5,
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
      }),
    ).toEqual(
      expect.objectContaining({
        monthlyBudget: {
          month: '2026-07',
          baseAmount: 7000,
          additionalAmount: 500,
          allowedOverspendPct: 5,
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
      }),
    );
  });

  it('rejects invalid monthly budget history values', () => {
    expect(() =>
      router._normalizeMetaAdsForTest({
        monthlyBudgets: {
          '2026-07': {
            baseAmount: -1,
            additionalAmount: 0,
            allowedOverspendPct: 0,
          },
        },
      }),
    ).toThrow('Invalid Meta Ads monthly budget.');
  });

  it('normalizes creative frequency alert rules separately from budget rules', () => {
    expect(
      router._normalizeMetaAdsForTest({
        creativeRules: {
          maxFrequency: 6,
          pauseHighCost: {
            enabled: true,
            maxCostPerResult: 45,
            lookbackDays: 3,
            minCreativesInScope: 3,
            minSpend: 20,
            cooldownHours: 48,
            targetResultType: 'thruplay',
          },
        },
      }),
    ).toEqual(
      expect.objectContaining({
        creativeRules: {
          maxFrequency: 6,
          pauseHighCost: {
            enabled: true,
            maxCostPerResult: 45,
            lookbackDays: 3,
            minCreativesInScope: 3,
            minSpend: 20,
            cooldownHours: 48,
            targetResultType: 'thruplay',
          },
        },
      }),
    );

    expect(() =>
      router._normalizeMetaAdsForTest({
        creativeRules: {
          maxFrequency: -1,
        },
      }),
    ).toThrow('Invalid Meta Ads creative rules.');
  });

  it('rejects creative pause values that the backend cannot execute', () => {
    expect(() =>
      router._normalizeMetaAdsForTest({
        creativeRules: {
          maxFrequency: 5,
          pauseHighCost: {
            enabled: true,
            maxCostPerResult: 45,
            lookbackDays: 3,
            minCreativesInScope: 2,
            minSpend: 10,
            cooldownHours: 0,
          },
        },
      }),
    ).toThrow('Invalid Meta Ads creative rules.');
  });

  it('returns validation details when settings save fails', async () => {
    const response = await request(createApp())
      .put('/projects/p1/meta-ads/settings')
      .send({
        metaAds: {
          creativeRules: {
            maxFrequency: 5,
            pauseHighCost: {
              enabled: true,
              maxCostPerResult: 45,
              lookbackDays: 3,
              minCreativesInScope: 2,
              minSpend: 10,
              cooldownHours: 0,
            },
          },
        },
      });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      message: 'Invalid Meta Ads creative rules.',
      details: ['pauseHighCost.minCreativesInScope', 'pauseHighCost.cooldownHours'],
    });
  });

  it('normalizes creative rules inside rule groups and overrides', () => {
    const result = router._normalizeMetaAdsForTest({
      ruleGroups: [
        {
          id: 'g1',
          name: 'Local video',
          entityLevel: 'campaign',
          entityIds: ['campaign-1'],
          creativeRules: {
            pauseHighCost: {
              enabled: true,
              maxCostPerResult: 35,
              lookbackDays: 2,
            },
          },
        },
      ],
      ruleOverrides: [
        {
          entityLevel: 'adset',
          entityId: 'adset-1',
          creativeRules: {
            pauseHighCost: {
              enabled: true,
              maxCostPerResult: 40,
              lookbackDays: 1,
            },
          },
        },
      ],
    });

    expect(result.ruleGroups[0].creativeRules.pauseHighCost).toEqual(
      expect.objectContaining({ maxCostPerResult: 35, lookbackDays: 2 }),
    );
    expect(result.ruleOverrides[0].creativeRules.pauseHighCost).toEqual(
      expect.objectContaining({ maxCostPerResult: 40, lookbackDays: 1 }),
    );
  });

  it('normalizes enabled rule overrides without saving unknown keys', () => {
    expect(
      router._normalizeMetaAdsForTest({
        ruleOverrides: [
          {
            entityLevel: 'campaign',
            entityId: 'campaign-1',
            entityName: 'Messages Floripa',
            enabled: true,
            ignored: true,
            rules: {
              targetCpa: 60,
              minRoas: 0,
              maxIncreasePct: 10,
              maxDecreasePct: 15,
              minDailyBudget: 20,
              maxDailyBudget: 1000,
              cooldownHours: 12,
              minSpend: 10,
            },
          },
          {
            entityLevel: 'adset',
            entityId: 'adset-1',
            enabled: false,
            rules: {
              targetCpa: 40,
            },
          },
        ],
      }),
    ).toEqual(
      expect.objectContaining({
        ruleOverrides: [
          expect.objectContaining({
            entityLevel: 'campaign',
            entityId: 'campaign-1',
            entityName: 'Messages Floripa',
            enabled: true,
            rules: expect.objectContaining({
              targetCpa: 60,
              maxDailyBudget: 1000,
            }),
          }),
          expect.objectContaining({
            entityLevel: 'adset',
            entityId: 'adset-1',
            entityName: undefined,
            enabled: false,
            rules: expect.objectContaining({
              targetCpa: 40,
            }),
          }),
        ],
      }),
    );
  });

  it('normalizes campaign rule groups for shared rules', () => {
    expect(
      router._normalizeMetaAdsForTest({
        ruleGroups: [
          {
            id: 'group-1',
            name: 'Floripa',
            entityLevel: 'campaign',
            entityIds: ['campaign-1', '', 'campaign-2'],
            enabled: true,
            ignored: true,
            rules: {
              targetCpa: 60,
            },
          },
        ],
      }),
    ).toEqual(
      expect.objectContaining({
        ruleGroups: [
          expect.objectContaining({
            id: 'group-1',
            name: 'Floripa',
            entityLevel: 'campaign',
            entityIds: ['campaign-1', 'campaign-2'],
            enabled: true,
            rules: expect.objectContaining({ targetCpa: 60 }),
          }),
        ],
      }),
    );
  });

  it('saves a pasted Meta token as a generated project secret', async () => {
    const upsertSecret = jest.fn(async () => ({}));

    const result = await router._prepareMetaAdsSettingsUpdateForTest({
      projectId: 'p1',
      tenantId: 'request-tenant',
      metaAds: {
        adAccountId: '123-456',
        metaAccessToken: 'must-not-save',
        accessToken: 'also-must-not-save',
      },
      metaAccessToken: `EAA${'a'.repeat(48)}`,
      resolveProject: jest.fn(async () => ({
        projectId: 'p1',
        tenantId: 'project-tenant',
      })),
      upsertSecret,
    });

    expect(upsertSecret).toHaveBeenCalledWith(
      'project-tenant',
      'meta_graph_access_token_project_p1',
      `EAA${'a'.repeat(48)}`,
      'meta_access_token',
    );
    expect(result).toEqual({
      metaAds: expect.objectContaining({
        adAccountId: 'act_123456',
        tokenSecretName: 'meta_graph_access_token_project_p1',
        credentialMode: 'project_secret',
      }),
    });
    expect(result.metaAds).not.toHaveProperty('metaAccessToken');
    expect(result.metaAds).not.toHaveProperty('accessToken');
  });

  it('does not alter project credentials when no token is submitted', async () => {
    const upsertSecret = jest.fn();

    const result = await router._prepareMetaAdsSettingsUpdateForTest({
      projectId: 'p1',
      tenantId: 'tenant-x',
      metaAds: {
        tokenSecretName: 'meta_graph_access_token_project_p1',
      },
      resolveProject: jest.fn(),
      upsertSecret,
    });

    expect(upsertSecret).not.toHaveBeenCalled();
    expect(result).toEqual({
      metaAds: expect.objectContaining({
        tokenSecretName: 'meta_graph_access_token_project_p1',
        credentialMode: 'project_secret',
      }),
    });
  });
});

describe('projectMetaAds tenant token route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    upsertTenantSecret.mockResolvedValue({});
  });

  it('saves the tenant global Meta token using the canonical secret name', async () => {
    const token = `EAA${'g'.repeat(48)}`;

    const response = await request(createApp())
      .put('/projects/p1/meta-ads/tenant-token')
      .send({ metaAccessToken: token })
      .expect(200);

    expect(upsertTenantSecret).toHaveBeenCalledWith(
      'tenant-x',
      'meta_graph_access_token',
      token,
      'meta_access_token',
    );
    expect(response.body).toEqual({
      credentials: {
        tenantConfigured: true,
        secretName: 'meta_graph_access_token',
      },
    });
    expect(JSON.stringify(response.body)).not.toContain(token);
  });

  it('rejects empty tenant global Meta tokens', async () => {
    await request(createApp())
      .put('/projects/p1/meta-ads/tenant-token')
      .send({ metaAccessToken: '   ' })
      .expect(400);

    expect(upsertTenantSecret).not.toHaveBeenCalled();
  });

  it('rejects invalid tenant global Meta token formats', async () => {
    await request(createApp())
      .put('/projects/p1/meta-ads/tenant-token')
      .send({ metaAccessToken: 'not-a-meta-token' })
      .expect(400);

    expect(upsertTenantSecret).not.toHaveBeenCalled();
  });
});

describe('projectMetaAds rankings route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getProjectMetaAdsRankings.mockResolvedValue({
      level: 'ad',
      period: {
        since: '2026-06-01',
        until: '2026-06-10',
      },
      currency: 'BRL',
      items: [],
    });
  });

  it('loads compiled BI rankings with independent period and filters', async () => {
    const response = await request(createApp())
      .get('/projects/p1/meta-ads/rankings')
      .query({
        level: 'ad',
        objective: 'OUTCOME_SALES',
        resultType: 'purchase',
        since: '2026-06-01',
        until: '2026-06-10',
      })
      .expect(200);

    expect(getProjectMetaAdsRankings).toHaveBeenCalledWith('p1', 'tenant-x', {
      level: 'ad',
      objective: 'OUTCOME_SALES',
      resultType: 'purchase',
      datePreset: undefined,
      since: '2026-06-01',
      until: '2026-06-10',
    });
    expect(response.body).toEqual({
      level: 'ad',
      period: {
        since: '2026-06-01',
        until: '2026-06-10',
      },
      currency: 'BRL',
      items: [],
    });
  });
});

describe('projectMetaAds run route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    analyzeProject.mockResolvedValue({ projectId: 'p1', recommendations: [] });
  });

  it('preserves Meta API error status for client-triggered runs', async () => {
    mockRouteUser = { id: 'user-1', role: SystemRoles.AD_MANAGER, tenantId: 'tenant-x' };
    analyzeProject.mockRejectedValueOnce(
      Object.assign(new Error('Invalid parameter'), {
        statusCode: 400,
        data: { code: 100, message: 'Invalid parameter' },
      }),
    );

    const response = await request(createApp()).post('/projects/p1/meta-ads/run').expect(400);

    expect(response.body).toEqual({
      message: 'Invalid parameter',
      details: { code: 100, message: 'Invalid parameter' },
    });
  });
});

describe('projectMetaAds role access', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getProjectMetaAdsStatus.mockResolvedValue({ snapshots: [], recommendations: [] });
    getProjectMetaAdsRankings.mockResolvedValue({
      level: 'ad',
      period: { since: '2026-06-01', until: '2026-06-10' },
      currency: 'BRL',
      items: [],
    });
    getProjectMetaAdsPerformance.mockResolvedValue({
      period: { datePreset: 'last_3d' },
      currency: 'BRL',
      summary: { actionCount: 0 },
      actions: [],
    });
    getProjectMetaAdsRulePerformance.mockResolvedValue({
      period: { datePreset: 'last_3d' },
      currency: 'BRL',
      rules: [],
    });
  });

  it('rejects USER access to Meta Ads status', async () => {
    mockRouteUser = { id: 'user-1', role: SystemRoles.USER, tenantId: 'tenant-x' };

    await request(createApp()).get('/projects/p1/meta-ads').expect(403);

    expect(getProjectMetaAdsStatus).not.toHaveBeenCalled();
  });

  it('allows AD-MANAGER access to Meta Ads status', async () => {
    mockRouteUser = { id: 'user-1', role: SystemRoles.AD_MANAGER, tenantId: 'tenant-x' };

    await request(createApp()).get('/projects/p1/meta-ads').expect(200);

    expect(getProjectMetaAdsStatus).toHaveBeenCalledWith('p1', 'tenant-x', {
      datePreset: undefined,
      since: undefined,
      until: undefined,
    });
  });

  it('rejects USER access to Meta Ads rankings', async () => {
    mockRouteUser = { id: 'user-1', role: SystemRoles.USER, tenantId: 'tenant-x' };

    await request(createApp()).get('/projects/p1/meta-ads/rankings').expect(403);

    expect(getProjectMetaAdsRankings).not.toHaveBeenCalled();
  });

  it('returns Meta Ads AI performance for a short preset', async () => {
    mockRouteUser = { id: 'user-1', role: SystemRoles.AD_MANAGER, tenantId: 'tenant-x' };

    await request(createApp())
      .get('/projects/p1/meta-ads/performance?datePreset=last_3d')
      .expect(200);

    expect(getProjectMetaAdsPerformance).toHaveBeenCalledWith('p1', 'tenant-x', {
      datePreset: 'last_3d',
      since: undefined,
      until: undefined,
    });
  });

  it('returns Meta Ads rule performance for a custom date range', async () => {
    mockRouteUser = { id: 'user-1', role: SystemRoles.AD_MANAGER, tenantId: 'tenant-x' };

    await request(createApp())
      .get('/projects/p1/meta-ads/rules/performance?since=2026-06-01&until=2026-06-03')
      .expect(200);

    expect(getProjectMetaAdsRulePerformance).toHaveBeenCalledWith('p1', 'tenant-x', {
      datePreset: undefined,
      since: '2026-06-01',
      until: '2026-06-03',
    });
  });
});

describe('projectMetaAds entity status route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    updateProjectMetaAdsEntityStatus.mockImplementation(
      async ({ entityLevel, entityId, status }) => ({
        entityLevel,
        entityId,
        status,
      }),
    );
  });

  it.each([
    ['campaign', '/projects/p1/meta-ads/campaigns/campaign-1/status', 'campaign-1'],
    ['adset', '/projects/p1/meta-ads/adsets/adset-1/status', 'adset-1'],
    ['ad', '/projects/p1/meta-ads/ads/ad-1/status', 'ad-1'],
  ])('updates a Meta %s status with client action access', async (entityLevel, path, entityId) => {
    const response = await request(createApp())
      .post(path)
      .send({ entityName: 'Creative A', status: 'PAUSED' })
      .expect(200);

    expect(updateProjectMetaAdsEntityStatus).toHaveBeenCalledWith({
      projectId: 'p1',
      tenantId: 'tenant-x',
      entityLevel,
      entityId,
      entityName: 'Creative A',
      status: 'PAUSED',
      actor: 'user',
      actorUserId: 'user-1',
    });
    expect(response.body).toEqual({ entityLevel, entityId, status: 'PAUSED' });
  });

  it('returns service validation errors for invalid Meta status payloads', async () => {
    updateProjectMetaAdsEntityStatus.mockRejectedValueOnce(
      Object.assign(new Error('Invalid Meta Ads status.'), { statusCode: 400 }),
    );

    const response = await request(createApp())
      .post('/projects/p1/meta-ads/ads/ad-1/status')
      .send({ status: 'ARCHIVED' })
      .expect(400);

    expect(response.body).toEqual({ message: 'Invalid Meta Ads status.' });
  });
});

describe('projectMetaAds duplicate route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    duplicateProjectMetaAdsEntity.mockImplementation(
      async ({ entityLevel, entityId, targetName }) => ({
        entityLevel,
        sourceEntityId: entityId,
        duplicatedEntityId: `${entityId}-copy`,
        duplicatedEntityName: targetName,
        status: 'INHERITED_FROM_SOURCE',
      }),
    );
  });

  it.each([
    ['campaign', 'campaign-1'],
    ['adset', 'adset-1'],
  ])('duplicates a Meta %s with client action access', async (entityLevel, entityId) => {
    const response = await request(createApp())
      .post('/projects/p1/meta-ads/duplicates')
      .send({
        entityLevel,
        entityId,
        entityName: 'Original',
        targetName: 'Original - cópia',
      })
      .expect(200);

    expect(duplicateProjectMetaAdsEntity).toHaveBeenCalledWith({
      projectId: 'p1',
      tenantId: 'tenant-x',
      entityLevel,
      entityId,
      entityName: 'Original',
      targetName: 'Original - cópia',
      actor: 'user',
      actorUserId: 'user-1',
    });
    expect(response.body).toEqual({
      entityLevel,
      sourceEntityId: entityId,
      duplicatedEntityId: `${entityId}-copy`,
      duplicatedEntityName: 'Original - cópia',
      status: 'INHERITED_FROM_SOURCE',
    });
  });

  it('allows an AD-MANAGER role to duplicate Meta entities after project view access', async () => {
    mockRouteUser = { id: 'user-1', role: SystemRoles.AD_MANAGER, tenantId: 'tenant-x' };

    await request(createApp())
      .post('/projects/p1/meta-ads/duplicates')
      .send({
        entityLevel: 'campaign',
        entityId: 'campaign-1',
        entityName: 'Original',
        targetName: 'Original - cópia',
      })
      .expect(200);

    expect(duplicateProjectMetaAdsEntity).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: 'p1',
        tenantId: 'tenant-x',
        entityLevel: 'campaign',
        entityId: 'campaign-1',
        actorUserId: 'user-1',
      }),
    );
  });

  it('blocks roles without Meta Ads permission', async () => {
    mockRouteUser = { id: 'user-1', role: 'GUEST', tenantId: 'tenant-x' };

    const response = await request(createApp())
      .post('/projects/p1/meta-ads/duplicates')
      .send({
        entityLevel: 'campaign',
        entityId: 'campaign-1',
        targetName: 'Copy',
      })
      .expect(403);

    expect(response.body).toEqual({ message: 'Insufficient Meta Ads permissions' });
    expect(duplicateProjectMetaAdsEntity).not.toHaveBeenCalled();
  });

  it('returns service validation errors for invalid duplicate payloads', async () => {
    duplicateProjectMetaAdsEntity.mockRejectedValueOnce(
      Object.assign(new Error('Invalid Meta Ads duplicate entity level.'), { statusCode: 400 }),
    );

    const response = await request(createApp())
      .post('/projects/p1/meta-ads/duplicates')
      .send({ entityLevel: 'ad', entityId: 'ad-1', targetName: 'Copy' })
      .expect(400);

    expect(response.body).toEqual({ message: 'Invalid Meta Ads duplicate entity level.' });
  });
});
