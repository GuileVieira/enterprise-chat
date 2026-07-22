const { fetch: undiciFetch } = require('undici');
const { load } = require('cheerio');
const { Tool } = require('@langchain/core/tools');
const { DuckDuckGoSearch } = require('@langchain/community/tools/duckduckgo_search');
const { isSSRFTarget, resolveHostnameSSRF } = require('@librechat/api');

const DEFAULT_MAX_RESULTS = 5;
const DEFAULT_FETCH_RESULTS = true;
const DEFAULT_FETCH_TIMEOUT_MS = 8000;
const DEFAULT_MAX_CONTENT_CHARS = 4000;
const DEFAULT_MAX_RESPONSE_BYTES = 500 * 1024;
const DEFAULT_MAX_REDIRECTS = 3;

const duckDuckGoSearchJsonSchema = {
  type: 'object',
  properties: {
    query: {
      type: 'string',
      minLength: 1,
      description: 'The web search query.',
    },
    max_results: {
      type: 'integer',
      minimum: 1,
      maximum: 10,
      description: 'Maximum search results to return. Defaults to 5.',
    },
    fetch_results: {
      type: 'boolean',
      description: 'Whether to fetch and extract readable text from each result. Defaults to true.',
    },
    max_content_chars: {
      type: 'integer',
      minimum: 500,
      maximum: 12000,
      description: 'Maximum extracted content characters per fetched result. Defaults to 4000.',
    },
  },
  required: ['query'],
};

function clampInteger(value, min, max, fallback) {
  if (!Number.isInteger(value)) {
    return fallback;
  }
  return Math.min(Math.max(value, min), max);
}

function cleanText(value) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseSearchResults(raw) {
  if (Array.isArray(raw)) {
    return raw;
  }
  if (typeof raw !== 'string') {
    return [];
  }
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function normalizeSearchResult(result) {
  const link = typeof result.link === 'string' ? result.link : result.url;
  return {
    title: cleanText(result.title),
    link: typeof link === 'string' ? link : '',
    snippet: cleanText(result.snippet ?? result.description),
  };
}

async function assertPublicHttpUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('Invalid URL');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Only HTTP(S) URLs are allowed');
  }

  if (isSSRFTarget(parsed.hostname) || (await resolveHostnameSSRF(parsed.hostname))) {
    throw new Error('URL blocked by SSRF protection');
  }

  return parsed;
}

async function readResponseBody(response, maxBytes) {
  if (!response.body?.getReader) {
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > maxBytes) {
      throw new Error(`Response exceeded ${maxBytes} bytes`);
    }
    return buffer.toString('utf8');
  }

  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    const chunk = Buffer.from(value);
    total += chunk.length;
    if (total > maxBytes) {
      throw new Error(`Response exceeded ${maxBytes} bytes`);
    }
    chunks.push(chunk);
  }

  return Buffer.concat(chunks).toString('utf8');
}

function extractText(html, maxContentChars) {
  const $ = load(html);
  $('script, style, noscript, svg').remove();
  const title = cleanText($('title').first().text());
  const description = cleanText(
    $('meta[name="description"]').attr('content') ??
      $('meta[property="og:description"]').attr('content') ??
      '',
  );
  const content = cleanText($('body').text()).slice(0, maxContentChars);
  return { title, description, content };
}

async function fetchUrlContent(url, options = {}) {
  const {
    fetchImpl = undiciFetch,
    timeoutMs = DEFAULT_FETCH_TIMEOUT_MS,
    maxBytes = DEFAULT_MAX_RESPONSE_BYTES,
    maxRedirects = DEFAULT_MAX_REDIRECTS,
    maxContentChars = DEFAULT_MAX_CONTENT_CHARS,
  } = options;

  let currentUrl = url;
  for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount++) {
    await assertPublicHttpUrl(currentUrl);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    let response;
    try {
      response = await fetchImpl(currentUrl, {
        signal: controller.signal,
        redirect: 'manual',
        headers: {
          Accept: 'text/html,text/plain,application/json;q=0.9,*/*;q=0.8',
          'User-Agent': 'OrqestBot/1.0',
        },
      });
    } finally {
      clearTimeout(timeout);
    }

    const status = response.status;
    if (status >= 300 && status < 400 && response.headers?.get('location')) {
      const nextUrl = new URL(response.headers.get('location'), currentUrl).toString();
      currentUrl = nextUrl;
      continue;
    }

    if (!response.ok) {
      return {
        ok: false,
        status,
        url: currentUrl,
        error: `HTTP ${status}`,
      };
    }

    const html = await readResponseBody(response, maxBytes);
    const extracted = extractText(html, maxContentChars);
    return {
      ok: true,
      status,
      url: response.url || currentUrl,
      ...extracted,
    };
  }

  return {
    ok: false,
    url: currentUrl,
    error: 'Too many redirects',
  };
}

class DuckDuckGoSearchTool extends Tool {
  static lc_name() {
    return 'DuckDuckGoSearchTool';
  }

  static get jsonSchema() {
    return duckDuckGoSearchJsonSchema;
  }

  constructor(fields = {}) {
    super(fields);
    this.name = 'duckduckgo_search';
    this.description =
      'Search DuckDuckGo and optionally fetch readable text from each result. Useful for open web research without API keys.';
    this.schema = duckDuckGoSearchJsonSchema;
    this.searchTool = fields.searchTool;
    this.fetchImpl = fields.fetchImpl;
  }

  async _call(input) {
    const query = cleanText(input?.query);
    if (!query) {
      return JSON.stringify({ ok: false, query, error: 'Query cannot be empty', results: [] });
    }

    const maxResults = clampInteger(input?.max_results, 1, 10, DEFAULT_MAX_RESULTS);
    const fetchResults =
      typeof input?.fetch_results === 'boolean' ? input.fetch_results : DEFAULT_FETCH_RESULTS;
    const maxContentChars = clampInteger(
      input?.max_content_chars,
      500,
      12000,
      DEFAULT_MAX_CONTENT_CHARS,
    );

    const searchTool = this.searchTool ?? new DuckDuckGoSearch({ maxResults });
    const rawResults = await searchTool.invoke(query);
    const results = parseSearchResults(rawResults)
      .map(normalizeSearchResult)
      .filter((result) => result.link)
      .slice(0, maxResults);

    if (!fetchResults) {
      return JSON.stringify({ ok: true, query, results });
    }

    const hydratedResults = await Promise.all(
      results.map(async (result) => {
        try {
          const fetched = await fetchUrlContent(result.link, {
            fetchImpl: this.fetchImpl,
            maxContentChars,
          });
          return { ...result, fetch: fetched };
        } catch (error) {
          return {
            ...result,
            fetch: {
              ok: false,
              url: result.link,
              error: error instanceof Error ? error.message : String(error),
            },
          };
        }
      }),
    );

    return JSON.stringify({ ok: true, query, results: hydratedResults });
  }
}

module.exports = DuckDuckGoSearchTool;
module.exports.fetchUrlContent = fetchUrlContent;
module.exports.duckDuckGoSearchJsonSchema = duckDuckGoSearchJsonSchema;
