import type { InfiniteData } from '@tanstack/react-query';
import type * as p from '../accessPermissions';
import type * as a from '../types/agents';
import type * as s from '../schemas';
import type * as t from '../types';

export type Conversation = {
  id: string;
  createdAt: number;
  participants: string[];
  lastMessage: string;
  conversations: s.TConversation[];
};

export type ConversationListParams = {
  cursor?: string;
  isArchived?: boolean;
  sortBy?: 'title' | 'createdAt' | 'updatedAt';
  sortDirection?: 'asc' | 'desc';
  tags?: string[];
  projectId?: string;
  search?: string;
};

export type ProjectListParams = {
  cursor?: string;
  isArchived?: boolean;
  sortBy?: 'name' | 'createdAt' | 'updatedAt';
  sortDirection?: 'asc' | 'desc';
  search?: string;
};

export type ProjectListResponse = {
  projects: s.TProject[];
  nextCursor: string | null;
};

export type MinimalConversation = Pick<
  s.TConversation,
  'conversationId' | 'endpoint' | 'title' | 'createdAt' | 'updatedAt' | 'user'
>;

export type ConversationListResponse = {
  conversations: MinimalConversation[];
  nextCursor: string | null;
};

export type ConversationData = InfiniteData<ConversationListResponse>;
export type ConversationUpdater = (
  data: ConversationData,
  conversation: s.TConversation,
) => ConversationData;

/* Messages */
export type MessagesListParams = {
  cursor?: string | null;
  sortBy?: 'endpoint' | 'createdAt' | 'updatedAt';
  sortDirection?: 'asc' | 'desc';
  pageSize?: number;
  conversationId?: string;
  messageId?: string;
  search?: string;
};

export type MessagesListResponse = {
  messages: s.TMessage[];
  nextCursor: string | null;
};

export type ProjectMetaAdsSnapshot = {
  _id?: string;
  level?: 'campaign' | 'adset' | 'ad';
  entityId: string;
  entityName?: string;
  campaignId?: string;
  campaignName?: string;
  campaignObjective?: string;
  dailyBudget?: number;
  status?: string;
  currency?: string;
  spend?: number;
  cpa?: number | null;
  roas?: number | null;
  conversionValue?: number | null;
  resultCount?: number;
  resultType?: string;
  configuredResultType?: string;
  resultTypeBreakdown?: ProjectMetaAdsResultTypeBreakdown[];
  impressions?: number;
  reach?: number;
  frequency?: number;
  clicks?: number;
  ctr?: number;
  cpc?: number;
  cpm?: number;
  videoP75Watched?: number;
  videoP75Rate?: number;
  createdAt?: string;
};

export type ProjectMetaAdsResultTypeBreakdown = {
  resultType: string;
  totalSpend: number;
  totalResults: number;
  averageCostPerResult: number | null;
};

export type ProjectMetaAdsRecommendation = {
  _id?: string;
  automationRunId?: string;
  entityLevel?: 'campaign' | 'adset' | 'ad';
  entityId: string;
  entityName?: string;
  campaignId?: string;
  campaignName?: string;
  adsetId?: string;
  adsetName?: string;
  action: 'increase' | 'decrease' | 'hold' | 'pause';
  status: 'pending' | 'applied' | 'ignored' | 'blocked';
  currentStatus?: 'ACTIVE' | 'PAUSED';
  proposedStatus?: 'ACTIVE' | 'PAUSED';
  currentDailyBudget?: number;
  proposedDailyBudget?: number;
  spend?: number;
  resultCount?: number;
  cpa?: number | null;
  roas?: number | null;
  ctr?: number | null;
  cpc?: number | null;
  frequency?: number | null;
  primaryMetric?: 'cpa' | 'roas' | 'cpc' | 'ctr';
  targetMetricValue?: number | null;
  evidenceSpend?: number | null;
  evidenceSpendThreshold?: number | null;
  evidenceSpendBasis?: number | null;
  evidenceMultiplier?: number | null;
  canAct?: boolean | null;
  decisionReason?: 'awaiting_results' | 'no_result_after_spend';
  beforeMetrics?: ProjectMetaAdsAutomationMetrics;
  afterMetrics?: ProjectMetaAdsAutomationMetrics;
  afterMeasuredAt?: string;
  ruleSourceType?: 'global' | 'group' | 'override' | 'creative' | 'manual' | 'unknown';
  ruleId?: string;
  ruleName?: string;
  ruleScope?: string;
  reason?: string;
  mode?: string;
  createdAt?: string;
};

export type ProjectMetaAdsAutomationRun = {
  _id?: string;
  tenantId?: string;
  projectId: string;
  adAccountId?: string;
  actor?: 'cron' | 'user' | 'tool';
  mode?: string;
  status: 'running' | 'completed' | 'failed';
  outcome: 'applied' | 'recommended' | 'held' | 'blocked' | 'no_data' | 'failed';
  since?: string;
  until?: string;
  datePreset?: ProjectMetaAdsDatePreset;
  startedAt?: string;
  finishedAt?: string;
  durationMs?: number;
  evaluatedCount?: number;
  recommendationCount?: number;
  holdCount?: number;
  blockedCount?: number;
  appliedCount?: number;
  reasonSamples?: string[];
  errorMessage?: string;
  recommendations?: ProjectMetaAdsRecommendation[];
};

export type ProjectMetaAdsAutomationAction = {
  _id?: string;
  actionType: 'budget_change' | 'pause_ad' | 'status_change';
  entityLevel: 'campaign' | 'adset' | 'ad';
  entityId: string;
  entityName?: string;
  campaignId?: string;
  campaignName?: string;
  adsetId?: string;
  adsetName?: string;
  previousDailyBudget?: number;
  newDailyBudget?: number;
  deltaDailyBudget?: number;
  deltaPercent?: number | null;
  previousStatus?: 'ACTIVE' | 'PAUSED';
  newStatus?: 'ACTIVE' | 'PAUSED';
  spend?: number;
  resultCount?: number;
  cpa?: number | null;
  roas?: number | null;
  ctr?: number | null;
  cpc?: number | null;
  frequency?: number | null;
  primaryMetric?: 'cpa' | 'roas' | 'cpc' | 'ctr';
  targetMetricValue?: number | null;
  evidenceSpend?: number | null;
  evidenceSpendThreshold?: number | null;
  evidenceSpendBasis?: number | null;
  evidenceMultiplier?: number | null;
  canAct?: boolean | null;
  decisionReason?: 'awaiting_results' | 'no_result_after_spend';
  ruleSourceType?: 'global' | 'group' | 'override' | 'creative' | 'manual' | 'unknown';
  ruleId?: string;
  ruleName?: string;
  ruleScope?: string;
  recommendationId?: string;
  actor?: 'cron' | 'user' | 'tool';
  actorUserId?: string;
  reason?: string;
  createdAt?: string;
};

export type ProjectMetaAdsAutomationMetrics = {
  spend?: number | null;
  resultCount?: number | null;
  cpa?: number | null;
  roas?: number | null;
  ctr?: number | null;
  cpc?: number | null;
  frequency?: number | null;
};

export type ProjectMetaAdsBudgetChange = {
  _id?: string;
  entityLevel?: 'campaign' | 'adset';
  entityId: string;
  entityName?: string;
  campaignId?: string;
  campaignName?: string;
  previousDailyBudget?: number;
  newDailyBudget?: number;
  deltaDailyBudget?: number;
  deltaPercent?: number | null;
  actor?: 'cron' | 'user' | 'tool';
  reason?: string;
  createdAt?: string;
};

export type ProjectMetaAdsAdSummary = {
  adId: string;
  adName?: string;
  adSetId?: string;
  campaignId?: string;
  campaignName?: string;
  creativeId?: string;
  title?: string;
  body?: string;
  description?: string;
  thumbnailUrl?: string;
  imageUrl?: string;
  videoId?: string;
  adsManagerUrl?: string;
  linkUrl?: string;
  callToActionType?: string;
  status?: string;
  currency?: string;
  spend?: number;
  cpa?: number | null;
  roas?: number | null;
  conversionValue?: number | null;
  resultCount?: number;
  resultType?: string;
  configuredResultType?: string;
  resultTypeBreakdown?: ProjectMetaAdsResultTypeBreakdown[];
  impressions?: number;
  reach?: number;
  frequency?: number;
  clicks?: number;
  ctr?: number;
  cpc?: number;
  cpm?: number;
  videoP75Watched?: number;
  videoP75Rate?: number;
};

export type ProjectMetaAdsAdSetSummary = ProjectMetaAdsSnapshot & {
  snapshotAt?: string;
  latestRecommendation?: ProjectMetaAdsRecommendation;
  ads?: ProjectMetaAdsAdSummary[];
};

export type ProjectMetaAdsCampaignSummary = {
  campaignId: string;
  campaignName?: string;
  objective?: string;
  dailyBudget?: number;
  status?: string;
  currency?: string;
  spend?: number;
  cpa?: number | null;
  roas?: number | null;
  conversionValue?: number | null;
  resultCount?: number;
  resultType?: string;
  configuredResultType?: string;
  resultTypeBreakdown?: ProjectMetaAdsResultTypeBreakdown[];
  impressions?: number;
  reach?: number;
  frequency?: number;
  clicks?: number;
  ctr?: number;
  cpc?: number;
  cpm?: number;
  videoP75Watched?: number;
  videoP75Rate?: number;
  budgetLevel?: 'campaign' | 'adset';
  editableBudgetLevel?: 'campaign' | 'adset' | 'none';
  budgetMode?: 'CBO' | 'ABO' | 'UNKNOWN';
  adSets: ProjectMetaAdsAdSetSummary[];
};

export type ProjectMetaAdsObjectiveResultTypeSummary = {
  resultType?: string;
  label?: string;
  totalSpend: number;
  totalResults: number;
  averageCostPerResult: number | null;
  impressions?: number;
  clicks?: number;
  averageCtr?: number | null;
};

export type ProjectMetaAdsObjectiveSummary = {
  objective?: string;
  label?: string;
  campaignCount: number;
  totalSpend: number;
  totalResults: number | null;
  averageCostPerResult: number | null;
  averageFrequency: number | null;
  averageCtr: number | null;
  resultTypes: ProjectMetaAdsObjectiveResultTypeSummary[];
};

export type ProjectMetaAdsTrendPoint = {
  date: string;
  campaignId: string;
  campaignName?: string;
  adSetId?: string;
  adSetName?: string;
  adId?: string;
  adName?: string;
  spend: number;
  resultCount: number;
  cpa?: number | null;
  dailyBudget?: number;
  frequency?: number | null;
  impressions?: number;
  clicks?: number;
  ctr?: number | null;
};

export type ProjectMetaAdsTrendSeries = {
  level: 'campaign' | 'adset' | 'ad';
  entityId: string;
  entityName?: string;
  parentCampaignName?: string;
  objective?: string;
  resultType?: string;
  points: ProjectMetaAdsTrendPoint[];
};

export type ProjectMetaAdsEvolutionDelta = {
  level?: 'campaign' | 'adset' | 'ad';
  entityId?: string;
  entityName?: string;
  parentCampaignName?: string;
  campaignId?: string;
  campaignName?: string;
  firstDate: string;
  lastDate: string;
  spendDelta: number;
  resultDelta: number;
  cpaDelta?: number | null;
  budgetDelta?: number;
  frequencyDelta?: number | null;
  latestChange?: ProjectMetaAdsBudgetChange;
};

export type ProjectMetaAdsCampaignDelta = ProjectMetaAdsEvolutionDelta & {
  campaignId: string;
  campaignName?: string;
};

export type ProjectMetaAdsChangesByDay = {
  date: string;
  totalDeltaDailyBudget: number;
  changeCount: number;
};

export type ProjectMetaAdsTrend = {
  points: ProjectMetaAdsTrendPoint[];
  series?: ProjectMetaAdsTrendSeries[];
  campaignDeltas: ProjectMetaAdsCampaignDelta[];
  entityDeltas?: ProjectMetaAdsEvolutionDelta[];
  changesByDay: ProjectMetaAdsChangesByDay[];
};

export type ProjectMetaAdsManualBudgetPayload = {
  entityLevel: 'campaign' | 'adset';
  entityId: string;
  entityName?: string;
  dailyBudget: number;
  reason?: string;
};

export type ProjectMetaAdsManualBudgetResponse = {
  change: ProjectMetaAdsBudgetChange;
};

export type ProjectMetaAdsDuplicatePayload = {
  entityLevel: 'campaign' | 'adset';
  entityId: string;
  entityName?: string;
  targetName: string;
};

export type ProjectMetaAdsDuplicateResponse = {
  entityLevel: 'campaign' | 'adset';
  sourceEntityId: string;
  duplicatedEntityId?: string;
  duplicatedEntityName: string;
  status: string;
};

export type ProjectMetaAdsEntityStatusLevel = 'campaign' | 'adset' | 'ad';

export type ProjectMetaAdsEntityStatusPayload = {
  entityName?: string;
  status: 'ACTIVE' | 'PAUSED';
};

export type ProjectMetaAdsEntityStatusResponse = {
  entityLevel: ProjectMetaAdsEntityStatusLevel;
  entityId: string;
  status: 'ACTIVE' | 'PAUSED';
};

export type ProjectMetaAdsAdDiagnostics = {
  adsFetched: number;
  adInsightsFetched: number;
  adsWithInsights: number;
  insightOnlyAds: number;
  adsAttachedToAdSets: number;
};

export type ProjectMetaAdsStatus = {
  source?: 'snapshot' | 'live';
  latestSnapshots: ProjectMetaAdsSnapshot[];
  recommendations: ProjectMetaAdsRecommendation[];
  changes: ProjectMetaAdsBudgetChange[];
  campaigns?: ProjectMetaAdsCampaignSummary[];
  adDiagnostics?: ProjectMetaAdsAdDiagnostics;
  currency?: string;
  period?: {
    datePreset?: ProjectMetaAdsDatePreset;
    since?: string;
    until?: string;
  };
  monthlyBudget?: {
    month: string;
    baseAmount: number;
    additionalAmount: number;
    allowedOverspendPct: number;
    limit: number;
    spend: number;
    remaining: number;
    exceededBy: number;
    spentPct: number;
    remainingDays: number;
  };
  goalProgress?: {
    investment?: {
      month: ProjectMetaAdsGoalProgressItem;
      day: ProjectMetaAdsGoalProgressItem;
    };
    result?: {
      resultType: string;
      month: ProjectMetaAdsGoalProgressItem;
      day: ProjectMetaAdsGoalProgressItem;
    };
    conversionValue?: {
      month: ProjectMetaAdsGoalProgressItem;
      day: ProjectMetaAdsGoalProgressItem;
    };
    roas?: {
      month: ProjectMetaAdsGoalProgressItem;
      day: ProjectMetaAdsGoalProgressItem;
    };
  };
  summary?: {
    totalSpend: number;
    totalResults: number | null;
    averageCostPerResult: number | null;
    averageFrequency: number | null;
    bestCampaignByCost?: ProjectMetaAdsCampaignSummary;
    worstCampaignByCost?: ProjectMetaAdsCampaignSummary;
    objectives?: ProjectMetaAdsObjectiveSummary[];
  };
  trend?: ProjectMetaAdsTrend;
  credentials?: {
    effectiveSource: 'project' | 'tenant' | 'missing';
    projectConfigured: boolean;
    tenantConfigured: boolean;
    secretName?: string;
  };
  graphVersion?: {
    effective: string;
    configured?: string;
    source: 'project' | 'global';
  };
};

export type ProjectMetaAdsGoalProgressItem = {
  target: number;
  actual: number;
  remaining: number;
  percent: number;
};

export type ProjectMetaAdsTenantTokenResponse = {
  credentials: {
    tenantConfigured: boolean;
    secretName?: string;
  };
};

export type ProjectMetaAdsDatePreset =
  | 'today'
  | 'yesterday'
  | 'this_month'
  | 'last_month'
  | 'last_6h'
  | 'last_24h'
  | 'last_1d'
  | 'last_2d'
  | 'last_3d'
  | 'last_7d'
  | 'last_14d'
  | 'last_30d';

export type ProjectMetaAdsStatusParams = {
  scope?: 'snapshot' | 'live';
  datePreset?: ProjectMetaAdsDatePreset;
  since?: string;
  until?: string;
};

export type ProjectMetaAdsRankingLevel = 'campaign' | 'adset' | 'ad';

export type ProjectMetaAdsRankingParams = ProjectMetaAdsStatusParams & {
  level?: ProjectMetaAdsRankingLevel;
  objective?: string;
  resultType?: string;
};

export type ProjectMetaAdsRankingItem = {
  id: string;
  level: ProjectMetaAdsRankingLevel;
  name: string;
  parentName?: string;
  campaignId?: string;
  campaignName?: string;
  objective?: string;
  resultType?: string;
  spend: number;
  resultCount: number;
  cpa?: number | null;
  roas?: number | null;
  ctr?: number | null;
  clicks?: number;
  impressions?: number;
  frequency?: number | null;
  thumbnailUrls?: string[];
  adsManagerUrl?: string;
};

export type ProjectMetaAdsRankingResponse = {
  level: ProjectMetaAdsRankingLevel;
  period: ProjectMetaAdsStatusParams;
  currency?: string;
  items: ProjectMetaAdsRankingItem[];
};

export type ProjectMetaAdsPerformanceSummary = {
  actionCount: number;
  aiActionCount: number;
  budgetChangeCount?: number;
  pausedAdCount?: number;
  totalDeltaDailyBudget?: number;
  appliedRecommendationCount?: number;
  blockedRecommendationCount?: number;
  ignoredRecommendationCount?: number;
  totalSpend?: number;
  totalResults?: number;
  averageCpa?: number | null;
  averageRoas?: number | null;
};

export type ProjectMetaAdsPerformanceResponse = {
  period: ProjectMetaAdsStatusParams;
  currency?: string;
  summary: ProjectMetaAdsPerformanceSummary;
  actions: ProjectMetaAdsAutomationAction[];
  recommendations: ProjectMetaAdsRecommendation[];
};

export type ProjectMetaAdsRulePerformanceItem = {
  ruleKey: string;
  ruleSourceType?: ProjectMetaAdsAutomationAction['ruleSourceType'];
  ruleId?: string;
  ruleName?: string;
  ruleScope?: string;
  actionCount: number;
  aiActionCount: number;
  pausedAdCount: number;
  totalSpend: number;
  totalResults: number;
  averageCpa?: number | null;
  averageRoas?: number | null;
  firstCpa?: number | null;
  lastCpa?: number | null;
  cpaDelta?: number | null;
  firstRoas?: number | null;
  lastRoas?: number | null;
  roasDelta?: number | null;
  targetMetric?: 'cpa' | 'roas' | 'cpc' | 'ctr' | null;
  targetMetricGoal?: number | null;
  firstTargetMetric?: number | null;
  lastTargetMetric?: number | null;
  targetMetricDelta?: number | null;
  firstResultCount?: number | null;
  lastResultCount?: number | null;
  awaitingReason?: 'missing_expected_result';
  evidenceSpend?: number | null;
  evidenceSpendThreshold?: number | null;
  evidenceSpendBasis?: number | null;
  evidenceMultiplier?: number | null;
  canAct?: boolean | null;
  decisionReason?: 'awaiting_results' | 'no_result_after_spend';
  firstActionAt?: string;
  lastActionAt?: string;
  comparisonBasis?: 'period_first_last' | 'real_before_after';
  entityStatusSummary?: ProjectMetaAdsRulePerformanceStatusSummary;
  hasEntityLevelEvaluation?: boolean;
  hasMixedEntityStatuses?: boolean;
  status:
    | 'improved'
    | 'neutral'
    | 'regressed'
    | 'insufficient_data'
    | 'awaiting_results'
    | 'no_result_after_spend';
  entities?: ProjectMetaAdsRulePerformanceEntity[];
  actions: ProjectMetaAdsAutomationAction[];
};

export type ProjectMetaAdsRulePerformanceStatusSummary = {
  improved: number;
  neutral: number;
  regressed: number;
  insufficient_data: number;
  awaiting_results: number;
  no_result_after_spend: number;
};

export type ProjectMetaAdsRulePerformanceEntity = {
  entityLevel: ProjectMetaAdsAutomationAction['entityLevel'];
  entityId: string;
  entityName?: string;
  campaignName?: string;
  adsetName?: string;
  actionCount: number;
  pausedAdCount: number;
  totalSpend: number;
  averageCpa?: number | null;
  averageRoas?: number | null;
  firstCpa?: number | null;
  lastCpa?: number | null;
  cpaDelta?: number | null;
  firstRoas?: number | null;
  lastRoas?: number | null;
  roasDelta?: number | null;
  targetMetric?: 'cpa' | 'roas' | 'cpc' | 'ctr' | null;
  targetMetricGoal?: number | null;
  firstTargetMetric?: number | null;
  lastTargetMetric?: number | null;
  targetMetricDelta?: number | null;
  firstResultCount?: number | null;
  lastResultCount?: number | null;
  awaitingReason?: 'missing_expected_result';
  evidenceSpend?: number | null;
  evidenceSpendThreshold?: number | null;
  evidenceSpendBasis?: number | null;
  evidenceMultiplier?: number | null;
  canAct?: boolean | null;
  decisionReason?: 'awaiting_results' | 'no_result_after_spend';
  firstActionAt?: string;
  lastActionAt?: string;
  comparisonBasis?: 'period_first_last' | 'real_before_after';
  status?:
    | 'improved'
    | 'neutral'
    | 'regressed'
    | 'insufficient_data'
    | 'awaiting_results'
    | 'no_result_after_spend';
};

export type ProjectMetaAdsRulePerformanceResponse = {
  period: ProjectMetaAdsStatusParams;
  currency?: string;
  rules: ProjectMetaAdsRulePerformanceItem[];
};

export type ProjectMetaAdsRuleChange = {
  _id?: string;
  actor?: 'user' | 'tool' | 'cron';
  actorUserId?: string;
  actorUserName?: string;
  actorUserEmail?: string;
  changedFields: string[];
  ruleChanges?: Array<{
    ruleKey: string;
    ruleType: 'global' | 'group' | 'override';
    ruleName?: string;
    action: 'created' | 'updated' | 'deleted';
    changedFields: string[];
  }>;
  before?: {
    enabled?: boolean;
    automationAnalysisPreset?: ProjectMetaAdsDatePreset;
    clientGoal?: {
      resultType?: string;
      monthlyTarget?: number;
      monthlyConversionValueTarget?: number;
      targetRoas?: number;
    } | null;
    rules?: Record<string, unknown>;
    creativeRules?: Record<string, unknown>;
    ruleGroups?: unknown[];
    ruleOverrides?: unknown[];
  };
  after?: {
    automationAnalysisPreset?: ProjectMetaAdsDatePreset;
    clientGoal?: {
      resultType?: string;
      monthlyTarget?: number;
      monthlyConversionValueTarget?: number;
      targetRoas?: number;
    } | null;
    rules?: Record<string, unknown>;
    creativeRules?: Record<string, unknown>;
    ruleGroups?: unknown[];
    ruleOverrides?: unknown[];
  };
  createdAt?: string;
};

export type ProjectMetaAdsRuleHistoryResponse = {
  changes: ProjectMetaAdsRuleChange[];
};

export type ProjectMetaAdsRunResponse = {
  projectId: string;
  adAccountId: string;
  graphVersion?: string;
  since: string;
  until: string;
  recommendations: ProjectMetaAdsRecommendation[];
  run?: ProjectMetaAdsAutomationRun;
  autoApplySummary?: {
    appliedCount: number;
    adjustedToMetaMinimumCount: number;
    blockedCount: number;
    messages: string[];
  };
  messages?: string[];
};

export type ProjectMetaAdsRunsResponse = {
  runs: ProjectMetaAdsAutomationRun[];
};

export type ProjectMetaAdsApplyResponse = {
  recommendation: ProjectMetaAdsRecommendation;
};

/* Shared Links */
export type SharedMessagesResponse = Omit<s.TSharedLink, 'messages'> & {
  messages: s.TMessage[];
};

export interface SharedLinksListParams {
  pageSize: number;
  isPublic: boolean;
  sortBy: 'title' | 'createdAt';
  sortDirection: 'asc' | 'desc';
  search?: string;
  cursor?: string;
}

export type SharedLinkItem = {
  shareId: string;
  title: string;
  isPublic: boolean;
  createdAt: Date;
  conversationId: string;
};

export interface SharedLinksResponse {
  links: SharedLinkItem[];
  nextCursor: string | null;
  hasNextPage: boolean;
}

export interface SharedLinkQueryData {
  pages: SharedLinksResponse[];
  pageParams: (string | null)[];
}

export type AllPromptGroupsFilterRequest = {
  category: string;
  pageNumber: string;
  pageSize: string | number;
  before?: string | null;
  after?: string | null;
  order?: 'asc' | 'desc';
  name?: string;
  author?: string;
};

export type AllPromptGroupsResponse = t.TPromptGroup[];

export type ConversationTagsResponse = s.TConversationTag[];

/* MCP Types */
export type MCPTool = {
  name: string;
  pluginKey: string;
  description: string;
};

export type MCPServer = {
  name: string;
  icon: string;
  authenticated: boolean;
  authConfig: s.TPluginAuthConfig[];
  tools: MCPTool[];
};

export type MCPServersResponse = {
  servers: Record<string, MCPServer>;
};

export type VerifyToolAuthParams = { toolId: string };
export type VerifyToolAuthResponse = {
  authenticated: boolean;
  message?: string | s.AuthType;
  authTypes?: [string, s.AuthType][];
};

export type GetToolCallParams = { conversationId: string };
export type ToolCallResults = a.ToolCallResult[];

/* Memories */
export type TUserMemory = {
  key: string;
  value: string;
  updated_at: string;
  tokenCount?: number;
};

export type MemoriesResponse = {
  memories: TUserMemory[];
  totalTokens: number;
  tokenLimit: number | null;
  usagePercentage: number | null;
};

export type PrincipalSearchParams = {
  q: string;
  limit?: number;
  types?: Array<p.PrincipalType.USER | p.PrincipalType.GROUP | p.PrincipalType.ROLE>;
};

export type PrincipalSearchResponse = {
  query: string;
  limit: number;
  types?: Array<p.PrincipalType.USER | p.PrincipalType.GROUP | p.PrincipalType.ROLE>;
  results: p.TPrincipalSearchResult[];
  count: number;
  sources: {
    local: number;
    entra: number;
  };
};

export type AccessRole = {
  accessRoleId: p.AccessRoleIds;
  name: string;
  description: string;
  permBits: number;
};

export type AccessRolesResponse = AccessRole[];

export type ListRolesResponse = {
  roles: Array<{ _id?: string; name: string; description?: string }>;
  total: number;
  limit: number;
  offset?: number;
};

export interface MCPServerStatus {
  requiresOAuth: boolean;
  connectionState: 'disconnected' | 'connecting' | 'connected' | 'error';
}

export interface MCPConnectionStatusResponse {
  success: boolean;
  connectionStatus: Record<string, MCPServerStatus>;
}

export interface MCPServerConnectionStatusResponse {
  success: boolean;
  serverName: string;
  requiresOAuth: boolean;
  connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'error';
}

export interface MCPAuthValuesResponse {
  success: boolean;
  serverName: string;
  authValueFlags: Record<string, boolean>;
}

/**
 * User Favorites — pinned agents, models, and model specs.
 * Exactly one variant should be set per entry; exclusivity is enforced
 * server-side in FavoritesController. Shape is loose for state-update ergonomics.
 */
export type TUserFavorite = {
  agentId?: string;
  model?: string;
  endpoint?: string;
  spec?: string;
  /** Phase 2 — skill favoriting isn't persisted yet, but the shape is reserved. */
  skillId?: string;
};

/* SharePoint Graph API Token */
export type GraphTokenParams = {
  scopes: string;
};

export type GraphTokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
};

/* Admin Users */
export type AdminUser = {
  id?: string;
  _id: string;
  name?: string;
  username: string;
  email: string;
  role: string;
  tenantId?: string;
  emailVerified?: boolean;
  createdAt?: string;
};

export type ListUsersResponse = {
  users: AdminUser[];
  total: number;
  limit: number;
  page: number;
};

/* Admin Groups */
export type AdminGroup = {
  _id: string;
  name: string;
  description?: string;
  memberIds?: string[];
  createdAt?: string;
  updatedAt?: string;
};

export type ListGroupsResponse = {
  groups: AdminGroup[];
  total: number;
  limit: number;
  page: number;
};

export type GroupResponse = AdminGroup;

export type GroupMembersResponse = {
  members: AdminUser[];
  total: number;
};

/* Admin Config */
export type AdminConfig = {
  _id: string;
  principalType: string;
  principalId: string;
  principalModel: string;
  priority: number;
  overrides: Record<string, unknown>;
  isActive: boolean;
  configVersion: number;
  tenantId?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type AdminConfigListResponse = {
  configs: AdminConfig[];
};

/* Admin Overview */
export type AdminOverviewResponse = {
  usersTotal: number;
  adminsTotal: number;
  tenantsTotal: number;
  rolesTotal: number;
  groupsTotal: number;
  configOverridesTotal: number;
  activeConfigOverridesTotal: number;
  functionsTotal: number;
  activeFunctionsTotal: number;
  secretsTotal: number;
  topTenants: TenantItem[];
  recentUsers: AdminUser[];
};

/* Admin Tenants */
export type TenantItem = {
  id: string;
  userCount: number;
};

export type ListTenantsResponse = {
  tenants: TenantItem[];
};

export type TenantStatsResponse = {
  tenantId: string;
  stats: {
    users: number;
    conversations: number;
    agents: number;
    functions: number;
    secrets: number;
  };
};

/* Admin Functions */
export type TenantFunction = {
  _id: string;
  id: string;
  tenantId: string;
  name: string;
  description: string;
  details?: string;
  config: {
    baseUrl: string;
    method: string;
    path: string;
    headers?: Record<string, string>;
    auth?: {
      type: string;
      secretName?: string;
      headerName?: string;
    };
  };
  inputSchema: Record<string, unknown>;
  postProcess?: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type PublicTenantFunction = Pick<
  TenantFunction,
  'id' | 'name' | 'description' | 'details' | 'inputSchema' | 'isActive'
> & { hasAuth?: boolean };

export type TenantFunctionListResponse = {
  functions: TenantFunction[];
};

export type PublicTenantFunctionListResponse = {
  functions: PublicTenantFunction[];
};

export type TenantFunctionResponse = {
  function: TenantFunction;
};

/* Admin Secrets */
export type TenantSecret = {
  _id: string;
  tenantId: string;
  name: string;
  type: 'bearer' | 'basic' | 'api_key' | 'custom' | 'meta_access_token';
  createdAt?: string;
  updatedAt?: string;
};

export type TenantSecretListResponse = {
  secrets: TenantSecret[];
};

export type TenantSecretResponse = {
  secret: TenantSecret;
};

export type AdminConfigResponse = {
  config: AdminConfig;
};
