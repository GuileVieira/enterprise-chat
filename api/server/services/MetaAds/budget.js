const mongoose = require('mongoose');
const { logger, runAsSystem, getTenantId } = require('@librechat/data-schemas');
const { getProjectById, findProjectById, getTenantSecret } = require('~/models');
const { getAppConfig } = require('~/server/services/Config/app');
const {
  getAdSetDailyBudget,
  getEntityDailyBudget,
  getMetaGraphVersion,
  listCampaigns,
  listAdSetInsights,
  listAdSets,
  metaPost,
} = require('~/server/services/MetaAds/graph');

const META_TOKEN_SECRET_NAME = 'meta_graph_access_token';
const DEFAULT_SCHEDULE_INTERVAL_MINUTES = 180;
const SCHEDULE_INTERVALS = new Set([30, 60, 120, 180, 360, 720, 1440]);
const MIN_SAMPLE_SPEND = 10;
const DEFAULT_RULES = {
  targetCpa: 45,
  minRoas: 2,
  maxIncreasePct: 15,
  maxDecreasePct: 20,
  minDailyBudget: 20,
  maxDailyBudget: 500,
  cooldownHours: 24,
  minSpend: MIN_SAMPLE_SPEND,
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

  const changeSchema =
    mongoose.models.MetaAdsBudgetChange?.schema ||
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

function validateMetaAdsRules(rules = {}) {
  const merged = { ...DEFAULT_RULES, ...(rules ?? {}) };
  const errors = [];
  const validated = {};
  for (const key of Object.keys(DEFAULT_RULES)) {
    validated[key] = validateRuleNumber(merged, key, errors);
  }
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

function calculateMetrics(row) {
  const spend = Number(row.spend ?? 0);
  const actionPriority = [
    'onsite_conversion.messaging_conversation_started_7d',
    'lead',
    'purchase',
  ];
  const actions = Array.isArray(row.actions) ? row.actions : [];
  const costPerAction = Array.isArray(row.cost_per_action_type) ? row.cost_per_action_type : [];
  const resultAction =
    actionPriority
      .map((actionType) => actions.find((action) => action.action_type === actionType))
      .find(Boolean) ?? actions[0];
  const resultCount = Number(resultAction?.value ?? 0);
  const resultCost = resultAction
    ? costPerAction.find((item) => item.action_type === resultAction.action_type)
    : null;
  const cpaFromMeta = Number(resultCost?.value);
  const cpa =
    Number.isFinite(cpaFromMeta) && cpaFromMeta > 0
      ? cpaFromMeta
      : resultCount > 0
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
    resultType: resultAction?.action_type ?? 'purchase',
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

function buildCampaignSummaries({
  latestSnapshots = [],
  recommendations = [],
  campaignConfigs = [],
}) {
  const recommendationByEntity = latestByEntity(recommendations);
  const snapshotByEntity = latestByEntity(latestSnapshots);
  const campaignConfigById = new Map(campaignConfigs.map((campaign) => [campaign.id, campaign]));
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
    campaign.adSets.push({
      entityId: snapshot.entityId,
      entityName: snapshot.entityName,
      campaignId,
      campaignName,
      dailyBudget: snapshot.dailyBudget,
      spend: snapshot.spend,
      cpa: snapshot.cpa,
      roas: snapshot.roas,
      resultCount: snapshot.resultCount,
      resultType: snapshot.resultType,
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
  };
}

function proposeBudget({ currentDailyBudget, cpa, roas, spend, rules }) {
  if (!currentDailyBudget || spend < rules.minSpend) {
    return {
      action: 'hold',
      proposedDailyBudget: currentDailyBudget,
      reason: `Dados insuficientes: gasto ${spend.toFixed(2)} abaixo do mínimo ${rules.minSpend}.`,
    };
  }

  const cpaGood = cpa != null && cpa <= rules.targetCpa;
  const roasGood = roas != null && roas >= rules.minRoas;
  const cpaBad = cpa != null && cpa > rules.targetCpa;
  const roasBad = roas != null && roas < rules.minRoas;

  if (cpaGood && roasGood) {
    const proposed = Math.min(
      rules.maxDailyBudget,
      currentDailyBudget * (1 + rules.maxIncreasePct / 100),
    );
    return {
      action: proposed > currentDailyBudget ? 'increase' : 'hold',
      proposedDailyBudget: Number(proposed.toFixed(2)),
      reason: `CPA ${cpa.toFixed(2)} dentro do alvo e ROAS ${roas.toFixed(2)} acima do mínimo.`,
    };
  }

  if (cpaBad || roasBad) {
    const proposed = Math.max(
      rules.minDailyBudget,
      currentDailyBudget * (1 - rules.maxDecreasePct / 100),
    );
    return {
      action: proposed < currentDailyBudget ? 'decrease' : 'hold',
      proposedDailyBudget: Number(proposed.toFixed(2)),
      reason: `Performance abaixo da regra: CPA ${cpa?.toFixed(2) ?? '-'} / ROAS ${
        roas?.toFixed(2) ?? '-'
      }.`,
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
  await MetaAdsBudgetChange.create({
    tenantId: recommendation.tenantId,
    projectId: recommendation.projectId,
    adAccountId: recommendation.adAccountId,
    recommendationId: String(recommendation._id),
    entityId: recommendation.entityId,
    entityName: recommendation.entityName,
    previousDailyBudget: recommendation.currentDailyBudget,
    newDailyBudget: recommendation.proposedDailyBudget,
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
  const tenantId = getProjectTenantId(project);
  const token = await getAccessToken(tenantId, metaAds);
  const now = new Date();
  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const until = now.toISOString().slice(0, 10);
  const { MetaAdsSnapshot, MetaAdsRecommendation } = getModels();
  const graphVersion = getMetaGraphVersion(metaAds.graphVersion);

  let campaigns = [];
  let adsets;
  let insights;
  try {
    campaigns = await listCampaigns({ adAccountId, token, graphVersion });
  } catch (error) {
    logger.error('[MetaAdsBudget] campaigns fetch failed', {
      projectId,
      adAccountId,
      message: error.message,
      stack: error.stack,
    });
  }
  try {
    adsets = await listAdSets({ adAccountId, token, graphVersion });
  } catch (error) {
    logger.error('[MetaAdsBudget] adsets fetch failed', {
      projectId,
      adAccountId,
      message: error.message,
      stack: error.stack,
    });
    throw error;
  }
  try {
    insights = await listAdSetInsights({ adAccountId, token, since, until, graphVersion });
  } catch (error) {
    logger.error('[MetaAdsBudget] insights fetch failed', {
      projectId,
      adAccountId,
      since,
      until,
      message: error.message,
      stack: error.stack,
    });
    throw error;
  }
  const campaignById = new Map(campaigns.map((campaign) => [campaign.id, campaign]));
  const adsetById = new Map(adsets.map((adset) => [adset.id, adset]));
  const recommendations = [];

  for (const row of insights) {
    const entityId = row.adset_id;
    const adset = adsetById.get(entityId);
    if (!adset) {
      continue;
    }
    const campaignId = row.campaign_id || adset.campaign_id || adset.campaign?.id;
    const campaign = campaignById.get(campaignId);
    const campaignName = row.campaign_name || campaign?.name || adset.campaign?.name;
    const rules = getEffectiveRules({
      projectRules,
      ruleGroups: metaAds.ruleGroups,
      ruleOverrides: metaAds.ruleOverrides,
      campaignId,
      adsetId: entityId,
    });
    const currentDailyBudget = centsToDailyBudget(adset.daily_budget);
    const metrics = calculateMetrics(row);
    const proposal = proposeBudget({ currentDailyBudget, ...metrics, rules });
    const recentChange = await getRecentChange({
      projectId,
      entityId,
      cooldownHours: rules.cooldownHours,
    });
    const blockedByCooldown = proposal.action !== 'hold' && Boolean(recentChange);

    await MetaAdsSnapshot.create({
      tenantId,
      projectId,
      adAccountId,
      level: 'adset',
      entityId,
      entityName: adset.name || row.adset_name,
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

    await MetaAdsRecommendation.updateMany(
      {
        tenantId,
        projectId,
        entityId,
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
      entityLevel: 'adset',
      entityId,
      entityName: adset.name || row.adset_name,
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
    recommendations.push(recommendation.toObject());

    if (
      applyAuto &&
      metaAds.automationMode === 'auto_limited' &&
      recommendation.status === 'pending' &&
      recommendation.action !== 'hold'
    ) {
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
  const [latestSnapshots, recommendations, changes] = await Promise.all([
    MetaAdsSnapshot.find(query).sort({ createdAt: -1 }).limit(50).lean(),
    MetaAdsRecommendation.find(query).sort({ createdAt: -1 }).limit(50).lean(),
    MetaAdsBudgetChange.find(query).sort({ createdAt: -1 }).limit(20).lean(),
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
  const graphVersion = project
    ? {
        effective: getMetaGraphVersion(project.metaAds?.graphVersion),
        configured: project.metaAds?.graphVersion,
        source: project.metaAds?.graphVersion ? 'project' : 'global',
      }
    : undefined;
  let campaignConfigs = [];
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
    } catch (error) {
      logger.error('[MetaAdsBudget] campaign status enrichment failed', {
        projectId,
        message: error.message,
      });
    }
  }
  const campaigns = buildCampaignSummaries({
    latestSnapshots,
    recommendations,
    campaignConfigs,
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
    credentials,
    graphVersion,
    period,
    summary: buildDashboardSummary(campaigns),
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
  const change = await MetaAdsBudgetChange.create({
    tenantId: projectTenantId,
    projectId,
    adAccountId: normalizeAdAccountId(metaAds.adAccountId),
    entityLevel,
    entityId,
    entityName,
    previousDailyBudget: currentBudget?.dailyBudget,
    newDailyBudget: nextDailyBudget,
    actor,
    actorUserId,
    reason,
  });
  return { change };
}

async function runCron() {
  const Project = mongoose.models.Project;
  if (!Project) {
    throw new Error('Project model is not initialized.');
  }
  const projects = await runAsSystem(() =>
    Project.find({
      'metaAds.enabled': true,
      'metaAds.adAccountId': { $exists: true, $ne: '' },
    }).lean(),
  );
  const results = [];
  for (const project of projects) {
    if (!(await isMetaAdsFeatureEnabled(project.tenantId))) {
      results.push({ projectId: project.projectId, ok: true, skipped: true, reason: 'disabled' });
      continue;
    }
    if (!isProjectDueForMetaAdsRun(project)) {
      results.push({ projectId: project.projectId, ok: true, skipped: true, reason: 'not_due' });
      continue;
    }
    try {
      const result = await analyzeProject({ projectId: project.projectId, actor: 'cron' });
      await runAsSystem(() =>
        Project.updateOne(
          { projectId: project.projectId },
          { $set: { 'metaAds.lastRunAt': new Date() } },
        ),
      );
      results.push(result);
    } catch (error) {
      logger.error('[MetaAdsBudgetCron] Project failed', {
        projectId: project.projectId,
        error: error.message,
      });
      results.push({ projectId: project.projectId, ok: false, error: error.message });
    }
  }
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
