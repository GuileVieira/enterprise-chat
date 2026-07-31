const { Agent, fetch: undiciFetch } = require('undici');
const { load } = require('cheerio');
const { Tool } = require('@langchain/core/tools');
const {
  isSSRFTarget,
  resolveHostnameSSRF,
  createSSRFSafeUndiciConnect,
} = require('@librechat/api');

const TIMEOUT_MS = 8000;
const MAX_RESPONSE_BYTES = 500 * 1024;
const MAX_REDIRECTS = 3;
const MAX_CONTENT_CHARS = 12000;
const ALLOWED_CONTENT_TYPES = ['text/html', 'text/plain', 'application/json'];
const SAFE_DISPATCHER = new Agent({ connect: createSSRFSafeUndiciConnect(), pipelining: 0 });

const fetchUrlJsonSchema = {
  type: 'object',
  properties: {
    url: {
      type: 'string',
      minLength: 1,
      description: 'A public HTTP(S) URL to read.',
    },
  },
  required: ['url'],
  additionalProperties: false,
};

function cleanText(value) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();
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
  if (parsed.username || parsed.password) {
    throw new Error('URL credentials are not allowed');
  }
  if (isSSRFTarget(parsed.hostname) || (await resolveHostnameSSRF(parsed.hostname))) {
    throw new Error('URL blocked by SSRF protection');
  }
  return parsed;
}

async function readResponseBody(response) {
  const reader = response.body?.getReader?.();
  if (!reader) {
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > MAX_RESPONSE_BYTES) {
      throw new Error(`Response exceeded ${MAX_RESPONSE_BYTES} bytes`);
    }
    return buffer.toString('utf8');
  }

  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    const chunk = Buffer.from(value);
    total += chunk.length;
    if (total > MAX_RESPONSE_BYTES) {
      throw new Error(`Response exceeded ${MAX_RESPONSE_BYTES} bytes`);
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

function extractContent(body, contentType) {
  if (contentType === 'application/json') {
    return { title: '', description: '', content: cleanText(body).slice(0, MAX_CONTENT_CHARS) };
  }
  if (contentType === 'text/plain') {
    return { title: '', description: '', content: cleanText(body).slice(0, MAX_CONTENT_CHARS) };
  }

  const $ = load(body);
  $('script, style, noscript, svg').remove();
  return {
    title: cleanText($('title').first().text()),
    description: cleanText(
      $('meta[name="description"]').attr('content') ??
        $('meta[property="og:description"]').attr('content') ??
        '',
    ),
    content: cleanText($('body').text()).slice(0, MAX_CONTENT_CHARS),
  };
}

async function fetchUrlContent(url, { fetchImpl = undiciFetch, dispatcher } = {}) {
  const safeDispatcher = dispatcher ?? SAFE_DISPATCHER;
  let currentUrl = url;

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount++) {
    await assertPublicHttpUrl(currentUrl);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const response = await fetchImpl(currentUrl, {
        dispatcher: safeDispatcher,
        signal: controller.signal,
        redirect: 'manual',
        headers: {
          Accept: 'text/html,text/plain,application/json',
          'User-Agent': 'OrqestBot/1.0',
        },
      });

      const location = response.headers?.get('location');
      if (response.status >= 300 && response.status < 400 && location) {
        currentUrl = new URL(location, currentUrl).toString();
        continue;
      }
      if (!response.ok) {
        return {
          ok: false,
          status: response.status,
          url: currentUrl,
          error: `HTTP ${response.status}`,
        };
      }

      const contentType = (response.headers?.get('content-type') ?? 'text/html')
        .split(';')[0]
        .trim()
        .toLowerCase();
      if (!ALLOWED_CONTENT_TYPES.includes(contentType)) {
        return {
          ok: false,
          status: response.status,
          url: currentUrl,
          error: `Unsupported content type: ${contentType || 'unknown'}`,
        };
      }

      const body = await readResponseBody(response);
      return {
        ok: true,
        status: response.status,
        url: response.url || currentUrl,
        ...extractContent(body, contentType),
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  return { ok: false, url: currentUrl, error: 'Too many redirects' };
}

class FetchUrlTool extends Tool {
  static lc_name() {
    return 'FetchUrlTool';
  }

  static get jsonSchema() {
    return fetchUrlJsonSchema;
  }

  constructor(fields = {}) {
    super(fields);
    this.name = 'fetch_url';
    this.description =
      'When the user provides a public URL or asks what a page contains, call this tool before answering. Never claim URL access is unavailable without calling it.';
    this.schema = fetchUrlJsonSchema;
    this.fetchImpl = fields.fetchImpl;
    this.dispatcher = fields.dispatcher;
  }

  async _call(input) {
    try {
      return JSON.stringify(
        await fetchUrlContent(input?.url, {
          fetchImpl: this.fetchImpl,
          dispatcher: this.dispatcher,
        }),
      );
    } catch (error) {
      return JSON.stringify({
        ok: false,
        url: typeof input?.url === 'string' ? input.url : '',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

module.exports = FetchUrlTool;
module.exports.fetchUrlContent = fetchUrlContent;
module.exports.fetchUrlJsonSchema = fetchUrlJsonSchema;
