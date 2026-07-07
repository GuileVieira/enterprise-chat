# Graph Report - .  (2026-07-07)

## Corpus Check
- Corpus is ~33,304 words - fits in a single context window. You may not need a graph.

## Summary
- 730 nodes · 810 edges · 50 communities (40 shown, 10 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 30 edges (avg confidence: 0.57)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_data service|data service]]
- [[_COMMUNITY_api endpoints|api endpoints]]
- [[_COMMUNITY_permissions|permissions]]
- [[_COMMUNITY_files|files]]
- [[_COMMUNITY_files|files]]
- [[_COMMUNITY_fileAccess|fileAccess]]
- [[_COMMUNITY_projects|projects]]
- [[_COMMUNITY_permissions|permissions]]
- [[_COMMUNITY_access|access]]
- [[_COMMUNITY_context|context]]
- [[_COMMUNITY_getRole|getRole]]
- [[_COMMUNITY_projectById|projectById]]
- [[_COMMUNITY_project|project]]
- [[_COMMUNITY_files agents test|files agents test]]
- [[_COMMUNITY_ProjectsPanel|ProjectsPanel]]
- [[_COMMUNITY_deletePrompt|deletePrompt]]
- [[_COMMUNITY_project|project]]
- [[_COMMUNITY_assistants|assistants]]
- [[_COMMUNITY_createProject|createProject]]
- [[_COMMUNITY_canAccessPromptGroupResource|canAccessPromptGroupResource]]
- [[_COMMUNITY_canAccessPromptViaGroup|canAccessPromptViaGroup]]
- [[_COMMUNITY_useChatFunctions|useChatFunctions]]
- [[_COMMUNITY_projectContext|projectContext]]
- [[_COMMUNITY_canAccessAgentResource|canAccessAgentResource]]
- [[_COMMUNITY_canAccessProject|canAccessProject]]
- [[_COMMUNITY_ProjectDetailPage|ProjectDetailPage]]
- [[_COMMUNITY_getSkill|getSkill]]
- [[_COMMUNITY_deleteFiles|deleteFiles]]
- [[_COMMUNITY_ProjectPromptSnippets|ProjectPromptSnippets]]
- [[_COMMUNITY_adminConfigActive|adminConfigActive]]
- [[_COMMUNITY_file acl spec|file acl spec]]
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
- [[_COMMUNITY_file|file]]
- [[_COMMUNITY_promptGroup|promptGroup]]
- [[_COMMUNITY_deletePromptGroup|deletePromptGroup]]
- [[_COMMUNITY_postCategory|postCategory]]
- [[_COMMUNITY_postPrompt|postPrompt]]
- [[_COMMUNITY_updatePromptGroup|updatePromptGroup]]

## God Nodes (most connected - your core abstractions)
1. `getRole()` - 14 edges
2. `projectMetaAds()` - 13 edges
3. `prompts()` - 9 edges
4. `createProjectMethods()` - 7 edges
5. `fileAccess()` - 6 edges
6. `hasAccessToFilesViaAgent()` - 5 edges
7. `speech()` - 5 edges
8. `images()` - 4 edges
9. `textToSpeech()` - 4 edges
10. `getPrompt()` - 4 edges

## Surprising Connections (you probably didn't know these)
- `createProjectMethods()` --indirect_call--> `getProjects()`  [INFERRED]
  packages/data-schemas/src/methods/project.ts → packages/data-provider/src/data-service.ts
- `createProjectMethods()` --indirect_call--> `getProjectById()`  [INFERRED]
  packages/data-schemas/src/methods/project.ts → packages/data-provider/src/data-service.ts
- `createProjectMethods()` --indirect_call--> `createProject()`  [INFERRED]
  packages/data-schemas/src/methods/project.ts → packages/data-provider/src/data-service.ts
- `createProjectMethods()` --indirect_call--> `updateProject()`  [INFERRED]
  packages/data-schemas/src/methods/project.ts → packages/data-provider/src/data-service.ts
- `createProjectMethods()` --indirect_call--> `deleteProject()`  [INFERRED]
  packages/data-schemas/src/methods/project.ts → packages/data-provider/src/data-service.ts

## Import Cycles
- None detected.

## Communities (50 total, 10 thin omitted)

### Community 2 - "permissions"
Cohesion: 0.05
Nodes (40): agentPermissionsSchema, bookmarkPermissionsSchema, fileCitationsPermissionsSchema, fileSearchPermissionsSchema, INTERFACE_PERMISSION_FIELDS, marketplacePermissionsSchema, mcpServersPermissionsSchema, memoryPermissionsSchema (+32 more)

### Community 3 - "files"
Cohesion: 0.09
Nodes (20): { checkPermission }, { cleanFileName, getContentDisposition }, db, DOWNLOAD_METADATA_FIELDS, { EnvVar }, express, { fileAccess }, {
  filterFile,
  processFileUpload,
  processDeleteRequest,
  processAgentFileUpload,
} (+12 more)

### Community 4 - "files"
Cohesion: 0.09
Nodes (21): AvatarUploadResponse, BatchFile, DeleteFilesBody, DeleteFilesResponse, DeleteMutationOptions, EndpointFileConfig, FileConfig, FileConfigInput (+13 more)

### Community 5 - "fileAccess"
Cohesion: 0.13
Nodes (18): checkAgentBasedFileAccess(), checkProjectBasedFileAccess(), denyFileAccess(), fileAccess(), { findProjectForRequest }, { getAgents, getFiles }, { getEffectivePermissions }, getTenantId() (+10 more)

### Community 6 - "projects"
Cohesion: 0.10
Nodes (17): {
  canAccessProjectResource,
}, { checkPermission }, checkProjectAccess, checkProjectCreate, express, {
  findProjectForRequest,
  ensureTenantUsersProjectViewAccess,
}, { generateCheckAccess }, {
  getProjects,
  getProjectById,
  findProjectById,
  createProject,
  updateProject,
  deleteProject,
  archiveProject,
  getUserPrincipals,
  findAccessibleResources,
  deleteAclEntries,
  getRoleByName,
  getFiles,
} (+9 more)

### Community 7 - "permissions"
Cohesion: 0.13
Nodes (15): { checkPermission, getEffectivePermissions }, filterFilesByAgentAccess(), { findProjectForRequest }, { getAgent, getFiles, getUserById }, getAttachedFileIds(), getFilesById(), hasAccessToFilesViaAgent(), { logger } (+7 more)

### Community 8 - "access"
Cohesion: 0.16
Nodes (9): { checkPermission }, findProjectForRequest(), isObjectId(), mongoose, projectIdentityFilter(), {
  ResourceType,
  PermissionBits,
  PrincipalType,
  AccessRoleIds,
}, { runAsSystem }, { tenantMatches } (+1 more)

### Community 9 - "context"
Cohesion: 0.14
Nodes (14): { checkPermission }, db, emptyProjectContext(), loadProjectContext(), { loadProjectMemories }, { logger, runAsSystem }, { ResourceType, PermissionBits }, { loadProjectContext } (+6 more)

### Community 10 - "getRole"
Cohesion: 0.14
Nodes (14): getRole(), roles(), updateAgentPermissions(), updateFileCitationsPermissions(), updateFileSearchPermissions(), updateMarketplacePermissions(), updateMCPServersPermissions(), updateMemoryPermissions() (+6 more)

### Community 11 - "projectById"
Cohesion: 0.15
Nodes (13): projectById(), projectMetaAds(), projectMetaAdsApply(), projectMetaAdsBudget(), projectMetaAdsDuplicate(), projectMetaAdsEntityStatus(), projectMetaAdsPerformance(), projectMetaAdsRankings() (+5 more)

### Community 12 - "project"
Cohesion: 0.15
Nodes (12): ProjectMemorySchema, ProjectMetaAdsClientGoalSchema, ProjectMetaAdsCreativeRulesSchema, ProjectMetaAdsMonthlyBudgetSchema, ProjectMetaAdsRuleAuditSchema, ProjectMetaAdsRuleAuditUserSchema, ProjectMetaAdsRuleGroupSchema, ProjectMetaAdsRuleOverrideSchema (+4 more)

### Community 13 - "files agents test"
Cohesion: 0.18
Nodes (10): { createAgent, createFile }, { createMethods, SystemCapabilities }, express, { MongoMemoryServer }, mongoose, { processAgentFileUpload }, request, router (+2 more)

### Community 14 - "ProjectsPanel"
Cohesion: 0.22
Nodes (7): createQueryClient(), mockNavigate, mockNavigateToConvo, mockNewConversation, mockSelectedProjectObserver, renderPanel(), SelectedProjectObserver()

### Community 15 - "deletePrompt"
Cohesion: 0.18
Nodes (11): deletePrompt(), getAllPromptGroups(), getPrompt(), getPromptGroup(), getPromptGroupsWithFilters(), getPromptsWithFilters(), getRandomPrompts(), prompts() (+3 more)

### Community 16 - "project"
Cohesion: 0.18
Nodes (10): IProject, IProjectMemory, IProjectMetaAds, IProjectMetaAdsCreativeRules, IProjectMetaAdsMonthlyBudget, IProjectMetaAdsMonthlyBudgets, IProjectMetaAdsRuleAudit, IProjectMetaAdsRuleAuditUser (+2 more)

### Community 17 - "assistants"
Cohesion: 0.20
Nodes (10): assistants(), avatar(), files(), getCustomConfigSpeech(), images(), speech(), speechToText(), textToSpeech() (+2 more)

### Community 18 - "createProject"
Cohesion: 0.22
Nodes (8): createProject(), deleteProject(), getProjectById(), getProjects(), updateProject(), createProjectMethods(), ProjectDeps, ProjectMethods

### Community 19 - "canAccessPromptGroupResource"
Cohesion: 0.28
Nodes (8): canAccessPromptGroupResource(), { canAccessResource }, { getPromptGroup }, mongoose, resolveProjectInheritance(), resolvePromptGroupId(), { ResourceType }, { runAsSystem }

### Community 20 - "canAccessPromptViaGroup"
Cohesion: 0.28
Nodes (8): canAccessPromptViaGroup(), { canAccessResource }, { getPrompt }, mongoose, resolveProjectInheritance(), resolvePromptToGroupId(), { ResourceType }, { runAsSystem }

### Community 21 - "useChatFunctions"
Cohesion: 0.32
Nodes (6): logChatRequest(), mockNavigate, mockResetLatestMultiMessage, mockSetFilesToDelete, mockSetShowStopButton, useChatFunctions()

### Community 22 - "projectContext"
Cohesion: 0.43
Nodes (5): IProjectMemory, loadProjectFileIds(), loadProjectInstructions(), loadProjectMemories(), UserMemoryEntry

### Community 23 - "canAccessAgentResource"
Cohesion: 0.40
Nodes (5): canAccessAgentResource(), { canAccessResource }, { getAgent }, resolveAgentId(), { ResourceType }

### Community 24 - "canAccessProject"
Cohesion: 0.40
Nodes (5): canAccessProjectResource(), { canAccessResource }, { findProjectForRequest }, resolveProjectId(), { ResourceType }

### Community 25 - "ProjectDetailPage"
Cohesion: 0.40
Nodes (5): isProjectTab(), ProjectDetailPage(), Tab, tabIcons, tabs

### Community 26 - "getSkill"
Cohesion: 0.33
Nodes (6): getSkill(), importSkill(), listSkillsWithFilters(), skillFile(), skillFiles(), skills()

### Community 27 - "deleteFiles"
Cohesion: 0.40
Nodes (4): deleteFiles(), getFiles(), createFileMethods(), FileMethods

### Community 28 - "ProjectPromptSnippets"
Cohesion: 0.50
Nodes (3): ProjectPromptSnippets, ProjectPromptSnippetsProps, PromptSnippet

### Community 29 - "adminConfigActive"
Cohesion: 0.50
Nodes (4): adminConfigActive(), adminConfigBase(), adminConfigByPrincipal(), adminConfigs()

### Community 30 - "file acl spec"
Cohesion: 0.50
Nodes (3): AgentToolResources, LeanAccessRole, LeanAclEntry

### Community 31 - "addTagToConversation"
Cohesion: 0.67
Nodes (3): addTagToConversation(), conversationTags(), conversationTagsList()

### Community 32 - "adminFunctionById"
Cohesion: 0.67
Nodes (3): adminFunctionById(), adminFunctions(), adminFunctionToggle()

### Community 33 - "adminGroupById"
Cohesion: 0.67
Nodes (3): adminGroupById(), adminGroupMembers(), adminGroups()

### Community 34 - "adminTenants"
Cohesion: 0.67
Nodes (3): adminTenants(), adminTenantStats(), adminTenantUsers()

### Community 35 - "agents"
Cohesion: 0.67
Nodes (3): agents(), cloneAgentToTenant(), revertAgentVersion()

### Community 36 - "buildQuery"
Cohesion: 0.67
Nodes (3): buildQuery(), conversations(), messages()

### Community 37 - "deleteCategory"
Cohesion: 0.67
Nodes (3): deleteCategory(), getCategories(), updateCategory()

### Community 38 - "memories"
Cohesion: 0.67
Nodes (3): memories(), memory(), memoryPreferences()

### Community 39 - "deleteSkill"
Cohesion: 0.67
Nodes (3): deleteSkill(), getSkill(), updateSkill()

## Knowledge Gaps
- **214 isolated node(s):** `{ ResourceType }`, `{ canAccessResource }`, `{ getAgent }`, `{ ResourceType }`, `{ canAccessResource }` (+209 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **10 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `getFiles()` connect `deleteFiles` to `data service`?**
  _High betweenness centrality (0.003) - this node is a cross-community bridge._
- **Are the 5 inferred relationships involving `createProjectMethods()` (e.g. with `createProject()` and `deleteProject()`) actually correct?**
  _`createProjectMethods()` has 5 INFERRED edges - model-reasoned connections that need verification._
- **What connects `{ ResourceType }`, `{ canAccessResource }`, `{ getAgent }` to the rest of the system?**
  _214 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `data service` be split into smaller, more focused modules?**
  _Cohesion score 0.008547008547008548 - nodes in this community are weakly interconnected._
- **Should `api endpoints` be split into smaller, more focused modules?**
  _Cohesion score 0.020833333333333332 - nodes in this community are weakly interconnected._
- **Should `permissions` be split into smaller, more focused modules?**
  _Cohesion score 0.04878048780487805 - nodes in this community are weakly interconnected._
- **Should `files` be split into smaller, more focused modules?**
  _Cohesion score 0.08695652173913043 - nodes in this community are weakly interconnected._