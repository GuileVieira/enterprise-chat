const { Tool } = require('@librechat/agents/langchain/tools');
const { PermissionBits } = require('librechat-data-provider');
const {
  findProjectForRequest,
  userCanAccessProject,
} = require('~/server/services/Projects/access');
const { resolveMetaAccessToken } = require('~/server/services/MetaAds/budget');
const {
  DEFAULT_META_GRAPH_VERSION,
  getMetaGraphVersion,
  metaGet,
} = require('~/server/services/MetaAds/graph');

const META_GRAPH_VERSION_PATTERN = /^v[1-9]\d?\.0$/;
const META_INSIGHTS_FIELDS = 'ad_name,spend,cpm,ctr,cpc,actions,action_values,purchase_roas';
const META_ACTIVE_AD_FILTERING = JSON.stringify([
  { field: 'ad.delivery_info', operator: 'IN', values: ['ACTIVE'] },
]);
const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;
const DEFAULT_MAX_PAGES = 3;
const MAX_PAGES = 10;
const MAX_DATE_RANGE_DAYS = 120;

const metaAdsGetInsightsJsonSchema = {
  type: 'object',
  properties: {
    ad_account_id: {
      type: 'string',
      description: 'Meta ad account id in act_<number> format.',
    },
    since: {
      type: 'string',
      description: 'Start date in YYYY-MM-DD format.',
    },
    until: {
      type: 'string',
      description: 'End date in YYYY-MM-DD format.',
    },
    limit: {
      type: 'integer',
      minimum: 1,
      maximum: MAX_LIMIT,
      description: `Rows per Meta page. Defaults to ${DEFAULT_LIMIT}.`,
    },
    max_pages: {
      type: 'integer',
      minimum: 1,
      maximum: MAX_PAGES,
      description: `Maximum pages to fetch. Defaults to ${DEFAULT_MAX_PAGES}.`,
    },
    after: {
      type: 'string',
      description: 'Optional Meta cursor for continuing a previous paginated request.',
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
  required: ['ad_account_id', 'since', 'until'],
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

function extractNextAfter(payload) {
  const after = payload?.paging?.cursors?.after;
  return typeof after === 'string' && after.length > 0 ? after : undefined;
}

class MetaAdsGetInsights extends Tool {
  name = 'meta_ads_get_insights';
  description =
    'Read-only Meta Graph API tool for active ad-level insights. ' +
    'Requires an accessible project with Meta Ads credentials. ' +
    'Always queries active ads with fields ad_name, spend, cpm, ctr, cpc, actions, action_values, purchase_roas.';

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
    if (projectAdAccountId !== adAccountId) {
      throw new Error('ad_account_id does not match the project Meta Ads account.');
    }
    return project;
  }

  async getAccessToken(projectId, adAccountId) {
    if (!this.tenantId || typeof this.getTenantSecret !== 'function') {
      throw new Error('Tenant context is required for Meta Ads insights.');
    }
    const project = await this.getProject(projectId, adAccountId);
    const credentials = await resolveMetaAccessToken({
      tenantId: this.tenantId,
      metaAds: project.metaAds ?? {},
      getSecret: this.getTenantSecret,
    });
    return credentials.accessToken;
  }

  async fetchPage({ accessToken, graphVersion, adAccountId, since, until, limit, after }) {
    const params = {
      level: 'ad',
      filtering: META_ACTIVE_AD_FILTERING,
      fields: META_INSIGHTS_FIELDS,
      time_range: JSON.stringify({ since, until }),
      limit,
      ...(after ? { after } : {}),
    };
    const payload = await metaGet({
      path: `${encodeURIComponent(adAccountId)}/insights`,
      token: accessToken,
      params,
      graphVersion,
      resourceLabel: 'ad insights',
    });
    return {
      ok: true,
      status: 200,
      data: Array.isArray(payload?.data) ? payload.data : [],
      nextAfter: extractNextAfter(payload),
    };
  }

  async _call(args) {
    try {
      const adAccountId = args.ad_account_id;
      const { since, until } = args;
      validateAdAccountId(adAccountId);
      validateDateRange(since, until);

      const limit = parsePositiveInteger(args.limit, DEFAULT_LIMIT, MAX_LIMIT);
      const maxPages = parsePositiveInteger(args.max_pages, DEFAULT_MAX_PAGES, MAX_PAGES);
      const graphVersion = parseGraphVersion(args.graph_version);
      let nextAfter =
        typeof args.after === 'string' && args.after.length > 0 ? args.after : undefined;
      const projectId =
        typeof args.project_id === 'string' && args.project_id ? args.project_id : this.projectId;
      const accessToken = await this.getAccessToken(projectId, adAccountId);
      const data = [];
      let status = 200;
      let pagesFetched = 0;

      while (pagesFetched < maxPages) {
        const page = await this.fetchPage({
          accessToken,
          graphVersion,
          adAccountId,
          since,
          until,
          limit,
          after: nextAfter,
        });
        if (!page.ok) {
          return JSON.stringify(page);
        }
        status = page.status;
        pagesFetched += 1;
        data.push(...page.data);
        nextAfter = page.nextAfter;
        if (!nextAfter) {
          break;
        }
      }

      return JSON.stringify({
        ok: true,
        status,
        accountId: adAccountId,
        graphVersion,
        since,
        until,
        level: 'ad',
        rows: data.length,
        pagesFetched,
        hasMore: Boolean(nextAfter),
        nextAfter,
        data,
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
