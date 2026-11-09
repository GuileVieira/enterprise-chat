let fetchSpy: jest.SpyInstance<Promise<Response>, Parameters<typeof fetch>>;

async function loadVersions() {
  jest.resetModules();
  return import('./meta');
}

describe('Meta Graph version discovery', () => {
  beforeEach(() => {
    fetchSpy = jest.spyOn(global, 'fetch');
    jest.useFakeTimers({ now: new Date('2026-11-09') });
  });
  afterEach(() => jest.useRealTimers());

  it('discovers newer SDK versions, deduplicates requests and refreshes after 24 hours', async () => {
    fetchSpy.mockResolvedValue(new Response("static get VERSION(): string { return 'v28.0'; }"));
    const { getAvailableMetaGraphVersions } = await loadVersions();
    const [first, second] = await Promise.all([
      getAvailableMetaGraphVersions(),
      getAvailableMetaGraphVersions(),
    ]);
    expect(first).toEqual(['v24.0', 'v25.0', 'v26.0', 'v27.0', 'v28.0']);
    expect(second).toEqual(first);
    await getAvailableMetaGraphVersions();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(24 * 60 * 60 * 1000);
    fetchSpy.mockRejectedValueOnce(new Error('offline'));
    expect(await getAvailableMetaGraphVersions()).toEqual(first);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it.each([
    new Response('', { status: 503 }),
    new Response('unexpected response'),
    new Response("static get VERSION(): string { return 'v26.0'; }"),
  ])('keeps fallback versions on unavailable, invalid or older source: %p', async (response) => {
    fetchSpy.mockResolvedValue(response);
    const { getAvailableMetaGraphVersions } = await loadVersions();
    expect(await getAvailableMetaGraphVersions()).toEqual(['v24.0', 'v25.0', 'v26.0', 'v27.0']);
  });
});
