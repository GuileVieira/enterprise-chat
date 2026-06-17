const express = require('express');
const request = require('supertest');

jest.mock('~/models', () => ({
  findProjectById: jest.fn(),
  getProjectById: jest.fn(),
  updateProject: jest.fn(),
  upsertTenantSecret: jest.fn(),
}));

jest.mock('~/server/middleware', () => ({
  requireJwtAuth: (req, _res, next) => {
    req.user = { id: 'user-1', role: 'ADMIN', tenantId: 'tenant-x' };
    next();
  },
}));

jest.mock('~/server/middleware/roles/capabilities', () => ({
  requireCapability: () => (_req, _res, next) => next(),
}));

jest.mock('~/server/middleware/accessResources/canAccessProject', () => ({
  canAccessProjectResource: () => (_req, _res, next) => next(),
}));

jest.mock('~/server/services/Config/app', () => ({
  getAppConfig: jest.fn(async () => ({ interfaceConfig: { metaAds: true } })),
}));

jest.mock('~/server/services/MetaAds/budget', () => ({
  analyzeProject: jest.fn(),
  applyManualBudgetChange: jest.fn(),
  applyRecommendation: jest.fn(),
  getProjectMetaAdsStatus: jest.fn(),
}));

const router = require('./projectMetaAds');
const { upsertTenantSecret } = require('~/models');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/projects/:projectId/meta-ads', router);
  return app;
}

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

  it('normalizes creative frequency alert rules separately from budget rules', () => {
    expect(
      router._normalizeMetaAdsForTest({
        creativeRules: {
          maxFrequency: 6,
        },
      }),
    ).toEqual(
      expect.objectContaining({
        creativeRules: {
          maxFrequency: 6,
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
          {
            entityLevel: 'campaign',
            entityId: 'campaign-1',
            entityName: 'Messages Floripa',
            enabled: true,
            rules: expect.objectContaining({
              targetCpa: 60,
              maxDailyBudget: 1000,
            }),
          },
          {
            entityLevel: 'adset',
            entityId: 'adset-1',
            entityName: undefined,
            enabled: false,
            rules: expect.objectContaining({
              targetCpa: 40,
            }),
          },
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
          {
            id: 'group-1',
            name: 'Floripa',
            entityLevel: 'campaign',
            entityIds: ['campaign-1', 'campaign-2'],
            enabled: true,
            rules: expect.objectContaining({ targetCpa: 60 }),
          },
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

    await request(createApp())
      .put('/projects/p1/meta-ads/tenant-token')
      .send({ metaAccessToken: token })
      .expect(200);

    expect(upsertTenantSecret).toHaveBeenCalledWith(
      'tenant-x',
      'meta_graph_access_token',
      token,
      'meta_access_token',
    );
  });

  it('rejects empty tenant global Meta tokens', async () => {
    await request(createApp())
      .put('/projects/p1/meta-ads/tenant-token')
      .send({ metaAccessToken: '   ' })
      .expect(400);

    expect(upsertTenantSecret).not.toHaveBeenCalled();
  });
});
