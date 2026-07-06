import type {
  TProject,
  ProjectMetaAdsSnapshot,
  ProjectMetaAdsAdSummary,
  ProjectMetaAdsAdSetSummary,
  ProjectMetaAdsCampaignSummary,
  ProjectMetaAdsObjectiveSummary,
  ProjectMetaAdsTrendSeries,
  ProjectMetaAdsManualBudgetPayload,
  ProjectMetaAdsEntityStatusLevel,
  ProjectMetaAdsEntityStatusPayload,
  ProjectMetaAdsDuplicatePayload,
} from 'librechat-data-provider';
import type { useLocalize } from '~/hooks';
import type { TranslationKeys } from '~/hooks';

export type MetaAdsRules = NonNullable<NonNullable<TProject['metaAds']>['rules']>;
export type MetaAdsCreativeRules = NonNullable<NonNullable<TProject['metaAds']>['creativeRules']>;
export type MetaAdsSettings = NonNullable<TProject['metaAds']>;
export type MetaAdsRuleGroup = NonNullable<MetaAdsSettings['ruleGroups']>[number];
export type MetaAdsRuleOverride = NonNullable<MetaAdsSettings['ruleOverrides']>[number];
export type MetaAdsRulesState = Required<
  Pick<
    MetaAdsRules,
    | 'targetCpa'
    | 'minRoas'
    | 'maxIncreasePct'
    | 'maxDecreasePct'
    | 'minDailyBudget'
    | 'maxDailyBudget'
    | 'cooldownHours'
    | 'minSpend'
  >
> &
  Pick<
    MetaAdsRules,
    | 'targetResultType'
    | 'primaryMetric'
    | 'minCtr'
    | 'maxCpc'
    | 'maxCpm'
    | 'enabledSections'
    | 'noResultSpendCap'
  >;

export type MetaAdsSettingsState = Omit<MetaAdsSettings, 'rules' | 'creativeRules'> & {
  rules: MetaAdsRulesState;
  creativeRules: Required<MetaAdsCreativeRules>;
};

export type BudgetEditor = {
  entityLevel: ProjectMetaAdsManualBudgetPayload['entityLevel'];
  entityId: string;
  entityName?: string;
  currentBudget?: number;
};

export type RuleGroupDraft = {
  id?: string;
  overrideKey?: string;
  scope: 'global' | 'group' | 'override';
  name: string;
  entityLevel: MetaAdsRuleGroup['entityLevel'];
  entityIds: string[];
  entityName?: string;
  analysisPreset?: MetaAdsSettings['automationAnalysisPreset'];
  rules: MetaAdsRulesState;
  creativeRules: Required<MetaAdsCreativeRules>;
};

export type RuleGroupEntityOption = {
  id: string;
  label: string;
  selected: boolean;
};

export type RuleRowType = 'global' | 'group' | 'campaign_override' | 'adset_override';
export type RuleRow = {
  key: string;
  type: RuleRowType;
  enabled: boolean;
  name: string;
  scopeLabel: string;
  precedenceLabel: string;
  entityLevel?: MetaAdsRuleGroup['entityLevel'];
  entityIds: string[];
  group?: MetaAdsRuleGroup;
  override?: MetaAdsRuleOverride;
  rules: MetaAdsRulesState;
  creativeRules?: Required<MetaAdsCreativeRules>;
};

export type BudgetConfirmation = ProjectMetaAdsManualBudgetPayload & {
  currentBudget?: number;
};

export type EntityStatusConfirmation = {
  entityLevel: ProjectMetaAdsEntityStatusLevel;
  entityId: string;
  entityName?: string;
  currentStatus: string;
  nextStatus: ProjectMetaAdsEntityStatusPayload['status'];
};

export type DuplicateDraft = ProjectMetaAdsDuplicatePayload & {
  status?: string;
  budget?: number | null;
};

export type ScheduleIntervalMinutes = NonNullable<MetaAdsSettings['scheduleIntervalMinutes']>;
export type RequestError = {
  message?: unknown;
  response?: {
    data?: {
      message?: unknown;
      details?: unknown;
    };
  };
};

export type SettingsDrawer = 'account' | 'automation' | null;
export type WorkspaceTab = 'overview' | 'bi' | 'rules';
export type TableView = 'summary' | 'performance' | 'creative' | 'rules';
export type DatePreset =
  | 'today'
  | 'yesterday'
  | 'last_1d'
  | 'last_2d'
  | 'last_3d'
  | 'last_7d'
  | 'last_14d'
  | 'last_30d';
export type PeriodFilter = DatePreset | 'custom';
export type EvolutionMetric = 'spend' | 'resultCount' | 'cpa' | 'ctr' | 'frequency' | 'clicks';
export type MetaAdsBiRankLevel = 'campaign' | 'adset' | 'ad';
export type MetaAdsBiControls = {
  level: MetaAdsBiRankLevel;
  objective: string;
  resultType: string;
  metric: EvolutionMetric;
};

export type MetaAdsBiRankItem = {
  id: string;
  level: MetaAdsBiRankLevel;
  name: string;
  parentName?: string;
  objective?: string;
  resultType?: string;
  resultCount?: number | null;
  cpa?: number | null;
  spend?: number | null;
  ctr?: number | null;
  frequency?: number | null;
  resultTypeBreakdown?: ProjectMetaAdsCampaignSummary['resultTypeBreakdown'];
  thumbnailUrls?: string[];
};

export type MetaAdsBiRankings = {
  campaigns: MetaAdsBiRankItem[];
  adSets: MetaAdsBiRankItem[];
  ads: MetaAdsBiRankItem[];
};

export type BiRankingSortKey = 'cpa' | 'spend' | 'resultCount' | 'ctr' | 'frequency';
export type BiRankingSort = {
  key: BiRankingSortKey;
  direction: 'asc' | 'desc';
};

export type EvolutionHoverPoint = {
  seriesId: string;
  entityName: string;
  parentCampaignName?: string;
  date: string;
  value: number;
  x: number;
  y: number;
  color: string;
  point?: ProjectMetaAdsTrendSeries['points'][number];
};

export type SummaryResultTypeOption = {
  resultType: string;
  totalSpend: number;
  totalResults: number;
  averageCostPerResult: number | null;
  spendKeys?: Set<string>;
};

export type TableColumnKey =
  | 'level'
  | 'adStatus'
  | 'name'
  | 'budget'
  | 'objective'
  | 'budgetMode'
  | 'frequency'
  | 'roas'
  | 'result'
  | 'cpa'
  | 'spend'
  | 'ctr'
  | 'clicks'
  | 'video'
  | 'rule'
  | 'recommendation'
  | 'actions';

export type TableColumn = {
  key: TableColumnKey;
  labelKey?: TranslationKeys;
  label?: string;
  widthClass: string;
  align?: 'left' | 'right';
  sortableKey?: string;
  defaultDirection?: 'asc' | 'desc';
};

export type Localize = ReturnType<typeof useLocalize>;
export type FrequencyAccumulator = {
  frequencyWeightedTotal: number;
  frequencyWeight: number;
  frequencyTotal: number;
  frequencyCount: number;
};

export type ResultTypeSummary = NonNullable<ProjectMetaAdsObjectiveSummary['resultTypes']>[number];
export type CampaignFallbackAccumulator = ProjectMetaAdsCampaignSummary &
  FrequencyAccumulator & {
    cpaSpendTotal: number;
    cpaResultTotal: number;
  };

export type MetaAdsData = ProjectMetaAdsSnapshot;
export type MetaAdsAdSet = ProjectMetaAdsAdSetSummary;
export type MetaAdsAd = ProjectMetaAdsAdSummary;
