const MetaAdsBudgetManager = require('../MetaAdsBudgetManager');
const {
  applyManualBudgetChange,
  duplicateProjectMetaAdsEntity,
  updateProjectMetaAdsEntityFields,
  updateProjectMetaAdsEntityStatus,
} = require('~/server/services/MetaAds/budget');
const {
  findProjectForRequest,
  userCanAccessProject,
} = require('~/server/services/Projects/access');
const { getRoleByName } = require('~/models');

jest.mock('~/models', () => ({ updateProject: jest.fn(), getRoleByName: jest.fn() }));
jest.mock('~/server/services/Projects/access', () => ({
  findProjectForRequest: jest.fn(),
  userCanAccessProject: jest.fn(),
}));
jest.mock('~/server/services/MetaAds/budget', () => ({
  analyzeProject: jest.fn(),
  applyManualBudgetChange: jest.fn(),
  applyRecommendation: jest.fn(),
  duplicateProjectMetaAdsEntity: jest.fn(),
  getProjectMetaAdsStatus: jest.fn(),
  updateProjectMetaAdsEntityFields: jest.fn(),
  updateProjectMetaAdsEntityStatus: jest.fn(),
}));

function createTool() {
  return new MetaAdsBudgetManager({
    req: { user: { id: 'user-1', role: 'AD-MANAGER', tenantId: 'tenant-1' } },
  });
}

describe('MetaAdsBudgetManager write actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    findProjectForRequest.mockResolvedValue({ projectId: 'project-1', tenantId: 'tenant-1' });
    userCanAccessProject.mockResolvedValue(true);
    getRoleByName.mockResolvedValue(null);
  });

  it('blocks users whose role lacks Meta Ads USE permission', async () => {
    const tool = new MetaAdsBudgetManager({
      req: { user: { id: 'user-1', role: 'REPORTER', tenantId: 'tenant-1' } },
    });
    getRoleByName.mockResolvedValue({ permissions: { META_ADS: { USE: false } } });

    const output = JSON.parse(await tool._call({ action: 'get_status', project_id: 'project-1' }));

    expect(output).toEqual({
      ok: false,
      error: { message: 'Insufficient Meta Ads permissions.' },
    });
    expect(findProjectForRequest).not.toHaveBeenCalled();
  });

  it('updates budget through the tenant-scoped Meta Graph service', async () => {
    applyManualBudgetChange.mockResolvedValue({ change: { newDailyBudget: 125 } });

    const output = JSON.parse(
      await createTool()._call({
        action: 'update_budget',
        project_id: 'project-1',
        entity_id: 'campaign-1',
        entity_level: 'campaign',
        daily_budget: 125,
      }),
    );

    expect(output).toEqual({
      ok: true,
      action: 'update_budget',
      confirmation: { confirmed: true, entityId: 'campaign-1', dailyBudget: 125 },
      change: { newDailyBudget: 125 },
    });
    expect(applyManualBudgetChange).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: 'project-1',
        tenantId: 'tenant-1',
        actor: 'tool',
        actorUserId: 'user-1',
        entityId: 'campaign-1',
        entityLevel: 'campaign',
        dailyBudget: 125,
      }),
    );
  });

  it.each([
    ['pause_campaign', 'PAUSED'],
    ['activate_campaign', 'ACTIVE'],
  ])('%s changes the real campaign status', async (action, status) => {
    updateProjectMetaAdsEntityStatus.mockResolvedValue({
      entityLevel: 'campaign',
      entityId: 'campaign-1',
      status,
    });

    const output = JSON.parse(
      await createTool()._call({ action, project_id: 'project-1', entity_id: 'campaign-1' }),
    );

    expect(output.ok).toBe(true);
    expect(output.status).toBe(status);
    expect(output.confirmation).toEqual({ confirmed: true, entityId: 'campaign-1', status });
    expect(updateProjectMetaAdsEntityStatus).toHaveBeenCalledWith(
      expect.objectContaining({ entityLevel: 'campaign', entityId: 'campaign-1', status }),
    );
  });

  it('duplicates an ad set and returns its new Meta id', async () => {
    duplicateProjectMetaAdsEntity.mockResolvedValue({
      sourceEntityId: 'adset-1',
      duplicatedEntityId: 'adset-2',
      duplicatedEntityName: 'Cópia controlada',
    });

    const output = JSON.parse(
      await createTool()._call({
        action: 'duplicate_adset',
        project_id: 'project-1',
        entity_id: 'adset-1',
        target_name: 'Cópia controlada',
      }),
    );

    expect(output).toEqual(
      expect.objectContaining({
        ok: true,
        action: 'duplicate_adset',
        duplicatedEntityId: 'adset-2',
        confirmation: {
          confirmed: true,
          sourceEntityId: 'adset-1',
          duplicatedEntityId: 'adset-2',
        },
      }),
    );
    expect(duplicateProjectMetaAdsEntity).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        entityLevel: 'adset',
        entityId: 'adset-1',
        targetName: 'Cópia controlada',
      }),
    );
  });

  it('does not call Meta when project EDIT is denied', async () => {
    userCanAccessProject.mockResolvedValue(false);

    const output = JSON.parse(
      await createTool()._call({
        action: 'pause_campaign',
        project_id: 'project-1',
        entity_id: 'campaign-1',
      }),
    );

    expect(output).toEqual({ ok: false, error: { message: 'Project access denied.' } });
    expect(updateProjectMetaAdsEntityStatus).not.toHaveBeenCalled();
  });

  it('returns safe Meta permission diagnostics to the agent', async () => {
    updateProjectMetaAdsEntityStatus.mockRejectedValue(
      Object.assign(new Error('Token Meta Ads sem ads_management.'), {
        statusCode: 403,
        data: { code: 200, error_subcode: 18157520, access_token: 'must-not-leak' },
      }),
    );

    const output = JSON.parse(
      await createTool()._call({
        action: 'pause_campaign',
        project_id: 'project-1',
        entity_id: 'campaign-1',
      }),
    );

    expect(output).toEqual({
      ok: false,
      error: {
        message: 'Token Meta Ads sem ads_management.',
        statusCode: 403,
        code: 200,
        subcode: 18157520,
      },
    });
    expect(JSON.stringify(output)).not.toContain('must-not-leak');
  });

  it('updates whitelisted ad set targeting and returns provider readback', async () => {
    updateProjectMetaAdsEntityFields.mockResolvedValue({
      entityLevel: 'adset',
      entityId: 'adset-1',
      updatedFields: ['targeting', 'optimization_goal'],
      current: { id: 'adset-1', targeting: { age_min: 25 }, optimization_goal: 'REACH' },
    });

    const output = JSON.parse(
      await createTool()._call({
        action: 'update_entity',
        project_id: 'project-1',
        entity_level: 'adset',
        entity_id: 'adset-1',
        fields: { targeting: { age_min: 25 }, optimization_goal: 'REACH' },
      }),
    );

    expect(output.confirmation).toEqual({
      confirmed: true,
      entityId: 'adset-1',
      updatedFields: ['targeting', 'optimization_goal'],
    });
    expect(updateProjectMetaAdsEntityFields).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        entityLevel: 'adset',
        entityId: 'adset-1',
        fields: { targeting: { age_min: 25 }, optimization_goal: 'REACH' },
      }),
    );
  });

  it('changes status at ad set or ad level', async () => {
    updateProjectMetaAdsEntityStatus.mockResolvedValue({
      entityLevel: 'ad',
      entityId: 'ad-1',
      status: 'PAUSED',
    });

    const output = JSON.parse(
      await createTool()._call({
        action: 'set_status',
        project_id: 'project-1',
        entity_level: 'ad',
        entity_id: 'ad-1',
        status: 'PAUSED',
      }),
    );

    expect(output.confirmation).toEqual({ confirmed: true, entityId: 'ad-1', status: 'PAUSED' });
    expect(updateProjectMetaAdsEntityStatus).toHaveBeenCalledWith(
      expect.objectContaining({ entityLevel: 'ad', entityId: 'ad-1', status: 'PAUSED' }),
    );
  });

  it('duplicates campaigns through the existing copy service', async () => {
    duplicateProjectMetaAdsEntity.mockResolvedValue({
      sourceEntityId: 'campaign-1',
      duplicatedEntityId: 'campaign-2',
      duplicatedEntityName: 'Campaign copy',
    });

    const output = JSON.parse(
      await createTool()._call({
        action: 'duplicate_entity',
        project_id: 'project-1',
        entity_level: 'campaign',
        entity_id: 'campaign-1',
        target_name: 'Campaign copy',
      }),
    );

    expect(output.confirmation.duplicatedEntityId).toBe('campaign-2');
    expect(duplicateProjectMetaAdsEntity).toHaveBeenCalledWith(
      expect.objectContaining({ entityLevel: 'campaign', entityId: 'campaign-1' }),
    );
  });
});
