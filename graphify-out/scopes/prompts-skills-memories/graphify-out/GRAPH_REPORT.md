# Graph Report - .  (2026-07-07)

## Corpus Check
- 212 files · ~164,232 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1572 nodes · 1910 edges · 112 communities (88 shown, 24 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 79 edges (avg confidence: 0.58)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_data service|data service]]
- [[_COMMUNITY_schemas|schemas]]
- [[_COMMUNITY_api endpoints|api endpoints]]
- [[_COMMUNITY_client|client]]
- [[_COMMUNITY_permissions|permissions]]
- [[_COMMUNITY_skill|skill]]
- [[_COMMUNITY_components|components]]
- [[_COMMUNITY_fork|fork]]
- [[_COMMUNITY_skills|skills]]
- [[_COMMUNITY_AdminSettings|AdminSettings]]
- [[_COMMUNITY_binary|binary]]
- [[_COMMUNITY_skills|skills]]
- [[_COMMUNITY_index|index]]
- [[_COMMUNITY_CategorySelector|CategorySelector]]
- [[_COMMUNITY_import|import]]
- [[_COMMUNITY_improve|improve]]
- [[_COMMUNITY_prompts|prompts]]
- [[_COMMUNITY_PromptTextCard|PromptTextCard]]
- [[_COMMUNITY_index|index]]
- [[_COMMUNITY_AdminSettings|AdminSettings]]
- [[_COMMUNITY_context|context]]
- [[_COMMUNITY_importers|importers]]
- [[_COMMUNITY_DeletePrompt|DeletePrompt]]
- [[_COMMUNITY_CategorySelector|CategorySelector]]
- [[_COMMUNITY_index|index]]
- [[_COMMUNITY_memory|memory]]
- [[_COMMUNITY_PromptDetailHeader|PromptDetailHeader]]
- [[_COMMUNITY_memory|memory]]
- [[_COMMUNITY_Action|Action]]
- [[_COMMUNITY_getRole|getRole]]
- [[_COMMUNITY_memories|memories]]
- [[_COMMUNITY_SkillFileViewer|SkillFileViewer]]
- [[_COMMUNITY_projectById|projectById]]
- [[_COMMUNITY_defaults|defaults]]
- [[_COMMUNITY_importBatchBuilder|importBatchBuilder]]
- [[_COMMUNITY_index|index]]
- [[_COMMUNITY_promptImprove|promptImprove]]
- [[_COMMUNITY_EmptyPromptPreview|EmptyPromptPreview]]
- [[_COMMUNITY_UploadSkillDialog spec|UploadSkillDialog spec]]
- [[_COMMUNITY_SkillDetail|SkillDetail]]
- [[_COMMUNITY_deletePrompt|deletePrompt]]
- [[_COMMUNITY_prompts test|prompts test]]
- [[_COMMUNITY_importConversations|importConversations]]
- [[_COMMUNITY_AdminSettings|AdminSettings]]
- [[_COMMUNITY_index|index]]
- [[_COMMUNITY_skillDeps|skillDeps]]
- [[_COMMUNITY_importers spec|importers spec]]
- [[_COMMUNITY_Action|Action]]
- [[_COMMUNITY_SkillSelectDialog|SkillSelectDialog]]
- [[_COMMUNITY_skillFiles|skillFiles]]
- [[_COMMUNITY_prompt spec|prompt spec]]
- [[_COMMUNITY_ImportBatchBuilder|ImportBatchBuilder]]
- [[_COMMUNITY_FilterSkills|FilterSkills]]
- [[_COMMUNITY_memory|memory]]
- [[_COMMUNITY_MemoryArtifacts|MemoryArtifacts]]
- [[_COMMUNITY_CategoryAdminModal|CategoryAdminModal]]
- [[_COMMUNITY_PromptVariables|PromptVariables]]
- [[_COMMUNITY_CreateSkillMenu|CreateSkillMenu]]
- [[_COMMUNITY_DeleteSkill|DeleteSkill]]
- [[_COMMUNITY_useUploadSkillFileMutation|useUploadSkillFileMutation]]
- [[_COMMUNITY_projectContext|projectContext]]
- [[_COMMUNITY_createSkill|createSkill]]
- [[_COMMUNITY_getPromptGroups|getPromptGroups]]
- [[_COMMUNITY_SkillState|SkillState]]
- [[_COMMUNITY_PromptGroupsContext|PromptGroupsContext]]
- [[_COMMUNITY_getCustomConfigSpeech|getCustomConfigSpeech]]
- [[_COMMUNITY_createMemory|createMemory]]
- [[_COMMUNITY_skill|skill]]
- [[_COMMUNITY_SkillsCommand|SkillsCommand]]
- [[_COMMUNITY_FileSearch|FileSearch]]
- [[_COMMUNITY_Instructions|Instructions]]
- [[_COMMUNITY_ProjectPromptSnippets|ProjectPromptSnippets]]
- [[_COMMUNITY_adminConfigActive|adminConfigActive]]
- [[_COMMUNITY_keys|keys]]
- [[_COMMUNITY_skill|skill]]
- [[_COMMUNITY_prompts|prompts]]
- [[_COMMUNITY_PromptsCommand|PromptsCommand]]
- [[_COMMUNITY_SkillPills|SkillPills]]
- [[_COMMUNITY_ProjectMemoryEditor|ProjectMemoryEditor]]
- [[_COMMUNITY_prompts|prompts]]
- [[_COMMUNITY_memory|memory]]
- [[_COMMUNITY_addTagToConversation|addTagToConversation]]
- [[_COMMUNITY_adminFunctionById|adminFunctionById]]
- [[_COMMUNITY_adminGroupById|adminGroupById]]
- [[_COMMUNITY_adminTenants|adminTenants]]
- [[_COMMUNITY_agents|agents]]
- [[_COMMUNITY_assistants|assistants]]
- [[_COMMUNITY_deleteCategory|deleteCategory]]
- [[_COMMUNITY_memories|memories]]
- [[_COMMUNITY_BedrockProviders|BedrockProviders]]
- [[_COMMUNITY_adminSecretByName|adminSecretByName]]
- [[_COMMUNITY_adminUsers|adminUsers]]
- [[_COMMUNITY_memory|memory]]
- [[_COMMUNITY_prompt|prompt]]
- [[_COMMUNITY_promptGroup|promptGroup]]
- [[_COMMUNITY_skillFile|skillFile]]
- [[_COMMUNITY_useGetSkillByIdQuery|useGetSkillByIdQuery]]
- [[_COMMUNITY_deletePromptGroup|deletePromptGroup]]
- [[_COMMUNITY_postCategory|postCategory]]
- [[_COMMUNITY_postPrompt|postPrompt]]
- [[_COMMUNITY_updatePromptGroup|updatePromptGroup]]

## God Nodes (most connected - your core abstractions)
1. `AgentClient` - 22 edges
2. `getRole()` - 14 edges
3. `projectMetaAds()` - 13 edges
4. `ImportBatchBuilder` - 10 edges
5. `handleZip()` - 10 edges
6. `PromptVariableGfm()` - 9 edges
7. `prompts()` - 9 edges
8. `resolveImportDefaultModel()` - 8 edges
9. `cloneMessagesWithTimestamps()` - 8 edges
10. `forkConversationFromSource()` - 8 edges

## Surprising Connections (you probably didn't know these)
- `MemoryInfo()` --indirect_call--> `messages()`  [INFERRED]
  client/src/components/Chat/Messages/Content/MemoryInfo.tsx → packages/data-provider/src/api-endpoints.ts
- `useUploadSkillFileMutation()` --indirect_call--> `skillFile()`  [INFERRED]
  client/src/data-provider/Skills/mutations.ts → packages/data-provider/src/api-endpoints.ts
- `useUpdateSkillStatesMutation()` --indirect_call--> `skillStates()`  [INFERRED]
  client/src/data-provider/Skills/queries.ts → packages/data-provider/src/api-endpoints.ts
- `PromptTextCard()` --indirect_call--> `PromptVariableGfm()`  [INFERRED]
  client/src/components/Prompts/display/PromptTextCard.tsx → client/src/components/Prompts/editor/Markdown.tsx
- `PromptEditor()` --indirect_call--> `PromptVariableGfm()`  [INFERRED]
  client/src/components/Prompts/editor/PromptEditor.tsx → client/src/components/Prompts/editor/Markdown.tsx

## Import Cycles
- None detected.

## Communities (112 total, 24 thin omitted)

### Community 1 - "schemas"
Cohesion: 0.02
Nodes (97): AgentProvider, agentsBaseSchema, agentsSchema, agentsSettings, ANTHROPIC_MAX_OUTPUT, anthropicBaseSchema, AnthropicEffort, anthropicSchema (+89 more)

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

### Community 4 - "permissions"
Cohesion: 0.05
Nodes (40): agentPermissionsSchema, bookmarkPermissionsSchema, fileCitationsPermissionsSchema, fileSearchPermissionsSchema, INTERFACE_PERMISSION_FIELDS, marketplacePermissionsSchema, mcpServersPermissionsSchema, memoryPermissionsSchema (+32 more)

### Community 5 - "skill"
Cohesion: 0.07
Nodes (34): ALLOWED_FRONTMATTER_KEYS, backfillDerivedFromFrontmatter(), BodyAlwaysApplyResult, CreateSkillInput, CreateSkillResult, deriveStructuredFrontmatterFields(), extractAlwaysApplyFromBody(), FRONTMATTER_KIND (+26 more)

### Community 6 - "components"
Cohesion: 0.07
Nodes (20): components, essentialComponents, extraComponents, moreExtraComponents, ShadcnComponent, generateShadcnPrompt(), artifactsOpenAIPrompt, artifactsPrompt (+12 more)

### Community 7 - "fork"
Cohesion: 0.10
Nodes (31): BaseClient, cloneMessagesWithTimestamps(), { createImportBatchBuilder }, duplicateConversation(), { EModelEndpoint, Constants, ForkOptions }, escapeRegExp(), forkConversation(), forkConversationFromSource() (+23 more)

### Community 8 - "skills"
Cohesion: 0.07
Nodes (25): BuildSkillPrimeContentPartsParams, InjectManualSkillPrimesParams, InjectManualSkillPrimesResult, injectSkillCatalog(), InjectSkillCatalogParams, InjectSkillCatalogResult, InjectSkillPrimesParams, InjectSkillPrimesResult (+17 more)

### Community 9 - "AdminSettings"
Cohesion: 0.10
Nodes (17): AdminSettings(), permissions, formatDate(), MemoryCard(), MemoryCardProps, MemoryCardActionsProps, MemoryCreateDialog(), MemoryCreateDialogProps (+9 more)

### Community 10 - "binary"
Cohesion: 0.10
Nodes (19): isBinaryBuffer(), DuplicateKeyError, serializeFrontmatter(), serializeSkill(), serializeSkillSummary(), serializeSourceMetadata(), SkillsHandlers, SkillsHandlersDeps (+11 more)

### Community 11 - "skills"
Cohesion: 0.08
Nodes (28): ALLOWED_EXTENSIONS, checkSkillAccess, checkSkillCreate, configMiddleware, { createFileLimiters }, {
  createSkill,
  getSkillById,
  listSkillsByAccess,
  updateSkill,
  deleteSkill,
  listSkillFiles,
  upsertSkillFile,
  deleteSkillFile,
  getSkillFileByPath,
  updateSkillFileContent,
  getRoleByName,
}, {
  createSkillsHandlers,
  createImportHandler,
  generateCheckAccess,
  getStorageMetadata,
  resolveRequestTenantId,
  restoreTenantContextFromReq,
}, crypto (+20 more)

### Community 12 - "index"
Cohesion: 0.09
Nodes (10): addSkillToCachedLists(), isInfiniteSkillData(), removeSkillFromCachedLists(), replaceSkillInCachedLists(), useCreateSkillMutation(), useDeleteSkillMutation(), useImportSkillMutation(), useUpdateSkillMutation() (+2 more)

### Community 13 - "CategorySelector"
Cohesion: 0.10
Nodes (16): CategorySelectorProps, CreateSkillFormProps, CreateSkillFormValues, DEFAULT_VALUES, invocationDescriptions, invocationLabels, InvocationModePickerProps, modes (+8 more)

### Community 14 - "import"
Cohesion: 0.14
Nodes (21): createImportHandler(), getAuthorInfo(), getImportLimits(), grantOwnership(), guessMimeType(), handleMarkdown(), handleZip(), ImportLimits (+13 more)

### Community 15 - "improve"
Cohesion: 0.12
Nodes (20): cache, CacheEntry, clearPromptImproveCache(), countWords(), escapeXml(), hashText(), ImprovePromptOptions, ImprovePromptRequest (+12 more)

### Community 16 - "prompts"
Cohesion: 0.10
Nodes (17): {
  canAccessPromptGroupResource,
  canAccessPromptViaGroup,
  promptUsageLimiter,
  requireJwtAuth,
}, checkGlobalPromptShare, checkPromptAccess, checkPromptCreate, createNewPromptGroup(), express, {
  findPubliclyAccessibleResources,
  getEffectivePermissions,
  findAccessibleResources,
  grantPermission,
}, {
  generateCheckAccess,
  markPublicPromptGroups,
  buildPromptGroupFilter,
  formatPromptGroupsResponse,
  safeValidatePromptGroupUpdate,
  createEmptyPromptGroupsResponse,
  filterAccessibleIdsBySharedLogic,
} (+9 more)

### Community 17 - "PromptTextCard"
Cohesion: 0.15
Nodes (15): PromptTextCard(), PromptTextCardProps, CodeVariableGfm(), highlightVariables(), processChildren(), PromptVariableGfm(), PromptEditor(), Props (+7 more)

### Community 18 - "index"
Cohesion: 0.12
Nodes (5): SharePrompt, VariableDialog(), VariableDialogProps, PromptActionsProps, PromptDetailsProps

### Community 20 - "context"
Cohesion: 0.14
Nodes (14): { checkPermission }, db, emptyProjectContext(), loadProjectContext(), { loadProjectMemories }, { logger, runAsSystem }, { ResourceType, PermissionBits }, { loadProjectContext } (+6 more)

### Community 21 - "importers"
Cohesion: 0.17
Nodes (15): adjustTimestampsForOrdering(), breakParentCycles(), { cloneMessagesWithTimestamps }, { createImportBatchBuilder }, { EModelEndpoint, Constants, openAISettings }, extractClaudeContent(), formatMessageText(), { getEndpointsConfig } (+7 more)

### Community 22 - "DeletePrompt"
Cohesion: 0.14
Nodes (8): DeletePrompt, DeletePromptProps, HeaderActions, HeaderActionsProps, TODO: show toast, cannot be empty., VersionsPanel, VersionsPanelProps, SkeletonForm()

### Community 23 - "CategorySelector"
Cohesion: 0.14
Nodes (5): CategorySelectorProps, Props, SaveStatus, CreateFormValues, defaultPrompt

### Community 24 - "index"
Cohesion: 0.16
Nodes (10): SkillListProps, buildFileTree(), countVisible(), FileNodeData, getNodeData(), InlineFileTree(), NodeMeta, SkillListItemProps (+2 more)

### Community 25 - "memory"
Cohesion: 0.18
Nodes (13): BasicToolEndHandler, createDeleteMemoryTool(), createMemoryCallback(), createMemoryProcessor(), createMemoryTool(), getDefaultInstructions(), handleMemoryArtifact(), MemoryConfig (+5 more)

### Community 26 - "PromptDetailHeader"
Cohesion: 0.18
Nodes (7): PromptDetailHeaderProps, categoryColorMap, CategoryIcon(), categoryIconMap, getSpecialVariableIcon(), specialVariableIcons, SpecialVariableKey

### Community 27 - "memory"
Cohesion: 0.17
Nodes (11): collectSnapshot(), ConnectionStats, getJobStats(), getMCPStats(), memoryDiagnostics, MemorySnapshot, RuntimeStats, snapshots (+3 more)

### Community 28 - "Action"
Cohesion: 0.15
Nodes (4): defaultProps, DropdownOption, InputConfig, InputSectionProps

### Community 29 - "getRole"
Cohesion: 0.14
Nodes (14): getRole(), roles(), updateAgentPermissions(), updateFileCitationsPermissions(), updateFileSearchPermissions(), updateMarketplacePermissions(), updateMCPServersPermissions(), updateMemoryPermissions() (+6 more)

### Community 30 - "memories"
Cohesion: 0.15
Nodes (12): checkMemoryCreate, checkMemoryDelete, checkMemoryOptOut, checkMemoryRead, checkMemoryUpdate, express, {
  getAllUserMemories,
  toggleUserMemories,
  getRoleByName,
  createMemory,
  deleteMemory,
  setMemory,
}, memoryPayloadLimit (+4 more)

### Community 31 - "SkillFileViewer"
Cohesion: 0.29
Nodes (9): SKILL_MD_SKIP_KEYS, SkillFileViewer(), SkillFileViewerProps, FrontmatterField, ParsedFrontmatter, parseFrontmatter(), ParsedSkillMd, parseSkillMd() (+1 more)

### Community 32 - "projectById"
Cohesion: 0.15
Nodes (13): projectById(), projectMetaAds(), projectMetaAdsApply(), projectMetaAdsBudget(), projectMetaAdsDuplicate(), projectMetaAdsEntityStatus(), projectMetaAdsPerformance(), projectMetaAdsRankings() (+5 more)

### Community 33 - "defaults"
Cohesion: 0.23
Nodes (10): { EModelEndpoint, openAISettings, anthropicSettings }, FALLBACK_MODEL_BY_ENDPOINT, { getModelsConfig }, { logger, getTenantId }, pickFirstConfiguredModel(), resolveImportDefaultModel(), { EModelEndpoint, openAISettings, anthropicSettings }, mockGetModelsConfig (+2 more)

### Community 34 - "importBatchBuilder"
Cohesion: 0.17
Nodes (10): { bulkIncrementTagCounts, bulkSaveConvos, bulkSaveMessages }, { EModelEndpoint, Constants, openAISettings }, { FALLBACK_MODEL_BY_ENDPOINT }, { logger }, { v4: uuidv4 }, { Constants }, { getImporter }, { ImportBatchBuilder } (+2 more)

### Community 35 - "index"
Cohesion: 0.17
Nodes (5): CreateMemoryParams, CreateMemoryResponse, UpdateMemoryParams, UpdateMemoryPreferencesParams, UpdateMemoryPreferencesResponse

### Community 36 - "promptImprove"
Cohesion: 0.18
Nodes (8): express, { improvePromptText, PromptImproveError }, { requireJwtAuth }, router, express, mockImprovePromptText, MockPromptImproveError, request

### Community 38 - "UploadSkillDialog spec"
Cohesion: 0.20
Nodes (8): mockFileConfigInput, mockMutate, mockNavigate, mockSetIsOpen, mockShowToast, formatMegabytes(), UploadSkillDialog(), UploadSkillDialogProps

### Community 39 - "SkillDetail"
Cohesion: 0.18
Nodes (7): SkillDetail(), SkillDetailProps, SKIP_KEYS, MARKDOWN_COMPONENTS, REHYPE_PLUGINS, REMARK_PLUGINS, SkillMarkdownRendererProps

### Community 41 - "deletePrompt"
Cohesion: 0.18
Nodes (11): deletePrompt(), getAllPromptGroups(), getPrompt(), getPromptGroup(), getPromptGroupsWithFilters(), getPromptsWithFilters(), getRandomPrompts(), prompts() (+3 more)

### Community 42 - "prompts test"
Cohesion: 0.20
Nodes (7): express, { MongoMemoryServer }, mongoose, { ObjectId }, request, { SystemCapabilities }, {
  SystemRoles,
  ResourceType,
  AccessRoleIds,
  PrincipalType,
  PermissionBits,
}

### Community 43 - "importConversations"
Cohesion: 0.22
Nodes (8): { getImporter }, importConversations(), { logger }, maxFileSize, { resolveImportMaxFileSize }, getImporter(), importConversations, importers

### Community 44 - "AdminSettings"
Cohesion: 0.20
Nodes (3): permissions, ShareSkillProps, SkillToggleProps

### Community 45 - "index"
Cohesion: 0.20
Nodes (3): SkillFileEditorProps, SkillFilePreviewProps, TreeToolbarProps

### Community 46 - "skillDeps"
Cohesion: 0.22
Nodes (6): { batchUploadCodeEnvFiles }, db, { enrichWithSkillConfigurable }, {
  getSessionInfo,
  checkIfActive,
  readSandboxFile,
}, { getStrategyFunctions }, skillToolDeps

### Community 47 - "importers spec"
Cohesion: 0.22
Nodes (8): { bulkSaveMessages, bulkSaveConvos: _bulkSaveConvos }, {
  EModelEndpoint,
  Constants,
  openAISettings,
  anthropicSettings,
}, fs, { getImporter, processAssistantMessage }, { ImportBatchBuilder }, mockGetEndpointsConfig, mockGetModelsConfig, path

### Community 49 - "SkillSelectDialog"
Cohesion: 0.22
Nodes (5): LIST_QUERY_OPTIONS, SidebarItemProps, SkillCardProps, SkillCategory, SkillSelectDialogProps

### Community 50 - "skillFiles"
Cohesion: 0.28
Nodes (8): primeInvokedSkills(), PrimeInvokedSkillsDeps, PrimeInvokedSkillsResult, primeSkillFiles(), PrimeSkillFilesParams, PrimeSkillFilesResult, SkillFileRecord, files()

### Community 51 - "prompt spec"
Cohesion: 0.22
Nodes (5): LeanAccessRole, LeanAclEntry, LeanGroup, LeanPromptGroup, LeanUser

### Community 54 - "memory"
Cohesion: 0.25
Nodes (7): DeleteMemoryParams, FormattedMemoriesResult, GetFormattedMemoriesParams, IMemoryEntry, IMemoryEntryLean, MemoryResult, SetMemoryParams

### Community 55 - "MemoryArtifacts"
Cohesion: 0.29
Nodes (4): MemoryInfo(), buildQuery(), conversations(), messages()

### Community 56 - "CategoryAdminModal"
Cohesion: 0.29
Nodes (4): CategoryAdminModalProps, mockCreate, mockDelete, mockUpdate

### Community 57 - "PromptVariables"
Cohesion: 0.33
Nodes (3): ParsedVariable, parseVariable(), PromptVariables()

### Community 58 - "CreateSkillMenu"
Cohesion: 0.29
Nodes (3): CreateSkillMenu(), CreateSkillDialogProps, FormValues

### Community 59 - "DeleteSkill"
Cohesion: 0.29
Nodes (3): DeleteSkillProps, invocationLabelMap, SkillDetailHeaderProps

### Community 61 - "useUploadSkillFileMutation"
Cohesion: 0.29
Nodes (7): useUploadSkillFileMutation(), getSkill(), importSkill(), listSkillsWithFilters(), skillFile(), skillFiles(), skills()

### Community 63 - "projectContext"
Cohesion: 0.43
Nodes (5): IProjectMemory, loadProjectFileIds(), loadProjectInstructions(), loadProjectMemories(), UserMemoryEntry

### Community 64 - "createSkill"
Cohesion: 0.33
Nodes (7): createSkill(), deleteSkill(), deleteSkillFile(), getSkill(), listSkillFiles(), updateSkill(), createSkillMethods()

### Community 65 - "getPromptGroups"
Cohesion: 0.29
Nodes (6): getPromptGroups(), getPrompts(), makePromptProduction(), createPromptMethods(), PromptDeps, PromptMethods

### Community 66 - "SkillState"
Cohesion: 0.33
Nodes (4): icons, SkillStateProps, SkillStateVariant, styles

### Community 67 - "PromptGroupsContext"
Cohesion: 0.33
Nodes (3): AllPromptGroupsData, PromptGroupsContext, PromptGroupsContextType

### Community 68 - "getCustomConfigSpeech"
Cohesion: 0.33
Nodes (6): getCustomConfigSpeech(), speech(), speechToText(), textToSpeech(), textToSpeechManual(), textToSpeechVoices()

### Community 69 - "createMemory"
Cohesion: 0.33
Nodes (4): createMemory(), deleteMemory(), createMemoryMethods(), MemoryMethods

### Community 70 - "skill"
Cohesion: 0.47
Nodes (5): ISkill, ISkillDocument, ISkillFile, ISkillFileDocument, ISkillSummary

### Community 71 - "SkillsCommand"
Cohesion: 0.60
Nodes (4): filterSkillsForPopover(), isUserInvocable(), SkillsCommand, SkillsCommandContent()

### Community 73 - "Instructions"
Cohesion: 0.40
Nodes (3): inputClass, VariableOption, variableOptions

### Community 74 - "ProjectPromptSnippets"
Cohesion: 0.50
Nodes (3): ProjectPromptSnippets, ProjectPromptSnippetsProps, PromptSnippet

### Community 75 - "adminConfigActive"
Cohesion: 0.50
Nodes (4): adminConfigActive(), adminConfigBase(), adminConfigByPrincipal(), adminConfigs()

### Community 76 - "keys"
Cohesion: 0.50
Nodes (3): DynamicQueryKeys, MutationKeys, QueryKeys

### Community 77 - "skill"
Cohesion: 0.50
Nodes (3): RESERVED_NAME_PREFIXES, RESERVED_NAME_WORDS, skillSchema

### Community 78 - "prompts"
Cohesion: 0.67
Nodes (3): IPrompt, IPromptGroup, IPromptGroupDocument

### Community 84 - "addTagToConversation"
Cohesion: 0.67
Nodes (3): addTagToConversation(), conversationTags(), conversationTagsList()

### Community 85 - "adminFunctionById"
Cohesion: 0.67
Nodes (3): adminFunctionById(), adminFunctions(), adminFunctionToggle()

### Community 86 - "adminGroupById"
Cohesion: 0.67
Nodes (3): adminGroupById(), adminGroupMembers(), adminGroups()

### Community 87 - "adminTenants"
Cohesion: 0.67
Nodes (3): adminTenants(), adminTenantStats(), adminTenantUsers()

### Community 88 - "agents"
Cohesion: 0.67
Nodes (3): agents(), cloneAgentToTenant(), revertAgentVersion()

### Community 89 - "assistants"
Cohesion: 0.67
Nodes (3): assistants(), avatar(), images()

### Community 90 - "deleteCategory"
Cohesion: 0.67
Nodes (3): deleteCategory(), getCategories(), updateCategory()

### Community 91 - "memories"
Cohesion: 0.67
Nodes (3): memories(), memory(), memoryPreferences()

### Community 92 - "BedrockProviders"
Cohesion: 0.67
Nodes (3): BedrockProviders, getModelKey(), getSettingsKeys()

## Knowledge Gaps
- **527 isolated node(s):** `{ logger }`, `{ getBufferString, HumanMessage }`, `{
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
}` (+522 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **24 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `createSkillMethods()` connect `createSkill` to `skill`?**
  _High betweenness centrality (0.030) - this node is a cross-community bridge._
- **Why does `messages()` connect `MemoryArtifacts` to `memory`, `api endpoints`, `client`?**
  _High betweenness centrality (0.021) - this node is a cross-community bridge._
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
  _532 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `data service` be split into smaller, more focused modules?**
  _Cohesion score 0.008583690987124463 - nodes in this community are weakly interconnected._
- **Should `schemas` be split into smaller, more focused modules?**
  _Cohesion score 0.01904761904761905 - nodes in this community are weakly interconnected._
- **Should `api endpoints` be split into smaller, more focused modules?**
  _Cohesion score 0.021052631578947368 - nodes in this community are weakly interconnected._
- **Should `client` be split into smaller, more focused modules?**
  _Cohesion score 0.05507246376811594 - nodes in this community are weakly interconnected._