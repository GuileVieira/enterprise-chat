jest.mock('node-fetch', () => jest.fn());

const fetch = require('node-fetch');
const { getMetaGraphVersion, listAdSets, listAdSetInsights, metaGet } = require('./graph');

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
});
