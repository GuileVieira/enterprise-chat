const mongoose = require('mongoose');
const { logger, runAsSystem, getTenantId } = require('@librechat/data-schemas');
const { getProjectById, findProjectById, getTenantSecret } = require('~/models');
const { getAppConfig } = require('~/server/services/Config/app');
const {
  getAdSetDailyBudget,
  getAdAccountCurrency,
  getEntityDailyBudget,
  getMetaGraphVersion,
  isSupportedMetaGraphVersion,
  listAds,
  listAdInsights,
  listCampaigns,
  listAdSetInsights,
  listAdSets,
  metaPost,
} = require('~/server/services/MetaAds/graph');

const META_TOKEN_SECRET_NAME = 'meta_graph_access_token';
const DEFAULT_SCHEDULE_INTERVAL_MINUTES = 180;
const DEFAULT_CRON_PROJECT_TIMEOUT_MS = 45000;
const DEFAULT_CRON_PROJECT_CONCURRENCY = 2;
const DEFAULT_CRON_ENTITY_CONCURRENCY = 5;
const SCHEDULE_INTERVALS = new Set([30, 60, 120, 180, 360, 720, 1440]);
const MIN_SAMPLE_SPEND = 10;
const DEFAULT_RULES = {
  targetCpa: 45,
  minRoas: 2,
  maxIncreasePct: 25,
  maxDecreasePct: 25,
  minDailyBudget: 20,
  maxDailyBudget: 500,
  cooldownHours: 24,
  minSpend: MIN_SAMPLE_SPEND,
  primaryMetric: 'cpa',
};
const PRIMARY_METRICS = new Set(['cpa', 'roas', 'cpc', 'ctr']);
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

function getProjectMetaTokenSecretName(projectId) {
  return `meta_graph_access_token_project_${projectId}`;
}

function getModels() {
  const snapshotSchema =
    mongoose.models.MetaAdsSnapshot?.schema ||
    new mongoose.Schema(
      {
        tenantId: { type: String, index: true },
        projectId: { type: String, index: true },
        adAccountId: { type: String, index: true },
        level: { type: String, enum: ['campaign', 'adset'], default: 'adset' },
        entityId: { type: String, index: true },
        entityName: String,
        campaignId: { type: String, index: true },
        campaignName: String,
        campaignObjective: String,
        dailyBudget: Number,
        spend: Number,
        cpa: Number,
        roas: Number,
        resultCount: Number,
        resultType: String,
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

  const recommendationSchema =
    mongoose.models.MetaAdsRecommendation?.schema ||
    new mongoose.Schema(
      {
        tenantId: { type: String, index: true },
        projectId: { type: String, index: true },
        adAccountId: { type: String, index: true },
        entityLevel: { type: String, enum: ['campaign', 'adset'], default: 'adset' },
        entityId: { type: String, index: true },
        entityName: String,
        campaignId: { type: String, index: true },
        campaignName: String,
        action: { type: String, enum: ['increase', 'decrease', 'hold'], required: true },
        status: {
          type: String,
          enum: ['pending', 'applied', 'ignored', 'blocked'],
          default: 'pending',
          index: true,
        },
        currentDailyBudget: Number,
        proposedDailyBudget: Number,
        spend: Number,
        cpa: Number,
        roas: Number,
        reason: String,
        mode: String,
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

  return {
    MetaAdsSnapshot:
      mongoose.models.MetaAdsSnapshot || mongoose.model('MetaAdsSnapshot', snapshotSchema),
    MetaAdsRecommendation:
      mongoose.models.MetaAdsRecommendation ||
      mongoose.model('MetaAdsRecommendation', recommendationSchema),
    MetaAdsBudgetChange:
      mongoose.models.MetaAdsBudgetChange || mongoose.model('MetaAdsBudgetChange', changeSchema),
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
    'cooldownHours',
    'minSpend',
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

function calculateMetrics(row, targetResultType) {
  const spend = Number(row.spend ?? 0);
  const actionPriority = [
    'onsite_conversion.messaging_conversation_started_7d',
    'onsite_conversion.messaging_first_reply',
    'onsite_conversion.lead_grouped',
    'offsite_conversion.fb_pixel_lead',
    'leadgen_grouped',
    'lead',
    'omni_purchase',
    'offsite_conversion.fb_pixel_purchase',
    'purchase',
  ];
  const actions = Array.isArray(row.actions) ? row.actions : [];
  const costPerAction = Array.isArray(row.cost_per_action_type) ? row.cost_per_action_type : [];
  const normalizedTarget =
    typeof targetResultType === 'string' && targetResultType.trim() ? targetResultType.trim() : '';
  const resultAction = normalizedTarget
    ? actions.find((action) => action.action_type === normalizedTarget)
    : (actionPriority
        .map((actionType) => actions.find((action) => action.action_type === actionType))
        .find(Boolean) ?? actions[0]);
  const resultCount = resultAction
    ? Number(resultAction.value ?? 0)
    : normalizedTarget
      ? 0
      : undefined;
  const resultCost = resultAction
    ? costPerAction.find((item) => item.action_type === resultAction.action_type)
    : null;
  const cpaFromMeta = Number(resultCost?.value);
  const cpa =
    Number.isFinite(cpaFromMeta) && cpaFromMeta > 0
      ? cpaFromMeta
      : Number(resultCount) > 0
        ? spend / resultCount
        : null;
  const roasValue = Array.isArray(row.purchase_roas)
    ? Number(row.purchase_roas[0]?.value ?? 0)
    : Number(row.purchase_roas ?? 0);
  const roas = Number.isFinite(roasValue) && roasValue > 0 ? roasValue : null;
  const videoP75Watched = Array.isArray(row.video_p75_watched_actions)
    ? Number(row.video_p75_watched_actions[0]?.value ?? 0)
    : Number(row.video_p75_watched_actions ?? 0);
  const impressions = Number(row.impressions ?? 0);
  return {
    spend,
    resultCount,
    cpa,
    roas,
    resultType: resultAction?.action_type ?? normalizedTarget,
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
  };
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
  targetResultType,
}) {
  const campaignById = new Map(campaigns.map((campaign) => [campaign.id, campaign]));
  const adsetById = new Map(adsets.map((adset) => [adset.id, adset]));
  return insights
    .map((row) => {
      const entityId = row.adset_id;
      const adset = adsetById.get(entityId);
      if (!entityId || !adset) {
        return null;
      }
      const campaignId = row.campaign_id || adset.campaign_id || adset.campaign?.id;
      const campaign = campaignById.get(campaignId);
      const campaignName = row.campaign_name || campaign?.name || adset.campaign?.name;
      const metrics = calculateMetrics(row, targetResultType);
      return {
        level: 'adset',
        entityId,
        entityName: row.adset_name || adset.name || entityId,
        campaignId,
        campaignName,
        campaignObjective: campaign?.objective,
        dailyBudget: centsToDailyBudget(adset.daily_budget),
        currency,
        ...metrics,
        raw: row,
        createdAt: new Date().toISOString(),
      };
    })
    .filter(Boolean);
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
  return objectStorySpec.link_data ?? objectStorySpec.video_data ?? {};
}

function getAssetFeedValue(assetFeedSpec, key) {
  const values = assetFeedSpec?.[key];
  if (!Array.isArray(values)) {
    return undefined;
  }
  const first = values.find((item) => typeof item?.text === 'string' && item.text.trim());
  return first?.text?.trim();
}

function buildAdSummaries({ ads = [], adInsights = [], currency, targetResultType }) {
  const insightByAdId = new Map(adInsights.map((row) => [row.ad_id, row]));
  return ads
    .map((ad) => {
      const adId = ad.id;
      if (!adId) {
        return null;
      }
      const creative = ad.creative ?? {};
      const linkData = getCreativeLinkData(creative);
      const assetFeedSpec = creative.asset_feed_spec;
      const insight = insightByAdId.get(adId) ?? {};
      const metrics = calculateMetrics(insight, targetResultType);
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
          getCreativeValue(creative, ['thumbnail_url']) || getCreativeValue(linkData, ['picture']),
        imageUrl:
          getCreativeValue(creative, ['image_url']) || getCreativeValue(linkData, ['picture']),
        videoId:
          getCreativeValue(creative, ['video_id']) || getCreativeValue(linkData, ['video_id']),
        linkUrl: getCreativeValue(linkData, ['link']),
        callToActionType: linkData.call_to_action?.type,
        status: ad.effective_status,
        currency,
        ...metrics,
      };
    })
    .filter(Boolean);
}

function buildCampaignSummaries({
  latestSnapshots = [],
  recommendations = [],
  campaignConfigs = [],
  ads = [],
}) {
  const recommendationByEntity = latestByEntity(recommendations);
  const snapshotByEntity = latestByEntity(latestSnapshots);
  const campaignConfigById = new Map(campaignConfigs.map((campaign) => [campaign.id, campaign]));
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
        spend: 0,
        resultCount: 0,
        resultType: snapshot.resultType,
        currency: snapshot.currency,
        dailyBudget: 0,
        impressions: 0,
        reach: 0,
        clicks: 0,
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
    campaign.frequency = Math.max(Number(campaign.frequency ?? 0), Number(snapshot.frequency ?? 0));
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
      dailyBudget: snapshot.dailyBudget,
      spend: snapshot.spend,
      cpa: snapshot.cpa,
      roas: snapshot.roas,
      resultCount: snapshot.resultCount,
      resultType: snapshot.resultType,
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
    campaign.budgetLevel = budgetInfo.budgetLevel;
    campaign.editableBudgetLevel = budgetInfo.editableBudgetLevel;
    campaign.budgetMode = budgetInfo.budgetMode;
    if (budgetInfo.budgetLevel === 'campaign') {
      campaign.dailyBudget = centsToDailyBudget(campaignConfig?.daily_budget);
    }
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
  const totalResults = campaigns.reduce(
    (sum, campaign) => sum + Number(campaign.resultCount ?? 0),
    0,
  );
  const frequencyValues = campaigns
    .map((campaign) => campaign.frequency)
    .filter((value) => Number.isFinite(Number(value)));
  const campaignsWithCost = campaigns.filter((campaign) => Number.isFinite(Number(campaign.cpa)));
  const sortedByCost = [...campaignsWithCost].sort(
    (first, second) => Number(first.cpa) - Number(second.cpa),
  );

  return {
    totalSpend: Number(totalSpend.toFixed(2)),
    totalResults: Number(totalResults.toFixed(2)),
    averageCostPerResult: totalResults > 0 ? Number((totalSpend / totalResults).toFixed(2)) : null,
    averageFrequency:
      frequencyValues.length > 0
        ? Number(
            (
              frequencyValues.reduce((sum, value) => sum + Number(value), 0) /
              frequencyValues.length
            ).toFixed(2),
          )
        : null,
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
    const frequency = Number(campaign.frequency);

    summary.campaignCount += 1;
    summary.totalSpend += Number.isFinite(spend) ? spend : 0;
    summary.totalResults += Number.isFinite(results) ? results : 0;
    summary.impressions += Number.isFinite(impressions) ? impressions : 0;
    summary.clicks += Number.isFinite(clicks) ? clicks : 0;
    if (Number.isFinite(frequency)) {
      summary.frequencyTotal += frequency;
      summary.frequencyCount += 1;
    }

    for (const adset of campaign.adSets ?? []) {
      const resultType = adset.resultType || campaign.resultType || 'UNKNOWN';
      const resultTypeSummary =
        summary.resultTypes.get(resultType) ?? createResultTypeSummaryItem(resultType);
      summary.resultTypes.set(resultType, resultTypeSummary);
      resultTypeSummary.totalSpend += Number(adset.spend ?? 0);
      resultTypeSummary.totalResults += Number(adset.resultCount ?? 0);
    }

    if ((campaign.adSets ?? []).length === 0) {
      const resultType = campaign.resultType || 'UNKNOWN';
      const resultTypeSummary =
        summary.resultTypes.get(resultType) ?? createResultTypeSummaryItem(resultType);
      summary.resultTypes.set(resultType, resultTypeSummary);
      resultTypeSummary.totalSpend += spend;
      resultTypeSummary.totalResults += results;
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
      }));
      return {
        objective: summary.objective,
        label: summary.label,
        campaignCount: summary.campaignCount,
        totalSpend: Number(summary.totalSpend.toFixed(2)),
        totalResults: Number(summary.totalResults.toFixed(2)),
        averageCostPerResult:
          summary.totalResults > 0
            ? Number((summary.totalSpend / summary.totalResults).toFixed(2))
            : null,
        averageFrequency:
          summary.frequencyCount > 0
            ? Number((summary.frequencyTotal / summary.frequencyCount).toFixed(2))
            : null,
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

function getSnapshotDateKey(snapshot) {
  const date = new Date(snapshot.createdAt ?? snapshot.updatedAt ?? Date.now());
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toISOString().slice(0, 10);
}

function buildCampaignTrend({ snapshots = [], changes = [] }) {
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
      frequency: 0,
    };
    point.spend += Number(snapshot.spend ?? 0);
    point.resultCount += Number(snapshot.resultCount ?? 0);
    point.dailyBudget += Number(snapshot.dailyBudget ?? 0);
    point.impressions += Number(snapshot.impressions ?? 0);
    point.clicks += Number(snapshot.clicks ?? 0);
    point.frequency = Math.max(Number(point.frequency ?? 0), Number(snapshot.frequency ?? 0));
    point.cpa = point.resultCount > 0 ? roundMetric(point.spend / point.resultCount) : null;
    point.ctr =
      point.impressions > 0 ? roundMetric((point.clicks / point.impressions) * 100) : null;
    pointsByDateCampaign.set(key, point);
  }

  const points = Array.from(pointsByDateCampaign.values())
    .map((point) => ({
      ...point,
      spend: roundMetric(point.spend) ?? 0,
      resultCount: roundMetric(point.resultCount) ?? 0,
      dailyBudget: roundMetric(point.dailyBudget) ?? 0,
      frequency: roundMetric(point.frequency) ?? null,
      impressions: roundMetric(point.impressions) ?? 0,
      clicks: roundMetric(point.clicks) ?? 0,
    }))
    .sort((left, right) =>
      left.date === right.date
        ? String(left.campaignName ?? left.campaignId).localeCompare(
            String(right.campaignName ?? right.campaignId),
          )
        : left.date.localeCompare(right.date),
    );

  const latestChangeByCampaign = new Map();
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

  return {
    points,
    campaignDeltas,
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
  const today = now.toISOString().slice(0, 10);
  if (options.datePreset === 'today') {
    return { since: today, until: today };
  }
  if (options.datePreset === 'yesterday') {
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    return { since: yesterday, until: yesterday };
  }
  const daysByPreset = {
    last_7d: 7,
    last_14d: 14,
    last_30d: 30,
  };
  const days = daysByPreset[options.datePreset];
  if (days) {
    const since = new Date(now.getTime() - (days - 1) * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    return { since, until: today };
  }
  return {};
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
}) {
  if (!currentDailyBudget || spend < rules.minSpend) {
    return {
      action: 'hold',
      proposedDailyBudget: currentDailyBudget,
      reason: `Dados insuficientes: gasto ${spend.toFixed(2)} abaixo do mínimo ${rules.minSpend}.`,
    };
  }

  const primaryMetric = PRIMARY_METRICS.has(rules.primaryMetric) ? rules.primaryMetric : 'cpa';
  const targetResultType =
    typeof rules.targetResultType === 'string' && rules.targetResultType.trim()
      ? rules.targetResultType.trim()
      : '';
  const missingTargetResult =
    targetResultType && resultType === targetResultType && Number(resultCount ?? 0) <= 0;
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
    const proposed = Math.max(
      rules.minDailyBudget,
      currentDailyBudget * (1 - rules.maxDecreasePct / 100),
    );
    return {
      action: proposed < currentDailyBudget ? 'decrease' : 'hold',
      proposedDailyBudget: Number(proposed.toFixed(2)),
      reason: missingTargetResult
        ? `Resultado alvo ${targetResultType} sem conversões no período.`
        : `Performance abaixo da regra: CPA ${cpa?.toFixed(2) ?? '-'} / ROAS ${
            roas?.toFixed(2) ?? '-'
          } / CPC ${cpc?.toFixed(2) ?? '-'} / CTR ${ctr?.toFixed(2) ?? '-'}. ${
            guardrailReasons.join(' ') || ''
          }`.trim(),
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

async function getRecentChange({ projectId, entityId, cooldownHours }) {
  const { MetaAdsBudgetChange } = getModels();
  const since = new Date(Date.now() - cooldownHours * 60 * 60 * 1000);
  return MetaAdsBudgetChange.findOne({ projectId, entityId, createdAt: { $gte: since } }).lean();
}

async function applyRecommendation({ recommendationId, projectId, tenantId, actor, actorUserId }) {
  const { MetaAdsRecommendation, MetaAdsBudgetChange } = getModels();
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
  const currentDailyBudget = await getAdSetDailyBudget({
    entityId: recommendation.entityId,
    token,
    graphVersion,
  });
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
  await metaPost({
    path: encodeURIComponent(recommendation.entityId),
    token,
    graphVersion,
    resourceLabel: 'budget update',
    body: {
      daily_budget: dailyBudgetToCents(recommendation.proposedDailyBudget),
    },
  });
  const { deltaDailyBudget, deltaPercent } = calculateBudgetDelta(
    recommendation.currentDailyBudget,
    recommendation.proposedDailyBudget,
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
    newDailyBudget: recommendation.proposedDailyBudget,
    deltaDailyBudget,
    deltaPercent,
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
  const token = await getAccessToken(tenantId, metaAds);
  const now = new Date();
  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const until = now.toISOString().slice(0, 10);
  const { MetaAdsSnapshot, MetaAdsRecommendation } = getModels();
  const graphVersion = getMetaGraphVersion(metaAds.graphVersion);
  const entityConcurrency = getCronEntityConcurrency();

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
  const insightsPromise = listAdSetInsights({
    adAccountId,
    token,
    since,
    until,
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
  const [campaigns, adsets, insights] = await Promise.all([
    campaignsPromise,
    adsetsPromise,
    insightsPromise,
  ]);
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
      const rules = getEffectiveRules({
        projectRules,
        ruleGroups: metaAds.ruleGroups,
        ruleOverrides: metaAds.ruleOverrides,
        campaignId,
        adsetId: entityId,
      });
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
      const metrics = calculateMetrics(row);

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
        dailyBudget: currentDailyBudget,
        spend: metrics.spend,
        cpa: metrics.cpa,
        roas: metrics.roas,
        resultCount: metrics.resultCount,
        resultType: metrics.resultType,
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

      const proposal = proposeBudget({ currentDailyBudget, ...metrics, rules, creativeRules });
      const recentChange = await getRecentChange({
        projectId,
        entityId: recommendationEntityId,
        cooldownHours: rules.cooldownHours,
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
        status: blockedByCooldown ? 'blocked' : 'pending',
        currentDailyBudget,
        proposedDailyBudget: proposal.proposedDailyBudget,
        spend: metrics.spend,
        cpa: metrics.cpa,
        roas: metrics.roas,
        reason: blockedByCooldown ? 'Bloqueado por cooldown de orçamento.' : proposal.reason,
        mode: metaAds.automationMode || 'recommend',
      });
      return recommendation.toObject();
    })
  ).filter(Boolean);

  if (applyAuto && metaAds.automationMode === 'auto_limited') {
    for (const recommendation of recommendations) {
      if (recommendation.status !== 'pending' || recommendation.action === 'hold') {
        continue;
      }
      await applyRecommendation({
        recommendationId: recommendation._id,
        projectId,
        tenantId,
        actor,
      });
    }
  }

  return {
    projectId,
    adAccountId,
    graphVersion,
    since,
    until,
    recommendations,
  };
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
  let liveSnapshots;
  let currency;
  if (project?.metaAds?.adAccountId) {
    try {
      const metaAds = withImplicitProjectTokenSecret(
        project.projectId || projectId,
        project.metaAds ?? {},
      );
      const token = await getAccessToken(tenantId, metaAds);
      campaignConfigs = await listCampaigns({
        adAccountId: normalizeAdAccountId(metaAds.adAccountId),
        token,
        graphVersion: getMetaGraphVersion(metaAds.graphVersion),
      });
      currency = await getAdAccountCurrency({
        adAccountId: normalizeAdAccountId(metaAds.adAccountId),
        token,
        graphVersion: getMetaGraphVersion(metaAds.graphVersion),
      });
      if (options.datePreset || options.since || options.until) {
        const { since, until } = resolveStatusPeriod(options);
        adsetConfigs = await listAdSets({
          adAccountId: normalizeAdAccountId(metaAds.adAccountId),
          token,
          graphVersion: getMetaGraphVersion(metaAds.graphVersion),
        });
        const [insights, liveAds, liveAdInsights] = await Promise.all([
          listAdSetInsights({
            adAccountId: normalizeAdAccountId(metaAds.adAccountId),
            token,
            since,
            until,
            graphVersion: getMetaGraphVersion(metaAds.graphVersion),
          }),
          listAds({
            adAccountId: normalizeAdAccountId(metaAds.adAccountId),
            token,
            graphVersion: getMetaGraphVersion(metaAds.graphVersion),
          }).catch((error) => {
            logger.error('[MetaAdsBudget] ads status enrichment failed', {
              projectId,
              message: error.message,
            });
            return [];
          }),
          listAdInsights({
            adAccountId: normalizeAdAccountId(metaAds.adAccountId),
            token,
            since,
            until,
            graphVersion: getMetaGraphVersion(metaAds.graphVersion),
          }).catch((error) => {
            logger.error('[MetaAdsBudget] ad insights status enrichment failed', {
              projectId,
              message: error.message,
            });
            return [];
          }),
        ]);
        liveSnapshots = buildSnapshotsFromInsights({
          insights,
          adsets: adsetConfigs,
          campaigns: campaignConfigs,
          currency,
          targetResultType: metaAds.rules?.targetResultType,
        });
        adSummaries = buildAdSummaries({
          ads: liveAds,
          adInsights: liveAdInsights,
          currency,
          targetResultType: metaAds.rules?.targetResultType,
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
    latestSnapshots: liveSnapshots ?? latestSnapshots,
    recommendations,
    campaignConfigs,
    ads: adSummaries,
  });
  const period =
    options.datePreset || options.since || options.until
      ? {
          ...(options.datePreset ? { datePreset: options.datePreset } : {}),
          ...(options.since ? { since: options.since } : {}),
          ...(options.until ? { until: options.until } : {}),
        }
      : undefined;
  return {
    latestSnapshots,
    recommendations,
    changes,
    campaigns,
    currency: currency || 'BRL',
    credentials,
    graphVersion,
    period,
    summary: buildDashboardSummary(campaigns),
    trend: buildCampaignTrend({
      snapshots: liveSnapshots ?? historicalSnapshots,
      changes,
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
  const rules = validateMetaAdsRules(project.metaAds?.rules);
  const nextDailyBudget = Number(dailyBudget);
  if (
    !Number.isFinite(nextDailyBudget) ||
    nextDailyBudget < rules.minDailyBudget ||
    nextDailyBudget > rules.maxDailyBudget
  ) {
    throw new Error('Manual Meta Ads budget is outside the effective rule limits.');
  }

  const metaAds = withImplicitProjectTokenSecret(
    project.projectId || projectId,
    project.metaAds ?? {},
  );
  const token = await getAccessToken(projectTenantId, metaAds);
  const graphVersion = getMetaGraphVersion(metaAds.graphVersion);
  const currentBudget = await getEntityDailyBudget({ entityId, token, graphVersion });

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
  analyzeProject,
  applyManualBudgetChange,
  applyRecommendation,
  buildCampaignSummaries,
  detectBudgetMode,
  getModels,
  getEffectiveRules,
  getMetaGraphVersion,
  getProjectMetaTokenSecretName,
  getProjectMetaAdsStatus,
  withImplicitProjectTokenSecret,
  getProjectTenantId,
  getScheduleIntervalMinutes,
  isMetaAdsFeatureEnabled,
  isProjectDueForMetaAdsRun,
  normalizeAdAccountId,
  proposeBudget,
  resolveMetaCredentialStatus,
  resolveMetaAccessToken,
  runCron,
  validateMetaAdsRules,
};
