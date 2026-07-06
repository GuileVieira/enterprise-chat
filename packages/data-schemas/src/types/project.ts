export interface IProjectMemory {
  key: string;
  value: string;
}

export interface IProjectPromptSnippet {
  title: string;
  content: string;
}

export interface IProjectMetaAdsRules {
  targetCpa?: number;
  targetResultType?: string;
  primaryMetric?: 'cpa' | 'roas' | 'cpc' | 'ctr';
  minRoas?: number;
  minCtr?: number;
  maxCpc?: number;
  maxCpm?: number;
  maxIncreasePct?: number;
  maxDecreasePct?: number;
  minDailyBudget?: number;
  maxDailyBudget?: number;
  cooldownHours?: number;
  minSpend?: number;
  enabledSections?: {
    performance?: boolean;
    creatives?: boolean;
    noResultSpendCap?: boolean;
  };
  noResultSpendCap?: {
    enabled?: boolean;
    minSpend?: number;
  };
}

export interface IProjectMetaAdsCreativeRules {
  maxFrequency?: number;
  pauseHighCost?: {
    enabled?: boolean;
    maxCostPerResult?: number;
    lookbackDays?: 1 | 2 | 3 | 7;
    minCreativesInScope?: number;
    minSpend?: number;
    cooldownHours?: number;
    targetResultType?: string;
  };
}

export interface IProjectMetaAdsMonthlyBudget {
  month?: string;
  baseAmount?: number;
  additionalAmount?: number;
  allowedOverspendPct?: number;
}

export type IProjectMetaAdsMonthlyBudgets = Record<
  string,
  Omit<IProjectMetaAdsMonthlyBudget, 'month'>
>;

export interface IProjectMetaAds {
  enabled?: boolean;
  adAccountId?: string;
  tokenSecretName?: string;
  graphVersion?: string;
  credentialMode?: 'project_secret' | 'tenant_default';
  automationMode?: 'recommend' | 'auto_limited';
  accountProfile?: 'local_business' | 'ecommerce' | 'lead_gen' | 'traffic' | 'custom';
  budgetLevel?: 'campaign' | 'adset';
  scheduleIntervalMinutes?: 30 | 60 | 120 | 180 | 360 | 720 | 1440;
  automationAnalysisPreset?:
    | 'today'
    | 'yesterday'
    | 'last_2d'
    | 'last_3d'
    | 'last_7d'
    | 'last_14d'
    | 'last_30d';
  lastRunAt?: Date;
  clientGoal?: {
    resultType?: string;
    monthlyTarget?: number;
  };
  monthlyBudget?: IProjectMetaAdsMonthlyBudget;
  monthlyBudgets?: IProjectMetaAdsMonthlyBudgets;
  rules?: IProjectMetaAdsRules;
  creativeRules?: IProjectMetaAdsCreativeRules;
  ruleGroups?: Array<{
    id: string;
    name: string;
    entityLevel: 'campaign' | 'adset';
    entityIds: string[];
    enabled?: boolean;
    analysisPreset?: IProjectMetaAds['automationAnalysisPreset'];
    rules?: IProjectMetaAdsRules;
    creativeRules?: IProjectMetaAdsCreativeRules;
  }>;
  ruleOverrides?: Array<{
    entityLevel: 'campaign' | 'adset';
    entityId: string;
    entityName?: string;
    enabled?: boolean;
    analysisPreset?: IProjectMetaAds['automationAnalysisPreset'];
    rules?: IProjectMetaAdsRules;
    creativeRules?: IProjectMetaAdsCreativeRules;
  }>;
}

export interface IProject {
  projectId: string;
  name?: string;
  description?: string;
  user?: string;
  endpoint?: string;
  model?: string;
  instructions?: string;
  memories?: IProjectMemory[];
  memoryKeys?: string[];
  promptSnippets?: IProjectPromptSnippet[];
  promptGroupIds?: string[];
  fileIds?: string[];
  metaAds?: IProjectMetaAds;
  isArchived?: boolean;
  iconURL?: string;
  accessLevel?: number;
  tenantId?: string;
  createdAt?: Date;
  updatedAt?: Date;
}
