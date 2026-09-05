jest.mock('node-fetch', () => jest.fn());

const mockCacheMap = new Map();
const mockCacheGet = jest.fn(async (key) => mockCacheMap.get(key));
const mockCacheSet = jest.fn(async (key, value) => {
  mockCacheMap.set(key, value);
  return true;
});

jest.mock('@librechat/api', () => ({
  standardCache: jest.fn(() => ({
    get: mockCacheGet,
    set: mockCacheSet,
  })),
}));

const fetch = require('node-fetch');
const {
  clearMetaGraphReadCacheForTests,
  getAdSetDailyBudget,
  getAdAccountCurrency,
  getEntityDailyBudget,
  getMetaGraphVersion,
  listAds,
  listCampaigns,
  listAdSets,
  listAdInsights,
  listCampaignInsights,
  listAdSetInsights,
  metaGet,
  metaPost,
  copyMetaEntity,
  updateMetaEntityName,
  updateMetaAdStatus,
  validateMetaAdsAccess,
} = require('./graph');

describe('Meta Ads Graph client', () => {
  beforeEach(() => {
    fetch.mockReset();
    mockCacheMap.clear();
    mockCacheGet.mockClear();
    mockCacheSet.mockClear();
    clearMetaGraphReadCacheForTests();
    delete process.env.META_GRAPH_API_VERSION;
    delete process.env.META_ADS_GRAPH_TIMEOUT_MS;
    delete process.env.META_ADS_GRAPH_TODAY_CACHE_TTL_MS;
    delete process.env.META_ADS_GRAPH_HISTORICAL_CACHE_TTL_MS;
    delete process.env.META_ADS_GRAPH_ACCOUNT_CONCURRENCY;
    delete process.env.META_ADS_GRAPH_READ_CACHE_VERSION;
    jest.useRealTimers();
  });

  it('uses a configured global Meta Graph API version', async () => {
    process.env.META_GRAPH_API_VERSION = 'v24.0';
    fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ data: [] }),
    });

    await listAdSets({ adAccountId: 'act_123', token: 'token' });

    expect(getMetaGraphVersion()).toBe('v24.0');
    expect(fetch.mock.calls[0][0]).toContain('/v24.0/act_123/adsets');
  });

  it('validates account access and reports missing campaign write permission', async () => {
    fetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ id: 'act_123' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ data: [{ permission: 'ads_read', status: 'granted' }] }),
      });

    await expect(
      validateMetaAdsAccess({ adAccountId: 'act_123', token: 'token', graphVersion: 'v24.0' }),
    ).resolves.toEqual({
      valid: true,
      canRead: true,
      canManage: false,
      missingPermissions: ['ads_management'],
    });
  });

  it('falls back to the default Meta Graph API version for deprecated versions', async () => {
    process.env.META_GRAPH_API_VERSION = 'v23.0';
    fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ data: [] }),
    });

    await listAdSets({ adAccountId: 'act_123', token: 'token' });

    expect(getMetaGraphVersion()).toBe('v25.0');
    expect(fetch.mock.calls[0][0]).toContain('/v25.0/act_123/adsets');
  });

  it('lists active campaigns with daily budget and objective', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          data: [
            {
              id: 'campaign-1',
              name: 'Messages Floripa',
              objective: 'OUTCOME_ENGAGEMENT',
              daily_budget: '7000',
              effective_status: 'ACTIVE',
            },
            {
              id: 'campaign-2',
              name: 'Old campaign',
              effective_status: 'PAUSED',
            },
          ],
        }),
    });

    await expect(
      listCampaigns({ adAccountId: 'act_123', token: 'token', graphVersion: 'v24.0' }),
    ).resolves.toEqual([
      {
        id: 'campaign-1',
        name: 'Messages Floripa',
        objective: 'OUTCOME_ENGAGEMENT',
        daily_budget: '7000',
        effective_status: 'ACTIVE',
      },
    ]);

    expect(fetch.mock.calls[0][0]).toContain('/v24.0/act_123/campaigns');
    expect(fetch.mock.calls[0][0]).toContain('objective');
    expect(fetch.mock.calls[0][0]).toContain('daily_budget');
  });

  it('can include inactive campaigns for historical period dashboards', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          data: [
            { id: 'campaign-1', name: 'Active', effective_status: 'ACTIVE' },
            { id: 'campaign-2', name: 'Paused', effective_status: 'PAUSED' },
          ],
        }),
    });

    await expect(
      listCampaigns({
        adAccountId: 'act_123',
        token: 'token',
        graphVersion: 'v24.0',
        includeInactive: true,
      }),
    ).resolves.toEqual([
      expect.objectContaining({ id: 'campaign-1', effective_status: 'ACTIVE' }),
      expect.objectContaining({ id: 'campaign-2', effective_status: 'PAUSED' }),
    ]);
  });

  it('follows Meta paging links when listing campaigns', async () => {
    fetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            data: [{ id: 'campaign-1', name: 'First page', effective_status: 'ACTIVE' }],
            paging: {
              next: 'https://graph.facebook.com/v24.0/act_123/campaigns?after=cursor',
            },
          }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            data: [{ id: 'campaign-2', name: 'Second page', effective_status: 'ACTIVE' }],
          }),
      });

    await expect(
      listCampaigns({ adAccountId: 'act_123', token: 'token', graphVersion: 'v24.0' }),
    ).resolves.toEqual([
      expect.objectContaining({ id: 'campaign-1' }),
      expect.objectContaining({ id: 'campaign-2' }),
    ]);

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch.mock.calls[1][0]).toBe(
      'https://graph.facebook.com/v24.0/act_123/campaigns?after=cursor',
    );
  });

  it('caches paged Meta reads by path, params, and graph version', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          data: [{ id: 'campaign-1', name: 'Cached', effective_status: 'ACTIVE' }],
        }),
    });

    await listCampaigns({ adAccountId: 'act_123', token: 'token-a', graphVersion: 'v24.0' });
    await expect(
      listCampaigns({ adAccountId: 'act_123', token: 'token-b', graphVersion: 'v24.0' }),
    ).resolves.toEqual([expect.objectContaining({ id: 'campaign-1' })]);

    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('separates read cache entries by cache version', async () => {
    fetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            data: [{ id: 'campaign-old', name: 'Old', effective_status: 'ACTIVE' }],
          }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            data: [{ id: 'campaign-new', name: 'New', effective_status: 'ACTIVE' }],
          }),
      });

    process.env.META_ADS_GRAPH_READ_CACHE_VERSION = 'old-version';
    await expect(
      listCampaigns({ adAccountId: 'act_123', token: 'token-a', graphVersion: 'v24.0' }),
    ).resolves.toEqual([expect.objectContaining({ id: 'campaign-old' })]);

    process.env.META_ADS_GRAPH_READ_CACHE_VERSION = 'new-version';
    await expect(
      listCampaigns({ adAccountId: 'act_123', token: 'token-b', graphVersion: 'v24.0' }),
    ).resolves.toEqual([expect.objectContaining({ id: 'campaign-new' })]);

    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('uses a short cache TTL for insight ranges that include today', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-06-18T15:00:00.000Z'));
    fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ data: [] }),
    });

    await listAdSetInsights({
      adAccountId: 'act_123',
      token: 'token',
      graphVersion: 'v24.0',
      since: '2026-06-18',
      until: '2026-06-18',
    });

    expect(mockCacheSet).toHaveBeenCalledWith(expect.any(String), expect.any(Object), 600000);
  });

  it('uses a long cache TTL for closed historical insight ranges', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-06-18T15:00:00.000Z'));
    fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ data: [] }),
    });

    await listAdSetInsights({
      adAccountId: 'act_123',
      token: 'token',
      graphVersion: 'v24.0',
      since: '2026-06-01',
      until: '2026-06-17',
    });

    expect(mockCacheSet).toHaveBeenCalledWith(expect.any(String), expect.any(Object), 604800000);
  });

  it('lists active ad sets with their parent campaign fields', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          data: [
            {
              id: 'adset-1',
              name: 'Topo',
              daily_budget: '5000',
              campaign_id: 'campaign-1',
              campaign: { id: 'campaign-1', name: 'Messages Floripa' },
              effective_status: 'ACTIVE',
            },
          ],
        }),
    });

    await listAdSets({ adAccountId: 'act_123', token: 'token', graphVersion: 'v24.0' });

    expect(fetch.mock.calls[0][0]).toContain('campaign_id');
    expect(fetch.mock.calls[0][0]).toContain('optimization_goal');
    expect(fetch.mock.calls[0][0]).toContain('campaign%7Bid%2Cname%7D');
  });

  it('lists active ads with creative fields for preview rendering', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          data: [
            {
              id: 'ad-1',
              name: 'Summer creative',
              effective_status: 'ACTIVE',
              adset_id: 'adset-1',
              campaign_id: 'campaign-1',
              creative: {
                id: 'creative-1',
                title: 'Book now',
                body: 'Fresh offer for warm leads.',
                thumbnail_url: 'https://example.com/thumb.jpg',
                image_url: 'https://example.com/image.jpg',
                object_story_spec: {
                  link_data: {
                    link: 'https://example.com',
                    call_to_action: { type: 'SIGN_UP' },
                  },
                },
              },
            },
            {
              id: 'ad-2',
              name: 'Paused creative',
              effective_status: 'PAUSED',
            },
          ],
        }),
    });

    await expect(
      listAds({ adAccountId: 'act_123', token: 'token', graphVersion: 'v24.0' }),
    ).resolves.toEqual([
      expect.objectContaining({
        id: 'ad-1',
        name: 'Summer creative',
        creative: expect.objectContaining({
          id: 'creative-1',
          thumbnail_url: 'https://example.com/thumb.jpg',
        }),
      }),
    ]);

    expect(fetch.mock.calls[0][0]).toContain('/v24.0/act_123/ads');
    expect(fetch.mock.calls[0][0]).toContain('creative%7B');
    expect(fetch.mock.calls[0][0]).toContain('thumbnail_url');
    expect(fetch.mock.calls[0][0]).toContain('object_story_spec');
  });

  it('can include inactive ads for historical period previews', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          data: [
            { id: 'ad-1', effective_status: 'ACTIVE' },
            { id: 'ad-2', effective_status: 'PAUSED' },
          ],
        }),
    });

    await expect(
      listAds({
        adAccountId: 'act_123',
        token: 'token',
        graphVersion: 'v24.0',
        includeInactive: true,
      }),
    ).resolves.toEqual([
      expect.objectContaining({ id: 'ad-1', effective_status: 'ACTIVE' }),
      expect.objectContaining({ id: 'ad-2', effective_status: 'PAUSED' }),
    ]);
  });

  it('can list ads scoped by ad set ids to avoid account-wide payloads', async () => {
    fetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            data: [{ id: 'ad-1', effective_status: 'ACTIVE', adset_id: 'adset-1' }],
          }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            data: [{ id: 'ad-2', effective_status: 'ACTIVE', adset_id: 'adset-2' }],
          }),
      });

    await expect(
      listAds({
        adAccountId: 'act_123',
        adSetIds: ['adset-1', 'adset-2'],
        token: 'token',
        graphVersion: 'v24.0',
        includeInactive: true,
      }),
    ).resolves.toEqual([
      expect.objectContaining({ id: 'ad-1', adset_id: 'adset-1' }),
      expect.objectContaining({ id: 'ad-2', adset_id: 'adset-2' }),
    ]);

    expect(fetch.mock.calls[0][0]).toContain('/v24.0/adset-1/ads');
    expect(fetch.mock.calls[1][0]).toContain('/v24.0/adset-2/ads');
    expect(fetch.mock.calls[0][0]).toContain('image_hash');
  });

  it('can list ads scoped by ad ids from period insights', async () => {
    fetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            id: 'ad-1',
            effective_status: 'ACTIVE',
            adset_id: 'adset-1',
            creative: { id: 'creative-1' },
          }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            id: 'ad-2',
            effective_status: 'PAUSED',
            adset_id: 'adset-2',
            creative: { id: 'creative-2' },
          }),
      });

    await expect(
      listAds({
        adAccountId: 'act_123',
        adIds: ['ad-1', 'ad-2'],
        token: 'token',
        graphVersion: 'v24.0',
        includeInactive: true,
      }),
    ).resolves.toEqual([
      expect.objectContaining({ id: 'ad-1', adset_id: 'adset-1' }),
      expect.objectContaining({ id: 'ad-2', adset_id: 'adset-2' }),
    ]);

    expect(fetch.mock.calls[0][0]).toContain('/v24.0/ad-1?');
    expect(fetch.mock.calls[1][0]).toContain('/v24.0/ad-2?');
    expect(fetch.mock.calls[0][0]).not.toContain('/act_123/ads');
    expect(fetch.mock.calls[0][0]).toContain('image_hash');
  });

  it('lists ad-level insights for the selected status period', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          data: [
            {
              ad_id: 'ad-1',
              ad_name: 'Summer creative',
              adset_id: 'adset-1',
              campaign_id: 'campaign-1',
              spend: '42.5',
              impressions: '1000',
              clicks: '38',
              ctr: '3.8',
            },
          ],
        }),
    });

    await expect(
      listAdInsights({
        adAccountId: 'act_123',
        token: 'token',
        graphVersion: 'v24.0',
        since: '2026-06-01',
        until: '2026-06-07',
      }),
    ).resolves.toEqual([
      expect.objectContaining({
        ad_id: 'ad-1',
        adset_id: 'adset-1',
        spend: '42.5',
      }),
    ]);

    expect(fetch.mock.calls[0][0]).toContain('/v24.0/act_123/insights');
    expect(fetch.mock.calls[0][0]).toContain('level=ad');
    expect(fetch.mock.calls[0][0]).toContain('ad_id');
    expect(fetch.mock.calls[0][0]).toContain('action_values');
    expect(fetch.mock.calls[0][0]).toContain('time_range=');
  });

  it('lists campaign-level insights for the selected status period', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          data: [
            {
              campaign_id: 'campaign-1',
              campaign_name: 'Messages',
              spend: '202.01',
              impressions: '4020',
              reach: '1000',
              frequency: '4.02',
            },
          ],
        }),
    });

    await expect(
      listCampaignInsights({
        adAccountId: 'act_123',
        token: 'token',
        graphVersion: 'v24.0',
        since: '2026-06-01',
        until: '2026-06-07',
      }),
    ).resolves.toEqual([
      expect.objectContaining({
        campaign_id: 'campaign-1',
        frequency: '4.02',
      }),
    ]);

    expect(fetch.mock.calls[0][0]).toContain('/v24.0/act_123/insights');
    expect(fetch.mock.calls[0][0]).toContain('level=campaign');
    expect(fetch.mock.calls[0][0]).toContain('frequency');
  });

  it('shares concurrent identical paged reads through a single inflight request', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          data: [{ id: 'adset-1', name: 'Audience', effective_status: 'ACTIVE' }],
        }),
    });

    await expect(
      Promise.all([
        listAdSets({ adAccountId: 'act_123', token: 'token', graphVersion: 'v24.0' }),
        listAdSets({ adAccountId: 'act_123', token: 'token', graphVersion: 'v24.0' }),
      ]),
    ).resolves.toEqual([
      [expect.objectContaining({ id: 'adset-1' })],
      [expect.objectContaining({ id: 'adset-1' })],
    ]);

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(mockCacheSet).toHaveBeenCalledTimes(1);
  });

  it('queues different Meta reads for the same ad account', async () => {
    let resolveFirst;
    const firstResponse = new Promise((resolve) => {
      resolveFirst = resolve;
    });
    fetch.mockReturnValueOnce(firstResponse).mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          data: [{ id: 'campaign-1', effective_status: 'ACTIVE' }],
        }),
    });

    const adsetsPromise = listAdSets({
      adAccountId: 'act_123',
      token: 'token',
      graphVersion: 'v24.0',
    });
    const campaignsPromise = listCampaigns({
      adAccountId: 'act_123',
      token: 'token',
      graphVersion: 'v24.0',
    });

    await Promise.resolve();
    await Promise.resolve();
    expect(fetch).toHaveBeenCalledTimes(1);

    resolveFirst({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          data: [{ id: 'adset-1', effective_status: 'ACTIVE' }],
        }),
    });

    await expect(Promise.all([adsetsPromise, campaignsPromise])).resolves.toEqual([
      [expect.objectContaining({ id: 'adset-1' })],
      [expect.objectContaining({ id: 'campaign-1' })],
    ]);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('requests a long insight period once before falling back to chunks', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          data: [
            {
              adset_id: 'adset-1',
              adset_name: 'Audience',
              campaign_id: 'campaign-1',
              spend: '30',
            },
          ],
        }),
    });

    await expect(
      listAdSetInsights({
        adAccountId: 'act_123',
        token: 'token',
        graphVersion: 'v24.0',
        since: '2026-06-01',
        until: '2026-06-30',
      }),
    ).resolves.toEqual([expect.objectContaining({ adset_id: 'adset-1', spend: '30' })]);

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][0]).toContain(
      encodeURIComponent(JSON.stringify({ since: '2026-06-01', until: '2026-06-30' })),
    );
  });

  it('passes Meta date presets through without converting them to a custom range', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ data: [] }),
    });

    await listAdSetInsights({
      adAccountId: 'act_123',
      token: 'token',
      graphVersion: 'v25.0',
      datePreset: 'last_7d',
    });

    expect(fetch.mock.calls[0][0]).toContain('date_preset=last_7d');
    expect(fetch.mock.calls[0][0]).not.toContain('time_range');
  });

  it.each([
    ['this_month', '2026-07-01', '2026-07-31'],
    ['last_month', '2026-06-01', '2026-06-30'],
  ])(
    'uses explicit ranges for %s when a resolved range is available',
    async (preset, since, until) => {
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ data: [] }),
      });

      await listAdSetInsights({
        adAccountId: 'act_123',
        token: 'token',
        graphVersion: 'v25.0',
        since,
        until,
        datePreset: preset,
      });

      expect(fetch.mock.calls[0][0]).not.toContain(`date_preset=${preset}`);
      expect(fetch.mock.calls[0][0]).toContain(
        encodeURIComponent(JSON.stringify({ since, until })),
      );
    },
  );

  it('requests daily ad insights when time increment is enabled', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          data: [
            {
              date_start: '2026-06-01',
              ad_id: 'ad-1',
              ad_name: 'Creative',
              adset_id: 'adset-1',
              campaign_id: 'campaign-1',
              spend: '12',
            },
          ],
        }),
    });

    await expect(
      listAdInsights({
        adAccountId: 'act_123',
        token: 'token',
        graphVersion: 'v24.0',
        since: '2026-06-01',
        until: '2026-06-02',
        timeIncrement: 1,
      }),
    ).resolves.toEqual([
      expect.objectContaining({ date_start: '2026-06-01', ad_id: 'ad-1', spend: '12' }),
    ]);

    expect(fetch.mock.calls[0][0]).toContain('time_increment=1');
  });

  it('retries heavy insight periods in date chunks and aggregates rows', async () => {
    fetch
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () =>
          JSON.stringify({
            error: {
              message:
                'Please reduce the amount of data you are asking for, then retry your request',
            },
          }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            data: [
              {
                adset_id: 'adset-1',
                adset_name: 'Audience',
                campaign_id: 'campaign-1',
                campaign_name: 'Messages',
                spend: '10',
                impressions: '100',
                reach: '50',
                clicks: '5',
                actions: [{ action_type: 'link_click', value: '5' }],
                action_values: [{ action_type: 'purchase', value: '100' }],
              },
            ],
          }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            data: [
              {
                adset_id: 'adset-1',
                adset_name: 'Audience',
                campaign_id: 'campaign-1',
                campaign_name: 'Messages',
                spend: '20',
                impressions: '200',
                reach: '100',
                clicks: '10',
                actions: [{ action_type: 'link_click', value: '10' }],
                action_values: [{ action_type: 'purchase', value: '250' }],
              },
            ],
          }),
      });

    await expect(
      listAdSetInsights({
        adAccountId: 'act_123',
        token: 'token',
        graphVersion: 'v24.0',
        since: '2026-06-01',
        until: '2026-06-14',
      }),
    ).resolves.toEqual([
      expect.objectContaining({
        adset_id: 'adset-1',
        spend: 30,
        impressions: 300,
        reach: 150,
        frequency: 2,
        clicks: 15,
        action_values: [expect.objectContaining({ action_type: 'purchase', value: 350 })],
        cost_per_action_type: [expect.objectContaining({ action_type: 'link_click', value: 2 })],
      }),
    ]);

    expect(fetch).toHaveBeenCalledTimes(3);
    expect(fetch.mock.calls[1][0]).toContain(
      encodeURIComponent(JSON.stringify({ since: '2026-06-01', until: '2026-06-07' })),
    );
    expect(fetch.mock.calls[2][0]).toContain(
      encodeURIComponent(JSON.stringify({ since: '2026-06-08', until: '2026-06-14' })),
    );
  });

  it('uses project graph version override before global default', async () => {
    process.env.META_GRAPH_API_VERSION = 'v25.0';
    fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ data: [] }),
    });

    await listAdSetInsights({
      adAccountId: 'act_123',
      token: 'token',
      graphVersion: 'v24.0',
      since: '2026-06-02',
      until: '2026-06-03',
    });

    expect(fetch.mock.calls[0][0]).toContain('/v24.0/act_123/insights');
  });

  it('turns Meta permission errors into actionable messages', async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      text: async () =>
        JSON.stringify({
          error: {
            code: 200,
            message: '(#200) Ad account owner has NOT grant ads_management or ads_read permission',
          },
        }),
    });

    await expect(
      listAdSets({ adAccountId: 'act_123', token: 'token', graphVersion: 'v24.0' }),
    ).rejects.toThrow(
      'Token Meta Ads sem permissão para act_123. Conceda ads_read ou ads_management ao app/token e confirme acesso à conta de anúncio.',
    );
  });

  it('requires ads_management in write permission errors', async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      text: async () =>
        JSON.stringify({ error: { code: 200, message: '(#200) Permissions error' } }),
    });

    await expect(
      metaPost({
        path: 'campaign-1',
        token: 'token',
        body: { status: 'PAUSED' },
        resourceLabel: 'campaign update',
      }),
    ).rejects.toThrow(
      'Token Meta Ads sem permissão para campaign-1. Conceda ads_management ao app/token e confirme acesso à conta de anúncio.',
    );
  });

  it('adds response context when Meta returns non-JSON text', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: { get: () => 'text/plain' },
      text: async () => 'Invalid JSON for postcard',
    });

    await expect(
      metaGet({
        path: 'act_123/adsets',
        token: 'token',
        params: { fields: 'id' },
        resourceLabel: 'ad sets',
      }),
    ).rejects.toThrow(
      'Meta returned an invalid ad sets response (200). Body: Invalid JSON for postcard',
    );
  });

  it('aborts Meta requests after the configured timeout', async () => {
    jest.useFakeTimers();
    process.env.META_ADS_GRAPH_TIMEOUT_MS = '25';
    fetch.mockImplementationOnce(
      () =>
        new Promise(() => {
          // pending request
        }),
    );

    const request = metaGet({
      path: 'act_123/adsets',
      token: 'token',
      params: { fields: 'id' },
      resourceLabel: 'ad sets',
    });

    jest.advanceTimersByTime(25);

    await expect(request).rejects.toThrow('Meta Ads ad sets request timed out after 25ms.');
    expect(fetch.mock.calls[0][1].signal.aborted).toBe(true);
  });

  it('fetches the current ad set daily budget before a budget update', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ daily_budget: '13000' }),
    });

    await expect(
      getAdSetDailyBudget({ entityId: 'adset-1', token: 'token', graphVersion: 'v24.0' }),
    ).resolves.toBe(130);

    expect(fetch.mock.calls[0][0]).toContain('/v24.0/adset-1');
    expect(fetch.mock.calls[0][0]).toContain('fields=daily_budget');
  });

  it('fetches campaign or ad set budget with CBO/ABO fields', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ daily_budget: '7000', lifetime_budget: '0' }),
    });

    await expect(
      getEntityDailyBudget({ entityId: 'campaign-1', token: 'token', graphVersion: 'v24.0' }),
    ).resolves.toEqual({
      dailyBudget: 70,
      lifetimeBudget: 0,
    });

    expect(fetch.mock.calls[0][0]).toContain('/v24.0/campaign-1');
    expect(fetch.mock.calls[0][0]).toContain('fields=daily_budget%2Clifetime_budget');
  });

  it('updates an ad status through Meta Graph', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ success: true }),
    });

    await expect(
      updateMetaAdStatus({
        adId: 'ad-1',
        status: 'PAUSED',
        token: 'token',
        graphVersion: 'v24.0',
      }),
    ).resolves.toEqual({ success: true });

    expect(fetch.mock.calls[0][0]).toContain('/v24.0/ad-1');
    expect(fetch.mock.calls[0][1]).toMatchObject({
      method: 'POST',
      body: JSON.stringify({ status: 'PAUSED' }),
    });
  });

  it('duplicates and renames a Meta entity through Meta Graph', async () => {
    fetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ copied_campaign_id: 'campaign-copy' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ success: true }),
      });

    await expect(
      copyMetaEntity({
        entityId: 'campaign-1',
        entityLevel: 'campaign',
        token: 'token',
        graphVersion: 'v24.0',
      }),
    ).resolves.toEqual({ copied_campaign_id: 'campaign-copy' });
    await updateMetaEntityName({
      entityId: 'campaign-copy',
      entityLevel: 'campaign',
      name: 'Campaign copy',
      token: 'token',
      graphVersion: 'v24.0',
    });

    expect(fetch.mock.calls[0][0]).toContain('/v24.0/campaign-1/copies');
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({
      deep_copy: true,
      status_option: 'PAUSED',
      rename_options: {
        rename_strategy: 'ONLY_TOP_LEVEL',
        rename_prefix: '',
        rename_suffix: ' - cópia',
      },
    });
    expect(fetch.mock.calls[1][0]).toContain('/v24.0/campaign-copy');
    expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual({ name: 'Campaign copy' });
  });

  it('fetches ad account currency', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ currency: 'BRL' }),
    });

    await expect(
      getAdAccountCurrency({ adAccountId: 'act_123', token: 'token', graphVersion: 'v24.0' }),
    ).resolves.toBe('BRL');

    expect(fetch.mock.calls[0][0]).toContain('/v24.0/act_123');
    expect(fetch.mock.calls[0][0]).toContain('fields=currency');
  });
});
