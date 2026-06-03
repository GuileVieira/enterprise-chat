const fetch = require('node-fetch');
const mongoose = require('mongoose');
const { logger, runAsSystem, getTenantId } = require('@librechat/data-schemas');
const { getProjectById, findProjectById, getTenantSecret } = require('~/models');
const { getAppConfig } = require('~/server/services/Config/app');

const META_GRAPH_HOST = 'https://graph.facebook.com';
const DEFAULT_META_GRAPH_VERSION = 'v25.0';
const META_TOKEN_SECRET_NAME = 'meta_graph_access_token';
const DEFAULT_LIMIT = 100;
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
        level: { type: String, enum: ['adset'], default: 'adset' },
        entityId: { type: String, index: true },
        entityName: String,
        dailyBudget: Number,
        spend: Number,
        cpa: Number,
        roas: Number,
        resultCount: Number,
        resultType: String,
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
        entityId: { type: String, index: true },
        entityName: String,
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
        entityId: { type: String, index: true },
        entityName: String,
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
  return { ...DEFAULT_RULES, ...(metaAds.rules ?? {}) };
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
  const purchaseAction = Array.isArray(row.actions)
    ? row.actions.find((action) => action.action_type === 'purchase')
    : null;
  const resultCount = Number(purchaseAction?.value ?? 0);
  const cpa = resultCount > 0 ? spend / resultCount : null;
  const roasValue = Array.isArray(row.purchase_roas)
    ? Number(row.purchase_roas[0]?.value ?? 0)
    : Number(row.purchase_roas ?? 0);
  const roas = Number.isFinite(roasValue) && roasValue > 0 ? roasValue : null;
  return { spend, resultCount, cpa, roas, resultType: purchaseAction?.action_type ?? 'purchase' };
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

async function metaGet(path, token, params = {}) {
  const url = new URL(`${META_GRAPH_HOST}/${DEFAULT_META_GRAPH_VERSION}/${path}`);
  for (const [key, value] of Object.entries(params)) {
    if (value != null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  }
  const response = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.error?.message || `Meta API GET failed with ${response.status}`);
  }
  return payload;
}

async function metaPost(path, token, body = {}) {
  const response = await fetch(`${META_GRAPH_HOST}/${DEFAULT_META_GRAPH_VERSION}/${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.error?.message || `Meta API POST failed with ${response.status}`);
  }
  return payload;
}

async function listActiveAdSets({ adAccountId, token }) {
  const payload = await metaGet(`${encodeURIComponent(adAccountId)}/adsets`, token, {
    fields: 'id,name,daily_budget,effective_status',
    effective_status: JSON.stringify(['ACTIVE']),
    limit: DEFAULT_LIMIT,
  });
  return Array.isArray(payload.data) ? payload.data : [];
}

async function listInsights({ adAccountId, token, since, until }) {
  const payload = await metaGet(`${encodeURIComponent(adAccountId)}/insights`, token, {
    level: 'adset',
    fields: 'adset_id,adset_name,spend,actions,purchase_roas',
    time_range: JSON.stringify({ since, until }),
    limit: DEFAULT_LIMIT,
  });
  return Array.isArray(payload.data) ? payload.data : [];
}

async function getRecentChange({ projectId, entityId, cooldownHours }) {
  const { MetaAdsBudgetChange } = getModels();
  const since = new Date(Date.now() - cooldownHours * 60 * 60 * 1000);
  return MetaAdsBudgetChange.findOne({ projectId, entityId, createdAt: { $gte: since } }).lean();
}

async function applyRecommendation({ recommendationId, projectId, actor, actorUserId }) {
  const { MetaAdsRecommendation, MetaAdsBudgetChange } = getModels();
  const recommendation = await MetaAdsRecommendation.findById(recommendationId).lean();
  if (!recommendation) {
    throw new Error('Recommendation not found.');
  }
  if (projectId && recommendation.projectId !== projectId) {
    throw new Error('Recommendation does not belong to this project.');
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
  const token = await getAccessToken(recommendation.tenantId, project?.metaAds ?? {});
  await metaPost(encodeURIComponent(recommendation.entityId), token, {
    daily_budget: dailyBudgetToCents(recommendation.proposedDailyBudget),
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
  const rules = mergeRules(metaAds);
  const tenantId = getProjectTenantId(project);
  const token = await getAccessToken(tenantId, metaAds);
  const now = new Date();
  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const until = now.toISOString().slice(0, 10);
  const { MetaAdsSnapshot, MetaAdsRecommendation } = getModels();

  const [adsets, insights] = await Promise.all([
    listActiveAdSets({ adAccountId, token }),
    listInsights({ adAccountId, token, since, until }),
  ]);
  const adsetById = new Map(adsets.map((adset) => [adset.id, adset]));
  const recommendations = [];

  for (const row of insights) {
    const entityId = row.adset_id;
    const adset = adsetById.get(entityId);
    if (!adset) {
      continue;
    }
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
      entityId,
      entityName: adset.name || row.adset_name,
      dailyBudget: currentDailyBudget,
      spend: metrics.spend,
      cpa: metrics.cpa,
      roas: metrics.roas,
      resultCount: metrics.resultCount,
      resultType: metrics.resultType,
      raw: row,
    });

    const recommendation = await MetaAdsRecommendation.create({
      tenantId,
      projectId,
      adAccountId,
      entityId,
      entityName: adset.name || row.adset_name,
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
        actor,
      });
    }
  }

  return {
    projectId,
    adAccountId,
    since,
    until,
    recommendations,
  };
}

async function getProjectMetaAdsStatus(projectId, fallbackTenantId) {
  const { MetaAdsSnapshot, MetaAdsRecommendation, MetaAdsBudgetChange } = getModels();
  const [project, latestSnapshots, recommendations, changes] = await Promise.all([
    runAsSystem(
      async () => (await getProjectById(projectId)) || (await findProjectById(projectId)),
    ),
    MetaAdsSnapshot.find({ projectId }).sort({ createdAt: -1 }).limit(50).lean(),
    MetaAdsRecommendation.find({ projectId }).sort({ createdAt: -1 }).limit(50).lean(),
    MetaAdsBudgetChange.find({ projectId }).sort({ createdAt: -1 }).limit(20).lean(),
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
  return { latestSnapshots, recommendations, changes, credentials };
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
  applyRecommendation,
  getModels,
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
};
