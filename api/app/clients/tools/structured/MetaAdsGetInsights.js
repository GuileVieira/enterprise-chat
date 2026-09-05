const { Tool } = require('@librechat/agents/langchain/tools');
const {
  Permissions,
  SystemRoles,
  PermissionBits,
  PermissionTypes,
} = require('librechat-data-provider');
const { getRoleByName } = require('~/models');
const {
  findProjectForRequest,
  userCanAccessProject,
} = require('~/server/services/Projects/access');
const {
  resolveMetaAccessToken,
  withImplicitProjectTokenSecret,
} = require('~/server/services/MetaAds/budget');
const {
  DEFAULT_META_GRAPH_VERSION,
  getMetaGraphVersion,
  metaGet,
} = require('~/server/services/MetaAds/graph');
const { DEFAULT_METRICS, METRICS, createInsightsSummary } = require('./metaAdsInsightsSummary');

const META_GRAPH_VERSION_PATTERN = /^v[1-9]\d?\.0$/;
const DEFAULT_META_INSIGHT_LEVEL = 'ad';
const META_INSIGHT_LEVELS = ['campaign', 'adset', 'ad'];
const META_IDENTITY_FIELDS_BY_LEVEL = {
  campaign: ['campaign_id', 'campaign_name'],
  adset: ['campaign_id', 'campaign_name', 'adset_id', 'adset_name'],
  ad: ['campaign_id', 'campaign_name', 'adset_id', 'adset_name', 'ad_id', 'ad_name'],
};
const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;
const MAX_INTERNAL_PAGES = 1000;
const MAX_DATE_RANGE_DAYS = 120;
const META_AD_IDS_BATCH_SIZE = 50;
const META_CUSTOM_CONVERSION_PREFIX = 'offsite_conversion.custom.';
const DEFAULT_DETAIL_LIMIT = 25;
const MAX_DETAIL_LIMIT = 100;
const META_ADS_SYSTEM_ROLES = new Set([
  SystemRoles.ADMIN,
  SystemRoles.OWNER,
  SystemRoles.AD_MANAGER,
]);

const metaAdsGetInsightsJsonSchema = {
  type: 'object',
  properties: {
    ad_account_id: {
      type: 'string',
      description:
        'Optional Meta ad account id in act_<number> format. Defaults to the configured project account.',
    },
    since: {
      type: 'string',
      description: 'Start date in YYYY-MM-DD format.',
    },
    until: {
      type: 'string',
      description: 'End date in YYYY-MM-DD format.',
    },
    level: {
      type: 'string',
      enum: META_INSIGHT_LEVELS,
      description:
        'Insight aggregation level. Use campaign for campaigns, adset for ad sets, or ad for ads. Defaults to ad.',
    },
    limit: {
      type: 'integer',
      minimum: 1,
      maximum: MAX_LIMIT,
      description: `Rows per Meta page. Defaults to ${DEFAULT_LIMIT}.`,
    },
    metrics: {
      type: 'array',
      items: { type: 'string', enum: METRICS },
      description:
        'Metrics needed for the analysis. Defaults to delivery, conversions, conversion value, and purchase ROAS.',
    },
    sort_by: {
      type: 'string',
      enum: METRICS,
      description: 'Metric used to sort summary tables. Defaults to spend.',
    },
    sort_order: {
      type: 'string',
      enum: ['asc', 'desc'],
      description: 'Summary sort direction. Defaults to desc.',
    },
    detail_limit: {
      type: 'integer',
      minimum: 1,
      maximum: MAX_DETAIL_LIMIT,
      description: `Rows returned per summary table. Defaults to ${DEFAULT_DETAIL_LIMIT}.`,
    },
    breakdown: {
      type: 'string',
      enum: ['none', 'day', 'region', 'country'],
      description:
        'Optional detail breakdown: day for daily trends, region or country for geographic impact and investment analysis.',
    },
    campaign_id: {
      type: 'string',
      description: 'Optional campaign drill-down filter.',
    },
    adset_id: {
      type: 'string',
      description: 'Optional ad set drill-down filter.',
    },
    ad_id: {
      type: 'string',
      description: 'Optional ad drill-down filter.',
    },
    graph_version: {
      type: 'string',
      description: `Optional Meta Graph API version. Defaults to ${DEFAULT_META_GRAPH_VERSION}.`,
    },
    project_id: {
      type: 'string',
      description:
        'Optional project id. Defaults to the active conversation project. Required through either source; the project controls access to Meta Ads credentials.',
    },
  },
  required: ['since', 'until'],
};

function parsePositiveInteger(value, defaultValue, maxValue) {
  if (value === undefined || value === null) {
    return defaultValue;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error('Expected a positive integer.');
  }
  return Math.min(parsed, maxValue);
}

function parseDateOnly(value, fieldName) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${fieldName} must use YYYY-MM-DD format.`);
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new Error(`${fieldName} must be a valid date.`);
  }
  return date;
}

function validateDateRange(since, until) {
  const sinceDate = parseDateOnly(since, 'since');
  const untilDate = parseDateOnly(until, 'until');
  if (sinceDate > untilDate) {
    throw new Error('since must be before or equal to until.');
  }
  const rangeDays = Math.floor((untilDate.getTime() - sinceDate.getTime()) / 86400000) + 1;
  if (rangeDays > MAX_DATE_RANGE_DAYS) {
    throw new Error(`Date range cannot exceed ${MAX_DATE_RANGE_DAYS} days.`);
  }
}

function validateAdAccountId(adAccountId) {
  if (typeof adAccountId !== 'string' || !/^act_\d+$/.test(adAccountId)) {
    throw new Error('ad_account_id must use act_<number> format.');
  }
}

function normalizeAdAccountId(adAccountId) {
  if (typeof adAccountId !== 'string') {
    return '';
  }
  const digits = adAccountId.replace(/^act_/i, '').replace(/\D/g, '');
  return digits ? `act_${digits}` : '';
}

function parseGraphVersion(value) {
  if (value === undefined || value === null || value === '') {
    return getMetaGraphVersion();
  }
  if (typeof value !== 'string' || !META_GRAPH_VERSION_PATTERN.test(value)) {
    throw new Error('graph_version must match Meta Graph API version format like v25.0.');
  }
  return getMetaGraphVersion(value);
}

function parseInsightLevel(value) {
  if (value === undefined || value === null || value === '') {
    return DEFAULT_META_INSIGHT_LEVEL;
  }
  if (!META_INSIGHT_LEVELS.includes(value)) {
    throw new Error('level must be one of campaign, adset, or ad.');
  }
  return value;
}

function parseMetrics(value) {
  if (value === undefined || value === null) {
    return DEFAULT_METRICS;
  }
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.some((metric) => !METRICS.includes(metric))
  ) {
    throw new Error(`metrics must contain only: ${METRICS.join(', ')}.`);
  }
  return [...new Set(value)];
}

function parseEnum(value, values, defaultValue, fieldName) {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }
  if (!values.includes(value)) {
    throw new Error(`${fieldName} must be one of ${values.join(', ')}.`);
  }
  return value;
}

function buildFiltering(args) {
  return [
    ['campaign.id', args.campaign_id],
    ['adset.id', args.adset_id],
    ['ad.id', args.ad_id],
  ]
    .filter(([, value]) => typeof value === 'string' && value.length > 0)
    .map(([field, value]) => ({ field, operator: 'EQUAL', value }));
}

function buildFields(level, metrics, breakdown) {
  const fields = new Set(META_IDENTITY_FIELDS_BY_LEVEL[level]);
  for (const metric of metrics) {
    if (['frequency', 'cpm', 'ctr', 'cpc'].includes(metric)) {
      fields.add('spend');
      fields.add('impressions');
      fields.add('reach');
      fields.add('clicks');
    } else {
      fields.add(metric);
    }
  }
  if (breakdown === 'day') {
    fields.add('date_start');
  } else if (['region', 'country'].includes(breakdown)) {
    fields.add(breakdown);
  }
  return [...fields].join(',');
}

function extractNextAfter(payload) {
  const after = payload?.paging?.cursors?.after;
  return typeof after === 'string' && after.length > 0 ? after : undefined;
}

class MetaAdsGetInsights extends Tool {
  name = 'meta_ads_get_insights';
  description =
    'Read-only Meta Graph API tool for campaign, ad set, or ad-level insights. ' +
    'Requires an accessible project with Meta Ads credentials. ' +
    'Defaults to the configured project ad account and supports level campaign, adset, or ad. ' +
    'Returns the same performance fields used by the project Meta Ads panel: spend, impressions, reach, frequency, clicks, CPM, CTR, CPC, actions, cost per action, video 75%, ThruPlay, and ROAS. ' +
    'Custom conversion action IDs are resolved in actionDefinitions so named payment events such as PIX or paid boleto remain identifiable. ' +
    'In Orqest, use actions.link_click as the Instagram profile visit result metric. ' +
    'Use video_thruplay_watched_actions for ThruPlay; never substitute actions.video_view, which is a 3-second video view. ' +
    'For ad or creative questions, always use level ad: campaign and ad set rows are not creative substitutes. ' +
    'Use breakdown region or country to compare geographic impact, delivery, and investment. ' +
    'Fetches every Meta page internally, then returns totals before bounded campaign, ad set, ad, and optional daily summary tables. ' +
    'Use campaign_id, adset_id, or ad_id for drill-down; omitted counts indicate more details are available.';

  schema = metaAdsGetInsightsJsonSchema;

  static get jsonSchema() {
    return metaAdsGetInsightsJsonSchema;
  }

  constructor(fields = {}) {
    super();
    this.req = fields.req;
    this.tenantId = fields.tenantId;
    this.getTenantSecret = fields.getTenantSecret;
    this.projectId = fields.projectId;
  }

  async requireMetaAdsAccess() {
    const roleName = this.req?.user?.role;
    if (!roleName) {
      throw new Error('Insufficient Meta Ads permissions.');
    }
    if (META_ADS_SYSTEM_ROLES.has(roleName)) {
      return;
    }
    const role = await getRoleByName(roleName);
    if (role?.permissions?.[PermissionTypes.META_ADS]?.[Permissions.USE] !== true) {
      throw new Error('Insufficient Meta Ads permissions.');
    }
  }

  async getProject(projectId, adAccountId) {
    if (!projectId) {
      throw new Error('Project context is required for Meta Ads insights.');
    }
    if (!this.req?.user) {
      throw new Error('User context is required for project Meta Ads credentials.');
    }
    const project = await findProjectForRequest({ projectId, user: this.req.user });
    if (!project) {
      throw new Error('Project not found.');
    }
    const hasAccess = await userCanAccessProject({
      req: this.req,
      project,
      requiredPermission: PermissionBits.VIEW,
    });
    if (!hasAccess) {
      throw new Error('Project access denied.');
    }
    const projectAdAccountId = normalizeAdAccountId(project.metaAds?.adAccountId);
    if (!projectAdAccountId) {
      throw new Error('Project Meta Ads account is not configured.');
    }
    if (adAccountId && projectAdAccountId !== adAccountId) {
      throw new Error('ad_account_id does not match the project Meta Ads account.');
    }
    return { project, adAccountId: projectAdAccountId };
  }

  async getAccessToken(projectId, adAccountId) {
    if (!this.tenantId || typeof this.getTenantSecret !== 'function') {
      throw new Error('Tenant context is required for Meta Ads insights.');
    }
    const { project, adAccountId: resolvedAdAccountId } = await this.getProject(
      projectId,
      adAccountId,
    );
    const metaAds = withImplicitProjectTokenSecret(
      project.projectId || projectId,
      project.metaAds ?? {},
    );
    const credentials = await resolveMetaAccessToken({
      tenantId: this.tenantId,
      metaAds,
      getSecret: this.getTenantSecret,
    });
    return { accessToken: credentials.accessToken, adAccountId: resolvedAdAccountId };
  }

  async fetchPage({
    accessToken,
    graphVersion,
    adAccountId,
    since,
    until,
    level,
    limit,
    after,
    fields,
    filtering,
    breakdown,
  }) {
    const params = {
      level,
      fields,
      time_range: JSON.stringify({ since, until }),
      limit,
      ...(filtering.length > 0 ? { filtering: JSON.stringify(filtering) } : {}),
      ...(breakdown === 'day' ? { time_increment: 1 } : {}),
      ...(['region', 'country'].includes(breakdown) ? { breakdowns: breakdown } : {}),
      ...(after ? { after } : {}),
    };
    const payload = await metaGet({
      path: `${encodeURIComponent(adAccountId)}/insights`,
      token: accessToken,
      params,
      graphVersion,
      resourceLabel: `${level} insights`,
    });
    return {
      ok: true,
      status: 200,
      data: Array.isArray(payload?.data) ? payload.data : [],
      nextAfter: extractNextAfter(payload),
    };
  }

  async getCreativeDetails({ accessToken, graphVersion, adIds }) {
    const details = new Map();
    for (let index = 0; index < adIds.length; index += META_AD_IDS_BATCH_SIZE) {
      const ids = adIds.slice(index, index + META_AD_IDS_BATCH_SIZE);
      const payload = await metaGet({
        path: '',
        token: accessToken,
        params: {
          ids: ids.join(','),
          fields: 'id,name,creative{id,name}',
        },
        graphVersion,
        resourceLabel: 'ad creative details',
      });
      for (const ad of Object.values(payload ?? {})) {
        if (ad && typeof ad.id === 'string') {
          details.set(ad.id, ad);
        }
      }
    }
    return details;
  }

  async getCustomConversionDetails({ accessToken, graphVersion, actionTypes }) {
    const details = {};
    const unresolvedActionTypes = [];
    const errors = [];
    const actionTypeById = new Map();
    for (const actionType of actionTypes) {
      if (!actionType.startsWith(META_CUSTOM_CONVERSION_PREFIX)) {
        continue;
      }
      const id = actionType.slice(META_CUSTOM_CONVERSION_PREFIX.length);
      if (!/^\d+$/.test(id)) {
        unresolvedActionTypes.push(actionType);
        errors.push(`Invalid custom conversion action type: ${actionType}.`);
        continue;
      }
      actionTypeById.set(id, actionType);
    }
    const ids = [...actionTypeById.keys()];
    for (let index = 0; index < ids.length; index += META_AD_IDS_BATCH_SIZE) {
      const batch = ids.slice(index, index + META_AD_IDS_BATCH_SIZE);
      try {
        const payload = await metaGet({
          path: '',
          token: accessToken,
          params: {
            ids: batch.join(','),
            fields: 'id,name,custom_event_type,description,rule,event_source_id',
          },
          graphVersion,
          resourceLabel: 'custom conversion details',
        });
        for (const id of batch) {
          const actionType = actionTypeById.get(id);
          const conversion = payload?.[id];
          const name = typeof conversion?.name === 'string' ? conversion.name.trim() : '';
          if (!conversion || String(conversion.id ?? '') !== id || !name) {
            unresolvedActionTypes.push(actionType);
            const reason =
              conversion?.error?.message || `Custom conversion ${id} has no usable name.`;
            errors.push(reason);
            continue;
          }
          details[actionType] = { ...conversion, name };
        }
      } catch (error) {
        unresolvedActionTypes.push(...batch.map((id) => actionTypeById.get(id)));
        errors.push(error instanceof Error ? error.message : 'Custom conversion lookup failed.');
      }
    }
    return {
      details,
      unresolvedActionTypes: [...new Set(unresolvedActionTypes)],
      errors: [...new Set(errors)],
    };
  }

  async _call(args) {
    try {
      const adAccountId =
        typeof args.ad_account_id === 'string' && args.ad_account_id ? args.ad_account_id : '';
      const { since, until } = args;
      await this.requireMetaAdsAccess();
      if (adAccountId) {
        validateAdAccountId(adAccountId);
      }
      validateDateRange(since, until);

      const limit = parsePositiveInteger(args.limit, DEFAULT_LIMIT, MAX_LIMIT);
      const level = parseInsightLevel(args.level);
      const metrics = parseMetrics(args.metrics);
      const sortBy = parseEnum(
        args.sort_by,
        metrics,
        metrics.includes('spend') ? 'spend' : metrics[0],
        'sort_by',
      );
      const sortOrder = parseEnum(args.sort_order, ['asc', 'desc'], 'desc', 'sort_order');
      const detailLimit = parsePositiveInteger(
        args.detail_limit,
        DEFAULT_DETAIL_LIMIT,
        MAX_DETAIL_LIMIT,
      );
      const breakdown = parseEnum(
        args.breakdown,
        ['none', 'day', 'region', 'country'],
        'none',
        'breakdown',
      );
      const filtering = buildFiltering(args);
      const fields = buildFields(level, metrics, breakdown);
      const graphVersion = parseGraphVersion(args.graph_version);
      let nextAfter;
      const projectId =
        typeof args.project_id === 'string' && args.project_id ? args.project_id : this.projectId;
      const metaAccess = await this.getAccessToken(projectId, adAccountId);
      const summary = createInsightsSummary({
        level,
        metrics,
        sortBy,
        sortOrder,
        detailLimit,
        breakdown,
      });
      const seenCursors = new Set();
      let status = 200;
      let pagesFetched = 0;

      while (pagesFetched < MAX_INTERNAL_PAGES) {
        const page = await this.fetchPage({
          accessToken: metaAccess.accessToken,
          graphVersion,
          adAccountId: metaAccess.adAccountId,
          since,
          until,
          level,
          limit,
          after: nextAfter,
          fields,
          filtering,
          breakdown,
        });
        if (!page.ok) {
          return JSON.stringify(page);
        }
        status = page.status;
        pagesFetched += 1;
        summary.add(page.data);
        nextAfter = page.nextAfter;
        if (!nextAfter) {
          break;
        }
        if (seenCursors.has(nextAfter)) {
          throw new Error('Meta pagination returned a repeated cursor.');
        }
        seenCursors.add(nextAfter);
      }

      if (nextAfter) {
        throw new Error(`Meta pagination exceeded ${MAX_INTERNAL_PAGES} pages.`);
      }

      const result = summary.build();
      const actionTypes = [
        ...Object.keys(result.totals.actions ?? {}),
        ...Object.keys(result.totals.action_values ?? {}),
      ];
      let actionDefinitions = {};
      let unresolvedActionDefinitions = [];
      let actionDefinitionsError;
      try {
        const customConversions = await this.getCustomConversionDetails({
          accessToken: metaAccess.accessToken,
          graphVersion,
          actionTypes: [...new Set(actionTypes)],
        });
        actionDefinitions = customConversions.details;
        unresolvedActionDefinitions = customConversions.unresolvedActionTypes;
        actionDefinitionsError = customConversions.errors.join(' ') || undefined;
      } catch (error) {
        unresolvedActionDefinitions = actionTypes.filter((actionType) =>
          actionType.startsWith(META_CUSTOM_CONVERSION_PREFIX),
        );
        actionDefinitionsError =
          error instanceof Error ? error.message : 'Custom conversion lookup failed.';
      }
      if (level === 'ad') {
        const adIds = result.tables.ad.map((row) => row.ad_id).filter(Boolean);
        if (adIds.length > 0) {
          const creativeDetails = await this.getCreativeDetails({
            accessToken: metaAccess.accessToken,
            graphVersion,
            adIds,
          });
          for (const row of result.tables.ad) {
            const ad = creativeDetails.get(row?.ad_id);
            if (!ad) {
              continue;
            }
            row.ad_name = ad.name || row.ad_name;
            if (ad.creative?.id) {
              row.creative_id = ad.creative.id;
            }
            if (ad.creative?.name) {
              row.creative_name = ad.creative.name;
            }
          }
        }
      }

      return JSON.stringify({
        ok: true,
        status,
        accountId: metaAccess.adAccountId,
        graphVersion,
        since,
        until,
        level,
        breakdown,
        rowsProcessed: result.processedRows,
        pagesFetched,
        metrics,
        sort: { by: sortBy, order: sortOrder },
        filters: Object.fromEntries(
          [
            ['campaign_id', args.campaign_id],
            ['adset_id', args.adset_id],
            ['ad_id', args.ad_id],
          ].filter(([, value]) => typeof value === 'string' && value.length > 0),
        ),
        totals: result.totals,
        actionDefinitions,
        ...(unresolvedActionDefinitions.length > 0 ? { unresolvedActionDefinitions } : {}),
        ...(actionDefinitionsError ? { actionDefinitionsError } : {}),
        tables: result.tables,
        details: {
          available: result.available,
          returned: Object.fromEntries(
            Object.entries(result.tables).map(([name, rows]) => [name, rows.length]),
          ),
          omitted: result.omitted,
          hasMore: result.hasMoreDetails,
          hint: result.hasMoreDetails
            ? 'Use campaign_id, adset_id, or ad_id to drill down without reloading the whole account.'
            : undefined,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Meta Ads insights request failed.';
      const payload = {
        ok: false,
        ...(typeof error.status === 'number' ? { status: error.status } : {}),
        error: {
          message,
          ...(error.data ? { data: error.data } : {}),
        },
      };
      return JSON.stringify(payload);
    }
  }
}

module.exports = MetaAdsGetInsights;
