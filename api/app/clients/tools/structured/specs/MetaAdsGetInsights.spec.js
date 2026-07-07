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
  beforeEach(() => {
    jest.clearAllMocks();
    getTenantSecret.mockImplementation(async (tenantId, name) => ({
      tenantId,
      name,
      type: 'bearer',
      value: name === 'project-secret' ? 'project-token' : 'meta-token',
    }));
    findProjectForRequest.mockResolvedValue({
      _id: 'project-mongo-1',
      projectId: 'project-1',
      tenantId: 'tenant-x',
      metaAds: { adAccountId: 'act_123' },
    });
    userCanAccessProject.mockResolvedValue(true);
    fetch.mockResolvedValue(createResponse({ data: [{ ad_name: 'Ad 1', spend: '10.00' }] }));
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
      'ad_name,spend,cpm,ctr,cpc,actions,action_values,purchase_roas',
    );
    expect(JSON.parse(url.searchParams.get('filtering'))).toEqual([
      { field: 'ad.delivery_info', operator: 'IN', values: ['ACTIVE'] },
    ]);
    expect(JSON.parse(url.searchParams.get('time_range'))).toEqual({
      since: '2026-05-01',
      until: '2026-05-07',
    });

    expect(JSON.parse(result)).toEqual({
      ok: true,
      status: 200,
      accountId: 'act_123',
      since: '2026-05-01',
      until: '2026-05-07',
      level: 'ad',
      rows: 1,
      graphVersion: 'v25.0',
      pagesFetched: 1,
      hasMore: false,
      data: [{ ad_name: 'Ad 1', spend: '10.00' }],
    });
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

  it('paginates until max_pages and returns nextAfter', async () => {
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
      );

    const result = await createTool().call({
      ad_account_id: 'act_123',
      since: '2026-05-01',
      until: '2026-05-07',
      max_pages: 2,
    });

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(new URL(fetch.mock.calls[1][0]).searchParams.get('after')).toBe('cursor-1');
    expect(JSON.parse(result)).toEqual(
      expect.objectContaining({
        ok: true,
        rows: 2,
        pagesFetched: 2,
        hasMore: true,
        nextAfter: 'cursor-2',
        data: [{ ad_name: 'Ad 1' }, { ad_name: 'Ad 2' }],
      }),
    );
  });

  it('returns a safe error when tenant token is missing', async () => {
    getTenantSecret.mockResolvedValueOnce(null);

    const result = await createTool().call({
      ad_account_id: 'act_123',
      since: '2026-05-01',
      until: '2026-05-07',
    });

    expect(result).not.toContain('meta-token');
    expect(JSON.parse(result)).toEqual({
      ok: false,
      error: {
        message: 'Meta access token not configured for tenant.',
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
