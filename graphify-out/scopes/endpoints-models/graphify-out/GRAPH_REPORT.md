# Graph Report - .  (2026-07-07)

## Corpus Check
- 139 files · ~91,989 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1361 nodes · 1688 edges · 81 communities (61 shown, 20 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 40 edges (avg confidence: 0.52)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_data service|data service]]
- [[_COMMUNITY_config|config]]
- [[_COMMUNITY_schemas|schemas]]
- [[_COMMUNITY_api endpoints|api endpoints]]
- [[_COMMUNITY_initialize|initialize]]
- [[_COMMUNITY_AlternativeSettings|AlternativeSettings]]
- [[_COMMUNITY_index|index]]
- [[_COMMUNITY_permissions|permissions]]
- [[_COMMUNITY_build|build]]
- [[_COMMUNITY_helpers|helpers]]
- [[_COMMUNITY_convos|convos]]
- [[_COMMUNITY_buildEndpointOption|buildEndpointOption]]
- [[_COMMUNITY_build|build]]
- [[_COMMUNITY_endpoints|endpoints]]
- [[_COMMUNITY_models|models]]
- [[_COMMUNITY_Icons|Icons]]
- [[_COMMUNITY_config|config]]
- [[_COMMUNITY_initialize|initialize]]
- [[_COMMUNITY_initialize spec|initialize spec]]
- [[_COMMUNITY_EndpointModelItem|EndpointModelItem]]
- [[_COMMUNITY_CustomGroup|CustomGroup]]
- [[_COMMUNITY_Icon|Icon]]
- [[_COMMUNITY_Anthropic|Anthropic]]
- [[_COMMUNITY_getRole|getRole]]
- [[_COMMUNITY_renderCustomGroups|renderCustomGroups]]
- [[_COMMUNITY_ModelSelectorChatContext|ModelSelectorChatContext]]
- [[_COMMUNITY_index|index]]
- [[_COMMUNITY_projectById|projectById]]
- [[_COMMUNITY_EndpointService|EndpointService]]
- [[_COMMUNITY_createToolLoader|createToolLoader]]
- [[_COMMUNITY_build|build]]
- [[_COMMUNITY_index|index]]
- [[_COMMUNITY_deletePrompt|deletePrompt]]
- [[_COMMUNITY_allowedAddressesSchema|allowedAddressesSchema]]
- [[_COMMUNITY_messages|messages]]
- [[_COMMUNITY_assistants|assistants]]
- [[_COMMUNITY_models|models]]
- [[_COMMUNITY_addedConvo|addedConvo]]
- [[_COMMUNITY_addedConvo spec|addedConvo spec]]
- [[_COMMUNITY_CustomMenu|CustomMenu]]
- [[_COMMUNITY_presets|presets]]
- [[_COMMUNITY_title|title]]
- [[_COMMUNITY_ModelController|ModelController]]
- [[_COMMUNITY_getSkill|getSkill]]
- [[_COMMUNITY_endpoints|endpoints]]
- [[_COMMUNITY_models|models]]
- [[_COMMUNITY_getEndpointsConfig|getEndpointsConfig]]
- [[_COMMUNITY_index|index]]
- [[_COMMUNITY_endpoints|endpoints]]
- [[_COMMUNITY_GroupIcon|GroupIcon]]
- [[_COMMUNITY_ModelSpecItem test|ModelSpecItem test]]
- [[_COMMUNITY_adminConfigActive|adminConfigActive]]
- [[_COMMUNITY_keys|keys]]
- [[_COMMUNITY_EndpointController|EndpointController]]
- [[_COMMUNITY_MultiSelectDropDown|MultiSelectDropDown]]
- [[_COMMUNITY_MultiSelectPop|MultiSelectPop]]
- [[_COMMUNITY_SelectDropDownPop|SelectDropDownPop]]
- [[_COMMUNITY_addTagToConversation|addTagToConversation]]
- [[_COMMUNITY_adminFunctionById|adminFunctionById]]
- [[_COMMUNITY_adminGroupById|adminGroupById]]
- [[_COMMUNITY_adminTenants|adminTenants]]
- [[_COMMUNITY_agents|agents]]
- [[_COMMUNITY_buildQuery|buildQuery]]
- [[_COMMUNITY_deleteCategory|deleteCategory]]
- [[_COMMUNITY_memories|memories]]
- [[_COMMUNITY_deleteSkill|deleteSkill]]
- [[_COMMUNITY_messages|messages]]
- [[_COMMUNITY_BedrockProviders|BedrockProviders]]
- [[_COMMUNITY_URLIcon|URLIcon]]
- [[_COMMUNITY_adminSecretByName|adminSecretByName]]
- [[_COMMUNITY_adminUsers|adminUsers]]
- [[_COMMUNITY_getConfigDefaults|getConfigDefaults]]
- [[_COMMUNITY_isPrivateIPv4Literal|isPrivateIPv4Literal]]
- [[_COMMUNITY_isRemoteOidcUrlAllowed|isRemoteOidcUrlAllowed]]
- [[_COMMUNITY_normalizePort|normalizePort]]
- [[_COMMUNITY_deletePromptGroup|deletePromptGroup]]
- [[_COMMUNITY_postCategory|postCategory]]
- [[_COMMUNITY_postPrompt|postPrompt]]
- [[_COMMUNITY_updatePromptGroup|updatePromptGroup]]

## God Nodes (most connected - your core abstractions)
1. `useModelSelectorContext()` - 14 edges
2. `getRole()` - 14 edges
3. `getLLMConfig()` - 13 edges
4. `getOpenAIConfig()` - 13 edges
5. `projectMetaAds()` - 13 edges
6. `getGoogleConfig()` - 10 edges
7. `getOpenAILLMConfig()` - 9 edges
8. `prompts()` - 9 edges
9. `ModelSelectorContent()` - 8 edges
10. `initializeClient()` - 7 edges

## Surprising Connections (you probably didn't know these)
- `initializeClient()` --indirect_call--> `config()`  [INFERRED]
  api/server/services/Endpoints/agents/initialize.js → packages/data-provider/src/api-endpoints.ts
- `getSelectedIcon()` --indirect_call--> `SpecIcon()`  [INFERRED]
  client/src/components/Chat/Menus/Endpoints/utils.ts → client/src/components/Chat/Menus/Endpoints/components/SpecIcon.tsx
- `getSelectedIcon()` --indirect_call--> `AgentModelAvatar()`  [INFERRED]
  client/src/components/Chat/Menus/Endpoints/utils.ts → client/src/components/Chat/Menus/Endpoints/components/EndpointModelItem.tsx
- `initializeClient()` --calls--> `processAddedConvo()`  [EXTRACTED]
  api/server/services/Endpoints/agents/initialize.js → api/server/services/Endpoints/agents/addedConvo.js
- `ModelSelectorContent()` --calls--> `useModelSelectorContext()`  [EXTRACTED]
  client/src/components/Chat/Menus/Endpoints/ModelSelector.tsx → client/src/components/Chat/Menus/Endpoints/ModelSelectorContext.tsx

## Import Cycles
- 3-file cycle: `client/src/components/Chat/Menus/Endpoints/ModelSelectorContext.tsx -> client/src/components/Chat/Menus/Endpoints/utils.ts -> client/src/components/Chat/Menus/Endpoints/components/EndpointModelItem.tsx -> client/src/components/Chat/Menus/Endpoints/ModelSelectorContext.tsx`

## Communities (81 total, 20 thin omitted)

### Community 1 - "config"
Cohesion: 0.01
Nodes (142): addParamsSchema, AgentCapabilities, agentsEndpointSchema, allowedAddressEntrySchema, alternateName, anthropicEndpointSchema, assistantEndpointSchema, AuthKeys (+134 more)

### Community 2 - "schemas"
Cohesion: 0.02
Nodes (91): AgentProvider, agentsBaseSchema, agentsSchema, agentsSettings, ANTHROPIC_MAX_OUTPUT, anthropicBaseSchema, AnthropicEffort, anthropicSchema (+83 more)

### Community 4 - "initialize"
Cohesion: 0.06
Nodes (32): initializeBedrock(), BEDROCK_CLAUDE_4_BETAS, mockedCheckUserKeyExpiry, getProviderConfig(), InitializeFn, isKnownCustomProvider(), providerConfigMap, ProviderConfigResult (+24 more)

### Community 5 - "AlternativeSettings"
Cohesion: 0.06
Nodes (16): classMap, ConvoIconURLProps, styleImageMap, styleMap, Settings(), AnthropicSettings(), BedrockSettings(), TExamplesProps (+8 more)

### Community 6 - "index"
Cohesion: 0.08
Nodes (30): Fetch, getDefaultParams(), getOpenAIConfig(), includesOpenRouter(), mergeHeadersPreservingAnthropicBeta(), OPENROUTER_DEFAULT_PARAMS, initializeOpenAI(), mockGetOpenAIConfig (+22 more)

### Community 7 - "permissions"
Cohesion: 0.05
Nodes (40): agentPermissionsSchema, bookmarkPermissionsSchema, fileCitationsPermissionsSchema, fileSearchPermissionsSchema, INTERFACE_PERMISSION_FIELDS, marketplacePermissionsSchema, mcpServersPermissionsSchema, memoryPermissionsSchema (+32 more)

### Community 8 - "build"
Cohesion: 0.08
Nodes (24): buildOptions(), generateArtifactsPrompt, { getAssistant }, { removeNullishValues }, addTitle, buildOptions, initializeClient, { ErrorTypes, EModelEndpoint } (+16 more)

### Community 9 - "helpers"
Cohesion: 0.18
Nodes (18): appendAnthropicBetaHeader(), checkPromptCacheSupport(), configureReasoning(), getClaudeHeaders(), TODO: Remove the cast once `@librechat/agents` updates its, initializeAnthropic(), applyDefaultParams(), getLLMConfig() (+10 more)

### Community 10 - "convos"
Cohesion: 0.09
Nodes (22): assistantClients, {
  CacheKeys,
  EModelEndpoint,
  ResourceType,
  PermissionBits,
}, { checkPermission }, {
  createImportLimiters,
  validateConvoAccess,
  createForkLimiters,
  configMiddleware,
}, db, express, { forkConversation, duplicateConversation }, { forkIpLimiter, forkUserLimiter } (+14 more)

### Community 11 - "buildEndpointOption"
Cohesion: 0.10
Nodes (15): agents, assistants, azureAssistants, buildFunction, {
  EndpointURLs,
  EModelEndpoint,
  isAgentsEndpoint,
  parseCompactConvo,
  getDefaultParamsEndpoint,
}, { getEndpointsConfig }, {
  handleError,
  applyModelSpecPreset,
  findModelSpecByName,
  isModelSpecEndpointMatch,
  resolveModelSpecPromptPrefixVariables,
}, { logger } (+7 more)

### Community 12 - "build"
Cohesion: 0.11
Nodes (12): buildOptions(), generateArtifactsPrompt, { getAssistant }, { removeNullishValues }, buildOptions, initializeClient, { ErrorTypes, EModelEndpoint, mapModelToAzureConfig }, Files (+4 more)

### Community 13 - "endpoints"
Cohesion: 0.15
Nodes (12): createEndpointsConfigService(), DefaultEndpointsResult, EndpointsConfigDeps, MutableEndpointsConfig, PartialEndpointEntry, appConfig(), ConfigPrincipals, createMockDeps() (+4 more)

### Community 14 - "models"
Cohesion: 0.21
Nodes (17): fetchAnthropicModels(), fetchModels(), FetchModelsParams, fetchOllamaModels(), fetchOpenAIModels(), getAnthropicModels(), getBedrockModels(), getGoogleModels() (+9 more)

### Community 15 - "Icons"
Cohesion: 0.13
Nodes (5): icons, getKnownClass(), knownEndpointAssets, knownEndpointClasses, UnknownIcon()

### Community 16 - "config"
Cohesion: 0.13
Nodes (13): buildSharedPayload(), { defaultSocialLogins }, express, { getAppConfig }, { getLdapConfig }, { hasCapability }, isBirthday(), {
  isEnabled,
  getBalanceConfig,
  getCloudFrontConfig,
  sanitizeModelSpecs,
} (+5 more)

### Community 17 - "initialize"
Cohesion: 0.12
Nodes (15): AgentClient, { checkPermission, findAccessibleResources }, { createContentAggregator }, {
  createToolEndCallback,
  getDefaultHandlers,
}, db, { filterFilesByAgentAccess }, { getModelsConfig }, {
  getSkillToolDeps,
  enrichWithSkillConfigurable,
  buildSkillPrimedIdsByName,
} (+7 more)

### Community 18 - "initialize spec"
Cohesion: 0.12
Nodes (15): { createAgent }, { initializeClient }, { logger }, mockGetAllUserMemories, mockGetConvo, mockGetFiles, mockGetFilesByProjectId, mockGetProjectById (+7 more)

### Community 19 - "EndpointModelItem"
Cohesion: 0.17
Nodes (13): AGENT_AVATAR_COLORS, AgentModelAvatar(), EndpointModelItem(), EndpointModelItemProps, getColorClass(), getInitials(), getSpecColorClass(), SPEC_COLOR_CLASSES (+5 more)

### Community 20 - "CustomGroup"
Cohesion: 0.24
Nodes (11): CustomGroup(), CustomGroupProps, EndpointItem(), EndpointItemProps, EndpointMenuContent(), renderEndpointModels(), ModelSpecItem(), ModelSpecItemProps (+3 more)

### Community 21 - "Icon"
Cohesion: 0.16
Nodes (11): avatarCache, failedUrls, Icon, ResolvedAvatar, UserAvatar, UserAvatarProps, EndpointIcon, getGoogleIcon() (+3 more)

### Community 22 - "Anthropic"
Cohesion: 0.19
Nodes (7): Anthropic(), Google(), TGoogleProps, TSelectProps, OpenAI(), multiChatOptions, options

### Community 23 - "getRole"
Cohesion: 0.14
Nodes (14): getRole(), roles(), updateAgentPermissions(), updateFileCitationsPermissions(), updateFileSearchPermissions(), updateMarketplacePermissions(), updateMCPServersPermissions(), updateMemoryPermissions() (+6 more)

### Community 24 - "renderCustomGroups"
Cohesion: 0.26
Nodes (8): renderCustomGroups(), renderEndpoints(), renderModelSpecs(), renderSearchResults(), DialogManagerProps, ModelSelectorContent(), getDisplayValue(), getSelectedIcon()

### Community 25 - "ModelSelectorChatContext"
Cohesion: 0.21
Nodes (10): ModelSelectorChatContext, ModelSelectorChatContextValue, ModelSelectorChatProvider(), useModelSelectorChatContext(), ModelSelectorContext, ModelSelectorContextType, ModelSelectorProvider(), ModelSelectorProviderProps (+2 more)

### Community 26 - "index"
Cohesion: 0.24
Nodes (11): applyModelSpecPreset(), ApplyModelSpecPresetParams, ApplyModelSpecPresetResult, findModelSpecByName(), hasModelSpecValue(), isModelSpecEndpointMatch(), mergeModelSpecPreset(), ModelSpecParsedBody (+3 more)

### Community 27 - "projectById"
Cohesion: 0.15
Nodes (13): projectById(), projectMetaAds(), projectMetaAdsApply(), projectMetaAdsBudget(), projectMetaAdsDuplicate(), projectMetaAdsEntityStatus(), projectMetaAdsPerformance(), projectMetaAdsRankings() (+5 more)

### Community 28 - "EndpointService"
Cohesion: 0.17
Nodes (9): anthropicUsesVertex, { EModelEndpoint }, { generateConfig }, { isUserProvided, isEnabled }, userProvidedOpenAI, { config }, { loadServiceKey, isUserProvided }, { logger } (+1 more)

### Community 29 - "createToolLoader"
Cohesion: 0.18
Nodes (11): createToolLoader(), initializeClient(), { batchUploadCodeEnvFiles }, buildSkillPrimedIdsByName(), db, { enrichWithSkillConfigurable }, {
  getSessionInfo,
  checkIfActive,
  readSandboxFile,
}, getSkillToolDeps() (+3 more)

### Community 30 - "build"
Cohesion: 0.20
Nodes (9): buildOptions(), db, { getMCPServerTools }, { isAgentsEndpoint, removeNullishValues, Constants }, loadAgent(), { loadAgent: loadAgentFn }, { logger }, build (+1 more)

### Community 31 - "index"
Cohesion: 0.20
Nodes (7): SearchResults(), SearchResultsProps, anthropicEndpoint, mockHandleSelectEndpoint, mockHandleSelectModel, mockHandleSelectSpec, noModelsEndpoint

### Community 32 - "deletePrompt"
Cohesion: 0.18
Nodes (11): deletePrompt(), getAllPromptGroups(), getPrompt(), getPromptGroup(), getPromptGroupsWithFilters(), getPromptsWithFilters(), getRandomPrompts(), prompts() (+3 more)

### Community 33 - "allowedAddressesSchema"
Cohesion: 0.18
Nodes (10): allowedAddressesSchema, configSchema, excludedKeys, getEndpointField(), resolveEndpointType(), endpointsConfig, webSearchSchema, EModelEndpoint (+2 more)

### Community 34 - "messages"
Cohesion: 0.20
Nodes (9): { ContentTypes }, db, express, { findAllArtifacts, replaceArtifactContent }, { logger }, { requireJwtAuth, validateMessageReq }, router, { unescapeLaTeX, countTokens } (+1 more)

### Community 35 - "assistants"
Cohesion: 0.20
Nodes (10): assistants(), avatar(), files(), getCustomConfigSpeech(), images(), speech(), speechToText(), textToSpeech() (+2 more)

### Community 36 - "models"
Cohesion: 0.20
Nodes (9): specsConfigSchema, TModelSpec, tModelSpecSchema, TSpecsConfig, AuthType, authTypeSchema, eModelEndpointSchema, TModelSpecPreset (+1 more)

### Community 37 - "addedConvo"
Cohesion: 0.29
Nodes (7): {
  ADDED_AGENT_ID,
  initializeAgent,
  validateAgentModel,
  loadAddedAgent: loadAddedAgentFn,
}, db, { filterFilesByAgentAccess }, { getMCPServerTools }, loadAddedAgent(), { logger }, processAddedConvo()

### Community 38 - "addedConvo spec"
Cohesion: 0.25
Nodes (6): mockGetAgent, mockGetMCPServerTools, mockInitializeAgent, mockLoadAddedAgent, mockValidateAgentModel, { processAddedConvo }

### Community 39 - "CustomMenu"
Cohesion: 0.25
Nodes (7): CustomMenu, CustomMenuGroup, CustomMenuGroupProps, CustomMenuItemProps, CustomMenuProps, CustomMenuSeparator, SearchableContext

### Community 40 - "presets"
Cohesion: 0.29
Nodes (6): crypto, express, { getPresets, savePreset, deletePresets }, { logger }, requireJwtAuth, router

### Community 41 - "title"
Cohesion: 0.33
Nodes (6): addTitle(), { CacheKeys }, getLogStores, { isEnabled }, { logger }, { saveConvo }

### Community 42 - "ModelController"
Cohesion: 0.47
Nodes (5): getModelsConfig(), { loadDefaultModels, loadConfigModels }, loadModels(), { logger }, modelController()

### Community 43 - "getSkill"
Cohesion: 0.33
Nodes (6): getSkill(), importSkill(), listSkillsWithFilters(), skillFile(), skillFiles(), skills()

### Community 44 - "endpoints"
Cohesion: 0.40
Nodes (4): endpointController, express, requireJwtAuth, router

### Community 45 - "models"
Cohesion: 0.40
Nodes (4): express, { modelController }, { requireJwtAuth }, router

### Community 46 - "getEndpointsConfig"
Cohesion: 0.40
Nodes (4): { createEndpointsConfigService }, { getAppConfig }, { getEndpointsConfig, checkCapability }, loadDefaultEndpointsConfig

### Community 48 - "endpoints"
Cohesion: 0.40
Nodes (4): defaultConfig, endpointsConfig, endpointsFilter, endpointsQueryEnabled

### Community 50 - "ModelSpecItem test"
Cohesion: 0.50
Nodes (3): baseSpec, mockHandleSelectSpec, mockToggleFavoriteSpec

### Community 51 - "adminConfigActive"
Cohesion: 0.50
Nodes (4): adminConfigActive(), adminConfigBase(), adminConfigByPrincipal(), adminConfigs()

### Community 52 - "keys"
Cohesion: 0.50
Nodes (3): DynamicQueryKeys, MutationKeys, QueryKeys

### Community 57 - "addTagToConversation"
Cohesion: 0.67
Nodes (3): addTagToConversation(), conversationTags(), conversationTagsList()

### Community 58 - "adminFunctionById"
Cohesion: 0.67
Nodes (3): adminFunctionById(), adminFunctions(), adminFunctionToggle()

### Community 59 - "adminGroupById"
Cohesion: 0.67
Nodes (3): adminGroupById(), adminGroupMembers(), adminGroups()

### Community 60 - "adminTenants"
Cohesion: 0.67
Nodes (3): adminTenants(), adminTenantStats(), adminTenantUsers()

### Community 61 - "agents"
Cohesion: 0.67
Nodes (3): agents(), cloneAgentToTenant(), revertAgentVersion()

### Community 62 - "buildQuery"
Cohesion: 0.67
Nodes (3): buildQuery(), conversations(), messages()

### Community 63 - "deleteCategory"
Cohesion: 0.67
Nodes (3): deleteCategory(), getCategories(), updateCategory()

### Community 64 - "memories"
Cohesion: 0.67
Nodes (3): memories(), memory(), memoryPreferences()

### Community 65 - "deleteSkill"
Cohesion: 0.67
Nodes (3): deleteSkill(), getSkill(), updateSkill()

### Community 67 - "BedrockProviders"
Cohesion: 0.67
Nodes (3): BedrockProviders, getModelKey(), getSettingsKeys()

## Knowledge Gaps
- **557 isolated node(s):** `{ getEndpointsConfig }`, `{ logger }`, `{ loadDefaultModels, loadConfigModels }`, `{
  handleError,
  applyModelSpecPreset,
  findModelSpecByName,
  isModelSpecEndpointMatch,
  resolveModelSpecPromptPrefixVariables,
}`, `{ logger }` (+552 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **20 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `config()` connect `createToolLoader` to `api endpoints`?**
  _High betweenness centrality (0.060) - this node is a cross-community bridge._
- **Why does `initializeClient()` connect `createToolLoader` to `initialize`, `initialize spec`, `addedConvo`?**
  _High betweenness centrality (0.060) - this node is a cross-community bridge._
- **Why does `processAddedConvo()` connect `addedConvo` to `initialize`, `createToolLoader`, `addedConvo spec`?**
  _High betweenness centrality (0.007) - this node is a cross-community bridge._
- **What connects `{ getEndpointsConfig }`, `{ logger }`, `{ loadDefaultModels, loadConfigModels }` to the rest of the system?**
  _561 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `data service` be split into smaller, more focused modules?**
  _Cohesion score 0.008298755186721992 - nodes in this community are weakly interconnected._
- **Should `config` be split into smaller, more focused modules?**
  _Cohesion score 0.0136986301369863 - nodes in this community are weakly interconnected._
- **Should `schemas` be split into smaller, more focused modules?**
  _Cohesion score 0.020618556701030927 - nodes in this community are weakly interconnected._