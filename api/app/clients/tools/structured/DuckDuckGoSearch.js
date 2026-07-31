const { Tool } = require('@langchain/core/tools');
const { DuckDuckGoSearch } = require('@langchain/community/tools/duckduckgo_search');

const MAX_RESULTS = 5;

const duckDuckGoSearchJsonSchema = {
  type: 'object',
  properties: {
    query: {
      type: 'string',
      minLength: 1,
      description: 'The web search query.',
    },
  },
  required: ['query'],
};

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
      'Search DuckDuckGo once for public web pages. Returns up to 5 titles, URLs, and snippets. Use fetch_url to read a result. If ok is false, do not retry; explain the search failure.';
    this.schema = duckDuckGoSearchJsonSchema;
    this.searchTool = fields.searchTool;
  }

  async _call(input) {
    const query = cleanText(input?.query);
    if (!query) {
      return JSON.stringify({ ok: false, query, error: 'Query cannot be empty', results: [] });
    }

    try {
      const searchTool = this.searchTool ?? new DuckDuckGoSearch({ maxResults: MAX_RESULTS });
      const rawResults = await searchTool.invoke(query);
      const results = parseSearchResults(rawResults)
        .map((result) => ({
          title: cleanText(result.title),
          url: typeof (result.link ?? result.url) === 'string' ? (result.link ?? result.url) : '',
          snippet: cleanText(result.snippet ?? result.description),
        }))
        .filter((result) => result.url)
        .slice(0, MAX_RESULTS);

      return JSON.stringify({ ok: true, query, results });
    } catch (error) {
      return JSON.stringify({
        ok: false,
        query,
        error: error instanceof Error ? error.message : String(error),
        retryable: false,
        results: [],
      });
    }
  }
}

module.exports = DuckDuckGoSearchTool;
module.exports.duckDuckGoSearchJsonSchema = duckDuckGoSearchJsonSchema;
