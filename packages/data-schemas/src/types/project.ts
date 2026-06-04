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
  minRoas?: number;
  maxIncreasePct?: number;
  maxDecreasePct?: number;
  minDailyBudget?: number;
  maxDailyBudget?: number;
  cooldownHours?: number;
  minSpend?: number;
}

export interface IProjectMetaAds {
  enabled?: boolean;
  adAccountId?: string;
  tokenSecretName?: string;
  graphVersion?: string;
  credentialMode?: 'project_secret' | 'tenant_default';
  automationMode?: 'recommend' | 'auto_limited';
  budgetLevel?: 'adset';
  scheduleIntervalMinutes?: 30 | 60 | 120 | 180 | 360 | 720 | 1440;
  lastRunAt?: Date;
  rules?: IProjectMetaAdsRules;
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
