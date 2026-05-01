# Tenant Functions — TODO / Future Features

This document tracks planned enhancements for the Tenant Functions system.

---

## 0. Production Validation Checklist

**Status:** Required before client rollout

**Goal:** prove Tenant Functions are production-safe before using them with client agents.

### DB and Admin

- [ ] Create a tenant function in Mongo/Admin with `tenantId`, `id`, `name`, `description`, `isActive: true`, `inputSchema`, and HTTP `config`.
- [ ] Verify unique constraint: same `{ tenantId, id }` cannot be created twice.
- [ ] Verify same `id` can exist in different tenants.
- [ ] Verify inactive functions are hidden from normal agent users.
- [ ] Verify admin list endpoint returns functions only for requested tenant.

### User Listing and UI

- [ ] Login as a user with `tenantId`.
- [ ] Call `GET /api/agents/tenant-functions`.
- [ ] Confirm response includes only active functions for that user's tenant.
- [ ] Open agent builder.
- [ ] Confirm `Tenant Functions` section appears when tenant has active functions.
- [ ] Select one function, save the agent, reload builder.
- [ ] Confirm selected function remains checked.

### Agent Persistence

- [ ] Inspect saved agent in Mongo.
- [ ] Confirm `tools` contains the selected tenant function `id`.
- [ ] Unselect function, save agent.
- [ ] Confirm `tools` no longer contains the function `id`.
- [ ] Confirm selecting tenant function does not corrupt normal tools/actions/MCP tools.

### Runtime Execution

- [ ] Create a simple `GET` tenant function against a test endpoint that echoes query params.
- [ ] Attach it to an agent.
- [ ] Ask agent to call it with explicit args.
- [ ] Confirm model emits tool call with correct tool name.
- [ ] Confirm backend loads it in `ToolService`.
- [ ] Confirm HTTP request is sent.
- [ ] Confirm tool result returns to model and appears in final answer.

### Secrets and Auth

- [ ] Create a `tenantSecret`.
- [ ] Create function with `auth.type: bearer`.
- [ ] Confirm request sends `Authorization: Bearer <secret>`.
- [ ] Create function with `auth.type: api_key`.
- [ ] Confirm request sends configured API key header.
- [ ] Create function with missing `secretName`.
- [ ] Confirm execution fails with controlled, readable error.
- [ ] Confirm secret value is never returned to frontend or chat.

### Tenant Isolation

- [ ] Login as tenant A and confirm tenant A functions list.
- [ ] Login as tenant B and confirm tenant A functions are not listed.
- [ ] Manually add tenant A function `id` into tenant B agent `tools`.
- [ ] Run tenant B agent and confirm runtime ignores/fails the function.
- [ ] Confirm tenant B cannot use tenant A secrets.

### HTTP Semantics

- [ ] Test path params: `/customers/{customerId}` replaces `customerId`.
- [ ] Test query params for `GET`.
- [ ] Test `POST` with payload.
- [ ] Test `PUT/PATCH` with payload.
- [ ] If POST/PUT/PATCH body is not sent, fix executor to pass non-path args as `data` for body methods.
- [ ] Test non-2xx responses.
- [ ] Test timeout behavior.
- [ ] Test redirect behavior (`maxRedirects: 0`).

### Safety

- [ ] Add/verify SSRF protection or domain allowlist for tenant functions.
- [ ] Block localhost/private IP targets unless explicitly allowed for internal deployments.
- [ ] Limit response size before returning to model.
- [ ] Redact sensitive headers/secret values from logs.
- [ ] Validate `inputSchema` before saving function.
- [ ] Validate `baseUrl` and `path` before saving function.

### Post Process

- [ ] Test function without `postProcess`.
- [ ] Test function with safe `postProcess`.
- [ ] Test invalid `postProcess`.
- [ ] Confirm `postProcess` cannot access unsafe globals, filesystem, network, or secrets.
- [ ] Confirm post-processed result is returned to model.

### Observability

- [ ] Log tenant function execution start/end with `tenantId`, function `id`, agent id, user id.
- [ ] Log duration and status code.
- [ ] Log controlled error reason.
- [ ] Add metric/counter for executions and failures.
- [ ] Confirm logs do not contain secrets.

### Automated Tests

- [ ] Unit test `getTenantFunctionDefinitions`.
- [ ] Unit test input schema to Zod conversion.
- [ ] Unit test URL path param replacement.
- [ ] Unit test query/body behavior.
- [ ] Unit test auth header generation.
- [ ] Unit test missing secret error.
- [ ] Unit test tenant isolation lookup.
- [ ] Integration test: create function, attach to agent, execute tool call.
- [ ] Integration test: tenant B cannot execute tenant A function.

### Acceptance Criteria

- [ ] Tenant functions are tenant-scoped.
- [ ] Agent builder can select/save/remove them.
- [ ] Runtime can execute selected functions.
- [ ] Secrets work and do not leak.
- [ ] GET and POST both work.
- [ ] Tenant isolation is enforced at list and execution time.
- [ ] Failures are readable and do not crash the conversation.
- [ ] Basic logs/metrics exist for support.

---

## 1. Function Pipelines (Composite Functions)

**Status:** Planned

**Problem:** Some workflows require multiple API calls in sequence (e.g., list campaigns → fetch insights → aggregate). Today the LLM can orchestrate this manually, but it requires good prompting and is not deterministic.

**Proposed Solution:** Allow admins to define **Function Pipelines** — pre-defined sequences of tenant functions that execute as a single tool call.

### Pipeline Definition Schema

```typescript
interface FunctionPipeline {
  id: string;
  tenantId: string;
  name: string;
  description: string;
  steps: PipelineStep[];
  isActive: boolean;
}

interface PipelineStep {
  functionId: string;
  inputMapping: Record<string, string>; // map pipeline args or previous step outputs
  outputKey: string; // key to store result for next steps
  condition?: string; // optional JS condition to skip step
}
```

### Example: Meta Ads Full Report

```json
{
  "id": "meta-ads-full-report",
  "name": "Meta Ads Full Report",
  "steps": [
    {
      "functionId": "meta-ads-campaigns",
      "inputMapping": { "adAccountId": "{adAccountId}" },
      "outputKey": "campaigns"
    },
    {
      "functionId": "meta-ads-insights",
      "inputMapping": {
        "adAccountId": "{adAccountId}",
        "campaignIds": "{campaigns.*.id}"
      },
      "outputKey": "insights"
    }
  ]
}
```

### UI

- New "Pipelines" tab in Admin → Functions
- Visual drag-and-drop builder (or JSON editor as MVP)
- Test runner with sample inputs

### Runtime

- `executePipeline()` in `executor.ts`
- Each step awaits the previous
- Results accumulated in a context object
- Final result returned to LLM

---

## 2. Auto-Generate Input Schema from API Spec

**Status:** Planned

**Problem:** Writing JSON schemas manually is error-prone and tedious.

**Proposed Solution:**

- Paste an OpenAPI spec URL or swagger.json
- System extracts operation definitions
- Auto-generates `inputSchema`, `description`, `baseUrl`, `path`, `method`
- Admin reviews and adjusts before saving

---

## 3. Function Versioning

**Status:** Planned

**Problem:** Updating a live function can break agents that depend on it.

**Proposed Solution:**

- Store function versions as sub-documents
- Agent references a specific version: `tools: ["meta-ads-report@v2"]`
- Admin can rollback to previous versions
- "Publish new version" vs "Edit in place"

---

## 4. Function Testing / Playground

**Status:** Planned

**Problem:** No way to test a function before making it active.

**Proposed Solution:**

- "Test" button in Function detail / Create modal
- Opens a panel to enter parameters
- Executes the function with real HTTP call (using stored secrets)
- Shows raw request/response for debugging

---

## 5. Conditional Function Availability

**Status:** Planned

**Problem:** Not all functions should be available to all agents or all users.

**Proposed Solution:**

- Per-function ACL: which roles/groups can use it
- Per-agent function binding (already implemented in basic form)
- Time-based availability (e.g., maintenance windows)

---

## 6. Function Metrics & Monitoring

**Status:** Planned

**Problem:** No visibility into which functions are called, latency, errors.

**Proposed Solution:**

- `TenantFunctionCall` log collection
- Dashboard in Admin: calls/min, error rate, avg latency
- Alerting on high error rates

---

## Priority Order

1. **Function Testing / Playground** — highest impact for admin UX
2. **Auto-Generate Input Schema** — reduces friction in function creation
3. **Function Pipelines** — enables complex workflows
4. **Function Versioning** — safety for production
5. **Conditional Availability** — governance
6. **Metrics & Monitoring** — operational maturity
