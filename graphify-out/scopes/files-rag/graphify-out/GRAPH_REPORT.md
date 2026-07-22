# Graph Report - .  (2026-07-07)

## Corpus Check
- 200 files · ~169,043 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1733 nodes · 2333 edges · 106 communities (85 shown, 21 thin omitted)
- Extraction: 94% EXTRACTED · 6% INFERRED · 0% AMBIGUOUS · INFERRED: 144 edges (avg confidence: 0.59)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_data service|data service]]
- [[_COMMUNITY_api endpoints|api endpoints]]
- [[_COMMUNITY_documentParserStrategy|documentParserStrategy]]
- [[_COMMUNITY_getCustomConfigSpeech|getCustomConfigSpeech]]
- [[_COMMUNITY_index|index]]
- [[_COMMUNITY_files|files]]
- [[_COMMUNITY_auth|auth]]
- [[_COMMUNITY_classify|classify]]
- [[_COMMUNITY_permissions|permissions]]
- [[_COMMUNITY_crud|crud]]
- [[_COMMUNITY_crud|crud]]
- [[_COMMUNITY_process|process]]
- [[_COMMUNITY_index|index]]
- [[_COMMUNITY_customConfigSpeech|customConfigSpeech]]
- [[_COMMUNITY_crud|crud]]
- [[_COMMUNITY_STTService|STTService]]
- [[_COMMUNITY_AttachFile|AttachFile]]
- [[_COMMUNITY_MyFilesModal|MyFilesModal]]
- [[_COMMUNITY_process spec|process spec]]
- [[_COMMUNITY_index|index]]
- [[_COMMUNITY_FileContainer|FileContainer]]
- [[_COMMUNITY_file config|file config]]
- [[_COMMUNITY_files|files]]
- [[_COMMUNITY_strategies|strategies]]
- [[_COMMUNITY_crud|crud]]
- [[_COMMUNITY_libreoffice|libreoffice]]
- [[_COMMUNITY_files|files]]
- [[_COMMUNITY_fileAccess|fileAccess]]
- [[_COMMUNITY_process|process]]
- [[_COMMUNITY_avatar|avatar]]
- [[_COMMUNITY_validation|validation]]
- [[_COMMUNITY_mongoMeili|mongoMeili]]
- [[_COMMUNITY_crud|crud]]
- [[_COMMUNITY_createSanitizedUploadWrapper|createSanitizedUploadWrapper]]
- [[_COMMUNITY_DataTableFile|DataTableFile]]
- [[_COMMUNITY_convert|convert]]
- [[_COMMUNITY_getRole|getRole]]
- [[_COMMUNITY_process spec|process spec]]
- [[_COMMUNITY_FileList|FileList]]
- [[_COMMUNITY_projectById|projectById]]
- [[_COMMUNITY_images agents test|images agents test]]
- [[_COMMUNITY_vectorStrategy|vectorStrategy]]
- [[_COMMUNITY_text|text]]
- [[_COMMUNITY_fileSearch|fileSearch]]
- [[_COMMUNITY_files agents test|files agents test]]
- [[_COMMUNITY_images|images]]
- [[_COMMUNITY_index|index]]
- [[_COMMUNITY_initialize|initialize]]
- [[_COMMUNITY_saveBufferToAzure|saveBufferToAzure]]
- [[_COMMUNITY_encode|encode]]
- [[_COMMUNITY_crud|crud]]
- [[_COMMUNITY_deletePrompt|deletePrompt]]
- [[_COMMUNITY_convertStringsToRegex|convertStringsToRegex]]
- [[_COMMUNITY_files|files]]
- [[_COMMUNITY_assistants|assistants]]
- [[_COMMUNITY_index|index]]
- [[_COMMUNITY_avatar|avatar]]
- [[_COMMUNITY_importFileFilter|importFileFilter]]
- [[_COMMUNITY_process traversal spec|process traversal spec]]
- [[_COMMUNITY_enqueueDeleteOperation|enqueueDeleteOperation]]
- [[_COMMUNITY_DeleteIconButton|DeleteIconButton]]
- [[_COMMUNITY_FileDashboardView|FileDashboardView]]
- [[_COMMUNITY_axios|axios]]
- [[_COMMUNITY_projectContext|projectContext]]
- [[_COMMUNITY_index tenant test|index tenant test]]
- [[_COMMUNITY_FilesListView|FilesListView]]
- [[_COMMUNITY_VectorStoreList|VectorStoreList]]
- [[_COMMUNITY_useFileHandling test|useFileHandling test]]
- [[_COMMUNITY_getSkill|getSkill]]
- [[_COMMUNITY_index|index]]
- [[_COMMUNITY_DragDropModal|DragDropModal]]
- [[_COMMUNITY_adminConfigActive|adminConfigActive]]
- [[_COMMUNITY_file acl spec|file acl spec]]
- [[_COMMUNITY_index|index]]
- [[_COMMUNITY_getFileStrategy|getFileStrategy]]
- [[_COMMUNITY_DragDropOverlay|DragDropOverlay]]
- [[_COMMUNITY_DragDropWrapper|DragDropWrapper]]
- [[_COMMUNITY_FileUpload|FileUpload]]
- [[_COMMUNITY_ActionButton|ActionButton]]
- [[_COMMUNITY_keyvFiles|keyvFiles]]
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
- [[_COMMUNITY_getEndpointFileConfig|getEndpointFileConfig]]
- [[_COMMUNITY_file|file]]
- [[_COMMUNITY_skillFile|skillFile]]
- [[_COMMUNITY_file|file]]
- [[_COMMUNITY_deletePromptGroup|deletePromptGroup]]
- [[_COMMUNITY_postCategory|postCategory]]
- [[_COMMUNITY_postPrompt|postPrompt]]
- [[_COMMUNITY_updatePromptGroup|updatePromptGroup]]

## God Nodes (most connected - your core abstractions)
1. `getStrategyFunctions()` - 25 edges
2. `getRole()` - 14 edges
3. `TTSService` - 13 edges
4. `projectMetaAds()` - 13 edges
5. `uploadMistralOCR()` - 12 edges
6. `resizeImageBuffer()` - 11 edges
7. `firebaseStrategy()` - 11 edges
8. `localStrategy()` - 11 edges
9. `azureStrategy()` - 11 edges
10. `STTService` - 10 edges

## Surprising Connections (you probably didn't know these)
- `mistralOCRStrategy()` --indirect_call--> `uploadMistralOCR()`  [INFERRED]
  api/server/services/Files/strategies.js → packages/api/src/files/mistral/crud.ts
- `azureMistralOCRStrategy()` --indirect_call--> `uploadAzureMistralOCR()`  [INFERRED]
  api/server/services/Files/strategies.js → packages/api/src/files/mistral/crud.ts
- `vertexMistralOCRStrategy()` --indirect_call--> `uploadGoogleVertexMistralOCR()`  [INFERRED]
  api/server/services/Files/strategies.js → packages/api/src/files/mistral/crud.ts
- `getStrategyFunctions()` --indirect_call--> `FileSources`  [INFERRED]
  api/server/services/Files/strategies.js → packages/data-provider/src/types/files.ts
- `createFileMethods()` --indirect_call--> `deleteFile()`  [INFERRED]
  packages/data-schemas/src/methods/file.ts → api/server/services/Files/Firebase/crud.js

## Import Cycles
- None detected.

## Communities (106 total, 21 thin omitted)

### Community 2 - "documentParserStrategy"
Cohesion: 0.07
Nodes (51): documentParserStrategy(), excelSheetToText(), extractOdtContentXml(), FileParseFn, getParserForMimeType(), odtToText(), parseDocument(), wordDocToText() (+43 more)

### Community 3 - "getCustomConfigSpeech"
Cohesion: 0.05
Nodes (32): { getAppConfig }, { logger }, { getAppConfig }, { getProvider }, getVoices(), { TTSProviders }, getCustomConfigSpeech, getVoices (+24 more)

### Community 4 - "index"
Cohesion: 0.07
Nodes (34): makeAttachment(), mockUseFilePreview, setup(), setupWithTransitions(), wrapper(), NOTE: an earlier version of this hook also gated on `isAnySubmitting`, useAttachmentPreviewSync(), UseAttachmentPreviewSyncResult (+26 more)

### Community 5 - "files"
Cohesion: 0.05
Nodes (40): { checkPermission }, { cleanFileName, getContentDisposition }, db, DOWNLOAD_METADATA_FIELDS, { EnvVar }, express, { fileAccess }, {
  filterFile,
  processFileUpload,
  processDeleteRequest,
  processAgentFileUpload,
} (+32 more)

### Community 6 - "auth"
Cohesion: 0.07
Nodes (23): AgentUploadAuthDeps, AgentUploadAuthParams, AgentUploadAuthResult, checkAgentUploadAuth(), verifyAgentUploadPermission(), encodeAndFormatAudios(), ANTHROPIC_CITATION_TYPES, encodeAndFormatDocuments() (+15 more)

### Community 7 - "classify"
Cohesion: 0.08
Nodes (35): bareNameOf(), classifyCodeArtifact(), CodeArtifactCategory, DOCUMENT_EXTENSIONS, extensionOf(), isDocumentMime(), isUtf8TextMime(), PPTX_EXTENSIONS (+27 more)

### Community 8 - "permissions"
Cohesion: 0.05
Nodes (40): agentPermissionsSchema, bookmarkPermissionsSchema, fileCitationsPermissionsSchema, fileSearchPermissionsSchema, INTERFACE_PERMISSION_FIELDS, marketplacePermissionsSchema, mcpServersPermissionsSchema, memoryPermissionsSchema (+32 more)

### Community 9 - "crud"
Cohesion: 0.08
Nodes (34): axios, deleteFile(), deleteFirebaseFile(), extractFirebaseFilePath(), fetch, fs, { getBufferMetadata }, getFirebaseFileStream() (+26 more)

### Community 10 - "crud"
Cohesion: 0.07
Nodes (35): axios, deleteLocalFile(), { deleteRagFile }, { EModelEndpoint }, fs, { getBufferMetadata }, getLocalFileStream(), getLocalFileURL() (+27 more)

### Community 11 - "process"
Cohesion: 0.07
Nodes (31): { addResourceFileId, deleteResourceFileId }, base64ToBuffer(), { checkCapability }, {
  convertImage,
  resizeAndConvert,
  resizeImageBuffer,
}, createImageRagCaption(), { createVisionPrompt }, db, { determineFileType } (+23 more)

### Community 12 - "index"
Cohesion: 0.08
Nodes (21): consecutivePreviewErrors, fetchFilePreview(), FileDownloadOptions, isDirectDownloadSource(), previewRefetchInterval(), _resetPreviewErrorCounter(), revokeDownloadURL(), useFileDownload() (+13 more)

### Community 13 - "customConfigSpeech"
Cohesion: 0.07
Nodes (24): express, { getCustomConfigSpeech }, router, { createTTSLimiters, createSTTLimiters }, customConfigSpeech, express, router, stt (+16 more)

### Community 14 - "crud"
Cohesion: 0.16
Nodes (26): AuthConfig, axios, createJWT(), createOCRError(), deleteMistralFile(), exchangeJWTForAccessToken(), getDocumentType(), getEnvVarName() (+18 more)

### Community 15 - "STTService"
Cohesion: 0.10
Nodes (15): axios, createSTTService(), { extractEnvVariable, STTProviders }, FormData, { genAzureEndpoint, logAxiosError }, { getAppConfig }, getFileExtensionFromMime(), getValidatedLanguageCode() (+7 more)

### Community 16 - "AttachFile"
Cohesion: 0.08
Nodes (15): acceptMimeCandidates, AttachFileMenu(), AttachFileMenuProps, FileUploadType, getAcceptFromEndpointConfig(), mimeAcceptExtensions, defaultFileConfig, mockAgentsMap (+7 more)

### Community 17 - "MyFilesModal"
Cohesion: 0.10
Nodes (12): columns, contextMap, ColumnVisibilityDropdown(), ColumnVisibilityDropdownProps, contextMap, DataTableProps, Style, files (+4 more)

### Community 18 - "process spec"
Cohesion: 0.08
Nodes (17): {
  codeServerHttpAgent,
  codeServerHttpsAgent,
  getCodeApiAuthHeaders,
  getStorageMetadata,
}, { convertImage }, { createFile, getFiles }, { determineFileType }, { FileContext }, fileSizeLimitConfig, { getStrategyFunctions }, http (+9 more)

### Community 19 - "index"
Cohesion: 0.11
Nodes (19): { hasAccessToFilesViaAgent, filterFilesByAgentAccess }, { processCodeFile }, { processFileUpload }, { uploadImageBuffer }, { checkPermission, getEffectivePermissions }, filterFilesByAgentAccess(), { findProjectForRequest }, { getAgent, getFiles, getUserById } (+11 more)

### Community 20 - "FileContainer"
Cohesion: 0.11
Nodes (7): Image(), styleProps, ProgressCircle(), RemoveFile(), SourceIcon(), sourceToClassname, sourceToEndpoint

### Community 21 - "file config"
Cohesion: 0.08
Nodes (22): assistantsFileConfig, BedrockDocumentFormat, bedrockDocumentFormats, codeInterpreterMimeTypes, codeInterpreterMimeTypesList, codeTypeMapping, defaultSizeLimit, defaultSkillImportSizeLimit (+14 more)

### Community 22 - "files"
Cohesion: 0.21
Nodes (18): deterministicHexSuffix(), embedDisambiguatorInLeaf(), flattenArtifactPath(), readFileAsString(), ReadFileOptions, ReadFileResult, readJsonFile(), resolveUploadErrorMessage() (+10 more)

### Community 23 - "strategies"
Cohesion: 0.12
Nodes (21): cloudFrontImageService, cloudfrontStrategy(), { FileSources }, { getCodeOutputDownloadStream, uploadCodeEnvFile }, {
  getFirebaseURL,
  prepareImageURL,
  saveURLToFirebase,
  deleteFirebaseFile,
  saveBufferToFirebase,
  uploadFileToFirebase,
  uploadImageToFirebase,
  processFirebaseAvatar,
  getFirebaseFileStream,
}, {
  getS3URL,
  saveURLToS3WithMetadata,
  ImageService,
  parseDocument,
  uploadFileToS3,
  saveBufferToS3,
  getS3FileStream,
  getS3DownloadURL,
  deleteFileFromS3,
  getCloudFrontURL,
  uploadMistralOCR,
  saveURLToCloudFrontWithMetadata,
  uploadAzureMistralOCR,
  uploadFileToCloudFront,
  saveBufferToCloudFront,
  getCloudFrontFileStream,
  getCloudFrontDownloadURL,
  deleteFileFromCloudFront,
  uploadGoogleVertexMistralOCR,
}, imageServiceDeps, prepareCloudFrontImageURL() (+13 more)

### Community 24 - "crud"
Cohesion: 0.11
Nodes (16): axios, FormData, { getCodeBaseURL }, getCodeOutputDownloadStream(), {
  logAxiosError,
  appendCodeEnvFile,
  createAxiosInstance,
  codeServerHttpAgent,
  codeServerHttpsAgent,
  appendCodeEnvFileIdentity,
  buildCodeEnvDownloadQuery,
  getCodeApiAuthHeaders,
}, { logger }, {
  codeServerHttpAgent,
  codeServerHttpsAgent,
  getCodeApiAuthHeaders,
}, { getCodeOutputDownloadStream, uploadCodeEnvFile } (+8 more)

### Community 25 - "libreoffice"
Cohesion: 0.18
Nodes (16): BinaryProbe, buildPdfEmbedDocument(), convertOfficeToPdf(), isLibreOfficeEnabled(), isLibreOfficeEnabledFor(), LibreOfficeConversionError, LibreOfficeFormatEnablement, LibreOfficeUnavailableError (+8 more)

### Community 26 - "files"
Cohesion: 0.10
Nodes (19): AvatarUploadResponse, BatchFile, DeleteFilesBody, DeleteFilesResponse, DeleteMutationOptions, EndpointFileConfig, FileConfigInput, FileContext (+11 more)

### Community 27 - "fileAccess"
Cohesion: 0.13
Nodes (18): checkAgentBasedFileAccess(), checkProjectBasedFileAccess(), denyFileAccess(), fileAccess(), { findProjectForRequest }, { getAgents, getFiles }, { getEffectivePermissions }, getTenantId() (+10 more)

### Community 28 - "process"
Cohesion: 0.14
Nodes (17): appendVisibleCodeFileContext(), checkIfActive(), { convertImage }, { createFile, getFiles, updateFile, claimCodeFile }, { determineFileType }, { filterFilesByAgentAccess }, { getCodeBaseURL }, getPreviewContextSuffix() (+9 more)

### Community 29 - "avatar"
Cohesion: 0.15
Nodes (14): ALLOWED_AVATAR_PROTOCOLS, { createSSRFSafeAgents }, { EImageOutputType }, fetch, fetchAvatarBuffer(), { logger }, { resizeAndConvert }, resizeAvatar() (+6 more)

### Community 30 - "validation"
Cohesion: 0.18
Nodes (15): AudioValidationResult, ImageValidationResult, isBedrockClaude4Plus(), isBedrockNova(), isExemptFromBedrockDocLimit(), PDFValidationResult, validateAnthropicPdf(), validateAudio() (+7 more)

### Community 31 - "mongoMeili"
Cohesion: 0.15
Nodes (10): createMeiliMongooseModel(), DocumentWithMeiliIndex, getSyncConfig(), MeiliIndexable, mongoMeili(), MongoMeiliOptions, processBatch(), SchemaWithMeiliMethods (+2 more)

### Community 32 - "crud"
Cohesion: 0.18
Nodes (15): axios, deleteFileFromAzure(), fetch, fs, { getAzureContainerClient, deleteRagFile }, getAzureFileStream(), getAzureURL(), { logger } (+7 more)

### Community 33 - "createSanitizedUploadWrapper"
Cohesion: 0.20
Nodes (15): createSanitizedUploadWrapper(), createTempTextUpload(), formatImageCaptionText(), maybeLinkFileToProject(), processAgentFileUpload(), processFileUpload(), processFileURL(), processImageFile() (+7 more)

### Community 34 - "DataTableFile"
Cohesion: 0.15
Nodes (8): contextMap, DataTableProps, Style, UploadFileButton(), UploadFileProps, tempAssistants, tempFilesAttached, tempVectorStore

### Community 35 - "convert"
Cohesion: 0.20
Nodes (12): convertImage(), fs, { getStorageMetadata }, { getStrategyFunctions }, { logger }, path, { resizeImageBuffer }, sharp (+4 more)

### Community 36 - "getRole"
Cohesion: 0.14
Nodes (14): getRole(), roles(), updateAgentPermissions(), updateFileCitationsPermissions(), updateFileSearchPermissions(), updateMarketplacePermissions(), updateMCPServersPermissions(), updateMemoryPermissions() (+6 more)

### Community 37 - "process spec"
Cohesion: 0.15
Nodes (9): { checkCapability }, db, { encodeAndFormat }, {
  EToolResources,
  FileSources,
  FileContext,
  AgentCapabilities,
}, { getStrategyFunctions }, { mergeFileConfig }, mockRes, OpenAI (+1 more)

### Community 38 - "FileList"
Cohesion: 0.18
Nodes (7): FileList(), FileListProps, FileListItem2(), FileListItemProps, FileListItemProps, attachedVectorStores, fakeFiles

### Community 39 - "projectById"
Cohesion: 0.15
Nodes (13): projectById(), projectMetaAds(), projectMetaAdsApply(), projectMetaAdsBudget(), projectMetaAdsDuplicate(), projectMetaAdsEntityStatus(), projectMetaAdsPerformance(), projectMetaAdsRankings() (+5 more)

### Community 40 - "images agents test"
Cohesion: 0.17
Nodes (11): { createAgent }, { createMethods }, express, fs, { MongoMemoryServer }, mongoose, { processAgentFileUpload }, request (+3 more)

### Community 41 - "vectorStrategy"
Cohesion: 0.18
Nodes (10): vectorStrategy(), axios, deleteVectors(), { FileSources }, FormData, fs, { logAxiosError, generateShortLivedToken }, { logger } (+2 more)

### Community 42 - "text"
Cohesion: 0.26
Nodes (10): isMarkdownFile(), MARKDOWN_MIME_TYPES, normalizeMimeType(), parseText(), parseTextNative(), mockedAxios, mockedFormData, mockedFs (+2 more)

### Community 43 - "fileSearch"
Cohesion: 0.18
Nodes (8): axios, fileSearchJsonSchema, { filterFilesByAgentAccess }, { generateShortLivedToken }, { getFiles }, { logger }, { tool }, { Tools, EToolResources }

### Community 44 - "files agents test"
Cohesion: 0.18
Nodes (10): { createAgent, createFile }, { createMethods, SystemCapabilities }, express, { MongoMemoryServer }, mongoose, { processAgentFileUpload }, request, router (+2 more)

### Community 45 - "images"
Cohesion: 0.18
Nodes (10): { checkPermission }, db, express, { isAssistantsEndpoint }, { logger }, path, {
  processAgentFileUpload,
  processImageFile,
  filterFile,
}, TODO: delete remote file if it exists (+2 more)

### Community 46 - "index"
Cohesion: 0.18
Nodes (10): avatar, { avatar: agentAvatarRouter }, { avatar: asstAvatarRouter }, {
  createFileLimiters,
  configMiddleware,
  requireJwtAuth,
  uaParser,
  checkBan,
}, { createMulterInstance }, express, files, images (+2 more)

### Community 47 - "initialize"
Cohesion: 0.22
Nodes (10): initialize(), createFileFilter(), createMulterInstance(), crypto, fs, { getAppConfig }, {
  mergeFileConfig,
  getEndpointFileConfig,
  fileConfig: defaultFileConfig,
}, multer (+2 more)

### Community 48 - "saveBufferToAzure"
Cohesion: 0.25
Nodes (10): saveBufferToAzure(), fs, { logger }, path, processAzureAvatar(), { resizeImageBuffer }, { saveBufferToAzure }, sharp (+2 more)

### Community 49 - "encode"
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

### Community 50 - "crud"
Cohesion: 0.22
Nodes (9): deleteOpenAIFile(), { FilePurpose }, fs, getOpenAIFileStream(), { logger }, { sleep }, uploadOpenAIFile(), crud (+1 more)

### Community 51 - "deletePrompt"
Cohesion: 0.18
Nodes (11): deletePrompt(), getAllPromptGroups(), getPrompt(), getPromptGroup(), getPromptGroupsWithFilters(), getPromptsWithFilters(), getRandomPrompts(), prompts() (+3 more)

### Community 52 - "convertStringsToRegex"
Cohesion: 0.20
Nodes (10): convertStringsToRegex(), defaultOCRMimeTypes, documentParserMimeTypes, fileConfig, inferMimeType(), isPermissiveMimeConfig(), mbToBytes(), mergeFileConfig() (+2 more)

### Community 53 - "files"
Cohesion: 0.36
Nodes (8): cleanFileName(), determineFileType(), encodeRFC5987ValueChars(), getAsciiFilenameFallback(), getBufferMetadata(), getContentDisposition(), sharp, { cleanFileName, getContentDisposition }

### Community 54 - "assistants"
Cohesion: 0.20
Nodes (10): assistants(), avatar(), files(), getCustomConfigSpeech(), images(), speech(), speechToText(), textToSpeech() (+2 more)

### Community 55 - "index"
Cohesion: 0.28
Nodes (8): applyCitationLimits(), { checkAccess }, enhanceSourcesWithMetadata(), { getRoleByName, getFiles }, { logger }, { nanoid }, processFileCitations(), {
  Tools,
  Permissions,
  FileSources,
  EModelEndpoint,
  PermissionTypes,
}

### Community 56 - "avatar"
Cohesion: 0.25
Nodes (7): express, { filterFile }, { getFileStrategy }, { getStrategyFunctions }, { logger }, { resizeAvatar }, router

### Community 57 - "importFileFilter"
Cohesion: 0.25
Nodes (7): importFileFilter(), { createMulterInstance, storage, importFileFilter }, crypto, fs, os, path, storage

### Community 58 - "process traversal spec"
Cohesion: 0.25
Nodes (7): baseParams, { createFile }, mockAxios, mockFlattenArtifactPath, mockSanitizeArtifactPath, mockSaveBuffer, { processCodeOutput }

### Community 59 - "enqueueDeleteOperation"
Cohesion: 0.25
Nodes (7): enqueueDeleteOperation(), { agentSchema, fileSchema, createMethods }, { FileSources }, { MongoMemoryServer }, mongoose, { processDeleteRequest }, processDeleteRequest()

### Community 60 - "DeleteIconButton"
Cohesion: 0.29
Nodes (5): DeleteIconButton(), DeleteIconButtonProps, tempFile, tempThreads, tempVectorStoresAttached

### Community 61 - "FileDashboardView"
Cohesion: 0.32
Nodes (4): VectorStoreButton(), VectorStoreButtonProps, fakeVectorStores, VectorStoreSidePanel()

### Community 62 - "axios"
Cohesion: 0.29
Nodes (7): axios, createDownloadFallback(), finalizePreview(), getSessionInfo(), processCodeOutput(), readSandboxFile(), execCodeFor()

### Community 63 - "projectContext"
Cohesion: 0.43
Nodes (5): IProjectMemory, loadProjectFileIds(), loadProjectInstructions(), loadProjectMemories(), UserMemoryEntry

### Community 64 - "index tenant test"
Cohesion: 0.33
Nodes (4): express, fs, { getTenantId, tenantStorage: mockTenantStorage }, request

### Community 66 - "VectorStoreList"
Cohesion: 0.40
Nodes (4): VectorStoreList(), VectorStoreListProps, VectorStoreListItem(), VectorStoreListItemProps

### Community 67 - "useFileHandling test"
Cohesion: 0.33
Nodes (5): mockConversation, mockInvalidateQueries, mockMutate, mockSetFilesLoading, mockShowToast

### Community 68 - "getSkill"
Cohesion: 0.33
Nodes (6): getSkill(), importSkill(), listSkillsWithFilters(), skillFile(), skillFiles(), skills()

### Community 69 - "index"
Cohesion: 0.40
Nodes (4): avatar, convert, encode, resize

### Community 71 - "adminConfigActive"
Cohesion: 0.50
Nodes (4): adminConfigActive(), adminConfigBase(), adminConfigByPrincipal(), adminConfigs()

### Community 72 - "file acl spec"
Cohesion: 0.50
Nodes (3): AgentToolResources, LeanAccessRole, LeanAclEntry

### Community 81 - "addTagToConversation"
Cohesion: 0.67
Nodes (3): addTagToConversation(), conversationTags(), conversationTagsList()

### Community 82 - "adminFunctionById"
Cohesion: 0.67
Nodes (3): adminFunctionById(), adminFunctions(), adminFunctionToggle()

### Community 83 - "adminGroupById"
Cohesion: 0.67
Nodes (3): adminGroupById(), adminGroupMembers(), adminGroups()

### Community 84 - "adminTenants"
Cohesion: 0.67
Nodes (3): adminTenants(), adminTenantStats(), adminTenantUsers()

### Community 85 - "agents"
Cohesion: 0.67
Nodes (3): agents(), cloneAgentToTenant(), revertAgentVersion()

### Community 86 - "buildQuery"
Cohesion: 0.67
Nodes (3): buildQuery(), conversations(), messages()

### Community 87 - "deleteCategory"
Cohesion: 0.67
Nodes (3): deleteCategory(), getCategories(), updateCategory()

### Community 88 - "memories"
Cohesion: 0.67
Nodes (3): memories(), memory(), memoryPreferences()

### Community 89 - "deleteSkill"
Cohesion: 0.67
Nodes (3): deleteSkill(), getSkill(), updateSkill()

## Knowledge Gaps
- **600 isolated node(s):** `axios`, `{ logger }`, `{ tool }`, `{ generateShortLivedToken }`, `{ Tools, EToolResources }` (+595 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **21 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `getStrategyFunctions()` connect `createSanitizedUploadWrapper` to `crud`, `documentParserStrategy`, `convert`, `crud`, `crud`, `process`, `vectorStrategy`, `crud`, `strategies`, `crud`, `enqueueDeleteOperation`?**
  _High betweenness centrality (0.255) - this node is a cross-community bridge._
- **Why does `FileSources` connect `createSanitizedUploadWrapper` to `files`?**
  _High betweenness centrality (0.218) - this node is a cross-community bridge._
- **Why does `documentParserStrategy()` connect `documentParserStrategy` to `createSanitizedUploadWrapper`, `strategies`?**
  _High betweenness centrality (0.055) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `getStrategyFunctions()` (e.g. with `strategies.js` and `FileSources`) actually correct?**
  _`getStrategyFunctions()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `axios`, `{ logger }`, `{ tool }` to the rest of the system?**
  _607 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `data service` be split into smaller, more focused modules?**
  _Cohesion score 0.008368200836820083 - nodes in this community are weakly interconnected._
- **Should `api endpoints` be split into smaller, more focused modules?**
  _Cohesion score 0.020833333333333332 - nodes in this community are weakly interconnected._