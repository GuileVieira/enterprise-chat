const fetch = require('node-fetch');
const { logger } = require('@librechat/data-schemas');

const META_GRAPH_HOST = 'https://graph.facebook.com';
const DEFAULT_META_GRAPH_VERSION = 'v25.0';
const MIN_META_GRAPH_VERSION = 24;
const META_GRAPH_VERSION_PATTERN = /^v\d+\.0$/;
const DEFAULT_LIMIT = 100;
const DEFAULT_META_GRAPH_TIMEOUT_MS = 30000;

function getPositiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function getMetaGraphTimeoutMs() {
  return getPositiveInteger(process.env.META_ADS_GRAPH_TIMEOUT_MS, DEFAULT_META_GRAPH_TIMEOUT_MS);
}

function createMetaGraphTimeoutError(resourceLabel, timeoutMs) {
  return new Error(`Meta Ads ${resourceLabel} request timed out after ${timeoutMs}ms.`);
}

async function fetchWithTimeout(url, options = {}, resourceLabel = 'Meta API') {
  const timeoutMs = getMetaGraphTimeoutMs();
  const controller = new AbortController();
  let timeout;
  const timeoutPromise = new Promise((_, reject) => {
    timeout = setTimeout(() => {
      reject(createMetaGraphTimeoutError(resourceLabel, timeoutMs));
      controller.abort();
    }, timeoutMs);
    timeout.unref?.();
  });

  try {
    return await Promise.race([
      fetch(url, {
        ...options,
        signal: controller.signal,
      }),
      timeoutPromise,
    ]);
  } finally {
    clearTimeout(timeout);
  }
}

function getMetaGraphVersion(value) {
  const configuredVersion =
    typeof value === 'string' && value.trim()
      ? value.trim()
      : process.env.META_GRAPH_API_VERSION?.trim();
  return configuredVersion && isSupportedMetaGraphVersion(configuredVersion)
    ? configuredVersion
    : DEFAULT_META_GRAPH_VERSION;
}

function getMetaGraphVersionNumber(value) {
  const match = typeof value === 'string' ? value.trim().match(/^v(\d+)\.0$/) : null;
  return match ? Number(match[1]) : null;
}

function isSupportedMetaGraphVersion(value) {
  const versionNumber = getMetaGraphVersionNumber(value);
  return versionNumber != null && versionNumber >= MIN_META_GRAPH_VERSION;
}

function getBodySnippet(text) {
  if (!text) {
    return '';
  }
  return text.length > 500 ? `${text.slice(0, 500)}...` : text;
}

function formatMetaPermissionError({ adAccountId }) {
  return `Token Meta Ads sem permissão para ${adAccountId}. Conceda ads_read ou ads_management ao app/token e confirme acesso à conta de anúncio.`;
}

function createMetaGraphError(message, details = {}) {
  return Object.assign(new Error(message), details);
}

function formatMetaFetchError({ resource, adAccountId, path, params, error }) {
  const detail = error?.message ? ` ${error.message}` : '';
  const paramKeys = params ? Object.keys(params).join(',') : '';
  return `Meta Ads ${resource} request failed for ${adAccountId} (${path}${
    paramKeys ? `; params: ${paramKeys}` : ''
  }).${detail}`;
}

function getAdAccountIdFromPath(path) {
  const [adAccountId] = String(path).split('/');
  return adAccountId || 'ad account';
}

function getMetaErrorMessage({ payload, path, bodySnippet, status }) {
  const metaError = payload?.error;
  const message = metaError?.message;
  if (metaError?.code === 200 || /ads_management|ads_read|permission/i.test(message ?? '')) {
    return formatMetaPermissionError({ adAccountId: getAdAccountIdFromPath(path) });
  }
  return (
    message ||
    (bodySnippet
      ? `Meta API GET failed with ${status}: ${bodySnippet}`
      : `Meta API GET failed with ${status}`)
  );
}

async function readMetaResponse({ response, path, graphVersion, params, resourceLabel }) {
  const body = await response.text();
  const bodySnippet = getBodySnippet(body);
  let payload;
  try {
    payload = body ? JSON.parse(body) : {};
  } catch (error) {
    logger.error('[MetaAdsGraph] Meta response body is not JSON', {
      path,
      graphVersion,
      status: response.status,
      contentType: response.headers?.get?.('content-type'),
      params,
      bodySnippet,
      message: error.message,
      stack: error.stack,
    });
    throw createMetaGraphError(
      `Meta returned an invalid ${resourceLabel} response (${response.status}). Body: ${
        bodySnippet || error.message
      }`,
      {
        status: response.status,
        data: bodySnippet,
      },
    );
  }

  if (!response.ok) {
    const message = getMetaErrorMessage({ payload, path, bodySnippet, status: response.status });
    logger.error('[MetaAdsGraph] Meta request failed', {
      path,
      graphVersion,
      status: response.status,
      message,
      code: payload?.error?.code,
      params,
      bodySnippet,
    });
    throw createMetaGraphError(message, {
      status: response.status,
      data: payload?.error || payload,
    });
  }
  return payload;
}

async function metaGet({ path, token, params = {}, graphVersion, resourceLabel = 'Meta API' }) {
  const resolvedGraphVersion = getMetaGraphVersion(graphVersion);
  const url = new URL(`${META_GRAPH_HOST}/${resolvedGraphVersion}/${path}`);
  for (const [key, value] of Object.entries(params)) {
    if (value != null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  }
  const paramKeys = Object.keys(params);
  let response;
  try {
    response = await fetchWithTimeout(
      url.toString(),
      {
        headers: { Authorization: `Bearer ${token}` },
      },
      resourceLabel,
    );
  } catch (error) {
    logger.error('[MetaAdsGraph] Meta fetch threw', {
      path,
      graphVersion: resolvedGraphVersion,
      params: paramKeys,
      message: error.message,
      stack: error.stack,
    });
    throw error;
  }
  return readMetaResponse({
    response,
    path,
    graphVersion: resolvedGraphVersion,
    params: paramKeys,
    resourceLabel,
  });
}

async function metaPost({ path, token, body = {}, graphVersion, resourceLabel = 'Meta API' }) {
  const resolvedGraphVersion = getMetaGraphVersion(graphVersion);
  let response;
  try {
    response = await fetchWithTimeout(
      `${META_GRAPH_HOST}/${resolvedGraphVersion}/${path}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      },
      resourceLabel,
    );
  } catch (error) {
    logger.error('[MetaAdsGraph] Meta fetch threw', {
      path,
      graphVersion: resolvedGraphVersion,
      params: Object.keys(body),
      message: error.message,
      stack: error.stack,
    });
    throw error;
  }
  return readMetaResponse({
    response,
    path,
    graphVersion: resolvedGraphVersion,
    params: Object.keys(body),
    resourceLabel,
  });
}

function centsToDailyBudget(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return null;
  }
  return numeric / 100;
}

async function getAdSetDailyBudget({ entityId, token, graphVersion }) {
  const payload = await metaGet({
    path: encodeURIComponent(entityId),
    token,
    params: { fields: 'daily_budget' },
    graphVersion,
    resourceLabel: 'ad set budget',
  });
  return centsToDailyBudget(payload.daily_budget);
}

async function getEntityDailyBudget({ entityId, token, graphVersion }) {
  const payload = await metaGet({
    path: encodeURIComponent(entityId),
    token,
    params: { fields: 'daily_budget,lifetime_budget' },
    graphVersion,
    resourceLabel: 'budget',
  });
  return {
    dailyBudget: centsToDailyBudget(payload.daily_budget),
    lifetimeBudget: centsToDailyBudget(payload.lifetime_budget),
  };
}

async function getAdAccountCurrency({ adAccountId, token, graphVersion }) {
  const payload = await metaGet({
    path: encodeURIComponent(adAccountId),
    token,
    params: { fields: 'currency' },
    graphVersion,
    resourceLabel: 'ad account currency',
  });
  return typeof payload.currency === 'string' && payload.currency.trim()
    ? payload.currency.trim()
    : undefined;
}

async function listAdSets({ adAccountId, token, graphVersion }) {
  logger.debug('[MetaAdsGraph] listing adsets', { adAccountId, graphVersion });
  const path = `${encodeURIComponent(adAccountId)}/adsets`;
  const params = {
    fields: 'id,name,daily_budget,lifetime_budget,effective_status,campaign_id,campaign{id,name}',
    limit: DEFAULT_LIMIT,
  };
  try {
    const payload = await metaGet({
      path,
      token,
      params,
      graphVersion,
      resourceLabel: 'ad sets',
    });
    return Array.isArray(payload.data)
      ? payload.data.filter((adset) => adset.effective_status === 'ACTIVE')
      : [];
  } catch (error) {
    const message = formatMetaFetchError({
      resource: 'ad sets',
      adAccountId,
      path,
      params,
      error,
    });
    logger.error('[MetaAdsGraph] adsets request failed with context', {
      adAccountId,
      path,
      params: Object.keys(params),
      message: error.message,
      stack: error.stack,
    });
    throw new Error(message);
  }
}

async function listCampaigns({ adAccountId, token, graphVersion }) {
  logger.debug('[MetaAdsGraph] listing campaigns', { adAccountId, graphVersion });
  const path = `${encodeURIComponent(adAccountId)}/campaigns`;
  const params = {
    fields: 'id,name,objective,daily_budget,lifetime_budget,effective_status',
    limit: DEFAULT_LIMIT,
  };
  try {
    const payload = await metaGet({
      path,
      token,
      params,
      graphVersion,
      resourceLabel: 'campaigns',
    });
    return Array.isArray(payload.data)
      ? payload.data.filter((campaign) => campaign.effective_status === 'ACTIVE')
      : [];
  } catch (error) {
    const message = formatMetaFetchError({
      resource: 'campaigns',
      adAccountId,
      path,
      params,
      error,
    });
    logger.error('[MetaAdsGraph] campaigns request failed with context', {
      adAccountId,
      path,
      params: Object.keys(params),
      message: error.message,
      stack: error.stack,
    });
    throw new Error(message);
  }
}

async function listAds({ adAccountId, token, graphVersion }) {
  logger.debug('[MetaAdsGraph] listing ads', { adAccountId, graphVersion });
  const path = `${encodeURIComponent(adAccountId)}/ads`;
  const params = {
    fields:
      'id,name,effective_status,adset_id,campaign_id,creative{id,name,title,body,thumbnail_url,image_url,video_id,object_story_spec,asset_feed_spec}',
    limit: DEFAULT_LIMIT,
  };
  try {
    const payload = await metaGet({
      path,
      token,
      params,
      graphVersion,
      resourceLabel: 'ads',
    });
    return Array.isArray(payload.data)
      ? payload.data.filter((ad) => ad.effective_status === 'ACTIVE')
      : [];
  } catch (error) {
    const message = formatMetaFetchError({
      resource: 'ads',
      adAccountId,
      path,
      params,
      error,
    });
    logger.error('[MetaAdsGraph] ads request failed with context', {
      adAccountId,
      path,
      params: Object.keys(params),
      message: error.message,
      stack: error.stack,
    });
    throw new Error(message);
  }
}

const AD_INSIGHT_FIELDS =
  'campaign_id,campaign_name,adset_id,adset_name,ad_id,ad_name,spend,impressions,reach,frequency,clicks,ctr,cpc,cpm,actions,cost_per_action_type,video_p75_watched_actions,purchase_roas';
const ADSET_INSIGHT_FIELDS =
  'campaign_id,campaign_name,adset_id,adset_name,spend,impressions,reach,frequency,clicks,ctr,cpc,cpm,actions,cost_per_action_type,video_p75_watched_actions,purchase_roas';
const CAMPAIGN_INSIGHT_FIELDS =
  'campaign_id,campaign_name,spend,impressions,reach,frequency,clicks,ctr,cpc,cpm,actions,cost_per_action_type,video_p75_watched_actions,purchase_roas';

async function listAdInsights({ adAccountId, token, since, until, graphVersion }) {
  logger.debug('[MetaAdsGraph] listing ad insights', { adAccountId, since, until, graphVersion });
  const path = `${encodeURIComponent(adAccountId)}/insights`;
  const params = {
    level: 'ad',
    fields: AD_INSIGHT_FIELDS,
    time_range: JSON.stringify({ since, until }),
    limit: DEFAULT_LIMIT,
  };
  try {
    const payload = await metaGet({
      path,
      token,
      params,
      graphVersion,
      resourceLabel: 'ad insights',
    });
    return Array.isArray(payload.data) ? payload.data : [];
  } catch (error) {
    const message = formatMetaFetchError({
      resource: 'ad insights',
      adAccountId,
      path,
      params,
      error,
    });
    logger.error('[MetaAdsGraph] ad insights request failed with context', {
      adAccountId,
      path,
      since,
      until,
      params: Object.keys(params),
      message: error.message,
      stack: error.stack,
    });
    throw new Error(message);
  }
}

async function listCampaignInsights({ adAccountId, token, since, until, graphVersion }) {
  logger.debug('[MetaAdsGraph] listing campaign insights', {
    adAccountId,
    since,
    until,
    graphVersion,
  });
  const path = `${encodeURIComponent(adAccountId)}/insights`;
  const params = {
    level: 'campaign',
    fields: CAMPAIGN_INSIGHT_FIELDS,
    time_range: JSON.stringify({ since, until }),
    limit: DEFAULT_LIMIT,
  };
  try {
    const payload = await metaGet({
      path,
      token,
      params,
      graphVersion,
      resourceLabel: 'campaign insights',
    });
    return Array.isArray(payload.data) ? payload.data : [];
  } catch (error) {
    const message = formatMetaFetchError({
      resource: 'campaign insights',
      adAccountId,
      path,
      params,
      error,
    });
    logger.error('[MetaAdsGraph] campaign insights request failed with context', {
      adAccountId,
      path,
      since,
      until,
      params: Object.keys(params),
      message: error.message,
      stack: error.stack,
    });
    throw new Error(message);
  }
}

async function listAdSetInsights({ adAccountId, token, since, until, graphVersion }) {
  logger.debug('[MetaAdsGraph] listing insights', { adAccountId, since, until, graphVersion });
  const path = `${encodeURIComponent(adAccountId)}/insights`;
  const params = {
    level: 'adset',
    fields: ADSET_INSIGHT_FIELDS,
    time_range: JSON.stringify({ since, until }),
    limit: DEFAULT_LIMIT,
  };
  try {
    const payload = await metaGet({
      path,
      token,
      params,
      graphVersion,
      resourceLabel: 'insights',
    });
    return Array.isArray(payload.data) ? payload.data : [];
  } catch (error) {
    const message = formatMetaFetchError({
      resource: 'insights',
      adAccountId,
      path,
      params,
      error,
    });
    logger.error('[MetaAdsGraph] insights request failed with context', {
      adAccountId,
      path,
      since,
      until,
      params: Object.keys(params),
      message: error.message,
      stack: error.stack,
    });
    throw new Error(message);
  }
}

module.exports = {
  DEFAULT_META_GRAPH_VERSION,
  MIN_META_GRAPH_VERSION,
  getAdSetDailyBudget,
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
  metaGet,
  metaPost,
};
