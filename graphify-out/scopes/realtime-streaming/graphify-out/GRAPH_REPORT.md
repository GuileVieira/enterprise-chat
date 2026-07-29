# Graph Report - .  (2026-07-07)

## Corpus Check
- 238 files · ~216,786 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1929 nodes · 2651 edges · 118 communities (83 shown, 35 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 64 edges (avg confidence: 0.55)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_data service|data service]]
- [[_COMMUNITY_api endpoints|api endpoints]]
- [[_COMMUNITY_handlers|handlers]]
- [[_COMMUNITY_v1|v1]]
- [[_COMMUNITY_callbacks|callbacks]]
- [[_COMMUNITY_actions|actions]]
- [[_COMMUNITY_build|build]]
- [[_COMMUNITY_EditMessage|EditMessage]]
- [[_COMMUNITY_Feedback|Feedback]]
- [[_COMMUNITY_cleanup|cleanup]]
- [[_COMMUNITY_permissions|permissions]]
- [[_COMMUNITY_handle|handle]]
- [[_COMMUNITY_BashCall|BashCall]]
- [[_COMMUNITY_Attachment|Attachment]]
- [[_COMMUNITY_RedisJobStore|RedisJobStore]]
- [[_COMMUNITY_GenerationJobManagerClass|GenerationJobManagerClass]]
- [[_COMMUNITY_Reasoning|Reasoning]]
- [[_COMMUNITY_index|index]]
- [[_COMMUNITY_MessageNav|MessageNav]]
- [[_COMMUNITY_cacheConfig|cacheConfig]]
- [[_COMMUNITY_responses|responses]]
- [[_COMMUNITY_StreamRunManager|StreamRunManager]]
- [[_COMMUNITY_CHANNELS|CHANNELS]]
- [[_COMMUNITY_index|index]]
- [[_COMMUNITY_llm|llm]]
- [[_COMMUNITY_getJobStore|getJobStore]]
- [[_COMMUNITY_InMemoryJobStore|InMemoryJobStore]]
- [[_COMMUNITY_createStreamServices|createStreamServices]]
- [[_COMMUNITY_openai|openai]]
- [[_COMMUNITY_index|index]]
- [[_COMMUNITY_build|build]]
- [[_COMMUNITY_llm|llm]]
- [[_COMMUNITY_index|index]]
- [[_COMMUNITY_keyvMongo|keyvMongo]]
- [[_COMMUNITY_RetrievalCall|RetrievalCall]]
- [[_COMMUNITY_MessageIcon|MessageIcon]]
- [[_COMMUNITY_ToolCall test|ToolCall test]]
- [[_COMMUNITY_useResumableSSE spec|useResumableSSE spec]]
- [[_COMMUNITY_ChatContext|ChatContext]]
- [[_COMMUNITY_CodeWindowHeader|CodeWindowHeader]]
- [[_COMMUNITY_ContentParts|ContentParts]]
- [[_COMMUNITY_DialogImage|DialogImage]]
- [[_COMMUNITY_LogLink|LogLink]]
- [[_COMMUNITY_IEventTransport|IEventTransport]]
- [[_COMMUNITY_getRole|getRole]]
- [[_COMMUNITY_index|index]]
- [[_COMMUNITY_InMemoryEventTransport|InMemoryEventTransport]]
- [[_COMMUNITY_projectById|projectById]]
- [[_COMMUNITY_ChatForm|ChatForm]]
- [[_COMMUNITY_ErrorMessage|ErrorMessage]]
- [[_COMMUNITY_PartWithIndex|PartWithIndex]]
- [[_COMMUNITY_GenerationJobManager|GenerationJobManager]]
- [[_COMMUNITY_stream|stream]]
- [[_COMMUNITY_message|message]]
- [[_COMMUNITY_messageLimiters|messageLimiters]]
- [[_COMMUNITY_ParallelContent|ParallelContent]]
- [[_COMMUNITY_WebSearch test|WebSearch test]]
- [[_COMMUNITY_deletePrompt|deletePrompt]]
- [[_COMMUNITY_EditTextPart|EditTextPart]]
- [[_COMMUNITY_ToolCallInfo|ToolCallInfo]]
- [[_COMMUNITY_assistants|assistants]]
- [[_COMMUNITY_build|build]]
- [[_COMMUNITY_CancelledIcon|CancelledIcon]]
- [[_COMMUNITY_TextStream|TextStream]]
- [[_COMMUNITY_FilePreviewDialog|FilePreviewDialog]]
- [[_COMMUNITY_OutputRenderer|OutputRenderer]]
- [[_COMMUNITY_ArtifactRouting test|ArtifactRouting test]]
- [[_COMMUNITY_cleanup|cleanup]]
- [[_COMMUNITY_Container|Container]]
- [[_COMMUNITY_MemoryArtifacts|MemoryArtifacts]]
- [[_COMMUNITY_TextAttachment test|TextAttachment test]]
- [[_COMMUNITY_ToolCallsMapContext|ToolCallsMapContext]]
- [[_COMMUNITY_llm|llm]]
- [[_COMMUNITY_events|events]]
- [[_COMMUNITY_getSkill|getSkill]]
- [[_COMMUNITY_AgentHandoff|AgentHandoff]]
- [[_COMMUNITY_useChatHelpers|useChatHelpers]]
- [[_COMMUNITY_publisher|publisher]]
- [[_COMMUNITY_standardCache namespace isolation spec|standardCache namespace isolation spec]]
- [[_COMMUNITY_adminConfigActive|adminConfigActive]]
- [[_COMMUNITY_keys|keys]]
- [[_COMMUNITY_UIResourceCarousel test|UIResourceCarousel test]]
- [[_COMMUNITY_MinimalHoverButtons|MinimalHoverButtons]]
- [[_COMMUNITY_sessionCache cache integration spec|sessionCache cache integration spec]]
- [[_COMMUNITY_addTagToConversation|addTagToConversation]]
- [[_COMMUNITY_adminFunctionById|adminFunctionById]]
- [[_COMMUNITY_adminGroupById|adminGroupById]]
- [[_COMMUNITY_adminTenants|adminTenants]]
- [[_COMMUNITY_agents|agents]]
- [[_COMMUNITY_deleteCategory|deleteCategory]]
- [[_COMMUNITY_memories|memories]]
- [[_COMMUNITY_deleteSkill|deleteSkill]]
- [[_COMMUNITY_stop cluster sh|stop cluster sh]]
- [[_COMMUNITY_MinimalMessages|MinimalMessages]]
- [[_COMMUNITY_PlaceholderRow|PlaceholderRow]]
- [[_COMMUNITY_useStepHandler spec|useStepHandler spec]]
- [[_COMMUNITY_limiterCache cache integration spec|limiterCache cache integration spec]]
- [[_COMMUNITY_redisClients cache integration spec|redisClients cache integration spec]]
- [[_COMMUNITY_RedisJobStore stream integration spec|RedisJobStore stream integration spec]]
- [[_COMMUNITY_adminSecretByName|adminSecretByName]]
- [[_COMMUNITY_adminUsers|adminUsers]]
- [[_COMMUNITY_start cluster sh|start cluster sh]]
- [[_COMMUNITY_start redis tls sh|start redis tls sh]]
- [[_COMMUNITY_deletePromptGroup|deletePromptGroup]]
- [[_COMMUNITY_postCategory|postCategory]]
- [[_COMMUNITY_postPrompt|postPrompt]]
- [[_COMMUNITY_updatePromptGroup|updatePromptGroup]]

## God Nodes (most connected - your core abstractions)
1. `GenerationJobManagerClass` - 39 edges
2. `RedisJobStore` - 35 edges
3. `IJobStore` - 30 edges
4. `InMemoryJobStore` - 26 edges
5. `RedisEventTransport` - 26 edges
6. `StreamRunManager` - 25 edges
7. `IEventTransport` - 23 edges
8. `AttachmentGroup()` - 17 edges
9. `InMemoryEventTransport` - 17 edges
10. `createAgentChatCompletion()` - 14 edges

## Surprising Connections (you probably didn't know these)
- `MemoryInfo()` --indirect_call--> `messages()`  [INFERRED]
  client/src/components/Chat/Messages/Content/MemoryInfo.tsx → packages/data-provider/src/api-endpoints.ts
- `initializeClient()` --indirect_call--> `config()`  [INFERRED]
  api/server/services/Endpoints/agents/initialize.js → packages/data-provider/src/api-endpoints.ts
- `useChatHelpers()` --indirect_call--> `messages()`  [INFERRED]
  client/src/hooks/Chat/useChatHelpers.ts → packages/data-provider/src/api-endpoints.ts
- `useResumeOnLoad()` --indirect_call--> `messages()`  [INFERRED]
  client/src/hooks/SSE/useResumeOnLoad.ts → packages/data-provider/src/api-endpoints.ts
- `createToolEndCallback()` --indirect_call--> `user()`  [INFERRED]
  api/server/controllers/agents/callbacks.js → packages/data-provider/src/api-endpoints.ts

## Import Cycles
- None detected.

## Communities (118 total, 35 thin omitted)

### Community 2 - "handlers"
Cohesion: 0.05
Nodes (56): createChunk(), createOpenAIContentAggregator(), createOpenAIHandlers(), createOpenAIStreamTracker(), EventHandler, GraphEvents, MessageDeltaData, ModelEndData (+48 more)

### Community 3 - "v1"
Cohesion: 0.06
Nodes (44): classifyAgentReferences(), createAgentHandler(), createAgentInRequestTenant(), db, duplicateAgentHandler(), escapeRegex(), filterAuthorizedTools(), { filterFile } (+36 more)

### Community 4 - "callbacks"
Cohesion: 0.07
Nodes (41): agentLogHandler(), agentLogHandlerObj, ALLOWED_LOG_LEVELS, buildResponsesAttachment(), checkIfLastAgent(), createResponsesToolEndCallback(), createToolEndCallback(), emitEvent() (+33 more)

### Community 5 - "actions"
Cohesion: 0.04
Nodes (41): { canAccessAgentResource }, checkAgentCreate, db, express, { findAccessibleResources }, {
  generateCheckAccess,
  isActionDomainAllowed,
  validateActionOAuthMetadata,
}, {
  legacyDomainEncode,
  encryptMetadata,
  domainParser,
}, { logger } (+33 more)

### Community 6 - "build"
Cohesion: 0.05
Nodes (42): buildOptions(), db, { getMCPServerTools }, { isAgentsEndpoint, removeNullishValues, Constants }, loadAgent(), { loadAgent: loadAgentFn }, { logger }, build (+34 more)

### Community 7 - "EditMessage"
Cohesion: 0.07
Nodes (27): EditMessage(), Markdown, TContentProps, a, code, codeNoExecution, img, p (+19 more)

### Community 8 - "Feedback"
Cohesion: 0.06
Nodes (20): buttonClasses(), Feedback(), FeedbackButtons(), FeedbackProps, ICONS, HoverButton, HoverButtonProps, THoverButtons (+12 more)

### Community 9 - "cleanup"
Cohesion: 0.08
Nodes (27): shouldResetSubagentAtomsOnConversationChange(), setup(), submission, wrapper(), ChatHelpers, useAdaptiveSSE(), useAttachmentHandler(), TODO: handle streaming for non-text (+19 more)

### Community 10 - "permissions"
Cohesion: 0.05
Nodes (40): agentPermissionsSchema, bookmarkPermissionsSchema, fileCitationsPermissionsSchema, fileSearchPermissionsSchema, INTERFACE_PERMISSION_FIELDS, marketplacePermissionsSchema, mcpServersPermissionsSchema, memoryPermissionsSchema (+32 more)

### Community 11 - "handle"
Cohesion: 0.06
Nodes (30): getLogStores, _handleRun(), { logger }, { retrieveRun }, RunManager, { RunStatus, defaultOrderQuery, CacheKeys }, { sleep }, waitForRun() (+22 more)

### Community 12 - "BashCall"
Cohesion: 0.11
Nodes (23): BashCall(), areToolCallArgsComplete(), parseJsonField(), ToolCallArgs, FILENAME_MAP, LANG_MAP, langFromPath(), ReadFileCall() (+15 more)

### Community 13 - "Attachment"
Cohesion: 0.15
Nodes (27): Attachment(), AttachmentGroup(), FileAttachment, FileAttachmentGroup, ImageAttachment, MermaidArtifact, PanelArtifact, PanelArtifactProps (+19 more)

### Community 15 - "GenerationJobManagerClass"
Cohesion: 0.08
Nodes (4): GenerationJobManagerClass, RuntimeJobState, SerializableJobData, setupDisconnectedStream()

### Community 16 - "Reasoning"
Cohesion: 0.09
Nodes (18): Reasoning, ReasoningProps, extractPrompt(), extractSubagentType(), SubagentCall(), SubagentCallProps, tickerLineKey(), tryPrompt() (+10 more)

### Community 17 - "index"
Cohesion: 0.09
Nodes (28): app, axios, { capabilityContextMiddleware }, { checkMigrations }, compression, configureSocialLogins, { connectDb, indexSync }, cookieParser (+20 more)

### Community 18 - "MessageNav"
Cohesion: 0.09
Nodes (20): buildEntry(), buildFallbackEntry(), chevronButtonClasses, easeOutCubic(), extractPreviewFromContent(), getMessageEntries(), indicatorButtonClasses, MessageEntry (+12 more)

### Community 19 - "cacheConfig"
Cohesion: 0.13
Nodes (15): cacheConfig, USE_REDIS, inMemoryCacheMap, KeyvRedis, standardCache(), tokenConfigCache(), violationCache(), logFile (+7 more)

### Community 20 - "responses"
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

### Community 23 - "index"
Cohesion: 0.10
Nodes (17): manage, addThreadMetadata(), checkMessageGaps(), {
  Constants,
  ContentTypes,
  AnnotationTypes,
  defaultOrderQuery,
}, { countTokens }, { escapeRegExp }, mapMessagesToSteps(), path (+9 more)

### Community 24 - "llm"
Cohesion: 0.14
Nodes (20): applyDefaultParams(), applyOpenRouterReasoningConfig(), applyResponsesVerbosity(), applyVerbosityParam(), extractDefaultParams(), getModelKwargsText(), getOpenAILLMConfig(), getOpenRouterAnthropicVerbosity() (+12 more)

### Community 27 - "createStreamServices"
Cohesion: 0.14
Nodes (15): createInMemoryServices(), createStreamServices(), StreamServices, StreamServicesConfig, StreamState, ContentState, EventTypes, KEYS (+7 more)

### Community 28 - "openai"
Cohesion: 0.12
Nodes (20): {
  buildSummarizationHandlers,
  markSummarizationUsage,
  createToolEndCallback,
  agentLogHandlerObj,
}, { Callback, ToolEndHandler, formatAgentMessages }, convertContentPart(), convertMessages(), createToolLoader(), db, {
  EModelEndpoint,
  ResourceType,
  PermissionBits,
  hasPermissions,
  AgentCapabilities,
}, {
  findAccessibleResources,
  getEffectivePermissions,
} (+12 more)

### Community 29 - "index"
Cohesion: 0.11
Nodes (11): mockNavigate, mockTextAreaRef, useAddedResponse(), logChatRequest(), mockNavigate, mockResetLatestMultiMessage, mockSetFilesToDelete, mockSetShowStopButton (+3 more)

### Community 30 - "build"
Cohesion: 0.11
Nodes (12): buildOptions(), generateArtifactsPrompt, { getAssistant }, { removeNullishValues }, buildOptions, initializeClient, { ErrorTypes, EModelEndpoint, mapModelToAzureConfig }, Files (+4 more)

### Community 31 - "llm"
Cohesion: 0.16
Nodes (18): applyDefaultParams(), applyVertexMultiRegionEndpoint(), BlockedModelOptionParam, blockedModelOptionParams, getGoogleConfig(), getSafetySettings(), getThresholdMapping(), getVertexMultiRegionEndpoint() (+10 more)

### Community 32 - "index"
Cohesion: 0.13
Nodes (15): abortStream(), AbortStreamParams, AbortStreamResponse, useAbortStreamMutation(), ActiveJobsResponse, fetchStreamStatus(), genTitleQueryKey(), processedTitles (+7 more)

### Community 33 - "keyvMongo"
Cohesion: 0.19
Nodes (7): Client, CollectionClient, GridFSClient, keyvMongo, KeyvMongoCustom, KeyvMongoOptions, storeMap

### Community 34 - "RetrievalCall"
Cohesion: 0.17
Nodes (15): addFileMatch(), buildFileLookup(), DisplayResult, extractFileSources(), FileHeader(), FileMatch, FileSource, getFileIcon() (+7 more)

### Community 35 - "MessageIcon"
Cohesion: 0.14
Nodes (12): AGENT_AVATAR_COLORS, AgentMessageAvatar(), arePropsEqual(), getColorClass(), getInitials(), getSpecColorClass(), MessageIcon, MessageIconProps (+4 more)

### Community 36 - "ToolCall test"
Cohesion: 0.24
Nodes (11): ToolCall(), isError(), ResolvedIcon, StackedToolIcons(), StackedToolIconsProps, getMCPServerName(), getToolIconType(), ICON_MAP (+3 more)

### Community 37 - "useResumableSSE spec"
Cohesion: 0.12
Nodes (13): mockClearStepMaps, mockCreatedHandler, mockErrorHandler, mockFinalHandler, mockInvalidateQueries, mockQueryClient, mockRemoveQueries, mockSetIsSubmitting (+5 more)

### Community 38 - "ChatContext"
Cohesion: 0.17
Nodes (13): ChatContext, TChatContext, useChatContext(), MessagesViewContext, MessagesViewContextValue, MessagesViewProvider(), NOOP_OPS, OptionalMessagesOps (+5 more)

### Community 39 - "CodeWindowHeader"
Cohesion: 0.18
Nodes (12): CodeWindowHeaderProps, ExecuteCode(), HastElement, HastNode, HastText, hastToReact(), highlightCode(), loadLowlight() (+4 more)

### Community 40 - "ContentParts"
Cohesion: 0.14
Nodes (5): ContentParts, ContentPartsProps, PartWithContext, PartWithContextProps, baseProps

### Community 41 - "DialogImage"
Cohesion: 0.20
Nodes (9): DialogImage(), getQualityStyles(), imageSizeCache, computeHeightStyle(), dimensionCache, Image(), IMAGE_MAX_H, paintedUrls (+1 more)

### Community 42 - "LogLink"
Cohesion: 0.19
Nodes (11): AttachmentLinkOptions, isLocallyStoredSource(), LogLink(), LogLinkProps, useAttachmentLink(), mockDownloadFromApi, mockDownloadFromUrl, mockShowToast (+3 more)

### Community 44 - "getRole"
Cohesion: 0.14
Nodes (14): getRole(), roles(), updateAgentPermissions(), updateFileCitationsPermissions(), updateFileSearchPermissions(), updateMarketplacePermissions(), updateMCPServersPermissions(), updateMemoryPermissions() (+6 more)

### Community 45 - "index"
Cohesion: 0.26
Nodes (5): AGENT_STYLE_TOOLS, computeCancelled(), OpenAIImageGen(), ProgressText(), defaultProps

### Community 47 - "projectById"
Cohesion: 0.15
Nodes (13): projectById(), projectMetaAds(), projectMetaAdsApply(), projectMetaAdsBudget(), projectMetaAdsDuplicate(), projectMetaAdsEntityStatus(), projectMetaAdsPerformance(), projectMetaAdsRankings() (+5 more)

### Community 48 - "ChatForm"
Cohesion: 0.18
Nodes (6): ChatForm, ChatFormProps, SendButton, SendButtonProps, SubmitButton, StreamAudio()

### Community 49 - "ErrorMessage"
Cohesion: 0.17
Nodes (6): ErrorMessage(), Part, PartProps, AgentUpdate(), AgentUpdateProps, EmptyTextPart

### Community 50 - "PartWithIndex"
Cohesion: 0.20
Nodes (8): PartWithIndex, fileAttachment, imageAttachment, FRIENDLY_NAME_KEYS, getToolMeta(), ToolCallGroup(), ToolCallGroupProps, ToolMeta

### Community 51 - "GenerationJobManager"
Cohesion: 0.21
Nodes (6): GenerationJobManagerOptions, IMPORTANT: The emitterProxy.on('allSubscribersLeft') handler registration, AbortResult, JobStatus, ResumeState, UsageMetadata

### Community 52 - "stream"
Cohesion: 0.17
Nodes (11): ChunkHandler, ContentPart, DoneHandler, ErrorHandler, GenerationJob, GenerationJobMetadata, GenerationJobStatus, ResumeState (+3 more)

### Community 53 - "message"
Cohesion: 0.26
Nodes (10): buildMessageFiles(), FILE_STRIP_FIELDS, getThreadData(), MESSAGE_STRIP_FIELDS, RequestFile, sanitizeFileForTransmit(), sanitizeMessageForTransmit(), NO_PARENT (+2 more)

### Community 54 - "messageLimiters"
Cohesion: 0.20
Nodes (10): createHandler(), denyRequest, ipLimiterOptions, { limiterCache, removePorts }, { logViolation }, messageIpLimiter, messageUserLimiter, rateLimit (+2 more)

### Community 55 - "ParallelContent"
Cohesion: 0.18
Nodes (7): ParallelColumn, ParallelColumns, ParallelColumnsProps, ParallelContentRenderer, ParallelContentRendererProps, ParallelSection, SiblingHeaderProps

### Community 56 - "WebSearch test"
Cohesion: 0.22
Nodes (5): collectSources(), getUniqueDomainSources(), ProgressKeys, SourceFaviconStack(), WebSearch()

### Community 57 - "deletePrompt"
Cohesion: 0.18
Nodes (11): deletePrompt(), getAllPromptGroups(), getPrompt(), getPromptGroup(), getPromptGroupsWithFilters(), getPromptsWithFilters(), getRandomPrompts(), prompts() (+3 more)

### Community 58 - "EditTextPart"
Cohesion: 0.20
Nodes (5): FloatingSummaryBar, Summary, SummaryButton, SummaryContent, SummaryProps

### Community 59 - "ToolCallInfo"
Cohesion: 0.24
Nodes (6): ComplexInput(), formatParamValue(), InputRenderer(), isSimpleObject(), UIResourceCarousel, UIResourceCarouselProps

### Community 60 - "assistants"
Cohesion: 0.20
Nodes (10): assistants(), avatar(), files(), getCustomConfigSpeech(), images(), speech(), speechToText(), textToSpeech() (+2 more)

### Community 61 - "build"
Cohesion: 0.25
Nodes (7): buildOptions(), generateArtifactsPrompt, { getAssistant }, { removeNullishValues }, addTitle, buildOptions, initializeClient

### Community 63 - "TextStream"
Cohesion: 0.29
Nodes (3): { logger }, { Readable }, TextStream

### Community 64 - "FilePreviewDialog"
Cohesion: 0.46
Nodes (7): canPreviewByExt(), canPreviewByMime(), FilePreviewDialog(), FilePreviewDialogProps, formatBytes(), getDisplayType(), getFileExtension()

### Community 65 - "OutputRenderer"
Cohesion: 0.36
Nodes (7): cleanError(), ContentBlock, ExtractedText, extractText(), isStructuredText(), OutputRenderer(), OutputRendererProps

### Community 71 - "ToolCallsMapContext"
Cohesion: 0.33
Nodes (3): ToolCallsMapContext, ToolCallsMapContextType, ToolCallsMapProviderProps

### Community 72 - "llm"
Cohesion: 0.53
Nodes (4): applyDefaultParams(), getLLMConfig(), knownAnthropicParams, parseCredentials()

### Community 73 - "events"
Cohesion: 0.33
Nodes (5): CreatedEvent, FinalEvent, FinalMessageFields, ServerSentEvent, StreamEvent

### Community 74 - "getSkill"
Cohesion: 0.33
Nodes (6): getSkill(), importSkill(), listSkillsWithFilters(), skillFile(), skillFiles(), skills()

### Community 76 - "useChatHelpers"
Cohesion: 0.40
Nodes (4): useChatHelpers(), buildQuery(), conversations(), messages()

### Community 78 - "standardCache namespace isolation spec"
Cohesion: 0.50
Nodes (3): MockKeyvRedis, mockKeyvRedisClient, mockKeyvRedisInstance

### Community 79 - "adminConfigActive"
Cohesion: 0.50
Nodes (4): adminConfigActive(), adminConfigBase(), adminConfigByPrincipal(), adminConfigs()

### Community 80 - "keys"
Cohesion: 0.50
Nodes (3): DynamicQueryKeys, MutationKeys, QueryKeys

### Community 86 - "addTagToConversation"
Cohesion: 0.67
Nodes (3): addTagToConversation(), conversationTags(), conversationTagsList()

### Community 87 - "adminFunctionById"
Cohesion: 0.67
Nodes (3): adminFunctionById(), adminFunctions(), adminFunctionToggle()

### Community 88 - "adminGroupById"
Cohesion: 0.67
Nodes (3): adminGroupById(), adminGroupMembers(), adminGroups()

### Community 89 - "adminTenants"
Cohesion: 0.67
Nodes (3): adminTenants(), adminTenantStats(), adminTenantUsers()

### Community 90 - "agents"
Cohesion: 0.67
Nodes (3): agents(), cloneAgentToTenant(), revertAgentVersion()

### Community 91 - "deleteCategory"
Cohesion: 0.67
Nodes (3): deleteCategory(), getCategories(), updateCategory()

### Community 92 - "memories"
Cohesion: 0.67
Nodes (3): memories(), memory(), memoryPreferences()

### Community 93 - "deleteSkill"
Cohesion: 0.67
Nodes (3): deleteSkill(), getSkill(), updateSkill()

## Knowledge Gaps
- **548 isolated node(s):** `{ Readable }`, `{ logger }`, `{ nanoid }`, `{ logger }`, `{ Tools, StepTypes, FileContext, ErrorTypes }` (+543 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **35 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `messages()` connect `useChatHelpers` to `cleanup`, `MemoryArtifacts`, `api endpoints`?**
  _High betweenness centrality (0.209) - this node is a cross-community bridge._
- **Why does `MemoryInfo()` connect `MemoryArtifacts` to `useChatHelpers`?**
  _High betweenness centrality (0.195) - this node is a cross-community bridge._
- **Why does `initializeClient()` connect `build` to `callbacks`?**
  _High betweenness centrality (0.166) - this node is a cross-community bridge._
- **What connects `{ Readable }`, `{ logger }`, `{ nanoid }` to the rest of the system?**
  _555 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `data service` be split into smaller, more focused modules?**
  _Cohesion score 0.008298755186721992 - nodes in this community are weakly interconnected._
- **Should `api endpoints` be split into smaller, more focused modules?**
  _Cohesion score 0.021505376344086023 - nodes in this community are weakly interconnected._
- **Should `handlers` be split into smaller, more focused modules?**
  _Cohesion score 0.05405405405405406 - nodes in this community are weakly interconnected._