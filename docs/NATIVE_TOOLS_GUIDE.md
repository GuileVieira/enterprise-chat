# Native Tools Guide

Native tools are backend tools shipped with the application code. They run inside the Node.js backend process and require deploy/restart after changes.

Use native tools only for platform-level capabilities. For tenant/customer-specific HTTP integrations, prefer Tenant Functions or MCP servers.

## Runtime

- Language: JavaScript, CommonJS.
- Runtime: Node.js backend.
- Tool framework: `@langchain/core/tools`.
- Tool files live in `api/app/clients/tools/structured/`.
- Tool metadata lives in `api/app/clients/tools/manifest.json`.
- Loader lives in `api/server/services/start/tools.js`.

The loader scans `api/app/clients/tools/structured/*.js`, requires each file, and instantiates exported classes that extend LangChain `Tool`.

## Existing Examples

- `api/app/clients/tools/structured/OpenWeather.js`: class-based `Tool` with JSON schema.
- `api/app/clients/tools/structured/TavilySearch.js`: factory using LangChain `tool()` and Zod schema.
- `api/app/clients/tools/structured/TavilySearchResults.js`: class-based search tool with env auth.
- `api/app/clients/tools/structured/OpenAIImageTools.js`: toolkit-style multi-tool implementation.

## Tool Contract

A native tool must expose:

- `name`: stable tool id used by agents and UI.
- `description`: clear instruction for when/how LLM should call it.
- `schema`: JSON Schema or Zod schema for parameters.
- `_call(args)`: async executor returning string. Prefer JSON string for structured results.

Keep names snake_case. Do not rename a tool after release unless you migrate existing agent `tools`.

## Minimal Tool

Create `api/app/clients/tools/structured/CustomerLookup.js`:

```js
const { Tool } = require('@langchain/core/tools');

const customerLookupSchema = {
  type: 'object',
  properties: {
    email: {
      type: 'string',
      description: 'Customer email address.',
    },
  },
  required: ['email'],
};

class CustomerLookup extends Tool {
  name = 'customer_lookup';
  description = 'Looks up a customer profile by email.';
  schema = customerLookupSchema;

  static get jsonSchema() {
    return customerLookupSchema;
  }

  async _call(args) {
    const { email } = args;

    if (!email) {
      throw new Error('email is required');
    }

    return JSON.stringify({
      email,
      status: 'found',
      plan: 'pro',
    });
  }
}

module.exports = CustomerLookup;
```

## Tool With API Key

Pattern:

```js
const { Tool } = require('@langchain/core/tools');
const { getEnvironmentVariable } = require('@langchain/core/utils/env');

class MyApiTool extends Tool {
  name = 'my_api_tool';
  description = 'Calls my external API.';
  schema = {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search query.' },
    },
    required: ['query'],
  };

  constructor(fields = {}) {
    super();
    this.envVar = 'MY_API_KEY';
    this.override = fields.override ?? false;
    this.apiKey = fields[this.envVar] ?? this.getApiKey();
  }

  getApiKey() {
    const key = getEnvironmentVariable(this.envVar);
    if (!key && !this.override) {
      throw new Error(`Missing ${this.envVar} environment variable.`);
    }
    return key;
  }

  async _call(args) {
    return JSON.stringify({ ok: true, query: args.query });
  }
}

module.exports = MyApiTool;
```

The loader instantiates with `{ override: true }`, so startup does not fail when the key is missing. Actual execution should still fail clearly if the key is required and absent.

## Manifest Entry

Add an entry to `api/app/clients/tools/manifest.json` so UI/auth can display the tool:

```json
{
  "name": "Customer Lookup",
  "pluginKey": "customer_lookup",
  "description": "Looks up customer profile data.",
  "icon": "assets/tool.svg",
  "authConfig": [
    {
      "authField": "CUSTOMER_API_KEY",
      "label": "Customer API Key",
      "description": "API key for customer profile lookup."
    }
  ]
}
```

Rules:

- `pluginKey` must match `tool.name` for normal single tools.
- Use `authConfig: []` if no auth.
- For alternate env vars, use `FIELD_A||FIELD_B`.
- Put icon in existing asset path or use URL.

## Config Allow/Block

Native tools can be controlled by config:

```yaml
includedTools:
  - customer_lookup

filteredTools:
  - open_weather
```

If both are set, included tools win and filtered tools are ignored.

## Agent Availability

Native tools become available to agents through the tools list. Agent records store selected tools in `agent.tools`.

For a new native tool to be usable:

1. Tool file loads without error.
2. Manifest exposes it to UI.
3. Runtime config does not filter it.
4. User/role has tool/agent capability.
5. Agent has the tool selected.

## Testing

Add tests under `api/app/clients/tools/structured/specs/`.

Example `CustomerLookup.spec.js`:

```js
const CustomerLookup = require('../CustomerLookup');

describe('CustomerLookup', () => {
  it('returns customer profile JSON', async () => {
    const tool = new CustomerLookup({ override: true });

    const result = await tool.call({
      email: 'a@example.com',
    });

    expect(JSON.parse(result)).toEqual({
      email: 'a@example.com',
      status: 'found',
      plan: 'pro',
    });
  });

  it('requires email', async () => {
    const tool = new CustomerLookup({ override: true });

    await expect(tool.call({})).rejects.toThrow('email is required');
  });
});
```

For external HTTP calls:

- Mock `fetch`, `undici`, or client SDK.
- Do not hit real APIs in unit tests.
- Test auth missing, API error, success, and response normalization.

Run one spec:

```bash
cd api
npm run test:ci -- --runTestsByPath app/clients/tools/structured/specs/CustomerLookup.spec.js --runInBand
```

Run backend tests:

```bash
cd api
npm run test:ci
```

## Manual Verification

1. Add env vars to `.env` if needed.
2. Restart backend:

```bash
npm run backend:dev
```

3. Restart frontend if UI metadata changed:

```bash
npm run frontend:dev
```

4. Open agent builder.
5. Add tool to an agent.
6. Send a prompt that forces tool usage.
7. Confirm tool call appears in message trace/output.

## Safety

- Do not expose tenant/customer secrets through native tools.
- Validate required args before making external calls.
- Return compact JSON; avoid dumping huge API responses.
- Apply request timeout for external calls.
- Respect proxy env if the repo pattern supports it.
- Use `tenantId` gates manually if behavior must vary by tenant.
- Prefer Tenant Functions for customer-specific APIs because they are tenant-scoped and secret-backed.

## When Not To Use Native Tools

Use Tenant Functions when:

- Integration is HTTP.
- Tool should belong to one tenant/customer.
- Admin should configure it without deploy.
- Secret should live in tenant secret storage.

Use MCP when:

- One integration exposes many tools/resources.
- Server can be managed outside LibreChat.
- Tool implementation may be Python, TS, Go, etc.

Use native tools when:

- Feature is core platform behavior.
- Code must run in-process.
- You need deep access to backend internals.
