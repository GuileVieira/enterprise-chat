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
  createFile,
  deleteFiles,
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
  getProjectMetaAdsAutomationRuns,
  getProjectMetaAdsPerformance,
  getProjectMetaAdsRankings,
  getProjectMetaAdsRuleHistory,
  getProjectMetaAdsRulePerformance,
  getProjectMetaAdsStatus,
  recordProjectMetaAdsRuleChange,
  updateProjectMetaAdsEntityStatus,
} = require('~/server/services/MetaAds/budget');
const { isSupportedMetaGraphVersion } = require('~/server/services/MetaAds/graph');
const {
  deleteTrafficDiaryIndex,
  syncTrafficDiaryIndex,
} = require('~/server/services/Projects/trafficDiaryIndex');
const mongoose = require('mongoose');

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
  'this_month',
  'last_month',
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
const requireMetaAdsProjectEdit = canAccessProjectResource({
  requiredPermission: PermissionBits.EDIT,
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
const metaAdsDiaryEditAccess = metaAdsAccess;

function getDiaryActor(user) {
  return {
    id: user.id,
    ...(user.name ? { name: user.name } : {}),
    ...(user.email ? { email: user.email } : {}),
  };
}

function getDiaryTimeZone(user) {
  return (
    user?.timeZone ||
    user?.timezone ||
    process.env.META_ADS_TIME_ZONE ||
    process.env.TZ ||
    Intl.DateTimeFormat().resolvedOptions().timeZone ||
    'America/Sao_Paulo'
  );
}

function getDiaryDateKey(date = new Date(), timeZone = getDiaryTimeZone()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    day: '2-digit',
    month: '2-digit',
    timeZone,
    year: 'numeric',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function validateDiaryKind(value) {
  if (value == null || value === '') {
    return 'manager';
  }
  if (value !== 'manager' && value !== 'strategist') {
    throw Object.assign(new Error('Invalid diary kind.'), { statusCode: 400 });
  }
  return value;
}

function validateDiaryDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw Object.assign(new Error('date must be an ISO date.'), { statusCode: 400 });
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    throw Object.assign(new Error('date must be an ISO date.'), { statusCode: 400 });
  }
  return value;
}

function getDiaryPeriodQuery(query = {}) {
  const filter = {};
  if (query.since) {
    filter.date = { ...(filter.date ?? {}), $gte: validateDiaryDate(query.since) };
  }
  if (query.until) {
    filter.date = { ...(filter.date ?? {}), $lte: validateDiaryDate(query.until) };
  }
  return filter;
}

function normalizeDiaryEntry(entry) {
  if (!entry) {
    return entry;
  }
  const date = entry.date || entry.weekStart;
  return { ...entry, kind: entry.kind || 'manager', date, weekStart: entry.weekStart || date };
}

async function syncDiaryIndex({
  entry,
  project,
  req,
  syncIndex = syncTrafficDiaryIndex,
  createFileFn = createFile,
}) {
  const TrafficDiaryEntry = mongoose.models.TrafficDiaryEntry;
  await TrafficDiaryEntry.updateOne(
    { _id: entry._id },
    { $set: { indexStatus: 'pending' }, $unset: { indexError: 1 } },
  );
  try {
    await syncIndex({
      entry,
      project,
      req,
      userId: req.user.id,
      createFile: createFileFn,
    });
    return TrafficDiaryEntry.findByIdAndUpdate(
      entry._id,
      { $set: { indexStatus: 'indexed', indexedAt: new Date() }, $unset: { indexError: 1 } },
      { new: true, lean: true },
    );
  } catch (error) {
    logger.error('[projectMetaAds] diary indexing failed', error);
    return TrafficDiaryEntry.findByIdAndUpdate(
      entry._id,
      {
        $set: {
          indexStatus: 'failed',
          indexError: String(error.message || error).slice(0, 500),
        },
      },
      { new: true, lean: true },
    );
  }
}

async function hydrateDiaryAuthorNames(entries) {
  const missingIds = [
    ...new Set(
      entries
        .filter((entry) => !entry.createdBy?.name)
        .map((entry) => entry.userId || entry.createdBy?.id)
        .filter(Boolean),
    ),
  ];
  if (missingIds.length === 0) {
    return entries;
  }
  const users = await mongoose.models.User.find({ id: { $in: missingIds } })
    .select('id name email')
    .lean();
  const usersById = new Map(users.map((user) => [user.id, user]));
  return entries.map((entry) => {
    if (entry.createdBy?.name) {
      return entry;
    }
    const user = usersById.get(entry.userId || entry.createdBy?.id);
    return user
      ? { ...entry, createdBy: { ...entry.createdBy, name: user.name, email: user.email } }
      : entry;
  });
}

function validateDiaryAnswers(value) {
  if (!Array.isArray(value)) {
    throw Object.assign(new Error('answers must be an array.'), { statusCode: 400 });
  }
  const answers = value.map((answer) => {
    const id = typeof answer?.id === 'string' ? answer.id.trim() : '';
    const question = typeof answer?.question === 'string' ? answer.question.trim() : '';
    const text = typeof answer?.answer === 'string' ? answer.answer.trim() : '';
    const parentQuestionId =
      typeof answer?.parentQuestionId === 'string' ? answer.parentQuestionId.trim() : undefined;
    if (!id || !question || text.length > 20000 || question.length > 500) {
      throw Object.assign(new Error('Invalid diary answer.'), { statusCode: 400 });
    }
    return { id, question, answer: text, ...(parentQuestionId ? { parentQuestionId } : {}) };
  });
  return answers;
}

function getDiaryProjectFilter(project, extra = {}) {
  return {
    projectId: project.projectId,
    ...(project.tenantId ? { tenantId: project.tenantId } : {}),
    ...extra,
  };
}

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
  const monthlyConversionValueTarget = Number(clientGoal.monthlyConversionValueTarget ?? 0);
  const targetRoas = Number(clientGoal.targetRoas ?? 0);
  if (
    !resultType ||
    !Number.isFinite(monthlyTarget) ||
    monthlyTarget < 0 ||
    !Number.isFinite(monthlyConversionValueTarget) ||
    monthlyConversionValueTarget < 0 ||
    !Number.isFinite(targetRoas) ||
    targetRoas < 0
  ) {
    throw Object.assign(new Error('Invalid Meta Ads client goal.'), {
      statusCode: 400,
      details: ['clientGoal'],
    });
  }
  return {
    resultType,
    monthlyTarget,
    monthlyConversionValueTarget,
    targetRoas,
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
    validated.pauseHighCost = {
      enabled: pauseHighCost.enabled === true,
      maxCostPerResult,
      lookbackDays,
      minCreativesInScope,
      minSpend,
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

function getRuleOverrideAuditKey(ruleOverride) {
  return `${ruleOverride.entityLevel}:${ruleOverride.entityId}`;
}

function normalizeAuditDate(value) {
  if (!value) {
    return undefined;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function getAuditUser(user = {}) {
  const id = user.id ?? user._id;
  if (!id) {
    return undefined;
  }
  return {
    id: String(id),
    ...(typeof user.name === 'string' && user.name.trim() ? { name: user.name.trim() } : {}),
    ...(typeof user.email === 'string' && user.email.trim() ? { email: user.email.trim() } : {}),
  };
}

function omitRuleAudit(value) {
  if (Array.isArray(value)) {
    return value.map(omitRuleAudit);
  }
  if (!value || typeof value !== 'object') {
    return value;
  }
  return Object.entries(value).reduce((next, [key, nestedValue]) => {
    if (key !== 'ruleAudit' && key !== 'globalRuleAudit') {
      next[key] = omitRuleAudit(nestedValue);
    }
    return next;
  }, {});
}

function hasRuleAuditChange(previousValue, nextValue) {
  return (
    JSON.stringify(omitRuleAudit(previousValue ?? {})) !==
    JSON.stringify(omitRuleAudit(nextValue ?? {}))
  );
}

function buildRuleAudit({ previousAudit, fallbackCreatedAt, actorUser, now, changed, created }) {
  const createdAt = normalizeAuditDate(previousAudit?.createdAt) ?? fallbackCreatedAt ?? now;
  const createdBy = previousAudit?.createdBy ?? (created ? actorUser : undefined);
  const updatedAt =
    changed || created ? now : (normalizeAuditDate(previousAudit?.updatedAt) ?? createdAt);
  const updatedBy = changed || created ? actorUser : previousAudit?.updatedBy;

  return {
    createdAt,
    ...(createdBy ? { createdBy } : {}),
    updatedAt,
    ...(updatedBy ? { updatedBy } : {}),
  };
}

function applyMetaAdsRuleAudit({ previousProject, metaAds, user, now = new Date() }) {
  const actorUser = getAuditUser(user);
  const nowIso = now.toISOString();
  const fallbackCreatedAt =
    normalizeAuditDate(previousProject?.createdAt) ??
    normalizeAuditDate(previousProject?.updatedAt) ??
    nowIso;
  const previousMetaAds = previousProject?.metaAds ?? {};
  const previousGroups = new Map(
    (previousMetaAds.ruleGroups ?? []).map((group) => [group.id, group]),
  );
  const previousGroupsForCompare = new Map(
    normalizeRuleGroups(previousMetaAds.ruleGroups ?? []).map((group) => [group.id, group]),
  );
  const previousOverrides = new Map(
    (previousMetaAds.ruleOverrides ?? []).map((ruleOverride) => [
      getRuleOverrideAuditKey(ruleOverride),
      ruleOverride,
    ]),
  );
  const previousOverridesForCompare = new Map(
    normalizeRuleOverrides(previousMetaAds.ruleOverrides ?? []).map((ruleOverride) => [
      getRuleOverrideAuditKey(ruleOverride),
      ruleOverride,
    ]),
  );
  const globalBefore = {
    enabled: previousMetaAds.enabled,
    automationAnalysisPreset: previousMetaAds.automationAnalysisPreset,
    clientGoal: previousMetaAds.clientGoal,
    rules: previousMetaAds.rules,
    creativeRules: previousMetaAds.creativeRules,
  };
  const globalAfter = {
    enabled: metaAds.enabled,
    automationAnalysisPreset: metaAds.automationAnalysisPreset,
    clientGoal: metaAds.clientGoal,
    rules: metaAds.rules,
    creativeRules: metaAds.creativeRules,
  };

  return {
    ...metaAds,
    globalRuleAudit: buildRuleAudit({
      previousAudit: previousMetaAds.globalRuleAudit,
      fallbackCreatedAt,
      actorUser,
      now: nowIso,
      changed: hasRuleAuditChange(globalBefore, globalAfter),
      created:
        !previousMetaAds.globalRuleAudit &&
        !previousMetaAds.rules &&
        !previousMetaAds.creativeRules,
    }),
    ruleGroups: (metaAds.ruleGroups ?? []).map((group) => {
      const previousGroup = previousGroups.get(group.id);
      const previousGroupForCompare = previousGroupsForCompare.get(group.id);
      return {
        ...group,
        ruleAudit: buildRuleAudit({
          previousAudit: previousGroup?.ruleAudit,
          fallbackCreatedAt,
          actorUser,
          now: nowIso,
          changed: hasRuleAuditChange(previousGroupForCompare, group),
          created: !previousGroup,
        }),
      };
    }),
    ruleOverrides: (metaAds.ruleOverrides ?? []).map((ruleOverride) => {
      const previousOverride = previousOverrides.get(getRuleOverrideAuditKey(ruleOverride));
      const previousOverrideForCompare = previousOverridesForCompare.get(
        getRuleOverrideAuditKey(ruleOverride),
      );
      return {
        ...ruleOverride,
        ruleAudit: buildRuleAudit({
          previousAudit: previousOverride?.ruleAudit,
          fallbackCreatedAt,
          actorUser,
          now: nowIso,
          changed: hasRuleAuditChange(previousOverrideForCompare, ruleOverride),
          created: !previousOverride,
        }),
      };
    }),
  };
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

router.get('/runs', metaAdsAccess, async (req, res) => {
  try {
    const tenantId = req.user.tenantId || getTenantId();
    const limit = Number(req.query.limit ?? 20);
    return res.json(
      await getProjectMetaAdsAutomationRuns(req.params.projectId, tenantId, { limit }),
    );
  } catch (error) {
    logger.error('[projectMetaAds] automation runs failed', error);
    return res.status(error.statusCode ?? 500).json({ message: error.message });
  }
});

router.get('/diary', requireMetaAdsProjectView, async (req, res) => {
  try {
    const TrafficDiaryEntry = mongoose.models.TrafficDiaryEntry;
    if (!TrafficDiaryEntry) {
      throw new Error('Traffic diary model is unavailable.');
    }
    const project =
      (await getProjectById(req.params.projectId)) || (await findProjectById(req.params.projectId));
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }
    const kind = validateDiaryKind(req.query.kind);
    const entries = await TrafficDiaryEntry.find({
      ...getDiaryProjectFilter(project, { kind }),
      ...getDiaryPeriodQuery(req.query),
      ...(req.query.scope === 'project' || req.user.role === SystemRoles.OWNER
        ? {}
        : {
            $or: [
              { userId: req.user.id },
              { userId: { $exists: false }, 'createdBy.id': req.user.id },
            ],
          }),
    })
      .sort({ date: -1, weekStart: -1 })
      .limit(120)
      .lean();
    const hydratedEntries = await hydrateDiaryAuthorNames(entries);
    return res.json({ entries: hydratedEntries.map(normalizeDiaryEntry) });
  } catch (error) {
    logger.error('[projectMetaAds] diary list failed', error);
    return res.status(error.statusCode ?? 500).json({ message: error.message });
  }
});

router.put('/diary/:weekStart', metaAdsDiaryEditAccess, async (req, res) => {
  try {
    const TrafficDiaryEntry = mongoose.models.TrafficDiaryEntry;
    if (!TrafficDiaryEntry) {
      throw new Error('Traffic diary model is unavailable.');
    }
    const date = validateDiaryDate(req.params.weekStart);
    const kind = validateDiaryKind(req.body.kind ?? req.query.kind);
    const answers = validateDiaryAnswers(req.body.answers);
    const project =
      (await getProjectById(req.params.projectId)) || (await findProjectById(req.params.projectId));
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }
    const existing = await TrafficDiaryEntry.findOne(
      getDiaryProjectFilter(project, { userId: req.user.id, kind, date }),
    ).lean();
    const actor = getDiaryActor(req.user);
    const timeZone = getDiaryTimeZone(req.user);
    const now = new Date();
    const entry = await TrafficDiaryEntry.findOneAndUpdate(
      getDiaryProjectFilter(project, { userId: req.user.id, kind, date }),
      {
        $set: { answers, lastEditedBy: actor, timeZone, weekStart: date },
        ...(existing ? { $push: { events: { type: 'updated', actor, at: now } } } : {}),
        $setOnInsert: {
          projectId: project.projectId,
          ...(project.tenantId ? { tenantId: project.tenantId } : {}),
          userId: req.user.id,
          kind,
          date,
          status: 'draft',
          createdBy: actor,
          events: [{ type: 'created', actor, at: now }],
        },
      },
      { new: true, upsert: true, lean: true },
    );
    const indexedEntry = await syncDiaryIndex({ entry, project, req });
    return res.json(normalizeDiaryEntry(indexedEntry));
  } catch (error) {
    logger.error('[projectMetaAds] diary save failed', error);
    return res.status(error.statusCode ?? 500).json({ message: error.message });
  }
});

router.post('/diary/:entryId/complete', metaAdsDiaryEditAccess, async (req, res) => {
  try {
    const TrafficDiaryEntry = mongoose.models.TrafficDiaryEntry;
    if (!TrafficDiaryEntry || !mongoose.Types.ObjectId.isValid(req.params.entryId)) {
      return res.status(400).json({ message: 'Invalid diary entry' });
    }
    const project =
      (await getProjectById(req.params.projectId)) || (await findProjectById(req.params.projectId));
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }
    const entry = await TrafficDiaryEntry.findOne(
      getDiaryProjectFilter(project, {
        _id: req.params.entryId,
        $or: [{ userId: req.user.id }, { userId: { $exists: false }, 'createdBy.id': req.user.id }],
      }),
    ).lean();
    if (!entry) {
      return res.status(404).json({ message: 'Diary entry not found' });
    }
    validateDiaryAnswers(entry.answers);
    if (entry.status === 'completed') {
      return res.json(normalizeDiaryEntry(entry));
    }
    const actor = getDiaryActor(req.user);
    const entryDate =
      entry.date || entry.weekStart || getDiaryDateKey(new Date(), getDiaryTimeZone(req.user));
    const completed = await TrafficDiaryEntry.findByIdAndUpdate(
      entry._id,
      {
        $set: {
          userId: req.user.id,
          kind: entry.kind || 'manager',
          date: entryDate,
          weekStart: entryDate,
          timeZone: entry.timeZone || getDiaryTimeZone(req.user),
          status: 'completed',
          completedBy: actor,
          completedAt: new Date(),
          lastEditedBy: actor,
        },
        $push: { events: { type: 'completed', actor, at: new Date() } },
      },
      { new: true, lean: true },
    );
    const indexedEntry = await syncDiaryIndex({ entry: completed, project, req });
    return res.json(normalizeDiaryEntry(indexedEntry));
  } catch (error) {
    logger.error('[projectMetaAds] diary completion failed', error);
    return res.status(error.statusCode ?? 500).json({ message: error.message });
  }
});

router.post('/diary/:entryId/reopen', metaAdsDiaryEditAccess, async (req, res) => {
  try {
    const TrafficDiaryEntry = mongoose.models.TrafficDiaryEntry;
    if (!TrafficDiaryEntry || !mongoose.Types.ObjectId.isValid(req.params.entryId)) {
      return res.status(400).json({ message: 'Invalid diary entry' });
    }
    const project =
      (await getProjectById(req.params.projectId)) || (await findProjectById(req.params.projectId));
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }
    const actor = getDiaryActor(req.user);
    const timeZone = getDiaryTimeZone(req.user);
    const reopened = await TrafficDiaryEntry.findOneAndUpdate(
      getDiaryProjectFilter(project, {
        _id: req.params.entryId,
        $or: [{ userId: req.user.id }, { userId: { $exists: false }, 'createdBy.id': req.user.id }],
        status: 'completed',
      }),
      {
        $set: { status: 'draft', lastEditedBy: actor, timeZone },
        $push: { events: { type: 'reopened', actor, at: new Date() } },
      },
      { new: true, lean: true },
    );
    if (!reopened) {
      return res.status(404).json({ message: 'Completed diary entry not found' });
    }
    const indexedEntry = await syncDiaryIndex({ entry: reopened, project, req });
    return res.json(normalizeDiaryEntry(indexedEntry));
  } catch (error) {
    logger.error('[projectMetaAds] diary reopen failed', error);
    return res.status(error.statusCode ?? 500).json({ message: error.message });
  }
});

router.post('/diary/:entryId/reprocess', requireMetaAdsProjectEdit, async (req, res) => {
  try {
    const TrafficDiaryEntry = mongoose.models.TrafficDiaryEntry;
    if (!TrafficDiaryEntry || !mongoose.Types.ObjectId.isValid(req.params.entryId)) {
      return res.status(400).json({ message: 'Invalid diary entry' });
    }
    const project =
      (await getProjectById(req.params.projectId)) || (await findProjectById(req.params.projectId));
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }
    const entry = await TrafficDiaryEntry.findOne(
      getDiaryProjectFilter(project, {
        _id: req.params.entryId,
      }),
    ).lean();
    if (!entry) {
      return res.status(404).json({ message: 'Diary entry not found' });
    }
    const indexedEntry = await syncDiaryIndex({ entry, project, req });
    return res.json(normalizeDiaryEntry(indexedEntry));
  } catch (error) {
    logger.error('[projectMetaAds] diary reprocess failed', error);
    return res.status(error.statusCode ?? 500).json({ message: error.message });
  }
});

router.delete('/diary/:entryId', metaAdsDiaryEditAccess, async (req, res) => {
  try {
    const TrafficDiaryEntry = mongoose.models.TrafficDiaryEntry;
    if (!TrafficDiaryEntry || !mongoose.Types.ObjectId.isValid(req.params.entryId)) {
      return res.status(400).json({ message: 'Invalid diary entry' });
    }
    const project =
      (await getProjectById(req.params.projectId)) || (await findProjectById(req.params.projectId));
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }
    const deleted = await TrafficDiaryEntry.findOneAndDelete(
      getDiaryProjectFilter(project, {
        _id: req.params.entryId,
        $or: [{ userId: req.user.id }, { userId: { $exists: false }, 'createdBy.id': req.user.id }],
      }),
    ).lean();
    if (!deleted) {
      return res.status(404).json({ message: 'Diary entry not found' });
    }
    await deleteTrafficDiaryIndex({ entry: deleted, req, deleteFiles });
    return res.status(204).send();
  } catch (error) {
    logger.error('[projectMetaAds] diary delete failed', error);
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
    update.metaAds = applyMetaAdsRuleAudit({
      previousProject,
      metaAds: update.metaAds,
      user: req.user,
    });
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
      actorUserName: req.user.name,
      actorUserEmail: req.user.email,
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
  const startedAt = new Date();
  const startedAtMs = Date.now();
  const tenantId = req.user.tenantId || getTenantId();

  try {
    const result = await analyzeProject({ projectId: req.params.projectId, actor: 'user' });
    const finishedAt = new Date();
    logger.info('[projectMetaAds] run finished', {
      projectId: req.params.projectId,
      tenantId,
      actorUserId: req.user.id,
      adAccountId: result.adAccountId,
      recommendationCount: Array.isArray(result.recommendations)
        ? result.recommendations.length
        : 0,
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      durationMs: Date.now() - startedAtMs,
    });
    return res.json(result);
  } catch (error) {
    const finishedAt = new Date();
    logger.error('[projectMetaAds] run failed', {
      projectId: req.params.projectId,
      tenantId,
      actorUserId: req.user.id,
      message: error.message,
      stack: error.stack,
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      durationMs: Date.now() - startedAtMs,
    });
    return res.status(error.statusCode ?? 500).json({
      message: error.message,
      ...(error.data ? { details: error.data } : {}),
    });
  }
});

router.post('/budget', metaAdsClientActionAccess, async (req, res) => {
  try {
    const result = await applyManualBudgetChange({
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
    return res.json(result);
  } catch (error) {
    logger.error('[projectMetaAds] manual budget failed', error);
    return res.status(error.statusCode ?? 500).json({
      message: error.message,
      ...(error.data ? { details: error.data } : {}),
    });
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
router._applyMetaAdsRuleAuditForTest = applyMetaAdsRuleAudit;
router._validateDiaryAnswersForTest = validateDiaryAnswers;
router._validateDiaryDateForTest = validateDiaryDate;
router._getDiaryDateKeyForTest = getDiaryDateKey;
router._syncTrafficDiaryIndexForTest = syncTrafficDiaryIndex;
router._syncDiaryIndexForTest = syncDiaryIndex;
router._deleteTrafficDiaryIndexForTest = deleteTrafficDiaryIndex;

module.exports = router;
