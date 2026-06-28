const fetch = require('node-fetch');
const crypto = require('crypto');
const { logger } = require('@librechat/data-schemas');

const META_GRAPH_HOST = 'https://graph.facebook.com';
const DEFAULT_META_GRAPH_VERSION = 'v25.0';
const MIN_META_GRAPH_VERSION = 24;
const META_GRAPH_VERSION_PATTERN = /^v\d+\.0$/;
const DEFAULT_LIMIT = 100;
const DEFAULT_META_GRAPH_TIMEOUT_MS = 30000;
const DEFAULT_META_GRAPH_MAX_PAGES = 20;
const DEFAULT_META_INSIGHTS_CHUNK_DAYS = 7;
const DEFAULT_META_GRAPH_READ_CACHE_TTL_MS = 30 * 60 * 1000;
const DEFAULT_META_GRAPH_TODAY_CACHE_TTL_MS = 10 * 60 * 1000;
const DEFAULT_META_GRAPH_HISTORICAL_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const DEFAULT_META_GRAPH_READ_CACHE_MAX_ENTRIES = 250;
const DEFAULT_META_GRAPH_ACCOUNT_CONCURRENCY = 1;
const DEFAULT_META_GRAPH_READ_CACHE_VERSION = '2026-06-18-ad-creative-media-v2';
const metaGraphReadCache = new Map();
const metaGraphInflightReads = new Map();
const metaGraphAccountQueues = new Map();
let metaGraphReadStore;

function getPositiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function getMetaGraphTimeoutMs() {
  return getPositiveInteger(process.env.META_ADS_GRAPH_TIMEOUT_MS, DEFAULT_META_GRAPH_TIMEOUT_MS);
}

function getMetaGraphMaxPages() {
  return getPositiveInteger(process.env.META_ADS_GRAPH_MAX_PAGES, DEFAULT_META_GRAPH_MAX_PAGES);
}

function getMetaGraphAccountConcurrency() {
  return getPositiveInteger(
    process.env.META_ADS_GRAPH_ACCOUNT_CONCURRENCY,
    DEFAULT_META_GRAPH_ACCOUNT_CONCURRENCY,
  );
}

function getMetaInsightsChunkDays() {
  return getPositiveInteger(
    process.env.META_ADS_INSIGHTS_CHUNK_DAYS,
    DEFAULT_META_INSIGHTS_CHUNK_DAYS,
  );
}

function getMetaGraphReadCacheTtlMs() {
  return getPositiveInteger(
    process.env.META_ADS_GRAPH_READ_CACHE_TTL_MS,
    DEFAULT_META_GRAPH_READ_CACHE_TTL_MS,
  );
}

function getMetaGraphTodayCacheTtlMs() {
  return getPositiveInteger(
    process.env.META_ADS_GRAPH_TODAY_CACHE_TTL_MS,
    DEFAULT_META_GRAPH_TODAY_CACHE_TTL_MS,
  );
}

function getMetaGraphHistoricalCacheTtlMs() {
  return getPositiveInteger(
    process.env.META_ADS_GRAPH_HISTORICAL_CACHE_TTL_MS,
    DEFAULT_META_GRAPH_HISTORICAL_CACHE_TTL_MS,
  );
}

function getMetaAdsDateKey(date = new Date()) {
  const timeZone = process.env.META_ADS_TIME_ZONE || process.env.TZ || 'America/Sao_Paulo';
  const parts = new Intl.DateTimeFormat('en-CA', {
    day: '2-digit',
    month: '2-digit',
    timeZone,
    year: 'numeric',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function getTimeRangeParam(params) {
  if (typeof params?.time_range !== 'string') {
    return null;
  }
  try {
    return JSON.parse(params.time_range);
  } catch {
    return null;
  }
}

function getMetaGraphReadCacheTtlForParams(params) {
  if (typeof params?.date_preset === 'string' && params.date_preset.trim()) {
    return params.date_preset === 'yesterday'
      ? getMetaGraphHistoricalCacheTtlMs()
      : getMetaGraphTodayCacheTtlMs();
  }
  const timeRange = getTimeRangeParam(params);
  if (!timeRange?.until) {
    return getMetaGraphReadCacheTtlMs();
  }
  const today = getMetaAdsDateKey();
  return String(timeRange.until) >= today
    ? getMetaGraphTodayCacheTtlMs()
    : getMetaGraphHistoricalCacheTtlMs();
}

function getMetaGraphReadCacheMaxEntries() {
  return getPositiveInteger(
    process.env.META_ADS_GRAPH_READ_CACHE_MAX_ENTRIES,
    DEFAULT_META_GRAPH_READ_CACHE_MAX_ENTRIES,
  );
}

function getMetaGraphReadCacheVersion() {
  return process.env.META_ADS_GRAPH_READ_CACHE_VERSION || DEFAULT_META_GRAPH_READ_CACHE_VERSION;
}

function getMetaGraphReadCacheKey({ path, params, graphVersion }) {
  const normalizedParams = Object.entries(params ?? {})
    .filter(([, value]) => value != null && value !== '')
    .sort(([left], [right]) => left.localeCompare(right));
  const rawKey = JSON.stringify({
    graphVersion: getMetaGraphVersion(graphVersion),
    path,
    params: normalizedParams,
    version: getMetaGraphReadCacheVersion(),
  });
  return crypto.createHash('sha256').update(rawKey).digest('hex');
}

function getMetaGraphReadStore() {
  if (metaGraphReadStore !== undefined) {
    return metaGraphReadStore;
  }
  try {
    const { standardCache } = require('@librechat/api');
    metaGraphReadStore = standardCache('META_ADS_GRAPH_READS', getMetaGraphReadCacheTtlMs());
  } catch (error) {
    logger.error('[MetaAdsGraph] Redis/shared cache unavailable for Meta reads', {
      message: error.message,
    });
    metaGraphReadStore = null;
  }
  return metaGraphReadStore;
}

async function getCachedMetaGraphRead(cacheKey, ttlMs, { allowStale = false } = {}) {
  const store = getMetaGraphReadStore();
  if (store) {
    try {
      const cached = await store.get(cacheKey);
      if (cached) {
        return cached;
      }
    } catch (error) {
      logger.error('[MetaAdsGraph] Meta read cache get failed', {
        message: error.message,
      });
    }
  }
  const cached = metaGraphReadCache.get(cacheKey);
  if (!cached) {
    return null;
  }
  if (allowStale || Date.now() - cached.createdAt <= ttlMs) {
    return cached.value;
  }
  metaGraphReadCache.delete(cacheKey);
  return null;
}

async function setCachedMetaGraphRead(cacheKey, value, ttlMs) {
  const store = getMetaGraphReadStore();
  if (store) {
    try {
      await store.set(cacheKey, value, ttlMs);
    } catch (error) {
      logger.error('[MetaAdsGraph] Meta read cache set failed', {
        message: error.message,
      });
    }
  }
  metaGraphReadCache.set(cacheKey, {
    createdAt: Date.now(),
    value,
  });
  const maxEntries = getMetaGraphReadCacheMaxEntries();
  while (metaGraphReadCache.size > maxEntries) {
    const oldestKey = metaGraphReadCache.keys().next().value;
    if (!oldestKey) {
      return;
    }
    metaGraphReadCache.delete(oldestKey);
  }
}

function clearMetaGraphReadCacheForTests() {
  metaGraphReadCache.clear();
  metaGraphInflightReads.clear();
  metaGraphAccountQueues.clear();
  metaGraphReadStore = undefined;
}

function drainMetaGraphAccountQueue(accountKey) {
  const queue = metaGraphAccountQueues.get(accountKey);
  if (!queue) {
    return;
  }
  const concurrency = getMetaGraphAccountConcurrency();
  while (queue.active < concurrency && queue.pending.length > 0) {
    const item = queue.pending.shift();
    queue.active += 1;
    logger.debug('[MetaAdsGraph] dequeued Meta request', {
      accountKey,
      resourceLabel: item.resourceLabel,
      pending: queue.pending.length,
      active: queue.active,
    });
    item
      .run()
      .then(item.resolve, item.reject)
      .finally(() => {
        queue.active -= 1;
        if (queue.active === 0 && queue.pending.length === 0) {
          metaGraphAccountQueues.delete(accountKey);
          return;
        }
        drainMetaGraphAccountQueue(accountKey);
      });
  }
}

function runQueuedMetaGraphRead({ path, resourceLabel }, run) {
  const accountKey = getAdAccountIdFromPath(path);
  const queue = metaGraphAccountQueues.get(accountKey) ?? {
    active: 0,
    pending: [],
  };
  metaGraphAccountQueues.set(accountKey, queue);
  return new Promise((resolve, reject) => {
    queue.pending.push({
      resolve,
      reject,
      resourceLabel,
      run,
    });
    logger.debug('[MetaAdsGraph] queued Meta request', {
      accountKey,
      resourceLabel,
      pending: queue.pending.length,
      active: queue.active,
    });
    drainMetaGraphAccountQueue(accountKey);
  });
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
  return Object.assign(new Error(message), {
    ...details,
    statusCode: details.statusCode ?? details.status,
  });
}

function isReduceAmountError(error) {
  return /reduce the amount of data|too much data|requesting too much/i.test(error?.message ?? '');
}

function parseDateKey(value) {
  const match = typeof value === 'string' ? value.match(/^(\d{4})-(\d{2})-(\d{2})$/) : null;
  if (!match) {
    return null;
  }
  const [, year, month, day] = match;
  return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
}

function formatDateKey(date) {
  return date.toISOString().slice(0, 10);
}

function addUtcDays(date, days) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function getInsightDateChunks({ since, until, chunkDays = getMetaInsightsChunkDays() }) {
  const start = parseDateKey(since);
  const end = parseDateKey(until);
  if (!start || !end || start > end) {
    return [];
  }
  const chunks = [];
  let cursor = start;
  while (cursor <= end) {
    const chunkEnd = new Date(Math.min(addUtcDays(cursor, chunkDays - 1).getTime(), end.getTime()));
    chunks.push({
      since: formatDateKey(cursor),
      until: formatDateKey(chunkEnd),
    });
    cursor = addUtcDays(chunkEnd, 1);
  }
  return chunks;
}

function getInsightRowKey(row, level) {
  const dateKey = row.date_start || row.date_stop || '';
  if (level === 'ad') {
    const entityKey =
      row.ad_id || `${row.campaign_id || ''}:${row.adset_id || ''}:${row.ad_name || ''}`;
    return dateKey ? `${dateKey}:${entityKey}` : entityKey;
  }
  if (level === 'adset') {
    const entityKey = row.adset_id || `${row.campaign_id || ''}:${row.adset_name || ''}`;
    return dateKey ? `${dateKey}:${entityKey}` : entityKey;
  }
  const entityKey = row.campaign_id || row.campaign_name || '';
  return dateKey ? `${dateKey}:${entityKey}` : entityKey;
}

function addActionValues(target, values = []) {
  for (const action of Array.isArray(values) ? values : []) {
    const actionType = action?.action_type;
    const value = Number(action?.value ?? 0);
    if (actionType && Number.isFinite(value)) {
      target.set(actionType, Number(target.get(actionType) ?? 0) + value);
    }
  }
}

function aggregateInsightRows(rows, level) {
  const rowsByKey = new Map();
  for (const row of rows) {
    const key = getInsightRowKey(row, level);
    if (!key) {
      continue;
    }
    const current = rowsByKey.get(key) ?? {
      ...row,
      spend: 0,
      impressions: 0,
      reach: 0,
      clicks: 0,
      actions: new Map(),
      actionValues: new Map(),
      videoP75Watched: 0,
      videoThruplays: 0,
      roasWeightedTotal: 0,
      roasWeight: 0,
    };
    const spend = Number(row.spend ?? 0);
    const impressions = Number(row.impressions ?? 0);
    const reach = Number(row.reach ?? 0);
    const clicks = Number(row.clicks ?? 0);
    current.spend += Number.isFinite(spend) ? spend : 0;
    current.impressions += Number.isFinite(impressions) ? impressions : 0;
    current.reach += Number.isFinite(reach) ? reach : 0;
    current.clicks += Number.isFinite(clicks) ? clicks : 0;
    addActionValues(current.actions, row.actions);
    addActionValues(current.actionValues, row.action_values);

    const videoP75 = Array.isArray(row.video_p75_watched_actions)
      ? Number(row.video_p75_watched_actions[0]?.value ?? 0)
      : Number(row.video_p75_watched_actions ?? 0);
    if (Number.isFinite(videoP75)) {
      current.videoP75Watched += videoP75;
    }
    const videoThruplays = Array.isArray(row.video_thruplay_watched_actions)
      ? Number(row.video_thruplay_watched_actions[0]?.value ?? 0)
      : Number(row.video_thruplay_watched_actions ?? 0);
    if (Number.isFinite(videoThruplays)) {
      current.videoThruplays += videoThruplays;
    }

    const roas = Array.isArray(row.purchase_roas)
      ? Number(row.purchase_roas[0]?.value ?? 0)
      : Number(row.purchase_roas ?? 0);
    if (Number.isFinite(roas) && roas > 0 && Number.isFinite(spend) && spend > 0) {
      current.roasWeightedTotal += roas * spend;
      current.roasWeight += spend;
    }
    rowsByKey.set(key, current);
  }

  return Array.from(rowsByKey.values()).map((row) => {
    const actions = Array.from(row.actions.entries()).map(([action_type, value]) => ({
      action_type,
      value,
    }));
    const action_values = Array.from(row.actionValues.entries()).map(([action_type, value]) => ({
      action_type,
      value,
    }));
    const cost_per_action_type = actions
      .filter((action) => Number(action.value) > 0)
      .map((action) => ({
        action_type: action.action_type,
        value: Number((row.spend / Number(action.value)).toFixed(2)),
      }));
    return {
      ...row,
      spend: Number(row.spend.toFixed(2)),
      impressions: Number(row.impressions.toFixed(2)),
      reach: Number(row.reach.toFixed(2)),
      frequency: row.reach > 0 ? Number((row.impressions / row.reach).toFixed(2)) : row.frequency,
      clicks: Number(row.clicks.toFixed(2)),
      ctr: row.impressions > 0 ? Number(((row.clicks / row.impressions) * 100).toFixed(2)) : 0,
      cpc: row.clicks > 0 ? Number((row.spend / row.clicks).toFixed(2)) : 0,
      cpm: row.impressions > 0 ? Number(((row.spend / row.impressions) * 1000).toFixed(2)) : 0,
      actions,
      action_values,
      cost_per_action_type,
      video_p75_watched_actions: [{ value: row.videoP75Watched }],
      video_thruplay_watched_actions: [{ value: row.videoThruplays }],
      purchase_roas:
        row.roasWeight > 0
          ? [{ value: Number((row.roasWeightedTotal / row.roasWeight).toFixed(2)) }]
          : [],
      videoP75Watched: undefined,
      videoThruplays: undefined,
      roasWeightedTotal: undefined,
      roasWeight: undefined,
    };
  });
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
    response = await runQueuedMetaGraphRead({ path, resourceLabel }, () =>
      fetchWithTimeout(
        url.toString(),
        {
          headers: { Authorization: `Bearer ${token}` },
        },
        resourceLabel,
      ),
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

async function metaGetUrl({ url, token, path, graphVersion, resourceLabel }) {
  let response;
  try {
    response = await runQueuedMetaGraphRead({ path, resourceLabel }, () =>
      fetchWithTimeout(
        url,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
        resourceLabel,
      ),
    );
  } catch (error) {
    logger.error('[MetaAdsGraph] Meta paged fetch threw', {
      path,
      graphVersion,
      message: error.message,
      stack: error.stack,
    });
    throw error;
  }
  return readMetaResponse({
    response,
    path,
    graphVersion,
    params: ['paging.next'],
    resourceLabel,
  });
}

async function metaGetPaged({ path, token, params = {}, graphVersion, resourceLabel }) {
  const cacheKey = getMetaGraphReadCacheKey({ path, params, graphVersion });
  const ttlMs = getMetaGraphReadCacheTtlForParams(params);
  const cached = await getCachedMetaGraphRead(cacheKey, ttlMs);
  if (cached) {
    logger.debug('[MetaAdsGraph] Meta read cache hit', {
      path,
      resourceLabel,
    });
    return cached;
  }

  const inflight = metaGraphInflightReads.get(cacheKey);
  if (inflight) {
    logger.debug('[MetaAdsGraph] Meta read joined inflight request', {
      path,
      resourceLabel,
    });
    return inflight;
  }

  logger.debug('[MetaAdsGraph] Meta read cache miss', {
    path,
    resourceLabel,
  });
  const request = (async () => {
    const firstPage = await metaGet({ path, token, params, graphVersion, resourceLabel });
    if (!Array.isArray(firstPage.data)) {
      await setCachedMetaGraphRead(cacheKey, firstPage, ttlMs);
      return firstPage;
    }
    const data = [...firstPage.data];
    let nextUrl = firstPage.paging?.next;
    const maxPages = getMetaGraphMaxPages();
    for (let page = 2; nextUrl && page <= maxPages; page += 1) {
      const pagePayload = await metaGetUrl({
        url: nextUrl,
        token,
        path,
        graphVersion: getMetaGraphVersion(graphVersion),
        resourceLabel,
      });
      if (Array.isArray(pagePayload.data)) {
        data.push(...pagePayload.data);
      }
      nextUrl = pagePayload.paging?.next;
    }
    const payload = {
      ...firstPage,
      data,
      paging: nextUrl ? { ...(firstPage.paging ?? {}), next: nextUrl } : firstPage.paging,
    };
    await setCachedMetaGraphRead(cacheKey, payload, ttlMs);
    return payload;
  })();
  metaGraphInflightReads.set(cacheKey, request);
  try {
    return await request;
  } finally {
    metaGraphInflightReads.delete(cacheKey);
  }
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

async function updateMetaEntityStatus({
  entityId,
  entityLevel = 'ad',
  status,
  token,
  graphVersion,
}) {
  return metaPost({
    path: encodeURIComponent(entityId),
    token,
    graphVersion,
    resourceLabel: `${entityLevel} status update`,
    body: { status },
  });
}

async function updateMetaAdStatus({ adId, status, token, graphVersion }) {
  return updateMetaEntityStatus({
    entityId: adId,
    entityLevel: 'ad',
    status,
    token,
    graphVersion,
  });
}

async function copyMetaEntity({
  entityId,
  entityLevel,
  statusOption = 'INHERITED_FROM_SOURCE',
  deepCopy = true,
  token,
  graphVersion,
}) {
  return metaPost({
    path: `${encodeURIComponent(entityId)}/copies`,
    token,
    graphVersion,
    resourceLabel: `${entityLevel} copy`,
    body: {
      deep_copy: deepCopy,
      status_option: statusOption,
      rename_options: {
        rename_strategy: 'ONLY_TOP_LEVEL',
        rename_prefix: '',
        rename_suffix: ' - cópia',
      },
    },
  });
}

async function updateMetaEntityName({ entityId, entityLevel, name, token, graphVersion }) {
  return metaPost({
    path: encodeURIComponent(entityId),
    token,
    graphVersion,
    resourceLabel: `${entityLevel} name update`,
    body: { name },
  });
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

async function listAdSets({ adAccountId, token, graphVersion, includeInactive = false }) {
  logger.debug('[MetaAdsGraph] listing adsets', { adAccountId, graphVersion });
  const path = `${encodeURIComponent(adAccountId)}/adsets`;
  const params = {
    fields: 'id,name,daily_budget,lifetime_budget,effective_status,campaign_id,campaign{id,name}',
    limit: DEFAULT_LIMIT,
  };
  try {
    const payload = await metaGetPaged({
      path,
      token,
      params,
      graphVersion,
      resourceLabel: 'ad sets',
    });
    if (!Array.isArray(payload.data)) {
      return [];
    }
    return includeInactive
      ? payload.data
      : payload.data.filter((adset) => adset.effective_status === 'ACTIVE');
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

async function listCampaigns({ adAccountId, token, graphVersion, includeInactive = false }) {
  logger.debug('[MetaAdsGraph] listing campaigns', { adAccountId, graphVersion });
  const path = `${encodeURIComponent(adAccountId)}/campaigns`;
  const params = {
    fields: 'id,name,objective,daily_budget,lifetime_budget,effective_status',
    limit: DEFAULT_LIMIT,
  };
  try {
    const payload = await metaGetPaged({
      path,
      token,
      params,
      graphVersion,
      resourceLabel: 'campaigns',
    });
    if (!Array.isArray(payload.data)) {
      return [];
    }
    return includeInactive
      ? payload.data
      : payload.data.filter((campaign) => campaign.effective_status === 'ACTIVE');
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

async function listAds({
  adAccountId,
  adIds = [],
  adSetIds = [],
  token,
  graphVersion,
  includeInactive = false,
}) {
  logger.debug('[MetaAdsGraph] listing ads', {
    adAccountId,
    adCount: Array.isArray(adIds) ? adIds.length : 0,
    adSetCount: Array.isArray(adSetIds) ? adSetIds.length : 0,
    graphVersion,
  });
  const params = {
    fields:
      'id,name,effective_status,adset_id,campaign_id,creative{id,name,title,body,thumbnail_url,image_url,image_hash,video_id,object_story_spec,asset_feed_spec}',
    limit: DEFAULT_LIMIT,
  };
  const normalizedAdIds = Array.isArray(adIds) ? [...new Set(adIds.filter(Boolean))] : [];
  const paths =
    normalizedAdIds.length > 0
      ? normalizedAdIds.map((adId) => encodeURIComponent(adId))
      : Array.isArray(adSetIds) && adSetIds.length > 0
        ? adSetIds.filter(Boolean).map((adSetId) => `${encodeURIComponent(adSetId)}/ads`)
        : [`${encodeURIComponent(adAccountId)}/ads`];
  try {
    const ads = [];
    for (const path of paths) {
      const payload = await metaGetPaged({
        path,
        token,
        params,
        graphVersion,
        resourceLabel: 'ads',
      });
      if (Array.isArray(payload.data)) {
        ads.push(...payload.data);
      } else if (payload?.id) {
        ads.push(payload);
      }
    }
    return includeInactive ? ads : ads.filter((ad) => ad.effective_status === 'ACTIVE');
  } catch (error) {
    const message = formatMetaFetchError({
      resource: 'ads',
      adAccountId,
      path: paths.join(','),
      params,
      error,
    });
    logger.error('[MetaAdsGraph] ads request failed with context', {
      adAccountId,
      paths,
      params: Object.keys(params),
      message: error.message,
      stack: error.stack,
    });
    throw new Error(message);
  }
}

const AD_INSIGHT_FIELDS =
  'campaign_id,campaign_name,adset_id,adset_name,ad_id,ad_name,spend,impressions,reach,frequency,clicks,ctr,cpc,cpm,actions,action_values,cost_per_action_type,video_p75_watched_actions,video_thruplay_watched_actions,purchase_roas';
const ADSET_INSIGHT_FIELDS =
  'campaign_id,campaign_name,adset_id,adset_name,spend,impressions,reach,frequency,clicks,ctr,cpc,cpm,actions,action_values,cost_per_action_type,video_p75_watched_actions,video_thruplay_watched_actions,purchase_roas';
const CAMPAIGN_INSIGHT_FIELDS =
  'campaign_id,campaign_name,spend,impressions,reach,frequency,clicks,ctr,cpc,cpm,actions,action_values,cost_per_action_type,video_p75_watched_actions,video_thruplay_watched_actions,purchase_roas';

async function fetchInsightsPage({
  adAccountId,
  token,
  since,
  until,
  datePreset,
  graphVersion,
  level,
  fields,
  timeIncrement,
}) {
  const path = `${encodeURIComponent(adAccountId)}/insights`;
  const params = {
    level,
    fields,
    limit: DEFAULT_LIMIT,
  };
  if (datePreset) {
    params.date_preset = datePreset;
  } else {
    params.time_range = JSON.stringify({ since, until });
  }
  if (timeIncrement) {
    params.time_increment = timeIncrement;
  }
  const payload = await metaGetPaged({
    path,
    token,
    params,
    graphVersion,
    resourceLabel: `${level} insights`,
  });
  return Array.isArray(payload.data) ? payload.data : [];
}

async function fetchChunkedInsights({
  adAccountId,
  token,
  since,
  until,
  graphVersion,
  level,
  fields,
  timeIncrement,
}) {
  const chunks = getInsightDateChunks({ since, until });
  if (chunks.length <= 1) {
    return fetchInsightsPage({
      adAccountId,
      token,
      since,
      until,
      graphVersion,
      level,
      fields,
      timeIncrement,
    });
  }
  const rows = [];
  for (const chunk of chunks) {
    try {
      rows.push(
        ...(await fetchInsightsPage({
          adAccountId,
          token,
          since: chunk.since,
          until: chunk.until,
          graphVersion,
          level,
          fields,
          timeIncrement,
        })),
      );
    } catch (error) {
      if (!isReduceAmountError(error)) {
        throw error;
      }
      for (const dayChunk of getInsightDateChunks({ ...chunk, chunkDays: 1 })) {
        rows.push(
          ...(await fetchInsightsPage({
            adAccountId,
            token,
            since: dayChunk.since,
            until: dayChunk.until,
            graphVersion,
            level,
            fields,
            timeIncrement,
          })),
        );
      }
    }
  }
  return aggregateInsightRows(rows, level);
}

async function listInsights({
  adAccountId,
  token,
  since,
  until,
  datePreset,
  graphVersion,
  level,
  fields,
  timeIncrement,
}) {
  const path = `${encodeURIComponent(adAccountId)}/insights`;
  const params = {
    level,
    fields,
    limit: DEFAULT_LIMIT,
  };
  if (datePreset) {
    params.date_preset = datePreset;
  } else {
    params.time_range = JSON.stringify({ since, until });
  }
  if (timeIncrement) {
    params.time_increment = timeIncrement;
  }
  try {
    return await fetchInsightsPage({
      adAccountId,
      token,
      since,
      until,
      datePreset,
      graphVersion,
      level,
      fields,
      timeIncrement,
    });
  } catch (error) {
    if (!datePreset && isReduceAmountError(error)) {
      logger.error('[MetaAdsGraph] retrying insights request in date chunks', {
        adAccountId,
        level,
        since,
        until,
        message: error.message,
      });
      try {
        return await fetchChunkedInsights({
          adAccountId,
          token,
          since,
          until,
          graphVersion,
          level,
          fields,
          timeIncrement,
        });
      } catch (chunkError) {
        error = chunkError;
      }
    }
    const message = formatMetaFetchError({
      resource: `${level} insights`,
      adAccountId,
      path,
      params,
      error,
    });
    logger.error('[MetaAdsGraph] insights request failed with context', {
      adAccountId,
      path,
      level,
      since,
      until,
      params: Object.keys(params),
      message: error.message,
      stack: error.stack,
    });
    throw new Error(message);
  }
}

async function listAdInsights({
  adAccountId,
  token,
  since,
  until,
  datePreset,
  graphVersion,
  timeIncrement,
}) {
  logger.debug('[MetaAdsGraph] listing ad insights', {
    adAccountId,
    since,
    until,
    datePreset,
    graphVersion,
  });
  return listInsights({
    adAccountId,
    token,
    since,
    until,
    datePreset,
    graphVersion,
    level: 'ad',
    fields: AD_INSIGHT_FIELDS,
    timeIncrement,
  });
}

async function listCampaignInsights({
  adAccountId,
  token,
  since,
  until,
  datePreset,
  graphVersion,
  timeIncrement,
}) {
  logger.debug('[MetaAdsGraph] listing campaign insights', {
    adAccountId,
    since,
    until,
    datePreset,
    graphVersion,
  });
  return listInsights({
    adAccountId,
    token,
    since,
    until,
    datePreset,
    graphVersion,
    level: 'campaign',
    fields: CAMPAIGN_INSIGHT_FIELDS,
    timeIncrement,
  });
}

async function listAdSetInsights({
  adAccountId,
  token,
  since,
  until,
  datePreset,
  graphVersion,
  timeIncrement,
}) {
  logger.debug('[MetaAdsGraph] listing insights', { adAccountId, since, until, graphVersion });
  return listInsights({
    adAccountId,
    token,
    since,
    until,
    datePreset,
    graphVersion,
    level: 'adset',
    fields: ADSET_INSIGHT_FIELDS,
    timeIncrement,
  });
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
  copyMetaEntity,
  updateMetaEntityName,
  updateMetaEntityStatus,
  updateMetaAdStatus,
  clearMetaGraphReadCacheForTests,
};
