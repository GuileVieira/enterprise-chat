const mongoose = require('mongoose');
const { logger, runAsSystem, getTenantId } = require('@librechat/data-schemas');
const { getProjectById, findProjectById, getTenantSecret, getUserById } = require('~/models');
const { getAppConfig } = require('~/server/services/Config/app');
const {
  copyMetaEntity,
  getAdAccountCurrency,
  getEntityDailyBudget,
  getMetaGraphVersion,
  isSupportedMetaGraphVersion,
  listAds,
  listAdInsights,
  listCampaignInsights,
  listCampaigns,
  listAdSetInsights,
  listAdSets,
  metaPost,
  updateMetaEntityName,
  updateMetaEntityStatus,
} = require('~/server/services/MetaAds/graph');

const META_TOKEN_SECRET_NAME = 'meta_graph_access_token';
const DEFAULT_SCHEDULE_INTERVAL_MINUTES = 180;
const DEFAULT_CRON_PROJECT_TIMEOUT_MS = 45000;
const DEFAULT_CRON_PROJECT_CONCURRENCY = 2;
const DEFAULT_CRON_ENTITY_CONCURRENCY = 5;
const DEFAULT_META_ADS_TIME_ZONE = 'America/Sao_Paulo';
const SCHEDULE_INTERVALS = new Set([30, 60, 120, 180, 360, 720, 1440]);
const MIN_SAMPLE_SPEND = 10;
const STATUS_PERIOD_CACHE_TTL_MS = 10 * 60 * 1000;
const STATUS_PERIOD_TODAY_CACHE_TTL_MS = 10 * 60 * 1000;
const STATUS_PERIOD_HISTORICAL_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const statusPeriodCache = new Map();
const ACTION_COOLDOWN_MINUTES = {
  budget_change: 60,
  pause_ad: 60,
};
const DEFAULT_RULES = {
  targetCpa: 45,
  minRoas: 2,
  maxIncreasePct: 25,
  maxDecreasePct: 25,
  minDailyBudget: 20,
  maxDailyBudget: 2000,
  minSpend: MIN_SAMPLE_SPEND,
  conversionEvidenceMultiplier: 2,
  conversionEvidenceMinHours: 6,
  primaryMetric: 'cpa',
  enabledSections: {
    performance: true,
    creatives: true,
    noResultSpendCap: false,
  },
  noResultSpendCap: {
    enabled: false,
    minSpend: MIN_SAMPLE_SPEND,
  },
};
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
const DEFAULT_CREATIVE_RULES = {};
const RULE_LIMITS = {
  targetCpa: { min: 0.01 },
  minRoas: { min: 0 },
  maxIncreasePct: { min: 0, max: 100 },
  maxDecreasePct: { min: 0, max: 100 },
  minDailyBudget: { min: 0.01 },
  maxDailyBudget: { min: 0.01 },
  minSpend: { min: 0 },
  conversionEvidenceMultiplier: { min: 1, max: 10 },
  conversionEvidenceMinHours: { min: 0, max: 168 },
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
  minSpend: MIN_SAMPLE_SPEND,
  targetResultType: '',
};
const AGGREGATE_RESULT_TYPES = new Set([
  'page_engagement',
  'post',
  'post_engagement',
  'post_interaction',
  'onsite_conversion.post_interaction_gross',
]);
const VIDEO_RESULT_TYPES = new Set(['video_view', 'thruplay']);
const CANONICAL_RESULT_TYPES = {
  instagram_profile_visit: 'instagram_profile_visit',
  profile_visit: 'instagram_profile_visit',
  instagram_profile_visits: 'instagram_profile_visit',
  ig_profile_visit: 'instagram_profile_visit',
  video_view: 'thruplay',
  thruplay: 'thruplay',
  video_thruplay: 'thruplay',
  video_thruplay_watched_actions: 'thruplay',
  leadgen_grouped: 'lead',
  'offsite_conversion.fb_pixel_lead': 'lead',
  offsite_conversion_fb_pixel_lead: 'lead',
  'onsite_conversion.lead_grouped': 'lead',
  onsite_conversion_lead_grouped: 'lead',
  omni_purchase: 'purchase',
  'offsite_conversion.fb_pixel_purchase': 'purchase',
  offsite_conversion_fb_pixel_purchase: 'purchase',
  'onsite_conversion.messaging_first_reply': 'onsite_conversion.messaging_conversation_started_7d',
  onsite_conversion_messaging_first_reply: 'onsite_conversion.messaging_conversation_started_7d',
};
const OPTIMIZATION_GOAL_RESULT_TYPES = {
  MESSAGING_CONVERSATIONS: 'onsite_conversion.messaging_conversation_started_7d',
  CONVERSATIONS: 'onsite_conversion.messaging_conversation_started_7d',
  LEAD_GENERATION: 'lead',
  OFFSITE_CONVERSIONS: 'purchase',
  VALUE: 'purchase',
  THRUPLAY: 'thruplay',
  VIDEO_VIEWS: 'thruplay',
  POST_ENGAGEMENT: 'post_engagement',
  PAGE_LIKES: 'page_engagement',
  LANDING_PAGE_VIEWS: 'landing_page_view',
  LINK_CLICKS: 'link_click',
};
const RESULT_ACTION_PRIORITY = [
  'onsite_conversion.messaging_conversation_started_7d',
  'instagram_profile_visit',
  'profile_visit',
  'onsite_conversion.messaging_first_reply',
  'onsite_conversion.lead_grouped',
  'offsite_conversion.fb_pixel_lead',
  'leadgen_grouped',
  'lead',
  'omni_purchase',
  'offsite_conversion.fb_pixel_purchase',
  'purchase',
];

function getMetaAdsMonthRange(month, _timeZone = getMetaAdsTimeZone(), now = new Date()) {
  const match = typeof month === 'string' ? month.match(/^(\d{4})-(\d{2})$/) : null;
  const year = match ? Number(match[1]) : now.getUTCFullYear();
  const monthIndex = match ? Number(match[2]) - 1 : now.getUTCMonth();
  const start = new Date(Date.UTC(year, monthIndex, 1));
  const end = new Date(Date.UTC(year, monthIndex + 1, 0));
  const monthKey = `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
  const currentMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const remainingDays =
    start > currentMonthStart
      ? end.getUTCDate()
      : start < currentMonthStart
        ? 0
        : Math.max(0, end.getUTCDate() - now.getUTCDate() + 1);
  return {
    since: `${monthKey}-01`,
    until: `${monthKey}-${String(end.getUTCDate()).padStart(2, '0')}`,
    remainingDays,
  };
}

function getMetaAdsMonthKey(month, now = new Date()) {
  const match = typeof month === 'string' ? month.match(/^(\d{4})-(\d{2})$/) : null;
  if (match) {
    return `${match[1]}-${match[2]}`;
  }
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}

function getMonthlyBudgetEntries(monthlyBudgets = {}) {
  if (monthlyBudgets instanceof Map) {
    return Array.from(monthlyBudgets.entries());
  }
  return Object.entries(monthlyBudgets);
}

function getMonthlyBudgetEntry(monthlyBudgets = {}, month) {
  if (monthlyBudgets instanceof Map) {
    return monthlyBudgets.get(month);
  }
  return monthlyBudgets[month];
}

function resolveMonthlyBudget(metaAds = {}, month, now = new Date()) {
  const monthKey = getMetaAdsMonthKey(month, now);
  const monthlyBudgets = metaAds.monthlyBudgets ?? {};
  const monthlyBudget = getMonthlyBudgetEntry(monthlyBudgets, monthKey);
  if (monthlyBudget) {
    return {
      month: monthKey,
      ...monthlyBudget,
    };
  }
  const inheritedMonth = getMonthlyBudgetEntries(monthlyBudgets)
    .map(([key]) => key)
    .filter((key) => /^\d{4}-\d{2}$/.test(key) && key <= monthKey)
    .sort()
    .pop();
  if (inheritedMonth) {
    return {
      month: monthKey,
      ...getMonthlyBudgetEntry(monthlyBudgets, inheritedMonth),
    };
  }
  if (metaAds.monthlyBudget) {
    return {
      ...metaAds.monthlyBudget,
      month: monthKey,
    };
  }
  return { month: monthKey };
}

function getMonthlyBudgetLimit(monthlyBudget = {}) {
  const baseAmount = Number(monthlyBudget.baseAmount ?? 0);
  const additionalAmount = Number(monthlyBudget.additionalAmount ?? 0);
  const allowedOverspendPct = Number(monthlyBudget.allowedOverspendPct ?? 0);
  if (
    !Number.isFinite(baseAmount) ||
    !Number.isFinite(additionalAmount) ||
    !Number.isFinite(allowedOverspendPct) ||
    baseAmount + additionalAmount <= 0
  ) {
    return null;
  }
  return Number(((baseAmount + additionalAmount) * (1 + allowedOverspendPct / 100)).toFixed(2));
}

function buildMonthlyBudgetState({ monthlyBudget, insightRows = [], now = new Date() }) {
  const limit = getMonthlyBudgetLimit(monthlyBudget);
  if (limit == null) {
    return null;
  }
  const { remainingDays } = getMetaAdsMonthRange(monthlyBudget?.month, getMetaAdsTimeZone(), now);
  const spend = insightRows.reduce((sum, row) => {
    const metrics = calculateMetrics(row, undefined);
    return sum + Number(metrics.spend ?? 0);
  }, 0);
  return {
    limit,
    spend: Number(spend.toFixed(2)),
    remainingDays,
  };
}

function buildMonthlyBudgetStatus({ monthlyBudget, insightRows = [], now = new Date() }) {
  const state = buildMonthlyBudgetState({ monthlyBudget, insightRows, now });
  if (!state) {
    return null;
  }
  const baseAmount = Number(monthlyBudget.baseAmount ?? 0);
  const additionalAmount = Number(monthlyBudget.additionalAmount ?? 0);
  const allowedOverspendPct = Number(monthlyBudget.allowedOverspendPct ?? 0);
  const remaining = Math.max(0, Number((state.limit - state.spend).toFixed(2)));
  const exceededBy = Math.max(0, Number((state.spend - state.limit).toFixed(2)));
  const spentPct = state.limit > 0 ? Math.round((state.spend / state.limit) * 100) : 0;

  return {
    month: monthlyBudget.month,
    baseAmount,
    additionalAmount,
    allowedOverspendPct,
    limit: state.limit,
    spend: state.spend,
    remaining,
    exceededBy,
    spentPct,
    remainingDays: state.remainingDays,
  };
}

function buildProgressItem({ target, actual, integerTarget = false }) {
  if (!Number.isFinite(target) || target <= 0) {
    return null;
  }
  const normalizedTarget = integerTarget ? Math.ceil(target) : Number(target.toFixed(2));
  const normalizedActual = Number((Number(actual ?? 0) || 0).toFixed(2));
  return {
    target: normalizedTarget,
    actual: normalizedActual,
    remaining: Math.max(0, Number((normalizedTarget - normalizedActual).toFixed(2))),
    percent: Math.round((normalizedActual / normalizedTarget) * 100),
  };
}

function getMonthDayCount(month, now = new Date()) {
  const { until } = getMetaAdsMonthRange(month, getMetaAdsTimeZone(), now);
  return Number(until.slice(-2));
}

function sumInsightMetric(rows, targetResultType, metric) {
  return rows.reduce((sum, row) => {
    const metrics = calculateMetrics(row, targetResultType);
    return sum + Number(metrics[metric] ?? 0);
  }, 0);
}

function calculateRoasProgress(rows, targetResultType) {
  const spend = sumInsightMetric(rows, targetResultType, 'spend');
  if (spend <= 0) {
    return 0;
  }
  return sumInsightMetric(rows, targetResultType, 'conversionValue') / spend;
}

function buildGoalProgress({
  monthlyBudget,
  clientGoal,
  accountProfile,
  monthlyRows = [],
  todayRows = [],
  now = new Date(),
}) {
  const monthDayCount = getMonthDayCount(monthlyBudget?.month, now);
  const monthlyBudgetLimit = getMonthlyBudgetLimit(monthlyBudget);
  const investment =
    monthlyBudgetLimit == null
      ? undefined
      : {
          month: buildProgressItem({
            target: monthlyBudgetLimit,
            actual: sumInsightMetric(monthlyRows, undefined, 'spend'),
          }),
          day: buildProgressItem({
            target: monthlyBudgetLimit / monthDayCount,
            actual: sumInsightMetric(todayRows, undefined, 'spend'),
          }),
        };
  const resultTarget = Number(clientGoal?.monthlyTarget ?? 0);
  const conversionValueTarget = Number(clientGoal?.monthlyConversionValueTarget ?? 0);
  const targetRoas = Number(clientGoal?.targetRoas ?? 0);
  const resultType = clientGoal?.resultType || resolveTargetResultType({ accountProfile });
  const result =
    resultType && Number.isFinite(resultTarget) && resultTarget > 0
      ? {
          resultType,
          month: buildProgressItem({
            target: resultTarget,
            actual: sumInsightMetric(monthlyRows, resultType, 'resultCount'),
            integerTarget: true,
          }),
          day: buildProgressItem({
            target: resultTarget / monthDayCount,
            actual: sumInsightMetric(todayRows, resultType, 'resultCount'),
            integerTarget: true,
          }),
        }
      : undefined;
  const conversionValue =
    Number.isFinite(conversionValueTarget) && conversionValueTarget > 0
      ? {
          month: buildProgressItem({
            target: conversionValueTarget,
            actual: sumInsightMetric(monthlyRows, resultType, 'conversionValue'),
          }),
          day: buildProgressItem({
            target: conversionValueTarget / monthDayCount,
            actual: sumInsightMetric(todayRows, resultType, 'conversionValue'),
          }),
        }
      : undefined;
  const roas =
    Number.isFinite(targetRoas) && targetRoas > 0
      ? {
          month: buildProgressItem({
            target: targetRoas,
            actual: calculateRoasProgress(monthlyRows, resultType),
          }),
          day: buildProgressItem({
            target: targetRoas,
            actual: calculateRoasProgress(todayRows, resultType),
          }),
        }
      : undefined;
  return {
    ...(investment?.month && investment?.day ? { investment } : {}),
    ...(result?.month && result?.day ? { result } : {}),
    ...(conversionValue?.month && conversionValue?.day ? { conversionValue } : {}),
    ...(roas?.month && roas?.day ? { roas } : {}),
  };
}

function applyMonthlyBudgetGuard({ proposal, currentDailyBudget, monthlyBudgetState }) {
  if (!monthlyBudgetState || proposal.action !== 'increase') {
    return { proposal, blocked: false };
  }
  const deltaDailyBudget = Math.max(0, Number(proposal.proposedDailyBudget) - currentDailyBudget);
  const projectedSpend =
    monthlyBudgetState.spend + deltaDailyBudget * monthlyBudgetState.remainingDays;
  if (projectedSpend <= monthlyBudgetState.limit) {
    return { proposal, blocked: false };
  }
  return {
    blocked: true,
    proposal: {
      action: 'hold',
      proposedDailyBudget: currentDailyBudget,
      reason: `Bloqueado pelo limite mensal: projeção R$ ${projectedSpend.toFixed(
        2,
      )} acima do limite R$ ${monthlyBudgetState.limit.toFixed(2)}.`,
    },
  };
}

function extendStringEnumPath(schema, pathName, values) {
  const path = schema?.path?.(pathName);
  if (!path || !Array.isArray(path.enumValues)) {
    return;
  }
  for (const value of values) {
    if (!path.enumValues.includes(value)) {
      path.enumValues.push(value);
    }
  }
}

function getProjectMetaTokenSecretName(projectId) {
  return `meta_graph_access_token_project_${projectId}`;
}

function getModels() {
  const existingSnapshotSchema = mongoose.models.MetaAdsSnapshot?.schema;
  if (
    existingSnapshotSchema &&
    typeof existingSnapshotSchema.path === 'function' &&
    typeof existingSnapshotSchema.add === 'function'
  ) {
    extendStringEnumPath(existingSnapshotSchema, 'level', ['campaign', 'adset', 'ad']);
    const missingSnapshotFields = {};
    if (!existingSnapshotSchema.path('status')) {
      missingSnapshotFields.status = String;
    }
    if (!existingSnapshotSchema.path('currency')) {
      missingSnapshotFields.currency = String;
    }
    if (!existingSnapshotSchema.path('resultTypeBreakdown')) {
      missingSnapshotFields.resultTypeBreakdown = [
        {
          resultType: String,
          totalSpend: Number,
          totalResults: Number,
          averageCostPerResult: Number,
        },
      ];
    }
    if (!existingSnapshotSchema.path('configuredResultType')) {
      missingSnapshotFields.configuredResultType = String;
    }
    if (!existingSnapshotSchema.path('conversionValue')) {
      missingSnapshotFields.conversionValue = Number;
    }
    if (Object.keys(missingSnapshotFields).length > 0) {
      existingSnapshotSchema.add(missingSnapshotFields);
    }
  }
  const snapshotSchema =
    existingSnapshotSchema ||
    new mongoose.Schema(
      {
        tenantId: { type: String, index: true },
        projectId: { type: String, index: true },
        adAccountId: { type: String, index: true },
        level: { type: String, enum: ['campaign', 'adset', 'ad'], default: 'adset' },
        entityId: { type: String, index: true },
        entityName: String,
        campaignId: { type: String, index: true },
        campaignName: String,
        campaignObjective: String,
        status: String,
        dailyBudget: Number,
        currency: String,
        spend: Number,
        cpa: Number,
        roas: Number,
        conversionValue: Number,
        resultCount: Number,
        resultType: String,
        configuredResultType: String,
        resultTypeBreakdown: [
          {
            resultType: String,
            totalSpend: Number,
            totalResults: Number,
            averageCostPerResult: Number,
          },
        ],
        impressions: Number,
        reach: Number,
        frequency: Number,
        clicks: Number,
        ctr: Number,
        cpc: Number,
        cpm: Number,
        videoP75Watched: Number,
        videoP75Rate: Number,
        raw: mongoose.Schema.Types.Mixed,
      },
      { timestamps: true },
    );

  const existingRecommendationSchema = mongoose.models.MetaAdsRecommendation?.schema;
  if (
    existingRecommendationSchema &&
    typeof existingRecommendationSchema.path === 'function' &&
    typeof existingRecommendationSchema.add === 'function'
  ) {
    extendStringEnumPath(existingRecommendationSchema, 'entityLevel', ['campaign', 'adset', 'ad']);
    extendStringEnumPath(existingRecommendationSchema, 'action', [
      'increase',
      'decrease',
      'hold',
      'pause',
    ]);
    const missingRecommendationFields = {};
    for (const key of [
      'adsetId',
      'adsetName',
      'currentStatus',
      'proposedStatus',
      'resultCount',
      'ctr',
      'cpc',
      'frequency',
      'ruleSourceType',
      'ruleId',
      'ruleName',
      'ruleScope',
      'primaryMetric',
      'decisionReason',
      'automationRunId',
    ]) {
      if (!existingRecommendationSchema.path(key)) {
        missingRecommendationFields[key] = String;
      }
    }
    if (!existingRecommendationSchema.path('resultCount')) {
      missingRecommendationFields.resultCount = Number;
    }
    if (!existingRecommendationSchema.path('ctr')) {
      missingRecommendationFields.ctr = Number;
    }
    if (!existingRecommendationSchema.path('cpc')) {
      missingRecommendationFields.cpc = Number;
    }
    if (!existingRecommendationSchema.path('frequency')) {
      missingRecommendationFields.frequency = Number;
    }
    if (!existingRecommendationSchema.path('targetMetricValue')) {
      missingRecommendationFields.targetMetricValue = Number;
    }
    for (const key of [
      'evidenceSpend',
      'evidenceSpendThreshold',
      'evidenceSpendBasis',
      'evidenceMultiplier',
    ]) {
      if (!existingRecommendationSchema.path(key)) {
        missingRecommendationFields[key] = Number;
      }
    }
    if (!existingRecommendationSchema.path('canAct')) {
      missingRecommendationFields.canAct = Boolean;
    }
    if (Object.keys(missingRecommendationFields).length > 0) {
      existingRecommendationSchema.add(missingRecommendationFields);
    }
  }
  const recommendationSchema =
    existingRecommendationSchema ||
    new mongoose.Schema(
      {
        tenantId: { type: String, index: true },
        projectId: { type: String, index: true },
        adAccountId: { type: String, index: true },
        entityLevel: { type: String, enum: ['campaign', 'adset', 'ad'], default: 'adset' },
        entityId: { type: String, index: true },
        entityName: String,
        campaignId: { type: String, index: true },
        campaignName: String,
        adsetId: { type: String, index: true },
        adsetName: String,
        action: { type: String, enum: ['increase', 'decrease', 'hold', 'pause'], required: true },
        status: {
          type: String,
          enum: ['pending', 'applied', 'ignored', 'blocked'],
          default: 'pending',
          index: true,
        },
        currentStatus: String,
        proposedStatus: String,
        currentDailyBudget: Number,
        proposedDailyBudget: Number,
        spend: Number,
        resultCount: Number,
        cpa: Number,
        roas: Number,
        ctr: Number,
        cpc: Number,
        frequency: Number,
        primaryMetric: String,
        targetMetricValue: Number,
        evidenceSpend: Number,
        evidenceSpendThreshold: Number,
        evidenceSpendBasis: Number,
        evidenceMultiplier: Number,
        canAct: Boolean,
        decisionReason: String,
        beforeMetrics: {
          spend: Number,
          resultCount: Number,
          cpa: Number,
          roas: Number,
          ctr: Number,
          cpc: Number,
          frequency: Number,
        },
        afterMetrics: {
          spend: Number,
          resultCount: Number,
          cpa: Number,
          roas: Number,
          ctr: Number,
          cpc: Number,
          frequency: Number,
        },
        afterMeasuredAt: Date,
        ruleSourceType: String,
        ruleId: String,
        ruleName: String,
        ruleScope: String,
        reason: String,
        mode: String,
        automationRunId: { type: String, index: true },
      },
      { timestamps: true },
    );

  const existingChangeSchema = mongoose.models.MetaAdsBudgetChange?.schema;
  if (
    existingChangeSchema &&
    typeof existingChangeSchema.path === 'function' &&
    typeof existingChangeSchema.add === 'function' &&
    !existingChangeSchema.path('deltaDailyBudget')
  ) {
    existingChangeSchema.add({
      deltaDailyBudget: Number,
      deltaPercent: Number,
    });
  }
  const changeSchema =
    existingChangeSchema ||
    new mongoose.Schema(
      {
        tenantId: { type: String, index: true },
        projectId: { type: String, index: true },
        adAccountId: { type: String, index: true },
        recommendationId: String,
        entityLevel: { type: String, enum: ['campaign', 'adset'], default: 'adset' },
        entityId: { type: String, index: true },
        entityName: String,
        campaignId: { type: String, index: true },
        campaignName: String,
        previousDailyBudget: Number,
        newDailyBudget: Number,
        deltaDailyBudget: Number,
        deltaPercent: Number,
        actor: { type: String, enum: ['cron', 'user', 'tool'], required: true },
        actorUserId: String,
        reason: String,
      },
      { timestamps: true },
    );

  const actionSchema =
    (() => {
      const existingActionSchema = mongoose.models.MetaAdsAutomationAction?.schema;
      if (
        existingActionSchema &&
        typeof existingActionSchema.path === 'function' &&
        typeof existingActionSchema.add === 'function'
      ) {
        const missingActionFields = {};
        if (!existingActionSchema.path('primaryMetric')) {
          missingActionFields.primaryMetric = String;
        }
        if (!existingActionSchema.path('targetMetricValue')) {
          missingActionFields.targetMetricValue = Number;
        }
        if (!existingActionSchema.path('beforeMetrics')) {
          missingActionFields.beforeMetrics = {
            spend: Number,
            resultCount: Number,
            cpa: Number,
            roas: Number,
            ctr: Number,
            cpc: Number,
            frequency: Number,
          };
        }
        if (!existingActionSchema.path('afterMetrics')) {
          missingActionFields.afterMetrics = {
            spend: Number,
            resultCount: Number,
            cpa: Number,
            roas: Number,
            ctr: Number,
            cpc: Number,
            frequency: Number,
          };
        }
        if (!existingActionSchema.path('afterMeasuredAt')) {
          missingActionFields.afterMeasuredAt = Date;
        }
        if (Object.keys(missingActionFields).length > 0) {
          existingActionSchema.add(missingActionFields);
        }
      }
      return existingActionSchema;
    })() ||
    new mongoose.Schema(
      {
        tenantId: { type: String, index: true },
        projectId: { type: String, index: true },
        adAccountId: { type: String, index: true },
        actionType: {
          type: String,
          enum: ['budget_change', 'pause_ad', 'status_change'],
          required: true,
          index: true,
        },
        entityLevel: { type: String, enum: ['campaign', 'adset', 'ad'], required: true },
        entityId: { type: String, index: true },
        entityName: String,
        campaignId: { type: String, index: true },
        campaignName: String,
        adsetId: { type: String, index: true },
        adsetName: String,
        previousDailyBudget: Number,
        newDailyBudget: Number,
        deltaDailyBudget: Number,
        deltaPercent: Number,
        previousStatus: String,
        newStatus: String,
        spend: Number,
        resultCount: Number,
        cpa: Number,
        roas: Number,
        ctr: Number,
        cpc: Number,
        frequency: Number,
        primaryMetric: String,
        targetMetricValue: Number,
        beforeMetrics: {
          spend: Number,
          resultCount: Number,
          cpa: Number,
          roas: Number,
          ctr: Number,
          cpc: Number,
          frequency: Number,
        },
        afterMetrics: {
          spend: Number,
          resultCount: Number,
          cpa: Number,
          roas: Number,
          ctr: Number,
          cpc: Number,
          frequency: Number,
        },
        afterMeasuredAt: Date,
        ruleSourceType: String,
        ruleId: String,
        ruleName: String,
        ruleScope: String,
        recommendationId: String,
        actor: { type: String, enum: ['cron', 'user', 'tool'], required: true },
        actorUserId: String,
        reason: String,
      },
      { timestamps: true },
    );

  const existingRuleChangeSchema = mongoose.models.MetaAdsRuleChange?.schema;
  if (
    existingRuleChangeSchema &&
    typeof existingRuleChangeSchema.path === 'function' &&
    typeof existingRuleChangeSchema.add === 'function'
  ) {
    const missingRuleChangeFields = {};
    if (!existingRuleChangeSchema.path('actorUserName')) {
      missingRuleChangeFields.actorUserName = String;
    }
    if (!existingRuleChangeSchema.path('actorUserEmail')) {
      missingRuleChangeFields.actorUserEmail = String;
    }
    if (!existingRuleChangeSchema.path('ruleChanges')) {
      missingRuleChangeFields.ruleChanges = [
        {
          ruleKey: String,
          ruleType: String,
          ruleName: String,
          action: String,
          changedFields: [String],
        },
      ];
    }
    if (Object.keys(missingRuleChangeFields).length > 0) {
      existingRuleChangeSchema.add(missingRuleChangeFields);
    }
  }
  const mixedSchemaType = mongoose.Schema?.Types?.Mixed ?? Object;
  const existingRunSchema = mongoose.models.MetaAdsAutomationRun?.schema;
  if (
    existingRunSchema &&
    typeof existingRunSchema.path === 'function' &&
    typeof existingRunSchema.add === 'function'
  ) {
    const missingRunFields = {};
    for (const key of [
      'adAccountId',
      'actor',
      'mode',
      'status',
      'outcome',
      'since',
      'until',
      'datePreset',
      'errorMessage',
    ]) {
      if (!existingRunSchema.path(key)) {
        missingRunFields[key] = String;
      }
    }
    for (const key of [
      'durationMs',
      'evaluatedCount',
      'recommendationCount',
      'holdCount',
      'blockedCount',
      'appliedCount',
    ]) {
      if (!existingRunSchema.path(key)) {
        missingRunFields[key] = Number;
      }
    }
    if (!existingRunSchema.path('startedAt')) {
      missingRunFields.startedAt = Date;
    }
    if (!existingRunSchema.path('finishedAt')) {
      missingRunFields.finishedAt = Date;
    }
    if (!existingRunSchema.path('reasonSamples')) {
      missingRunFields.reasonSamples = [String];
    }
    if (Object.keys(missingRunFields).length > 0) {
      existingRunSchema.add(missingRunFields);
    }
  }
  const runSchema =
    existingRunSchema ||
    new mongoose.Schema(
      {
        tenantId: { type: String, index: true },
        projectId: { type: String, index: true },
        adAccountId: { type: String, index: true },
        actor: { type: String, enum: ['cron', 'user', 'tool'], required: true },
        mode: String,
        status: { type: String, enum: ['running', 'completed', 'failed'], index: true },
        outcome: {
          type: String,
          enum: ['applied', 'recommended', 'held', 'blocked', 'no_data', 'failed'],
          index: true,
        },
        since: String,
        until: String,
        datePreset: String,
        startedAt: Date,
        finishedAt: Date,
        durationMs: Number,
        evaluatedCount: Number,
        recommendationCount: Number,
        holdCount: Number,
        blockedCount: Number,
        appliedCount: Number,
        reasonSamples: [String],
        errorMessage: String,
      },
      { timestamps: true },
    );
  const ruleChangeSchema =
    existingRuleChangeSchema ||
    new mongoose.Schema(
      {
        tenantId: { type: String, index: true },
        projectId: { type: String, index: true },
        actor: { type: String, enum: ['user', 'tool', 'cron'], default: 'user' },
        actorUserId: String,
        actorUserName: String,
        actorUserEmail: String,
        changedFields: [String],
        ruleChanges: [
          {
            ruleKey: String,
            ruleType: String,
            ruleName: String,
            action: String,
            changedFields: [String],
          },
        ],
        before: mixedSchemaType,
        after: mixedSchemaType,
      },
      { timestamps: true },
    );

  return {
    MetaAdsSnapshot:
      mongoose.models.MetaAdsSnapshot || mongoose.model('MetaAdsSnapshot', snapshotSchema),
    MetaAdsRecommendation:
      mongoose.models.MetaAdsRecommendation ||
      mongoose.model('MetaAdsRecommendation', recommendationSchema),
    MetaAdsBudgetChange:
      mongoose.models.MetaAdsBudgetChange || mongoose.model('MetaAdsBudgetChange', changeSchema),
    MetaAdsAutomationAction:
      mongoose.models.MetaAdsAutomationAction ||
      mongoose.model('MetaAdsAutomationAction', actionSchema),
    MetaAdsAutomationRun:
      mongoose.models.MetaAdsAutomationRun || mongoose.model('MetaAdsAutomationRun', runSchema),
    MetaAdsRuleChange:
      mongoose.models.MetaAdsRuleChange || mongoose.model('MetaAdsRuleChange', ruleChangeSchema),
  };
}

function centsToDailyBudget(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 0;
  }
  return numeric / 100;
}

function dailyBudgetToCents(value) {
  return Math.max(1, Math.round(Number(value) * 100));
}

function parseBrazilianCurrency(value) {
  if (typeof value !== 'string') {
    return null;
  }
  const match = value.match(/R\$\s*(\d{1,3}(?:\.\d{3})*|\d+)(?:,(\d{1,2}))?/i);
  if (!match) {
    return null;
  }
  const integer = match[1].replace(/\./g, '');
  const decimal = match[2] ? match[2].padEnd(2, '0') : '00';
  const amount = Number(`${integer}.${decimal}`);
  return Number.isFinite(amount) ? Number(amount.toFixed(2)) : null;
}

function getMetaMinimumBudget(error) {
  if (error?.data?.error_subcode !== 1885650) {
    return null;
  }
  return parseBrazilianCurrency(error.data.error_user_msg);
}

function formatCurrencyPtBr(value) {
  return `R$${Number(value).toFixed(2).replace('.', ',')}`;
}

function calculateBudgetDelta(previousDailyBudget, nextDailyBudget) {
  const previous = Number(previousDailyBudget);
  const next = Number(nextDailyBudget);
  if (!Number.isFinite(next)) {
    return {
      deltaDailyBudget: null,
      deltaPercent: null,
    };
  }
  const deltaDailyBudget = Number((next - (Number.isFinite(previous) ? previous : 0)).toFixed(2));
  const deltaPercent =
    Number.isFinite(previous) && previous > 0
      ? Number(((deltaDailyBudget / previous) * 100).toFixed(2))
      : null;

  return {
    deltaDailyBudget,
    deltaPercent,
  };
}

function mergeRules(metaAds = {}) {
  return validateMetaAdsRules(metaAds.rules);
}

function findRuleGroup({ ruleGroups = [], campaignId, adsetId }) {
  return ruleGroups.find((group) => {
    if (group?.enabled === false || !Array.isArray(group.entityIds)) {
      return false;
    }
    if (group.entityLevel === 'campaign') {
      return group.entityIds.includes(campaignId);
    }
    if (group.entityLevel === 'adset') {
      return group.entityIds.includes(adsetId);
    }
    return false;
  });
}

function getEffectiveRules({
  projectRules = {},
  ruleGroups = [],
  ruleOverrides = [],
  campaignId,
  adsetId,
}) {
  const baseRules = validateMetaAdsRules(projectRules);
  const ruleGroup = findRuleGroup({ ruleGroups, campaignId, adsetId });
  const campaignOverride = ruleOverrides.find(
    (override) =>
      override?.enabled !== false &&
      override.entityLevel === 'campaign' &&
      override.entityId === campaignId,
  );
  const adsetOverride = ruleOverrides.find(
    (override) =>
      override?.enabled !== false &&
      override.entityLevel === 'adset' &&
      override.entityId === adsetId,
  );
  return validateMetaAdsRules({
    ...baseRules,
    ...(ruleGroup?.rules ?? {}),
    ...(campaignOverride?.rules ?? {}),
    ...(adsetOverride?.rules ?? {}),
  });
}

function getEffectiveRuleContext({
  projectRules = {},
  projectCreativeRules = {},
  ruleGroups = [],
  ruleOverrides = [],
  campaignId,
  adsetId,
}) {
  const baseRules = validateMetaAdsRules(projectRules);
  const baseCreativeRules = validateMetaAdsCreativeRules(projectCreativeRules);
  const ruleGroup = findRuleGroup({ ruleGroups, campaignId, adsetId });
  const campaignOverride = ruleOverrides.find(
    (override) =>
      override?.enabled !== false &&
      override.entityLevel === 'campaign' &&
      override.entityId === campaignId,
  );
  const adsetOverride = ruleOverrides.find(
    (override) =>
      override?.enabled !== false &&
      override.entityLevel === 'adset' &&
      override.entityId === adsetId,
  );
  const appliedSource = adsetOverride ?? campaignOverride ?? ruleGroup;
  const ruleSourceType =
    adsetOverride || campaignOverride ? 'override' : ruleGroup ? 'group' : 'global';
  const analysisPreset = ANALYSIS_PRESETS.has(appliedSource?.analysisPreset)
    ? appliedSource.analysisPreset
    : undefined;
  const rules = validateMetaAdsRules({
    ...baseRules,
    ...(ruleGroup?.rules ?? {}),
    ...(campaignOverride?.rules ?? {}),
    ...(adsetOverride?.rules ?? {}),
  });
  const creativeRules = validateMetaAdsCreativeRules({
    ...baseCreativeRules,
    ...(ruleGroup?.creativeRules ?? {}),
    ...(campaignOverride?.creativeRules ?? {}),
    ...(adsetOverride?.creativeRules ?? {}),
  });
  return {
    rules,
    creativeRules,
    ruleSourceType,
    ruleId: appliedSource?.id || appliedSource?.entityId || 'global',
    ruleName: appliedSource?.name || appliedSource?.entityName || 'Global',
    analysisPreset,
    ruleScope:
      ruleSourceType === 'global'
        ? 'global'
        : `${appliedSource?.entityLevel || 'campaign'}:${(appliedSource?.entityIds ?? [appliedSource?.entityId]).filter(Boolean).join(',')}`,
  };
}

function validateRuleNumber(rules, key, errors) {
  const value = Number(rules[key]);
  const limits = RULE_LIMITS[key];
  if (!Number.isFinite(value)) {
    errors.push(key);
    return value;
  }
  if (value < limits.min || (limits.max != null && value > limits.max)) {
    errors.push(key);
  }
  return value;
}

function validateOptionalRuleNumber(rules, key, validated, errors) {
  if (rules[key] == null || rules[key] === '') {
    return;
  }
  const value = validateRuleNumber(rules, key, errors);
  if (Number.isFinite(value)) {
    validated[key] = value;
  }
}

function validateEnabledSections(sections = {}) {
  const defaults = DEFAULT_RULES.enabledSections;
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

function validateMetaAdsRules(rules = {}) {
  const merged = { ...DEFAULT_RULES, ...(rules ?? {}) };
  const errors = [];
  const validated = {};
  for (const key of [
    'targetCpa',
    'minRoas',
    'maxIncreasePct',
    'maxDecreasePct',
    'minDailyBudget',
    'maxDailyBudget',
    'minSpend',
    'conversionEvidenceMultiplier',
    'conversionEvidenceMinHours',
  ]) {
    validated[key] = validateRuleNumber(merged, key, errors);
  }
  for (const key of ['minCtr', 'maxCpc', 'maxCpm']) {
    validateOptionalRuleNumber(merged, key, validated, errors);
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
    errors.push('minDailyBudget');
    errors.push('maxDailyBudget');
  }
  if (errors.length > 0) {
    throw Object.assign(new Error('Invalid Meta Ads budget rules.'), {
      statusCode: 400,
      details: [...new Set(errors)],
    });
  }
  return validated;
}

function getPrimaryMetric(rules = {}) {
  return PRIMARY_METRICS.has(rules.primaryMetric) ? rules.primaryMetric : 'cpa';
}

function getRuleTargetMetricValue(rules = {}) {
  const primaryMetric = getPrimaryMetric(rules);
  if (primaryMetric === 'roas') {
    return toFiniteMetric(rules.minRoas);
  }
  if (primaryMetric === 'cpc') {
    return toFiniteMetric(rules.maxCpc);
  }
  if (primaryMetric === 'ctr') {
    return toFiniteMetric(rules.minCtr);
  }
  return toFiniteMetric(rules.targetCpa);
}

function isLowerBetterMetric(metric) {
  return metric === 'cpa' || metric === 'cpc';
}

function validateMetaAdsCreativeRules(rules = {}) {
  const merged = { ...DEFAULT_CREATIVE_RULES, ...(rules ?? {}) };
  const validated = {};
  const errors = [];
  for (const [key, limits] of Object.entries(CREATIVE_RULE_LIMITS)) {
    if (merged[key] == null || merged[key] === '') {
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

function withImplicitProjectTokenSecret(projectId, metaAds = {}) {
  if (normalizeSecretName(metaAds.tokenSecretName)) {
    return metaAds;
  }
  return {
    ...metaAds,
    tokenSecretName: getProjectMetaTokenSecretName(projectId),
  };
}

function normalizeAdAccountId(value) {
  if (typeof value !== 'string') {
    return value;
  }
  const digits = value.replace(/^act_/i, '').replace(/\D/g, '');
  return digits ? `act_${digits}` : value;
}

function getScheduleIntervalMinutes(metaAds = {}) {
  const interval = Number(metaAds.scheduleIntervalMinutes);
  return SCHEDULE_INTERVALS.has(interval) ? interval : DEFAULT_SCHEDULE_INTERVAL_MINUTES;
}

function resolveActionCooldownMinutes({ actionType, metaAds, scheduleIntervalMinutes } = {}) {
  const interval = SCHEDULE_INTERVALS.has(Number(scheduleIntervalMinutes))
    ? Number(scheduleIntervalMinutes)
    : getScheduleIntervalMinutes(metaAds);
  return Math.max(interval, ACTION_COOLDOWN_MINUTES[actionType] ?? 60);
}

function getMetaAdsTimeZone() {
  return (
    process.env.META_ADS_TIME_ZONE ||
    process.env.TZ ||
    Intl.DateTimeFormat().resolvedOptions().timeZone ||
    DEFAULT_META_ADS_TIME_ZONE
  );
}

function getMetaAdsDateKey(date = new Date(), timeZone = getMetaAdsTimeZone()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    day: '2-digit',
    month: '2-digit',
    timeZone,
    year: 'numeric',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function addDays(date, days) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function getPositiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function getCronProjectTimeoutMs(value) {
  return getPositiveInteger(
    value ?? process.env.META_ADS_CRON_PROJECT_TIMEOUT_MS,
    DEFAULT_CRON_PROJECT_TIMEOUT_MS,
  );
}

function getCronProjectConcurrency(value) {
  return getPositiveInteger(
    value ?? process.env.META_ADS_CRON_PROJECT_CONCURRENCY,
    DEFAULT_CRON_PROJECT_CONCURRENCY,
  );
}

function getCronEntityConcurrency(value) {
  return getPositiveInteger(
    value ?? process.env.META_ADS_CRON_ENTITY_CONCURRENCY,
    DEFAULT_CRON_ENTITY_CONCURRENCY,
  );
}

function withTimeout(promise, timeoutMs, message) {
  let timeout;
  const timeoutPromise = new Promise((_, reject) => {
    timeout = setTimeout(() => reject(new Error(message)), timeoutMs);
    timeout.unref?.();
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeout));
}

async function mapWithConcurrency(items, concurrency, mapper) {
  const results = new Array(items.length);
  let nextIndex = 0;
  const workerCount = Math.min(concurrency, items.length);
  const workers = Array.from({ length: workerCount }, async () => {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await mapper(items[currentIndex], currentIndex);
    }
  });
  await Promise.all(workers);
  return results;
}

function isProjectDueForMetaAdsRun(project, now = new Date()) {
  const intervalMinutes = getScheduleIntervalMinutes(project.metaAds ?? {});
  const lastRunAt = project.metaAds?.lastRunAt ? new Date(project.metaAds.lastRunAt) : null;
  if (!lastRunAt || Number.isNaN(lastRunAt.getTime())) {
    return true;
  }
  return now.getTime() - lastRunAt.getTime() >= intervalMinutes * 60 * 1000;
}

async function isMetaAdsFeatureEnabled(tenantId) {
  const appConfig = await getAppConfig(tenantId ? { tenantId } : { baseOnly: true });
  return appConfig?.interfaceConfig?.metaAds !== false;
}

function canonicalizeMetaActionType(actionType) {
  if (typeof actionType !== 'string' || !actionType.trim()) {
    return '';
  }
  const normalized = actionType.trim();
  return CANONICAL_RESULT_TYPES[normalized] ?? normalized;
}

function canonicalizeMetaOptimizationGoal(optimizationGoal) {
  if (typeof optimizationGoal !== 'string' || !optimizationGoal.trim()) {
    return '';
  }
  const normalized = optimizationGoal.trim().toUpperCase();
  return (
    OPTIMIZATION_GOAL_RESULT_TYPES[normalized] ??
    canonicalizeMetaActionType(normalized.toLowerCase())
  );
}

function resolveTargetResultType({
  targetResultType,
  rules,
  accountProfile,
  campaignObjective,
  configuredResultType,
} = {}) {
  const configuredTarget =
    typeof targetResultType === 'string' && targetResultType.trim()
      ? targetResultType.trim()
      : typeof rules?.targetResultType === 'string' && rules.targetResultType.trim()
        ? rules.targetResultType.trim()
        : '';
  if (configuredTarget) {
    return canonicalizeMetaActionType(configuredTarget);
  }
  if (configuredResultType) {
    return canonicalizeMetaActionType(configuredResultType);
  }
  if (accountProfile === 'ecommerce' || campaignObjective === 'OUTCOME_SALES') {
    return 'purchase';
  }
  return '';
}

function findCanonicalAction(items, targetActionType) {
  const canonicalTarget = canonicalizeMetaActionType(targetActionType);
  const values = Array.isArray(items) ? items : [];
  return (
    values.find((item) => item?.action_type === canonicalTarget) ??
    values.find((item) => canonicalizeMetaActionType(item?.action_type) === canonicalTarget)
  );
}

function shouldUseCanonicalAction(current, candidate, resultType) {
  if (!current) {
    return true;
  }
  const currentRawType = current.rawActionType;
  const candidateRawType = candidate?.action_type;
  return candidateRawType === resultType && currentRawType !== resultType;
}

function getCanonicalBreakdownActions(actions) {
  const actionByCanonicalType = new Map();
  for (const action of Array.isArray(actions) ? actions : []) {
    const rawResultType = action?.action_type;
    const resultType = canonicalizeMetaActionType(rawResultType);
    const totalResults = Number(action?.value ?? 0);
    if (!resultType || !Number.isFinite(totalResults) || totalResults <= 0) {
      continue;
    }
    const current = actionByCanonicalType.get(resultType);
    if (!shouldUseCanonicalAction(current, action, resultType)) {
      continue;
    }
    actionByCanonicalType.set(resultType, {
      resultType,
      rawActionType: rawResultType,
      totalResults,
    });
  }
  return Array.from(actionByCanonicalType.values()).map(
    ({ rawActionType: _rawActionType, ...action }) => action,
  );
}

function getActionValue(items, targetActionType) {
  const canonicalAction = findCanonicalAction(items, targetActionType);
  const value = Number(canonicalAction?.value ?? 0);
  return Number.isFinite(value) ? value : 0;
}

function getPurchaseValue(row) {
  return getActionValue(row?.action_values, 'purchase');
}

function calculateRoas(row, spend) {
  const roasValue = Array.isArray(row.purchase_roas)
    ? Number(row.purchase_roas[0]?.value ?? 0)
    : Number(row.purchase_roas ?? 0);
  if (Number.isFinite(roasValue) && roasValue > 0) {
    return Number(roasValue.toFixed(2));
  }
  const purchaseValue = getPurchaseValue(row);
  return purchaseValue > 0 && spend > 0 ? Number((purchaseValue / spend).toFixed(2)) : null;
}

function calculateMetrics(row, targetResultType) {
  const spend = Number(row.spend ?? 0);
  const actions = Array.isArray(row.actions) ? row.actions : [];
  const costPerAction = Array.isArray(row.cost_per_action_type) ? row.cost_per_action_type : [];
  const normalizedTarget = canonicalizeMetaActionType(targetResultType);
  const resultTypeBreakdown = filterAggregateResultTypes(
    getCanonicalBreakdownActions(actions).map((action) => ({
      resultType: action.resultType,
      totalSpend: spend,
      totalResults: action.totalResults,
      averageCostPerResult:
        action.totalResults > 0 ? Number((spend / action.totalResults).toFixed(2)) : null,
    })),
    normalizedTarget,
  );
  const rawThruplays = Array.isArray(row.video_thruplay_watched_actions)
    ? Number(row.video_thruplay_watched_actions[0]?.value ?? 0)
    : Number(row.video_thruplay_watched_actions ?? 0);
  const hasThruplayMetric = Number.isFinite(rawThruplays) && rawThruplays > 0;
  const prioritizedAction = RESULT_ACTION_PRIORITY.map((actionType) =>
    actions.find((action) => action.action_type === actionType),
  ).find(Boolean);
  const nonAggregateAction = actions.find(
    (action) =>
      !VIDEO_RESULT_TYPES.has(canonicalizeMetaActionType(action.action_type)) &&
      !AGGREGATE_RESULT_TYPES.has(canonicalizeMetaActionType(action.action_type)),
  );
  const nonVideoAction = actions.find(
    (action) => !VIDEO_RESULT_TYPES.has(canonicalizeMetaActionType(action.action_type)),
  );
  const resultAction =
    normalizedTarget === 'thruplay' && hasThruplayMetric
      ? null
      : normalizedTarget
        ? findCanonicalAction(actions, normalizedTarget)
        : (prioritizedAction ?? nonAggregateAction ?? nonVideoAction ?? actions[0]);
  const thruplays = Number.isFinite(rawThruplays) ? rawThruplays : 0;
  const resultCount = resultAction
    ? Number(resultAction.value ?? 0)
    : normalizedTarget === 'thruplay' && Number.isFinite(thruplays)
      ? thruplays
      : normalizedTarget
        ? 0
        : undefined;
  const resultCost = resultAction
    ? findCanonicalAction(costPerAction, resultAction.action_type)
    : null;
  const cpaFromMeta = Number(resultCost?.value);
  const cpa =
    Number.isFinite(cpaFromMeta) && cpaFromMeta > 0
      ? cpaFromMeta
      : Number(resultCount) > 0
        ? spend / resultCount
        : null;
  const roas = calculateRoas(row, spend);
  const conversionValue = getPurchaseValue(row);
  const videoP75Watched = Array.isArray(row.video_p75_watched_actions)
    ? Number(row.video_p75_watched_actions[0]?.value ?? 0)
    : Number(row.video_p75_watched_actions ?? 0);
  const impressions = Number(row.impressions ?? 0);
  return {
    spend,
    resultCount,
    cpa,
    roas,
    conversionValue,
    resultType:
      normalizedTarget === 'thruplay' &&
      !resultAction &&
      Number.isFinite(thruplays) &&
      thruplays > 0
        ? 'thruplay'
        : resultAction
          ? canonicalizeMetaActionType(resultAction.action_type)
          : normalizedTarget,
    impressions,
    reach: Number(row.reach ?? 0),
    frequency: Number(row.frequency ?? 0),
    clicks: Number(row.clicks ?? 0),
    ctr: Number(row.ctr ?? 0),
    cpc: Number(row.cpc ?? 0),
    cpm: Number(row.cpm ?? 0),
    videoP75Watched,
    videoP75Rate:
      impressions > 0 ? Number(((Number(videoP75Watched) / impressions) * 100).toFixed(2)) : 0,
    resultTypeBreakdown:
      Number.isFinite(thruplays) && thruplays > 0
        ? filterAggregateResultTypes(
            [
              ...resultTypeBreakdown.filter((resultType) => resultType.resultType !== 'thruplay'),
              {
                resultType: 'thruplay',
                totalSpend: spend,
                totalResults: thruplays,
                averageCostPerResult: thruplays > 0 ? Number((spend / thruplays).toFixed(2)) : null,
              },
            ],
            normalizedTarget,
          )
        : resultTypeBreakdown,
  };
}

function filterAggregateResultTypes(resultTypeBreakdown, preservedResultType = '') {
  if (!Array.isArray(resultTypeBreakdown) || resultTypeBreakdown.length <= 1) {
    return resultTypeBreakdown;
  }
  const hasLeafResultType = resultTypeBreakdown.some(
    (resultType) => !AGGREGATE_RESULT_TYPES.has(resultType.resultType),
  );
  if (hasLeafResultType) {
    return resultTypeBreakdown.filter(
      (resultType) =>
        resultType.resultType === preservedResultType ||
        !AGGREGATE_RESULT_TYPES.has(resultType.resultType),
    );
  }
  if (resultTypeBreakdown.some((resultType) => resultType.resultType === 'post_engagement')) {
    return resultTypeBreakdown.filter((resultType) => resultType.resultType !== 'page_engagement');
  }
  return resultTypeBreakdown;
}

function aggregateInsightRows(rows = []) {
  const aggregate = {
    spend: 0,
    impressions: 0,
    reach: 0,
    clicks: 0,
    actions: [],
    action_values: [],
    purchase_roas: [],
    video_p75_watched_actions: [],
  };
  const actions = new Map();
  const actionValues = new Map();
  let frequencyWeightedTotal = 0;
  let frequencyWeight = 0;
  let frequencyTotal = 0;
  let frequencyCount = 0;
  let roasTotal = 0;
  let roasCount = 0;
  let videoP75Watched = 0;

  for (const row of rows) {
    const spend = Number(row.spend ?? 0);
    const impressions = Number(row.impressions ?? 0);
    const reach = Number(row.reach ?? 0);
    const clicks = Number(row.clicks ?? 0);
    aggregate.spend += Number.isFinite(spend) ? spend : 0;
    aggregate.impressions += Number.isFinite(impressions) ? impressions : 0;
    aggregate.reach += Number.isFinite(reach) ? reach : 0;
    aggregate.clicks += Number.isFinite(clicks) ? clicks : 0;

    const frequency = Number(row.frequency);
    if (Number.isFinite(frequency)) {
      if (Number.isFinite(impressions) && impressions > 0) {
        frequencyWeightedTotal += frequency * impressions;
        frequencyWeight += impressions;
      } else {
        frequencyTotal += frequency;
        frequencyCount += 1;
      }
    }

    for (const action of Array.isArray(row.actions) ? row.actions : []) {
      const actionType = action?.action_type;
      const value = Number(action?.value ?? 0);
      if (actionType && Number.isFinite(value)) {
        actions.set(actionType, Number(actions.get(actionType) ?? 0) + value);
      }
    }

    for (const actionValue of Array.isArray(row.action_values) ? row.action_values : []) {
      const actionType = actionValue?.action_type;
      const value = Number(actionValue?.value ?? 0);
      if (actionType && Number.isFinite(value)) {
        actionValues.set(actionType, Number(actionValues.get(actionType) ?? 0) + value);
      }
    }

    const rowRoas = Array.isArray(row.purchase_roas)
      ? Number(row.purchase_roas[0]?.value ?? 0)
      : Number(row.purchase_roas ?? 0);
    if (Number.isFinite(rowRoas) && rowRoas > 0) {
      roasTotal += rowRoas;
      roasCount += 1;
    }

    const rowVideoP75 = Array.isArray(row.video_p75_watched_actions)
      ? Number(row.video_p75_watched_actions[0]?.value ?? 0)
      : Number(row.video_p75_watched_actions ?? 0);
    if (Number.isFinite(rowVideoP75)) {
      videoP75Watched += rowVideoP75;
    }
  }

  aggregate.spend = Number(aggregate.spend.toFixed(2));
  aggregate.impressions = Number(aggregate.impressions.toFixed(2));
  aggregate.reach = Number(aggregate.reach.toFixed(2));
  aggregate.clicks = Number(aggregate.clicks.toFixed(2));
  aggregate.ctr =
    aggregate.impressions > 0
      ? Number(((aggregate.clicks / aggregate.impressions) * 100).toFixed(2))
      : 0;
  aggregate.frequency =
    frequencyWeight > 0
      ? Number((frequencyWeightedTotal / frequencyWeight).toFixed(2))
      : frequencyCount > 0
        ? Number((frequencyTotal / frequencyCount).toFixed(2))
        : 0;
  aggregate.actions = Array.from(actions.entries()).map(([action_type, value]) => ({
    action_type,
    value,
  }));
  aggregate.action_values = Array.from(actionValues.entries()).map(([action_type, value]) => ({
    action_type,
    value,
  }));
  aggregate.purchase_roas =
    roasCount > 0 ? [{ value: Number((roasTotal / roasCount).toFixed(2)) }] : [];
  aggregate.video_p75_watched_actions = [{ value: videoP75Watched }];
  return aggregate;
}

function hasBudget(value) {
  return Number(value ?? 0) > 0;
}

function detectBudgetMode({ campaign = {}, adsets = [] }) {
  if (hasBudget(campaign.daily_budget) || hasBudget(campaign.lifetime_budget)) {
    return { budgetLevel: 'campaign', editableBudgetLevel: 'campaign', budgetMode: 'CBO' };
  }
  if (
    adsets.some(
      (adset) =>
        hasBudget(adset.dailyBudget) ||
        hasBudget(adset.daily_budget) ||
        hasBudget(adset.lifetime_budget),
    )
  ) {
    return { budgetLevel: 'adset', editableBudgetLevel: 'adset', budgetMode: 'ABO' };
  }
  return { budgetLevel: 'adset', editableBudgetLevel: 'none', budgetMode: 'UNKNOWN' };
}

function latestByEntity(items = []) {
  const latest = new Map();
  for (const item of items) {
    const entityId = item.entityId;
    if (!entityId) {
      continue;
    }
    const current = latest.get(entityId);
    if (!current || String(item.createdAt ?? '') > String(current.createdAt ?? '')) {
      latest.set(entityId, item);
    }
  }
  return latest;
}

function getSnapshotAdSetName(snapshot, campaignName) {
  const rawAdSetName = snapshot.raw?.adset_name;
  if (
    typeof rawAdSetName === 'string' &&
    rawAdSetName.trim() &&
    snapshot.entityName === campaignName
  ) {
    return rawAdSetName.trim();
  }
  return snapshot.entityName;
}

function buildSnapshotsFromInsights({
  insights = [],
  adsets = [],
  campaigns = [],
  currency,
  accountProfile,
  targetResultType,
}) {
  const campaignById = new Map(campaigns.map((campaign) => [campaign.id, campaign]));
  const adsetById = new Map(adsets.map((adset) => [adset.id, adset]));
  return insights
    .map((row) => {
      const entityId = row.adset_id;
      const adset = adsetById.get(entityId);
      if (!entityId) {
        return null;
      }
      const campaignId = row.campaign_id || adset?.campaign_id || adset?.campaign?.id;
      const campaign = campaignById.get(campaignId);
      const campaignName = row.campaign_name || campaign?.name || adset?.campaign?.name;
      const configuredResultType = canonicalizeMetaOptimizationGoal(adset?.optimization_goal);
      const resolvedTargetResultType = resolveTargetResultType({
        targetResultType,
        accountProfile,
        campaignObjective: campaign?.objective,
        configuredResultType,
      });
      const metrics = calculateMetrics(row, resolvedTargetResultType);
      return {
        level: 'adset',
        entityId,
        entityName: row.adset_name || adset?.name || entityId,
        campaignId,
        campaignName,
        campaignObjective: campaign?.objective,
        configuredResultType: configuredResultType || undefined,
        dailyBudget: centsToDailyBudget(adset?.daily_budget),
        status: adset?.effective_status,
        currency,
        ...metrics,
        raw: row,
        createdAt: new Date().toISOString(),
      };
    })
    .filter(Boolean);
}

function mergeLiveSnapshotBudgetFallback(liveSnapshots = [], storedSnapshots = []) {
  const storedByEntity = latestByEntity(storedSnapshots);
  return liveSnapshots.map((snapshot) => {
    const stored = storedByEntity.get(snapshot.entityId);
    if (!stored) {
      return snapshot;
    }
    const dailyBudget = Number(snapshot.dailyBudget ?? 0);
    const storedDailyBudget = Number(stored.dailyBudget ?? 0);
    if (dailyBudget > 0 || storedDailyBudget <= 0) {
      return snapshot;
    }
    return {
      ...snapshot,
      dailyBudget: storedDailyBudget,
      status: snapshot.status || stored.status,
    };
  });
}

function getCreativeValue(creative, keys = []) {
  for (const key of keys) {
    const value = creative?.[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return undefined;
}

function getCreativeLinkData(creative = {}) {
  const objectStorySpec = creative.object_story_spec ?? {};
  return (
    objectStorySpec.link_data ?? objectStorySpec.video_data ?? objectStorySpec.template_data ?? {}
  );
}

function getCreativeStoryMediaUrl(creative = {}) {
  const objectStorySpec = creative.object_story_spec ?? {};
  const linkData = objectStorySpec.link_data ?? {};
  const videoData = objectStorySpec.video_data ?? {};
  const templateData = objectStorySpec.template_data ?? {};
  const childAttachment = Array.isArray(linkData.child_attachments)
    ? linkData.child_attachments.find((attachment) => typeof attachment?.picture === 'string')
    : null;
  return (
    getCreativeValue(videoData, ['image_url', 'thumbnail_url']) ||
    getCreativeValue(templateData, ['image_url', 'thumbnail_url', 'picture']) ||
    getCreativeValue(linkData, ['picture']) ||
    getCreativeValue(childAttachment, ['picture'])
  );
}

function getAssetFeedValue(assetFeedSpec, key) {
  const values = assetFeedSpec?.[key];
  if (!Array.isArray(values)) {
    return undefined;
  }
  const first = values.find((item) => typeof item?.text === 'string' && item.text.trim());
  return first?.text?.trim();
}

function getAssetFeedMediaUrl(assetFeedSpec) {
  const images = Array.isArray(assetFeedSpec?.images) ? assetFeedSpec.images : [];
  const image = images.find((item) => typeof item?.url === 'string' && item.url.trim());
  if (image?.url) {
    return image.url.trim();
  }
  const videos = Array.isArray(assetFeedSpec?.videos) ? assetFeedSpec.videos : [];
  const video = videos.find(
    (item) =>
      typeof item?.thumbnail_url === 'string' ||
      typeof item?.image_url === 'string' ||
      typeof item?.url === 'string',
  );
  return getCreativeValue(video, ['thumbnail_url', 'image_url', 'url']);
}

function getAssetFeedVideoId(assetFeedSpec) {
  const videos = Array.isArray(assetFeedSpec?.videos) ? assetFeedSpec.videos : [];
  const video = videos.find((item) => typeof item?.video_id === 'string' && item.video_id.trim());
  return getCreativeValue(video, ['video_id']);
}

function getAssetFeedLinkUrl(assetFeedSpec) {
  const linkUrls = Array.isArray(assetFeedSpec?.link_urls) ? assetFeedSpec.link_urls : [];
  const linkUrl = linkUrls.find(
    (item) =>
      typeof item?.website_url === 'string' ||
      typeof item?.url === 'string' ||
      typeof item?.display_url === 'string' ||
      typeof item?.deeplink_url === 'string',
  );
  return getCreativeValue(linkUrl, ['website_url', 'url', 'display_url', 'deeplink_url']);
}

function getAssetFeedCallToActionType(assetFeedSpec) {
  const callToActionTypes = Array.isArray(assetFeedSpec?.call_to_action_types)
    ? assetFeedSpec.call_to_action_types
    : [];
  const callToActionType = callToActionTypes.find(
    (item) => typeof item === 'string' || typeof item?.type === 'string',
  );
  if (typeof callToActionType === 'string' && callToActionType.trim()) {
    return callToActionType.trim();
  }
  return getCreativeValue(callToActionType, ['type']);
}

function buildAdsManagerUrl(adAccountId, adId) {
  const accountDigits = String(adAccountId ?? '').replace(/^act_/, '');
  if (!accountDigits || !adId) {
    return undefined;
  }
  return `https://adsmanager.facebook.com/adsmanager/manage/ads?act=${encodeURIComponent(
    accountDigits,
  )}&selected_ad_ids=${encodeURIComponent(adId)}`;
}

function buildAdSummaries({
  ads = [],
  adInsights = [],
  currency,
  accountProfile,
  targetResultType,
  adAccountId,
}) {
  const insightByAdId = new Map(adInsights.map((row) => [row.ad_id, row]));
  const adIds = new Set(ads.map((ad) => ad.id).filter(Boolean));
  const listedAdSummaries = ads
    .map((ad) => {
      const adId = ad.id;
      if (!adId) {
        return null;
      }
      const creative = ad.creative ?? {};
      const linkData = getCreativeLinkData(creative);
      const assetFeedSpec = creative.asset_feed_spec;
      const storyMediaUrl = getCreativeStoryMediaUrl(creative);
      const assetFeedMediaUrl = getAssetFeedMediaUrl(assetFeedSpec);
      const insight = insightByAdId.get(adId) ?? {};
      const resolvedTargetResultType = resolveTargetResultType({
        targetResultType,
        accountProfile,
      });
      const metrics = calculateMetrics(insight, resolvedTargetResultType);
      return {
        adId,
        adName: ad.name || insight.ad_name || adId,
        adSetId: ad.adset_id || insight.adset_id,
        campaignId: ad.campaign_id || insight.campaign_id,
        campaignName: insight.campaign_name,
        creativeId: creative.id,
        title:
          getCreativeValue(creative, ['title']) ||
          getCreativeValue(linkData, ['name', 'title']) ||
          getAssetFeedValue(assetFeedSpec, 'titles') ||
          getAssetFeedValue(assetFeedSpec, 'bodies'),
        body:
          getCreativeValue(creative, ['body']) ||
          getCreativeValue(linkData, ['message']) ||
          getAssetFeedValue(assetFeedSpec, 'bodies'),
        description:
          getCreativeValue(linkData, ['description']) ||
          getAssetFeedValue(assetFeedSpec, 'descriptions'),
        thumbnailUrl:
          getCreativeValue(creative, ['thumbnail_url']) || storyMediaUrl || assetFeedMediaUrl,
        imageUrl: getCreativeValue(creative, ['image_url']) || storyMediaUrl || assetFeedMediaUrl,
        videoId:
          getCreativeValue(creative, ['video_id']) ||
          getCreativeValue(linkData, ['video_id']) ||
          getAssetFeedVideoId(assetFeedSpec),
        adsManagerUrl: buildAdsManagerUrl(adAccountId, adId),
        linkUrl: getCreativeValue(linkData, ['link']) || getAssetFeedLinkUrl(assetFeedSpec),
        callToActionType:
          linkData.call_to_action?.type || getAssetFeedCallToActionType(assetFeedSpec),
        status: ad.effective_status,
        currency,
        ...metrics,
      };
    })
    .filter(Boolean);
  const insightOnlySummaries = adInsights
    .filter((insight) => insight.ad_id && !adIds.has(insight.ad_id))
    .map((insight) => ({
      adId: insight.ad_id,
      adName: insight.ad_name || insight.ad_id,
      adSetId: insight.adset_id,
      campaignId: insight.campaign_id,
      campaignName: insight.campaign_name,
      adsManagerUrl: buildAdsManagerUrl(adAccountId, insight.ad_id),
      currency,
      ...calculateMetrics(
        insight,
        resolveTargetResultType({
          targetResultType,
          accountProfile,
        }),
      ),
    }));
  return [...listedAdSummaries, ...insightOnlySummaries];
}

function getSingleConfiguredResultType(adSets = []) {
  const values = new Set(
    adSets
      .map((adSet) => adSet.configuredResultType)
      .filter((value) => typeof value === 'string' && value),
  );
  return values.size === 1 ? Array.from(values)[0] : undefined;
}

function buildCreativePauseRecommendations({
  ads = [],
  adInsights = [],
  creativeRules = {},
  ruleContext = {},
  targetResultType,
}) {
  const pauseRule = creativeRules?.pauseHighCost;
  if (!pauseRule?.enabled) {
    return [];
  }
  const activeAds = ads.filter(
    (ad) => ad?.effective_status === 'ACTIVE' || ad?.status === 'ACTIVE',
  );
  const minCreativesInScope = Number(pauseRule.minCreativesInScope ?? 3);
  if (activeAds.length < minCreativesInScope || activeAds.length <= 2) {
    return [];
  }
  const insightByAdId = new Map(adInsights.map((row) => [row.ad_id, row]));
  const resolvedTargetResultType =
    pauseRule.targetResultType || targetResultType || ruleContext.targetResultType || '';
  const minSpend = Number(pauseRule.minSpend ?? MIN_SAMPLE_SPEND);
  const maxCostPerResult = Number(pauseRule.maxCostPerResult);
  if (!Number.isFinite(maxCostPerResult) || maxCostPerResult <= 0) {
    return [];
  }
  const candidates = activeAds
    .map((ad) => {
      const metrics = calculateMetrics(insightByAdId.get(ad.id) ?? {}, resolvedTargetResultType);
      return { ad, metrics };
    })
    .filter(
      ({ metrics }) =>
        Number(metrics.spend ?? 0) >= minSpend &&
        metrics.cpa != null &&
        Number(metrics.cpa) > maxCostPerResult,
    )
    .sort((left, right) => Number(right.metrics.cpa ?? 0) - Number(left.metrics.cpa ?? 0));
  const maxPauses = Math.max(0, activeAds.length - 2);
  return candidates.slice(0, maxPauses).map(({ ad, metrics }) => ({
    entityLevel: 'ad',
    entityId: ad.id,
    entityName: ad.name || ad.id,
    campaignId: ad.campaign_id || ruleContext.campaignId,
    campaignName: ruleContext.campaignName,
    adsetId: ad.adset_id || ruleContext.adsetId,
    adsetName: ruleContext.adsetName,
    action: 'pause',
    currentStatus: 'ACTIVE',
    proposedStatus: 'PAUSED',
    spend: metrics.spend,
    resultCount: metrics.resultCount,
    cpa: metrics.cpa,
    roas: metrics.roas,
    ctr: metrics.ctr,
    cpc: metrics.cpc,
    frequency: metrics.frequency,
    primaryMetric: 'cpa',
    targetMetricValue: maxCostPerResult,
    reason: `Criativo com custo por resultado ${Number(metrics.cpa).toFixed(2)} acima do limite ${maxCostPerResult.toFixed(2)}.`,
    ruleSourceType: ruleContext.ruleSourceType || 'creative',
    ruleId: ruleContext.ruleId,
    ruleName: ruleContext.ruleName,
    ruleScope: ruleContext.ruleScope,
  }));
}

function buildAdDiagnostics({ ads = [], adInsights = [], adSummaries = [], campaigns = [] }) {
  const listedAdIds = new Set(ads.map((ad) => ad.id).filter(Boolean));
  const insightAdIds = new Set(adInsights.map((insight) => insight.ad_id).filter(Boolean));
  return {
    adsFetched: ads.length,
    adInsightsFetched: adInsights.length,
    adsWithInsights: [...listedAdIds].filter((adId) => insightAdIds.has(adId)).length,
    insightOnlyAds: adSummaries.filter((ad) => ad.adId && !listedAdIds.has(ad.adId)).length,
    adsAttachedToAdSets: countAttachedAds(campaigns),
  };
}

function countAttachedAds(campaigns = []) {
  return campaigns.reduce(
    (total, campaign) =>
      total +
      (campaign.adSets ?? []).reduce(
        (adSetTotal, adSet) => adSetTotal + (adSet.ads ?? []).length,
        0,
      ),
    0,
  );
}

function buildCampaignSummaries({
  latestSnapshots = [],
  recommendations = [],
  campaignConfigs = [],
  campaignInsights = [],
  ads = [],
  accountProfile,
  targetResultType,
}) {
  const recommendationByEntity = latestByEntity(recommendations);
  const snapshotByEntity = latestByEntity(latestSnapshots);
  const campaignConfigById = new Map(campaignConfigs.map((campaign) => [campaign.id, campaign]));
  const campaignInsightById = new Map(campaignInsights.map((row) => [row.campaign_id, row]));
  const adsByAdSetId = new Map();
  for (const ad of ads) {
    const adSetId = ad.adSetId;
    if (!adSetId) {
      continue;
    }
    adsByAdSetId.set(adSetId, [...(adsByAdSetId.get(adSetId) ?? []), ad]);
  }
  const campaigns = new Map();

  for (const snapshot of snapshotByEntity.values()) {
    const campaignId = snapshot.campaignId || snapshot.entityId;
    const campaignName = snapshot.campaignName || snapshot.entityName || campaignId;
    if (!campaignId) {
      continue;
    }
    if (!campaigns.has(campaignId)) {
      const campaignConfig = campaignConfigById.get(campaignId);
      const budgetInfo = detectBudgetMode({ campaign: campaignConfig, adsets: [] });
      campaigns.set(campaignId, {
        campaignId,
        campaignName,
        objective: snapshot.campaignObjective || campaignConfig?.objective,
        status: campaignConfig?.effective_status,
        spend: 0,
        resultCount: 0,
        resultType: snapshot.resultType,
        configuredResultType: snapshot.configuredResultType,
        currency: snapshot.currency,
        dailyBudget: 0,
        impressions: 0,
        reach: 0,
        clicks: 0,
        frequencyWeightedTotal: 0,
        frequencyWeight: 0,
        frequencyTotal: 0,
        frequencyCount: 0,
        budgetLevel: budgetInfo.budgetLevel,
        editableBudgetLevel: budgetInfo.editableBudgetLevel,
        budgetMode: budgetInfo.budgetMode,
        adSets: [],
      });
    }

    const campaign = campaigns.get(campaignId);
    const spend = Number(snapshot.spend ?? 0);
    const resultCount = Number(snapshot.resultCount ?? 0);
    const dailyBudget = Number(snapshot.dailyBudget ?? 0);
    campaign.spend += spend;
    campaign.resultCount += resultCount;
    campaign.dailyBudget += dailyBudget;
    campaign.impressions += Number(snapshot.impressions ?? 0);
    campaign.reach += Number(snapshot.reach ?? 0);
    campaign.clicks += Number(snapshot.clicks ?? 0);
    addFrequencySample(campaign, snapshot.frequency, snapshot.impressions);
    campaign.frequency = resolveAverageFrequency(campaign);
    campaign.ctr =
      campaign.impressions > 0
        ? Number(((campaign.clicks / campaign.impressions) * 100).toFixed(2))
        : 0;
    campaign.cpa =
      campaign.resultCount > 0 ? Number((campaign.spend / campaign.resultCount).toFixed(2)) : null;

    const latestRecommendation = recommendationByEntity.get(snapshot.entityId);
    const entityName = getSnapshotAdSetName(snapshot, campaignName);
    campaign.adSets.push({
      entityId: snapshot.entityId,
      entityName,
      campaignId,
      campaignName,
      status: snapshot.status,
      dailyBudget: snapshot.dailyBudget,
      spend: snapshot.spend,
      cpa: snapshot.cpa,
      roas: snapshot.roas,
      conversionValue: snapshot.conversionValue,
      resultCount: snapshot.resultCount,
      resultType: snapshot.resultType,
      configuredResultType: snapshot.configuredResultType,
      resultTypeBreakdown: snapshot.resultTypeBreakdown,
      currency: snapshot.currency,
      impressions: snapshot.impressions,
      reach: snapshot.reach,
      frequency: snapshot.frequency,
      clicks: snapshot.clicks,
      ctr: snapshot.ctr,
      cpc: snapshot.cpc,
      cpm: snapshot.cpm,
      videoP75Watched: snapshot.videoP75Watched,
      videoP75Rate: snapshot.videoP75Rate,
      snapshotAt: snapshot.createdAt,
      latestRecommendation,
      ads: adsByAdSetId.get(snapshot.entityId) ?? [],
    });
  }

  for (const campaign of campaigns.values()) {
    const campaignConfig = campaignConfigById.get(campaign.campaignId);
    const budgetInfo = detectBudgetMode({ campaign: campaignConfig, adsets: campaign.adSets });
    const campaignInsight = campaignInsightById.get(campaign.campaignId);
    campaign.budgetLevel = budgetInfo.budgetLevel;
    campaign.editableBudgetLevel = budgetInfo.editableBudgetLevel;
    campaign.budgetMode = budgetInfo.budgetMode;
    if (budgetInfo.budgetLevel === 'campaign') {
      campaign.dailyBudget = centsToDailyBudget(campaignConfig?.daily_budget);
    }
    if (campaignInsight) {
      const metrics = calculateMetrics(
        campaignInsight,
        resolveTargetResultType({
          targetResultType,
          accountProfile,
          campaignObjective: campaignConfig?.objective || campaign.objective,
        }),
      );
      campaign.campaignName = campaignInsight.campaign_name || campaign.campaignName;
      campaign.status = campaignConfig?.effective_status || campaign.status;
      campaign.spend = metrics.spend;
      campaign.resultCount = metrics.resultCount;
      campaign.cpa = metrics.cpa;
      campaign.roas = metrics.roas;
      campaign.conversionValue = metrics.conversionValue;
      campaign.resultType = metrics.resultType;
      campaign.impressions = metrics.impressions;
      campaign.reach = metrics.reach;
      campaign.frequency = metrics.frequency;
      campaign.clicks = metrics.clicks;
      campaign.ctr = metrics.ctr;
      campaign.cpc = metrics.cpc;
      campaign.cpm = metrics.cpm;
      campaign.videoP75Watched = metrics.videoP75Watched;
      campaign.videoP75Rate = metrics.videoP75Rate;
      campaign.resultTypeBreakdown = metrics.resultTypeBreakdown;
    }
    campaign.configuredResultType =
      getSingleConfiguredResultType(campaign.adSets) || campaign.configuredResultType;
    delete campaign.frequencyWeightedTotal;
    delete campaign.frequencyWeight;
    delete campaign.frequencyTotal;
    delete campaign.frequencyCount;
  }

  return Array.from(campaigns.values()).sort((left, right) => {
    const leftPending = left.adSets.some(
      (adset) => adset.latestRecommendation?.status === 'pending',
    );
    const rightPending = right.adSets.some(
      (adset) => adset.latestRecommendation?.status === 'pending',
    );
    if (leftPending !== rightPending) {
      return leftPending ? -1 : 1;
    }
    return Number(right.spend ?? 0) - Number(left.spend ?? 0);
  });
}

function buildDashboardSummary(campaigns = []) {
  const totalSpend = campaigns.reduce((sum, campaign) => sum + Number(campaign.spend ?? 0), 0);
  const resultTypes = new Map();
  for (const campaign of campaigns) {
    const sources =
      Array.isArray(campaign.resultTypeBreakdown) && campaign.resultTypeBreakdown.length > 0
        ? [campaign]
        : (campaign.adSets ?? []).length > 0
          ? campaign.adSets
          : [campaign];
    for (const source of sources) {
      addSourceResultTypeSummaries(resultTypes, source, campaign.resultType);
    }
  }
  const compatibleResults = getCompatibleResultTotals(resultTypes);
  const frequencySummary = {};
  for (const campaign of campaigns) {
    addFrequencySample(frequencySummary, campaign.frequency, campaign.impressions);
  }
  const campaignsWithCost = campaigns.filter((campaign) => Number.isFinite(Number(campaign.cpa)));
  const sortedByCost = [...campaignsWithCost].sort(
    (first, second) => Number(first.cpa) - Number(second.cpa),
  );

  return {
    totalSpend: Number(totalSpend.toFixed(2)),
    totalResults: compatibleResults.totalResults,
    averageCostPerResult:
      compatibleResults.totalResults != null && compatibleResults.totalResults > 0
        ? Number((totalSpend / compatibleResults.totalResults).toFixed(2))
        : null,
    averageFrequency: resolveAverageFrequency(frequencySummary),
    bestCampaignByCost: sortedByCost[0],
    worstCampaignByCost: sortedByCost[sortedByCost.length - 1],
    objectives: buildObjectiveSummary(campaigns),
  };
}

function createObjectiveSummaryItem(objective) {
  return {
    objective,
    label: objective,
    campaignCount: 0,
    totalSpend: 0,
    totalResults: 0,
    impressions: 0,
    clicks: 0,
    frequencyWeightedTotal: 0,
    frequencyWeight: 0,
    frequencyTotal: 0,
    frequencyCount: 0,
    resultTypes: new Map(),
  };
}

function createResultTypeSummaryItem(resultType) {
  return {
    resultType,
    label: resultType,
    totalSpend: 0,
    totalResults: 0,
    clicks: 0,
    impressions: 0,
  };
}

function addResultTypeSummary(resultTypes, resultType, spend, results, clicks, impressions) {
  const resultTypeKey = resultType || 'UNKNOWN';
  const resultTypeSummary =
    resultTypes.get(resultTypeKey) ?? createResultTypeSummaryItem(resultTypeKey);
  resultTypes.set(resultTypeKey, resultTypeSummary);
  resultTypeSummary.totalSpend += Number(spend ?? 0);
  resultTypeSummary.totalResults += Number(results ?? 0);
  resultTypeSummary.clicks += Number(clicks ?? 0);
  resultTypeSummary.impressions += Number(impressions ?? 0);
}

function addSourceResultTypeSummaries(resultTypes, source, fallbackResultType) {
  if (Array.isArray(source?.resultTypeBreakdown) && source.resultTypeBreakdown.length > 0) {
    for (const resultType of source.resultTypeBreakdown) {
      addResultTypeSummary(
        resultTypes,
        resultType.resultType,
        resultType.totalSpend,
        resultType.totalResults,
        source.clicks,
        source.impressions,
      );
    }
    return;
  }
  addResultTypeSummary(
    resultTypes,
    source?.resultType || fallbackResultType || 'UNKNOWN',
    source?.spend,
    source?.resultCount,
    source?.clicks,
    source?.impressions,
  );
}

function getCompatibleResultTotals(resultTypes) {
  if (resultTypes.size !== 1) {
    return {
      totalResults: null,
      averageCostPerResult: null,
    };
  }
  const [resultType] = Array.from(resultTypes.values());
  return {
    totalResults: Number(resultType.totalResults.toFixed(2)),
    averageCostPerResult:
      resultType.totalResults > 0
        ? Number((resultType.totalSpend / resultType.totalResults).toFixed(2))
        : null,
  };
}

function buildObjectiveSummary(campaigns = []) {
  const objectives = new Map();

  for (const campaign of campaigns) {
    const objective = campaign.objective || 'UNKNOWN';
    const summary = objectives.get(objective) ?? createObjectiveSummaryItem(objective);
    objectives.set(objective, summary);

    const spend = Number(campaign.spend ?? 0);
    const results = Number(campaign.resultCount ?? 0);
    const impressions = Number(campaign.impressions ?? 0);
    const clicks = Number(campaign.clicks ?? 0);

    summary.campaignCount += 1;
    summary.totalSpend += Number.isFinite(spend) ? spend : 0;
    summary.totalResults += Number.isFinite(results) ? results : 0;
    summary.impressions += Number.isFinite(impressions) ? impressions : 0;
    summary.clicks += Number.isFinite(clicks) ? clicks : 0;
    addFrequencySample(summary, campaign.frequency, impressions);

    if (Array.isArray(campaign.resultTypeBreakdown) && campaign.resultTypeBreakdown.length > 0) {
      addSourceResultTypeSummaries(summary.resultTypes, campaign, campaign.resultType);
    } else {
      for (const adset of campaign.adSets ?? []) {
        addSourceResultTypeSummaries(summary.resultTypes, adset, campaign.resultType);
      }

      if ((campaign.adSets ?? []).length === 0) {
        addSourceResultTypeSummaries(summary.resultTypes, campaign, campaign.resultType);
      }
    }
  }

  return Array.from(objectives.values())
    .map((summary) => {
      const resultTypes = Array.from(summary.resultTypes.values()).map((resultType) => ({
        ...resultType,
        totalSpend: Number(resultType.totalSpend.toFixed(2)),
        totalResults: Number(resultType.totalResults.toFixed(2)),
        averageCostPerResult:
          resultType.totalResults > 0
            ? Number((resultType.totalSpend / resultType.totalResults).toFixed(2))
            : null,
        averageCtr:
          resultType.impressions > 0
            ? Number(((resultType.clicks / resultType.impressions) * 100).toFixed(2))
            : null,
      }));
      const compatibleResults = getCompatibleResultTotals(summary.resultTypes);
      return {
        objective: summary.objective,
        label: summary.label,
        campaignCount: summary.campaignCount,
        totalSpend: Number(summary.totalSpend.toFixed(2)),
        totalResults: compatibleResults.totalResults,
        averageCostPerResult: compatibleResults.averageCostPerResult,
        averageFrequency: resolveAverageFrequency(summary),
        averageCtr:
          summary.impressions > 0
            ? Number(((summary.clicks / summary.impressions) * 100).toFixed(2))
            : null,
        resultTypes: resultTypes.sort(
          (left, right) => Number(right.totalResults ?? 0) - Number(left.totalResults ?? 0),
        ),
      };
    })
    .sort((left, right) => Number(right.totalSpend ?? 0) - Number(left.totalSpend ?? 0));
}

function roundMetric(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Number(numeric.toFixed(2)) : null;
}

function addFrequencySample(target, frequency, impressions) {
  const numericFrequency = Number(frequency);
  if (!Number.isFinite(numericFrequency)) {
    return;
  }
  const numericImpressions = Number(impressions);
  if (Number.isFinite(numericImpressions) && numericImpressions > 0) {
    target.frequencyWeightedTotal =
      Number(target.frequencyWeightedTotal ?? 0) + numericFrequency * numericImpressions;
    target.frequencyWeight = Number(target.frequencyWeight ?? 0) + numericImpressions;
    return;
  }
  target.frequencyTotal = Number(target.frequencyTotal ?? 0) + numericFrequency;
  target.frequencyCount = Number(target.frequencyCount ?? 0) + 1;
}

function resolveAverageFrequency(target) {
  const weight = Number(target.frequencyWeight ?? 0);
  if (weight > 0) {
    return roundMetric(Number(target.frequencyWeightedTotal ?? 0) / weight);
  }
  const count = Number(target.frequencyCount ?? 0);
  return count > 0 ? roundMetric(Number(target.frequencyTotal ?? 0) / count) : null;
}

function getSnapshotDateKey(snapshot) {
  const date = new Date(snapshot.createdAt ?? snapshot.updatedAt ?? Date.now());
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toISOString().slice(0, 10);
}

function getInsightDateKey(row) {
  return row?.date_start || row?.date_stop || null;
}

function buildCampaignMetadata(campaigns = []) {
  const campaignsById = new Map();
  const adsetsById = new Map();
  const adsById = new Map();
  for (const campaign of campaigns) {
    campaignsById.set(campaign.campaignId, {
      objective: campaign.objective,
      resultType: campaign.resultType,
      entityName: campaign.campaignName,
    });
    for (const adset of campaign.adSets ?? []) {
      adsetsById.set(adset.entityId, {
        objective: campaign.objective,
        resultType: adset.resultType || campaign.resultType,
        entityName: adset.entityName,
        parentCampaignName: campaign.campaignName,
      });
      for (const ad of adset.ads ?? []) {
        adsById.set(ad.adId, {
          objective: campaign.objective,
          resultType: ad.resultType || adset.resultType || campaign.resultType,
          entityName: ad.adName,
          parentCampaignName: adset.entityName || campaign.campaignName,
        });
      }
    }
  }
  return { campaignsById, adsetsById, adsById };
}

function buildEvolutionDelta(series, latestChange) {
  const sorted = [...(series.points ?? [])].sort((left, right) =>
    left.date.localeCompare(right.date),
  );
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  if (!first || !last) {
    return null;
  }
  return {
    level: series.level,
    entityId: series.entityId,
    entityName: series.entityName,
    parentCampaignName: series.parentCampaignName,
    firstDate: first.date,
    lastDate: last.date,
    spendDelta: roundMetric(Number(last.spend ?? 0) - Number(first.spend ?? 0)) ?? 0,
    resultDelta: roundMetric(Number(last.resultCount ?? 0) - Number(first.resultCount ?? 0)) ?? 0,
    cpaDelta:
      last.cpa != null && first.cpa != null
        ? roundMetric(Number(last.cpa) - Number(first.cpa))
        : null,
    budgetDelta: roundMetric(Number(last.dailyBudget ?? 0) - Number(first.dailyBudget ?? 0)) ?? 0,
    frequencyDelta:
      last.frequency != null && first.frequency != null
        ? roundMetric(Number(last.frequency) - Number(first.frequency))
        : null,
    latestChange,
  };
}

function buildAdSeriesFromInsights({
  adDailyInsights = [],
  campaigns = [],
  accountProfile,
  targetResultType,
}) {
  const resolvedTargetResultType = resolveTargetResultType({
    targetResultType,
    accountProfile,
  });
  const { adsById } = buildCampaignMetadata(campaigns);
  const seriesByAd = new Map();
  for (const row of adDailyInsights) {
    const adId = row.ad_id;
    const date = getInsightDateKey(row);
    if (!adId || !date) {
      continue;
    }
    const metrics = calculateMetrics(row, resolvedTargetResultType);
    const meta = adsById.get(adId) ?? {};
    const point = {
      date,
      campaignId: row.campaign_id,
      campaignName: row.campaign_name,
      adSetId: row.adset_id,
      adSetName: row.adset_name,
      adId,
      adName: row.ad_name || meta.entityName || adId,
      spend: roundMetric(metrics.spend) ?? 0,
      resultCount: roundMetric(metrics.resultCount) ?? 0,
      cpa: metrics.cpa == null ? null : roundMetric(metrics.cpa),
      frequency: metrics.frequency == null ? null : roundMetric(metrics.frequency),
      impressions: roundMetric(metrics.impressions) ?? 0,
      clicks: roundMetric(metrics.clicks) ?? 0,
      ctr: metrics.ctr == null ? null : roundMetric(metrics.ctr),
    };
    const current = seriesByAd.get(adId) || {
      level: 'ad',
      entityId: adId,
      entityName: point.adName,
      parentCampaignName: meta.parentCampaignName || row.adset_name || row.campaign_name,
      objective: meta.objective,
      resultType: metrics.resultType || meta.resultType,
      points: [],
    };
    current.points.push(point);
    seriesByAd.set(adId, current);
  }
  return Array.from(seriesByAd.values()).map((series) => ({
    ...series,
    points: series.points.sort((left, right) => left.date.localeCompare(right.date)),
  }));
}

function buildCampaignTrend({
  snapshots = [],
  changes = [],
  campaigns = [],
  adDailyInsights = [],
  accountProfile,
  targetResultType,
}) {
  const metadata = buildCampaignMetadata(campaigns);
  const latestByDateEntity = new Map();
  const entityCampaignId = new Map();
  const entityCampaignName = new Map();

  for (const snapshot of snapshots) {
    const date = getSnapshotDateKey(snapshot);
    const entityId = snapshot.entityId;
    const campaignId = snapshot.campaignId || snapshot.entityId;
    if (!date || !entityId || !campaignId) {
      continue;
    }
    entityCampaignId.set(entityId, campaignId);
    entityCampaignName.set(entityId, snapshot.campaignName || snapshot.entityName || campaignId);
    const key = `${date}:${campaignId}:${entityId}`;
    const current = latestByDateEntity.get(key);
    if (!current || String(snapshot.createdAt ?? '') > String(current.createdAt ?? '')) {
      latestByDateEntity.set(key, snapshot);
    }
  }

  const pointsByDateCampaign = new Map();
  for (const snapshot of latestByDateEntity.values()) {
    const date = getSnapshotDateKey(snapshot);
    const campaignId = snapshot.campaignId || snapshot.entityId;
    if (!date || !campaignId) {
      continue;
    }
    const key = `${date}:${campaignId}`;
    const point = pointsByDateCampaign.get(key) || {
      date,
      campaignId,
      campaignName: snapshot.campaignName || snapshot.entityName || campaignId,
      spend: 0,
      resultCount: 0,
      dailyBudget: 0,
      impressions: 0,
      clicks: 0,
      frequencyWeightedTotal: 0,
      frequencyWeight: 0,
      frequencyTotal: 0,
      frequencyCount: 0,
    };
    point.spend += Number(snapshot.spend ?? 0);
    point.resultCount += Number(snapshot.resultCount ?? 0);
    point.dailyBudget += Number(snapshot.dailyBudget ?? 0);
    point.impressions += Number(snapshot.impressions ?? 0);
    point.clicks += Number(snapshot.clicks ?? 0);
    addFrequencySample(point, snapshot.frequency, snapshot.impressions);
    point.frequency = resolveAverageFrequency(point);
    point.cpa = point.resultCount > 0 ? roundMetric(point.spend / point.resultCount) : null;
    point.ctr =
      point.impressions > 0 ? roundMetric((point.clicks / point.impressions) * 100) : null;
    pointsByDateCampaign.set(key, point);
  }

  const points = Array.from(pointsByDateCampaign.values())
    .map((point) => {
      const publicPoint = { ...point };
      delete publicPoint.frequencyWeightedTotal;
      delete publicPoint.frequencyWeight;
      delete publicPoint.frequencyTotal;
      delete publicPoint.frequencyCount;
      return {
        ...publicPoint,
        spend: roundMetric(point.spend) ?? 0,
        resultCount: roundMetric(point.resultCount) ?? 0,
        dailyBudget: roundMetric(point.dailyBudget) ?? 0,
        frequency: roundMetric(point.frequency) ?? null,
        impressions: roundMetric(point.impressions) ?? 0,
        clicks: roundMetric(point.clicks) ?? 0,
      };
    })
    .sort((left, right) =>
      left.date === right.date
        ? String(left.campaignName ?? left.campaignId).localeCompare(
            String(right.campaignName ?? right.campaignId),
          )
        : left.date.localeCompare(right.date),
    );

  const latestChangeByCampaign = new Map();
  const latestChangeByEntity = new Map();
  const changesByDayMap = new Map();
  for (const change of changes) {
    const date = getSnapshotDateKey(change);
    if (!date) {
      continue;
    }
    const campaignId = change.campaignId || entityCampaignId.get(change.entityId);
    const campaignName = change.campaignName || entityCampaignName.get(change.entityId);
    if (campaignId) {
      const current = latestChangeByCampaign.get(campaignId);
      if (!current || String(change.createdAt ?? '') > String(current.createdAt ?? '')) {
        latestChangeByCampaign.set(campaignId, {
          ...change,
          campaignId,
          campaignName,
        });
      }
    }
    if (change.entityId) {
      const current = latestChangeByEntity.get(change.entityId);
      if (!current || String(change.createdAt ?? '') > String(current.createdAt ?? '')) {
        latestChangeByEntity.set(change.entityId, change);
      }
    }
    const dailyChange = changesByDayMap.get(date) || {
      date,
      totalDeltaDailyBudget: 0,
      changeCount: 0,
    };
    dailyChange.totalDeltaDailyBudget += Number(change.deltaDailyBudget ?? 0);
    dailyChange.changeCount += 1;
    changesByDayMap.set(date, dailyChange);
  }

  const pointsByCampaign = new Map();
  for (const point of points) {
    const campaignPoints = pointsByCampaign.get(point.campaignId) || [];
    campaignPoints.push(point);
    pointsByCampaign.set(point.campaignId, campaignPoints);
  }
  const campaignSeries = Array.from(pointsByCampaign.entries()).map(
    ([campaignId, campaignPoints]) => {
      const sorted = [...campaignPoints].sort((left, right) => left.date.localeCompare(right.date));
      const last = sorted[sorted.length - 1];
      return {
        level: 'campaign',
        entityId: campaignId,
        entityName: last?.campaignName || campaignId,
        objective: metadata.campaignsById.get(campaignId)?.objective,
        resultType: metadata.campaignsById.get(campaignId)?.resultType,
        points: sorted,
      };
    },
  );
  const pointsByAdSet = new Map();
  for (const snapshot of latestByDateEntity.values()) {
    const date = getSnapshotDateKey(snapshot);
    const entityId = snapshot.entityId;
    const campaignId = snapshot.campaignId || snapshot.entityId;
    if (!date || !entityId) {
      continue;
    }
    const resultCount = Number(snapshot.resultCount ?? 0);
    const spend = Number(snapshot.spend ?? 0);
    const impressions = Number(snapshot.impressions ?? 0);
    const clicks = Number(snapshot.clicks ?? 0);
    const point = {
      date,
      campaignId,
      campaignName: snapshot.campaignName || campaignId,
      spend: roundMetric(spend) ?? 0,
      resultCount: roundMetric(resultCount) ?? 0,
      cpa: resultCount > 0 ? roundMetric(spend / resultCount) : null,
      dailyBudget: roundMetric(Number(snapshot.dailyBudget ?? 0)) ?? 0,
      frequency: roundMetric(snapshot.frequency) ?? null,
      impressions: roundMetric(impressions) ?? 0,
      clicks: roundMetric(clicks) ?? 0,
      ctr: impressions > 0 ? roundMetric((clicks / impressions) * 100) : null,
    };
    const current = pointsByAdSet.get(entityId) || {
      level: 'adset',
      entityId,
      entityName: snapshot.entityName || entityId,
      parentCampaignName: snapshot.campaignName || campaignId,
      objective: metadata.adsetsById.get(entityId)?.objective,
      resultType: snapshot.resultType || metadata.adsetsById.get(entityId)?.resultType,
      points: [],
    };
    current.points.push(point);
    pointsByAdSet.set(entityId, current);
  }
  const adSetSeries = Array.from(pointsByAdSet.values()).map((series) => ({
    ...series,
    points: series.points.sort((left, right) => left.date.localeCompare(right.date)),
  }));
  const adSeries = buildAdSeriesFromInsights({
    adDailyInsights,
    campaigns,
    accountProfile,
    targetResultType,
  });

  const campaignDeltas = Array.from(pointsByCampaign.entries())
    .map(([campaignId, campaignPoints]) => {
      const sorted = [...campaignPoints].sort((left, right) => left.date.localeCompare(right.date));
      const first = sorted[0];
      const last = sorted[sorted.length - 1];
      return {
        campaignId,
        campaignName: last.campaignName || first.campaignName || campaignId,
        firstDate: first.date,
        lastDate: last.date,
        spendDelta: roundMetric(Number(last.spend ?? 0) - Number(first.spend ?? 0)) ?? 0,
        resultDelta:
          roundMetric(Number(last.resultCount ?? 0) - Number(first.resultCount ?? 0)) ?? 0,
        cpaDelta:
          last.cpa != null && first.cpa != null
            ? roundMetric(Number(last.cpa) - Number(first.cpa))
            : null,
        budgetDelta:
          roundMetric(Number(last.dailyBudget ?? 0) - Number(first.dailyBudget ?? 0)) ?? 0,
        frequencyDelta:
          last.frequency != null && first.frequency != null
            ? roundMetric(Number(last.frequency) - Number(first.frequency))
            : null,
        latestChange: latestChangeByCampaign.get(campaignId),
      };
    })
    .sort((left, right) => Number(right.spendDelta ?? 0) - Number(left.spendDelta ?? 0));

  const changesByDay = Array.from(changesByDayMap.values())
    .map((change) => ({
      ...change,
      totalDeltaDailyBudget: roundMetric(change.totalDeltaDailyBudget) ?? 0,
    }))
    .sort((left, right) => left.date.localeCompare(right.date));

  const series = [...campaignSeries, ...adSetSeries, ...adSeries];
  const entityDeltas = series
    .map((item) =>
      buildEvolutionDelta(
        item,
        item.level === 'campaign'
          ? latestChangeByCampaign.get(item.entityId)
          : latestChangeByEntity.get(item.entityId),
      ),
    )
    .filter(Boolean)
    .sort((left, right) => Number(right.spendDelta ?? 0) - Number(left.spendDelta ?? 0));

  return {
    points,
    series,
    campaignDeltas,
    entityDeltas,
    changesByDay,
  };
}

function resolveStatusPeriod(options = {}, now = new Date()) {
  if (options.since || options.until) {
    return {
      since: options.since,
      until: options.until,
    };
  }
  const timeZone = getMetaAdsTimeZone();
  const today = getMetaAdsDateKey(now, timeZone);
  if (options.datePreset === 'today') {
    return { since: today, until: today, datePreset: options.datePreset };
  }
  if (options.datePreset === 'yesterday') {
    const yesterday = getMetaAdsDateKey(addDays(now, -1), timeZone);
    return { since: yesterday, until: yesterday, datePreset: options.datePreset };
  }
  if (options.datePreset === 'this_month') {
    const { since, until } = getMetaAdsMonthRange(undefined, timeZone, now);
    return { since, until, datePreset: options.datePreset };
  }
  if (options.datePreset === 'last_month') {
    const previousMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
    const month = `${previousMonth.getUTCFullYear()}-${String(
      previousMonth.getUTCMonth() + 1,
    ).padStart(2, '0')}`;
    const { since, until } = getMetaAdsMonthRange(month, timeZone, now);
    return { since, until, datePreset: options.datePreset };
  }
  const hoursByPreset = {
    last_6h: 6,
    last_24h: 24,
  };
  const hours = hoursByPreset[options.datePreset];
  if (hours) {
    return {
      since: new Date(now.getTime() - hours * 60 * 60 * 1000).toISOString(),
      until: now.toISOString(),
    };
  }
  const daysByPreset = {
    last_1d: 1,
    last_2d: 2,
    last_3d: 3,
    last_7d: 7,
    last_14d: 14,
    last_30d: 30,
  };
  const days = daysByPreset[options.datePreset];
  if (days) {
    const since = getMetaAdsDateKey(addDays(now, -(days - 1)), timeZone);
    return { since, until: today, datePreset: options.datePreset };
  }
  return {};
}

function resolveAutomationAnalysisPeriod(metaAds = {}, now = new Date()) {
  const preset = ANALYSIS_PRESETS.has(metaAds.automationAnalysisPreset)
    ? metaAds.automationAnalysisPreset
    : 'last_2d';
  return {
    ...resolveStatusPeriod({ datePreset: preset }, now),
  };
}

function getStatusPeriodCacheKey({
  projectId,
  tenantId,
  adAccountId,
  graphVersion,
  period,
  accountProfile,
  targetResultType,
}) {
  return JSON.stringify({
    payloadVersion: 3,
    projectId,
    tenantId,
    adAccountId,
    graphVersion,
    datePreset: period?.datePreset || '',
    since: period?.since || '',
    until: period?.until || '',
    accountProfile: accountProfile || '',
    targetResultType: targetResultType || '',
  });
}

function getStatusPeriodCacheTtlMs(period) {
  if (!period?.until) {
    return STATUS_PERIOD_CACHE_TTL_MS;
  }
  const today = getMetaAdsDateKey();
  return String(period.until) >= today
    ? STATUS_PERIOD_TODAY_CACHE_TTL_MS
    : STATUS_PERIOD_HISTORICAL_CACHE_TTL_MS;
}

function getCachedStatusPeriod(cacheKey, period, { allowStale = false } = {}) {
  const cached = statusPeriodCache.get(cacheKey);
  if (!cached) {
    return null;
  }
  if (allowStale || Date.now() - cached.createdAt <= getStatusPeriodCacheTtlMs(period)) {
    return cached.value;
  }
  statusPeriodCache.delete(cacheKey);
  return null;
}

function setCachedStatusPeriod(cacheKey, value) {
  statusPeriodCache.set(cacheKey, {
    createdAt: Date.now(),
    value,
  });
  if (statusPeriodCache.size <= 100) {
    return;
  }
  const oldestKey = statusPeriodCache.keys().next().value;
  if (oldestKey) {
    statusPeriodCache.delete(oldestKey);
  }
}

function resolveReportPeriod(options = {}) {
  const period = resolveStatusPeriod(options);
  if (period.since && period.until) {
    return period;
  }
  return resolveStatusPeriod({ datePreset: 'last_7d' });
}

function getDateRangeQuery(period) {
  const query = {};
  if (period?.since) {
    query.$gte = new Date(`${period.since}T00:00:00.000Z`);
  }
  if (period?.until) {
    query.$lte = new Date(`${period.until}T23:59:59.999Z`);
  }
  return Object.keys(query).length > 0 ? query : undefined;
}

function isConversionMetric(key) {
  return key === 'cpa' || key === 'roas';
}

function hasMeasuredResultCount(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0;
}

function isAwaitingConversionMetric(metrics, key) {
  if (!isConversionMetric(key)) {
    return false;
  }
  const value = toFiniteMetric(metrics?.[key]);
  const resultCount = toFiniteMetric(metrics?.resultCount);
  return (
    (resultCount != null && resultCount <= 0) ||
    (value === 0 && !hasMeasuredResultCount(resultCount))
  );
}

function getComparableMetricValue(metrics, key) {
  const value = toFiniteMetric(metrics?.[key]);
  if (!isConversionMetric(key)) {
    return value;
  }
  if (isAwaitingConversionMetric(metrics, key)) {
    return null;
  }
  return value != null && value > 0 ? value : null;
}

function averageMetric(items, key) {
  const values = items
    .map((item) => getComparableMetricValue(item, key))
    .filter((value) => value != null);
  if (values.length === 0) {
    return null;
  }
  return roundMetric(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function toFiniteMetric(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function sortActionsByCreatedAt(actions = []) {
  return [...actions].sort((left, right) => {
    const leftTime = new Date(left.createdAt || 0).getTime();
    const rightTime = new Date(right.createdAt || 0).getTime();
    return leftTime - rightTime;
  });
}

function getMetricEvolutionStatus({ firstCpa, lastCpa, firstRoas, lastRoas }) {
  const hasCpaComparison = firstCpa != null && lastCpa != null && firstCpa !== lastCpa;
  const hasRoasComparison = firstRoas != null && lastRoas != null && firstRoas !== lastRoas;
  if (!hasCpaComparison && !hasRoasComparison) {
    if ((firstCpa != null && lastCpa != null) || (firstRoas != null && lastRoas != null)) {
      return 'neutral';
    }
    return 'insufficient_data';
  }
  if ((hasCpaComparison && lastCpa < firstCpa) || (hasRoasComparison && lastRoas > firstRoas)) {
    return 'improved';
  }
  if ((hasCpaComparison && lastCpa > firstCpa) || (hasRoasComparison && lastRoas < firstRoas)) {
    return 'regressed';
  }
  return 'neutral';
}

function getFirstLastMetric(actions, key) {
  const latestAction = actions[actions.length - 1] || null;
  const awaiting = latestAction ? isAwaitingConversionMetric(latestAction, key) : false;
  const values = actions
    .map((action) => ({
      value: getComparableMetricValue(action, key),
      createdAt: action.createdAt,
      resultCount: toFiniteMetric(action.resultCount),
      spend: toFiniteMetric(action.spend),
    }))
    .filter((item) => item.value != null);
  if (values.length === 0) {
    return {
      first: null,
      last: null,
      latest: latestAction
        ? {
            createdAt: latestAction.createdAt,
            resultCount: toFiniteMetric(latestAction.resultCount),
            spend: toFiniteMetric(latestAction.spend),
          }
        : null,
      awaiting,
    };
  }
  return {
    first: values[0],
    last: values.length >= 2 && !awaiting ? values[values.length - 1] : null,
    latest: latestAction
      ? {
          createdAt: latestAction.createdAt,
          resultCount: toFiniteMetric(latestAction.resultCount),
          spend: toFiniteMetric(latestAction.spend),
        }
      : null,
    awaiting,
  };
}

function getRealBeforeAfterMetric(actions, key) {
  const actionsWithAfterMetrics = actions.filter((action) => action.afterMetrics);
  const firstAction = actionsWithAfterMetrics.find((action) => action.beforeMetrics) || null;
  const lastAction = actionsWithAfterMetrics[actionsWithAfterMetrics.length - 1] || null;
  const firstValue = getComparableMetricValue(firstAction?.beforeMetrics, key);
  const lastValue = getComparableMetricValue(lastAction?.afterMetrics, key);
  const awaiting = lastAction?.afterMetrics
    ? isAwaitingConversionMetric(lastAction.afterMetrics, key)
    : false;
  return {
    first:
      firstValue != null
        ? {
            value: firstValue,
            createdAt: firstAction?.createdAt,
            resultCount: toFiniteMetric(firstAction?.beforeMetrics?.resultCount),
            spend: toFiniteMetric(firstAction?.beforeMetrics?.spend),
          }
        : null,
    last:
      lastValue != null && !awaiting
        ? { value: lastValue, createdAt: lastAction?.afterMeasuredAt || lastAction?.createdAt }
        : null,
    latest: lastAction
      ? {
          createdAt: lastAction.afterMeasuredAt || lastAction.createdAt,
          resultCount: toFiniteMetric(lastAction.afterMetrics?.resultCount),
          spend: toFiniteMetric(lastAction.afterMetrics?.spend),
        }
      : null,
    awaiting,
  };
}

function getConversionEvidence({ target, targetMetricGoal, rules = {} }) {
  const evidenceSpend = roundMetric(target?.latest?.spend) ?? null;
  const evidenceSpendBasis = roundMetric(targetMetricGoal) ?? null;
  const evidenceMultiplier =
    toFiniteMetric(rules.conversionEvidenceMultiplier) ??
    DEFAULT_RULES.conversionEvidenceMultiplier;
  const evidenceSpendThreshold =
    evidenceSpendBasis != null ? roundMetric(evidenceSpendBasis * evidenceMultiplier) : null;
  const noResultAfterSpend =
    Boolean(target?.awaiting) &&
    evidenceSpend != null &&
    evidenceSpendThreshold != null &&
    evidenceSpend >= evidenceSpendThreshold;
  let decisionReason;
  if (noResultAfterSpend) {
    decisionReason = 'no_result_after_spend';
  } else if (target?.awaiting) {
    decisionReason = 'awaiting_results';
  }
  return {
    evidenceSpend,
    evidenceSpendBasis,
    evidenceMultiplier,
    evidenceSpendThreshold,
    noResultAfterSpend,
    canAct: noResultAfterSpend,
    decisionReason,
  };
}

function getActionPrimaryMetric(actions = []) {
  return actions.find((action) => PRIMARY_METRICS.has(action.primaryMetric))?.primaryMetric || null;
}

function getFallbackTargetMetric({
  firstCpa,
  lastCpa,
  firstRoas,
  lastRoas,
  cpaAwaiting,
  roasAwaiting,
}) {
  if (cpaAwaiting || (firstCpa != null && lastCpa != null)) {
    return 'cpa';
  }
  if (roasAwaiting || (firstRoas != null && lastRoas != null)) {
    return 'roas';
  }
  return null;
}

function getTargetMetricStatus({ metric, firstTargetMetric, lastTargetMetric }) {
  if (!metric || firstTargetMetric == null || lastTargetMetric == null) {
    return null;
  }
  if (firstTargetMetric === lastTargetMetric) {
    return 'neutral';
  }
  const improved = isLowerBetterMetric(metric)
    ? lastTargetMetric < firstTargetMetric
    : lastTargetMetric > firstTargetMetric;
  return improved ? 'improved' : 'regressed';
}

function getAwaitableRuleStatus({ noResultAfterSpend, awaiting, fallbackStatus }) {
  if (noResultAfterSpend) {
    return 'no_result_after_spend';
  }
  if (awaiting) {
    return 'awaiting_results';
  }
  return fallbackStatus;
}

function getMissingResultEvidence({ spend, resultCount, rules = {}, latestActionAt }) {
  const evidenceSpend = roundMetric(toFiniteMetric(spend)) ?? 0;
  const evidenceSpendBasis = roundMetric(toFiniteMetric(rules.targetCpa)) ?? null;
  const evidenceMultiplier =
    toFiniteMetric(rules.conversionEvidenceMultiplier) ??
    DEFAULT_RULES.conversionEvidenceMultiplier;
  const evidenceMinHours =
    toFiniteMetric(rules.conversionEvidenceMinHours) ?? DEFAULT_RULES.conversionEvidenceMinHours;
  const evidenceSpendThreshold =
    evidenceSpendBasis != null ? roundMetric(evidenceSpendBasis * evidenceMultiplier) : null;
  const latestTime = latestActionAt ? new Date(latestActionAt).getTime() : null;
  const evidenceAgeHours =
    latestTime && Number.isFinite(latestTime)
      ? Math.max(0, (Date.now() - latestTime) / (60 * 60 * 1000))
      : null;
  const hasEnoughTime =
    evidenceAgeHours == null || evidenceMinHours <= 0 || evidenceAgeHours >= evidenceMinHours;
  const hasResult = Number(resultCount ?? 0) > 0;
  const noResultAfterSpend =
    !hasResult &&
    hasEnoughTime &&
    evidenceSpendThreshold != null &&
    evidenceSpend >= evidenceSpendThreshold;
  return {
    evidenceSpend,
    evidenceSpendBasis,
    evidenceMultiplier,
    evidenceMinHours,
    evidenceAgeHours: roundMetric(evidenceAgeHours),
    evidenceSpendThreshold,
    noResultAfterSpend,
    canAct: noResultAfterSpend,
    decisionReason: noResultAfterSpend ? 'no_result_after_spend' : 'awaiting_results',
  };
}

function getRulePerformanceComparison(actions = [], rules = {}) {
  const orderedActions = sortActionsByCreatedAt(actions);
  const actionsWithAfterMetrics = orderedActions.filter((action) => action.afterMetrics);
  const comparisonBasis = actionsWithAfterMetrics.length
    ? 'real_before_after'
    : 'period_first_last';
  const actionPrimaryMetric = getActionPrimaryMetric(orderedActions);
  if (comparisonBasis === 'real_before_after') {
    const firstAction = actionsWithAfterMetrics.find((action) => action.beforeMetrics) || null;
    const lastAction = actionsWithAfterMetrics[actionsWithAfterMetrics.length - 1] || null;
    const cpa = getRealBeforeAfterMetric(orderedActions, 'cpa');
    const roas = getRealBeforeAfterMetric(orderedActions, 'roas');
    const firstCpa = cpa.first?.value ?? null;
    const lastCpa = cpa.last?.value ?? null;
    const firstRoas = roas.first?.value ?? null;
    const lastRoas = roas.last?.value ?? null;
    const targetMetric =
      actionPrimaryMetric ||
      getFallbackTargetMetric({
        firstCpa,
        lastCpa,
        firstRoas,
        lastRoas,
        cpaAwaiting: cpa.awaiting,
        roasAwaiting: roas.awaiting,
      });
    const target = targetMetric ? getRealBeforeAfterMetric(orderedActions, targetMetric) : null;
    const firstTargetMetric = target?.first?.value ?? null;
    const lastTargetMetric = target?.last?.value ?? null;
    const targetMetricStatus = getTargetMetricStatus({
      metric: targetMetric,
      firstTargetMetric,
      lastTargetMetric,
    });
    const targetMetricGoal =
      toFiniteMetric(lastAction?.targetMetricValue) ??
      toFiniteMetric(firstAction?.targetMetricValue);
    const evidence = getConversionEvidence({ target, targetMetricGoal, rules });
    const { noResultAfterSpend, ...publicEvidence } = evidence;
    return {
      firstCpa,
      lastCpa,
      cpaDelta: firstCpa != null && lastCpa != null ? roundMetric(lastCpa - firstCpa) : null,
      firstRoas,
      lastRoas,
      roasDelta: firstRoas != null && lastRoas != null ? roundMetric(lastRoas - firstRoas) : null,
      targetMetric,
      targetMetricGoal,
      firstTargetMetric,
      lastTargetMetric,
      targetMetricDelta:
        firstTargetMetric != null && lastTargetMetric != null
          ? roundMetric(lastTargetMetric - firstTargetMetric)
          : null,
      firstResultCount: target?.first?.resultCount ?? null,
      lastResultCount: target?.latest?.resultCount ?? null,
      awaitingReason:
        target?.awaiting && !noResultAfterSpend ? 'missing_expected_result' : undefined,
      ...publicEvidence,
      firstActionAt: target?.first?.createdAt || firstAction?.createdAt,
      lastActionAt:
        target?.latest?.createdAt || lastAction?.afterMeasuredAt || lastAction?.createdAt,
      comparisonBasis,
      status: getAwaitableRuleStatus({
        noResultAfterSpend,
        awaiting: target?.awaiting,
        fallbackStatus:
          targetMetricStatus ??
          getMetricEvolutionStatus({ firstCpa, lastCpa, firstRoas, lastRoas }),
      }),
    };
  }
  const cpa = getFirstLastMetric(orderedActions, 'cpa');
  const roas = getFirstLastMetric(orderedActions, 'roas');
  const firstCpa = cpa.first?.value ?? null;
  const lastCpa = cpa.last?.value ?? null;
  const firstRoas = roas.first?.value ?? null;
  const lastRoas = roas.last?.value ?? null;
  const targetMetric =
    actionPrimaryMetric ||
    getFallbackTargetMetric({
      firstCpa,
      lastCpa,
      firstRoas,
      lastRoas,
      cpaAwaiting: cpa.awaiting,
      roasAwaiting: roas.awaiting,
    });
  const target = targetMetric ? getFirstLastMetric(orderedActions, targetMetric) : null;
  const firstTargetMetric = target?.first?.value ?? null;
  const lastTargetMetric = target?.last?.value ?? null;
  const targetMetricStatus = getTargetMetricStatus({
    metric: targetMetric,
    firstTargetMetric,
    lastTargetMetric,
  });
  const firstActionAt =
    target?.first?.createdAt ||
    cpa.first?.createdAt ||
    roas.first?.createdAt ||
    orderedActions[0]?.createdAt;
  const lastActionAt =
    target?.last?.createdAt ||
    cpa.last?.createdAt ||
    roas.last?.createdAt ||
    orderedActions[orderedActions.length - 1]?.createdAt;
  const targetMetricGoal = toFiniteMetric(
    orderedActions[orderedActions.length - 1]?.targetMetricValue,
  );
  const evidence = getConversionEvidence({ target, targetMetricGoal, rules });
  const { noResultAfterSpend, ...publicEvidence } = evidence;
  return {
    firstCpa,
    lastCpa,
    cpaDelta: firstCpa != null && lastCpa != null ? roundMetric(lastCpa - firstCpa) : null,
    firstRoas,
    lastRoas,
    roasDelta: firstRoas != null && lastRoas != null ? roundMetric(lastRoas - firstRoas) : null,
    targetMetric,
    targetMetricGoal,
    firstTargetMetric,
    lastTargetMetric,
    targetMetricDelta:
      firstTargetMetric != null && lastTargetMetric != null
        ? roundMetric(lastTargetMetric - firstTargetMetric)
        : null,
    firstResultCount: target?.first?.resultCount ?? null,
    lastResultCount: target?.latest?.resultCount ?? null,
    awaitingReason: target?.awaiting && !noResultAfterSpend ? 'missing_expected_result' : undefined,
    ...publicEvidence,
    firstActionAt,
    lastActionAt,
    comparisonBasis,
    status: getAwaitableRuleStatus({
      noResultAfterSpend,
      awaiting: target?.awaiting,
      fallbackStatus:
        targetMetricStatus ?? getMetricEvolutionStatus({ firstCpa, lastCpa, firstRoas, lastRoas }),
    }),
  };
}

function buildPerformanceSummary(actions = [], recommendations = []) {
  const aiActions = actions.filter((action) => action.actor !== 'user');
  const totalDeltaDailyBudget = actions.reduce(
    (sum, action) => sum + Number(action.deltaDailyBudget ?? 0),
    0,
  );
  const totalSpend = actions.reduce((sum, action) => sum + Number(action.spend ?? 0), 0);
  const totalResults = actions.reduce((sum, action) => sum + Number(action.resultCount ?? 0), 0);
  return {
    actionCount: actions.length,
    aiActionCount: aiActions.length,
    budgetChangeCount: actions.filter((action) => action.actionType === 'budget_change').length,
    pausedAdCount: actions.filter((action) => action.actionType === 'pause_ad').length,
    totalDeltaDailyBudget: roundMetric(totalDeltaDailyBudget) ?? 0,
    appliedRecommendationCount: recommendations.filter((item) => item.status === 'applied').length,
    blockedRecommendationCount: recommendations.filter((item) => item.status === 'blocked').length,
    ignoredRecommendationCount: recommendations.filter((item) => item.status === 'ignored').length,
    totalSpend: roundMetric(totalSpend) ?? 0,
    totalResults: roundMetric(totalResults) ?? 0,
    averageCpa: averageMetric(actions, 'cpa'),
    averageRoas: averageMetric(actions, 'roas'),
  };
}

async function getProjectMetaAdsPerformance(projectId, fallbackTenantId, options = {}) {
  const { MetaAdsAutomationAction, MetaAdsRecommendation } = getModels();
  const project = await runAsSystem(
    async () => (await getProjectById(projectId)) || (await findProjectById(projectId)),
  );
  const tenantId = project ? getProjectTenantId(project, fallbackTenantId) : fallbackTenantId;
  const period = resolveReportPeriod(options);
  const createdAt = getDateRangeQuery(period);
  const query = {
    projectId,
    ...(tenantId ? { tenantId } : {}),
    ...(createdAt ? { createdAt } : {}),
  };
  const [actions, recommendations] = await Promise.all([
    MetaAdsAutomationAction.find(query).sort({ createdAt: -1 }).limit(500).lean(),
    MetaAdsRecommendation.find(query).sort({ createdAt: -1 }).limit(500).lean(),
  ]);
  return {
    period,
    currency: 'BRL',
    summary: buildPerformanceSummary(actions, recommendations),
    actions,
    recommendations,
  };
}

async function getProjectMetaAdsAutomationRuns(projectId, fallbackTenantId, options = {}) {
  const { MetaAdsAutomationRun, MetaAdsRecommendation } = getModels();
  const project = await runAsSystem(
    async () => (await getProjectById(projectId)) || (await findProjectById(projectId)),
  );
  const tenantId = project ? getProjectTenantId(project, fallbackTenantId) : fallbackTenantId;
  const limit = Math.min(50, Math.max(1, Number(options.limit ?? 20) || 20));
  const query = {
    projectId,
    ...(tenantId ? { tenantId } : {}),
  };
  const runs = await MetaAdsAutomationRun.find(query).sort({ startedAt: -1 }).limit(limit).lean();
  const runIds = runs.map((run) => String(run._id)).filter(Boolean);
  const recommendations =
    runIds.length > 0
      ? await MetaAdsRecommendation.find({ ...query, automationRunId: { $in: runIds } })
          .sort({ createdAt: -1 })
          .limit(500)
          .lean()
      : [];
  const recommendationsByRunId = new Map();
  for (const recommendation of recommendations) {
    const runId = recommendation.automationRunId;
    if (!runId) {
      continue;
    }
    recommendationsByRunId.set(runId, [
      ...(recommendationsByRunId.get(runId) ?? []),
      recommendation,
    ]);
  }
  return {
    runs: runs.map((run) => ({
      ...run,
      recommendations: recommendationsByRunId.get(String(run._id)) ?? [],
    })),
  };
}

function buildRulePerformanceEntities(actions = []) {
  const groups = new Map();
  for (const action of actions) {
    const entityId = action.entityId || 'unknown';
    const entityLevel = action.entityLevel || 'unknown';
    const entityKey = `${entityLevel}:${entityId}`;
    const current = groups.get(entityKey) || {
      entityLevel,
      entityId,
      entityName: action.entityName || entityId,
      campaignName: action.campaignName,
      adsetName: action.adsetName,
      actions: [],
    };
    if (!current.entityName && action.entityName) {
      current.entityName = action.entityName;
    }
    if (!current.campaignName && action.campaignName) {
      current.campaignName = action.campaignName;
    }
    if (!current.adsetName && action.adsetName) {
      current.adsetName = action.adsetName;
    }
    current.actions.push(action);
    groups.set(entityKey, current);
  }
  return Array.from(groups.values())
    .map((group) => {
      const actions = sortActionsByCreatedAt(group.actions);
      const totalSpend = actions.reduce((sum, action) => sum + Number(action.spend ?? 0), 0);
      const comparison = getRulePerformanceComparison(actions);
      return {
        entityLevel: group.entityLevel,
        entityId: group.entityId,
        entityName: group.entityName,
        campaignName: group.campaignName,
        adsetName: group.adsetName,
        actionCount: group.actions.length,
        pausedAdCount: group.actions.filter((action) => action.actionType === 'pause_ad').length,
        totalSpend: roundMetric(totalSpend) ?? 0,
        averageCpa: averageMetric(actions, 'cpa'),
        averageRoas: averageMetric(actions, 'roas'),
        ...comparison,
      };
    })
    .sort((left, right) =>
      String(right.lastActionAt || '').localeCompare(String(left.lastActionAt || '')),
    );
}

function buildEntityStatusSummary(entities = []) {
  const summary = {
    improved: 0,
    neutral: 0,
    regressed: 0,
    insufficient_data: 0,
    awaiting_results: 0,
    no_result_after_spend: 0,
  };
  for (const entity of entities) {
    if (entity.status && Object.prototype.hasOwnProperty.call(summary, entity.status)) {
      summary[entity.status] += 1;
    }
  }
  return summary;
}

async function getProjectMetaAdsRulePerformance(projectId, fallbackTenantId, options = {}) {
  const performance = await getProjectMetaAdsPerformance(projectId, fallbackTenantId, options);
  const groups = new Map();
  for (const action of performance.actions) {
    const ruleKey = `${action.ruleSourceType || 'unknown'}:${action.ruleId || 'unknown'}`;
    const current = groups.get(ruleKey) || {
      ruleKey,
      ruleSourceType: action.ruleSourceType || 'unknown',
      ruleId: action.ruleId,
      ruleName: action.ruleName || 'Sem regra atribuída',
      ruleScope: action.ruleScope,
      actions: [],
    };
    current.actions.push(action);
    groups.set(ruleKey, current);
  }
  const rules = Array.from(groups.values()).map((group) => {
    const actions = sortActionsByCreatedAt(group.actions);
    const totalSpend = actions.reduce((sum, action) => sum + Number(action.spend ?? 0), 0);
    const totalResults = actions.reduce((sum, action) => sum + Number(action.resultCount ?? 0), 0);
    const comparison = getRulePerformanceComparison(actions);
    const entities = buildRulePerformanceEntities(actions);
    const entityStatusSummary = buildEntityStatusSummary(entities);
    const entityStatuses = entities.map((entity) => entity.status).filter(Boolean);
    const hasEntityLevelEvaluation = entities.length > 0;
    const hasMixedEntityStatuses = new Set(entityStatuses).size > 1;
    return {
      ...group,
      actions,
      actionCount: actions.length,
      aiActionCount: actions.filter((action) => action.actor !== 'user').length,
      pausedAdCount: actions.filter((action) => action.actionType === 'pause_ad').length,
      totalSpend: roundMetric(totalSpend) ?? 0,
      totalResults: roundMetric(totalResults) ?? 0,
      averageCpa: averageMetric(actions, 'cpa'),
      averageRoas: averageMetric(actions, 'roas'),
      ...comparison,
      entities,
      entityStatusSummary,
      hasEntityLevelEvaluation,
      hasMixedEntityStatuses,
    };
  });
  return {
    period: performance.period,
    currency: performance.currency,
    rules,
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

function normalizeRuleChangeSnapshot(metaAds = {}) {
  return {
    enabled: metaAds.enabled,
    automationAnalysisPreset: metaAds.automationAnalysisPreset ?? 'last_2d',
    clientGoal: metaAds.clientGoal ?? null,
    rules: metaAds.rules ?? {},
    creativeRules: metaAds.creativeRules ?? {},
    ruleGroups: omitRuleAudit(metaAds.ruleGroups ?? []),
    ruleOverrides: omitRuleAudit(metaAds.ruleOverrides ?? []),
  };
}

function getRuleChangeFields(beforeSnapshot, afterSnapshot) {
  return Object.keys(afterSnapshot).filter(
    (key) => JSON.stringify(beforeSnapshot[key]) !== JSON.stringify(afterSnapshot[key]),
  );
}

function getRuleOverrideChangeKey(ruleOverride) {
  return `${ruleOverride.entityLevel}:${ruleOverride.entityId}`;
}

function getChangedRuleItemFields(beforeRule = {}, afterRule = {}) {
  return [
    'enabled',
    'analysisPreset',
    'entityLevel',
    'entityIds',
    'entityId',
    'entityName',
    'rules',
    'creativeRules',
  ].filter((key) => JSON.stringify(beforeRule[key]) !== JSON.stringify(afterRule[key]));
}

function buildRuleItemChanges({ beforeItems = [], afterItems = [], getKey, ruleType }) {
  const beforeByKey = new Map(beforeItems.map((item) => [getKey(item), item]));
  const afterByKey = new Map(afterItems.map((item) => [getKey(item), item]));
  const keys = new Set([...beforeByKey.keys(), ...afterByKey.keys()]);
  return [...keys].flatMap((key) => {
    const beforeItem = beforeByKey.get(key);
    const afterItem = afterByKey.get(key);
    if (!beforeItem && afterItem) {
      return [
        {
          ruleKey: `${ruleType}:${key}`,
          ruleType,
          ruleName: afterItem.name ?? afterItem.entityName ?? afterItem.entityId,
          action: 'created',
          changedFields: getChangedRuleItemFields({}, afterItem),
        },
      ];
    }
    if (beforeItem && !afterItem) {
      return [
        {
          ruleKey: `${ruleType}:${key}`,
          ruleType,
          ruleName: beforeItem.name ?? beforeItem.entityName ?? beforeItem.entityId,
          action: 'deleted',
          changedFields: getChangedRuleItemFields(beforeItem, {}),
        },
      ];
    }
    const changedFields = getChangedRuleItemFields(beforeItem, afterItem);
    if (changedFields.length === 0) {
      return [];
    }
    return [
      {
        ruleKey: `${ruleType}:${key}`,
        ruleType,
        ruleName: afterItem.name ?? afterItem.entityName ?? afterItem.entityId,
        action: 'updated',
        changedFields,
      },
    ];
  });
}

function getProjectRuleChanges(before, after) {
  const globalFields = [
    'enabled',
    'automationAnalysisPreset',
    'clientGoal',
    'rules',
    'creativeRules',
  ].filter((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]));
  return [
    ...(globalFields.length > 0
      ? [
          {
            ruleKey: 'global',
            ruleType: 'global',
            ruleName: 'Global rules',
            action: 'updated',
            changedFields: globalFields,
          },
        ]
      : []),
    ...buildRuleItemChanges({
      beforeItems: before.ruleGroups,
      afterItems: after.ruleGroups,
      getKey: (group) => group.id,
      ruleType: 'group',
    }),
    ...buildRuleItemChanges({
      beforeItems: before.ruleOverrides,
      afterItems: after.ruleOverrides,
      getKey: getRuleOverrideChangeKey,
      ruleType: 'override',
    }),
  ];
}

async function recordProjectMetaAdsRuleChange({
  projectId,
  tenantId,
  beforeMetaAds,
  afterMetaAds,
  actor = 'user',
  actorUserId,
  actorUserName,
  actorUserEmail,
}) {
  const before = normalizeRuleChangeSnapshot(beforeMetaAds);
  const after = normalizeRuleChangeSnapshot(afterMetaAds);
  const changedFields = getRuleChangeFields(before, after);
  if (changedFields.length === 0) {
    return null;
  }
  const { MetaAdsRuleChange } = getModels();
  return MetaAdsRuleChange.create({
    tenantId,
    projectId,
    actor,
    actorUserId,
    actorUserName,
    actorUserEmail,
    changedFields,
    ruleChanges: getProjectRuleChanges(before, after),
    before,
    after,
  });
}

async function getProjectMetaAdsRuleHistory(projectId, fallbackTenantId) {
  const project = await runAsSystem(
    async () => (await getProjectById(projectId)) || (await findProjectById(projectId)),
  );
  const tenantId = project ? getProjectTenantId(project, fallbackTenantId) : fallbackTenantId;
  const query = tenantId ? { projectId, tenantId } : { projectId };
  const { MetaAdsRuleChange } = getModels();
  const changes = await MetaAdsRuleChange.find(query).sort({ createdAt: -1 }).limit(100).lean();
  const actorUserIds = [
    ...new Set(
      changes
        .filter(
          (change) =>
            change.actorUserId &&
            !change.actorUserEmail &&
            mongoose.Types.ObjectId.isValid(change.actorUserId),
        )
        .map((change) => change.actorUserId),
    ),
  ];
  if (actorUserIds.length === 0) {
    return { changes };
  }
  const users = await Promise.all(
    actorUserIds.map(async (userId) => [userId, await getUserById(userId, 'name email')]),
  );
  const usersById = new Map(users.filter(([, user]) => user));
  return {
    changes: changes.map((change) => {
      const user = usersById.get(change.actorUserId);
      if (!user) {
        return change;
      }
      return {
        ...change,
        actorUserName: change.actorUserName || user.name,
        actorUserEmail: user.email,
      };
    }),
  };
}

function getRankingCacheKey({
  projectId,
  tenantId,
  adAccountId,
  graphVersion,
  period,
  accountProfile,
  targetResultType,
  level,
  objective,
  resultType,
}) {
  return JSON.stringify({
    type: 'ranking',
    projectId,
    tenantId,
    adAccountId,
    graphVersion,
    datePreset: period?.datePreset || '',
    since: period?.since || '',
    until: period?.until || '',
    accountProfile: accountProfile || '',
    targetResultType: targetResultType || '',
    level,
    objective: objective || '',
    resultType: resultType || '',
  });
}

function normalizeRankingLevel(level) {
  return ['campaign', 'adset', 'ad'].includes(level) ? level : 'campaign';
}

function matchesRankingFilter(value, filter) {
  return !filter || filter === 'all' || value === filter;
}

function toRankingItem({ level, insight, metrics, meta = {}, adAccountId, thumbnailUrls = [] }) {
  const id =
    level === 'campaign'
      ? insight.campaign_id
      : level === 'adset'
        ? insight.adset_id
        : insight.ad_id;
  const name =
    level === 'campaign'
      ? insight.campaign_name || meta.name || id
      : level === 'adset'
        ? insight.adset_name || meta.name || id
        : insight.ad_name || meta.name || id;
  return {
    id,
    level,
    name,
    parentName: level === 'campaign' ? undefined : insight.campaign_name || meta.campaignName,
    campaignId: insight.campaign_id || meta.campaignId,
    campaignName: insight.campaign_name || meta.campaignName,
    objective: meta.objective || 'UNKNOWN',
    resultType: metrics.resultType || 'UNKNOWN',
    spend: metrics.spend,
    resultCount: metrics.resultCount,
    cpa: metrics.cpa,
    roas: metrics.roas,
    ctr: metrics.ctr,
    clicks: metrics.clicks,
    impressions: metrics.impressions,
    frequency: metrics.frequency,
    thumbnailUrls,
    adsManagerUrl: level === 'ad' ? buildAdsManagerUrl(adAccountId, id) : undefined,
  };
}

async function getProjectMetaAdsRankings(projectId, fallbackTenantId, options = {}) {
  const project = await runAsSystem(
    async () => (await getProjectById(projectId)) || (await findProjectById(projectId)),
  );
  if (!project) {
    throw new Error('Project not found.');
  }

  const tenantId = getProjectTenantId(project, fallbackTenantId);
  const metaAds = withImplicitProjectTokenSecret(
    project.projectId || projectId,
    project.metaAds ?? {},
  );
  const adAccountId = normalizeAdAccountId(metaAds.adAccountId);
  if (!adAccountId) {
    throw new Error('Project Meta Ads account is not configured.');
  }

  const level = normalizeRankingLevel(options.level);
  const period = resolveStatusPeriod(options);
  if (!period.since || !period.until) {
    throw new Error('Meta Ads ranking period is required.');
  }

  const graphVersion = getMetaGraphVersion(metaAds.graphVersion);
  const targetResultType = metaAds.rules?.targetResultType;
  const cacheKey = getRankingCacheKey({
    projectId,
    tenantId,
    adAccountId,
    graphVersion,
    period,
    accountProfile: metaAds.accountProfile,
    targetResultType,
    level,
    objective: options.objective,
    resultType: options.resultType,
  });
  const cached = getCachedStatusPeriod(cacheKey, period);
  if (cached) {
    return cached;
  }

  const token = await getAccessToken(tenantId, metaAds);
  const resolvedTargetResultType = resolveTargetResultType({
    targetResultType,
    accountProfile: metaAds.accountProfile,
  });
  const [campaigns, adsets] = await Promise.all([
    listCampaigns({ adAccountId, token, graphVersion, includeInactive: true }).catch((error) => {
      logger.error('[MetaAdsBudget] ranking campaigns fetch failed', {
        projectId,
        message: error.message,
      });
      return [];
    }),
    level === 'campaign'
      ? Promise.resolve([])
      : listAdSets({ adAccountId, token, graphVersion, includeInactive: true }).catch((error) => {
          logger.error('[MetaAdsBudget] ranking adsets fetch failed', {
            projectId,
            message: error.message,
          });
          return [];
        }),
  ]);
  const campaignById = new Map(campaigns.map((campaign) => [campaign.id, campaign]));
  const adsetById = new Map(adsets.map((adset) => [adset.id, adset]));

  let insights = [];
  let adsById = new Map();
  let adSummaryById = new Map();
  if (level === 'campaign') {
    insights = await listCampaignInsights({
      adAccountId,
      token,
      since: period.since,
      until: period.until,
      datePreset: period.datePreset,
      graphVersion,
    });
  } else if (level === 'adset') {
    insights = await listAdSetInsights({
      adAccountId,
      token,
      since: period.since,
      until: period.until,
      datePreset: period.datePreset,
      graphVersion,
    });
  } else {
    insights = await listAdInsights({
      adAccountId,
      token,
      since: period.since,
      until: period.until,
      datePreset: period.datePreset,
      graphVersion,
    });
    const adIds = [...new Set(insights.map((row) => row.ad_id).filter(Boolean))];
    const ads = adIds.length
      ? await listAds({
          adAccountId,
          adIds,
          token,
          graphVersion,
          includeInactive: true,
        }).catch((error) => {
          logger.error('[MetaAdsBudget] ranking ads fetch failed', {
            projectId,
            message: error.message,
          });
          return [];
        })
      : [];
    adsById = new Map(ads.map((ad) => [ad.id, ad]));
    adSummaryById = new Map(
      buildAdSummaries({
        ads,
        adInsights: insights,
        currency: 'BRL',
        accountProfile: metaAds.accountProfile,
        targetResultType,
        adAccountId,
      }).map((ad) => [ad.adId, ad]),
    );
  }

  const items = insights
    .map((insight) => {
      const campaign = campaignById.get(insight.campaign_id);
      const adset = adsetById.get(insight.adset_id);
      const ad = adsById.get(insight.ad_id);
      const metrics = calculateMetrics(
        insight,
        resolveTargetResultType({
          targetResultType,
          accountProfile: metaAds.accountProfile,
          campaignObjective: campaign?.objective,
        }) || resolvedTargetResultType,
      );
      const meta =
        level === 'campaign'
          ? { name: campaign?.name, objective: campaign?.objective }
          : level === 'adset'
            ? {
                name: adset?.name,
                campaignId: insight.campaign_id || adset?.campaign_id,
                campaignName: insight.campaign_name || adset?.campaign?.name,
                objective: campaign?.objective,
              }
            : {
                name: ad?.name,
                campaignId: insight.campaign_id || ad?.campaign_id,
                campaignName: insight.campaign_name || campaign?.name,
                objective: campaign?.objective,
              };
      const adSummary = level === 'ad' ? adSummaryById.get(insight.ad_id) : undefined;
      return toRankingItem({
        level,
        insight,
        metrics,
        meta,
        adAccountId,
        thumbnailUrls:
          level === 'ad'
            ? [adSummary?.thumbnailUrl, adSummary?.imageUrl].filter(
                (url) => typeof url === 'string' && url.trim(),
              )
            : [],
      });
    })
    .filter(
      (item) =>
        item.id &&
        Number(item.resultCount ?? 0) > 0 &&
        matchesRankingFilter(item.objective, options.objective) &&
        matchesRankingFilter(item.resultType, options.resultType),
    );

  const response = {
    level,
    period,
    currency: 'BRL',
    items,
  };
  setCachedStatusPeriod(cacheKey, response);
  return response;
}

function proposeBudget({
  currentDailyBudget,
  cpa,
  roas,
  spend,
  frequency,
  resultCount,
  resultType,
  ctr,
  cpc,
  cpm,
  rules,
  creativeRules,
  evidenceSpend,
  latestActionAt,
}) {
  if (!currentDailyBudget || spend < rules.minSpend) {
    return {
      action: 'hold',
      proposedDailyBudget: currentDailyBudget,
      reason: `Dados insuficientes: gasto ${spend.toFixed(2)} abaixo do mínimo ${rules.minSpend}.`,
    };
  }

  if (rules.enabledSections?.performance === false) {
    return {
      action: 'hold',
      proposedDailyBudget: currentDailyBudget,
      reason: 'Regras de performance desativadas para este escopo.',
    };
  }

  const primaryMetric = PRIMARY_METRICS.has(rules.primaryMetric) ? rules.primaryMetric : 'cpa';
  const targetResultType =
    typeof rules.targetResultType === 'string' && rules.targetResultType.trim()
      ? rules.targetResultType.trim()
      : '';
  const missingTargetResult =
    targetResultType && resultType === targetResultType && Number(resultCount ?? 0) <= 0;
  const missingResultEvidence = missingTargetResult
    ? getMissingResultEvidence({
        spend: evidenceSpend ?? spend,
        resultCount,
        rules,
        latestActionAt,
      })
    : null;
  if (missingResultEvidence && !missingResultEvidence.canAct) {
    return {
      action: 'hold',
      proposedDailyBudget: currentDailyBudget,
      status: 'blocked',
      reason: `Aguardando conversões para ${targetResultType}. Gasto desde a análise ${missingResultEvidence.evidenceSpend.toFixed(
        2,
      )} abaixo do limite ${missingResultEvidence.evidenceSpendThreshold?.toFixed(2) ?? '-'}.`,
      ...missingResultEvidence,
    };
  }
  const cpaGood = cpa != null && cpa <= rules.targetCpa;
  const roasGood = roas != null && roas >= rules.minRoas;
  const cpcGood = rules.maxCpc != null && cpc != null && cpc <= rules.maxCpc;
  const ctrGood = rules.minCtr != null && ctr != null && ctr >= rules.minCtr;
  const cpaBad = cpa != null && cpa > rules.targetCpa;
  const roasBad = roas != null && roas < rules.minRoas;
  const cpcBad = rules.maxCpc != null && cpc != null && cpc > rules.maxCpc;
  const ctrBad = rules.minCtr != null && ctr != null && ctr < rules.minCtr;
  const cpmBad = rules.maxCpm != null && cpm != null && cpm > rules.maxCpm;
  const maxFrequency = Number(creativeRules?.maxFrequency);
  const hasHighFrequency =
    Number.isFinite(maxFrequency) &&
    maxFrequency > 0 &&
    frequency != null &&
    Number.isFinite(Number(frequency)) &&
    Number(frequency) > maxFrequency;
  const guardrailReasons = [];
  if (hasHighFrequency) {
    guardrailReasons.push(
      `Frequência ${Number(frequency).toFixed(2)} acima do limite ${maxFrequency.toFixed(2)}`,
    );
  }
  if (cpcBad) {
    guardrailReasons.push(`CPC ${Number(cpc).toFixed(2)} acima do máximo ${rules.maxCpc}.`);
  }
  if (ctrBad) {
    guardrailReasons.push(`CTR ${Number(ctr).toFixed(2)} abaixo do mínimo ${rules.minCtr}.`);
  }
  if (cpmBad) {
    guardrailReasons.push(`CPM ${Number(cpm).toFixed(2)} acima do máximo ${rules.maxCpm}.`);
  }
  const hasBadGuardrail = guardrailReasons.length > 0;
  const hasGoodGuardrails = !hasBadGuardrail;

  let primaryGood = false;
  let primaryBad = false;
  let primaryLabel = 'CPA';
  if (primaryMetric === 'roas') {
    primaryGood = roasGood;
    primaryBad = roasBad;
    primaryLabel = 'ROAS';
  } else if (primaryMetric === 'cpc') {
    primaryGood = cpcGood;
    primaryBad = cpcBad;
    primaryLabel = 'CPC';
  } else if (primaryMetric === 'ctr') {
    primaryGood = ctrGood;
    primaryBad = ctrBad;
    primaryLabel = 'CTR';
  } else {
    primaryGood = cpaGood;
    primaryBad = cpaBad || Boolean(missingTargetResult);
  }

  if (primaryGood && hasBadGuardrail && !missingTargetResult) {
    return {
      action: 'hold',
      proposedDailyBudget: currentDailyBudget,
      reason: `${guardrailReasons.join(' ')} Revisar antes de aumentar orçamento.`,
    };
  }

  if (primaryGood && hasGoodGuardrails && !missingTargetResult) {
    const proposed = Math.min(
      rules.maxDailyBudget,
      currentDailyBudget * (1 + rules.maxIncreasePct / 100),
    );
    return {
      action: proposed > currentDailyBudget ? 'increase' : 'hold',
      proposedDailyBudget: Number(proposed.toFixed(2)),
      reason: `${primaryLabel} dentro da regra${
        targetResultType ? ` para ${targetResultType}` : ''
      }.`,
    };
  }

  if (primaryBad || hasBadGuardrail || missingTargetResult) {
    const noResultCap = rules.noResultSpendCap ?? DEFAULT_RULES.noResultSpendCap;
    const noResultCapEnabled =
      missingTargetResult &&
      noResultCap.enabled === true &&
      spend >= Number(noResultCap.minSpend ?? 0);
    const proposed = noResultCapEnabled
      ? Math.min(
          rules.maxDailyBudget,
          Math.max(rules.minDailyBudget, Number(Number(spend).toFixed(2))),
        )
      : Math.max(rules.minDailyBudget, currentDailyBudget * (1 - rules.maxDecreasePct / 100));
    return {
      action: proposed < currentDailyBudget ? 'decrease' : 'hold',
      proposedDailyBudget: Number(proposed.toFixed(2)),
      reason: missingTargetResult
        ? noResultCapEnabled
          ? `Resultado alvo ${targetResultType} sem conversões; orçamento ajustado para o gasto analisado.`
          : `Resultado alvo ${targetResultType} sem conversões após gasto suficiente.`
        : `Performance abaixo da regra: CPA ${cpa?.toFixed(2) ?? '-'} / ROAS ${
            roas?.toFixed(2) ?? '-'
          } / CPC ${cpc?.toFixed(2) ?? '-'} / CTR ${ctr?.toFixed(2) ?? '-'}. ${
            guardrailReasons.join(' ') || ''
          }`.trim(),
      ...(missingResultEvidence ?? {}),
    };
  }

  return {
    action: 'hold',
    proposedDailyBudget: currentDailyBudget,
    reason: 'Sem sinal suficiente para ajustar orçamento.',
  };
}

function normalizeSecretName(value) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function getProjectTenantId(project = {}, fallbackTenantId) {
  return project.tenantId || fallbackTenantId || getTenantId();
}

async function resolveMetaAccessToken({ tenantId, metaAds = {}, getSecret = getTenantSecret }) {
  const projectSecretName = normalizeSecretName(metaAds.tokenSecretName);
  if (projectSecretName) {
    const projectSecret = await getSecret(tenantId, projectSecretName);
    if (projectSecret?.value) {
      return {
        accessToken: projectSecret.value,
        secretName: projectSecretName,
        source: 'project',
      };
    }
  }

  const tenantSecret = await getSecret(tenantId, META_TOKEN_SECRET_NAME);
  if (!tenantSecret?.value) {
    throw new Error(
      projectSecretName
        ? 'Meta access token not configured for project or tenant.'
        : 'Meta access token not configured for tenant.',
    );
  }

  return {
    accessToken: tenantSecret.value,
    secretName: META_TOKEN_SECRET_NAME,
    source: 'tenant',
  };
}

async function resolveMetaCredentialStatus({
  tenantId,
  metaAds = {},
  getSecret = getTenantSecret,
}) {
  const projectSecretName = normalizeSecretName(metaAds.tokenSecretName);
  logger.debug('[MetaAdsBudget] resolving credential status', {
    tenantId,
    projectSecretName,
    tenantSecretName: META_TOKEN_SECRET_NAME,
  });
  const [projectSecret, tenantSecret] = await Promise.all([
    projectSecretName ? getSecret(tenantId, projectSecretName) : Promise.resolve(null),
    getSecret(tenantId, META_TOKEN_SECRET_NAME),
  ]);
  const projectConfigured = !!projectSecret?.value;
  const tenantConfigured = !!tenantSecret?.value;
  const effectiveSource = projectConfigured ? 'project' : tenantConfigured ? 'tenant' : 'missing';
  return {
    effectiveSource,
    projectConfigured,
    tenantConfigured,
    secretName:
      effectiveSource === 'project'
        ? projectSecretName
        : effectiveSource === 'tenant'
          ? META_TOKEN_SECRET_NAME
          : (projectSecretName ?? META_TOKEN_SECRET_NAME),
  };
}

async function getAccessToken(tenantId, metaAds = {}) {
  const credentials = await resolveMetaAccessToken({ tenantId, metaAds });
  return credentials.accessToken;
}

async function getRecentChange({ projectId, entityId, cooldownMinutes }) {
  const { MetaAdsBudgetChange } = getModels();
  const since = new Date(Date.now() - cooldownMinutes * 60 * 1000);
  return MetaAdsBudgetChange.findOne({ projectId, entityId, createdAt: { $gte: since } }).lean();
}

async function getRecentAutomationAction({ projectId, entityId, actionType, cooldownMinutes }) {
  const { MetaAdsAutomationAction } = getModels();
  const since = new Date(Date.now() - cooldownMinutes * 60 * 1000);
  return MetaAdsAutomationAction.findOne({
    projectId,
    entityId,
    actionType,
    createdAt: { $gte: since },
  }).lean();
}

async function applyRecommendation({ recommendationId, projectId, tenantId, actor, actorUserId }) {
  const { MetaAdsRecommendation, MetaAdsBudgetChange, MetaAdsAutomationAction } = getModels();
  const recommendation = await MetaAdsRecommendation.findById(recommendationId).lean();
  if (!recommendation) {
    throw new Error('Recommendation not found.');
  }
  if (projectId && recommendation.projectId !== projectId) {
    throw new Error('Recommendation does not belong to this project.');
  }
  if (tenantId && recommendation.tenantId !== tenantId) {
    throw new Error('Recommendation does not belong to this tenant.');
  }
  if (recommendation.status !== 'pending') {
    return recommendation;
  }
  if (recommendation.action === 'hold') {
    return MetaAdsRecommendation.findByIdAndUpdate(
      recommendationId,
      { status: 'ignored' },
      { new: true, lean: true },
    );
  }

  const project = await runAsSystem(
    async () =>
      (await getProjectById(recommendation.projectId)) ||
      (await findProjectById(recommendation.projectId)),
  );
  const metaAds = withImplicitProjectTokenSecret(recommendation.projectId, project?.metaAds ?? {});
  const token = await getAccessToken(recommendation.tenantId, metaAds);
  const graphVersion = getMetaGraphVersion(metaAds.graphVersion);
  if (recommendation.action === 'pause') {
    await updateMetaEntityStatus({
      entityId: recommendation.entityId,
      entityLevel: recommendation.entityLevel || 'ad',
      status: recommendation.proposedStatus || 'PAUSED',
      token,
      graphVersion,
    });
    await MetaAdsAutomationAction.create({
      tenantId: recommendation.tenantId,
      projectId: recommendation.projectId,
      adAccountId: recommendation.adAccountId,
      recommendationId: String(recommendation._id),
      actionType: 'pause_ad',
      entityLevel: recommendation.entityLevel || 'ad',
      entityId: recommendation.entityId,
      entityName: recommendation.entityName,
      campaignId: recommendation.campaignId,
      campaignName: recommendation.campaignName,
      adsetId: recommendation.adsetId,
      adsetName: recommendation.adsetName,
      previousStatus: recommendation.currentStatus || 'ACTIVE',
      newStatus: recommendation.proposedStatus || 'PAUSED',
      spend: recommendation.spend,
      resultCount: recommendation.resultCount,
      cpa: recommendation.cpa,
      roas: recommendation.roas,
      ctr: recommendation.ctr,
      cpc: recommendation.cpc,
      frequency: recommendation.frequency,
      primaryMetric: recommendation.primaryMetric,
      targetMetricValue: recommendation.targetMetricValue,
      ruleSourceType: recommendation.ruleSourceType || 'creative',
      ruleId: recommendation.ruleId,
      ruleName: recommendation.ruleName,
      ruleScope: recommendation.ruleScope,
      actor,
      actorUserId,
      reason: recommendation.reason,
    });
    return MetaAdsRecommendation.findByIdAndUpdate(
      recommendationId,
      { status: 'applied' },
      { new: true, lean: true },
    );
  }
  const currentBudget = await getEntityDailyBudget({
    entityId: recommendation.entityId,
    token,
    graphVersion,
  });
  const currentDailyBudget = currentBudget?.dailyBudget;
  if (
    currentDailyBudget != null &&
    Math.abs(currentDailyBudget - recommendation.currentDailyBudget) > 0.005
  ) {
    return MetaAdsRecommendation.findByIdAndUpdate(
      recommendationId,
      {
        action: 'hold',
        status: 'blocked',
        reason: 'Meta budget changed since recommendation.',
      },
      { new: true, lean: true },
    );
  }
  let appliedDailyBudget = recommendation.proposedDailyBudget;
  let finalReason = recommendation.reason;
  try {
    await metaPost({
      path: encodeURIComponent(recommendation.entityId),
      token,
      graphVersion,
      resourceLabel: 'budget update',
      body: {
        daily_budget: dailyBudgetToCents(appliedDailyBudget),
      },
    });
  } catch (error) {
    const metaMinimumBudget = getMetaMinimumBudget(error);
    if (metaMinimumBudget == null || metaMinimumBudget <= appliedDailyBudget) {
      throw error;
    }
    if (currentDailyBudget != null && metaMinimumBudget >= currentDailyBudget) {
      return MetaAdsRecommendation.findByIdAndUpdate(
        recommendationId,
        {
          action: 'hold',
          status: 'blocked',
          reason: `Meta exigiu orçamento mínimo de ${formatCurrencyPtBr(metaMinimumBudget)}, maior ou igual ao orçamento atual; nenhuma redução aplicada.`,
        },
        { new: true, lean: true },
      );
    }
    appliedDailyBudget = metaMinimumBudget;
    finalReason = `Meta exigiu orçamento mínimo de ${formatCurrencyPtBr(metaMinimumBudget)}; aplicado esse mínimo em vez de ${formatCurrencyPtBr(recommendation.proposedDailyBudget)}.`;
    await metaPost({
      path: encodeURIComponent(recommendation.entityId),
      token,
      graphVersion,
      resourceLabel: 'budget update',
      body: {
        daily_budget: dailyBudgetToCents(appliedDailyBudget),
      },
    });
  }
  const { deltaDailyBudget, deltaPercent } = calculateBudgetDelta(
    recommendation.currentDailyBudget,
    appliedDailyBudget,
  );
  await MetaAdsBudgetChange.create({
    tenantId: recommendation.tenantId,
    projectId: recommendation.projectId,
    adAccountId: recommendation.adAccountId,
    recommendationId: String(recommendation._id),
    entityLevel: recommendation.entityLevel,
    entityId: recommendation.entityId,
    entityName: recommendation.entityName,
    previousDailyBudget: recommendation.currentDailyBudget,
    newDailyBudget: appliedDailyBudget,
    deltaDailyBudget,
    deltaPercent,
    actor,
    actorUserId,
    reason: finalReason,
  });
  await MetaAdsAutomationAction.create({
    tenantId: recommendation.tenantId,
    projectId: recommendation.projectId,
    adAccountId: recommendation.adAccountId,
    recommendationId: String(recommendation._id),
    actionType: 'budget_change',
    entityLevel: recommendation.entityLevel,
    entityId: recommendation.entityId,
    entityName: recommendation.entityName,
    campaignId: recommendation.campaignId,
    campaignName: recommendation.campaignName,
    previousDailyBudget: recommendation.currentDailyBudget,
    newDailyBudget: appliedDailyBudget,
    deltaDailyBudget,
    deltaPercent,
    spend: recommendation.spend,
    resultCount: recommendation.resultCount,
    cpa: recommendation.cpa,
    roas: recommendation.roas,
    ctr: recommendation.ctr,
    cpc: recommendation.cpc,
    frequency: recommendation.frequency,
    primaryMetric: recommendation.primaryMetric,
    targetMetricValue: recommendation.targetMetricValue,
    ruleSourceType: recommendation.ruleSourceType || 'unknown',
    ruleId: recommendation.ruleId,
    ruleName: recommendation.ruleName,
    ruleScope: recommendation.ruleScope,
    actor,
    actorUserId,
    reason: finalReason,
  });
  return MetaAdsRecommendation.findByIdAndUpdate(
    recommendationId,
    { status: 'applied', proposedDailyBudget: appliedDailyBudget, reason: finalReason },
    { new: true, lean: true },
  );
}

function getAutomationRunId(run) {
  return run?._id ? String(run._id) : undefined;
}

function summarizeAutomationRun(recommendations = [], appliedCount = 0) {
  const recommendationCount = recommendations.length;
  const holdCount = recommendations.filter((item) => item.action === 'hold').length;
  const blockedCount = recommendations.filter((item) => item.status === 'blocked').length;
  const recommendedCount = recommendations.filter(
    (item) => item.status === 'pending' && item.action !== 'hold',
  ).length;
  const reasonSamples = [
    ...new Set(
      recommendations
        .map((item) => (typeof item.reason === 'string' ? item.reason.trim() : ''))
        .filter(Boolean),
    ),
  ].slice(0, 3);
  let outcome = 'no_data';
  if (appliedCount > 0) {
    outcome = 'applied';
  } else if (recommendedCount > 0) {
    outcome = 'recommended';
  } else if (blockedCount > 0) {
    outcome = 'blocked';
  } else if (holdCount > 0) {
    outcome = 'held';
  }
  return {
    outcome,
    evaluatedCount: recommendationCount,
    recommendationCount,
    holdCount,
    blockedCount,
    appliedCount,
    reasonSamples,
  };
}

async function finishAutomationRun({
  MetaAdsAutomationRun,
  runId,
  startedAt,
  recommendations,
  appliedCount,
}) {
  if (!runId) {
    return undefined;
  }
  const finishedAt = new Date();
  return MetaAdsAutomationRun.findByIdAndUpdate(
    runId,
    {
      $set: {
        status: 'completed',
        finishedAt,
        durationMs: finishedAt.getTime() - startedAt.getTime(),
        ...summarizeAutomationRun(recommendations, appliedCount),
      },
    },
    { new: true, lean: true },
  );
}

async function failAutomationRun({ MetaAdsAutomationRun, runId, startedAt, error }) {
  if (!runId) {
    return undefined;
  }
  const finishedAt = new Date();
  return MetaAdsAutomationRun.findByIdAndUpdate(
    runId,
    {
      $set: {
        status: 'failed',
        outcome: 'failed',
        finishedAt,
        durationMs: finishedAt.getTime() - startedAt.getTime(),
        errorMessage: error.message,
      },
    },
    { new: true, lean: true },
  );
}

async function analyzeProject({ projectId, actor = 'cron', applyAuto = true }) {
  const project = await runAsSystem(
    async () => (await getProjectById(projectId)) || (await findProjectById(projectId)),
  );
  if (!project) {
    throw new Error('Project not found.');
  }
  const metaAds = withImplicitProjectTokenSecret(
    project.projectId || projectId,
    project.metaAds ?? {},
  );
  const adAccountId = normalizeAdAccountId(metaAds.adAccountId);
  if (!adAccountId) {
    throw new Error('Project Meta Ads account is not configured.');
  }
  const projectRules = mergeRules(metaAds);
  const creativeRules = validateMetaAdsCreativeRules(metaAds.creativeRules);
  const tenantId = getProjectTenantId(project);
  const now = new Date();
  const timeZone = getMetaAdsTimeZone();
  const analysisPeriod = resolveAutomationAnalysisPeriod(metaAds, now);
  const { since, until } = analysisPeriod;
  const { MetaAdsSnapshot, MetaAdsRecommendation, MetaAdsAutomationAction, MetaAdsAutomationRun } =
    getModels();
  const graphVersion = getMetaGraphVersion(metaAds.graphVersion);
  const entityConcurrency = getCronEntityConcurrency();
  const scheduleIntervalMinutes = getScheduleIntervalMinutes(metaAds);
  const automationRun = await MetaAdsAutomationRun.create({
    tenantId,
    projectId,
    adAccountId,
    actor,
    mode: metaAds.automationMode || 'recommend',
    status: 'running',
    outcome: 'no_data',
    since,
    until,
    datePreset: analysisPeriod.datePreset,
    startedAt: now,
    evaluatedCount: 0,
    recommendationCount: 0,
    holdCount: 0,
    blockedCount: 0,
    appliedCount: 0,
    reasonSamples: [],
  });
  const automationRunId = getAutomationRunId(automationRun);

  try {
    const token = await getAccessToken(tenantId, metaAds);

    const campaignsPromise = listCampaigns({ adAccountId, token, graphVersion }).catch((error) => {
      logger.error('[MetaAdsBudget] campaigns fetch failed', {
        projectId,
        adAccountId,
        message: error.message,
        stack: error.stack,
      });
      return [];
    });
    const adsetsPromise = listAdSets({ adAccountId, token, graphVersion }).catch((error) => {
      logger.error('[MetaAdsBudget] adsets fetch failed', {
        projectId,
        adAccountId,
        message: error.message,
        stack: error.stack,
      });
      throw error;
    });
    const defaultInsightsPromise = listAdSetInsights({
      adAccountId,
      token,
      since,
      until,
      datePreset: analysisPeriod.datePreset,
      graphVersion,
    }).catch((error) => {
      logger.error('[MetaAdsBudget] insights fetch failed', {
        projectId,
        adAccountId,
        since,
        until,
        message: error.message,
        stack: error.stack,
      });
      throw error;
    });
    const defaultCampaignInsightsPromise = listCampaignInsights({
      adAccountId,
      token,
      since,
      until,
      datePreset: analysisPeriod.datePreset,
      graphVersion,
    }).catch((error) => {
      logger.error('[MetaAdsBudget] campaign insights fetch failed', {
        projectId,
        adAccountId,
        since,
        until,
        message: error.message,
        stack: error.stack,
      });
      return [];
    });
    const defaultAdInsightsPromise = listAdInsights({
      adAccountId,
      token,
      since,
      until,
      datePreset: analysisPeriod.datePreset,
      graphVersion,
    }).catch((error) => {
      logger.error('[MetaAdsBudget] ad insights fetch failed', {
        projectId,
        adAccountId,
        since,
        until,
        message: error.message,
        stack: error.stack,
      });
      return [];
    });
    const adsPromise = listAds({ adAccountId, token, graphVersion }).catch((error) => {
      logger.error('[MetaAdsBudget] ads fetch failed', {
        projectId,
        adAccountId,
        message: error.message,
        stack: error.stack,
      });
      return [];
    });
    const monthlyBudget = resolveMonthlyBudget(metaAds, metaAds.monthlyBudget?.month, now);
    const monthlyRange = getMetaAdsMonthRange(monthlyBudget.month, timeZone, now);
    const monthlyCampaignInsightsPromise = getMonthlyBudgetLimit(monthlyBudget)
      ? listCampaignInsights({
          adAccountId,
          token,
          since: monthlyRange.since,
          until: monthlyRange.until,
          graphVersion,
        }).catch((error) => {
          logger.error('[MetaAdsBudget] monthly insights fetch failed', {
            projectId,
            adAccountId,
            since: monthlyRange.since,
            until: monthlyRange.until,
            message: error.message,
            stack: error.stack,
          });
          return [];
        })
      : Promise.resolve([]);
    const [campaigns, adsets, ads, monthlyCampaignInsights] = await Promise.all([
      campaignsPromise,
      adsetsPromise,
      adsPromise,
      monthlyCampaignInsightsPromise,
    ]);
    const monthlyBudgetState = buildMonthlyBudgetState({
      monthlyBudget,
      insightRows: monthlyCampaignInsights,
      now,
    });
    const campaignById = new Map(campaigns.map((campaign) => [campaign.id, campaign]));
    const adsetById = new Map(adsets.map((adset) => [adset.id, adset]));
    const adsetsByCampaignId = new Map();
    for (const adset of adsets) {
      const campaignId = adset.campaign_id || adset.campaign?.id;
      if (!campaignId) {
        continue;
      }
      adsetsByCampaignId.set(campaignId, [...(adsetsByCampaignId.get(campaignId) ?? []), adset]);
    }

    const defaultAnalysisPreset = analysisPeriod.datePreset;
    const getEntityAnalysisPreset = ({ campaignId, adsetId }) =>
      getEffectiveRuleContext({
        projectRules,
        projectCreativeRules: creativeRules,
        ruleGroups: metaAds.ruleGroups,
        ruleOverrides: metaAds.ruleOverrides,
        campaignId,
        adsetId,
      }).analysisPreset ?? defaultAnalysisPreset;
    const analysisPresets = new Set([defaultAnalysisPreset]);
    for (const adset of adsets) {
      const campaignId = adset.campaign_id || adset.campaign?.id;
      analysisPresets.add(getEntityAnalysisPreset({ campaignId, adsetId: adset.id }));
    }
    const analysisBundles = await Promise.all(
      Array.from(analysisPresets).map(async (analysisPreset) => {
        const period = resolveAutomationAnalysisPeriod(
          { automationAnalysisPreset: analysisPreset },
          now,
        );
        if (analysisPreset === defaultAnalysisPreset) {
          const [periodInsights, periodCampaignInsights, periodAdInsights] = await Promise.all([
            defaultInsightsPromise,
            defaultCampaignInsightsPromise,
            defaultAdInsightsPromise,
          ]);
          return {
            analysisPreset,
            insights: periodInsights,
            campaignInsights: periodCampaignInsights,
            adInsights: periodAdInsights,
          };
        }
        const [periodInsights, periodCampaignInsights, periodAdInsights] = await Promise.all([
          listAdSetInsights({
            adAccountId,
            token,
            since: period.since,
            until: period.until,
            datePreset: period.datePreset,
            graphVersion,
          }).catch((error) => {
            logger.error('[MetaAdsBudget] insights fetch failed', {
              projectId,
              adAccountId,
              since: period.since,
              until: period.until,
              message: error.message,
              stack: error.stack,
            });
            throw error;
          }),
          listCampaignInsights({
            adAccountId,
            token,
            since: period.since,
            until: period.until,
            datePreset: period.datePreset,
            graphVersion,
          }).catch((error) => {
            logger.error('[MetaAdsBudget] campaign insights fetch failed', {
              projectId,
              adAccountId,
              since: period.since,
              until: period.until,
              message: error.message,
              stack: error.stack,
            });
            return [];
          }),
          listAdInsights({
            adAccountId,
            token,
            since: period.since,
            until: period.until,
            datePreset: period.datePreset,
            graphVersion,
          }).catch((error) => {
            logger.error('[MetaAdsBudget] ad insights fetch failed', {
              projectId,
              adAccountId,
              since: period.since,
              until: period.until,
              message: error.message,
              stack: error.stack,
            });
            return [];
          }),
        ]);
        return {
          analysisPreset,
          insights: periodInsights,
          campaignInsights: periodCampaignInsights,
          adInsights: periodAdInsights,
        };
      }),
    );
    const campaignInsightByKey = new Map();
    const insights = [];
    const insightRowsByCampaignId = new Map();
    const adInsightsByAdSetId = new Map();
    for (const bundle of analysisBundles) {
      for (const row of bundle.campaignInsights) {
        if (row.campaign_id) {
          campaignInsightByKey.set(`${bundle.analysisPreset}:${row.campaign_id}`, row);
        }
      }
      for (const row of bundle.insights) {
        const adset = adsetById.get(row.adset_id);
        const campaignId = row.campaign_id || adset?.campaign_id || adset?.campaign?.id;
        if (
          getEntityAnalysisPreset({ campaignId, adsetId: row.adset_id }) !== bundle.analysisPreset
        ) {
          continue;
        }
        insights.push(row);
        if (campaignId) {
          insightRowsByCampaignId.set(campaignId, [
            ...(insightRowsByCampaignId.get(campaignId) ?? []),
            row,
          ]);
        }
      }
      for (const row of bundle.adInsights) {
        const adset = adsetById.get(row.adset_id);
        const campaignId = row.campaign_id || adset?.campaign_id || adset?.campaign?.id;
        if (
          getEntityAnalysisPreset({ campaignId, adsetId: row.adset_id }) !== bundle.analysisPreset
        ) {
          continue;
        }
        adInsightsByAdSetId.set(row.adset_id, [
          ...(adInsightsByAdSetId.get(row.adset_id) ?? []),
          row,
        ]);
      }
    }
    const adsByAdSetId = new Map();
    for (const ad of ads) {
      const adSetId = ad.adset_id;
      if (adSetId) {
        adsByAdSetId.set(adSetId, [...(adsByAdSetId.get(adSetId) ?? []), ad]);
      }
    }
    const handledRecommendationEntities = new Set();

    const recommendations = (
      await mapWithConcurrency(insights, entityConcurrency, async (row) => {
        const entityId = row.adset_id;
        const adset = adsetById.get(entityId);
        if (!adset) {
          return null;
        }
        const campaignId = row.campaign_id || adset.campaign_id || adset.campaign?.id;
        const campaign = campaignById.get(campaignId);
        const campaignName = row.campaign_name || campaign?.name || adset.campaign?.name;
        const budgetInfo = detectBudgetMode({
          campaign,
          adsets: adsetsByCampaignId.get(campaignId) ?? [adset],
        });
        const effectiveRuleContext = getEffectiveRuleContext({
          projectRules,
          projectCreativeRules: creativeRules,
          ruleGroups: metaAds.ruleGroups,
          ruleOverrides: metaAds.ruleOverrides,
          campaignId,
          adsetId: entityId,
        });
        const { rules } = effectiveRuleContext;
        const effectiveAnalysisPreset =
          effectiveRuleContext.analysisPreset ?? defaultAnalysisPreset;
        const adsetName = row.adset_name || adset.name;
        const recommendationEntityLevel =
          budgetInfo.editableBudgetLevel === 'campaign' ? 'campaign' : 'adset';
        const recommendationEntityId =
          recommendationEntityLevel === 'campaign' ? campaignId : entityId;
        const recommendationEntityName =
          recommendationEntityLevel === 'campaign' ? campaignName : adsetName;
        const currentDailyBudget =
          recommendationEntityLevel === 'campaign'
            ? centsToDailyBudget(campaign?.daily_budget)
            : centsToDailyBudget(adset.daily_budget);
        const configuredResultType = canonicalizeMetaOptimizationGoal(adset.optimization_goal);
        const resolvedTargetResultType = resolveTargetResultType({
          rules,
          accountProfile: metaAds.accountProfile,
          campaignObjective: campaign?.objective,
          configuredResultType,
        });
        const metrics = calculateMetrics(row, resolvedTargetResultType);
        const recommendationMetrics =
          recommendationEntityLevel === 'campaign'
            ? calculateMetrics(
                campaignInsightByKey.get(`${effectiveAnalysisPreset}:${campaignId}`) ||
                  aggregateInsightRows(insightRowsByCampaignId.get(campaignId) ?? [row]),
                resolvedTargetResultType,
              )
            : metrics;

        await MetaAdsSnapshot.create({
          tenantId,
          projectId,
          adAccountId,
          level: 'adset',
          entityId,
          entityName: adsetName,
          campaignId,
          campaignName,
          campaignObjective: campaign?.objective,
          configuredResultType: configuredResultType || undefined,
          status: adset.effective_status,
          dailyBudget: currentDailyBudget,
          spend: metrics.spend,
          cpa: metrics.cpa,
          roas: metrics.roas,
          conversionValue: metrics.conversionValue,
          resultCount: metrics.resultCount,
          resultType: metrics.resultType,
          resultTypeBreakdown: metrics.resultTypeBreakdown,
          impressions: metrics.impressions,
          reach: metrics.reach,
          frequency: metrics.frequency,
          clicks: metrics.clicks,
          ctr: metrics.ctr,
          cpc: metrics.cpc,
          cpm: metrics.cpm,
          videoP75Watched: metrics.videoP75Watched,
          videoP75Rate: metrics.videoP75Rate,
          raw: row,
        });

        const recommendationKey = `${recommendationEntityLevel}:${recommendationEntityId}`;
        if (!recommendationEntityId || handledRecommendationEntities.has(recommendationKey)) {
          return null;
        }
        handledRecommendationEntities.add(recommendationKey);
        const primaryMetric = getPrimaryMetric(effectiveRuleContext.rules);
        const targetMetricValue = getRuleTargetMetricValue(effectiveRuleContext.rules);
        const recentAutomationActions = await MetaAdsAutomationAction.find({
          tenantId,
          projectId,
          entityId: recommendationEntityId,
          primaryMetric,
          ruleSourceType: effectiveRuleContext.ruleSourceType,
          ruleId: effectiveRuleContext.ruleId,
        })
          .sort({ createdAt: -1 })
          .limit(1)
          .lean();
        const latestAutomationAction = recentAutomationActions[0] || null;
        const actionSpend = toFiniteMetric(latestAutomationAction?.spend);
        const evidenceSpend =
          actionSpend != null
            ? Math.max(0, Number(recommendationMetrics.spend ?? 0) - actionSpend)
            : undefined;

        const rawProposal = proposeBudget({
          currentDailyBudget,
          ...recommendationMetrics,
          rules,
          creativeRules,
          evidenceSpend,
          latestActionAt: latestAutomationAction?.createdAt,
        });
        const monthlyGuard = applyMonthlyBudgetGuard({
          proposal: rawProposal,
          currentDailyBudget,
          monthlyBudgetState,
        });
        const proposal = monthlyGuard.proposal;
        const recentChange = await getRecentChange({
          projectId,
          entityId: recommendationEntityId,
          cooldownMinutes: resolveActionCooldownMinutes({
            actionType: 'budget_change',
            scheduleIntervalMinutes,
          }),
        });
        const blockedByCooldown = proposal.action !== 'hold' && Boolean(recentChange);

        await MetaAdsRecommendation.updateMany(
          {
            tenantId,
            projectId,
            entityId: recommendationEntityId,
            status: 'pending',
          },
          {
            $set: {
              status: 'ignored',
            },
          },
        );

        const recommendation = await MetaAdsRecommendation.create({
          tenantId,
          projectId,
          adAccountId,
          entityLevel: recommendationEntityLevel,
          entityId: recommendationEntityId,
          entityName: recommendationEntityName,
          campaignId,
          campaignName,
          action: blockedByCooldown ? 'hold' : proposal.action,
          status:
            proposal.status || (blockedByCooldown || monthlyGuard.blocked ? 'blocked' : 'pending'),
          currentDailyBudget,
          proposedDailyBudget: proposal.proposedDailyBudget,
          spend: recommendationMetrics.spend,
          resultCount: recommendationMetrics.resultCount,
          cpa: recommendationMetrics.cpa,
          roas: recommendationMetrics.roas,
          ctr: recommendationMetrics.ctr,
          cpc: recommendationMetrics.cpc,
          frequency: recommendationMetrics.frequency,
          primaryMetric,
          targetMetricValue,
          evidenceSpend: proposal.evidenceSpend,
          evidenceSpendThreshold: proposal.evidenceSpendThreshold,
          evidenceSpendBasis: proposal.evidenceSpendBasis,
          evidenceMultiplier: proposal.evidenceMultiplier,
          canAct: proposal.canAct,
          decisionReason: proposal.decisionReason,
          ruleSourceType: effectiveRuleContext.ruleSourceType,
          ruleId: effectiveRuleContext.ruleId,
          ruleName: effectiveRuleContext.ruleName,
          ruleScope: effectiveRuleContext.ruleScope,
          reason: blockedByCooldown ? 'Bloqueado por trava interna de orçamento.' : proposal.reason,
          mode: metaAds.automationMode || 'recommend',
          automationRunId,
        });
        const creativePauseRecommendations = [];
        const pauseProposals =
          rules.enabledSections?.creatives === false
            ? []
            : buildCreativePauseRecommendations({
                ads: adsByAdSetId.get(entityId) ?? [],
                adInsights: adInsightsByAdSetId.get(entityId) ?? [],
                creativeRules: effectiveRuleContext.creativeRules,
                targetResultType: resolvedTargetResultType,
                ruleContext: {
                  ...effectiveRuleContext,
                  ruleSourceType: 'creative',
                  campaignId,
                  campaignName,
                  adsetId: entityId,
                  adsetName,
                },
              });
        for (const pauseProposal of pauseProposals) {
          const recentPause = await getRecentAutomationAction({
            projectId,
            entityId: pauseProposal.entityId,
            actionType: 'pause_ad',
            cooldownMinutes: resolveActionCooldownMinutes({
              actionType: 'pause_ad',
              scheduleIntervalMinutes,
            }),
          });
          await MetaAdsRecommendation.updateMany(
            {
              tenantId,
              projectId,
              entityId: pauseProposal.entityId,
              action: 'pause',
              status: 'pending',
            },
            {
              $set: {
                status: 'ignored',
              },
            },
          );
          const pauseRecommendation = await MetaAdsRecommendation.create({
            tenantId,
            projectId,
            adAccountId,
            ...pauseProposal,
            status: recentPause ? 'blocked' : 'pending',
            reason: recentPause ? 'Bloqueado por trava interna de criativo.' : pauseProposal.reason,
            mode: metaAds.automationMode || 'recommend',
            automationRunId,
          });
          creativePauseRecommendations.push(pauseRecommendation.toObject());
        }
        return [recommendation.toObject(), ...creativePauseRecommendations];
      })
    )
      .flat()
      .filter(Boolean);

    if (applyAuto && metaAds.automationMode === 'auto_limited') {
      const appliedRecommendations = new Map();
      const autoApplySummary = {
        appliedCount: 0,
        adjustedToMetaMinimumCount: 0,
        blockedCount: 0,
        messages: [],
      };
      for (const recommendation of recommendations) {
        if (recommendation.status !== 'pending' || recommendation.action === 'hold') {
          continue;
        }
        const appliedRecommendation = await applyRecommendation({
          recommendationId: recommendation._id,
          projectId,
          tenantId,
          actor,
        });
        if (appliedRecommendation?._id) {
          appliedRecommendations.set(String(appliedRecommendation._id), appliedRecommendation);
        }
        if (appliedRecommendation?.status === 'applied') {
          autoApplySummary.appliedCount += 1;
        }
        if (appliedRecommendation?.status === 'blocked') {
          autoApplySummary.blockedCount += 1;
        }
        if (typeof appliedRecommendation?.reason === 'string') {
          autoApplySummary.messages.push(appliedRecommendation.reason);
          if (appliedRecommendation.reason.includes('Meta exigiu orçamento mínimo')) {
            autoApplySummary.adjustedToMetaMinimumCount +=
              appliedRecommendation.status === 'applied' ? 1 : 0;
          }
        }
      }
      const resolvedRecommendations = recommendations.map(
        (recommendation) =>
          appliedRecommendations.get(String(recommendation._id)) ?? recommendation,
      );
      const run = await finishAutomationRun({
        MetaAdsAutomationRun,
        runId: automationRunId,
        startedAt: now,
        recommendations: resolvedRecommendations,
        appliedCount: autoApplySummary.appliedCount,
      });
      return {
        projectId,
        adAccountId,
        graphVersion,
        since,
        until,
        recommendations: resolvedRecommendations,
        run,
        autoApplySummary,
        messages: autoApplySummary.messages,
      };
    }

    const run = await finishAutomationRun({
      MetaAdsAutomationRun,
      runId: automationRunId,
      startedAt: now,
      recommendations,
      appliedCount: 0,
    });
    return {
      projectId,
      adAccountId,
      graphVersion,
      since,
      until,
      recommendations,
      run,
    };
  } catch (error) {
    await failAutomationRun({
      MetaAdsAutomationRun,
      runId: automationRunId,
      startedAt: now,
      error,
    });
    throw error;
  }
}

async function getProjectMetaAdsStatus(projectId, fallbackTenantId, options = {}) {
  const { MetaAdsSnapshot, MetaAdsRecommendation, MetaAdsBudgetChange } = getModels();
  const project = await runAsSystem(
    async () => (await getProjectById(projectId)) || (await findProjectById(projectId)),
  );
  const tenantId = project ? getProjectTenantId(project, fallbackTenantId) : fallbackTenantId;
  const query = tenantId ? { projectId, tenantId } : { projectId };
  const [latestSnapshots, historicalSnapshots, recommendations, changes] = await Promise.all([
    MetaAdsSnapshot.find(query).sort({ createdAt: -1 }).limit(50).lean(),
    MetaAdsSnapshot.find(query).sort({ createdAt: -1 }).limit(250).lean(),
    MetaAdsRecommendation.find(query).sort({ createdAt: -1 }).limit(50).lean(),
    MetaAdsBudgetChange.find(query).sort({ createdAt: -1 }).limit(100).lean(),
  ]);
  const credentials = project
    ? await resolveMetaCredentialStatus({
        tenantId: getProjectTenantId(project, fallbackTenantId),
        metaAds: withImplicitProjectTokenSecret(
          project.projectId || projectId,
          project.metaAds ?? {},
        ),
      })
    : undefined;
  const configuredGraphVersion = isSupportedMetaGraphVersion(project?.metaAds?.graphVersion)
    ? project.metaAds.graphVersion
    : undefined;
  const graphVersion = project
    ? {
        effective: getMetaGraphVersion(configuredGraphVersion),
        configured: configuredGraphVersion,
        source: configuredGraphVersion ? 'project' : 'global',
      }
    : undefined;
  let campaignConfigs = [];
  let adsetConfigs = [];
  let adSummaries = [];
  let adDiagnostics;
  let campaignInsights = [];
  let adDailyInsights = [];
  let liveSnapshots;
  let currency;
  let monthlyBudgetStatus;
  let goalProgress;
  const snapshotOnly = options.scope === 'snapshot';
  if (project?.metaAds?.adAccountId && !snapshotOnly) {
    try {
      const metaAds = withImplicitProjectTokenSecret(
        project.projectId || projectId,
        project.metaAds ?? {},
      );
      const token = await getAccessToken(tenantId, metaAds);
      const adAccountId = normalizeAdAccountId(metaAds.adAccountId);
      const effectiveGraphVersion = getMetaGraphVersion(metaAds.graphVersion);
      const hasPeriod = Boolean(options.datePreset || options.since || options.until);
      const periodRange = hasPeriod ? resolveStatusPeriod(options) : undefined;
      const targetResultType = metaAds.rules?.targetResultType;
      const accountProfile = metaAds.accountProfile;
      const cacheKey = hasPeriod
        ? getStatusPeriodCacheKey({
            projectId,
            tenantId,
            adAccountId,
            graphVersion: effectiveGraphVersion,
            period: periodRange,
            accountProfile,
            targetResultType,
          })
        : '';
      const cachedPeriod = cacheKey ? getCachedStatusPeriod(cacheKey, periodRange) : null;
      const applyCachedPeriod = (cached) => {
        campaignConfigs = cached.campaignConfigs;
        adsetConfigs = cached.adsetConfigs;
        adSummaries = cached.adSummaries;
        adDiagnostics = cached.adDiagnostics;
        campaignInsights = cached.campaignInsights;
        adDailyInsights = cached.adDailyInsights ?? [];
        liveSnapshots = cached.liveSnapshots;
        currency = cached.currency;
      };

      if (cachedPeriod) {
        applyCachedPeriod(cachedPeriod);
      } else {
        campaignConfigs = await listCampaigns({
          adAccountId,
          token,
          graphVersion: effectiveGraphVersion,
          includeInactive: hasPeriod,
        }).catch((error) => {
          logger.error('[MetaAdsBudget] campaign status enrichment failed', {
            projectId,
            message: error.message,
          });
          return [];
        });
        currency = await getAdAccountCurrency({
          adAccountId,
          token,
          graphVersion: effectiveGraphVersion,
        }).catch((error) => {
          logger.error('[MetaAdsBudget] currency status enrichment failed', {
            projectId,
            message: error.message,
          });
          return undefined;
        });
        if (periodRange?.since || periodRange?.until) {
          const { since, until } = periodRange;
          adsetConfigs = await listAdSets({
            adAccountId,
            token,
            graphVersion: effectiveGraphVersion,
            includeInactive: true,
          }).catch((error) => {
            logger.error('[MetaAdsBudget] adsets status enrichment failed', {
              projectId,
              message: error.message,
            });
            return [];
          });
          try {
            const [liveCampaignInsights, insights, liveAdInsights, liveAdDailyInsights] =
              await Promise.all([
                listCampaignInsights({
                  adAccountId,
                  token,
                  since,
                  until,
                  datePreset: periodRange.datePreset,
                  graphVersion: effectiveGraphVersion,
                }).catch((error) => {
                  logger.error('[MetaAdsBudget] campaign insights status enrichment failed', {
                    projectId,
                    message: error.message,
                  });
                  return [];
                }),
                listAdSetInsights({
                  adAccountId,
                  token,
                  since,
                  until,
                  datePreset: periodRange.datePreset,
                  graphVersion: effectiveGraphVersion,
                }),
                listAdInsights({
                  adAccountId,
                  token,
                  since,
                  until,
                  datePreset: periodRange.datePreset,
                  graphVersion: effectiveGraphVersion,
                }).catch((error) => {
                  logger.error('[MetaAdsBudget] ad insights status enrichment failed', {
                    projectId,
                    message: error.message,
                  });
                  return [];
                }),
                listAdInsights({
                  adAccountId,
                  token,
                  since,
                  until,
                  datePreset: periodRange.datePreset,
                  graphVersion: effectiveGraphVersion,
                  timeIncrement: 1,
                }).catch((error) => {
                  logger.error('[MetaAdsBudget] daily ad insights status enrichment failed', {
                    projectId,
                    message: error.message,
                  });
                  return [];
                }),
              ]);
            const insightAdIds = [
              ...new Set(liveAdInsights.map((row) => row.ad_id).filter(Boolean)),
            ];
            const liveAds = insightAdIds.length
              ? await listAds({
                  adAccountId,
                  adIds: insightAdIds,
                  token,
                  graphVersion: effectiveGraphVersion,
                  includeInactive: true,
                }).catch((error) => {
                  logger.error('[MetaAdsBudget] ads status enrichment failed', {
                    projectId,
                    message: error.message,
                  });
                  return [];
                })
              : [];
            campaignInsights = liveCampaignInsights;
            adDailyInsights = liveAdDailyInsights;
            liveSnapshots = buildSnapshotsFromInsights({
              insights,
              adsets: adsetConfigs,
              campaigns: campaignConfigs,
              currency,
              accountProfile,
              targetResultType,
            });
            adSummaries = buildAdSummaries({
              ads: liveAds,
              adInsights: liveAdInsights,
              currency,
              accountProfile,
              targetResultType,
              adAccountId,
            });
            adDiagnostics = buildAdDiagnostics({
              ads: liveAds,
              adInsights: liveAdInsights,
              adSummaries,
            });
            setCachedStatusPeriod(cacheKey, {
              campaignConfigs,
              adsetConfigs,
              adSummaries,
              adDiagnostics,
              campaignInsights,
              adDailyInsights,
              liveSnapshots,
              currency,
            });
          } catch (error) {
            const stalePeriod = cacheKey
              ? getCachedStatusPeriod(cacheKey, periodRange, { allowStale: true })
              : null;
            if (!stalePeriod) {
              throw error;
            }
            logger.error('[MetaAdsBudget] using stale cached Meta Ads period status', {
              projectId,
              message: error.message,
            });
            applyCachedPeriod(stalePeriod);
          }
        }
      }
      const monthlyBudget = resolveMonthlyBudget(metaAds, metaAds.monthlyBudget?.month);
      const hasMonthlyBudgetLimit = getMonthlyBudgetLimit(monthlyBudget) != null;
      const hasClientGoal =
        Number(metaAds.clientGoal?.monthlyTarget ?? 0) > 0 ||
        Number(metaAds.clientGoal?.monthlyConversionValueTarget ?? 0) > 0 ||
        Number(metaAds.clientGoal?.targetRoas ?? 0) > 0;
      if (hasMonthlyBudgetLimit || hasClientGoal) {
        const monthlyRange = getMetaAdsMonthRange(monthlyBudget.month, getMetaAdsTimeZone());
        const today = getMetaAdsDateKey(new Date(), getMetaAdsTimeZone());
        const [monthlyCampaignInsights, todayCampaignInsights] = await Promise.all([
          listCampaignInsights({
            adAccountId,
            token,
            since: monthlyRange.since,
            until: monthlyRange.until,
            graphVersion: effectiveGraphVersion,
          }).catch((error) => {
            logger.error('[MetaAdsBudget] monthly insights status enrichment failed', {
              projectId,
              since: monthlyRange.since,
              until: monthlyRange.until,
              message: error.message,
            });
            return [];
          }),
          listCampaignInsights({
            adAccountId,
            token,
            since: today,
            until: today,
            graphVersion: effectiveGraphVersion,
          }).catch((error) => {
            logger.error('[MetaAdsBudget] daily goal insights status enrichment failed', {
              projectId,
              since: today,
              until: today,
              message: error.message,
            });
            return [];
          }),
        ]);
        monthlyBudgetStatus = buildMonthlyBudgetStatus({
          monthlyBudget,
          insightRows: monthlyCampaignInsights,
        });
        goalProgress = buildGoalProgress({
          monthlyBudget,
          clientGoal: metaAds.clientGoal,
          accountProfile,
          monthlyRows: monthlyCampaignInsights,
          todayRows: todayCampaignInsights,
        });
      }
    } catch (error) {
      logger.error('[MetaAdsBudget] campaign status enrichment failed', {
        projectId,
        message: error.message,
      });
    }
  }
  const campaigns = buildCampaignSummaries({
    latestSnapshots: liveSnapshots
      ? mergeLiveSnapshotBudgetFallback(liveSnapshots, latestSnapshots)
      : latestSnapshots,
    recommendations,
    campaignConfigs,
    campaignInsights,
    ads: adSummaries,
    accountProfile: project?.metaAds?.accountProfile,
    targetResultType: project?.metaAds?.rules?.targetResultType,
  });
  if (adDiagnostics) {
    adDiagnostics = {
      ...adDiagnostics,
      adsAttachedToAdSets: countAttachedAds(campaigns),
    };
  }
  const period =
    options.datePreset || options.since || options.until
      ? {
          ...(options.datePreset ? { datePreset: options.datePreset } : {}),
          ...(options.since ? { since: options.since } : {}),
          ...(options.until ? { until: options.until } : {}),
        }
      : undefined;
  return {
    source: snapshotOnly ? 'snapshot' : 'live',
    latestSnapshots,
    recommendations,
    changes,
    campaigns,
    adDiagnostics,
    currency: currency || 'BRL',
    credentials,
    graphVersion,
    period,
    monthlyBudget: monthlyBudgetStatus,
    goalProgress,
    summary: buildDashboardSummary(campaigns),
    trend: buildCampaignTrend({
      snapshots: historicalSnapshots,
      changes,
      campaigns,
      adDailyInsights,
      accountProfile: project?.metaAds?.accountProfile,
      targetResultType: project?.metaAds?.rules?.targetResultType,
    }),
  };
}

async function applyManualBudgetChange({
  projectId,
  tenantId,
  entityLevel,
  entityId,
  entityName,
  dailyBudget,
  actor,
  actorUserId,
  reason,
}) {
  if (!['campaign', 'adset'].includes(entityLevel)) {
    throw new Error('Invalid Meta Ads budget entity level.');
  }
  const project = await runAsSystem(
    async () => (await getProjectById(projectId)) || (await findProjectById(projectId)),
  );
  if (!project) {
    throw new Error('Project not found.');
  }
  const projectTenantId = getProjectTenantId(project, tenantId);
  if (tenantId && projectTenantId !== tenantId) {
    throw new Error('Project does not belong to this tenant.');
  }
  const metaAds = withImplicitProjectTokenSecret(
    project.projectId || projectId,
    project.metaAds ?? {},
  );
  const token = await getAccessToken(projectTenantId, metaAds);
  const graphVersion = getMetaGraphVersion(metaAds.graphVersion);
  let campaignId = entityLevel === 'campaign' ? entityId : undefined;
  let adsetId = entityLevel === 'adset' ? entityId : undefined;
  if (entityLevel === 'adset') {
    const adsets = await listAdSets({
      adAccountId: normalizeAdAccountId(metaAds.adAccountId),
      token,
      graphVersion,
      includeInactive: true,
    }).catch((error) => {
      logger.error('[MetaAdsBudget] adsets manual budget rule lookup failed', {
        projectId,
        entityId,
        message: error.message,
      });
      return [];
    });
    const adset = adsets.find((item) => item.id === entityId);
    campaignId = adset?.campaign_id || adset?.campaign?.id;
  }
  const effectiveRuleContext = getEffectiveRuleContext({
    projectRules: mergeRules(metaAds),
    projectCreativeRules: metaAds.creativeRules,
    ruleGroups: metaAds.ruleGroups,
    ruleOverrides: metaAds.ruleOverrides,
    campaignId,
    adsetId,
  });
  const rules = effectiveRuleContext.rules;
  const nextDailyBudget = Number(dailyBudget);
  if (
    !Number.isFinite(nextDailyBudget) ||
    nextDailyBudget < rules.minDailyBudget ||
    nextDailyBudget > rules.maxDailyBudget
  ) {
    throw Object.assign(new Error('Manual Meta Ads budget is outside the effective rule limits.'), {
      statusCode: 400,
    });
  }
  const currentBudget = await getEntityDailyBudget({ entityId, token, graphVersion });
  const monthlyBudget = resolveMonthlyBudget(metaAds, metaAds.monthlyBudget?.month);
  const monthlyRange = getMetaAdsMonthRange(monthlyBudget.month);
  const monthlyCampaignInsights = getMonthlyBudgetLimit(monthlyBudget)
    ? await listCampaignInsights({
        adAccountId: normalizeAdAccountId(metaAds.adAccountId),
        token,
        since: monthlyRange.since,
        until: monthlyRange.until,
        graphVersion,
      })
    : [];
  const monthlyGuard = applyMonthlyBudgetGuard({
    proposal: { action: 'increase', proposedDailyBudget: nextDailyBudget },
    currentDailyBudget: currentBudget?.dailyBudget ?? 0,
    monthlyBudgetState: buildMonthlyBudgetState({
      monthlyBudget,
      insightRows: monthlyCampaignInsights,
    }),
  });
  if (nextDailyBudget > (currentBudget?.dailyBudget ?? 0) && monthlyGuard.blocked) {
    throw Object.assign(new Error(monthlyGuard.proposal.reason), { statusCode: 400 });
  }

  await metaPost({
    path: encodeURIComponent(entityId),
    token,
    graphVersion,
    resourceLabel: 'manual budget update',
    body: {
      daily_budget: dailyBudgetToCents(nextDailyBudget),
    },
  });

  const { MetaAdsBudgetChange } = getModels();
  const { deltaDailyBudget, deltaPercent } = calculateBudgetDelta(
    currentBudget?.dailyBudget,
    nextDailyBudget,
  );
  const change = await MetaAdsBudgetChange.create({
    tenantId: projectTenantId,
    projectId,
    adAccountId: normalizeAdAccountId(metaAds.adAccountId),
    entityLevel,
    entityId,
    entityName,
    campaignId,
    previousDailyBudget: currentBudget?.dailyBudget,
    newDailyBudget: nextDailyBudget,
    deltaDailyBudget,
    deltaPercent,
    actor,
    actorUserId,
    reason,
  });
  return { change };
}

async function updateProjectMetaAdsEntityStatus({
  projectId,
  tenantId,
  entityLevel,
  entityId,
  entityName,
  status,
  actor,
  actorUserId,
}) {
  if (!['ACTIVE', 'PAUSED'].includes(status)) {
    throw Object.assign(new Error('Invalid Meta Ads status.'), { statusCode: 400 });
  }
  if (!['campaign', 'adset', 'ad'].includes(entityLevel)) {
    throw Object.assign(new Error('Invalid Meta Ads entity level.'), { statusCode: 400 });
  }
  const normalizedEntityId = typeof entityId === 'string' ? entityId.trim() : '';
  if (!normalizedEntityId) {
    throw Object.assign(new Error('Meta Ads entity id is required.'), { statusCode: 400 });
  }
  const project = await runAsSystem(
    async () => (await getProjectById(projectId)) || (await findProjectById(projectId)),
  );
  if (!project) {
    throw Object.assign(new Error('Project not found.'), { statusCode: 404 });
  }
  const projectTenantId = getProjectTenantId(project, tenantId);
  if (tenantId && projectTenantId !== tenantId) {
    throw Object.assign(new Error('Project does not belong to this tenant.'), { statusCode: 403 });
  }

  const metaAds = withImplicitProjectTokenSecret(
    project.projectId || projectId,
    project.metaAds ?? {},
  );
  const token = await getAccessToken(projectTenantId, metaAds);
  const graphVersion = getMetaGraphVersion(metaAds.graphVersion);
  await updateMetaEntityStatus({
    entityId: normalizedEntityId,
    entityLevel,
    status,
    token,
    graphVersion,
  });
  const { MetaAdsAutomationAction } = getModels();
  await MetaAdsAutomationAction.create({
    tenantId: projectTenantId,
    projectId,
    adAccountId: normalizeAdAccountId(metaAds.adAccountId),
    actionType: entityLevel === 'ad' && status === 'PAUSED' ? 'pause_ad' : 'status_change',
    entityLevel,
    entityId: normalizedEntityId,
    entityName,
    newStatus: status,
    ruleSourceType: 'manual',
    actor,
    actorUserId,
    reason: `Manual status update to ${status}.`,
  });
  logger.info('[MetaAdsBudget] entity status updated', {
    projectId,
    tenantId: projectTenantId,
    entityLevel,
    entityId: normalizedEntityId,
    entityName,
    status,
    actor,
    actorUserId,
  });
  return { entityLevel, entityId: normalizedEntityId, status };
}

async function updateProjectMetaAdStatus({ adId, adName, ...options }) {
  return updateProjectMetaAdsEntityStatus({
    ...options,
    entityLevel: 'ad',
    entityId: adId,
    entityName: adName,
  });
}

function getCopiedMetaEntityId(entityLevel, payload) {
  const key = entityLevel === 'campaign' ? 'copied_campaign_id' : 'copied_adset_id';
  const copiedId = payload?.[key] ?? payload?.id;
  return typeof copiedId === 'string' && copiedId.trim() ? copiedId.trim() : '';
}

async function duplicateProjectMetaAdsEntity({
  projectId,
  tenantId,
  entityLevel,
  entityId,
  entityName,
  targetName,
  actor,
  actorUserId,
}) {
  if (!['campaign', 'adset'].includes(entityLevel)) {
    throw Object.assign(new Error('Invalid Meta Ads duplicate entity level.'), { statusCode: 400 });
  }
  const normalizedEntityId = typeof entityId === 'string' ? entityId.trim() : '';
  if (!normalizedEntityId) {
    throw Object.assign(new Error('Meta Ads entity id is required.'), { statusCode: 400 });
  }
  const normalizedTargetName = typeof targetName === 'string' ? targetName.trim() : '';
  if (!normalizedTargetName) {
    throw Object.assign(new Error('Meta Ads duplicate name is required.'), { statusCode: 400 });
  }
  const project = await runAsSystem(
    async () => (await getProjectById(projectId)) || (await findProjectById(projectId)),
  );
  if (!project) {
    throw Object.assign(new Error('Project not found.'), { statusCode: 404 });
  }
  const projectTenantId = getProjectTenantId(project, tenantId);
  if (tenantId && projectTenantId !== tenantId) {
    throw Object.assign(new Error('Project does not belong to this tenant.'), { statusCode: 403 });
  }

  const metaAds = withImplicitProjectTokenSecret(
    project.projectId || projectId,
    project.metaAds ?? {},
  );
  const token = await getAccessToken(projectTenantId, metaAds);
  const graphVersion = getMetaGraphVersion(metaAds.graphVersion);
  const payload = await copyMetaEntity({
    entityId: normalizedEntityId,
    entityLevel,
    statusOption: 'INHERITED_FROM_SOURCE',
    deepCopy: true,
    token,
    graphVersion,
  });
  const duplicatedEntityId = getCopiedMetaEntityId(entityLevel, payload);
  if (duplicatedEntityId) {
    await updateMetaEntityName({
      entityId: duplicatedEntityId,
      entityLevel,
      name: normalizedTargetName,
      token,
      graphVersion,
    });
  }
  logger.info('[MetaAdsBudget] entity duplicated', {
    projectId,
    tenantId: projectTenantId,
    entityLevel,
    entityId: normalizedEntityId,
    entityName,
    duplicatedEntityId,
    duplicatedEntityName: normalizedTargetName,
    actor,
    actorUserId,
  });
  return {
    entityLevel,
    sourceEntityId: normalizedEntityId,
    duplicatedEntityId,
    duplicatedEntityName: normalizedTargetName,
    status: 'INHERITED_FROM_SOURCE',
  };
}

async function runCron(options = {}) {
  const Project = mongoose.models.Project;
  if (!Project) {
    throw new Error('Project model is not initialized.');
  }
  const startedAt = Date.now();
  const projectTimeoutMs = getCronProjectTimeoutMs(options.projectTimeoutMs);
  const projectConcurrency = getCronProjectConcurrency(options.projectConcurrency);
  const projects = await runAsSystem(() =>
    Project.find({
      'metaAds.enabled': true,
      'metaAds.adAccountId': { $exists: true, $ne: '' },
    }).lean(),
  );
  logger.info('[MetaAdsBudgetCron] Started', {
    projects: projects.length,
    projectTimeoutMs,
    projectConcurrency,
  });
  const results = await mapWithConcurrency(projects, projectConcurrency, async (project) => {
    const projectStartedAt = Date.now();
    if (!(await isMetaAdsFeatureEnabled(project.tenantId))) {
      return { projectId: project.projectId, ok: true, skipped: true, reason: 'disabled' };
    }
    if (!isProjectDueForMetaAdsRun(project)) {
      return { projectId: project.projectId, ok: true, skipped: true, reason: 'not_due' };
    }
    try {
      logger.info('[MetaAdsBudgetCron] Project started', {
        projectId: project.projectId,
      });
      const result = await withTimeout(
        analyzeProject({ projectId: project.projectId, actor: 'cron' }),
        projectTimeoutMs,
        `Meta Ads project ${project.projectId} timed out after ${projectTimeoutMs}ms.`,
      );
      await runAsSystem(() =>
        Project.updateOne(
          { projectId: project.projectId },
          { $set: { 'metaAds.lastRunAt': new Date() } },
        ),
      );
      logger.info('[MetaAdsBudgetCron] Project finished', {
        projectId: project.projectId,
        durationMs: Date.now() - projectStartedAt,
      });
      return result;
    } catch (error) {
      logger.error('[MetaAdsBudgetCron] Project failed', {
        projectId: project.projectId,
        error: error.message,
        durationMs: Date.now() - projectStartedAt,
      });
      return { projectId: project.projectId, ok: false, error: error.message };
    }
  });
  logger.info('[MetaAdsBudgetCron] Finished', {
    projects: results.length,
    failed: results.filter((result) => result.ok === false).length,
    durationMs: Date.now() - startedAt,
  });
  return results;
}

module.exports = {
  DEFAULT_RULES,
  _buildCreativePauseRecommendationsForTest: buildCreativePauseRecommendations,
  _buildGoalProgressForTest: buildGoalProgress,
  _calculateMetricsForTest: calculateMetrics,
  _canonicalizeMetaActionTypeForTest: canonicalizeMetaActionType,
  _getMetaAdsMonthRangeForTest: getMetaAdsMonthRange,
  _resolveActionCooldownMinutesForTest: resolveActionCooldownMinutes,
  _resolveMonthlyBudgetForTest: resolveMonthlyBudget,
  _resolveStatusPeriodForTest: resolveStatusPeriod,
  _resolveTargetResultTypeForTest: resolveTargetResultType,
  analyzeProject,
  applyManualBudgetChange,
  applyRecommendation,
  buildCampaignSummaries,
  detectBudgetMode,
  duplicateProjectMetaAdsEntity,
  getModels,
  getEffectiveRules,
  getMetaGraphVersion,
  getProjectMetaAdsPerformance,
  getProjectMetaAdsRankings,
  getProjectMetaAdsAutomationRuns,
  getProjectMetaAdsRulePerformance,
  getProjectMetaAdsRuleHistory,
  getProjectMetaTokenSecretName,
  getProjectMetaAdsStatus,
  withImplicitProjectTokenSecret,
  getProjectTenantId,
  getScheduleIntervalMinutes,
  isMetaAdsFeatureEnabled,
  isProjectDueForMetaAdsRun,
  normalizeAdAccountId,
  proposeBudget,
  recordProjectMetaAdsRuleChange,
  resolveMetaCredentialStatus,
  resolveMetaAccessToken,
  runCron,
  updateProjectMetaAdStatus,
  updateProjectMetaAdsEntityStatus,
  validateMetaAdsRules,
};
