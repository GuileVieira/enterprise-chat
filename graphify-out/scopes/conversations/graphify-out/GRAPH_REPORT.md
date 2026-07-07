# Graph Report - .  (2026-07-07)

## Corpus Check
- 49 files · ~56,637 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 842 nodes · 972 edges · 56 communities (36 shown, 20 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 42 edges (avg confidence: 0.53)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_data service|data service]]
- [[_COMMUNITY_api endpoints|api endpoints]]
- [[_COMMUNITY_chat|chat]]
- [[_COMMUNITY_client|client]]
- [[_COMMUNITY_mutations|mutations]]
- [[_COMMUNITY_v1|v1]]
- [[_COMMUNITY_queries|queries]]
- [[_COMMUNITY_conversation|conversation]]
- [[_COMMUNITY_responses|responses]]
- [[_COMMUNITY_messages|messages]]
- [[_COMMUNITY_ChatContext|ChatContext]]
- [[_COMMUNITY_request|request]]
- [[_COMMUNITY_message|message]]
- [[_COMMUNITY_ChatForm|ChatForm]]
- [[_COMMUNITY_getRole|getRole]]
- [[_COMMUNITY_projectById|projectById]]
- [[_COMMUNITY_MessageContent|MessageContent]]
- [[_COMMUNITY_deletePrompt|deletePrompt]]
- [[_COMMUNITY_assistants|assistants]]
- [[_COMMUNITY_validateMessageReq spec|validateMessageReq spec]]
- [[_COMMUNITY_importConversations|importConversations]]
- [[_COMMUNITY_ContentParts|ContentParts]]
- [[_COMMUNITY_getSkill|getSkill]]
- [[_COMMUNITY_MessagesView|MessagesView]]
- [[_COMMUNITY_mutations|mutations]]
- [[_COMMUNITY_adminConfigActive|adminConfigActive]]
- [[_COMMUNITY_processMessages spec|processMessages spec]]
- [[_COMMUNITY_AgentUpdate|AgentUpdate]]
- [[_COMMUNITY_useAddedResponse|useAddedResponse]]
- [[_COMMUNITY_useChatFunctions|useChatFunctions]]
- [[_COMMUNITY_addTagToConversation|addTagToConversation]]
- [[_COMMUNITY_adminFunctionById|adminFunctionById]]
- [[_COMMUNITY_adminGroupById|adminGroupById]]
- [[_COMMUNITY_adminTenants|adminTenants]]
- [[_COMMUNITY_agents|agents]]
- [[_COMMUNITY_deleteCategory|deleteCategory]]
- [[_COMMUNITY_memories|memories]]
- [[_COMMUNITY_deleteSkill|deleteSkill]]
- [[_COMMUNITY_messages|messages]]
- [[_COMMUNITY_conversationTag|conversationTag]]
- [[_COMMUNITY_ChatFormContext|ChatFormContext]]
- [[_COMMUNITY_adminSecretByName|adminSecretByName]]
- [[_COMMUNITY_adminUsers|adminUsers]]
- [[_COMMUNITY_message|message]]
- [[_COMMUNITY_message|message]]
- [[_COMMUNITY_deletePromptGroup|deletePromptGroup]]
- [[_COMMUNITY_postCategory|postCategory]]
- [[_COMMUNITY_postPrompt|postPrompt]]
- [[_COMMUNITY_updatePromptGroup|updatePromptGroup]]

## God Nodes (most connected - your core abstractions)
1. `AgentClient` - 22 edges
2. `getRole()` - 14 edges
3. `projectMetaAds()` - 13 edges
4. `MessageMethods` - 13 edges
5. `createMessageMethods()` - 13 edges
6. `ConversationMethods` - 12 edges
7. `createConversationMethods()` - 12 edges
8. `prompts()` - 9 edges
9. `createResponse()` - 7 edges
10. `createAgentHandler()` - 7 edges

## Surprising Connections (you probably didn't know these)
- `useAddedResponse()` --indirect_call--> `models()`  [INFERRED]
  client/src/hooks/Chat/useAddedResponse.ts → packages/data-provider/src/api-endpoints.ts
- `useChatHelpers()` --indirect_call--> `messages()`  [INFERRED]
  client/src/hooks/Chat/useChatHelpers.ts → packages/data-provider/src/api-endpoints.ts
- `MessagesViewContextValue` --references--> `useChatContext()`  [EXTRACTED]
  client/src/Providers/MessagesViewContext.tsx → client/src/Providers/ChatContext.tsx
- `MessagesViewProvider()` --calls--> `useChatContext()`  [EXTRACTED]
  client/src/Providers/MessagesViewContext.tsx → client/src/Providers/ChatContext.tsx
- `useTagConversationMutation()` --calls--> `useConversationTagsQuery()`  [EXTRACTED]
  client/src/data-provider/mutations.ts → client/src/data-provider/queries.ts

## Import Cycles
- None detected.

## Communities (56 total, 20 thin omitted)

### Community 2 - "chat"
Cohesion: 0.04
Nodes (42): addTitle, AgentController, checkAgentAccess, checkAgentResourceAccess, controller(), express, { generateCheckAccess, skipAgentCheck }, { getRoleByName } (+34 more)

### Community 3 - "client"
Cohesion: 0.06
Nodes (23): AgentClient, BaseClient, {
  Callback,
  Providers,
  TitleMethod,
  formatMessage,
  formatAgentMessages,
  createMetadataAggregator,
}, {
  Constants,
  Permissions,
  VisionModes,
  ContentTypes,
  EModelEndpoint,
  PermissionTypes,
  AgentCapabilities,
  isAgentsEndpoint,
  isEphemeralAgentId,
  removeNullishValues,
}, { createContextHandlers }, {
  createRun,
  isEnabled,
  checkAccess,
  buildToolSet,
  logToolError,
  sanitizeTitle,
  payloadParser,
  resolveHeaders,
  createSafeUser,
  initializeAgent,
  countTokens,
  getBalanceConfig,
  omitTitleOptions,
  getProviderConfig,
  memoryInstructions,
  createTokenCounter,
  applyContextToAgent,
  isMemoryAgentEnabled,
  recordCollectedUsage,
  GenerationJobManager,
  getTransactionsConfig,
  resolveRecursionLimit,
  createMemoryProcessor,
  loadAgent: loadAgentFn,
  createMultiAgentMapper,
  filterMalformedContentParts,
  countFormattedMessageTokens,
  hydrateMissingIndexTokenCounts,
  injectSkillPrimes,
  isSkillPrimeMessage,
  collectFileIds,
  buildAgentScopedContext,
  buildSkillPrimeContentParts,
  buildInitialToolSessions,
}, db, { encodeAndFormat } (+15 more)

### Community 4 - "mutations"
Cohesion: 0.05
Nodes (5): TODO: CHECK THIS, no-op; restore if needed, useDeleteConversationTagMutation(), useDeleteTagInConversations(), useTagConversationMutation(), useConversationTagsQuery()

### Community 5 - "v1"
Cohesion: 0.08
Nodes (34): classifyAgentReferences(), createAgentHandler(), createAgentInRequestTenant(), db, duplicateAgentHandler(), escapeRegex(), filterAuthorizedTools(), { filterFile } (+26 more)

### Community 6 - "queries"
Cohesion: 0.07
Nodes (6): CachedProjectMetaAdsStatus, getProjectMetaAdsStatusCacheKey(), isProjectMetaAdsStatus(), readCachedProjectMetaAdsStatus(), useProjectMetaAdsQuery(), writeCachedProjectMetaAdsStatus()

### Community 7 - "conversation"
Cohesion: 0.11
Nodes (5): ConversationMethods, createConversationMethods(), deleteMessages, getMessages, modelsToCleanup

### Community 8 - "responses"
Cohesion: 0.10
Nodes (23): { Callback, ToolEndHandler, formatAgentMessages }, convertMessagesToOutputItems(), convertToInternalMessages(), createResponse(), {
  createResponsesToolEndCallback,
  buildSummarizationHandlers,
  markSummarizationUsage,
  createToolEndCallback,
  agentLogHandlerObj,
}, {
  createRun,
  buildToolSet,
  loadSkillStates,
  resolveAgentScopedSkillIds,
  createSafeUser,
  initializeAgent,
  getBalanceConfig,
  recordCollectedUsage,
  getTransactionsConfig,
  extractManualSkills,
  injectSkillPrimes,
  createToolExecuteHandler,
  discoverConnectedAgents,
  getRemoteAgentPermissions,
  // Responses API
  writeDone,
  buildResponse,
  generateResponseId,
  isValidationFailure,
  emitResponseCreated,
  createResponseContext,
  createResponseTracker,
  setupStreamingResponse,
  emitResponseInProgress,
  convertInputToMessages,
  validateResponseRequest,
  buildAggregatedResponse,
  createResponseAggregator,
  sendResponsesErrorResponse,
  createResponsesEventHandlers,
  createAggregatorEventHandlers,
}, createToolLoader(), db (+15 more)

### Community 9 - "messages"
Cohesion: 0.12
Nodes (15): { ContentTypes }, db, express, { findAllArtifacts, replaceArtifactContent }, { logger }, { requireJwtAuth, validateMessageReq }, router, { unescapeLaTeX, countTokens } (+7 more)

### Community 10 - "ChatContext"
Cohesion: 0.17
Nodes (13): ChatContext, TChatContext, useChatContext(), MessagesViewContext, MessagesViewContextValue, MessagesViewProvider(), NOOP_OPS, OptionalMessagesOps (+5 more)

### Community 11 - "request"
Cohesion: 0.19
Nodes (14): AgentController(), attachConversationCreatedAt(), { Constants, ViolationTypes }, createCloseHandler(), { disposeClient, clientRegistry, requestDataMap }, { handleAbortError }, _LegacyAgentController(), { logger } (+6 more)

### Community 13 - "ChatForm"
Cohesion: 0.15
Nodes (8): ChatForm, ChatFormProps, ProjectPromptSnippets, ProjectPromptSnippetsProps, PromptSnippet, SendButton, SendButtonProps, SubmitButton

### Community 14 - "getRole"
Cohesion: 0.14
Nodes (14): getRole(), roles(), updateAgentPermissions(), updateFileCitationsPermissions(), updateFileSearchPermissions(), updateMarketplacePermissions(), updateMCPServersPermissions(), updateMemoryPermissions() (+6 more)

### Community 15 - "projectById"
Cohesion: 0.15
Nodes (13): projectById(), projectMetaAds(), projectMetaAdsApply(), projectMetaAdsBudget(), projectMetaAdsDuplicate(), projectMetaAdsEntityStatus(), projectMetaAdsPerformance(), projectMetaAdsRankings() (+5 more)

### Community 16 - "MessageContent"
Cohesion: 0.20
Nodes (4): HiddenPromptMetadata, MemoizedMessageContent, MessageContent(), parseThinkingContent()

### Community 17 - "deletePrompt"
Cohesion: 0.18
Nodes (11): deletePrompt(), getAllPromptGroups(), getPrompt(), getPromptGroup(), getPromptGroupsWithFilters(), getPromptsWithFilters(), getRandomPrompts(), prompts() (+3 more)

### Community 18 - "assistants"
Cohesion: 0.20
Nodes (10): assistants(), avatar(), files(), getCustomConfigSpeech(), images(), speech(), speechToText(), textToSpeech() (+2 more)

### Community 19 - "validateMessageReq spec"
Cohesion: 0.29
Nodes (3): { getConvo }, validateMessageReq, { getConvo }

### Community 20 - "importConversations"
Cohesion: 0.33
Nodes (4): { getImporter }, { logger }, maxFileSize, { resolveImportMaxFileSize }

### Community 21 - "ContentParts"
Cohesion: 0.33
Nodes (4): ContentParts, ContentPartsProps, PartWithContext, PartWithContextProps

### Community 22 - "getSkill"
Cohesion: 0.33
Nodes (6): getSkill(), importSkill(), listSkillsWithFilters(), skillFile(), skillFiles(), skills()

### Community 25 - "adminConfigActive"
Cohesion: 0.50
Nodes (4): adminConfigActive(), adminConfigBase(), adminConfigByPrincipal(), adminConfigs()

### Community 30 - "addTagToConversation"
Cohesion: 0.67
Nodes (3): addTagToConversation(), conversationTags(), conversationTagsList()

### Community 31 - "adminFunctionById"
Cohesion: 0.67
Nodes (3): adminFunctionById(), adminFunctions(), adminFunctionToggle()

### Community 32 - "adminGroupById"
Cohesion: 0.67
Nodes (3): adminGroupById(), adminGroupMembers(), adminGroups()

### Community 33 - "adminTenants"
Cohesion: 0.67
Nodes (3): adminTenants(), adminTenantStats(), adminTenantUsers()

### Community 34 - "agents"
Cohesion: 0.67
Nodes (3): agents(), cloneAgentToTenant(), revertAgentVersion()

### Community 35 - "deleteCategory"
Cohesion: 0.67
Nodes (3): deleteCategory(), getCategories(), updateCategory()

### Community 36 - "memories"
Cohesion: 0.67
Nodes (3): memories(), memory(), memoryPreferences()

### Community 37 - "deleteSkill"
Cohesion: 0.67
Nodes (3): deleteSkill(), getSkill(), updateSkill()

## Knowledge Gaps
- **151 isolated node(s):** `{ logger }`, `{ getBufferString, HumanMessage }`, `{
  createRun,
  isEnabled,
  checkAccess,
  buildToolSet,
  logToolError,
  sanitizeTitle,
  payloadParser,
  resolveHeaders,
  createSafeUser,
  initializeAgent,
  countTokens,
  getBalanceConfig,
  omitTitleOptions,
  getProviderConfig,
  memoryInstructions,
  createTokenCounter,
  applyContextToAgent,
  isMemoryAgentEnabled,
  recordCollectedUsage,
  GenerationJobManager,
  getTransactionsConfig,
  resolveRecursionLimit,
  createMemoryProcessor,
  loadAgent: loadAgentFn,
  createMultiAgentMapper,
  filterMalformedContentParts,
  countFormattedMessageTokens,
  hydrateMissingIndexTokenCounts,
  injectSkillPrimes,
  isSkillPrimeMessage,
  collectFileIds,
  buildAgentScopedContext,
  buildSkillPrimeContentParts,
  buildInitialToolSessions,
}`, `{
  Callback,
  Providers,
  TitleMethod,
  formatMessage,
  formatAgentMessages,
  createMetadataAggregator,
}`, `{
  Constants,
  Permissions,
  VisionModes,
  ContentTypes,
  EModelEndpoint,
  PermissionTypes,
  AgentCapabilities,
  isAgentsEndpoint,
  isEphemeralAgentId,
  removeNullishValues,
}` (+146 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **20 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `messages()` connect `client` to `api endpoints`?**
  _High betweenness centrality (0.027) - this node is a cross-community bridge._
- **Why does `agents()` connect `agents` to `api endpoints`, `client`?**
  _High betweenness centrality (0.025) - this node is a cross-community bridge._
- **Are the 11 inferred relationships involving `createMessageMethods()` (e.g. with `.bulkSaveMessages()` and `.deleteMessages()`) actually correct?**
  _`createMessageMethods()` has 11 INFERRED edges - model-reasoned connections that need verification._
- **What connects `{ logger }`, `{ getBufferString, HumanMessage }`, `{
  createRun,
  isEnabled,
  checkAccess,
  buildToolSet,
  logToolError,
  sanitizeTitle,
  payloadParser,
  resolveHeaders,
  createSafeUser,
  initializeAgent,
  countTokens,
  getBalanceConfig,
  omitTitleOptions,
  getProviderConfig,
  memoryInstructions,
  createTokenCounter,
  applyContextToAgent,
  isMemoryAgentEnabled,
  recordCollectedUsage,
  GenerationJobManager,
  getTransactionsConfig,
  resolveRecursionLimit,
  createMemoryProcessor,
  loadAgent: loadAgentFn,
  createMultiAgentMapper,
  filterMalformedContentParts,
  countFormattedMessageTokens,
  hydrateMissingIndexTokenCounts,
  injectSkillPrimes,
  isSkillPrimeMessage,
  collectFileIds,
  buildAgentScopedContext,
  buildSkillPrimeContentParts,
  buildInitialToolSessions,
}` to the rest of the system?**
  _156 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `data service` be split into smaller, more focused modules?**
  _Cohesion score 0.008298755186721992 - nodes in this community are weakly interconnected._
- **Should `api endpoints` be split into smaller, more focused modules?**
  _Cohesion score 0.021052631578947368 - nodes in this community are weakly interconnected._
- **Should `chat` be split into smaller, more focused modules?**
  _Cohesion score 0.04440333024976873 - nodes in this community are weakly interconnected._