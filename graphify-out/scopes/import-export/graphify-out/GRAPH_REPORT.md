# Graph Report - .  (2026-07-07)

## Corpus Check
- 97 files · ~95,832 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 941 nodes · 1257 edges · 58 communities (45 shown, 13 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 27 edges (avg confidence: 0.6)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_data service|data service]]
- [[_COMMUNITY_api endpoints|api endpoints]]
- [[_COMMUNITY_index|index]]
- [[_COMMUNITY_metadata|metadata]]
- [[_COMMUNITY_permissions|permissions]]
- [[_COMMUNITY_cloudfront cookies|cloudfront cookies]]
- [[_COMMUNITY_index|index]]
- [[_COMMUNITY_fork|fork]]
- [[_COMMUNITY_avatar|avatar]]
- [[_COMMUNITY_convos|convos]]
- [[_COMMUNITY_azure|azure]]
- [[_COMMUNITY_import|import]]
- [[_COMMUNITY_importers|importers]]
- [[_COMMUNITY_crud|crud]]
- [[_COMMUNITY_crud test|crud test]]
- [[_COMMUNITY_getRole|getRole]]
- [[_COMMUNITY_projectById|projectById]]
- [[_COMMUNITY_defaults|defaults]]
- [[_COMMUNITY_importBatchBuilder|importBatchBuilder]]
- [[_COMMUNITY_deletePrompt|deletePrompt]]
- [[_COMMUNITY_importConversations|importConversations]]
- [[_COMMUNITY_useAttachmentPreviewSync spec|useAttachmentPreviewSync spec]]
- [[_COMMUNITY_importers spec|importers spec]]
- [[_COMMUNITY_index|index]]
- [[_COMMUNITY_importLimiters|importLimiters]]
- [[_COMMUNITY_uploadLimiters|uploadLimiters]]
- [[_COMMUNITY_ImportBatchBuilder|ImportBatchBuilder]]
- [[_COMMUNITY_migration|migration]]
- [[_COMMUNITY_useFileHandling test|useFileHandling test]]
- [[_COMMUNITY_getCustomConfigSpeech|getCustomConfigSpeech]]
- [[_COMMUNITY_getSkill|getSkill]]
- [[_COMMUNITY_validation test|validation test]]
- [[_COMMUNITY_ExportModal|ExportModal]]
- [[_COMMUNITY_UploadSkillDialog|UploadSkillDialog]]
- [[_COMMUNITY_useExportConversation|useExportConversation]]
- [[_COMMUNITY_adminConfigActive|adminConfigActive]]
- [[_COMMUNITY_ProjectFileUploader|ProjectFileUploader]]
- [[_COMMUNITY_crud test|crud test]]
- [[_COMMUNITY_s3 integration spec|s3 integration spec]]
- [[_COMMUNITY_addTagToConversation|addTagToConversation]]
- [[_COMMUNITY_adminFunctionById|adminFunctionById]]
- [[_COMMUNITY_adminGroupById|adminGroupById]]
- [[_COMMUNITY_adminTenants|adminTenants]]
- [[_COMMUNITY_agents|agents]]
- [[_COMMUNITY_assistants|assistants]]
- [[_COMMUNITY_deleteCategory|deleteCategory]]
- [[_COMMUNITY_memories|memories]]
- [[_COMMUNITY_deleteSkill|deleteSkill]]
- [[_COMMUNITY_adminSecretByName|adminSecretByName]]
- [[_COMMUNITY_adminUsers|adminUsers]]
- [[_COMMUNITY_deletePromptGroup|deletePromptGroup]]
- [[_COMMUNITY_postCategory|postCategory]]
- [[_COMMUNITY_postPrompt|postPrompt]]
- [[_COMMUNITY_updatePromptGroup|updatePromptGroup]]

## God Nodes (most connected - your core abstractions)
1. `getRole()` - 14 edges
2. `maybeRefreshCloudFrontAuthCookies()` - 13 edges
3. `projectMetaAds()` - 13 edges
4. `ImportBatchBuilder` - 10 edges
5. `setCloudFrontCookies()` - 10 edges
6. `handleZip()` - 10 edges
7. `getS3Key()` - 9 edges
8. `prompts()` - 9 edges
9. `resolveImportDefaultModel()` - 8 edges
10. `cloneMessagesWithTimestamps()` - 8 edges

## Surprising Connections (you probably didn't know these)
- `useDefaultConvo()` --indirect_call--> `models()`  [INFERRED]
  client/src/hooks/Conversations/useDefaultConvo.ts → packages/data-provider/src/api-endpoints.ts
- `useExportConversation()` --indirect_call--> `messages()`  [INFERRED]
  client/src/hooks/Conversations/useExportConversation.ts → packages/data-provider/src/api-endpoints.ts
- `useGenerateConvo()` --indirect_call--> `models()`  [INFERRED]
  client/src/hooks/Conversations/useGenerateConvo.ts → packages/data-provider/src/api-endpoints.ts
- `useNavigateToConvo()` --indirect_call--> `models()`  [INFERRED]
  client/src/hooks/Conversations/useNavigateToConvo.tsx → packages/data-provider/src/api-endpoints.ts
- `usePresets()` --indirect_call--> `presets()`  [INFERRED]
  client/src/hooks/Conversations/usePresets.ts → packages/data-provider/src/api-endpoints.ts

## Import Cycles
- None detected.

## Communities (58 total, 13 thin omitted)

### Community 2 - "index"
Cohesion: 0.07
Nodes (30): useClientResize(), useDelayedUploadToast(), useDeleteFilesFromTable(), FileMapSetter, useFileDeletion(), FileHandlingState, TODO: this should not be a dynamic localize input!!, TODO: this should not be a dynamic localize input!! (+22 more)

### Community 3 - "metadata"
Cohesion: 0.10
Nodes (37): getStorageMetadata(), StorageMetadataInput, deleteFileFromS3(), extractKeyFromS3Url(), getDefaultStorageRegion(), getInlinePathPrefix(), getNewS3URL(), getParsedPathFlags() (+29 more)

### Community 4 - "permissions"
Cohesion: 0.05
Nodes (40): agentPermissionsSchema, bookmarkPermissionsSchema, fileCitationsPermissionsSchema, fileSearchPermissionsSchema, INTERFACE_PERMISSION_FIELDS, marketplacePermissionsSchema, mcpServersPermissionsSchema, memoryPermissionsSchema (+32 more)

### Community 5 - "cloudfront cookies"
Cohesion: 0.10
Nodes (36): assertPolicyPathSegment(), clearCloudFrontCookies(), clearCookiePaths(), CloudFrontAuthCookieRefreshRequest, CloudFrontAuthCookieRefreshResult, CloudFrontCookieRefreshOptions, CloudFrontCookieRequest, CloudFrontCookieScope (+28 more)

### Community 6 - "index"
Cohesion: 0.07
Nodes (16): useBookmarkSuccess(), exceptions, TDefaultConvo, useDefaultConvo(), ExportEntries, ExportValues, useGenerateConvo(), useNavigateToConvo() (+8 more)

### Community 7 - "fork"
Cohesion: 0.10
Nodes (31): BaseClient, cloneMessagesWithTimestamps(), { createImportBatchBuilder }, duplicateConversation(), { EModelEndpoint, Constants, ForkOptions }, escapeRegExp(), forkConversation(), forkConversationFromSource() (+23 more)

### Community 8 - "avatar"
Cohesion: 0.08
Nodes (19): AvatarConfig, sharedAvatarBasePathStrategies, ImageService, ImageServiceConfig, ImageServiceDeps, BatchUpdateFn, DownloadURLParams, GetURLParams (+11 more)

### Community 9 - "convos"
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

### Community 10 - "azure"
Cohesion: 0.12
Nodes (13): getAzureContainerClient(), initializeAzureBlobService(), CloudFrontFullConfig, initializeCloudFront(), getFirebaseStorage(), initializeFirebase(), initializeS3(), load() (+5 more)

### Community 11 - "import"
Cohesion: 0.22
Nodes (18): createImportHandler(), getAuthorInfo(), getImportLimits(), grantOwnership(), guessMimeType(), handleMarkdown(), handleZip(), ImportLimits (+10 more)

### Community 12 - "importers"
Cohesion: 0.17
Nodes (15): adjustTimestampsForOrdering(), breakParentCycles(), { cloneMessagesWithTimestamps }, { createImportBatchBuilder }, { EModelEndpoint, Constants, openAISettings }, extractClaudeContent(), formatMessageText(), { getEndpointsConfig } (+7 more)

### Community 13 - "crud"
Cohesion: 0.25
Nodes (14): appendDownloadOverrides(), buildCloudFrontUrl(), CloudFrontURLParams, deleteFileFromCloudFront(), getCloudFrontDownloadURL(), getCloudFrontURL(), getOrCreateCloudFrontClient(), getRegionPathOptions() (+6 more)

### Community 14 - "crud test"
Cohesion: 0.14
Nodes (12): mockCloudFrontSend, mockDeleteFileFromS3, mockExtractKeyFromS3Url, mockGetCloudFrontConfig, mockGetS3FileStream, mockGetS3Key, mockGetSignedUrl, mockLogger (+4 more)

### Community 15 - "getRole"
Cohesion: 0.14
Nodes (14): getRole(), roles(), updateAgentPermissions(), updateFileCitationsPermissions(), updateFileSearchPermissions(), updateMarketplacePermissions(), updateMCPServersPermissions(), updateMemoryPermissions() (+6 more)

### Community 16 - "projectById"
Cohesion: 0.15
Nodes (13): projectById(), projectMetaAds(), projectMetaAdsApply(), projectMetaAdsBudget(), projectMetaAdsDuplicate(), projectMetaAdsEntityStatus(), projectMetaAdsPerformance(), projectMetaAdsRankings() (+5 more)

### Community 17 - "defaults"
Cohesion: 0.23
Nodes (10): { EModelEndpoint, openAISettings, anthropicSettings }, FALLBACK_MODEL_BY_ENDPOINT, { getModelsConfig }, { logger, getTenantId }, pickFirstConfiguredModel(), resolveImportDefaultModel(), { EModelEndpoint, openAISettings, anthropicSettings }, mockGetModelsConfig (+2 more)

### Community 18 - "importBatchBuilder"
Cohesion: 0.17
Nodes (10): { bulkIncrementTagCounts, bulkSaveConvos, bulkSaveMessages }, { EModelEndpoint, Constants, openAISettings }, { FALLBACK_MODEL_BY_ENDPOINT }, { logger }, { v4: uuidv4 }, { Constants }, { getImporter }, { ImportBatchBuilder } (+2 more)

### Community 19 - "deletePrompt"
Cohesion: 0.18
Nodes (11): deletePrompt(), getAllPromptGroups(), getPrompt(), getPromptGroup(), getPromptGroupsWithFilters(), getPromptsWithFilters(), getRandomPrompts(), prompts() (+3 more)

### Community 20 - "importConversations"
Cohesion: 0.22
Nodes (8): { getImporter }, importConversations(), { logger }, maxFileSize, { resolveImportMaxFileSize }, getImporter(), importConversations, importers

### Community 21 - "useAttachmentPreviewSync spec"
Cohesion: 0.31
Nodes (8): makeAttachment(), mockUseFilePreview, setup(), setupWithTransitions(), wrapper(), NOTE: an earlier version of this hook also gated on `isAnySubmitting`, useAttachmentPreviewSync(), UseAttachmentPreviewSyncResult

### Community 22 - "importers spec"
Cohesion: 0.22
Nodes (8): { bulkSaveMessages, bulkSaveConvos: _bulkSaveConvos }, {
  EModelEndpoint,
  Constants,
  openAISettings,
  anthropicSettings,
}, fs, { getImporter, processAssistantMessage }, { ImportBatchBuilder }, mockGetEndpointsConfig, mockGetModelsConfig, path

### Community 23 - "index"
Cohesion: 0.33
Nodes (5): dropSupersededPromptGroupIndexes(), SUPERSEDED_PROMPT_GROUP_INDEXES, dropSupersededTenantIndexes(), MigrationResult, SUPERSEDED_INDEXES

### Community 24 - "importLimiters"
Cohesion: 0.43
Nodes (7): createImportHandler(), createImportLimiters(), getEnvironmentVariables(), { limiterCache, removePorts }, logViolation, rateLimit, { ViolationTypes }

### Community 25 - "uploadLimiters"
Cohesion: 0.43
Nodes (7): createFileLimiters(), createFileUploadHandler(), getEnvironmentVariables(), { limiterCache, removePorts }, logViolation, rateLimit, { ViolationTypes }

### Community 27 - "migration"
Cohesion: 0.29
Nodes (6): checkPromptPermissionsMigration(), PromptGroupMigrationData, PromptMigrationCheckDbMethods, PromptMigrationCheckParams, PromptMigrationCheckResult, toString()

### Community 28 - "useFileHandling test"
Cohesion: 0.33
Nodes (5): mockConversation, mockInvalidateQueries, mockMutate, mockSetFilesLoading, mockShowToast

### Community 29 - "getCustomConfigSpeech"
Cohesion: 0.33
Nodes (6): getCustomConfigSpeech(), speech(), speechToText(), textToSpeech(), textToSpeechManual(), textToSpeechVoices()

### Community 30 - "getSkill"
Cohesion: 0.33
Nodes (6): getSkill(), importSkill(), listSkillsWithFilters(), skillFile(), skillFiles(), skills()

### Community 31 - "validation test"
Cohesion: 0.70
Nodes (3): assertPathSegment(), assertS3FileName(), sanitizeContentDispositionFilename()

### Community 33 - "UploadSkillDialog"
Cohesion: 0.67
Nodes (3): formatMegabytes(), UploadSkillDialog(), UploadSkillDialogProps

### Community 34 - "useExportConversation"
Cohesion: 0.50
Nodes (4): useExportConversation(), buildQuery(), conversations(), messages()

### Community 35 - "adminConfigActive"
Cohesion: 0.50
Nodes (4): adminConfigActive(), adminConfigBase(), adminConfigByPrincipal(), adminConfigs()

### Community 40 - "addTagToConversation"
Cohesion: 0.67
Nodes (3): addTagToConversation(), conversationTags(), conversationTagsList()

### Community 41 - "adminFunctionById"
Cohesion: 0.67
Nodes (3): adminFunctionById(), adminFunctions(), adminFunctionToggle()

### Community 42 - "adminGroupById"
Cohesion: 0.67
Nodes (3): adminGroupById(), adminGroupMembers(), adminGroups()

### Community 43 - "adminTenants"
Cohesion: 0.67
Nodes (3): adminTenants(), adminTenantStats(), adminTenantUsers()

### Community 44 - "agents"
Cohesion: 0.67
Nodes (3): agents(), cloneAgentToTenant(), revertAgentVersion()

### Community 45 - "assistants"
Cohesion: 0.67
Nodes (3): assistants(), avatar(), images()

### Community 46 - "deleteCategory"
Cohesion: 0.67
Nodes (3): deleteCategory(), getCategories(), updateCategory()

### Community 47 - "memories"
Cohesion: 0.67
Nodes (3): memories(), memory(), memoryPreferences()

### Community 48 - "deleteSkill"
Cohesion: 0.67
Nodes (3): deleteSkill(), getSkill(), updateSkill()

## Knowledge Gaps
- **206 isolated node(s):** `{ ViolationTypes }`, `{ limiterCache, removePorts }`, `{ ViolationTypes }`, `{ limiterCache, removePorts }`, `multer` (+201 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **13 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `files()` connect `index` to `api endpoints`, `getCustomConfigSpeech`, `assistants`?**
  _High betweenness centrality (0.059) - this node is a cross-community bridge._
- **Why does `models()` connect `index` to `api endpoints`?**
  _High betweenness centrality (0.022) - this node is a cross-community bridge._
- **What connects `{ ViolationTypes }`, `{ limiterCache, removePorts }`, `{ ViolationTypes }` to the rest of the system?**
  _210 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `data service` be split into smaller, more focused modules?**
  _Cohesion score 0.008298755186721992 - nodes in this community are weakly interconnected._
- **Should `api endpoints` be split into smaller, more focused modules?**
  _Cohesion score 0.02127659574468085 - nodes in this community are weakly interconnected._
- **Should `index` be split into smaller, more focused modules?**
  _Cohesion score 0.07446808510638298 - nodes in this community are weakly interconnected._
- **Should `metadata` be split into smaller, more focused modules?**
  _Cohesion score 0.10188261351052048 - nodes in this community are weakly interconnected._