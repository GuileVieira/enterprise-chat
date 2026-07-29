# Graph Report - .  (2026-07-07)

## Corpus Check
- 176 files · ~104,113 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1539 nodes · 1765 edges · 122 communities (85 shown, 37 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 42 edges (avg confidence: 0.53)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_data service|data service]]
- [[_COMMUNITY_config|config]]
- [[_COMMUNITY_api endpoints|api endpoints]]
- [[_COMMUNITY_avatar|avatar]]
- [[_COMMUNITY_index|index]]
- [[_COMMUNITY_index|index]]
- [[_COMMUNITY_permissions|permissions]]
- [[_COMMUNITY_index|index]]
- [[_COMMUNITY_index|index]]
- [[_COMMUNITY_index|index]]
- [[_COMMUNITY_Citation|Citation]]
- [[_COMMUNITY_DuckDuckGoSearch|DuckDuckGoSearch]]
- [[_COMMUNITY_Sources|Sources]]
- [[_COMMUNITY_file config|file config]]
- [[_COMMUNITY_convo|convo]]
- [[_COMMUNITY_files|files]]
- [[_COMMUNITY_fileSearch|fileSearch]]
- [[_COMMUNITY_crud|crud]]
- [[_COMMUNITY_TavilySearchResults spec|TavilySearchResults spec]]
- [[_COMMUNITY_Action|Action]]
- [[_COMMUNITY_crud test|crud test]]
- [[_COMMUNITY_getRole|getRole]]
- [[_COMMUNITY_FileList|FileList]]
- [[_COMMUNITY_projectById|projectById]]
- [[_COMMUNITY_project|project]]
- [[_COMMUNITY_meiliLogger|meiliLogger]]
- [[_COMMUNITY_index|index]]
- [[_COMMUNITY_GoogleSearch|GoogleSearch]]
- [[_COMMUNITY_TraversaalSearch|TraversaalSearch]]
- [[_COMMUNITY_crud|crud]]
- [[_COMMUNITY_crud|crud]]
- [[_COMMUNITY_SearchResults|SearchResults]]
- [[_COMMUNITY_WebSearch test|WebSearch test]]
- [[_COMMUNITY_FileDashboardView|FileDashboardView]]
- [[_COMMUNITY_deletePrompt|deletePrompt]]
- [[_COMMUNITY_convertStringsToRegex|convertStringsToRegex]]
- [[_COMMUNITY_project|project]]
- [[_COMMUNITY_AzureAISearch|AzureAISearch]]
- [[_COMMUNITY_DeleteIconButton|DeleteIconButton]]
- [[_COMMUNITY_FileSearch|FileSearch]]
- [[_COMMUNITY_DragDropContext|DragDropContext]]
- [[_COMMUNITY_assistants|assistants]]
- [[_COMMUNITY_index|index]]
- [[_COMMUNITY_PeoplePickerSearchItem|PeoplePickerSearchItem]]
- [[_COMMUNITY_SourceHovercard|SourceHovercard]]
- [[_COMMUNITY_SearchContent|SearchContent]]
- [[_COMMUNITY_DataTableFile|DataTableFile]]
- [[_COMMUNITY_FilePreview|FilePreview]]
- [[_COMMUNITY_images|images]]
- [[_COMMUNITY_meiliLogger|meiliLogger]]
- [[_COMMUNITY_mongoMeili spec|mongoMeili spec]]
- [[_COMMUNITY_rag|rag]]
- [[_COMMUNITY_TavilySearch|TavilySearch]]
- [[_COMMUNITY_deleteUserResourceCoverage spec|deleteUserResourceCoverage spec]]
- [[_COMMUNITY_FilesListView|FilesListView]]
- [[_COMMUNITY_createChatSearchParams|createChatSearchParams]]
- [[_COMMUNITY_reset meili sync|reset meili sync]]
- [[_COMMUNITY_getSkill|getSkill]]
- [[_COMMUNITY_DataTableFilePreview|DataTableFilePreview]]
- [[_COMMUNITY_validation test|validation test]]
- [[_COMMUNITY_fileSearch test|fileSearch test]]
- [[_COMMUNITY_SearchBar|SearchBar]]
- [[_COMMUNITY_DragDropModal|DragDropModal]]
- [[_COMMUNITY_useSearchResultsByTurn|useSearchResultsByTurn]]
- [[_COMMUNITY_web|web]]
- [[_COMMUNITY_adminConfigActive|adminConfigActive]]
- [[_COMMUNITY_DragDropOverlay|DragDropOverlay]]
- [[_COMMUNITY_DragDropWrapper|DragDropWrapper]]
- [[_COMMUNITY_ActionButton|ActionButton]]
- [[_COMMUNITY_SearchBar|SearchBar]]
- [[_COMMUNITY_useAuthSearchTool|useAuthSearchTool]]
- [[_COMMUNITY_SearchContext|SearchContext]]
- [[_COMMUNITY_search|search]]
- [[_COMMUNITY_crud test|crud test]]
- [[_COMMUNITY_s3 integration spec|s3 integration spec]]
- [[_COMMUNITY_DataTableSearch|DataTableSearch]]
- [[_COMMUNITY_addTagToConversation|addTagToConversation]]
- [[_COMMUNITY_adminFunctionById|adminFunctionById]]
- [[_COMMUNITY_adminGroupById|adminGroupById]]
- [[_COMMUNITY_adminTenants|adminTenants]]
- [[_COMMUNITY_agents|agents]]
- [[_COMMUNITY_buildQuery|buildQuery]]
- [[_COMMUNITY_deleteCategory|deleteCategory]]
- [[_COMMUNITY_memories|memories]]
- [[_COMMUNITY_deleteSkill|deleteSkill]]
- [[_COMMUNITY_adminSecretByName|adminSecretByName]]
- [[_COMMUNITY_adminUsers|adminUsers]]
- [[_COMMUNITY_getConfigDefaults|getConfigDefaults]]
- [[_COMMUNITY_getEndpointField|getEndpointField]]
- [[_COMMUNITY_isPrivateIPv4Literal|isPrivateIPv4Literal]]
- [[_COMMUNITY_isRemoteOidcUrlAllowed|isRemoteOidcUrlAllowed]]
- [[_COMMUNITY_normalizePort|normalizePort]]
- [[_COMMUNITY_getEndpointFileConfig|getEndpointFileConfig]]
- [[_COMMUNITY_convo|convo]]
- [[_COMMUNITY_file|file]]
- [[_COMMUNITY_message|message]]
- [[_COMMUNITY_convo|convo]]
- [[_COMMUNITY_file|file]]
- [[_COMMUNITY_message|message]]
- [[_COMMUNITY_deletePromptGroup|deletePromptGroup]]
- [[_COMMUNITY_postCategory|postCategory]]
- [[_COMMUNITY_postPrompt|postPrompt]]
- [[_COMMUNITY_updatePromptGroup|updatePromptGroup]]

## God Nodes (most connected - your core abstractions)
1. `getRole()` - 14 edges
2. `projectMetaAds()` - 13 edges
3. `startServer()` - 11 edges
4. `getS3Key()` - 9 edges
5. `prompts()` - 9 edges
6. `getStorageMetadataForKey()` - 8 edges
7. `extractKeyFromS3Url()` - 8 edges
8. `mongoMeili()` - 8 edges
9. `batchResetMeiliFlags()` - 7 edges
10. `getCloudFrontURL()` - 7 edges

## Surprising Connections (you probably didn't know these)
- `processTree()` --indirect_call--> `cleanText()`  [INFERRED]
  client/src/components/Web/plugin.ts → api/app/clients/tools/structured/DuckDuckGoSearch.js
- `useGetProjectFiles()` --references--> `DynamicQueryKeys`  [EXTRACTED]
  client/src/data-provider/Files/queries.ts → packages/data-provider/src/keys.ts
- `useGetAgentFiles()` --references--> `DynamicQueryKeys`  [EXTRACTED]
  client/src/data-provider/Files/queries.ts → packages/data-provider/src/keys.ts
- `createConversationModel()` --indirect_call--> `mongoMeili()`  [INFERRED]
  packages/data-schemas/src/models/convo.ts → packages/data-schemas/src/models/plugins/mongoMeili.ts
- `createMessageModel()` --indirect_call--> `mongoMeili()`  [INFERRED]
  packages/data-schemas/src/models/message.ts → packages/data-schemas/src/models/plugins/mongoMeili.ts

## Import Cycles
- None detected.

## Communities (122 total, 37 thin omitted)

### Community 1 - "config"
Cohesion: 0.01
Nodes (146): addParamsSchema, AgentCapabilities, agentsEndpointSchema, allowedAddressEntrySchema, allowedAddressesSchema, alternateName, anthropicEndpointSchema, assistantEndpointSchema (+138 more)

### Community 3 - "avatar"
Cohesion: 0.06
Nodes (53): AvatarConfig, sharedAvatarBasePathStrategies, getStorageMetadata(), StorageMetadataInput, deleteFileFromS3(), extractKeyFromS3Url(), getDefaultStorageRegion(), getInlinePathPrefix() (+45 more)

### Community 4 - "index"
Cohesion: 0.06
Nodes (45): { hasAccessToFilesViaAgent, filterFilesByAgentAccess }, { processCodeFile }, { processFileUpload }, { uploadImageBuffer }, { addResourceFileId, deleteResourceFileId }, base64ToBuffer(), { checkCapability }, {
  convertImage,
  resizeAndConvert,
  resizeImageBuffer,
} (+37 more)

### Community 5 - "index"
Cohesion: 0.04
Nodes (46): accessPermissions, actions, adminAuth, adminConfig, adminFunctions, adminGrants, adminGroups, adminOverview (+38 more)

### Community 6 - "permissions"
Cohesion: 0.05
Nodes (40): agentPermissionsSchema, bookmarkPermissionsSchema, fileCitationsPermissionsSchema, fileSearchPermissionsSchema, INTERFACE_PERMISSION_FIELDS, marketplacePermissionsSchema, mcpServersPermissionsSchema, memoryPermissionsSchema (+32 more)

### Community 7 - "index"
Cohesion: 0.07
Nodes (33): app, axios, { capabilityContextMiddleware }, { checkMigrations }, compression, configureSocialLogins, { connectDb, indexSync }, cookieParser (+25 more)

### Community 8 - "index"
Cohesion: 0.08
Nodes (21): consecutivePreviewErrors, fetchFilePreview(), FileDownloadOptions, isDirectDownloadSource(), previewRefetchInterval(), _resetPreviewErrorCounter(), revokeDownloadURL(), useFileDownload() (+13 more)

### Community 9 - "index"
Cohesion: 0.09
Nodes (26): { connectDb }, { createModels }, indexSync, mongoose, { batchResetMeiliFlags }, { CacheKeys }, deleteDocumentsWithoutUserField(), ensureFilterableAttributes() (+18 more)

### Community 10 - "Citation"
Cohesion: 0.10
Nodes (24): Citation(), CitationComponentProps, CompositeCitation(), CompositeCitationProps, FileCitationMetadata, FileCitationSource, getFileCitationData(), HighlightedText (+16 more)

### Community 11 - "DuckDuckGoSearch"
Cohesion: 0.11
Nodes (21): assertPublicHttpUrl(), clampInteger(), cleanText(), { DuckDuckGoSearch }, duckDuckGoSearchJsonSchema, DuckDuckGoSearchTool, extractText(), { fetch: undiciFetch } (+13 more)

### Community 12 - "Sources"
Cohesion: 0.09
Nodes (10): AgentFileSource, FileItem, FileItemProps, FilesGroupProps, SourceItemProps, SourcesGroup, SourcesProps, Props (+2 more)

### Community 13 - "file config"
Cohesion: 0.08
Nodes (22): assistantsFileConfig, BedrockDocumentFormat, bedrockDocumentFormats, codeInterpreterMimeTypes, codeInterpreterMimeTypesList, codeTypeMapping, defaultSizeLimit, defaultSkillImportSizeLimit (+14 more)

### Community 14 - "convo"
Cohesion: 0.11
Nodes (13): createConversationModel(), createMessageModel(), createMeiliMongooseModel(), DocumentWithMeiliIndex, getSyncConfig(), MeiliIndexable, mongoMeili(), MongoMeiliOptions (+5 more)

### Community 15 - "files"
Cohesion: 0.09
Nodes (20): AvatarUploadResponse, BatchFile, DeleteFilesBody, DeleteFilesResponse, DeleteMutationOptions, EndpointFileConfig, FileConfigInput, FileContext (+12 more)

### Community 16 - "fileSearch"
Cohesion: 0.13
Nodes (13): axios, fileSearchJsonSchema, { filterFilesByAgentAccess }, { generateShortLivedToken }, { getFiles }, { logger }, primeFiles(), { EToolResources, Tools } (+5 more)

### Community 17 - "crud"
Cohesion: 0.25
Nodes (14): appendDownloadOverrides(), buildCloudFrontUrl(), CloudFrontURLParams, deleteFileFromCloudFront(), getCloudFrontDownloadURL(), getCloudFrontURL(), getOrCreateCloudFrontClient(), getRegionPathOptions() (+6 more)

### Community 18 - "TavilySearchResults spec"
Cohesion: 0.15
Nodes (7): { fetch, ProxyAgent }, TavilySearchResults, { getEnvironmentVariable }, { ProxyAgent, fetch }, tavilySearchJsonSchema, TavilySearchResults, { Tool }

### Community 19 - "Action"
Cohesion: 0.15
Nodes (4): defaultProps, DropdownOption, InputConfig, InputSectionProps

### Community 20 - "crud test"
Cohesion: 0.14
Nodes (12): mockCloudFrontSend, mockDeleteFileFromS3, mockExtractKeyFromS3Url, mockGetCloudFrontConfig, mockGetS3FileStream, mockGetS3Key, mockGetSignedUrl, mockLogger (+4 more)

### Community 21 - "getRole"
Cohesion: 0.14
Nodes (14): getRole(), roles(), updateAgentPermissions(), updateFileCitationsPermissions(), updateFileSearchPermissions(), updateMarketplacePermissions(), updateMCPServersPermissions(), updateMemoryPermissions() (+6 more)

### Community 22 - "FileList"
Cohesion: 0.18
Nodes (7): FileList(), FileListProps, FileListItem2(), FileListItemProps, FileListItemProps, attachedVectorStores, fakeFiles

### Community 23 - "projectById"
Cohesion: 0.15
Nodes (13): projectById(), projectMetaAds(), projectMetaAdsApply(), projectMetaAdsBudget(), projectMetaAdsDuplicate(), projectMetaAdsEntityStatus(), projectMetaAdsPerformance(), projectMetaAdsRankings() (+5 more)

### Community 24 - "project"
Cohesion: 0.15
Nodes (12): ProjectMemorySchema, ProjectMetaAdsClientGoalSchema, ProjectMetaAdsCreativeRulesSchema, ProjectMetaAdsMonthlyBudgetSchema, ProjectMetaAdsRuleAuditSchema, ProjectMetaAdsRuleAuditUserSchema, ProjectMetaAdsRuleGroupSchema, ProjectMetaAdsRuleOverrideSchema (+4 more)

### Community 25 - "meiliLogger"
Cohesion: 0.17
Nodes (9): consoleFormat, fileFormat, fs, levels, logDir, logger, path, transports (+1 more)

### Community 26 - "index"
Cohesion: 0.20
Nodes (7): extractWebSearchEnvVars(), loadWebSearchAuth(), mockIsSSRFTarget, mockResolveHostnameSSRF, USER_PROVIDED_OPT_IN_URL_KEYS, USER_PROVIDED_URL_KEYS, WebSearchAuthResult

### Community 27 - "GoogleSearch"
Cohesion: 0.18
Nodes (5): { getEnvironmentVariable }, googleSearchJsonSchema, GoogleSearchResults, { Tool }, GoogleSearch

### Community 28 - "TraversaalSearch"
Cohesion: 0.20
Nodes (5): { getEnvironmentVariable }, { logger }, { Tool }, TraversaalSearch, traversaalSearchJsonSchema

### Community 29 - "crud"
Cohesion: 0.18
Nodes (7): axios, { FileSources }, FormData, fs, { logAxiosError, generateShortLivedToken }, { logger }, crud

### Community 30 - "crud"
Cohesion: 0.18
Nodes (7): axios, { FileSources }, FormData, fs, { logAxiosError, generateShortLivedToken }, { logger }, crud

### Community 31 - "SearchResults"
Cohesion: 0.20
Nodes (7): SearchResults(), SearchResultsProps, anthropicEndpoint, mockHandleSelectEndpoint, mockHandleSelectModel, mockHandleSelectSpec, noModelsEndpoint

### Community 32 - "WebSearch test"
Cohesion: 0.22
Nodes (5): collectSources(), getUniqueDomainSources(), ProgressKeys, SourceFaviconStack(), WebSearch()

### Community 33 - "FileDashboardView"
Cohesion: 0.24
Nodes (6): VectorStoreList(), VectorStoreListProps, VectorStoreListItem(), VectorStoreListItemProps, fakeVectorStores, VectorStoreSidePanel()

### Community 34 - "deletePrompt"
Cohesion: 0.18
Nodes (11): deletePrompt(), getAllPromptGroups(), getPrompt(), getPromptGroup(), getPromptGroupsWithFilters(), getPromptsWithFilters(), getRandomPrompts(), prompts() (+3 more)

### Community 35 - "convertStringsToRegex"
Cohesion: 0.20
Nodes (10): convertStringsToRegex(), defaultOCRMimeTypes, documentParserMimeTypes, fileConfig, inferMimeType(), isPermissiveMimeConfig(), mbToBytes(), mergeFileConfig() (+2 more)

### Community 36 - "project"
Cohesion: 0.18
Nodes (10): IProject, IProjectMemory, IProjectMetaAds, IProjectMetaAdsCreativeRules, IProjectMetaAdsMonthlyBudget, IProjectMetaAdsMonthlyBudgets, IProjectMetaAdsRuleAudit, IProjectMetaAdsRuleAuditUser (+2 more)

### Community 37 - "AzureAISearch"
Cohesion: 0.22
Nodes (5): AzureAISearch, azureAISearchJsonSchema, { logger }, { SearchClient, AzureKeyCredential }, { Tool }

### Community 38 - "DeleteIconButton"
Cohesion: 0.22
Nodes (5): DeleteIconButton(), DeleteIconButtonProps, tempAssistants, tempFilesAttached, tempVectorStore

### Community 39 - "FileSearch"
Cohesion: 0.20
Nodes (4): MemoizedFileSearch, mockEndpointsConfig, mockFileConfig, mockUseFileHandlingNoChatContext

### Community 40 - "DragDropContext"
Cohesion: 0.24
Nodes (7): defaultDragDropValue, DragDropContext, DragDropContextValue, DragDropProvider(), useDragDropContext(), mockAgentsMap, mockEndpointsConfig

### Community 41 - "assistants"
Cohesion: 0.20
Nodes (10): assistants(), avatar(), files(), getCustomConfigSpeech(), images(), speech(), speechToText(), textToSpeech() (+2 more)

### Community 42 - "index"
Cohesion: 0.28
Nodes (8): applyCitationLimits(), { checkAccess }, enhanceSourcesWithMetadata(), { getRoleByName, getFiles }, { logger }, { nanoid }, processFileCitations(), {
  Tools,
  Permissions,
  FileSources,
  EModelEndpoint,
  PermissionTypes,
}

### Community 43 - "PeoplePickerSearchItem"
Cohesion: 0.28
Nodes (5): PeoplePickerSearchItem, PeoplePickerSearchItemProps, SearchPicker(), SearchPickerProps, UnifiedPeopleSearchProps

### Community 44 - "SourceHovercard"
Cohesion: 0.28
Nodes (7): FaviconImage(), getCleanDomain(), getFaviconUrl(), hovercardClass, SourceData, SourceHovercard(), SourceHovercardProps

### Community 46 - "DataTableFile"
Cohesion: 0.29
Nodes (5): contextMap, DataTableProps, Style, UploadFileButton(), UploadFileProps

### Community 47 - "FilePreview"
Cohesion: 0.29
Nodes (5): tempFile, tempThreads, tempVectorStoresAttached, VectorStoreButton(), VectorStoreButtonProps

### Community 48 - "images"
Cohesion: 0.36
Nodes (3): ImageService, ImageServiceConfig, ImageServiceDeps

### Community 49 - "meiliLogger"
Cohesion: 0.25
Nodes (6): consoleFormat, fileFormat, levels, logDir, logger, transports

### Community 50 - "mongoMeili spec"
Cohesion: 0.25
Nodes (7): mockAddDocuments, mockAddDocumentsInBatches, mockDeleteDocument, mockDeleteDocuments, mockGetDocument, mockIndex, mockUpdateDocuments

### Community 51 - "rag"
Cohesion: 0.33
Nodes (5): deleteRagFile(), DeleteRagFileParams, mockedAxios, mockedGenerateShortLivedToken, mockedLogger

### Community 52 - "TavilySearch"
Cohesion: 0.33
Nodes (4): { getApiKey }, { ProxyAgent, fetch }, { tool }, { z }

### Community 53 - "deleteUserResourceCoverage spec"
Cohesion: 0.33
Nodes (5): fs, HANDLED_RESOURCE_TYPES, NO_USER_CLEANUP_NEEDED, path, { ResourceType }

### Community 55 - "createChatSearchParams"
Cohesion: 0.47
Nodes (4): allowedParams, createChatSearchParams(), parseQueryValue(), processValidSettings()

### Community 56 - "reset meili sync"
Cohesion: 0.33
Nodes (5): { askQuestion, silentExit }, { batchResetMeiliFlags }, connect, mongoose, path

### Community 57 - "getSkill"
Cohesion: 0.33
Nodes (6): getSkill(), importSkill(), listSkillsWithFilters(), skillFile(), skillFiles(), skills()

### Community 60 - "validation test"
Cohesion: 0.70
Nodes (3): assertPathSegment(), assertS3FileName(), sanitizeContentDispositionFilename()

### Community 61 - "fileSearch test"
Cohesion: 0.50
Nodes (3): axios, { createFileSearchTool }, { generateShortLivedToken }

### Community 67 - "adminConfigActive"
Cohesion: 0.50
Nodes (4): adminConfigActive(), adminConfigBase(), adminConfigByPrincipal(), adminConfigs()

### Community 78 - "addTagToConversation"
Cohesion: 0.67
Nodes (3): addTagToConversation(), conversationTags(), conversationTagsList()

### Community 79 - "adminFunctionById"
Cohesion: 0.67
Nodes (3): adminFunctionById(), adminFunctions(), adminFunctionToggle()

### Community 80 - "adminGroupById"
Cohesion: 0.67
Nodes (3): adminGroupById(), adminGroupMembers(), adminGroups()

### Community 81 - "adminTenants"
Cohesion: 0.67
Nodes (3): adminTenants(), adminTenantStats(), adminTenantUsers()

### Community 82 - "agents"
Cohesion: 0.67
Nodes (3): agents(), cloneAgentToTenant(), revertAgentVersion()

### Community 83 - "buildQuery"
Cohesion: 0.67
Nodes (3): buildQuery(), conversations(), messages()

### Community 84 - "deleteCategory"
Cohesion: 0.67
Nodes (3): deleteCategory(), getCategories(), updateCategory()

### Community 85 - "memories"
Cohesion: 0.67
Nodes (3): memories(), memory(), memoryPreferences()

### Community 86 - "deleteSkill"
Cohesion: 0.67
Nodes (3): deleteSkill(), getSkill(), updateSkill()

## Knowledge Gaps
- **592 isolated node(s):** `{ logger }`, `{ Tool }`, `{ SearchClient, AzureKeyCredential }`, `azureAISearchJsonSchema`, `{ fetch: undiciFetch }` (+587 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **37 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cleanText()` connect `DuckDuckGoSearch` to `Citation`?**
  _High betweenness centrality (0.001) - this node is a cross-community bridge._
- **What connects `{ logger }`, `{ Tool }`, `{ SearchClient, AzureKeyCredential }` to the rest of the system?**
  _595 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `data service` be split into smaller, more focused modules?**
  _Cohesion score 0.008298755186721992 - nodes in this community are weakly interconnected._
- **Should `config` be split into smaller, more focused modules?**
  _Cohesion score 0.013333333333333334 - nodes in this community are weakly interconnected._
- **Should `api endpoints` be split into smaller, more focused modules?**
  _Cohesion score 0.020833333333333332 - nodes in this community are weakly interconnected._
- **Should `avatar` be split into smaller, more focused modules?**
  _Cohesion score 0.05563093622795115 - nodes in this community are weakly interconnected._
- **Should `index` be split into smaller, more focused modules?**
  _Cohesion score 0.0563265306122449 - nodes in this community are weakly interconnected._