const DuckDuckGoSearchTool = require('../DuckDuckGoSearch');
const { fetchUrlContent } = require('../DuckDuckGoSearch');
const { isSSRFTarget, resolveHostnameSSRF } = require('@librechat/api');

jest.mock('@librechat/api', () => ({
  isSSRFTarget: jest.fn(),
  resolveHostnameSSRF: jest.fn(),
}));

function createHeaders(headers = {}) {
  return {
    get: (name) => headers[name.toLowerCase()],
  };
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

describe('DuckDuckGoSearchTool', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    isSSRFTarget.mockReturnValue(false);
    resolveHostnameSSRF.mockResolvedValue(false);
  });

  it('returns normalized search results', async () => {
    const searchTool = {
      invoke: jest.fn().mockResolvedValue(
        JSON.stringify([
          {
            title: ' Result title ',
            link: 'https://example.com/page',
            snippet: ' Result snippet ',
          },
        ]),
      ),
    };
    const tool = new DuckDuckGoSearchTool({ searchTool });

    const output = JSON.parse(
      await tool._call({ query: 'latest ads news', fetch_results: false, max_results: 1 }),
    );

    expect(output).toEqual({
      ok: true,
      query: 'latest ads news',
      results: [
        {
          title: 'Result title',
          link: 'https://example.com/page',
          snippet: 'Result snippet',
        },
      ],
    });
    expect(searchTool.invoke).toHaveBeenCalledWith('latest ads news');
  });

  it('does not fetch pages when fetch_results=false', async () => {
    const searchTool = {
      invoke: jest.fn().mockResolvedValue(
        JSON.stringify([{ title: 'Title', link: 'https://example.com', snippet: 'Snippet' }]),
      ),
    };
    const fetchImpl = jest.fn();
    const tool = new DuckDuckGoSearchTool({ searchTool, fetchImpl });

    await tool._call({ query: 'query', fetch_results: false });

    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('fetches page content and truncates extracted text', async () => {
    const searchTool = {
      invoke: jest.fn().mockResolvedValue(
        JSON.stringify([{ title: 'Title', link: 'https://example.com', snippet: 'Snippet' }]),
      ),
    };
    const fetchImpl = jest.fn().mockResolvedValue(
      createResponse({
        body: '<html><head><title>Page title</title></head><body><script>x</script><p>Hello long content</p></body></html>',
      }),
    );
    const tool = new DuckDuckGoSearchTool({ searchTool, fetchImpl });

    const output = JSON.parse(
      await tool._call({ query: 'query', max_content_chars: 500, fetch_results: true }),
    );

    expect(output.results[0].fetch).toMatchObject({
      ok: true,
      status: 200,
      title: 'Page title',
      content: 'Hello long content',
    });
  });

  it('returns structured fetch errors for blocked HTTP status', async () => {
    const searchTool = {
      invoke: jest.fn().mockResolvedValue(
        JSON.stringify([{ title: 'Title', link: 'https://example.com', snippet: 'Snippet' }]),
      ),
    };
    const fetchImpl = jest.fn().mockResolvedValue(createResponse({ status: 403 }));
    const tool = new DuckDuckGoSearchTool({ searchTool, fetchImpl });

    const output = JSON.parse(await tool._call({ query: 'query' }));

    expect(output.results[0].fetch).toEqual({
      ok: false,
      status: 403,
      url: 'https://example.com',
      error: 'HTTP 403',
    });
  });

  it('returns structured fetch errors for timeout/rejection', async () => {
    const searchTool = {
      invoke: jest.fn().mockResolvedValue(
        JSON.stringify([{ title: 'Title', link: 'https://example.com', snippet: 'Snippet' }]),
      ),
    };
    const fetchImpl = jest.fn().mockRejectedValue(new Error('This operation was aborted'));
    const tool = new DuckDuckGoSearchTool({ searchTool, fetchImpl });

    const output = JSON.parse(await tool._call({ query: 'query' }));

    expect(output.results[0].fetch).toMatchObject({
      ok: false,
      url: 'https://example.com',
      error: 'This operation was aborted',
    });
  });

  it('blocks private URLs before fetch', async () => {
    isSSRFTarget.mockReturnValue(true);
    const fetchImpl = jest.fn();

    await expect(fetchUrlContent('http://127.0.0.1/admin', { fetchImpl })).rejects.toThrow(
      'URL blocked by SSRF protection',
    );
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('rejects responses larger than the byte limit', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(createResponse({ body: 'x'.repeat(20) }));

    await expect(
      fetchUrlContent('https://example.com/large', {
        fetchImpl,
        maxBytes: 10,
      }),
    ).rejects.toThrow('Response exceeded 10 bytes');
  });
});
