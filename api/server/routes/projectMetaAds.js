const express = require('express');
const {
  PermissionBits,
  PermissionTypes,
  Permissions,
  SystemRoles,
} = require('librechat-data-provider');
const { logger, getTenantId, SystemCapabilities } = require('@librechat/data-schemas');
const {
  findProjectById,
  getProjectById,
  getRoleByName,
  updateProject,
  upsertTenantSecret,
} = require('~/models');
const { requireJwtAuth } = require('~/server/middleware');
const { requireCapability } = require('~/server/middleware/roles/capabilities');
const {
  canAccessProjectResource,
} = require('~/server/middleware/accessResources/canAccessProject');
const { getAppConfig } = require('~/server/services/Config/app');
const {
  analyzeProject,
  applyManualBudgetChange,
  applyRecommendation,
  duplicateProjectMetaAdsEntity,
  getProjectMetaAdsPerformance,
  getProjectMetaAdsRankings,
  getProjectMetaAdsRuleHistory,
  getProjectMetaAdsRulePerformance,
  getProjectMetaAdsStatus,
  recordProjectMetaAdsRuleChange,
  updateProjectMetaAdsEntityStatus,
} = require('~/server/services/MetaAds/budget');
const { isSupportedMetaGraphVersion } = require('~/server/services/MetaAds/graph');

const router = express.Router({ mergeParams: true });

router.use(requireJwtAuth);

const SCHEDULE_INTERVALS = new Set([30, 60, 120, 180, 360, 720, 1440]);
const META_ACCESS_TOKEN_SECRET_NAME = 'meta_graph_access_token';
const META_ACCESS_TOKEN_SECRET_TYPE = 'meta_access_token';
const requireManageConfigs = requireCapability(SystemCapabilities.MANAGE_CONFIGS);
const META_ADS_SYSTEM_ROLES = new Set([
  SystemRoles.ADMIN,
  SystemRoles.OWNER,
  SystemRoles.AD_MANAGER,
]);
const DEFAULT_RULES = {
  targetCpa: 45,
  minRoas: 2,
  maxIncreasePct: 25,
  maxDecreasePct: 25,
  minDailyBudget: 20,
  maxDailyBudget: 2000,
  cooldownHours: 24,
  minSpend: 10,
  primaryMetric: 'cpa',
  enabledSections: {
    performance: true,
    creatives: true,
    noResultSpendCap: false,
  },
  noResultSpendCap: {
    enabled: false,
    minSpend: 10,
  },
};
const ACCOUNT_PROFILES = new Set(['local_business', 'ecommerce', 'lead_gen', 'traffic', 'custom']);
const PRIMARY_METRICS = new Set(['cpa', 'roas', 'cpc', 'ctr']);
const ANALYSIS_PRESETS = new Set([
  'today',
  'yesterday',
  'last_6h',
  'last_24h',
  'last_2d',
  'last_3d',
  'last_7d',
  'last_14d',
  'last_30d',
]);
const DEFAULT_CREATIVE_RULES = {
  maxFrequency: 5,
};
const RULE_LIMITS = {
  targetCpa: { min: 0.01 },
  minRoas: { min: 0 },
  maxIncreasePct: { min: 0, max: 100 },
  maxDecreasePct: { min: 0, max: 100 },
  minDailyBudget: { min: 0.01 },
  maxDailyBudget: { min: 0.01 },
  cooldownHours: { min: 1, max: 168 },
  minSpend: { min: 0 },
  minCtr: { min: 0 },
  maxCpc: { min: 0 },
  maxCpm: { min: 0 },
};
const CREATIVE_RULE_LIMITS = {
  maxFrequency: { min: 0 },
};
const PAUSE_HIGH_COST_DEFAULTS = {
  enabled: false,
  maxCostPerResult: 45,
  lookbackDays: 3,
  minCreativesInScope: 3,
  minSpend: 10,
  cooldownHours: 24,
  targetResultType: '',
};

function validateEnabledSections(sections = {}) {
  return {
    performance: sections.performance !== false,
    creatives: sections.creatives !== false,
    noResultSpendCap: sections.noResultSpendCap === true,
  };
}

function validateNoResultSpendCap(value = {}) {
  const minSpend = Number(value.minSpend ?? DEFAULT_RULES.noResultSpendCap.minSpend);
  if (!Number.isFinite(minSpend) || minSpend < 0) {
    throw Object.assign(new Error('Invalid Meta Ads budget rules.'), {
      statusCode: 400,
      details: ['noResultSpendCap.minSpend'],
    });
  }
  return {
    enabled: value.enabled === true,
    minSpend,
  };
}

function getCurrentMonthInputValue(date = new Date()) {
  return date.toISOString().slice(0, 7);
}

function getProjectMetaTokenSecretName(projectId) {
  return `meta_graph_access_token_project_${projectId}`;
}

function looksLikeMetaAccessToken(value) {
  return typeof value === 'string' && /^EAA[a-zA-Z0-9_-]{40,}$/.test(value.trim());
}

const requireMetaAdsProjectView = canAccessProjectResource({
  requiredPermission: PermissionBits.VIEW,
});

async function requireMetaAdsRoleAccess(req, res, next) {
  try {
    const roleName = req.user?.role;
    if (!roleName) {
      return res.status(403).json({ message: 'Insufficient Meta Ads permissions' });
    }
    if (META_ADS_SYSTEM_ROLES.has(roleName)) {
      return next();
    }
    const role = await getRoleByName(roleName);
    if (role?.permissions?.[PermissionTypes.META_ADS]?.[Permissions.USE] !== true) {
      return res.status(403).json({ message: 'Insufficient Meta Ads permissions' });
    }
    return next();
  } catch (error) {
    logger.error('[projectMetaAds] role access check failed', error);
    return res.status(500).json({ message: error.message });
  }
}

const metaAdsAccess = [requireMetaAdsProjectView, requireMetaAdsRoleAccess];
const metaAdsClientActionAccess = metaAdsAccess;

function validateMetaAdsRules(rules = {}) {
  const merged = { ...DEFAULT_RULES, ...(rules ?? {}) };
  const validated = {};
  const errors = [];
  for (const [key, limits] of Object.entries(RULE_LIMITS)) {
    if (
      ['minCtr', 'maxCpc', 'maxCpm'].includes(key) &&
      (merged[key] == null || merged[key] === '')
    ) {
      continue;
    }
    const value = Number(merged[key]);
    validated[key] = value;
    if (
      !Number.isFinite(value) ||
      value < limits.min ||
      (limits.max != null && value > limits.max)
    ) {
      errors.push(key);
    }
  }
  const targetResultType =
    typeof merged.targetResultType === 'string' ? merged.targetResultType.trim() : '';
  if (targetResultType) {
    validated.targetResultType = targetResultType;
  }
  const primaryMetric =
    typeof merged.primaryMetric === 'string'
      ? merged.primaryMetric.trim()
      : DEFAULT_RULES.primaryMetric;
  validated.primaryMetric = PRIMARY_METRICS.has(primaryMetric)
    ? primaryMetric
    : DEFAULT_RULES.primaryMetric;
  validated.enabledSections = validateEnabledSections(merged.enabledSections);
  validated.noResultSpendCap = validateNoResultSpendCap(merged.noResultSpendCap);
  if (validated.minDailyBudget > validated.maxDailyBudget) {
    errors.push('minDailyBudget', 'maxDailyBudget');
  }
  if (errors.length > 0) {
    throw Object.assign(new Error('Invalid Meta Ads budget rules.'), {
      statusCode: 400,
      details: [...new Set(errors)],
    });
  }
  return validated;
}

function validateClientGoal(clientGoal = undefined) {
  if (!clientGoal || typeof clientGoal !== 'object') {
    return undefined;
  }
  const resultType = typeof clientGoal.resultType === 'string' ? clientGoal.resultType.trim() : '';
  const monthlyTarget = Number(clientGoal.monthlyTarget ?? 0);
  if (!resultType || !Number.isFinite(monthlyTarget) || monthlyTarget < 0) {
    throw Object.assign(new Error('Invalid Meta Ads client goal.'), {
      statusCode: 400,
      details: ['clientGoal'],
    });
  }
  return {
    resultType,
    monthlyTarget,
  };
}

function validateMetaAdsCreativeRules(rules = {}) {
  const merged = { ...DEFAULT_CREATIVE_RULES, ...(rules ?? {}) };
  const validated = {};
  const errors = [];
  for (const [key, limits] of Object.entries(CREATIVE_RULE_LIMITS)) {
    const value = Number(merged[key]);
    validated[key] = value;
    if (
      !Number.isFinite(value) ||
      value < limits.min ||
      (limits.max != null && value > limits.max)
    ) {
      errors.push(key);
    }
  }
  const rawPauseHighCost = merged.pauseHighCost;
  if (rawPauseHighCost && typeof rawPauseHighCost === 'object') {
    const pauseHighCost = {
      ...PAUSE_HIGH_COST_DEFAULTS,
      ...rawPauseHighCost,
    };
    const maxCostPerResult = Number(pauseHighCost.maxCostPerResult);
    const lookbackDays = Number(pauseHighCost.lookbackDays);
    const minCreativesInScope = Number(pauseHighCost.minCreativesInScope);
    const minSpend = Number(pauseHighCost.minSpend);
    const cooldownHours = Number(pauseHighCost.cooldownHours);
    if (!Number.isFinite(maxCostPerResult) || maxCostPerResult <= 0) {
      errors.push('pauseHighCost.maxCostPerResult');
    }
    if (![1, 2, 3, 7].includes(lookbackDays)) {
      errors.push('pauseHighCost.lookbackDays');
    }
    if (!Number.isInteger(minCreativesInScope) || minCreativesInScope < 3) {
      errors.push('pauseHighCost.minCreativesInScope');
    }
    if (!Number.isFinite(minSpend) || minSpend < 0) {
      errors.push('pauseHighCost.minSpend');
    }
    if (!Number.isFinite(cooldownHours) || cooldownHours < 1 || cooldownHours > 168) {
      errors.push('pauseHighCost.cooldownHours');
    }
    validated.pauseHighCost = {
      enabled: pauseHighCost.enabled === true,
      maxCostPerResult,
      lookbackDays,
      minCreativesInScope,
      minSpend,
      cooldownHours,
      targetResultType:
        typeof pauseHighCost.targetResultType === 'string'
          ? pauseHighCost.targetResultType.trim()
          : '',
    };
  }
  if (errors.length > 0) {
    throw Object.assign(new Error('Invalid Meta Ads creative rules.'), {
      statusCode: 400,
      details: [...new Set(errors)],
    });
  }
  return validated;
}

function validateMonthlyBudget(monthlyBudget = undefined) {
  if (!monthlyBudget || typeof monthlyBudget !== 'object') {
    return undefined;
  }
  const month =
    typeof monthlyBudget.month === 'string' && /^\d{4}-\d{2}$/.test(monthlyBudget.month.trim())
      ? monthlyBudget.month.trim()
      : getCurrentMonthInputValue();
  const validated = { month };
  const errors = [];
  for (const key of ['baseAmount', 'additionalAmount', 'allowedOverspendPct']) {
    const value = Number(monthlyBudget[key] ?? 0);
    if (!Number.isFinite(value) || value < 0) {
      errors.push(`monthlyBudget.${key}`);
      continue;
    }
    validated[key] = value;
  }
  if (errors.length > 0) {
    throw Object.assign(new Error('Invalid Meta Ads monthly budget.'), {
      statusCode: 400,
      details: errors,
    });
  }
  return validated;
}

function validateMonthlyBudgets(monthlyBudgets = undefined) {
  if (!monthlyBudgets || typeof monthlyBudgets !== 'object' || Array.isArray(monthlyBudgets)) {
    return undefined;
  }
  return Object.entries(monthlyBudgets).reduce((validated, [month, monthlyBudget]) => {
    if (!/^\d{4}-\d{2}$/.test(month)) {
      return validated;
    }
    const budget = validateMonthlyBudget({ ...(monthlyBudget ?? {}), month });
    if (budget) {
      const { month: _month, ...budgetValues } = budget;
      validated[month] = budgetValues;
    }
    return validated;
  }, {});
}

function normalizeRuleOverrides(ruleOverrides = []) {
  if (!Array.isArray(ruleOverrides)) {
    return [];
  }
  return ruleOverrides
    .map((override) => {
      const entityLevel = override?.entityLevel;
      const entityId =
        typeof override?.entityId === 'string' && override.entityId.trim()
          ? override.entityId.trim()
          : '';
      if (!['campaign', 'adset'].includes(entityLevel) || !entityId) {
        return null;
      }
      return {
        entityLevel,
        entityId,
        entityName:
          typeof override.entityName === 'string' && override.entityName.trim()
            ? override.entityName.trim()
            : undefined,
        enabled: override.enabled !== false,
        ...(ANALYSIS_PRESETS.has(override.analysisPreset)
          ? { analysisPreset: override.analysisPreset }
          : {}),
        rules: validateMetaAdsRules(override.rules),
        creativeRules: validateMetaAdsCreativeRules(override.creativeRules),
      };
    })
    .filter(Boolean);
}

function normalizeRuleGroups(ruleGroups = []) {
  if (!Array.isArray(ruleGroups)) {
    return [];
  }
  return ruleGroups
    .map((group) => {
      const entityLevel = group?.entityLevel;
      const entityIds = Array.isArray(group?.entityIds)
        ? group.entityIds.filter((entityId) => typeof entityId === 'string' && entityId.trim())
        : [];
      if (!['campaign', 'adset'].includes(entityLevel) || entityIds.length === 0) {
        return null;
      }
      return {
        id:
          typeof group.id === 'string' && group.id.trim()
            ? group.id.trim()
            : `${entityLevel}-${entityIds.join('-')}`,
        name:
          typeof group.name === 'string' && group.name.trim() ? group.name.trim() : entityIds[0],
        entityLevel,
        entityIds: [...new Set(entityIds.map((entityId) => entityId.trim()))],
        enabled: group.enabled !== false,
        ...(ANALYSIS_PRESETS.has(group.analysisPreset)
          ? { analysisPreset: group.analysisPreset }
          : {}),
        rules: validateMetaAdsRules(group.rules),
        creativeRules: validateMetaAdsCreativeRules(group.creativeRules),
      };
    })
    .filter(Boolean);
}

async function requireMetaAdsFeature(req, res, next) {
  try {
    const appConfig = await getAppConfig({
      role: req.user.role,
      userId: req.user.id,
      tenantId: req.user.tenantId || getTenantId(),
    });
    if (appConfig?.interfaceConfig?.metaAds === false) {
      return res.status(404).json({ message: 'Meta Ads is disabled.' });
    }
    return next();
  } catch (error) {
    logger.error('[projectMetaAds] feature check failed', error);
    return res.status(500).json({ message: error.message });
  }
}

router.use(requireMetaAdsFeature);

function normalizeMetaAds(metaAds = {}) {
  const {
    metaAccessToken: _metaAccessToken,
    accessToken: _accessToken,
    graphVersion: rawGraphVersion,
    ...safeMetaAds
  } = metaAds;
  const digits =
    typeof safeMetaAds.adAccountId === 'string'
      ? safeMetaAds.adAccountId.replace(/^act_/i, '').replace(/\D/g, '')
      : '';
  const tokenSecretName =
    typeof safeMetaAds.tokenSecretName === 'string' ? safeMetaAds.tokenSecretName.trim() : '';
  const graphVersion =
    typeof rawGraphVersion === 'string' && isSupportedMetaGraphVersion(rawGraphVersion.trim())
      ? rawGraphVersion.trim()
      : undefined;
  const accountProfile = ACCOUNT_PROFILES.has(safeMetaAds.accountProfile)
    ? safeMetaAds.accountProfile
    : 'custom';
  if (looksLikeMetaAccessToken(tokenSecretName)) {
    throw Object.assign(
      new Error('Token secret name must be a secret name, not the Meta access token value.'),
      { statusCode: 400 },
    );
  }
  return {
    ...safeMetaAds,
    adAccountId: digits ? `act_${digits}` : safeMetaAds.adAccountId,
    tokenSecretName,
    rules: validateMetaAdsRules(safeMetaAds.rules),
    creativeRules: validateMetaAdsCreativeRules(safeMetaAds.creativeRules),
    ruleGroups: normalizeRuleGroups(safeMetaAds.ruleGroups),
    ruleOverrides: normalizeRuleOverrides(safeMetaAds.ruleOverrides),
    monthlyBudget: validateMonthlyBudget(safeMetaAds.monthlyBudget),
    monthlyBudgets: validateMonthlyBudgets(safeMetaAds.monthlyBudgets),
    accountProfile,
    automationAnalysisPreset: ANALYSIS_PRESETS.has(safeMetaAds.automationAnalysisPreset)
      ? safeMetaAds.automationAnalysisPreset
      : 'last_2d',
    clientGoal: validateClientGoal(safeMetaAds.clientGoal),
    ...(graphVersion ? { graphVersion } : {}),
    credentialMode: tokenSecretName ? 'project_secret' : 'tenant_default',
    scheduleIntervalMinutes: SCHEDULE_INTERVALS.has(Number(safeMetaAds.scheduleIntervalMinutes))
      ? Number(safeMetaAds.scheduleIntervalMinutes)
      : 180,
  };
}

async function resolveProjectForMetaAdsSettings(projectId) {
  return (await getProjectById(projectId)) || (await findProjectById(projectId));
}

async function prepareMetaAdsSettingsUpdate({
  projectId,
  tenantId,
  metaAds,
  metaAccessToken,
  resolveProject = resolveProjectForMetaAdsSettings,
  upsertSecret = upsertTenantSecret,
}) {
  const normalized = normalizeMetaAds(metaAds);
  const trimmedToken = typeof metaAccessToken === 'string' ? metaAccessToken.trim() : '';
  if (!trimmedToken) {
    return { metaAds: normalized };
  }

  const project = await resolveProject(projectId);
  if (!project) {
    return null;
  }

  const projectSecretName = getProjectMetaTokenSecretName(project.projectId || projectId);
  logger.debug('[projectMetaAds] saving project Meta token secret', {
    projectId,
    tenantId: project.tenantId || tenantId || getTenantId(),
    secretName: projectSecretName,
    tokenLength: trimmedToken.length,
  });
  await upsertSecret(
    project.tenantId || tenantId || getTenantId(),
    projectSecretName,
    trimmedToken,
    META_ACCESS_TOKEN_SECRET_TYPE,
  );

  return {
    metaAds: {
      ...normalized,
      tokenSecretName: projectSecretName,
      credentialMode: 'project_secret',
    },
  };
}

router.get('/', metaAdsAccess, async (req, res) => {
  try {
    const tenantId = req.user.tenantId || getTenantId();
    const scope = ['snapshot', 'live'].includes(req.query.scope) ? req.query.scope : undefined;
    logger.debug('[projectMetaAds] status requested', {
      tenantId,
      projectId: req.params.projectId,
      scope,
    });
    return res.json(
      await getProjectMetaAdsStatus(req.params.projectId, tenantId, {
        scope,
        datePreset: req.query.datePreset,
        since: req.query.since,
        until: req.query.until,
      }),
    );
  } catch (error) {
    logger.error('[projectMetaAds] status failed', error);
    return res.status(500).json({ message: error.message });
  }
});

router.get('/rankings', metaAdsAccess, async (req, res) => {
  try {
    const tenantId = req.user.tenantId || getTenantId();
    return res.json(
      await getProjectMetaAdsRankings(req.params.projectId, tenantId, {
        level: req.query.level,
        objective: req.query.objective,
        resultType: req.query.resultType,
        datePreset: req.query.datePreset,
        since: req.query.since,
        until: req.query.until,
      }),
    );
  } catch (error) {
    logger.error('[projectMetaAds] rankings failed', error);
    return res.status(error.statusCode ?? 500).json({ message: error.message });
  }
});

router.get('/performance', metaAdsAccess, async (req, res) => {
  try {
    const tenantId = req.user.tenantId || getTenantId();
    return res.json(
      await getProjectMetaAdsPerformance(req.params.projectId, tenantId, {
        datePreset: req.query.datePreset,
        since: req.query.since,
        until: req.query.until,
      }),
    );
  } catch (error) {
    logger.error('[projectMetaAds] performance failed', error);
    return res.status(error.statusCode ?? 500).json({ message: error.message });
  }
});

router.get('/rules/performance', metaAdsAccess, async (req, res) => {
  try {
    const tenantId = req.user.tenantId || getTenantId();
    return res.json(
      await getProjectMetaAdsRulePerformance(req.params.projectId, tenantId, {
        datePreset: req.query.datePreset,
        since: req.query.since,
        until: req.query.until,
      }),
    );
  } catch (error) {
    logger.error('[projectMetaAds] rule performance failed', error);
    return res.status(error.statusCode ?? 500).json({ message: error.message });
  }
});

router.get('/rules/history', metaAdsAccess, async (req, res) => {
  try {
    const tenantId = req.user.tenantId || getTenantId();
    return res.json(await getProjectMetaAdsRuleHistory(req.params.projectId, tenantId));
  } catch (error) {
    logger.error('[projectMetaAds] rule history failed', error);
    return res.status(error.statusCode ?? 500).json({ message: error.message });
  }
});

router.put('/settings', metaAdsClientActionAccess, async (req, res) => {
  try {
    const previousProject =
      (await getProjectById(req.params.projectId)) || (await findProjectById(req.params.projectId));
    const update = await prepareMetaAdsSettingsUpdate({
      projectId: req.params.projectId,
      tenantId: req.user.tenantId,
      metaAds: req.body.metaAds,
      metaAccessToken: req.body.metaAccessToken,
    });
    if (!update) {
      return res.status(404).json({ message: 'Project not found' });
    }
    const project = await updateProject(req.params.projectId, update);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }
    await recordProjectMetaAdsRuleChange({
      projectId: req.params.projectId,
      tenantId: project.tenantId || req.user.tenantId || getTenantId(),
      beforeMetaAds: previousProject?.metaAds,
      afterMetaAds: project.metaAds,
      actor: 'user',
      actorUserId: req.user.id,
    });
    logger.debug('[projectMetaAds] settings saved', {
      projectId: req.params.projectId,
      hasProjectTokenSecret: !!project.metaAds?.tokenSecretName,
    });
    return res.json(project);
  } catch (error) {
    logger.error('[projectMetaAds] settings failed', error);
    return res.status(error.statusCode ?? 500).json({
      message: error.message,
      ...(Array.isArray(error.details) ? { details: error.details } : {}),
    });
  }
});

router.put('/tenant-token', requireManageConfigs, async (req, res) => {
  try {
    const token =
      typeof req.body.metaAccessToken === 'string' ? req.body.metaAccessToken.trim() : '';
    if (!token) {
      return res.status(400).json({ message: 'metaAccessToken is required' });
    }
    if (!looksLikeMetaAccessToken(token)) {
      return res.status(400).json({ message: 'Invalid metaAccessToken format' });
    }
    const tenantId = req.user.tenantId || getTenantId();
    await upsertTenantSecret(
      tenantId,
      META_ACCESS_TOKEN_SECRET_NAME,
      token,
      META_ACCESS_TOKEN_SECRET_TYPE,
    );
    logger.debug('[projectMetaAds] tenant Meta token secret saved', {
      tenantId,
      tokenLength: token.length,
    });
    return res.json({
      credentials: {
        tenantConfigured: true,
        secretName: META_ACCESS_TOKEN_SECRET_NAME,
      },
    });
  } catch (error) {
    logger.error('[projectMetaAds] tenant token failed', error);
    return res.status(error.statusCode ?? 500).json({ message: error.message });
  }
});

router.post('/run', metaAdsClientActionAccess, async (req, res) => {
  try {
    return res.json(await analyzeProject({ projectId: req.params.projectId, actor: 'user' }));
  } catch (error) {
    logger.error('[projectMetaAds] run failed', error);
    return res.status(error.statusCode ?? 500).json({
      message: error.message,
      ...(error.data ? { details: error.data } : {}),
    });
  }
});

router.post('/budget', metaAdsClientActionAccess, async (req, res) => {
  try {
    const change = await applyManualBudgetChange({
      projectId: req.params.projectId,
      tenantId: req.user.tenantId || getTenantId(),
      entityLevel: req.body.entityLevel,
      entityId: req.body.entityId,
      entityName: req.body.entityName,
      dailyBudget: req.body.dailyBudget,
      reason: req.body.reason,
      actor: 'user',
      actorUserId: req.user.id,
    });
    return res.json(change);
  } catch (error) {
    logger.error('[projectMetaAds] manual budget failed', error);
    return res.status(error.statusCode ?? 500).json({ message: error.message });
  }
});

router.post('/duplicates', metaAdsClientActionAccess, async (req, res) => {
  try {
    const result = await duplicateProjectMetaAdsEntity({
      projectId: req.params.projectId,
      tenantId: req.user.tenantId || getTenantId(),
      entityLevel: req.body.entityLevel,
      entityId: req.body.entityId,
      entityName: req.body.entityName,
      targetName: req.body.targetName,
      actor: 'user',
      actorUserId: req.user.id,
    });
    return res.json(result);
  } catch (error) {
    logger.error('[projectMetaAds] duplicate failed', error);
    return res.status(error.statusCode ?? 500).json({ message: error.message });
  }
});

const metaAdsStatusRoutes = [
  { path: '/campaigns/:entityId/status', entityLevel: 'campaign' },
  { path: '/adsets/:entityId/status', entityLevel: 'adset' },
  { path: '/ads/:entityId/status', entityLevel: 'ad' },
];

for (const route of metaAdsStatusRoutes) {
  router.post(route.path, metaAdsClientActionAccess, async (req, res) => {
    try {
      const result = await updateProjectMetaAdsEntityStatus({
        projectId: req.params.projectId,
        tenantId: req.user.tenantId || getTenantId(),
        entityLevel: route.entityLevel,
        entityId: req.params.entityId,
        entityName: req.body.entityName,
        status: req.body.status,
        actor: 'user',
        actorUserId: req.user.id,
      });
      return res.json(result);
    } catch (error) {
      logger.error('[projectMetaAds] entity status update failed', error);
      return res.status(error.statusCode ?? 500).json({ message: error.message });
    }
  });
}

router.post(
  '/recommendations/:recommendationId/apply',
  metaAdsClientActionAccess,
  async (req, res) => {
    try {
      const recommendation = await applyRecommendation({
        recommendationId: req.params.recommendationId,
        projectId: req.params.projectId,
        tenantId: req.user.tenantId || getTenantId(),
        actor: 'user',
        actorUserId: req.user.id,
      });
      return res.json({ recommendation });
    } catch (error) {
      logger.error('[projectMetaAds] apply failed', error);
      return res.status(500).json({ message: error.message });
    }
  },
);

router._normalizeMetaAdsForTest = normalizeMetaAds;
router._prepareMetaAdsSettingsUpdateForTest = prepareMetaAdsSettingsUpdate;
router._getProjectMetaTokenSecretNameForTest = getProjectMetaTokenSecretName;

module.exports = router;
