const fetch = require('node-fetch');
const MetaAdsGetInsights = require('../MetaAdsGetInsights');
const {
  findProjectForRequest,
  userCanAccessProject,
} = require('~/server/services/Projects/access');

jest.mock('node-fetch', () => jest.fn());
jest.mock('~/server/services/Projects/access', () => ({
  findProjectForRequest: jest.fn(),
  userCanAccessProject: jest.fn(),
}));

const getTenantSecret = jest.fn();

function createTool(fields = {}) {
  return new MetaAdsGetInsights({
    req: {
      user: {
        id: 'user-x',
        tenantId: 'tenant-x',
        role: 'USER',
      },
    },
    tenantId: 'tenant-x',
    getTenantSecret,
    projectId: 'project-1',
    ...fields,
  });
}

function createResponse(data, ok = true, status = 200) {
  return {
    ok,
    status,
    text: async () => JSON.stringify(data),
  };
}

describe('MetaAdsGetInsights', () => {
  it('documents link_click as the Orqest Instagram profile visit metric', () => {
    expect(new MetaAdsGetInsights().description).toContain(
      'use actions.link_click as the Instagram profile visit result metric',
    );
  });

  beforeEach(() => {
    jest.clearAllMocks();
    getTenantSecret.mockImplementation(async (tenantId, name) => {
      if (name === 'project-secret') {
        return { tenantId, name, type: 'bearer', value: 'project-token' };
      }
      if (name === 'meta_graph_access_token') {
        return { tenantId, name, type: 'bearer', value: 'meta-token' };
      }
      return null;
    });
    findProjectForRequest.mockResolvedValue({
      _id: 'project-mongo-1',
      projectId: 'project-1',
      tenantId: 'tenant-x',
      metaAds: { adAccountId: 'act_123' },
    });
    userCanAccessProject.mockResolvedValue(true);
    fetch.mockResolvedValue(
      createResponse({
        data: [
          {
            ad_name: 'Ad 1',
            spend: '10.00',
            reach: '900',
            video_thruplay_watched_actions: [{ value: '300' }],
          },
        ],
      }),
    );
  });

  it('forces Meta Graph insight params and project-scoped tenant bearer auth', async () => {
    const result = await createTool().call({
      ad_account_id: 'act_123',
      since: '2026-05-01',
      until: '2026-05-07',
    });

    expect(findProjectForRequest).toHaveBeenCalledWith({
      projectId: 'project-1',
      user: expect.objectContaining({ id: 'user-x' }),
    });
    expect(userCanAccessProject).toHaveBeenCalled();
    expect(getTenantSecret).toHaveBeenCalledWith(
      'tenant-x',
      'meta_graph_access_token_project_project-1',
    );
    expect(getTenantSecret).toHaveBeenCalledWith('tenant-x', 'meta_graph_access_token');
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('https://graph.facebook.com/v25.0/act_123/insights'),
      expect.objectContaining({
        headers: { Authorization: 'Bearer meta-token' },
      }),
    );

    const url = new URL(fetch.mock.calls[0][0]);
    expect(url.searchParams.get('level')).toBe('ad');
    expect(url.searchParams.get('fields')).toBe(
      'campaign_id,campaign_name,adset_id,adset_name,ad_id,ad_name,spend,impressions,reach,clicks',
    );
    expect(url.searchParams.get('filtering')).toBeNull();
    expect(JSON.parse(url.searchParams.get('time_range'))).toEqual({
      since: '2026-05-01',
      until: '2026-05-07',
    });

    expect(JSON.parse(result)).toEqual(
      expect.objectContaining({
        ok: true,
        status: 200,
        accountId: 'act_123',
        rowsProcessed: 1,
        pagesFetched: 1,
        totals: expect.objectContaining({ spend: 10, reach: 900 }),
        tables: expect.objectContaining({
          ad: [expect.objectContaining({ ad_name: 'Ad 1', spend: 10, reach: 900 })],
        }),
      }),
    );
  });

  it('does not filter ad insights by current delivery status', async () => {
    await createTool().call({
      ad_account_id: 'act_123',
      since: '2026-05-01',
      until: '2026-05-07',
    });

    const filtering = new URL(fetch.mock.calls[0][0]).searchParams.get('filtering');
    expect(filtering).toBeNull();
  });

  it('enriches ad-level insights with the real ad and creative identifiers', async () => {
    fetch
      .mockResolvedValueOnce(
        createResponse({ data: [{ ad_id: 'ad-1', ad_name: 'Insight name', spend: '10.00' }] }),
      )
      .mockResolvedValueOnce(
        createResponse({
          'ad-1': {
            id: 'ad-1',
            name: 'Real ad name',
            creative: { id: 'creative-1', name: 'Real creative' },
          },
        }),
      );

    const result = JSON.parse(
      await createTool().call({ since: '2026-05-01', until: '2026-05-07' }),
    );

    expect(result.tables.ad).toEqual([
      {
        ad_id: 'ad-1',
        ad_name: 'Real ad name',
        creative_id: 'creative-1',
        creative_name: 'Real creative',
        spend: 10,
        impressions: 0,
        reach: 0,
        clicks: 0,
        frequency: 0,
        cpm: 0,
        ctr: 0,
        cpc: 0,
      },
    ]);
    const url = new URL(fetch.mock.calls[1][0]);
    expect(url.pathname).toBe('/v25.0/');
    expect(url.searchParams.get('ids')).toBe('ad-1');
    expect(url.searchParams.get('fields')).toBe('id,name,creative{id,name}');
  });

  it('uses the configured project ad account when ad_account_id is omitted', async () => {
    const result = await createTool().call({
      since: '2026-05-01',
      until: '2026-05-07',
    });

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('https://graph.facebook.com/v25.0/act_123/insights'),
      expect.any(Object),
    );
    expect(JSON.parse(result)).toEqual(expect.objectContaining({ ok: true, accountId: 'act_123' }));
  });

  it('uses the implicit project-local token secret before the tenant token', async () => {
    getTenantSecret.mockImplementation(async (tenantId, name) => {
      if (name === 'meta_graph_access_token_project_project-1') {
        return { tenantId, name, type: 'bearer', value: 'project-token' };
      }
      return null;
    });

    await createTool().call({
      since: '2026-05-01',
      until: '2026-05-07',
    });

    expect(getTenantSecret).toHaveBeenCalledWith(
      'tenant-x',
      'meta_graph_access_token_project_project-1',
    );
    expect(getTenantSecret).not.toHaveBeenCalledWith('tenant-x', 'meta_graph_access_token');
    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: { Authorization: 'Bearer project-token' },
      }),
    );
  });

  it('falls back to the tenant token when the implicit project token is missing', async () => {
    await createTool().call({
      since: '2026-05-01',
      until: '2026-05-07',
    });

    expect(getTenantSecret).toHaveBeenCalledWith(
      'tenant-x',
      'meta_graph_access_token_project_project-1',
    );
    expect(getTenantSecret).toHaveBeenCalledWith('tenant-x', 'meta_graph_access_token');
    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: { Authorization: 'Bearer meta-token' },
      }),
    );
  });

  it('fetches campaign-level insights without delivery filtering', async () => {
    const result = await createTool().call({
      level: 'campaign',
      since: '2026-05-01',
      until: '2026-05-07',
    });

    const url = new URL(fetch.mock.calls[0][0]);
    expect(url.searchParams.get('level')).toBe('campaign');
    expect(url.searchParams.get('filtering')).toBeNull();
    expect(url.searchParams.get('fields')).toBe(
      'campaign_id,campaign_name,spend,impressions,reach,clicks',
    );
    expect(JSON.parse(result)).toEqual(expect.objectContaining({ ok: true, level: 'campaign' }));
  });

  it('fetches adset-level insights without delivery filtering', async () => {
    const result = await createTool().call({
      level: 'adset',
      since: '2026-05-01',
      until: '2026-05-07',
    });

    const url = new URL(fetch.mock.calls[0][0]);
    expect(url.searchParams.get('level')).toBe('adset');
    expect(url.searchParams.get('filtering')).toBeNull();
    expect(url.searchParams.get('fields')).toBe(
      'campaign_id,campaign_name,adset_id,adset_name,spend,impressions,reach,clicks',
    );
    expect(JSON.parse(result)).toEqual(expect.objectContaining({ ok: true, level: 'adset' }));
  });

  it('rejects unsupported insight levels before fetch', async () => {
    await expect(
      createTool().call({
        level: 'account',
        since: '2026-05-01',
        until: '2026-05-07',
      }),
    ).rejects.toThrow('Received tool input did not match expected schema');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('uses an explicit project token secret when the accessible project has one', async () => {
    findProjectForRequest.mockResolvedValueOnce({
      _id: 'project-mongo-1',
      projectId: 'project-1',
      tenantId: 'tenant-x',
      metaAds: { adAccountId: 'act_123', tokenSecretName: 'project-secret' },
    });

    await createTool().call({
      ad_account_id: 'act_123',
      since: '2026-05-01',
      until: '2026-05-07',
    });

    expect(getTenantSecret).toHaveBeenCalledWith('tenant-x', 'project-secret');
    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: { Authorization: 'Bearer project-token' },
      }),
    );
  });

  it('rejects calls without an active or explicit project context', async () => {
    const result = await createTool({ projectId: undefined }).call({
      ad_account_id: 'act_123',
      since: '2026-05-01',
      until: '2026-05-07',
    });

    expect(findProjectForRequest).not.toHaveBeenCalled();
    expect(getTenantSecret).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
    expect(JSON.parse(result)).toEqual({
      ok: false,
      error: {
        message: 'Project context is required for Meta Ads insights.',
      },
    });
  });

  it('rejects project access before reading secrets', async () => {
    userCanAccessProject.mockResolvedValueOnce(false);

    const result = await createTool().call({
      ad_account_id: 'act_123',
      since: '2026-05-01',
      until: '2026-05-07',
    });

    expect(getTenantSecret).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
    expect(JSON.parse(result).error.message).toBe('Project access denied.');
  });

  it('rejects ad accounts outside the project Meta Ads configuration', async () => {
    const result = await createTool().call({
      ad_account_id: 'act_456',
      since: '2026-05-01',
      until: '2026-05-07',
    });

    expect(getTenantSecret).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
    expect(JSON.parse(result).error.message).toBe(
      'ad_account_id does not match the project Meta Ads account.',
    );
  });

  it('defaults to the current graph version and allows version-format overrides only', async () => {
    await createTool().call({
      ad_account_id: 'act_123',
      since: '2026-05-01',
      until: '2026-05-07',
    });

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('https://graph.facebook.com/v25.0/act_123/insights'),
      expect.any(Object),
    );

    fetch.mockClear();

    await createTool().call({
      ad_account_id: 'act_123',
      since: '2026-05-01',
      until: '2026-05-07',
      graph_version: 'v26.0',
    });

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('https://graph.facebook.com/v26.0/act_123/insights'),
      expect.any(Object),
    );

    const invalidVersion = await createTool().call({
      ad_account_id: 'act_123',
      since: '2026-05-01',
      until: '2026-05-07',
      graph_version: 'https://evil.example/v24.0',
    });

    expect(JSON.parse(invalidVersion).error.message).toBe(
      'graph_version must match Meta Graph API version format like v25.0.',
    );
  });

  it('paginates to completion regardless of the legacy max_pages argument', async () => {
    fetch
      .mockResolvedValueOnce(
        createResponse({
          data: [{ ad_name: 'Ad 1' }],
          paging: { cursors: { after: 'cursor-1' } },
        }),
      )
      .mockResolvedValueOnce(
        createResponse({
          data: [{ ad_name: 'Ad 2' }],
          paging: { cursors: { after: 'cursor-2' } },
        }),
      )
      .mockResolvedValueOnce(
        createResponse({
          data: [{ ad_name: 'Ad 3' }],
        }),
      );

    const result = await createTool().call({
      ad_account_id: 'act_123',
      since: '2026-05-01',
      until: '2026-05-07',
      max_pages: 2,
    });

    expect(fetch).toHaveBeenCalledTimes(3);
    expect(new URL(fetch.mock.calls[1][0]).searchParams.get('after')).toBe('cursor-1');
    expect(new URL(fetch.mock.calls[2][0]).searchParams.get('after')).toBe('cursor-2');
    expect(JSON.parse(result)).toEqual(
      expect.objectContaining({
        ok: true,
        rowsProcessed: 3,
        pagesFetched: 3,
      }),
    );
  });

  it('summarizes more than 100 ads without returning every raw row', async () => {
    const ads = Array.from({ length: 125 }, (_, index) => ({
      campaign_id: `campaign-${index % 2}`,
      campaign_name: `Campaign ${index % 2}`,
      adset_id: `adset-${index % 5}`,
      adset_name: `Ad set ${index % 5}`,
      ad_id: `ad-${index}`,
      ad_name: `Ad ${index}`,
      spend: '2',
      impressions: '10',
      reach: '8',
      clicks: '1',
    }));
    fetch
      .mockResolvedValueOnce(
        createResponse({
          data: ads.slice(0, 100),
          paging: { cursors: { after: 'cursor-100' } },
        }),
      )
      .mockResolvedValueOnce(createResponse({ data: ads.slice(100) }))
      .mockResolvedValueOnce(createResponse({}));

    const result = JSON.parse(
      await createTool().call({
        since: '2026-05-01',
        until: '2026-05-07',
        metrics: ['spend', 'impressions', 'clicks'],
      }),
    );

    expect(result.rowsProcessed).toBe(125);
    expect(result.totals).toEqual({ spend: 250, impressions: 1250, clicks: 125 });
    expect(result.tables.campaign).toHaveLength(2);
    expect(result.tables.ad).toHaveLength(25);
    expect(result.details).toEqual(
      expect.objectContaining({
        available: expect.objectContaining({ ad: 125 }),
        omitted: expect.objectContaining({ ad: 100 }),
        hasMore: true,
      }),
    );
    expect(JSON.stringify(result)).not.toContain('"data":');
  });

  it('applies drill-down and daily breakdown at Meta before summarizing', async () => {
    await createTool().call({
      since: '2026-05-01',
      until: '2026-05-07',
      campaign_id: 'campaign-1',
      breakdown: 'day',
      metrics: ['spend'],
    });

    const url = new URL(fetch.mock.calls[0][0]);
    expect(JSON.parse(url.searchParams.get('filtering'))).toEqual([
      { field: 'campaign.id', operator: 'EQUAL', value: 'campaign-1' },
    ]);
    expect(url.searchParams.get('time_increment')).toBe('1');
    expect(url.searchParams.get('fields')).toBe(
      'campaign_id,campaign_name,adset_id,adset_name,ad_id,ad_name,spend,date_start',
    );
  });

  it('returns a safe error when project and tenant tokens are missing', async () => {
    getTenantSecret.mockResolvedValue(null);

    const result = await createTool().call({
      ad_account_id: 'act_123',
      since: '2026-05-01',
      until: '2026-05-07',
    });

    expect(result).not.toContain('meta-token');
    expect(JSON.parse(result)).toEqual({
      ok: false,
      error: {
        message: 'Meta access token not configured for project or tenant.',
      },
    });
  });

  it('rejects invalid account ids and oversized date ranges before fetch', async () => {
    const invalidAccount = await createTool().call({
      ad_account_id: '123',
      since: '2026-05-01',
      until: '2026-05-07',
    });
    const oversizedRange = await createTool().call({
      ad_account_id: 'act_123',
      since: '2026-01-01',
      until: '2026-06-01',
    });

    expect(fetch).not.toHaveBeenCalled();
    expect(JSON.parse(invalidAccount).error.message).toBe(
      'ad_account_id must use act_<number> format.',
    );
    expect(JSON.parse(oversizedRange).error.message).toBe('Date range cannot exceed 120 days.');
  });

  it('returns structured Meta API errors without leaking auth', async () => {
    fetch.mockResolvedValueOnce(
      createResponse({ error: { message: 'Invalid OAuth access token.', code: 190 } }, false, 400),
    );

    const result = await createTool().call({
      ad_account_id: 'act_123',
      since: '2026-05-01',
      until: '2026-05-07',
    });

    expect(result).not.toContain('meta-token');
    expect(JSON.parse(result)).toEqual({
      ok: false,
      status: 400,
      error: {
        message: 'Invalid OAuth access token.',
        data: { message: 'Invalid OAuth access token.', code: 190 },
      },
    });
  });
});
