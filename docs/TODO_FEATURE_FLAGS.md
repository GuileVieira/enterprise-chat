# TODO: Feature Flags System

## Overview
Implement a lightweight feature flag system per tenant to enable/disable functionality dynamically without code changes or restarts.

## Use Cases
- Disable agents for a specific tenant
- Turn off file search during maintenance
- Gradually roll out MCP servers
- Disable marketplace, web search, etc.

## Schema

```typescript
// packages/data-schemas/src/schema/tenantFeatureFlag.ts
interface ITenantFeatureFlag {
  tenantId: string;
  features: {
    agents: boolean;
    fileSearch: boolean;
    mcpServers: boolean;
    webSearch: boolean;
    marketplace: boolean;
    tenantFunctions: boolean;
    codeExecution: boolean;
    // add more as needed
  };
}
```

## Backend Tasks
- [ ] Create `TenantFeatureFlag` schema in data-schemas
- [ ] Create CRUD methods for feature flags
- [ ] Create API endpoints: GET /api/admin/features, PUT /api/admin/features
- [ ] Integrate feature flag checks into:
  - [ ] Agent initialization (disable agents)
  - [ ] Tool loading (disable file_search, web_search, etc.)
  - [ ] MCP server loading
  - [ ] Marketplace access
- [ ] Default: all features enabled for backward compatibility

## Frontend Tasks
- [ ] Create `useFeatureFlags()` hook that fetches tenant features
- [ ] Create `FeatureFlagsPage` in Admin Panel (toggle UI)
- [ ] Conditionally render/hide features based on flags:
  - [ ] Sidebar links
  - [ ] Agent builder capabilities
  - [ ] Chat input tool buttons
  - [ ] Settings tabs
- [ ] Show "feature disabled" message instead of hiding completely (better UX)

## CLI Tasks
- [ ] Add `toggle-feature` command to manage feature flags via CLI
  ```bash
  npm run toggle-feature -- --tenant=acme --feature=agents --enabled=false
  ```

## Priority
**Low** — Can be implemented after Admin Panel MVP is complete.

## Estimated Effort
1-2 days for full implementation.
