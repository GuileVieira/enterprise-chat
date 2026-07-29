# Graph Report - .  (2026-07-07)

## Corpus Check
- 193 files · ~89,255 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1591 nodes · 1900 edges · 105 communities (85 shown, 20 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 78 edges (avg confidence: 0.5)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_data service|data service]]
- [[_COMMUNITY_config|config]]
- [[_COMMUNITY_api endpoints|api endpoints]]
- [[_COMMUNITY_getCustomConfigSpeech|getCustomConfigSpeech]]
- [[_COMMUNITY_getCustomConfigSpeech|getCustomConfigSpeech]]
- [[_COMMUNITY_avatar|avatar]]
- [[_COMMUNITY_ConversationModeSwitch|ConversationModeSwitch]]
- [[_COMMUNITY_ConversationModeSwitch|ConversationModeSwitch]]
- [[_COMMUNITY_index|index]]
- [[_COMMUNITY_permissions|permissions]]
- [[_COMMUNITY_index|index]]
- [[_COMMUNITY_crud|crud]]
- [[_COMMUNITY_customConfigSpeech|customConfigSpeech]]
- [[_COMMUNITY_customConfigSpeech|customConfigSpeech]]
- [[_COMMUNITY_crud|crud]]
- [[_COMMUNITY_crud|crud]]
- [[_COMMUNITY_STTService|STTService]]
- [[_COMMUNITY_STTService|STTService]]
- [[_COMMUNITY_crud|crud]]
- [[_COMMUNITY_index|index]]
- [[_COMMUNITY_OpenRouterGeminiImageGen|OpenRouterGeminiImageGen]]
- [[_COMMUNITY_index|index]]
- [[_COMMUNITY_GeminiImageGen|GeminiImageGen]]
- [[_COMMUNITY_OpenAIImageTools|OpenAIImageTools]]
- [[_COMMUNITY_index|index]]
- [[_COMMUNITY_audio|audio]]
- [[_COMMUNITY_convert|convert]]
- [[_COMMUNITY_getRole|getRole]]
- [[_COMMUNITY_images|images]]
- [[_COMMUNITY_projectById|projectById]]
- [[_COMMUNITY_images agents test|images agents test]]
- [[_COMMUNITY_DialogImage|DialogImage]]
- [[_COMMUNITY_imageTools agent spec|imageTools agent spec]]
- [[_COMMUNITY_images|images]]
- [[_COMMUNITY_encode|encode]]
- [[_COMMUNITY_deletePrompt|deletePrompt]]
- [[_COMMUNITY_avatar|avatar]]
- [[_COMMUNITY_crud|crud]]
- [[_COMMUNITY_assistants|assistants]]
- [[_COMMUNITY_imageResize|imageResize]]
- [[_COMMUNITY_sttLimiters|sttLimiters]]
- [[_COMMUNITY_ttsLimiters|ttsLimiters]]
- [[_COMMUNITY_avatar|avatar]]
- [[_COMMUNITY_avatar spec|avatar spec]]
- [[_COMMUNITY_useGetAudioSettings|useGetAudioSettings]]
- [[_COMMUNITY_speech|speech]]
- [[_COMMUNITY_images|images]]
- [[_COMMUNITY_avatars|avatars]]
- [[_COMMUNITY_getSkill|getSkill]]
- [[_COMMUNITY_index|index]]
- [[_COMMUNITY_Image|Image]]
- [[_COMMUNITY_avatar|avatar]]
- [[_COMMUNITY_validateImages spec|validateImages spec]]
- [[_COMMUNITY_useTextToSpeechExternal|useTextToSpeechExternal]]
- [[_COMMUNITY_adminConfigActive|adminConfigActive]]
- [[_COMMUNITY_keys|keys]]
- [[_COMMUNITY_GeminiImageGen proxy spec|GeminiImageGen proxy spec]]
- [[_COMMUNITY_OpenAIImageTools test|OpenAIImageTools test]]
- [[_COMMUNITY_useSpeechSettingsInit|useSpeechSettingsInit]]
- [[_COMMUNITY_SpeechIcon|SpeechIcon]]
- [[_COMMUNITY_addTagToConversation|addTagToConversation]]
- [[_COMMUNITY_adminFunctionById|adminFunctionById]]
- [[_COMMUNITY_adminGroupById|adminGroupById]]
- [[_COMMUNITY_adminTenants|adminTenants]]
- [[_COMMUNITY_agents|agents]]
- [[_COMMUNITY_buildQuery|buildQuery]]
- [[_COMMUNITY_deleteCategory|deleteCategory]]
- [[_COMMUNITY_memories|memories]]
- [[_COMMUNITY_deleteSkill|deleteSkill]]
- [[_COMMUNITY_index|index]]
- [[_COMMUNITY_adminSecretByName|adminSecretByName]]
- [[_COMMUNITY_adminUsers|adminUsers]]
- [[_COMMUNITY_getConfigDefaults|getConfigDefaults]]
- [[_COMMUNITY_getEndpointField|getEndpointField]]
- [[_COMMUNITY_isPrivateIPv4Literal|isPrivateIPv4Literal]]
- [[_COMMUNITY_isRemoteOidcUrlAllowed|isRemoteOidcUrlAllowed]]
- [[_COMMUNITY_normalizePort|normalizePort]]
- [[_COMMUNITY_deletePromptGroup|deletePromptGroup]]
- [[_COMMUNITY_postCategory|postCategory]]
- [[_COMMUNITY_postPrompt|postPrompt]]
- [[_COMMUNITY_updatePromptGroup|updatePromptGroup]]

## God Nodes (most connected - your core abstractions)
1. `getRole()` - 14 edges
2. `TTSService` - 13 edges
3. `TTSService` - 13 edges
4. `projectMetaAds()` - 13 edges
5. `uploadMistralOCR()` - 11 edges
6. `startServer()` - 10 edges
7. `resizeImageBuffer()` - 10 edges
8. `STTService` - 9 edges
9. `STTService` - 9 edges
10. `prompts()` - 9 edges

## Surprising Connections (you probably didn't know these)
- `createValidateImageRequest()` --indirect_call--> `refreshToken()`  [INFERRED]
  api/server/middleware/validateImageRequest.js → packages/data-provider/src/api-endpoints.ts
- `callResize()` --calls--> `resizeAvatar()`  [EXTRACTED]
  api/server/services/Files/images/avatar.spec.js → api/server/services/Files/images/avatar.js
- `getVoices()` --calls--> `getProvider()`  [EXTRACTED]
  api/server/services/Files/Audio/Audio/getVoices.js → api/server/services/Files/Audio/Audio/TTSService.js
- `getVoices()` --calls--> `getProvider()`  [EXTRACTED]
  api/server/services/Files/Audio/getVoices.js → api/server/services/Files/Audio/TTSService.js
- `uploadImageToAzure()` --calls--> `resizeImageBuffer()`  [EXTRACTED]
  api/server/services/Files/Azure/images.js → api/server/services/Files/images/resize.js

## Import Cycles
- None detected.

## Communities (105 total, 20 thin omitted)

### Community 1 - "config"
Cohesion: 0.01
Nodes (146): addParamsSchema, AgentCapabilities, agentsEndpointSchema, allowedAddressEntrySchema, allowedAddressesSchema, alternateName, anthropicEndpointSchema, assistantEndpointSchema (+138 more)

### Community 3 - "getCustomConfigSpeech"
Cohesion: 0.05
Nodes (32): { getAppConfig }, { logger }, { getAppConfig }, { getProvider }, getVoices(), { TTSProviders }, getCustomConfigSpeech, getVoices (+24 more)

### Community 4 - "getCustomConfigSpeech"
Cohesion: 0.05
Nodes (32): { getAppConfig }, { logger }, { getAppConfig }, { getProvider }, getVoices(), { TTSProviders }, getCustomConfigSpeech, getVoices (+24 more)

### Community 5 - "avatar"
Cohesion: 0.06
Nodes (40): ALLOWED_AVATAR_PROTOCOLS, { createSSRFSafeAgents }, { EImageOutputType }, fetch, fetchAvatarBuffer(), { logger }, { resizeAndConvert }, resizeAvatar() (+32 more)

### Community 6 - "ConversationModeSwitch"
Cohesion: 0.06
Nodes (12): ConversationModeSwitch(), TODO: remove this once the 'edge' engine is fully deprecated, AutoTranscribeAudioSwitch(), EngineSTTDropdownProps, SpeechToTextSwitch(), AutomaticPlaybackSwitch(), CacheTTSSwitch(), CloudBrowserVoicesSwitch() (+4 more)

### Community 7 - "ConversationModeSwitch"
Cohesion: 0.06
Nodes (12): ConversationModeSwitch(), TODO: remove this once the 'edge' engine is fully deprecated, AutoTranscribeAudioSwitch(), EngineSTTDropdownProps, SpeechToTextSwitch(), AutomaticPlaybackSwitch(), CacheTTSSwitch(), CloudBrowserVoicesSwitch() (+4 more)

### Community 8 - "index"
Cohesion: 0.05
Nodes (41): accessPermissions, actions, adminAuth, adminConfig, adminFunctions, adminGrants, adminGroups, adminOverview (+33 more)

### Community 9 - "permissions"
Cohesion: 0.05
Nodes (40): agentPermissionsSchema, bookmarkPermissionsSchema, fileCitationsPermissionsSchema, fileSearchPermissionsSchema, INTERFACE_PERMISSION_FIELDS, marketplacePermissionsSchema, mcpServersPermissionsSchema, memoryPermissionsSchema (+32 more)

### Community 10 - "index"
Cohesion: 0.07
Nodes (36): app, axios, { capabilityContextMiddleware }, { checkMigrations }, compression, configureSocialLogins, { connectDb, indexSync }, cookieParser (+28 more)

### Community 11 - "crud"
Cohesion: 0.09
Nodes (27): axios, deleteFile(), deleteFirebaseFile(), extractFirebaseFilePath(), fetch, fs, { getBufferMetadata }, getFirebaseFileStream() (+19 more)

### Community 12 - "customConfigSpeech"
Cohesion: 0.07
Nodes (24): express, { getCustomConfigSpeech }, router, { createTTSLimiters, createSTTLimiters }, customConfigSpeech, express, router, stt (+16 more)

### Community 13 - "customConfigSpeech"
Cohesion: 0.07
Nodes (24): express, { getCustomConfigSpeech }, router, { createTTSLimiters, createSTTLimiters }, customConfigSpeech, express, router, stt (+16 more)

### Community 14 - "crud"
Cohesion: 0.09
Nodes (23): axios, fetch, fs, { getAzureContainerClient, deleteRagFile }, getAzureFileStream(), { logger }, mime, path (+15 more)

### Community 15 - "crud"
Cohesion: 0.16
Nodes (26): AuthConfig, axios, createJWT(), createOCRError(), deleteMistralFile(), exchangeJWTForAccessToken(), getDocumentType(), getEnvVarName() (+18 more)

### Community 16 - "STTService"
Cohesion: 0.10
Nodes (15): axios, createSTTService(), { extractEnvVariable, STTProviders }, FormData, { genAzureEndpoint, logAxiosError }, { getAppConfig }, getFileExtensionFromMime(), getValidatedLanguageCode() (+7 more)

### Community 17 - "STTService"
Cohesion: 0.10
Nodes (15): axios, createSTTService(), { extractEnvVariable, STTProviders }, FormData, { genAzureEndpoint, logAxiosError }, { getAppConfig }, getFileExtensionFromMime(), getValidatedLanguageCode() (+7 more)

### Community 18 - "crud"
Cohesion: 0.10
Nodes (20): axios, deleteLocalFile(), { deleteRagFile }, { EModelEndpoint }, fs, { getBufferMetadata }, isValidPath(), { logger } (+12 more)

### Community 19 - "index"
Cohesion: 0.10
Nodes (8): MediaSourceAppender, CustomAudioElement, TCustomAudioResult, usePauseGlobalAudio(), TUseTextToSpeech, TUseTextToSpeech, TUseTextToSpeech, useTextToSpeech()

### Community 20 - "OpenRouterGeminiImageGen"
Cohesion: 0.12
Nodes (19): { ContentTypes }, convertImagesToContent(), createOpenRouterGeminiImageTool(), estimatePromptTokens(), {
  getBalanceConfig,
  getTransactionsConfig,
}, getImageUrl(), getOpenRouterKey(), { getStrategyFunctions } (+11 more)

### Community 21 - "index"
Cohesion: 0.11
Nodes (5): MediaSourceAppender, CustomAudioElement, TCustomAudioResult, TUseTextToSpeech, TUseTextToSpeech

### Community 22 - "GeminiImageGen"
Cohesion: 0.14
Nodes (19): checkForSafetyBlock(), { ContentTypes, EImageOutputType }, convertImageFormat(), convertImagesToInlineData(), createGeminiImageTool(), {
  geminiToolkit,
  loadServiceKey,
  getBalanceConfig,
  getTransactionsConfig,
}, getDefaultServiceKeyPath(), { getStrategyFunctions } (+11 more)

### Community 23 - "OpenAIImageTools"
Cohesion: 0.12
Nodes (19): axios, { ContentTypes, EImageOutputType }, createAbortHandler(), createOpenAIImageTools(), FormData, { getFiles }, { getStrategyFunctions }, { HttpsProxyAgent } (+11 more)

### Community 24 - "index"
Cohesion: 0.17
Nodes (8): AGENT_STYLE_TOOLS, computeCancelled(), computeCancelled(), OpenAIImageGen(), ProgressText(), OpenAIImageGen(), ProgressText(), defaultProps

### Community 25 - "audio"
Cohesion: 0.26
Nodes (11): encodeAndFormatAudios(), ANTHROPIC_CITATION_TYPES, encodeAndFormatDocuments(), formatDocumentBlock(), mockedGetConfiguredFileSizeLimit, mockedGetFileStream, mockedValidateBedrockDocument, mockedValidatePdf (+3 more)

### Community 26 - "convert"
Cohesion: 0.20
Nodes (12): convertImage(), fs, { getStorageMetadata }, { getStrategyFunctions }, { logger }, path, { resizeImageBuffer }, sharp (+4 more)

### Community 27 - "getRole"
Cohesion: 0.14
Nodes (14): getRole(), roles(), updateAgentPermissions(), updateFileCitationsPermissions(), updateFileSearchPermissions(), updateMarketplacePermissions(), updateMCPServersPermissions(), updateMemoryPermissions() (+6 more)

### Community 28 - "images"
Cohesion: 0.19
Nodes (11): encodeImage(), fs, path, prepareImagesLocal(), processLocalAvatar(), { resizeImageBuffer }, sharp, { updateUser, updateFile } (+3 more)

### Community 29 - "projectById"
Cohesion: 0.15
Nodes (13): projectById(), projectMetaAds(), projectMetaAdsApply(), projectMetaAdsBudget(), projectMetaAdsDuplicate(), projectMetaAdsEntityStatus(), projectMetaAdsPerformance(), projectMetaAdsRankings() (+5 more)

### Community 30 - "images agents test"
Cohesion: 0.17
Nodes (11): { createAgent }, { createMethods }, express, fs, { MongoMemoryServer }, mongoose, { processAgentFileUpload }, request (+3 more)

### Community 31 - "DialogImage"
Cohesion: 0.23
Nodes (9): DialogImage(), getQualityStyles(), imageSizeCache, computeHeightStyle(), dimensionCache, Image(), IMAGE_MAX_H, paintedUrls (+1 more)

### Community 32 - "imageTools agent spec"
Cohesion: 0.18
Nodes (9): axios, { ContentTypes }, DALLE3, fetch, FluxAPI, OpenAI, StableDiffusionAPI, { ToolMessage } (+1 more)

### Community 33 - "images"
Cohesion: 0.18
Nodes (10): { checkPermission }, db, express, { isAssistantsEndpoint }, { logger }, path, {
  processAgentFileUpload,
  processImageFile,
  filterFile,
}, TODO: delete remote file if it exists (+2 more)

### Community 34 - "encode"
Cohesion: 0.22
Nodes (10): axios, base64Only, blobStorageSources, encodeAndFormat(), fetchImageToBase64(), {
  FileSources,
  VisionModes,
  ImageDetail,
  ContentTypes,
  EModelEndpoint,
  mergeFileConfig,
  getEndpointFileConfig,
}, { getStrategyFunctions }, { logAxiosError, validateImage } (+2 more)

### Community 35 - "deletePrompt"
Cohesion: 0.18
Nodes (11): deletePrompt(), getAllPromptGroups(), getPrompt(), getPromptGroup(), getPromptGroupsWithFilters(), getPromptsWithFilters(), getRandomPrompts(), prompts() (+3 more)

### Community 36 - "avatar"
Cohesion: 0.27
Nodes (9): ALLOWED_AVATAR_PROTOCOLS, { createSSRFSafeAgents }, { EImageOutputType }, fetch, fetchAvatarBuffer(), { logger }, { resizeAndConvert }, resizeAvatar() (+1 more)

### Community 37 - "crud"
Cohesion: 0.20
Nodes (5): { FilePurpose }, fs, { logger }, { sleep }, crud

### Community 38 - "assistants"
Cohesion: 0.20
Nodes (10): assistants(), avatar(), files(), getCustomConfigSpeech(), images(), speech(), speechToText(), textToSpeech() (+2 more)

### Community 39 - "imageResize"
Cohesion: 0.33
Nodes (7): calculateDimensions(), DEFAULT_RESIZE_OPTIONS, resizeImage(), ResizeOptions, ResizeResult, shouldResizeImage(), supportsClientResize()

### Community 40 - "sttLimiters"
Cohesion: 0.43
Nodes (7): createSTTHandler(), createSTTLimiters(), getEnvironmentVariables(), { limiterCache, removePorts }, logViolation, rateLimit, { ViolationTypes }

### Community 41 - "ttsLimiters"
Cohesion: 0.43
Nodes (7): createTTSHandler(), createTTSLimiters(), getEnvironmentVariables(), { limiterCache, removePorts }, logViolation, rateLimit, { ViolationTypes }

### Community 42 - "avatar"
Cohesion: 0.25
Nodes (7): express, { filterFile }, { getFileStrategy }, { getStrategyFunctions }, { logger }, { resizeAvatar }, router

### Community 43 - "avatar spec"
Cohesion: 0.25
Nodes (5): callResize(), { createSSRFSafeAgents }, fetch, { resizeAvatar }, sharp

### Community 44 - "useGetAudioSettings"
Cohesion: 0.68
Nodes (4): useGetAudioSettings(), useSpeechToText(), useSpeechToTextBrowser(), useSpeechToTextExternal()

### Community 45 - "speech"
Cohesion: 0.39
Nodes (6): getSpeechFeatureValue(), isSpeechFeatureDisabled(), isSpeechFeatureEnabled(), SpeechConfig, SpeechFeatureKey, SpeechFeatureValue

### Community 46 - "images"
Cohesion: 0.36
Nodes (3): ImageService, ImageServiceConfig, ImageServiceDeps

### Community 47 - "avatars"
Cohesion: 0.43
Nodes (5): refreshListAvatars(), RefreshListAvatarsParams, RefreshS3UrlFn, RefreshStats, UpdateAgentFn

### Community 48 - "getSkill"
Cohesion: 0.33
Nodes (6): getSkill(), importSkill(), listSkillsWithFilters(), skillFile(), skillFiles(), skills()

### Community 49 - "index"
Cohesion: 0.40
Nodes (4): avatar, convert, encode, resize

### Community 52 - "validateImages spec"
Cohesion: 0.50
Nodes (3): createValidateImageRequest, { isEnabled }, jwt

### Community 55 - "useTextToSpeechExternal"
Cohesion: 0.67
Nodes (3): createFormData(), TUseTTSExternal, useTextToSpeechExternal()

### Community 56 - "adminConfigActive"
Cohesion: 0.50
Nodes (4): adminConfigActive(), adminConfigBase(), adminConfigByPrincipal(), adminConfigs()

### Community 57 - "keys"
Cohesion: 0.50
Nodes (3): DynamicQueryKeys, MutationKeys, QueryKeys

### Community 68 - "addTagToConversation"
Cohesion: 0.67
Nodes (3): addTagToConversation(), conversationTags(), conversationTagsList()

### Community 69 - "adminFunctionById"
Cohesion: 0.67
Nodes (3): adminFunctionById(), adminFunctions(), adminFunctionToggle()

### Community 70 - "adminGroupById"
Cohesion: 0.67
Nodes (3): adminGroupById(), adminGroupMembers(), adminGroups()

### Community 71 - "adminTenants"
Cohesion: 0.67
Nodes (3): adminTenants(), adminTenantStats(), adminTenantUsers()

### Community 72 - "agents"
Cohesion: 0.67
Nodes (3): agents(), cloneAgentToTenant(), revertAgentVersion()

### Community 73 - "buildQuery"
Cohesion: 0.67
Nodes (3): buildQuery(), conversations(), messages()

### Community 74 - "deleteCategory"
Cohesion: 0.67
Nodes (3): deleteCategory(), getCategories(), updateCategory()

### Community 75 - "memories"
Cohesion: 0.67
Nodes (3): memories(), memory(), memoryPreferences()

### Community 76 - "deleteSkill"
Cohesion: 0.67
Nodes (3): deleteSkill(), getSkill(), updateSkill()

## Knowledge Gaps
- **595 isolated node(s):** `path`, `{ v4 }`, `{ ProxyAgent }`, `{ GoogleGenAI }`, `{ logger }` (+590 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **20 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `refreshToken()` connect `index` to `api endpoints`?**
  _High betweenness centrality (0.033) - this node is a cross-community bridge._
- **Why does `resizeImageBuffer()` connect `convert` to `crud`, `images`, `crud`?**
  _High betweenness centrality (0.003) - this node is a cross-community bridge._
- **What connects `path`, `{ v4 }`, `{ ProxyAgent }` to the rest of the system?**
  _604 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `data service` be split into smaller, more focused modules?**
  _Cohesion score 0.008298755186721992 - nodes in this community are weakly interconnected._
- **Should `config` be split into smaller, more focused modules?**
  _Cohesion score 0.013333333333333334 - nodes in this community are weakly interconnected._
- **Should `api endpoints` be split into smaller, more focused modules?**
  _Cohesion score 0.021052631578947368 - nodes in this community are weakly interconnected._
- **Should `getCustomConfigSpeech` be split into smaller, more focused modules?**
  _Cohesion score 0.050505050505050504 - nodes in this community are weakly interconnected._