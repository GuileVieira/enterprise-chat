# Tenant Functions — TODO / Future Features

This document tracks planned enhancements for the Tenant Functions system.

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
