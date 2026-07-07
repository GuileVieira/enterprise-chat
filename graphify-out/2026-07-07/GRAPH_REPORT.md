# Graph Report - .  (2026-07-07)

## Corpus Check
- 84 files · ~94,293 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1601 nodes · 3033 edges · 75 communities (64 shown, 11 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 76 edges (avg confidence: 0.52)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Shared Data Service|Shared Data Service]]
- [[_COMMUNITY_Project Zod Schemas|Project Zod Schemas]]
- [[_COMMUNITY_Shared Query Types|Shared Query Types]]
- [[_COMMUNITY_API Endpoint Builders|API Endpoint Builders]]
- [[_COMMUNITY_Meta Graph Client|Meta Graph Client]]
- [[_COMMUNITY_Meta Ads API Routes|Meta Ads API Routes]]
- [[_COMMUNITY_Permission Schemas|Permission Schemas]]
- [[_COMMUNITY_Meta Ads Backend Engine|Meta Ads Backend Engine]]
- [[_COMMUNITY_Frontend Mutations|Frontend Mutations]]
- [[_COMMUNITY_Meta Ads Formatting|Meta Ads Formatting]]
- [[_COMMUNITY_Budget Recommendation Core|Budget Recommendation Core]]
- [[_COMMUNITY_Ad Preview Rendering|Ad Preview Rendering]]
- [[_COMMUNITY_Overview State Tables|Overview State Tables]]
- [[_COMMUNITY_Rule Dialog Fields|Rule Dialog Fields]]
- [[_COMMUNITY_Meta Ads Query Cache|Meta Ads Query Cache]]
- [[_COMMUNITY_BI Ranking Dialogs|BI Ranking Dialogs]]
- [[_COMMUNITY_Rule Performance Aggregation|Rule Performance Aggregation]]
- [[_COMMUNITY_BI Ranking Logic|BI Ranking Logic]]
- [[_COMMUNITY_Rules Hook State|Rules Hook State]]
- [[_COMMUNITY_Campaign Snapshot Builder|Campaign Snapshot Builder]]
- [[_COMMUNITY_Draft Confirmation Dialogs|Draft Confirmation Dialogs]]
- [[_COMMUNITY_Meta Ads UI Primitives|Meta Ads UI Primitives]]
- [[_COMMUNITY_Goal Progress Helpers|Goal Progress Helpers]]
- [[_COMMUNITY_BI Workspace Adapter|BI Workspace Adapter]]
- [[_COMMUNITY_Evolution Views|Evolution Views]]
- [[_COMMUNITY_Creative Asset Mapping|Creative Asset Mapping]]
- [[_COMMUNITY_Budget Editor Rules UI|Budget Editor Rules UI]]
- [[_COMMUNITY_Dialogs Selection Layer|Dialogs Selection Layer]]
- [[_COMMUNITY_Settings Sanitizer|Settings Sanitizer]]
- [[_COMMUNITY_Run Analysis UI|Run Analysis UI]]
- [[_COMMUNITY_Evolution Dashboard|Evolution Dashboard]]
- [[_COMMUNITY_Draft Settings Persistence|Draft Settings Persistence]]
- [[_COMMUNITY_Role Update Client|Role Update Client]]
- [[_COMMUNITY_Trend Aggregation|Trend Aggregation]]
- [[_COMMUNITY_Overview Adapter|Overview Adapter]]
- [[_COMMUNITY_Settings Drawer|Settings Drawer]]
- [[_COMMUNITY_Meta Ads Endpoints|Meta Ads Endpoints]]
- [[_COMMUNITY_Project Mongo Schema|Project Mongo Schema]]
- [[_COMMUNITY_Period Controls|Period Controls]]
- [[_COMMUNITY_Meta Ads Constants|Meta Ads Constants]]
- [[_COMMUNITY_Rule Audit History|Rule Audit History]]
- [[_COMMUNITY_deletePrompt|deletePrompt]]
- [[_COMMUNITY_Effective Rules Validation|Effective Rules Validation]]
- [[_COMMUNITY_Error Run Hook|Error Run Hook]]
- [[_COMMUNITY_Entity Action Hook|Entity Action Hook]]
- [[_COMMUNITY_Overview Rows Table|Overview Rows Table]]
- [[_COMMUNITY_assistants|assistants]]
- [[_COMMUNITY_History Panel|History Panel]]
- [[_COMMUNITY_Traffic Agent Hook|Traffic Agent Hook]]
- [[_COMMUNITY_AI Performance Workspace|AI Performance Workspace]]
- [[_COMMUNITY_Overview Workspace|Overview Workspace]]
- [[_COMMUNITY_Recommendations Panel|Recommendations Panel]]
- [[_COMMUNITY_Project Detail Mount|Project Detail Mount]]
- [[_COMMUNITY_Production Config Meta Ads|Production Config Meta Ads]]
- [[_COMMUNITY_getSkill|getSkill]]
- [[_COMMUNITY_useMetaAdsPeriodFilter|useMetaAdsPeriodFilter]]
- [[_COMMUNITY_adminConfigActive|adminConfigActive]]
- [[_COMMUNITY_addTagToConversation|addTagToConversation]]
- [[_COMMUNITY_adminFunctionById|adminFunctionById]]
- [[_COMMUNITY_adminGroupById|adminGroupById]]
- [[_COMMUNITY_adminTenants|adminTenants]]
- [[_COMMUNITY_agents|agents]]
- [[_COMMUNITY_buildQuery|buildQuery]]
- [[_COMMUNITY_deleteCategory|deleteCategory]]
- [[_COMMUNITY_memories|memories]]
- [[_COMMUNITY_deleteSkill|deleteSkill]]
- [[_COMMUNITY_BedrockProviders|BedrockProviders]]
- [[_COMMUNITY_useDeleteConversationTagMutation|useDeleteConversationTagMutation]]
- [[_COMMUNITY_useTagConversationMutation|useTagConversationMutation]]
- [[_COMMUNITY_adminSecretByName|adminSecretByName]]
- [[_COMMUNITY_adminUsers|adminUsers]]
- [[_COMMUNITY_deletePromptGroup|deletePromptGroup]]
- [[_COMMUNITY_postCategory|postCategory]]
- [[_COMMUNITY_postPrompt|postPrompt]]
- [[_COMMUNITY_updatePromptGroup|updatePromptGroup]]

## God Nodes (most connected - your core abstractions)
1. `formatMoney()` - 52 edges
2. `Localize` - 37 edges
3. `analyzeProject()` - 34 edges
4. `formatMetric()` - 33 edges
5. `getProjectMetaAdsStatus()` - 26 edges
6. `getResultTypeLabel()` - 23 edges
7. `getObjectiveLabel()` - 20 edges
8. `calculateMetrics()` - 18 edges
9. `ProjectMetaAdsPanel()` - 17 edges
10. `getProjectMetaAdsRankings()` - 15 edges

## Surprising Connections (you probably didn't know these)
- `useMetaAdsOverviewAdapter()` --indirect_call--> `formatMetric()`  [INFERRED]
  client/src/components/Project/metaAds/hooks/useMetaAdsOverviewAdapter.tsx → client/src/components/Project/metaAds/formatters.ts
- `ProjectMetaAdsPanel()` --calls--> `useMetaAdsBiAdapter()`  [EXTRACTED]
  client/src/components/Project/ProjectMetaAdsPanel.tsx → client/src/components/Project/metaAds/hooks/useMetaAdsBiAdapter.tsx
- `ProjectMetaAdsPanel()` --calls--> `useMetaAdsBiWorkspace()`  [EXTRACTED]
  client/src/components/Project/ProjectMetaAdsPanel.tsx → client/src/components/Project/metaAds/hooks/useMetaAdsBiWorkspace.ts
- `ProjectMetaAdsPanel()` --calls--> `useMetaAdsEntityActions()`  [EXTRACTED]
  client/src/components/Project/ProjectMetaAdsPanel.tsx → client/src/components/Project/metaAds/hooks/useMetaAdsEntityActions.ts
- `ProjectMetaAdsPanel()` --calls--> `useMetaAdsOverviewAdapter()`  [EXTRACTED]
  client/src/components/Project/ProjectMetaAdsPanel.tsx → client/src/components/Project/metaAds/hooks/useMetaAdsOverviewAdapter.tsx

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Meta Ads Feature Surface** — config_librechat_prod_meta_ads_tools, config_librechat_prod_meta_ads_interface, config_librechat_prod_commented_meta_ads_mcp_server [INFERRED 0.85]

## Communities (75 total, 11 thin omitted)

### Community 1 - "Project Zod Schemas"
Cohesion: 0.02
Nodes (97): AgentProvider, agentsBaseSchema, agentsSchema, agentsSettings, ANTHROPIC_MAX_OUTPUT, anthropicBaseSchema, AnthropicEffort, anthropicSchema (+89 more)

### Community 2 - "Shared Query Types"
Cohesion: 0.02
Nodes (104): AccessRole, AccessRolesResponse, AdminConfig, AdminConfigListResponse, AdminConfigResponse, AdminGroup, AdminOverviewResponse, AdminUser (+96 more)

### Community 4 - "Meta Graph Client"
Cohesion: 0.06
Nodes (72): addActionValues(), addUtcDays(), aggregateInsightRows(), centsToDailyBudget(), clearMetaGraphReadCacheForTests(), copyMetaEntity(), createMetaGraphError(), createMetaGraphTimeoutError() (+64 more)

### Community 5 - "Meta Ads API Routes"
Cohesion: 0.06
Nodes (47): ACCOUNT_PROFILES, ANALYSIS_PRESETS, {
  analyzeProject,
  applyManualBudgetChange,
  applyRecommendation,
  duplicateProjectMetaAdsEntity,
  getProjectMetaAdsPerformance,
  getProjectMetaAdsRankings,
  getProjectMetaAdsRuleHistory,
  getProjectMetaAdsRulePerformance,
  getProjectMetaAdsStatus,
  recordProjectMetaAdsRuleChange,
  updateProjectMetaAdsEntityStatus,
}, applyMetaAdsRuleAudit(), buildRuleAudit(), {
  canAccessProjectResource,
}, CREATIVE_RULE_LIMITS, DEFAULT_CREATIVE_RULES (+39 more)

### Community 6 - "Permission Schemas"
Cohesion: 0.06
Nodes (46): agentPermissionsSchema, bookmarkPermissionsSchema, fileCitationsPermissionsSchema, fileSearchPermissionsSchema, INTERFACE_PERMISSION_FIELDS, marketplacePermissionsSchema, mcpServersPermissionsSchema, memoryPermissionsSchema (+38 more)

### Community 7 - "Meta Ads Backend Engine"
Cohesion: 0.07
Nodes (42): ACTION_COOLDOWN_MINUTES, addResultTypeSummary(), ANALYSIS_PRESETS, buildRuleItemChanges(), CANONICAL_RESULT_TYPES, {
  copyMetaEntity,
  getAdAccountCurrency,
  getEntityDailyBudget,
  getMetaGraphVersion,
  isSupportedMetaGraphVersion,
  listAds,
  listAdInsights,
  listCampaignInsights,
  listCampaigns,
  listAdSetInsights,
  listAdSets,
  metaPost,
  updateMetaEntityName,
  updateMetaEntityStatus,
}, createResultTypeSummaryItem(), CREATIVE_RULE_LIMITS (+34 more)

### Community 9 - "Meta Ads Formatting"
Cohesion: 0.12
Nodes (36): formatMetric(), formatMoney(), getRuleTargetMetric(), getRuleTargetMetricValue(), buildBiReportCards(), buildMetaAdsSummaryCardItems(), getMonthlyBudgetContext(), createRuleRowFromPerformance() (+28 more)

### Community 10 - "Budget Recommendation Core"
Cohesion: 0.11
Nodes (33): aggregateInsightRows(), analyzeProject(), applyManualBudgetChange(), applyMonthlyBudgetGuard(), applyRecommendation(), calculateBudgetDelta(), dailyBudgetToCents(), DEFAULT_RULES (+25 more)

### Community 11 - "Ad Preview Rendering"
Cohesion: 0.13
Nodes (28): getAdThumbnailUrl(), AdPreviewMedia(), formatIntegerMetric(), MetaAdsOverviewActionCell(), createMetaAdsAdRenderers(), metricCell(), renderAdCell(), textCell() (+20 more)

### Community 12 - "Overview State Tables"
Cohesion: 0.13
Nodes (29): ecommerceTableViewColumns, tableViewColumns, buildMetaAdsOverviewState(), buildVisibleCampaignSummary(), calculateConversionValue(), filterAndSortCampaigns(), getScopedObjectiveSummary(), getSummaryMetricContext() (+21 more)

### Community 13 - "Rule Dialog Fields"
Cohesion: 0.09
Nodes (28): RuleFieldLabel(), analysisPresetOptions, getCreativeRuleNumberMin(), getInvalidInputClassName(), getNumberErrorKey(), getRuleNumberMax(), getRuleNumberMin(), GuardrailKey (+20 more)

### Community 14 - "Meta Ads Query Cache"
Cohesion: 0.07
Nodes (6): CachedProjectMetaAdsStatus, getProjectMetaAdsStatusCacheKey(), isProjectMetaAdsStatus(), readCachedProjectMetaAdsStatus(), useProjectMetaAdsQuery(), writeCachedProjectMetaAdsStatus()

### Community 15 - "BI Ranking Dialogs"
Cohesion: 0.16
Nodes (20): cleanRankName(), getSortIndicator(), MetaAdsBiRankingCard(), sortColumns, getAdPreviewFields(), getAdPreviewMetrics(), getBiRankDetails(), getBiRankLevelLabel() (+12 more)

### Community 16 - "Rule Performance Aggregation"
Cohesion: 0.15
Nodes (25): averageMetric(), buildEntityStatusSummary(), buildPerformanceSummary(), buildRulePerformanceEntities(), getActionPrimaryMetric(), getAwaitableRuleStatus(), getComparableMetricValue(), getConversionEvidence() (+17 more)

### Community 17 - "BI Ranking Logic"
Cohesion: 0.19
Nodes (20): buildMetaAdsBiRankings(), collectAdThumbnails(), getBiRankingNumericValue(), getRankEfficiency(), getRankMetricForResultType(), getSortedBiRankingItems(), hasRelevantRankVolume(), hasValidRankMetric() (+12 more)

### Community 18 - "Rules Hook State"
Cohesion: 0.19
Nodes (19): CreativeRuleChangeKey, ShowToast, ToastStatus, useMetaAdsRules(), UseMetaAdsRulesParams, accountProfileRules, getRuleOverrideKey(), hasRulePerformanceMetric() (+11 more)

### Community 19 - "Campaign Snapshot Builder"
Cohesion: 0.13
Nodes (21): AGGREGATE_RESULT_TYPES, buildCampaignSummaries(), buildCreativePauseRecommendations(), buildSnapshotsFromInsights(), calculateMetrics(), calculateRoas(), canonicalizeMetaActionType(), centsToDailyBudget() (+13 more)

### Community 20 - "Draft Confirmation Dialogs"
Cohesion: 0.15
Nodes (13): ConfirmationButtons, ConfirmationChrome, MetaAdsDiscardDraftDialog(), MetaAdsDuplicateEntityDialog(), MetaAdsEntityStatusConfirmationBanner(), MetaAdsPublishDraftDialog(), MetaAdsCredentialsDialog(), MetaAdsDialogChrome (+5 more)

### Community 21 - "Meta Ads UI Primitives"
Cohesion: 0.10
Nodes (16): badgeClassNames, BadgeVariant, buttonClassNames, ButtonVariant, MetaAdsActionMenuButtonProps, MetaAdsBadgeProps, MetaAdsButtonProps, MetaAdsFieldProps (+8 more)

### Community 22 - "Goal Progress Helpers"
Cohesion: 0.16
Nodes (20): addDays(), buildAdDiagnostics(), buildGoalProgress(), buildMonthlyBudgetState(), buildMonthlyBudgetStatus(), buildProgressItem(), calculateRoasProgress(), countAttachedAds() (+12 more)

### Community 23 - "BI Workspace Adapter"
Cohesion: 0.16
Nodes (15): MetaAdsBiControlsPanel(), MetaAdsBiWorkspace(), MetaAdsBiWorkspaceProps, metaAdsInput, cleanDashboardName(), filterBiRankingItems(), getCampaignResultMetrics(), MetaAdsBiWorkspaceProps (+7 more)

### Community 24 - "Evolution Views"
Cohesion: 0.25
Nodes (13): getDeltaEntityId(), getDeltaEntityName(), getEvolutionSeriesTotal(), hasMeaningfulDelta(), matchesBiSeriesFilters(), getEvolutionDeltaClass(), MetaAdsEvolutionDeltaTables(), buildMetaAdsEvolutionState() (+5 more)

### Community 25 - "Creative Asset Mapping"
Cohesion: 0.17
Nodes (16): buildAdsManagerUrl(), buildAdSummaries(), getAssetFeedCallToActionType(), getAssetFeedLinkUrl(), getAssetFeedMediaUrl(), getAssetFeedValue(), getAssetFeedVideoId(), getCreativeLinkData() (+8 more)

### Community 26 - "Budget Editor Rules UI"
Cohesion: 0.17
Nodes (13): BudgetEditorChrome, BudgetEditorControls, MetaAdsBudgetEditorDialog(), buildBudgetReferences(), BudgetEditor, EntityStatusConfirmation, MetaAdsAd, MetaAdsAdSet (+5 more)

### Community 27 - "Dialogs Selection Layer"
Cohesion: 0.19
Nodes (13): metaAdsInputLg, metaAdsLabel, metaAdsModalTile, metaAdsPrimaryButton, MetaAdsDialogsLayer(), useMetaAdsSelection(), UseMetaAdsSelectionInput, useMetaAdsTableScrollSync() (+5 more)

### Community 28 - "Settings Sanitizer"
Cohesion: 0.27
Nodes (13): getGraphVersionOptions(), isSupportedGraphVersion(), MonthlyBudgetResolution, MonthlyBudgetValues, normalizeSettings(), resolveMonthlyBudgetForMonth(), sanitizeMetaAdsEditableSettings(), stripMetaAdsCreativeCooldown() (+5 more)

### Community 29 - "Run Analysis UI"
Cohesion: 0.18
Nodes (12): workspaceTabOptions, Localize, MetaAdsRunAnalysisButton(), MetaAdsRunAnalysisButtonProps, MetaAdsRunAnalysisStatus(), MetaAdsDraftStatus, MetaAdsDraftSummaryItem, WorkspaceTab (+4 more)

### Community 30 - "Evolution Dashboard"
Cohesion: 0.22
Nodes (12): EvolutionPoint, EvolutionSeriesPath, EvolutionTooltip(), getEvolutionTooltipTransform(), MetaAdsEvolutionDashboard(), formatEvolutionMetricValue(), formatTrendDate(), getEvolutionMetricLabel() (+4 more)

### Community 31 - "Draft Settings Persistence"
Cohesion: 0.24
Nodes (13): buildManualBudgetDraftDetails(), clearStoredSettingsDraft(), getManualBudgetDraftKey(), getManualBudgetDraftStorageKey(), getSettingsDraftStorageKey(), readStoredManualBudgetDrafts(), ShowToast, ToastStatus (+5 more)

### Community 32 - "Role Update Client"
Cohesion: 0.14
Nodes (14): getRole(), roles(), updateAgentPermissions(), updateFileCitationsPermissions(), updateFileSearchPermissions(), updateMarketplacePermissions(), updateMCPServersPermissions(), updateMemoryPermissions() (+6 more)

### Community 33 - "Trend Aggregation"
Cohesion: 0.23
Nodes (13): addFrequencySample(), addSourceResultTypeSummaries(), buildAdSeriesFromInsights(), buildCampaignMetadata(), buildCampaignTrend(), buildDashboardSummary(), buildEvolutionDelta(), buildObjectiveSummary() (+5 more)

### Community 34 - "Overview Adapter"
Cohesion: 0.21
Nodes (11): metaAdsButton, metaAdsGhostButton, getGoalProgressContext(), MetaAdsOverviewWorkspaceProps, useMetaAdsOverviewAdapter(), UseMetaAdsOverviewAdapterParams, getMetaAdsTableRowClass(), getNextMetaAdsSortDirection() (+3 more)

### Community 35 - "Settings Drawer"
Cohesion: 0.26
Nodes (12): getAdAccountDigits(), toAdAccountId(), formatMonthLabel(), formatMonthValue(), getCurrentMonthValue(), MetaAdsSettingsDrawer(), monthLabels, ParsedMonth (+4 more)

### Community 36 - "Meta Ads Endpoints"
Cohesion: 0.15
Nodes (13): projectById(), projectMetaAds(), projectMetaAdsApply(), projectMetaAdsBudget(), projectMetaAdsDuplicate(), projectMetaAdsEntityStatus(), projectMetaAdsPerformance(), projectMetaAdsRankings() (+5 more)

### Community 37 - "Project Mongo Schema"
Cohesion: 0.15
Nodes (12): ProjectMemorySchema, ProjectMetaAdsClientGoalSchema, ProjectMetaAdsCreativeRulesSchema, ProjectMetaAdsMonthlyBudgetSchema, ProjectMetaAdsRuleAuditSchema, ProjectMetaAdsRuleAuditUserSchema, ProjectMetaAdsRuleGroupSchema, ProjectMetaAdsRuleOverrideSchema (+4 more)

### Community 38 - "Period Controls"
Cohesion: 0.27
Nodes (8): tableViewOptions, MetaAdsPeriodControls(), MetaAdsBiRankLevel, PeriodFilter, TableView, MetaAdsField(), MetaAdsInput, MetaAdsSelect

### Community 39 - "Meta Ads Constants"
Cohesion: 0.18
Nodes (10): evolutionColors, objectiveLabelKeys, periodFilterOptions, resultTypeLabelKeys, scheduleOptions, tableColumnMap, tableViewMinWidth, DatePreset (+2 more)

### Community 40 - "Rule Audit History"
Cohesion: 0.29
Nodes (8): formatRuleAuditDate(), formatRuleAuditLine(), formatRuleAuditUser(), formatRuleChangeAction(), formatChangedFields(), formatRuleChangeDate(), MetaAdsRuleHistoryPanel(), MetaAdsRuleAudit

### Community 41 - "deletePrompt"
Cohesion: 0.18
Nodes (11): deletePrompt(), getAllPromptGroups(), getPrompt(), getPromptGroup(), getPromptGroupsWithFilters(), getPromptsWithFilters(), getRandomPrompts(), prompts() (+3 more)

### Community 42 - "Effective Rules Validation"
Cohesion: 0.24
Nodes (10): findRuleGroup(), getEffectiveRuleContext(), getEffectiveRules(), mergeRules(), validateEnabledSections(), validateMetaAdsCreativeRules(), validateMetaAdsRules(), validateNoResultSpendCap() (+2 more)

### Community 43 - "Error Run Hook"
Cohesion: 0.31
Nodes (8): formatRequestDetails(), getNumberField(), getRequestErrorMessage(), getStringField(), ToastStatus, useMetaAdsRunAnalysis(), UseMetaAdsRunAnalysisParams, RequestError

### Community 44 - "Entity Action Hook"
Cohesion: 0.29
Nodes (9): EntityStatusConfirmation, formatDailyBudgetInput(), getDuplicateName(), parseDailyBudgetInput(), ShowToast, ToastStatus, useMetaAdsEntityActions(), UseMetaAdsEntityActionsParams (+1 more)

### Community 45 - "Overview Rows Table"
Cohesion: 0.31
Nodes (8): getCampaignExpanded(), OverviewRowsProps, renderOverviewRows(), getHeaderStickyClass(), MetaAdsOverviewTable(), MetaAdsOverviewTableProps, renderHeaderContent(), SortableHeaderArgs

### Community 46 - "assistants"
Cohesion: 0.20
Nodes (10): assistants(), avatar(), files(), getCustomConfigSpeech(), images(), speech(), speechToText(), textToSpeech() (+2 more)

### Community 47 - "History Panel"
Cohesion: 0.43
Nodes (6): formatSignedMoney(), formatSignedPercent(), formatChangeDateTime(), getBudgetChangeVisual(), MetaAdsHistoryPanel(), getBudgetChangeDelta()

### Community 48 - "Traffic Agent Hook"
Cohesion: 0.38
Nodes (5): createMetaAdsBriefStorageKey(), MetaAdsStatusData, StartupConfigQuery, useMetaAdsTrafficAgent(), UseMetaAdsTrafficAgentInput

### Community 49 - "AI Performance Workspace"
Cohesion: 0.40
Nodes (5): formatActionDateTime(), MetaAdsAiPerformanceWorkspace(), MetaAdsPeriodControlProps, MetaAdsMetricCard(), MetaAdsPanel()

### Community 50 - "Overview Workspace"
Cohesion: 0.40
Nodes (5): MetaAdsOverviewToolbar(), MetaAdsOverviewWorkspace(), MetaAdsOverviewWorkspaceProps, renderSortableHeader(), SortableHeaderArgs

### Community 51 - "Recommendations Panel"
Cohesion: 0.60
Nodes (4): MetaAdsPendingRecommendationsPanel(), MetaAdsPendingRecommendationsPanelProps, canApplyRecommendation(), getRecommendationLabel()

### Community 52 - "Project Detail Mount"
Cohesion: 0.40
Nodes (5): isProjectTab(), ProjectDetailPage(), Tab, tabIcons, tabs

### Community 53 - "Production Config Meta Ads"
Cohesion: 0.40
Nodes (6): Commented Meta Ads MCP Server, Included Tools, Interface, LibreChat Production Config, Meta Ads Interface, Meta Ads Tools

### Community 54 - "getSkill"
Cohesion: 0.33
Nodes (6): getSkill(), importSkill(), listSkillsWithFilters(), skillFile(), skillFiles(), skills()

### Community 55 - "useMetaAdsPeriodFilter"
Cohesion: 1.00
Nodes (3): useMetaAdsPeriodFilter(), getDateInputDaysAgo(), toDateInputValue()

### Community 56 - "adminConfigActive"
Cohesion: 0.50
Nodes (4): adminConfigActive(), adminConfigBase(), adminConfigByPrincipal(), adminConfigs()

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

### Community 66 - "BedrockProviders"
Cohesion: 0.67
Nodes (3): BedrockProviders, getModelKey(), getSettingsKeys()

## Ambiguous Edges - Review These
- `Meta Ads Tools` → `Commented Meta Ads MCP Server`  [AMBIGUOUS]
  config/librechat.prod.yaml · relation: conceptually_related_to

## Knowledge Gaps
- **387 isolated node(s):** `express`, `{
  PermissionBits,
  PermissionTypes,
  Permissions,
  SystemRoles,
}`, `{ logger, getTenantId, SystemCapabilities }`, `{
  findProjectById,
  getProjectById,
  getRoleByName,
  updateProject,
  upsertTenantSecret,
}`, `{ requireJwtAuth }` (+382 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **11 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `Meta Ads Tools` and `Commented Meta Ads MCP Server`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **Why does `Localize` connect `Draft Confirmation Dialogs` to `Meta Ads Formatting`, `Ad Preview Rendering`, `Rule Dialog Fields`, `BI Ranking Dialogs`, `Rules Hook State`, `BI Workspace Adapter`, `Evolution Views`, `Budget Editor Rules UI`, `Evolution Dashboard`, `Draft Settings Persistence`, `Overview Adapter`, `Settings Drawer`, `Period Controls`, `Rule Audit History`, `Error Run Hook`, `Entity Action Hook`, `Overview Rows Table`, `History Panel`, `AI Performance Workspace`?**
  _High betweenness centrality (0.008) - this node is a cross-community bridge._
- **Why does `formatMoney()` connect `Meta Ads Formatting` to `Overview Adapter`, `Ad Preview Rendering`, `Entity Action Hook`, `Overview State Tables`, `BI Ranking Dialogs`, `History Panel`, `AI Performance Workspace`, `Recommendations Panel`, `Draft Confirmation Dialogs`, `BI Workspace Adapter`, `Budget Editor Rules UI`, `Evolution Dashboard`?**
  _High betweenness centrality (0.007) - this node is a cross-community bridge._
- **Why does `formatMetric()` connect `Meta Ads Formatting` to `Overview Adapter`, `Ad Preview Rendering`, `Overview State Tables`, `BI Ranking Dialogs`, `AI Performance Workspace`, `BI Workspace Adapter`, `Evolution Dashboard`?**
  _High betweenness centrality (0.002) - this node is a cross-community bridge._
- **What connects `express`, `{
  PermissionBits,
  PermissionTypes,
  Permissions,
  SystemRoles,
}`, `{ logger, getTenantId, SystemCapabilities }` to the rest of the system?**
  _389 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Shared Data Service` be split into smaller, more focused modules?**
  _Cohesion score 0.008298755186721992 - nodes in this community are weakly interconnected._
- **Should `Project Zod Schemas` be split into smaller, more focused modules?**
  _Cohesion score 0.01904761904761905 - nodes in this community are weakly interconnected._