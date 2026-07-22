# Graph Report - .  (2026-07-07)

## Corpus Check
- Corpus is ~31,231 words - fits in a single context window. You may not need a graph.

## Summary
- 949 nodes · 1022 edges · 78 communities (55 shown, 23 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 27 edges (avg confidence: 0.52)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_data service|data service]]
- [[_COMMUNITY_config|config]]
- [[_COMMUNITY_api endpoints|api endpoints]]
- [[_COMMUNITY_banner|banner]]
- [[_COMMUNITY_permissions|permissions]]
- [[_COMMUNITY_index|index]]
- [[_COMMUNITY_DataTableErrorBoundary|DataTableErrorBoundary]]
- [[_COMMUNITY_getRole|getRole]]
- [[_COMMUNITY_request|request]]
- [[_COMMUNITY_projectById|projectById]]
- [[_COMMUNITY_AlertDialog|AlertDialog]]
- [[_COMMUNITY_deletePrompt|deletePrompt]]
- [[_COMMUNITY_AdminSettingsDialog|AdminSettingsDialog]]
- [[_COMMUNITY_assistants|assistants]]
- [[_COMMUNITY_MarkdownErrorBoundary|MarkdownErrorBoundary]]
- [[_COMMUNITY_MermaidErrorBoundary|MermaidErrorBoundary]]
- [[_COMMUNITY_SourcesErrorBoundary|SourcesErrorBoundary]]
- [[_COMMUNITY_errors|errors]]
- [[_COMMUNITY_errors|errors]]
- [[_COMMUNITY_errors|errors]]
- [[_COMMUNITY_error|error]]
- [[_COMMUNITY_Error|Error]]
- [[_COMMUNITY_RouteErrorBoundary|RouteErrorBoundary]]
- [[_COMMUNITY_error|error]]
- [[_COMMUNITY_update banner|update banner]]
- [[_COMMUNITY_ErrorDisplay|ErrorDisplay]]
- [[_COMMUNITY_delete banner|delete banner]]
- [[_COMMUNITY_getSkill|getSkill]]
- [[_COMMUNITY_errors|errors]]
- [[_COMMUNITY_ApiErrorBoundaryContext|ApiErrorBoundaryContext]]
- [[_COMMUNITY_favoritesError|favoritesError]]
- [[_COMMUNITY_logger|logger]]
- [[_COMMUNITY_axios|axios]]
- [[_COMMUNITY_ToastContext|ToastContext]]
- [[_COMMUNITY_logger|logger]]
- [[_COMMUNITY_error|error]]
- [[_COMMUNITY_adminConfigActive|adminConfigActive]]
- [[_COMMUNITY_getBanner|getBanner]]
- [[_COMMUNITY_keys|keys]]
- [[_COMMUNITY_logger|logger]]
- [[_COMMUNITY_Banner|Banner]]
- [[_COMMUNITY_Banner|Banner]]
- [[_COMMUNITY_errors|errors]]
- [[_COMMUNITY_request interceptor spec|request interceptor spec]]
- [[_COMMUNITY_addTagToConversation|addTagToConversation]]
- [[_COMMUNITY_adminFunctionById|adminFunctionById]]
- [[_COMMUNITY_adminGroupById|adminGroupById]]
- [[_COMMUNITY_adminTenants|adminTenants]]
- [[_COMMUNITY_agents|agents]]
- [[_COMMUNITY_buildQuery|buildQuery]]
- [[_COMMUNITY_deleteCategory|deleteCategory]]
- [[_COMMUNITY_memories|memories]]
- [[_COMMUNITY_deleteSkill|deleteSkill]]
- [[_COMMUNITY_banner|banner]]
- [[_COMMUNITY_toast|toast]]
- [[_COMMUNITY_adminSecretByName|adminSecretByName]]
- [[_COMMUNITY_adminUsers|adminUsers]]
- [[_COMMUNITY_getConfigDefaults|getConfigDefaults]]
- [[_COMMUNITY_getEndpointField|getEndpointField]]
- [[_COMMUNITY_isPrivateIPv4Literal|isPrivateIPv4Literal]]
- [[_COMMUNITY_isRemoteOidcUrlAllowed|isRemoteOidcUrlAllowed]]
- [[_COMMUNITY_normalizePort|normalizePort]]
- [[_COMMUNITY_banner|banner]]
- [[_COMMUNITY_deletePromptGroup|deletePromptGroup]]
- [[_COMMUNITY_postCategory|postCategory]]
- [[_COMMUNITY_postPrompt|postPrompt]]
- [[_COMMUNITY_updatePromptGroup|updatePromptGroup]]

## God Nodes (most connected - your core abstractions)
1. `getRole()` - 14 edges
2. `projectMetaAds()` - 13 edges
3. `startServer()` - 11 edges
4. `prompts()` - 9 edges
5. `ErrorController()` - 8 edges
6. `DataTableErrorBoundaryInner` - 7 edges
7. `MarkdownErrorBoundary` - 6 edges
8. `MermaidErrorBoundary` - 6 edges
9. `SourcesErrorBoundary` - 5 edges
10. `DataTableErrorBoundaryProps` - 5 edges

## Surprising Connections (you probably didn't know these)
- `startServer()` --indirect_call--> `ErrorController()`  [INFERRED]
  api/server/index.js → packages/api/src/middleware/error.ts
- `createBannerMethods()` --indirect_call--> `getBanner()`  [INFERRED]
  packages/data-schemas/src/methods/banner.ts → packages/data-provider/src/data-service.ts

## Import Cycles
- None detected.

## Communities (78 total, 23 thin omitted)

### Community 1 - "config"
Cohesion: 0.01
Nodes (146): addParamsSchema, AgentCapabilities, agentsEndpointSchema, allowedAddressEntrySchema, allowedAddressesSchema, alternateName, anthropicEndpointSchema, assistantEndpointSchema (+138 more)

### Community 3 - "banner"
Cohesion: 0.04
Nodes (47): express, { getBanner }, { logger }, optionalJwtAuth, { preAuthTenantMiddleware }, router, accessPermissions, actions (+39 more)

### Community 4 - "permissions"
Cohesion: 0.05
Nodes (40): agentPermissionsSchema, bookmarkPermissionsSchema, fileCitationsPermissionsSchema, fileSearchPermissionsSchema, INTERFACE_PERMISSION_FIELDS, marketplacePermissionsSchema, mcpServersPermissionsSchema, memoryPermissionsSchema (+32 more)

### Community 5 - "index"
Cohesion: 0.09
Nodes (28): app, axios, { capabilityContextMiddleware }, { checkMigrations }, compression, configureSocialLogins, { connectDb, indexSync }, cookieParser (+20 more)

### Community 6 - "DataTableErrorBoundary"
Cohesion: 0.20
Nodes (5): DataTableErrorBoundary(), DataTableErrorBoundaryInner, DataTableErrorBoundaryInnerProps, DataTableErrorBoundaryProps, DataTableErrorBoundaryState

### Community 7 - "getRole"
Cohesion: 0.14
Nodes (14): getRole(), roles(), updateAgentPermissions(), updateFileCitationsPermissions(), updateFileSearchPermissions(), updateMarketplacePermissions(), updateMCPServersPermissions(), updateMemoryPermissions() (+6 more)

### Community 8 - "request"
Cohesion: 0.15
Nodes (3): failedQueue, _post(), refreshToken()

### Community 9 - "projectById"
Cohesion: 0.15
Nodes (13): projectById(), projectMetaAds(), projectMetaAdsApply(), projectMetaAdsBudget(), projectMetaAdsDuplicate(), projectMetaAdsEntityStatus(), projectMetaAdsPerformance(), projectMetaAdsRankings() (+5 more)

### Community 10 - "AlertDialog"
Cohesion: 0.18
Nodes (7): AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogOverlay, AlertDialogTitle, AlertPortalProps

### Community 11 - "deletePrompt"
Cohesion: 0.18
Nodes (11): deletePrompt(), getAllPromptGroups(), getPrompt(), getPromptGroup(), getPromptGroupsWithFilters(), getPromptsWithFilters(), getRandomPrompts(), prompts() (+3 more)

### Community 12 - "AdminSettingsDialog"
Cohesion: 0.24
Nodes (4): AdminSettingsDialogProps, FormValues, LabelControllerProps, PermissionConfig

### Community 13 - "assistants"
Cohesion: 0.20
Nodes (10): assistants(), avatar(), files(), getCustomConfigSpeech(), images(), speech(), speechToText(), textToSpeech() (+2 more)

### Community 14 - "MarkdownErrorBoundary"
Cohesion: 0.22
Nodes (3): ErrorBoundaryState, MarkdownErrorBoundary, MarkdownErrorBoundaryProps

### Community 15 - "MermaidErrorBoundary"
Cohesion: 0.22
Nodes (3): MermaidErrorBoundary, MermaidErrorBoundaryProps, MermaidErrorBoundaryState

### Community 16 - "SourcesErrorBoundary"
Cohesion: 0.25
Nodes (3): Props, SourcesErrorBoundary, State

### Community 17 - "errors"
Cohesion: 0.22
Nodes (4): MCPDomainNotAllowedError, MCPErrorCode, MCPErrorCodes, MCPInspectionFailedError

### Community 18 - "errors"
Cohesion: 0.29
Nodes (7): { CacheKeys, ViolationTypes }, createErrorHandler(), { getConvo }, getLogStores, { logger }, { recordUsage }, { sendResponse }

### Community 19 - "errors"
Cohesion: 0.29
Nodes (7): { CacheKeys, ViolationTypes, ContentTypes }, createErrorHandler(), { getConvo }, getLogStores, { logger }, { recordUsage, checkMessageGaps }, { sendResponse }

### Community 20 - "error"
Cohesion: 0.29
Nodes (7): crypto, { logger }, { parseConvo }, { saveMessage, getMessages, getConvo }, sendError(), { sendEvent, handleError, sanitizeMessageForTransmit }, sendResponse()

### Community 21 - "Error"
Cohesion: 0.25
Nodes (6): errorMessages, TConcurrent, TExpiredKey, TGenericError, TMessageLimit, TTokenBalance

### Community 22 - "RouteErrorBoundary"
Cohesion: 0.39
Nodes (6): formatStackTrace(), getBrowserInfo(), getPlatformInfo(), PlatformInfo, RouteErrorBoundary(), UserAgentData

### Community 23 - "error"
Cohesion: 0.46
Nodes (6): ErrorController(), handleDuplicateKeyError(), handleValidationError(), isCustomError(), isMongoServerError(), isValidationError()

### Community 24 - "update banner"
Cohesion: 0.29
Nodes (6): { askQuestion, askMultiLineQuestion, silentExit }, { Banner }, connect, mongoose, path, { v5: uuidv5 }

### Community 25 - "ErrorDisplay"
Cohesion: 0.40
Nodes (4): ApiError, ErrorDisplay(), ErrorDisplayProps, mockLocalize

### Community 26 - "delete banner"
Cohesion: 0.33
Nodes (5): { askQuestion, silentExit }, { Banner }, connect, mongoose, path

### Community 27 - "getSkill"
Cohesion: 0.33
Nodes (6): getSkill(), importSkill(), listSkillsWithFilters(), skillFile(), skillFiles(), skills()

### Community 28 - "errors"
Cohesion: 0.70
Nodes (4): formatRequestDetails(), getNumberField(), getRequestErrorMessage(), getStringField()

### Community 30 - "favoritesError"
Cohesion: 0.50
Nodes (4): ApiErrorShape, getFavoritesErrorMessage(), isApiError(), LocalizeFn

### Community 31 - "logger"
Cohesion: 0.50
Nodes (4): createLogFunction(), LogFunction, logger, shouldLog()

### Community 32 - "axios"
Cohesion: 0.60
Nodes (3): createAxiosInstance(), logAxiosError(), renderResponseData()

### Community 34 - "logger"
Cohesion: 0.50
Nodes (4): createLogFunction(), LogFunction, logger, shouldLog()

### Community 35 - "error"
Cohesion: 0.50
Nodes (3): CustomError, MongoServerError, ValidationError

### Community 36 - "adminConfigActive"
Cohesion: 0.50
Nodes (4): adminConfigActive(), adminConfigBase(), adminConfigByPrincipal(), adminConfigs()

### Community 37 - "getBanner"
Cohesion: 0.50
Nodes (3): getBanner(), BannerMethods, createBannerMethods()

### Community 38 - "keys"
Cohesion: 0.50
Nodes (3): DynamicQueryKeys, MutationKeys, QueryKeys

### Community 44 - "addTagToConversation"
Cohesion: 0.67
Nodes (3): addTagToConversation(), conversationTags(), conversationTagsList()

### Community 45 - "adminFunctionById"
Cohesion: 0.67
Nodes (3): adminFunctionById(), adminFunctions(), adminFunctionToggle()

### Community 46 - "adminGroupById"
Cohesion: 0.67
Nodes (3): adminGroupById(), adminGroupMembers(), adminGroups()

### Community 47 - "adminTenants"
Cohesion: 0.67
Nodes (3): adminTenants(), adminTenantStats(), adminTenantUsers()

### Community 48 - "agents"
Cohesion: 0.67
Nodes (3): agents(), cloneAgentToTenant(), revertAgentVersion()

### Community 49 - "buildQuery"
Cohesion: 0.67
Nodes (3): buildQuery(), conversations(), messages()

### Community 50 - "deleteCategory"
Cohesion: 0.67
Nodes (3): deleteCategory(), getCategories(), updateCategory()

### Community 51 - "memories"
Cohesion: 0.67
Nodes (3): memories(), memory(), memoryPreferences()

### Community 52 - "deleteSkill"
Cohesion: 0.67
Nodes (3): deleteSkill(), getSkill(), updateSkill()

## Knowledge Gaps
- **335 isolated node(s):** `{ logger }`, `{ CacheKeys, ViolationTypes }`, `{ sendResponse }`, `{ recordUsage }`, `{ getConvo }` (+330 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **23 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `getBanner()` connect `getBanner` to `data service`?**
  _High betweenness centrality (0.004) - this node is a cross-community bridge._
- **Why does `startServer()` connect `index` to `error`?**
  _High betweenness centrality (0.001) - this node is a cross-community bridge._
- **What connects `{ logger }`, `{ CacheKeys, ViolationTypes }`, `{ sendResponse }` to the rest of the system?**
  _336 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `data service` be split into smaller, more focused modules?**
  _Cohesion score 0.008333333333333333 - nodes in this community are weakly interconnected._
- **Should `config` be split into smaller, more focused modules?**
  _Cohesion score 0.013333333333333334 - nodes in this community are weakly interconnected._
- **Should `api endpoints` be split into smaller, more focused modules?**
  _Cohesion score 0.020833333333333332 - nodes in this community are weakly interconnected._
- **Should `banner` be split into smaller, more focused modules?**
  _Cohesion score 0.04081632653061224 - nodes in this community are weakly interconnected._