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
  level?: 'campaign' | 'adset';
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
  resultCount?: number;
  resultType?: string;
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
  entityLevel?: 'campaign' | 'adset';
  entityId: string;
  entityName?: string;
  campaignId?: string;
  campaignName?: string;
  action: 'increase' | 'decrease' | 'hold';
  status: 'pending' | 'applied' | 'ignored' | 'blocked';
  currentDailyBudget?: number;
  proposedDailyBudget?: number;
  spend?: number;
  cpa?: number | null;
  roas?: number | null;
  reason?: string;
  mode?: string;
  createdAt?: string;
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
  linkUrl?: string;
  callToActionType?: string;
  status?: string;
  currency?: string;
  spend?: number;
  cpa?: number | null;
  roas?: number | null;
  resultCount?: number;
  resultType?: string;
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
  resultCount?: number;
  resultType?: string;
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
  level: 'campaign' | 'adset';
  entityId: string;
  entityName?: string;
  parentCampaignName?: string;
  points: ProjectMetaAdsTrendPoint[];
};

export type ProjectMetaAdsCampaignDelta = {
  campaignId: string;
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

export type ProjectMetaAdsChangesByDay = {
  date: string;
  totalDeltaDailyBudget: number;
  changeCount: number;
};

export type ProjectMetaAdsTrend = {
  points: ProjectMetaAdsTrendPoint[];
  series?: ProjectMetaAdsTrendSeries[];
  campaignDeltas: ProjectMetaAdsCampaignDelta[];
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

export type ProjectMetaAdsAdDiagnostics = {
  adsFetched: number;
  adInsightsFetched: number;
  adsWithInsights: number;
  insightOnlyAds: number;
  adsAttachedToAdSets: number;
  lazyLoaded?: boolean;
};

export type ProjectMetaAdsStatus = {
  latestSnapshots: ProjectMetaAdsSnapshot[];
  recommendations: ProjectMetaAdsRecommendation[];
  changes: ProjectMetaAdsBudgetChange[];
  campaigns?: ProjectMetaAdsCampaignSummary[];
  adDiagnostics?: ProjectMetaAdsAdDiagnostics;
  currency?: string;
  period?: {
    datePreset?: 'today' | 'yesterday' | 'last_7d' | 'last_14d' | 'last_30d';
    since?: string;
    until?: string;
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

export type ProjectMetaAdsTenantTokenResponse = {
  credentials: {
    tenantConfigured: boolean;
    secretName?: string;
  };
};

export type ProjectMetaAdsStatusParams = {
  datePreset?: 'today' | 'yesterday' | 'last_7d' | 'last_14d' | 'last_30d';
  since?: string;
  until?: string;
};

export type ProjectMetaAdsAdsParams = ProjectMetaAdsStatusParams & {
  adSetId: string;
};

export type ProjectMetaAdsAdsResponse = {
  adSetId: string;
  currency?: string;
  ads: ProjectMetaAdsAdSummary[];
  diagnostics?: ProjectMetaAdsAdDiagnostics;
};

export type ProjectMetaAdsRunResponse = {
  projectId: string;
  adAccountId: string;
  graphVersion?: string;
  since: string;
  until: string;
  recommendations: ProjectMetaAdsRecommendation[];
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
