# Tenant Functions

Tenant Functions are dynamic, tenant-scoped tools that agents can call at runtime. They allow operators to define custom HTTP integrations (e.g., Meta Ads, Google Analytics, CRM APIs) via CLI, without modifying code or restarting the server.

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Concepts](#concepts)
4. [Quick Start](#quick-start)
5. [CLI Reference](#cli-reference)
   - [manage-functions](#manage-functions)
   - [manage-secrets](#manage-secrets)
6. [Function Definition Format](#function-definition-format)
7. [Input Schema Format](#input-schema-format)
8. [Auth Types](#auth-types)
9. [Post-Processing](#post-processing)
10. [Security](#security)
11. [Troubleshooting](#troubleshooting)

---

## Overview

Unlike built-in tools or MCP servers, Tenant Functions are:

- **Defined per tenant** — each tenant has its own set of functions and secrets
- **Managed via CLI** — no UI panel needed; create, update, and delete from the terminal
- **HTTP-based** — make requests to external APIs with configurable auth
- **Dynamic** — changes are effective immediately for new agent runs
- **Secure** — secrets are encrypted at rest and never exposed to users

### When to use Tenant Functions

| Use case | Example |
|----------|---------|
| Query external APIs | Meta Ads campaign metrics, Google Analytics data |
| Aggregate data | Combine results from multiple sources |
| Transform responses | Filter and reshape API responses before sending to LLM |
| Tenant-specific integrations | Each tenant connects to their own CRM/ERP |

---

## Architecture

```
Agent Config (UI)
    └─ tools: ["meta-ads-relatorio", "web_search"]
           │
           ▼
Backend: loadToolDefinitions()
    ├─ Built-in tools (calculator, web_search, ...)
    ├─ MCP tools
    ├─ Action tools (OpenAPI)
    └─ Tenant Functions ← loaded from MongoDB
           │
           ▼
LLM sees available tools and decides to call "meta-ads-relatorio"
           │
           ▼
Backend: loadToolsForExecution()
    └─ DynamicStructuredTool created with Zod schema
           │
           ▼
Executor: HTTP request + auth injection + optional postProcess
           │
           ▼
Result returned to LLM as JSON string
```

---

## Concepts

### TenantFunction

A document in MongoDB (`tenantfunctions` collection) that defines:
- **id** — unique slug per tenant (e.g., `meta-ads-relatorio`)
- **name** — display name
- **description** — shown to the LLM so it knows when to use the tool
- **config** — HTTP method, base URL, path, headers, auth
- **inputSchema** — parameters the LLM should provide
- **postProcess** — optional JavaScript to transform the response

### TenantSecret

A document in MongoDB (`tenantsecrets` collection) that stores encrypted credentials:
- **name** — referenced by functions (e.g., `meta-ads-token`)
- **value** — encrypted with `encryptV2` (AES-CBC with random IV)
- **type** — `bearer`, `basic`, `api_key`, or `custom`

---

## Quick Start

### 1. Create a secret

```bash
npm run create-secret -- \
  --tenant=acme \
  --name=meta-ads-token \
  --type=bearer \
  --value="EAAxxxxxxxx"
```

### 2. Create a function definition file

`meta-ads.json`:
```json
{
  "id": "meta-ads-relatorio",
  "name": "Meta Ads - Relatório de Campanhas",
  "description": "Lista campanhas e métricas de performance de uma conta de anúncios do Meta.",
  "config": {
    "baseUrl": "https://graph.facebook.com/v18.0",
    "method": "GET",
    "path": "/act_{adAccountId}/campaigns",
    "auth": {
      "type": "bearer",
      "secretName": "meta-ads-token"
    }
  },
  "inputSchema": {
    "adAccountId": {
      "type": "string",
      "description": "ID da conta de anúncios (act_123456789)",
      "required": true
    },
    "status": {
      "type": "string",
      "description": "Filtrar por status",
      "enum": ["ACTIVE", "PAUSED", "DELETED"]
    }
  },
  "postProcess": "(data) => data.data.map((c) => ({ id: c.id, name: c.name, status: c.status }))"
}
```

### 3. Register the function

```bash
npm run create-function -- \
  --tenant=acme \
  --file=meta-ads.json
```

### 4. Attach to an agent

In the agent builder UI, add `meta-ads-relatorio` to the agent's tools list. The function will appear as an available tool.

### 5. Test

Start a conversation with the agent and ask:
> "Quais campanhas estão ativas na conta act_123456789?"

---

## CLI Reference

### manage-functions

```bash
npm run list-functions    -- --tenant=<tenantId>
npm run show-function     -- --tenant=<tenantId> --id=<funcId>
npm run create-function   -- --tenant=<tenantId> --file=<path>
npm run update-function   -- --tenant=<tenantId> --id=<funcId> --file=<path>
npm run toggle-function   -- --tenant=<tenantId> --id=<funcId> --active=true|false
npm run delete-function   -- --tenant=<tenantId> --id=<funcId>
```

### manage-secrets

```bash
npm run list-secrets      -- --tenant=<tenantId>
npm run create-secret     -- --tenant=<tenantId> --name=<name> --type=<type> --value=<value>
npm run rotate-secret     -- --tenant=<tenantId> --name=<name> --value=<value>
npm run delete-secret     -- --tenant=<tenantId> --name=<name>
```

**Note:** `delete-secret` will warn you if the secret is still referenced by any function.

---

## Function Definition Format

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Unique slug per tenant. Only lowercase letters, numbers, `_`, `-`. |
| `name` | string | Yes | Human-readable name. |
| `description` | string | Yes | Description shown to the LLM. Be specific about what the tool does. |
| `config.baseUrl` | string | Yes | Base URL of the API. |
| `config.method` | string | Yes | HTTP method: `GET`, `POST`, `PUT`, `DELETE`, `PATCH`. |
| `config.path` | string | Yes | API path. Use `{paramName}` for path parameters. |
| `config.headers` | object | No | Additional headers to send. |
| `config.auth` | object | No | Auth configuration (see below). |
| `inputSchema` | object | Yes | Schema of parameters the LLM should provide. |
| `postProcess` | string | No | JavaScript function body to transform the response. |
| `isActive` | boolean | No | Default `true`. Inactive functions are ignored by agents. |

---

## Input Schema Format

The `inputSchema` uses a simplified JSON format that is converted to JSON Schema for the LLM and to Zod for runtime validation.

```json
{
  "adAccountId": {
    "type": "string",
    "description": "ID da conta",
    "required": true
  },
  "limit": {
    "type": "number",
    "description": "Máximo de resultados",
    "default": 10
  },
  "status": {
    "type": "string",
    "description": "Status da campanha",
    "enum": ["ACTIVE", "PAUSED"]
  }
}
```

Supported types: `string`, `number`, `integer`, `boolean`, `array`, `object`.

- **required: true** — the LLM must provide this parameter
- **enum** — restricts valid values
- **default** — shown to the LLM as the default value

### Path vs Query Parameters

Parameters used in `config.path` (e.g., `{adAccountId}`) are substituted into the URL. All other parameters are sent as query parameters (for GET) or in the request body (for POST/PUT/PATCH).

---

## Auth Types

| Type | How it works | Required fields |
|------|-------------|-----------------|
| `bearer` | Sends `Authorization: Bearer <value>` | `secretName` |
| `basic` | Sends `Authorization: Basic <base64(value)>` | `secretName` |
| `api_key` | Sends `<headerName>: <value>` | `secretName`, `headerName` (defaults to `X-API-Key`) |
| `custom` | Sends `<headerName>: <value>` | `secretName`, `headerName` (defaults to `Authorization`) |

---

## Post-Processing

The `postProcess` field is a string containing a JavaScript function that transforms the API response before returning it to the LLM.

### Examples

**Extract a field:**
```json
"postProcess": "(data) => data.campaigns"
```

**Map and filter:**
```json
"postProcess": "(data) => data.data.map(c => ({ id: c.id, name: c.name })).filter(c => c.name !== '')"
```

**Aggregate metrics:**
```json
"postProcess": "(data) => ({ totalSpend: data.data.reduce((sum, c) => sum + c.spend, 0), count: data.data.length })"
```

### Security

- Post-process code runs in a sandboxed `new Function` with strict mode
- Execution is limited to 5 seconds by default (configurable)
- The code does not have access to globals like `process`, `require`, or `fetch`
- **Important:** synchronous infinite loops (e.g., `while(true) {}`) cannot be interrupted. Avoid untrusted post-process code.

---

## Security

### Secret Storage

- Secrets are encrypted with AES-CBC and a random IV per encryption (`encryptV2`)
- Encryption key is derived from `CREDS_KEY` and `CREDS_IV` environment variables
- Secrets are never returned in API responses
- Only the backend executor decrypts secrets at runtime

### Tenant Isolation

- All queries are scoped by `tenantId` via Mongoose tenant isolation plugin
- A function from tenant A cannot access secrets from tenant B
- Cross-tenant mutations are blocked at the database level

### SSRF Protection

- HTTP requests use `maxRedirects: 0`
- The backend controls the base URL and path; only query/body parameters come from the LLM

---

## Troubleshooting

### Function not appearing in agent tools

1. Check if the function is active: `npm run show-function -- --tenant=ACME --id=my-function`
2. Ensure the function `id` is in the agent's `tools` array
3. Verify the agent is using the correct tenant

### "Secret not found" error

1. Check if the secret exists: `npm run list-secrets -- --tenant=ACME`
2. Verify the `secretName` in the function config matches exactly
3. Secrets are case-sensitive

### "Function not found or inactive" error

1. Check function status: `npm run show-function -- --tenant=ACME --id=my-function`
2. If inactive, activate it: `npm run toggle-function -- --tenant=ACME --id=my-function --active=true`

### Post-process timeout

- Complex transformations may exceed the 5s timeout
- Optimize the code or reduce the data size in the API request (e.g., add `limit` parameter)
- For very large responses, consider filtering at the API level instead of post-processing

### LLM not calling the tool

- Improve the `description` to be more specific about when to use the tool
- Ensure the `inputSchema` clearly documents all parameters
- Verify the function is attached to the agent and the agent is selected in the conversation

---

## Files Added/Modified

| File | Purpose |
|------|---------|
| `packages/data-schemas/src/schema/tenantFunction.ts` | Mongoose schema for functions |
| `packages/data-schemas/src/schema/tenantSecret.ts` | Mongoose schema for secrets |
| `packages/data-schemas/src/methods/tenantFunction.ts` | CRUD methods for functions |
| `packages/data-schemas/src/methods/tenantSecret.ts` | CRUD methods for secrets |
| `packages/api/src/tools/tenant-functions/` | Backend module: loader, executor, parser, safe-function |
| `packages/api/src/tools/definitions.ts` | Integrated tenant functions into tool loading |
| `api/server/services/ToolService.js` | Integrated tenant functions into tool execution |
| `config/manage-functions.js` | CLI for managing functions |
| `config/manage-secrets.js` | CLI for managing secrets |
| `docs/TENANT_FUNCTIONS.md` | This documentation |
