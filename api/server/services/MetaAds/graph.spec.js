jest.mock('node-fetch', () => jest.fn());

const fetch = require('node-fetch');
const {
  getAdSetDailyBudget,
  getMetaGraphVersion,
  listCampaigns,
  listAdSets,
  listAdSetInsights,
  metaGet,
} = require('./graph');

describe('Meta Ads Graph client', () => {
  beforeEach(() => {
    fetch.mockReset();
    delete process.env.META_GRAPH_API_VERSION;
  });

  it('uses a configured global Meta Graph API version', async () => {
    process.env.META_GRAPH_API_VERSION = 'v23.0';
    fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ data: [] }),
    });

    await listAdSets({ adAccountId: 'act_123', token: 'token' });

    expect(getMetaGraphVersion()).toBe('v23.0');
    expect(fetch.mock.calls[0][0]).toContain('/v23.0/act_123/adsets');
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
      listCampaigns({ adAccountId: 'act_123', token: 'token', graphVersion: 'v23.0' }),
    ).resolves.toEqual([
      {
        id: 'campaign-1',
        name: 'Messages Floripa',
        objective: 'OUTCOME_ENGAGEMENT',
        daily_budget: '7000',
        effective_status: 'ACTIVE',
      },
    ]);

    expect(fetch.mock.calls[0][0]).toContain('/v23.0/act_123/campaigns');
    expect(fetch.mock.calls[0][0]).toContain('objective');
    expect(fetch.mock.calls[0][0]).toContain('daily_budget');
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

    await listAdSets({ adAccountId: 'act_123', token: 'token', graphVersion: 'v23.0' });

    expect(fetch.mock.calls[0][0]).toContain('campaign_id');
    expect(fetch.mock.calls[0][0]).toContain('campaign%7Bid%2Cname%7D');
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
      graphVersion: 'v23.0',
      since: '2026-06-02',
      until: '2026-06-03',
    });

    expect(fetch.mock.calls[0][0]).toContain('/v23.0/act_123/insights');
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
      listAdSets({ adAccountId: 'act_123', token: 'token', graphVersion: 'v23.0' }),
    ).rejects.toThrow(
      'Token Meta Ads sem permissão para act_123. Conceda ads_read ou ads_management ao app/token e confirme acesso à conta de anúncio.',
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

  it('fetches the current ad set daily budget before a budget update', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ daily_budget: '13000' }),
    });

    await expect(
      getAdSetDailyBudget({ entityId: 'adset-1', token: 'token', graphVersion: 'v23.0' }),
    ).resolves.toBe(130);

    expect(fetch.mock.calls[0][0]).toContain('/v23.0/adset-1');
    expect(fetch.mock.calls[0][0]).toContain('fields=daily_budget');
  });
});
