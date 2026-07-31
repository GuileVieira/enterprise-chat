const mockSafeConnect = jest.fn(() => ({ lookup: jest.fn() }));

jest.mock('@librechat/api', () => ({
  createSSRFSafeUndiciConnect: (...args) => mockSafeConnect(...args),
  isSSRFTarget: jest.fn(),
  resolveHostnameSSRF: jest.fn(),
}));

const { isSSRFTarget, resolveHostnameSSRF } = require('@librechat/api');
const FetchUrlTool = require('../FetchUrl');
const { fetchUrlContent } = require('../FetchUrl');

function createHeaders(headers = {}) {
  return { get: (name) => headers[name.toLowerCase()] };
}

function createBody(text) {
  let read = false;
  return {
    getReader: () => ({
      read: jest.fn(async () => {
        if (read) {
          return { done: true };
        }
        read = true;
        return { done: false, value: Buffer.from(text) };
      }),
    }),
  };
}

function createResponse({ status = 200, url = 'https://example.com', body = '', headers = {} }) {
  return {
    status,
    url,
    ok: status >= 200 && status < 300,
    headers: createHeaders(headers),
    body: createBody(body),
  };
}

describe('FetchUrlTool', () => {
  beforeEach(() => {
    isSSRFTarget.mockReset();
    resolveHostnameSSRF.mockReset();
    isSSRFTarget.mockReturnValue(false);
    resolveHostnameSSRF.mockResolvedValue(false);
  });

  it('uses connection-time SSRF protection and extracts bounded HTML without scripts', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(
      createResponse({
        body: '<html><head><title>Docs</title></head><body><script>secret()</script>Hello</body></html>',
        headers: { 'content-type': 'text/html; charset=utf-8' },
      }),
    );
    const output = await fetchUrlContent('https://example.com/docs', { fetchImpl });

    expect(fetchImpl).toHaveBeenCalledWith(
      'https://example.com/docs',
      expect.objectContaining({
        dispatcher: expect.anything(),
        redirect: 'manual',
        headers: {
          Accept: 'text/html,text/plain,application/json',
          'User-Agent': 'OrqestBot/1.0',
        },
      }),
    );
    expect(output).toMatchObject({ ok: true, title: 'Docs', content: 'Hello' });
  });

  it('reads plain text and JSON', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(
        createResponse({ body: ' plain text ', headers: { 'content-type': 'text/plain' } }),
      )
      .mockResolvedValueOnce(
        createResponse({
          body: '{"ok": true}',
          headers: { 'content-type': 'application/json' },
        }),
      );

    await expect(fetchUrlContent('https://example.com/a', { fetchImpl })).resolves.toMatchObject({
      content: 'plain text',
    });
    await expect(fetchUrlContent('https://example.com/b', { fetchImpl })).resolves.toMatchObject({
      content: '{"ok": true}',
    });
  });

  it('validates every redirect and blocks private destinations', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValue(
        createResponse({ status: 302, headers: { location: 'http://127.0.0.1/admin' } }),
      );
    isSSRFTarget.mockImplementation((hostname) => hostname === '127.0.0.1');

    await expect(fetchUrlContent('https://example.com', { fetchImpl })).rejects.toThrow(
      'URL blocked by SSRF protection',
    );
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('follows up to three public redirects', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(createResponse({ status: 302, headers: { location: '/second' } }))
      .mockResolvedValueOnce(
        createResponse({ body: 'done', headers: { 'content-type': 'text/plain' } }),
      );

    await expect(
      fetchUrlContent('https://example.com/first', { fetchImpl }),
    ).resolves.toMatchObject({ ok: true, content: 'done' });
    expect(fetchImpl).toHaveBeenNthCalledWith(2, 'https://example.com/second', expect.any(Object));
  });

  it.each([
    ['not a url', 'Invalid URL'],
    ['file:///etc/passwd', 'Only HTTP(S) URLs are allowed'],
    ['https://user:pass@example.com', 'URL credentials are not allowed'],
    ['http://localhost', 'URL blocked by SSRF protection'],
    ['http://[::1]', 'URL blocked by SSRF protection'],
  ])('rejects unsafe URL %s', async (url, message) => {
    isSSRFTarget.mockImplementation((hostname) => hostname === 'localhost' || hostname === '[::1]');
    await expect(fetchUrlContent(url, { fetchImpl: jest.fn() })).rejects.toThrow(message);
  });

  it('blocks hostnames resolving to private addresses', async () => {
    resolveHostnameSSRF.mockResolvedValue(true);

    await expect(
      fetchUrlContent('https://rebound.example', { fetchImpl: jest.fn() }),
    ).rejects.toThrow('URL blocked by SSRF protection');
  });

  it('aborts requests after eight seconds', async () => {
    jest.useFakeTimers();
    const fetchImpl = jest.fn(
      (_url, { signal }) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () => reject(new Error('aborted')));
        }),
    );
    const pending = fetchUrlContent('https://example.com/slow', { fetchImpl });
    const handled = pending.catch((error) => error);

    await jest.advanceTimersByTimeAsync(8000);
    await expect(handled).resolves.toThrow('aborted');
    jest.useRealTimers();
  });

  it('rejects unsupported content and oversized responses', async () => {
    const unsupportedFetch = jest
      .fn()
      .mockResolvedValue(createResponse({ headers: { 'content-type': 'application/pdf' } }));
    await expect(
      fetchUrlContent('https://example.com/file.pdf', { fetchImpl: unsupportedFetch }),
    ).resolves.toMatchObject({ ok: false, error: 'Unsupported content type: application/pdf' });

    const oversizedFetch = jest
      .fn()
      .mockResolvedValue(createResponse({ body: 'x'.repeat(500 * 1024 + 1) }));
    await expect(
      fetchUrlContent('https://example.com/large', { fetchImpl: oversizedFetch }),
    ).rejects.toThrow('Response exceeded 512000 bytes');
  });

  it('returns structured errors to the agent', async () => {
    const tool = new FetchUrlTool({
      fetchImpl: jest.fn().mockRejectedValue(new Error('This operation was aborted')),
    });
    const output = JSON.parse(await tool._call({ url: 'https://example.com' }));

    expect(output).toEqual({
      ok: false,
      url: 'https://example.com',
      error: 'This operation was aborted',
    });
  });
});
