const fetch = require('node-fetch');
const { logger } = require('@librechat/data-schemas');

const META_GRAPH_HOST = 'https://graph.facebook.com';
const DEFAULT_META_GRAPH_VERSION = 'v25.0';
const META_GRAPH_VERSION_PATTERN = /^v\d+\.0$/;
const DEFAULT_LIMIT = 100;

function getMetaGraphVersion(value) {
  const configuredVersion =
    typeof value === 'string' && value.trim()
      ? value.trim()
      : process.env.META_GRAPH_API_VERSION?.trim();
  return configuredVersion && META_GRAPH_VERSION_PATTERN.test(configuredVersion)
    ? configuredVersion
    : DEFAULT_META_GRAPH_VERSION;
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
    response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    });
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
  const response = await fetch(`${META_GRAPH_HOST}/${resolvedGraphVersion}/${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
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

async function listAdSets({ adAccountId, token, graphVersion }) {
  logger.debug('[MetaAdsGraph] listing adsets', { adAccountId, graphVersion });
  const path = `${encodeURIComponent(adAccountId)}/adsets`;
  const params = {
    fields: 'id,name,daily_budget,effective_status',
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

async function listAdSetInsights({ adAccountId, token, since, until, graphVersion }) {
  logger.debug('[MetaAdsGraph] listing insights', { adAccountId, since, until, graphVersion });
  const path = `${encodeURIComponent(adAccountId)}/insights`;
  const params = {
    level: 'adset',
    fields: 'adset_id,adset_name,spend,actions,purchase_roas',
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
  getAdSetDailyBudget,
  getMetaGraphVersion,
  listAdSetInsights,
  listAdSets,
  metaGet,
  metaPost,
};
