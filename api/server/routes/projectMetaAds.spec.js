jest.mock('~/models', () => ({
  updateProject: jest.fn(),
}));

jest.mock('~/server/middleware', () => ({
  requireJwtAuth: (_req, _res, next) => next(),
}));

jest.mock('~/server/middleware/accessResources/canAccessProject', () => ({
  canAccessProjectResource: () => (_req, _res, next) => next(),
}));

jest.mock('~/server/services/Config/app', () => ({
  getAppConfig: jest.fn(async () => ({ interfaceConfig: { metaAds: true } })),
}));

jest.mock('~/server/services/MetaAds/budget', () => ({
  analyzeProject: jest.fn(),
  applyRecommendation: jest.fn(),
  getProjectMetaAdsStatus: jest.fn(),
}));

const router = require('./projectMetaAds');

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
});
