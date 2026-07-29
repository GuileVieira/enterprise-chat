# Graph Report - .  (2026-07-07)

## Corpus Check
- 66 files · ~59,526 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 524 nodes · 637 edges · 43 communities (36 shown, 7 thin omitted)
- Extraction: 94% EXTRACTED · 6% INFERRED · 0% AMBIGUOUS · INFERRED: 37 edges (avg confidence: 0.51)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_MCP|MCP]]
- [[_COMMUNITY_definitions|definitions]]
- [[_COMMUNITY_classification|classification]]
- [[_COMMUNITY_tools verifyToolAuth spec|tools verifyToolAuth spec]]
- [[_COMMUNITY_RFC 6749|RFC 6749]]
- [[_COMMUNITY_ToolService|ToolService]]
- [[_COMMUNITY_maybeUninstallOAuthMCP spec|maybeUninstallOAuthMCP spec]]
- [[_COMMUNITY_mcp|mcp]]
- [[_COMMUNITY_getCachedTools|getCachedTools]]
- [[_COMMUNITY_ToolService spec|ToolService spec]]
- [[_COMMUNITY_initializeMCPs|initializeMCPs]]
- [[_COMMUNITY_executor|executor]]
- [[_COMMUNITY_mcp|mcp]]
- [[_COMMUNITY_UserController mcpOAuth spec|UserController mcpOAuth spec]]
- [[_COMMUNITY_mcp|mcp]]
- [[_COMMUNITY_MCPBuilderPanel|MCPBuilderPanel]]
- [[_COMMUNITY_tools|tools]]
- [[_COMMUNITY_mcp spec|mcp spec]]
- [[_COMMUNITY_UserConnectionManager|UserConnectionManager]]
- [[_COMMUNITY_OutputRenderer|OutputRenderer]]
- [[_COMMUNITY_mcp|mcp]]
- [[_COMMUNITY_zod|zod]]
- [[_COMMUNITY_buildTenantFunctionZodSchema|buildTenantFunctionZodSchema]]
- [[_COMMUNITY_ToolCallGroup|ToolCallGroup]]
- [[_COMMUNITY_mcpServer|mcpServer]]
- [[_COMMUNITY_loadActionToolsForExecution|loadActionToolsForExecution]]
- [[_COMMUNITY_toolCall|toolCall]]
- [[_COMMUNITY_MCPSubMenu|MCPSubMenu]]
- [[_COMMUNITY_ToolsDropdown|ToolsDropdown]]
- [[_COMMUNITY_toolCall|toolCall]]
- [[_COMMUNITY_mcpServer|mcpServer]]

## God Nodes (most connected - your core abstractions)
1. `MCPOAuthHandler` - 19 edges
2. `UserConnectionManager` - 10 edges
3. `reconnectServer()` - 9 edges
4. `buildToolClassification()` - 9 edges
5. `createMCPTool()` - 7 edges
6. `createToolInstance()` - 7 edges
7. `ToolCacheKeys` - 6 edges
8. `loadAgentTools()` - 6 edges
9. `loadToolsForExecution()` - 6 edges
10. `{ GenerationJobManager }` - 6 edges

## Surprising Connections (you probably didn't know these)
- `createMCPServerController()` --references--> `MCPServerUserInputSchema`  [EXTRACTED]
  api/server/controllers/mcp.js → packages/data-provider/src/mcp.ts
- `updateMCPServerController()` --references--> `MCPServerUserInputSchema`  [EXTRACTED]
  api/server/controllers/mcp.js → packages/data-provider/src/mcp.ts
- `verifyWebSearchAuth()` --indirect_call--> `loadAuthValues()`  [INFERRED]
  api/server/controllers/tools.js → api/server/services/Tools/credentials.js
- `loadToolDefinitionsWrapper()` --references--> `{ GenerationJobManager }`  [EXTRACTED]
  api/server/services/ToolService.js → api/server/services/Tools/search.js
- `MCPServerFormProps` --references--> `useMCPServerForm()`  [EXTRACTED]
  client/src/components/SidePanel/MCPBuilder/MCPServerDialog/MCPServerForm.tsx → client/src/components/SidePanel/MCPBuilder/MCPServerDialog/hooks/useMCPServerForm.ts

## Import Cycles
- None detected.

## Communities (43 total, 7 thin omitted)

### Community 0 - "MCP"
Cohesion: 0.05
Nodes (48): checkOAuthFlowStatus(), createAbortHandler(), createMCPTool(), createMCPTools(), createOAuthCallback(), createOAuthEnd(), createOAuthStart(), createRunStepDeltaEmitter() (+40 more)

### Community 1 - "definitions"
Cohesion: 0.05
Nodes (30): agentToolDefinitions, azureAISearchSchema, dalle3Schema, duckDuckGoSearchSchema, ExtendedJsonSchema, fileSearchSchema, fluxApiSchema, googleSearchSchema (+22 more)

### Community 2 - "classification"
Cohesion: 0.09
Nodes (24): agentHasDeferredTools(), agentHasProgrammaticTools(), buildToolClassification(), BuildToolClassificationParams, BuildToolClassificationResult, buildToolRegistry(), buildToolRegistryFromAgentOptions(), cleanupMCPToolSchemas() (+16 more)

### Community 3 - "tools verifyToolAuth spec"
Cohesion: 0.08
Nodes (21): { Tools, AuthType }, { verifyToolAuth }, { checkAccess, loadWebSearchAuth }, directCallableTools, { getRoleByName, createToolCall, getToolCallsByConvo, getMessage }, { loadAuthValues }, { loadTools }, { logger } (+13 more)

### Community 4 - "RFC 6749"
Cohesion: 0.15
Nodes (7): RFC-6749, RFC-7009, RFC-8414, RFC-9728, getOAuthUrlPort(), MCPOAuthHandler, SDKOAuthMetadata

### Community 5 - "ToolService"
Cohesion: 0.08
Nodes (24): {
  createActionTool,
  legacyDomainEncode,
  decryptMetadata,
  loadActionSets,
  domainParser,
}, { createOnSearchResults }, domainSeparatorRegex, { findPluginAuthsByKeys, getTenantFunctions, getTenantSecret }, {
  getEndpointsConfig,
  getMCPServerTools,
  getCachedTools,
}, { getFlowStateManager }, { getLogStores }, { loadTools } (+16 more)

### Community 6 - "maybeUninstallOAuthMCP spec"
Cohesion: 0.09
Nodes (20): appConfig, clientInfo, clientMetadata, { maybeUninstallOAuthMCP }, mockDeleteFlow, mockDeleteTokens, mockDeleteUserTokens, mockFindToken (+12 more)

### Community 7 - "mcp"
Cohesion: 0.11
Nodes (15): BaseOptionsSchema, MCPOptions, MCPOptionsSchema, MCPServersSchema, MCPServerUserInput, SSEOptionsSchema, StdioOptionsSchema, StreamableHTTPOptionsSchema (+7 more)

### Community 8 - "getCachedTools"
Cohesion: 0.19
Nodes (16): { CacheKeys, Time }, getCachedTools(), getLogStores, getMCPServerTools(), invalidateCachedTools(), { logger }, setCachedTools(), ToolCacheKeys (+8 more)

### Community 9 - "ToolService spec"
Cohesion: 0.11
Nodes (16): {
  loadAgentTools,
  loadToolsForExecution,
  processRequiredActions,
  resolveAgentCapabilities,
}, mockCreateActionTool, mockDecryptMetadata, mockDomainParser, mockGetCachedTools, mockGetEndpointsConfig, mockGetMCPServerTools, mockGetTenantFunctions (+8 more)

### Community 10 - "initializeMCPs"
Cohesion: 0.11
Nodes (11): { createMCPServersRegistry, createMCPManager }, { logger }, { mergeAppTools, getAppConfig }, mongoose, initializeMCPs, { logger }, mockCreateMCPManager, mockCreateMCPServersRegistry (+3 more)

### Community 11 - "executor"
Cohesion: 0.18
Nodes (14): buildHeaders(), buildRequestParams(), buildUrl(), executeTenantFunction(), extractPathParams(), isBodyMethod(), stringifyResponse(), TenantFunctionErrorResponse (+6 more)

### Community 12 - "mcp"
Cohesion: 0.12
Nodes (15): {
  CacheKeys,
  Constants,
  PermissionBits,
  PermissionTypes,
  Permissions,
}, checkMCPCreate, checkMCPUsePermissions, {
  createMCPServerController,
  updateMCPServerController,
  deleteMCPServerController,
  getMCPServersList,
  getMCPServerById,
  getMCPTools,
}, db, {
  getBasePath,
  createSafeUser,
  MCPOAuthHandler,
  MCPTokenStorage,
  setOAuthSession,
  PENDING_STALE_MS,
  getUserMCPAuthMap,
  validateOAuthCsrf,
  OAUTH_CSRF_COOKIE,
  setOAuthCsrfCookie,
  generateCheckAccess,
  validateOAuthSession,
  OAUTH_SESSION_COOKIE,
}, { getLogStores }, {
  getOAuthReconnectionManager,
  getMCPServersRegistry,
  getFlowStateManager,
  getMCPManager,
} (+7 more)

### Community 13 - "UserController mcpOAuth spec"
Cohesion: 0.12
Nodes (12): { logger }, { MCPTokenStorage, MCPOAuthHandler }, mockDeleteUserPluginAuth, mockFindToken, mockGetAppConfig, mockGetFlowStateManager, mockGetLogStores, mockGetMCPManager (+4 more)

### Community 14 - "mcp"
Cohesion: 0.16
Nodes (10): { cacheMCPServerTools, getMCPServerTools }, { Constants, MCPServerUserInputSchema }, createMCPServerController(), { getMCPManager, getMCPServersRegistry }, handleMCPError(), { logger }, {
  MCPErrorCodes,
  redactServerSecrets,
  redactAllServerSecrets,
  isMCPDomainNotAllowedError,
  isMCPInspectionFailedError,
}, { resolveConfigServers, resolveAllMcpConfigs } (+2 more)

### Community 15 - "MCPBuilderPanel"
Cohesion: 0.19
Nodes (10): AuthConfig, AuthorizationTypeEnum, AuthTypeEnum, MCPServerFormData, useMCPServerForm(), UseMCPServerFormProps, MCPServerDialog(), MCPServerDialogProps (+2 more)

### Community 16 - "tools"
Cohesion: 0.15
Nodes (11): { callTool, verifyToolAuth, getToolCalls }, db, express, { getAvailableTools }, router, createApp(), express, mockGetTenantFunctions (+3 more)

### Community 17 - "mcp spec"
Cohesion: 0.18
Nodes (9): cookieParser, crypto, express, { getBasePath }, mockRegistryInstance, mockResolveAllMcpConfigs, { MongoMemoryServer }, mongoose (+1 more)

### Community 19 - "OutputRenderer"
Cohesion: 0.33
Nodes (8): cleanError(), ContentBlock, ExtractedText, extractText(), isError(), isStructuredText(), OutputRenderer(), OutputRendererProps

### Community 20 - "mcp"
Cohesion: 0.25
Nodes (6): defaultServerInitState, mcpPinnedAtom, MCPServerInitState, mcpServerInitStatesAtom, mcpTabIsolatedStorage, mcpValuesAtomFamily

### Community 21 - "zod"
Cohesion: 0.43
Nodes (6): convertJsonSchemaToZod(), convertToZodUnion(), convertWithResolvedRefs(), dropSchemaFields(), isEmptyObjectSchema(), resolveJsonSchemaRefs()

### Community 22 - "buildTenantFunctionZodSchema"
Cohesion: 0.47
Nodes (6): buildTenantFunctionZodSchema(), isBuiltInTool(), loadAgentTools(), loadToolDefinitionsWrapper(), loadToolsForExecution(), resolveAgentCapabilities()

### Community 23 - "ToolCallGroup"
Cohesion: 0.40
Nodes (5): FRIENDLY_NAME_KEYS, getToolMeta(), ToolCallGroup(), ToolCallGroupProps, ToolMeta

### Community 25 - "loadActionToolsForExecution"
Cohesion: 0.50
Nodes (5): loadActionToolsForExecution(), normalizeActionToolName(), processRequiredActions(), processVisionRequest(), registerActionTools()

## Knowledge Gaps
- **264 isolated node(s):** `mockUpdateUserPlugins`, `mockFindToken`, `mockDeleteUserPluginAuth`, `mockGetAppConfig`, `mockInvalidateCachedTools` (+259 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **7 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `{ GenerationJobManager }` connect `MCP` to `buildTenantFunctionZodSchema`?**
  _High betweenness centrality (0.026) - this node is a cross-community bridge._
- **Why does `loadToolDefinitionsWrapper()` connect `buildTenantFunctionZodSchema` to `MCP`, `ToolService`?**
  _High betweenness centrality (0.023) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `buildToolClassification()` (e.g. with `extractMCPToolDefinition()` and `isMCPTool()`) actually correct?**
  _`buildToolClassification()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `mockUpdateUserPlugins`, `mockFindToken`, `mockDeleteUserPluginAuth` to the rest of the system?**
  _265 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `MCP` be split into smaller, more focused modules?**
  _Cohesion score 0.0514216575922565 - nodes in this community are weakly interconnected._
- **Should `definitions` be split into smaller, more focused modules?**
  _Cohesion score 0.04994192799070848 - nodes in this community are weakly interconnected._
- **Should `classification` be split into smaller, more focused modules?**
  _Cohesion score 0.08712121212121213 - nodes in this community are weakly interconnected._