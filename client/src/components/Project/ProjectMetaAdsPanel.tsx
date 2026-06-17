import { Fragment, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { UIEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowsIn, ArrowsOut } from '@phosphor-icons/react';
import { SystemRoles } from 'librechat-data-provider';
import {
  OGDialog,
  OGDialogTitle,
  OGDialogHeader,
  OGDialogContent,
  useToastContext,
} from '@librechat/client';
import type {
  TProject,
  ProjectMetaAdsSnapshot,
  ProjectMetaAdsAdSummary,
  ProjectMetaAdsAdSetSummary,
  ProjectMetaAdsCampaignSummary,
  ProjectMetaAdsObjectiveSummary,
  ProjectMetaAdsCampaignDelta,
  ProjectMetaAdsBudgetChange,
  ProjectMetaAdsTrendSeries,
  ProjectMetaAdsManualBudgetPayload,
  ProjectMetaAdsRecommendation,
} from 'librechat-data-provider';
import {
  useGetStartupConfig,
  useApplyProjectMetaAdsRecommendationMutation,
  useProjectMetaAdsQuery,
  useRunProjectMetaAdsMutation,
  useUpdateProjectMetaAdsBudgetMutation,
  useUpdateProjectMetaAdsMutation,
  useUpdateProjectMetaAdsTenantTokenMutation,
} from '~/data-provider';
import { useAuthContext, useLocalize } from '~/hooks';
import type { TranslationKeys } from '~/hooks';
import { logger } from '~/utils';
import { buildMetaAdsChatBrief, MAX_META_ADS_CHAT_BRIEF_ENTITIES } from './metaAdsChatBrief';

type MetaAdsRules = NonNullable<NonNullable<TProject['metaAds']>['rules']>;
type MetaAdsCreativeRules = NonNullable<NonNullable<TProject['metaAds']>['creativeRules']>;
type MetaAdsSettings = NonNullable<TProject['metaAds']>;
type MetaAdsRuleGroup = NonNullable<MetaAdsSettings['ruleGroups']>[number];
type MetaAdsRulesState = Required<
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
  Pick<MetaAdsRules, 'targetResultType' | 'primaryMetric' | 'minCtr' | 'maxCpc' | 'maxCpm'>;
type MetaAdsSettingsState = Omit<MetaAdsSettings, 'rules' | 'creativeRules'> & {
  rules: MetaAdsRulesState;
  creativeRules: Required<MetaAdsCreativeRules>;
};
type BudgetEditor = {
  entityLevel: ProjectMetaAdsManualBudgetPayload['entityLevel'];
  entityId: string;
  entityName?: string;
  currentBudget?: number;
};
type RuleGroupDraft = {
  id?: string;
  scope: 'global' | 'group';
  name: string;
  entityLevel: MetaAdsRuleGroup['entityLevel'];
  entityIds: string[];
  rules: MetaAdsRulesState;
  creativeRules: Required<MetaAdsCreativeRules>;
};
type BudgetConfirmation = ProjectMetaAdsManualBudgetPayload & {
  currentBudget?: number;
};
type ScheduleIntervalMinutes = NonNullable<MetaAdsSettings['scheduleIntervalMinutes']>;
type SelectedAdPreview = ProjectMetaAdsAdSummary | null;
type RequestError = {
  message?: unknown;
  response?: {
    data?: {
      message?: unknown;
    };
  };
};
type SettingsDrawer = 'account' | 'automation' | null;
type TableView = 'summary' | 'performance' | 'creative' | 'rules';
type DatePreset = 'today' | 'yesterday' | 'last_7d' | 'last_14d' | 'last_30d';
type PeriodFilter = DatePreset | 'custom';
type EvolutionLevel = 'campaign' | 'adset';
type EvolutionMetric = 'spend' | 'resultCount' | 'cpa';
type MetaAdsBiRankLevel = 'campaign' | 'adset' | 'ad';
type MetaAdsBiRankItem = {
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
  thumbnailUrls?: string[];
};
type MetaAdsBiRankings = {
  campaigns: MetaAdsBiRankItem[];
  adSets: MetaAdsBiRankItem[];
  ads: MetaAdsBiRankItem[];
};
type SummaryResultTypeOption = {
  resultType: string;
  totalSpend: number;
  totalResults: number;
  averageCostPerResult: number | null;
};
type TableColumnKey =
  | 'level'
  | 'name'
  | 'budget'
  | 'objective'
  | 'budgetMode'
  | 'frequency'
  | 'result'
  | 'cpa'
  | 'spend'
  | 'ctr'
  | 'clicks'
  | 'video'
  | 'rule'
  | 'recommendation'
  | 'actions';
type TableColumn = {
  key: TableColumnKey;
  labelKey?: TranslationKeys;
  label?: string;
  widthClass: string;
  align?: 'left' | 'right';
  sortableKey?: string;
  defaultDirection?: 'asc' | 'desc';
};
type Localize = ReturnType<typeof useLocalize>;

const scheduleOptions: Array<{ value: ScheduleIntervalMinutes; labelKey: TranslationKeys }> = [
  { value: 30, labelKey: 'com_ui_project_meta_ads_schedule_30' },
  { value: 60, labelKey: 'com_ui_project_meta_ads_schedule_60' },
  { value: 120, labelKey: 'com_ui_project_meta_ads_schedule_120' },
  { value: 180, labelKey: 'com_ui_project_meta_ads_schedule_180' },
  { value: 360, labelKey: 'com_ui_project_meta_ads_schedule_360' },
  { value: 720, labelKey: 'com_ui_project_meta_ads_schedule_720' },
  { value: 1440, labelKey: 'com_ui_project_meta_ads_schedule_1440' },
];

const periodOptions = [
  { value: 'today', labelKey: 'com_ui_project_meta_ads_period_today' },
  { value: 'yesterday', labelKey: 'com_ui_project_meta_ads_period_yesterday' },
  { value: 'last_7d', labelKey: 'com_ui_project_meta_ads_period_last_7d' },
  { value: 'last_14d', labelKey: 'com_ui_project_meta_ads_period_last_14d' },
  { value: 'last_30d', labelKey: 'com_ui_project_meta_ads_period_last_30d' },
] as const satisfies Array<{ value: DatePreset; labelKey: TranslationKeys }>;

const periodFilterOptions: Array<{ value: PeriodFilter; labelKey: TranslationKeys }> = [
  ...periodOptions,
  { value: 'custom', labelKey: 'com_ui_project_meta_ads_period_custom' },
];

const tableViewOptions: Array<{ value: TableView; labelKey: TranslationKeys }> = [
  { value: 'summary', labelKey: 'com_ui_project_meta_ads_view_summary' },
  { value: 'performance', labelKey: 'com_ui_project_meta_ads_view_performance' },
  { value: 'creative', labelKey: 'com_ui_project_meta_ads_view_creative' },
  { value: 'rules', labelKey: 'com_ui_project_meta_ads_view_rules' },
];

const tableColumnMap: Record<TableColumnKey, TableColumn> = {
  level: {
    key: 'level',
    labelKey: 'com_ui_project_meta_ads_delivery',
    widthClass: 'w-28',
  },
  name: {
    key: 'name',
    labelKey: 'com_ui_project_meta_ads_campaign',
    widthClass: 'w-80',
    sortableKey: 'name',
    defaultDirection: 'asc',
  },
  budget: {
    key: 'budget',
    labelKey: 'com_ui_project_meta_ads_budget_defined',
    widthClass: 'w-28',
    align: 'right',
    sortableKey: 'budget',
  },
  objective: {
    key: 'objective',
    labelKey: 'com_ui_project_meta_ads_objective',
    widthClass: 'w-40',
  },
  budgetMode: {
    key: 'budgetMode',
    labelKey: 'com_ui_project_meta_ads_budget_mode',
    widthClass: 'w-24',
  },
  frequency: {
    key: 'frequency',
    labelKey: 'com_ui_project_meta_ads_frequency',
    widthClass: 'w-32',
    align: 'right',
    sortableKey: 'frequency',
  },
  result: {
    key: 'result',
    labelKey: 'com_ui_project_meta_ads_results',
    widthClass: 'w-32',
    align: 'right',
    sortableKey: 'result',
  },
  cpa: {
    key: 'cpa',
    labelKey: 'com_ui_project_meta_ads_cost_result',
    widthClass: 'w-28',
    align: 'right',
    sortableKey: 'cpa',
    defaultDirection: 'asc',
  },
  spend: {
    key: 'spend',
    labelKey: 'com_ui_project_meta_ads_spend',
    widthClass: 'w-28',
    align: 'right',
    sortableKey: 'spend',
  },
  ctr: {
    key: 'ctr',
    label: 'CTR',
    widthClass: 'w-20',
    align: 'right',
    sortableKey: 'ctr',
  },
  clicks: {
    key: 'clicks',
    labelKey: 'com_ui_project_meta_ads_clicks',
    widthClass: 'w-24',
    align: 'right',
    sortableKey: 'clicks',
  },
  video: {
    key: 'video',
    labelKey: 'com_ui_project_meta_ads_video_p75',
    widthClass: 'w-24',
    align: 'right',
  },
  rule: {
    key: 'rule',
    labelKey: 'com_ui_project_meta_ads_rule',
    widthClass: 'w-40',
  },
  recommendation: {
    key: 'recommendation',
    labelKey: 'com_ui_project_meta_ads_recommendation',
    widthClass: 'w-64',
  },
  actions: {
    key: 'actions',
    labelKey: 'com_ui_project_meta_ads_actions',
    widthClass: 'w-32',
  },
};

const tableViewColumns: Record<TableView, TableColumnKey[]> = {
  summary: [
    'level',
    'name',
    'budget',
    'objective',
    'budgetMode',
    'spend',
    'result',
    'cpa',
    'frequency',
    'ctr',
    'clicks',
    'video',
    'rule',
    'recommendation',
    'actions',
  ],
  performance: [
    'level',
    'name',
    'budget',
    'objective',
    'budgetMode',
    'spend',
    'result',
    'cpa',
    'frequency',
    'ctr',
    'clicks',
    'video',
    'actions',
  ],
  creative: ['level', 'name', 'spend', 'ctr', 'cpa', 'frequency', 'result', 'clicks', 'actions'],
  rules: ['level', 'name', 'budget', 'rule', 'recommendation', 'actions'],
};

const tableViewMinWidth: Record<TableView, string> = {
  summary: 'min-w-[1900px]',
  performance: 'min-w-[1540px]',
  creative: 'min-w-[1160px]',
  rules: 'min-w-[1060px]',
};

const defaultRules: MetaAdsRulesState = {
  targetCpa: 45,
  targetResultType: '',
  primaryMetric: 'cpa',
  minRoas: 2,
  maxIncreasePct: 25,
  maxDecreasePct: 25,
  minDailyBudget: 20,
  maxDailyBudget: 500,
  cooldownHours: 24,
  minSpend: 10,
};
const defaultCreativeRules: Required<MetaAdsCreativeRules> = {
  maxFrequency: 5,
};

const accountProfileOptions = [
  { value: 'local_business', labelKey: 'com_ui_project_meta_ads_profile_local_business' },
  { value: 'ecommerce', labelKey: 'com_ui_project_meta_ads_profile_ecommerce' },
  { value: 'lead_gen', labelKey: 'com_ui_project_meta_ads_profile_lead_gen' },
  { value: 'traffic', labelKey: 'com_ui_project_meta_ads_profile_traffic' },
  { value: 'custom', labelKey: 'com_ui_project_meta_ads_profile_custom' },
] as const;

const resultTypeOptions = [
  {
    value: 'onsite_conversion.messaging_conversation_started_7d',
    labelKey: 'com_ui_project_meta_ads_result_type_message',
  },
  { value: 'lead', labelKey: 'com_ui_project_meta_ads_result_type_lead' },
  { value: 'purchase', labelKey: 'com_ui_project_meta_ads_result_type_purchase' },
  { value: 'link_click', labelKey: 'com_ui_project_meta_ads_result_type_link_click' },
  {
    value: 'landing_page_view',
    labelKey: 'com_ui_project_meta_ads_result_type_landing_page_view',
  },
  { value: 'post_engagement', labelKey: 'com_ui_project_meta_ads_result_type_post_engagement' },
] as const;
const BI_TOP_LIMIT = 5;
const EVOLUTION_SERIES_LIMIT = 5;
const evolutionColors = ['#f3efe6', '#8fd4ff', '#9ce6b4', '#f4c76b', '#f29bb2'] as const;

const primaryMetricOptions = [
  { value: 'cpa', labelKey: 'com_ui_project_meta_ads_primary_metric_cpa' },
  { value: 'roas', labelKey: 'com_ui_project_meta_ads_primary_metric_roas' },
  { value: 'cpc', labelKey: 'com_ui_project_meta_ads_primary_metric_cpc' },
  { value: 'ctr', labelKey: 'com_ui_project_meta_ads_primary_metric_ctr' },
] as const;

const metaAdsSurface =
  'border border-white/10 bg-[#10110f] text-[#f3efe6] dark:border-white/10 dark:bg-[#10110f]';
const metaAdsPanel = 'border border-white/10 bg-[#151512] dark:border-white/10 dark:bg-[#151512]';
const metaAdsMutedPanel =
  'border border-white/10 bg-[#1f1d18] dark:border-white/10 dark:bg-[#1f1d18]';
const metaAdsInput =
  'h-9 w-full min-w-0 border border-white/10 bg-[#0f0e0b] px-3 text-xs text-[#f3efe6] outline-none transition duration-200 placeholder:text-[#81796b] hover:border-amber-500/40 focus:border-amber-400 focus:ring-2 focus:ring-amber-500/15 disabled:cursor-not-allowed disabled:opacity-60';
const metaAdsInputLg =
  'h-10 w-full min-w-0 border border-white/10 bg-[#0f0e0b] px-3 text-sm text-[#f3efe6] outline-none transition duration-200 placeholder:text-[#81796b] hover:border-amber-500/40 focus:border-amber-400 focus:ring-2 focus:ring-amber-500/15 disabled:cursor-not-allowed disabled:opacity-60';
const metaAdsButton =
  'h-9 border border-white/10 bg-[#1d1a14] px-3 text-xs font-semibold text-[#f3efe6] shadow-[0_12px_30px_-24px_rgba(245,158,11,0.65)] transition duration-200 hover:-translate-y-0.5 hover:border-amber-400/50 hover:bg-[#292318] active:translate-y-0 disabled:cursor-not-allowed disabled:translate-y-0 disabled:opacity-50';
const metaAdsGhostButton =
  'h-9 border border-white/10 px-3 text-xs font-semibold text-[#bdb5a6] transition duration-200 hover:border-amber-400/40 hover:bg-[#221f18] hover:text-[#f3efe6] active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50';
const metaAdsPrimaryButton =
  'h-9 bg-[#f2eadb] px-4 text-xs font-semibold text-[#17130c] shadow-[0_16px_36px_-24px_rgba(242,234,219,0.75)] transition duration-200 hover:-translate-y-0.5 hover:bg-white active:translate-y-0 disabled:cursor-not-allowed disabled:translate-y-0 disabled:opacity-60';
const metaAdsLabel =
  'min-h-8 text-[11px] font-medium uppercase leading-tight tracking-[0.14em] text-[#948b7d]';
const objectiveAccentClasses = [
  {
    shell: 'border-amber-400/20 bg-amber-500/5',
    bar: 'bg-amber-300',
    text: 'text-amber-200',
  },
  {
    shell: 'border-emerald-400/20 bg-emerald-500/5',
    bar: 'bg-emerald-300',
    text: 'text-emerald-200',
  },
  {
    shell: 'border-sky-400/20 bg-sky-500/5',
    bar: 'bg-sky-300',
    text: 'text-sky-200',
  },
  {
    shell: 'border-rose-400/20 bg-rose-500/5',
    bar: 'bg-rose-300',
    text: 'text-rose-200',
  },
] as const;

const accountProfileRules: Record<
  (typeof accountProfileOptions)[number]['value'],
  Partial<MetaAdsRulesState>
> = {
  local_business: {
    targetResultType: 'onsite_conversion.messaging_conversation_started_7d',
    primaryMetric: 'cpa',
    targetCpa: 45,
  },
  ecommerce: {
    targetResultType: 'purchase',
    primaryMetric: 'roas',
    minRoas: 2,
  },
  lead_gen: {
    targetResultType: 'lead',
    primaryMetric: 'cpa',
    targetCpa: 45,
  },
  traffic: {
    targetResultType: 'link_click',
    primaryMetric: 'cpc',
    maxCpc: 2,
    minCtr: 1,
  },
  custom: {},
};

const objectiveLabelKeys: Record<string, TranslationKeys> = {
  OUTCOME_APP_PROMOTION: 'com_ui_project_meta_ads_objective_app_promotion',
  OUTCOME_AWARENESS: 'com_ui_project_meta_ads_objective_awareness',
  OUTCOME_ENGAGEMENT: 'com_ui_project_meta_ads_objective_engagement',
  OUTCOME_LEADS: 'com_ui_project_meta_ads_objective_leads',
  OUTCOME_SALES: 'com_ui_project_meta_ads_objective_sales',
  OUTCOME_TRAFFIC: 'com_ui_project_meta_ads_objective_traffic',
  UNKNOWN: 'com_ui_project_meta_ads_objective_unknown',
};

const resultTypeLabelKeys: Record<string, TranslationKeys> = {
  landing_page_view: 'com_ui_project_meta_ads_result_type_landing_page_view',
  lead: 'com_ui_project_meta_ads_result_type_lead',
  leadgen_grouped: 'com_ui_project_meta_ads_result_type_lead',
  link_click: 'com_ui_project_meta_ads_result_type_link_click',
  onsite_conversion_lead_grouped: 'com_ui_project_meta_ads_result_type_lead',
  onsite_conversion_messaging_conversation_started_7d:
    'com_ui_project_meta_ads_result_type_message',
  onsite_conversion_messaging_first_reply: 'com_ui_project_meta_ads_result_type_message',
  post_engagement: 'com_ui_project_meta_ads_result_type_post_engagement',
  offsite_conversion_fb_pixel_lead: 'com_ui_project_meta_ads_result_type_lead',
  offsite_conversion_fb_pixel_purchase: 'com_ui_project_meta_ads_result_type_purchase',
  omni_purchase: 'com_ui_project_meta_ads_result_type_purchase',
  purchase: 'com_ui_project_meta_ads_result_type_purchase',
  UNKNOWN: 'com_ui_project_meta_ads_result_type_unknown',
};

const numberFields: Array<{
  key: keyof MetaAdsRulesState;
  labelKey: TranslationKeys;
  step: string;
}> = [
  { key: 'targetCpa', labelKey: 'com_ui_project_meta_ads_target_cpa', step: '0.01' },
  { key: 'minRoas', labelKey: 'com_ui_project_meta_ads_min_roas', step: '0.01' },
  { key: 'maxIncreasePct', labelKey: 'com_ui_project_meta_ads_max_increase', step: '1' },
  { key: 'maxDecreasePct', labelKey: 'com_ui_project_meta_ads_max_decrease', step: '1' },
  { key: 'minDailyBudget', labelKey: 'com_ui_project_meta_ads_min_budget', step: '0.01' },
  { key: 'maxDailyBudget', labelKey: 'com_ui_project_meta_ads_max_budget', step: '0.01' },
  { key: 'cooldownHours', labelKey: 'com_ui_project_meta_ads_cooldown', step: '1' },
  { key: 'minSpend', labelKey: 'com_ui_project_meta_ads_min_spend', step: '0.01' },
];

const optionalNumberFields: Array<{
  key: keyof MetaAdsRulesState;
  labelKey: TranslationKeys;
  step: string;
}> = [
  { key: 'minCtr', labelKey: 'com_ui_project_meta_ads_min_ctr', step: '0.01' },
  { key: 'maxCpc', labelKey: 'com_ui_project_meta_ads_max_cpc', step: '0.01' },
  { key: 'maxCpm', labelKey: 'com_ui_project_meta_ads_max_cpm', step: '0.01' },
];

function formatMetric(value?: number | null) {
  return value == null || Number.isNaN(value) ? '-' : value.toFixed(2);
}

function formatIntegerMetric(value?: number | null) {
  return value == null || Number.isNaN(value)
    ? '-'
    : new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value);
}

function formatMoney(value: number | null | undefined, currency = 'BRL') {
  if (value == null || Number.isNaN(value)) {
    return '-';
  }
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency,
  }).format(value);
}

function formatRankingCost(value: number | null | undefined, currency = 'BRL') {
  if (value == null || Number.isNaN(value)) {
    return '-';
  }
  const precision = Math.abs(value) > 0 && Math.abs(value) < 0.1 ? 4 : 2;
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency,
    minimumFractionDigits: precision,
    maximumFractionDigits: precision,
  }).format(value);
}

function formatSignedMoney(value: number | null | undefined, currency = 'BRL') {
  if (value == null || Number.isNaN(value)) {
    return '-';
  }
  const sign = value > 0 ? '+' : value < 0 ? '-' : '';
  return `${sign}${formatMoney(Math.abs(value), currency)}`;
}

function formatSignedPercent(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) {
    return '-';
  }
  const sign = value > 0 ? '+' : value < 0 ? '-' : '';
  return `${sign}${Math.abs(value).toFixed(2)}%`;
}

function formatPercent(value: number | null | undefined) {
  return value == null || Number.isNaN(value) ? '-' : `${value.toFixed(2)}%`;
}

function formatSignedMetric(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) {
    return '-';
  }
  const sign = value > 0 ? '+' : value < 0 ? '-' : '';
  return `${sign}${Math.abs(value).toFixed(2)}`;
}

function formatTrendDate(value: string) {
  const [, yearOnly, monthOnly] = value.match(/^(\d{4})-(\d{2})$/) ?? [];
  if (yearOnly && monthOnly) {
    return `${monthOnly}/${yearOnly}`;
  }
  const [, month, day] = value.match(/^(\d{4})-(\d{2})-(\d{2})$/) ?? [];
  return month && day ? `${day}/${month}` : value;
}

function shouldShowTrendLabel(index: number, total: number) {
  if (total <= 4) {
    return true;
  }
  if (index === 0 || index === total - 1) {
    return true;
  }
  const interval = Math.ceil((total - 2) / 2);
  return (index - 1) % interval === 0;
}

function buildChartPath(points: Array<{ x: number; y: number }>) {
  return points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(' ');
}

function getEvolutionMetricValue(
  point: ProjectMetaAdsTrendSeries['points'][number],
  metric: EvolutionMetric,
) {
  const value = point[metric];
  return value == null || Number.isNaN(Number(value)) ? null : Number(value);
}

function formatEvolutionMetricValue(
  value: number | null | undefined,
  metric: EvolutionMetric,
  currency: string,
) {
  if (metric === 'spend' || metric === 'cpa') {
    return formatMoney(value, currency);
  }
  return formatMetric(value);
}

function getEvolutionMetricLabel(metric: EvolutionMetric, localize: Localize) {
  const labelKeys: Record<EvolutionMetric, TranslationKeys> = {
    spend: 'com_ui_project_meta_ads_spend',
    resultCount: 'com_ui_project_meta_ads_results',
    cpa: 'com_ui_project_meta_ads_cpa',
  };
  return localize(labelKeys[metric]);
}

function getEvolutionSeriesTotal(series: ProjectMetaAdsTrendSeries, metric: EvolutionMetric) {
  if (metric === 'cpa') {
    const lastPoint = [...series.points]
      .reverse()
      .find((point) => getEvolutionMetricValue(point, metric) != null);
    return getEvolutionMetricValue(lastPoint ?? series.points[0], metric) ?? 0;
  }
  return series.points.reduce(
    (sum, point) => sum + Number(getEvolutionMetricValue(point, metric) ?? 0),
    0,
  );
}

function hasMeaningfulDelta(delta: ProjectMetaAdsCampaignDelta) {
  return [
    delta.spendDelta,
    delta.resultDelta,
    delta.cpaDelta,
    delta.budgetDelta,
    delta.frequencyDelta,
  ].some((value) => {
    const numericValue = Number(value ?? 0);
    return Number.isFinite(numericValue) && Math.abs(numericValue) > 0.005;
  });
}

function cleanDashboardName(value: string | undefined, fallback: string) {
  const cleanedValue = (value ?? '').replace(/^[^\w[]+\s*/u, '').trim();
  return cleanedValue || value || fallback;
}

function toMetaAdsLabelKey(value?: string | null) {
  return (value || 'UNKNOWN').replace(/\./g, '_');
}

function formatMetaAdsCode(value?: string | null) {
  const normalized = (value || 'UNKNOWN').replace(/^OUTCOME_/, '').replace(/[_.]+/g, ' ');
  return normalized
    .toLowerCase()
    .replace(/(^|\s)\S/g, (letter) => letter.toLocaleUpperCase('pt-BR'));
}

function getObjectiveLabel(objective: string | undefined, localize: Localize) {
  const key = objectiveLabelKeys[objective || 'UNKNOWN'];
  return key ? localize(key) : formatMetaAdsCode(objective);
}

function getResultTypeLabel(resultType: string | undefined, localize: Localize) {
  const key = resultTypeLabelKeys[toMetaAdsLabelKey(resultType)];
  return key ? localize(key) : formatMetaAdsCode(resultType);
}

function formatCountLabel(
  count: number,
  singularKey: TranslationKeys,
  pluralKey: TranslationKeys,
  localize: Localize,
) {
  return localize(count === 1 ? singularKey : pluralKey, { 0: String(count) });
}

function formatSharePercent(value: number, total: number) {
  return total > 0 ? `${((value / total) * 100).toFixed(1)}%` : '-';
}

function getShareWidth(value: number, total: number) {
  if (!Number.isFinite(value) || !Number.isFinite(total) || total <= 0) {
    return '0%';
  }
  return `${Math.min(100, Math.max(0, (value / total) * 100)).toFixed(2)}%`;
}

function getRankEfficiency(item: MetaAdsBiRankItem) {
  const cpa = Number(item.cpa);
  if (Number.isFinite(cpa) && cpa > 0) {
    return cpa;
  }
  const spend = Number(item.spend);
  const resultCount = Number(item.resultCount);
  if (Number.isFinite(spend) && spend > 0 && Number.isFinite(resultCount) && resultCount > 0) {
    return spend / resultCount;
  }
  return null;
}

function hasValidRankMetric(item: MetaAdsBiRankItem) {
  const resultCount = Number(item.resultCount);
  return Number.isFinite(resultCount) && resultCount > 0 && getRankEfficiency(item) != null;
}

function hasRelevantRankVolume(item: MetaAdsBiRankItem, minSpend: number) {
  const spend = Number(item.spend);
  const resultCount = Number(item.resultCount);
  return (
    Number.isFinite(spend) && spend >= minSpend && Number.isFinite(resultCount) && resultCount >= 1
  );
}

function sortBiRankItems(items: MetaAdsBiRankItem[], minSpend: number) {
  return [...items]
    .filter((item) => hasValidRankMetric(item) && hasRelevantRankVolume(item, minSpend))
    .sort((left, right) => {
      const leftEfficiency = getRankEfficiency(left) ?? Number.POSITIVE_INFINITY;
      const rightEfficiency = getRankEfficiency(right) ?? Number.POSITIVE_INFINITY;
      const efficiencyDiff = leftEfficiency - rightEfficiency;
      if (Math.abs(efficiencyDiff) > 0.005) {
        return efficiencyDiff;
      }
      const resultDiff = Number(right.resultCount ?? 0) - Number(left.resultCount ?? 0);
      if (Math.abs(resultDiff) > 0.005) {
        return resultDiff;
      }
      return Number(right.spend ?? 0) - Number(left.spend ?? 0);
    })
    .slice(0, BI_TOP_LIMIT);
}

function matchesBiFilters(
  item: MetaAdsBiRankItem,
  objectiveFilter: string,
  resultTypeFilter: string,
) {
  const objective = item.objective || 'UNKNOWN';
  const resultType = item.resultType || 'UNKNOWN';
  return (
    (objectiveFilter === 'all' || objective === objectiveFilter) &&
    (resultTypeFilter === 'all' || resultType === resultTypeFilter)
  );
}

function toAdSetRankItem(
  campaign: ProjectMetaAdsCampaignSummary,
  adSet: ProjectMetaAdsAdSetSummary,
): MetaAdsBiRankItem {
  return {
    id: adSet.entityId,
    level: 'adset',
    name: adSet.entityName ?? adSet.entityId,
    parentName: campaign.campaignName ?? campaign.campaignId,
    objective: campaign.objective || 'UNKNOWN',
    resultType: adSet.resultType || campaign.resultType || 'UNKNOWN',
    resultCount: adSet.resultCount,
    cpa: adSet.cpa,
    spend: adSet.spend,
    ctr: adSet.ctr,
    thumbnailUrls: collectAdThumbnails(adSet.ads ?? []),
  };
}

function toAdRankItem(
  campaign: ProjectMetaAdsCampaignSummary,
  adSet: ProjectMetaAdsAdSetSummary,
  ad: ProjectMetaAdsAdSummary,
): MetaAdsBiRankItem {
  return {
    id: ad.adId,
    level: 'ad',
    name: ad.adName ?? ad.adId,
    parentName: adSet.entityName ?? campaign.campaignName ?? campaign.campaignId,
    objective: campaign.objective || 'UNKNOWN',
    resultType: ad.resultType || adSet.resultType || campaign.resultType || 'UNKNOWN',
    resultCount: ad.resultCount,
    cpa: ad.cpa,
    spend: ad.spend,
    ctr: ad.ctr,
    thumbnailUrls: collectAdThumbnails([ad]),
  };
}

function buildMetaAdsBiRankings(
  campaigns: ProjectMetaAdsCampaignSummary[],
  objectiveFilter: string,
  resultTypeFilter: string,
  minSpend: number,
): MetaAdsBiRankings {
  const campaignItems: MetaAdsBiRankItem[] = [];
  const adSetItems: MetaAdsBiRankItem[] = [];
  const adItems: MetaAdsBiRankItem[] = [];

  for (const campaign of campaigns) {
    const campaignItem: MetaAdsBiRankItem = {
      id: campaign.campaignId,
      level: 'campaign',
      name: campaign.campaignName ?? campaign.campaignId,
      objective: campaign.objective || 'UNKNOWN',
      resultType: campaign.resultType || 'UNKNOWN',
      resultCount: campaign.resultCount,
      cpa: campaign.cpa,
      spend: campaign.spend,
      ctr: campaign.ctr,
      thumbnailUrls: collectAdThumbnails(
        (campaign.adSets ?? []).flatMap((adSet) => adSet.ads ?? []),
      ),
    };
    if (matchesBiFilters(campaignItem, objectiveFilter, resultTypeFilter)) {
      campaignItems.push(campaignItem);
    }

    for (const adSet of campaign.adSets ?? []) {
      const adSetItem = toAdSetRankItem(campaign, adSet);
      if (matchesBiFilters(adSetItem, objectiveFilter, resultTypeFilter)) {
        adSetItems.push(adSetItem);
      }

      for (const ad of adSet.ads ?? []) {
        const adItem = toAdRankItem(campaign, adSet, ad);
        if (matchesBiFilters(adItem, objectiveFilter, resultTypeFilter)) {
          adItems.push(adItem);
        }
      }
    }
  }

  return {
    campaigns: sortBiRankItems(campaignItems, minSpend),
    adSets: sortBiRankItems(adSetItems, minSpend),
    ads: sortBiRankItems(adItems, minSpend),
  };
}

function collectBiResultTypes(campaigns: ProjectMetaAdsCampaignSummary[]) {
  const resultTypes = new Set<string>();
  for (const campaign of campaigns) {
    resultTypes.add(campaign.resultType || 'UNKNOWN');
    for (const adSet of campaign.adSets ?? []) {
      resultTypes.add(adSet.resultType || campaign.resultType || 'UNKNOWN');
      for (const ad of adSet.ads ?? []) {
        resultTypes.add(ad.resultType || adSet.resultType || campaign.resultType || 'UNKNOWN');
      }
    }
  }
  return Array.from(resultTypes);
}

type FrequencyAccumulator = {
  frequencyWeightedTotal: number;
  frequencyWeight: number;
  frequencyTotal: number;
  frequencyCount: number;
};

function addFrequencySample(
  target: FrequencyAccumulator,
  frequency: number | null | undefined,
  impressions: number | null | undefined,
) {
  const numericFrequency = Number(frequency);
  if (!Number.isFinite(numericFrequency)) {
    return;
  }
  const numericImpressions = Number(impressions);
  if (Number.isFinite(numericImpressions) && numericImpressions > 0) {
    target.frequencyWeightedTotal += numericFrequency * numericImpressions;
    target.frequencyWeight += numericImpressions;
    return;
  }
  target.frequencyTotal += numericFrequency;
  target.frequencyCount += 1;
}

function resolveAverageFrequency(target: FrequencyAccumulator) {
  if (target.frequencyWeight > 0) {
    return Number((target.frequencyWeightedTotal / target.frequencyWeight).toFixed(2));
  }
  return target.frequencyCount > 0
    ? Number((target.frequencyTotal / target.frequencyCount).toFixed(2))
    : null;
}

function createObjectiveSummary(objective: string): ProjectMetaAdsObjectiveSummary {
  return {
    objective,
    label: objective,
    campaignCount: 0,
    totalSpend: 0,
    totalResults: 0,
    averageCostPerResult: null,
    averageFrequency: null,
    averageCtr: null,
    resultTypes: [],
  };
}

type ResultTypeSummary = NonNullable<ProjectMetaAdsObjectiveSummary['resultTypes']>[number];

function addResultTypeSummary(
  resultTypeMap: Map<string, ResultTypeSummary>,
  resultType: string | undefined,
  spend: number | null | undefined,
  results: number | null | undefined,
  clicks: number | null | undefined,
  impressions: number | null | undefined,
) {
  const resultTypeKey = resultType || 'UNKNOWN';
  const resultTypeSummary = resultTypeMap.get(resultTypeKey) ?? {
    resultType: resultTypeKey,
    label: resultTypeKey,
    totalSpend: 0,
    totalResults: 0,
    averageCostPerResult: null,
    clicks: 0,
    impressions: 0,
    averageCtr: null,
  };
  resultTypeMap.set(resultTypeKey, resultTypeSummary);
  resultTypeSummary.totalSpend += Number(spend ?? 0);
  resultTypeSummary.totalResults += Number(results ?? 0);
  resultTypeSummary.clicks = Number(resultTypeSummary.clicks ?? 0) + Number(clicks ?? 0);
  resultTypeSummary.impressions =
    Number(resultTypeSummary.impressions ?? 0) + Number(impressions ?? 0);
}

function getCompatibleResultTotals(resultTypeMap: Map<string, ResultTypeSummary>) {
  if (resultTypeMap.size !== 1) {
    return {
      totalResults: null,
      averageCostPerResult: null,
    };
  }
  const [resultType] = Array.from(resultTypeMap.values());
  return {
    totalResults: Number(resultType.totalResults.toFixed(2)),
    averageCostPerResult:
      resultType.totalResults > 0
        ? Number((resultType.totalSpend / resultType.totalResults).toFixed(2))
        : null,
  };
}

function buildSummaryResultTypeOptions(
  objectiveSummaries: ProjectMetaAdsObjectiveSummary[],
  objectiveFilter: string,
): SummaryResultTypeOption[] {
  const options = new Map<string, SummaryResultTypeOption>();
  const summaries =
    objectiveFilter === 'all'
      ? objectiveSummaries
      : objectiveSummaries.filter(
          (summary) => (summary.objective || 'UNKNOWN') === objectiveFilter,
        );

  for (const summary of summaries) {
    for (const resultType of summary.resultTypes) {
      const resultTypeKey = resultType.resultType || 'UNKNOWN';
      const option =
        options.get(resultTypeKey) ??
        ({
          resultType: resultTypeKey,
          totalSpend: 0,
          totalResults: 0,
          averageCostPerResult: null,
        } satisfies SummaryResultTypeOption);
      option.totalSpend += Number(resultType.totalSpend ?? 0);
      option.totalResults += Number(resultType.totalResults ?? 0);
      options.set(resultTypeKey, option);
    }
  }

  return Array.from(options.values())
    .map((option) => ({
      ...option,
      totalSpend: Number(option.totalSpend.toFixed(2)),
      totalResults: Number(option.totalResults.toFixed(2)),
      averageCostPerResult:
        option.totalResults > 0
          ? Number((option.totalSpend / option.totalResults).toFixed(2))
          : null,
    }))
    .sort((left, right) => Number(right.totalResults ?? 0) - Number(left.totalResults ?? 0));
}

function buildObjectiveSummaries(
  campaigns: ProjectMetaAdsCampaignSummary[],
): ProjectMetaAdsObjectiveSummary[] {
  const objectives = new Map<
    string,
    ProjectMetaAdsObjectiveSummary & {
      impressions: number;
      clicks: number;
      frequencyWeightedTotal: number;
      frequencyWeight: number;
      frequencyTotal: number;
      frequencyCount: number;
      resultTypeMap: Map<
        string,
        NonNullable<ProjectMetaAdsObjectiveSummary['resultTypes']>[number]
      >;
    }
  >();

  for (const campaign of campaigns) {
    const objective = campaign.objective || 'UNKNOWN';
    const summary =
      objectives.get(objective) ??
      ({
        ...createObjectiveSummary(objective),
        impressions: 0,
        clicks: 0,
        frequencyWeightedTotal: 0,
        frequencyWeight: 0,
        frequencyTotal: 0,
        frequencyCount: 0,
        resultTypeMap: new Map(),
      } as ProjectMetaAdsObjectiveSummary & {
        impressions: number;
        clicks: number;
        frequencyWeightedTotal: number;
        frequencyWeight: number;
        frequencyTotal: number;
        frequencyCount: number;
        resultTypeMap: Map<
          string,
          NonNullable<ProjectMetaAdsObjectiveSummary['resultTypes']>[number]
        >;
      });
    objectives.set(objective, summary);

    const spend = Number(campaign.spend ?? 0);
    const results = Number(campaign.resultCount ?? 0);
    const impressions = Number(campaign.impressions ?? 0);
    const clicks = Number(campaign.clicks ?? 0);

    summary.campaignCount += 1;
    summary.totalSpend += Number.isFinite(spend) ? spend : 0;
    summary.totalResults += Number.isFinite(results) ? results : 0;
    summary.impressions += Number.isFinite(impressions) ? impressions : 0;
    summary.clicks += Number.isFinite(clicks) ? clicks : 0;
    addFrequencySample(summary, campaign.frequency, impressions);

    const sources = campaign.adSets.length > 0 ? campaign.adSets : [campaign];
    for (const source of sources) {
      addResultTypeSummary(
        summary.resultTypeMap,
        source.resultType || campaign.resultType || 'UNKNOWN',
        source.spend,
        source.resultCount,
        source.clicks,
        source.impressions,
      );
    }
  }

  return Array.from(objectives.values())
    .map((summary) => {
      const resultTypes = Array.from(summary.resultTypeMap.values()).map((resultType) => ({
        ...resultType,
        totalSpend: Number(resultType.totalSpend.toFixed(2)),
        totalResults: Number(resultType.totalResults.toFixed(2)),
        averageCostPerResult:
          resultType.totalResults > 0
            ? Number((resultType.totalSpend / resultType.totalResults).toFixed(2))
            : null,
        averageCtr:
          Number(resultType.impressions ?? 0) > 0
            ? Number(
                (
                  (Number(resultType.clicks ?? 0) / Number(resultType.impressions ?? 0)) *
                  100
                ).toFixed(2),
              )
            : null,
      }));
      const compatibleResults = getCompatibleResultTotals(summary.resultTypeMap);
      return {
        objective: summary.objective,
        label: summary.label,
        campaignCount: summary.campaignCount,
        totalSpend: Number(summary.totalSpend.toFixed(2)),
        totalResults: compatibleResults.totalResults,
        averageCostPerResult: compatibleResults.averageCostPerResult,
        averageFrequency: resolveAverageFrequency(summary),
        averageCtr:
          summary.impressions > 0
            ? Number(((summary.clicks / summary.impressions) * 100).toFixed(2))
            : null,
        resultTypes: resultTypes.sort(
          (left, right) => Number(right.totalResults ?? 0) - Number(left.totalResults ?? 0),
        ),
      };
    })
    .sort((left, right) => Number(right.totalSpend ?? 0) - Number(left.totalSpend ?? 0));
}

function buildBudgetReferences(currentBudget: number | null | undefined, currency = 'BRL') {
  const current = Number(currentBudget);
  if (!Number.isFinite(current) || current <= 0) {
    return [];
  }
  return [-30, -20, -15, 15, 20, 30].map((percent) => {
    const value = Number((current * (1 + percent / 100)).toFixed(2));
    return {
      percent,
      value,
      label: `${percent > 0 ? '+' : ''}${percent}%`,
      formattedValue: formatMoney(value, currency),
      accessibleLabel: `${percent > 0 ? '+' : ''}${percent}% ${formatMoney(value, currency).replace(/\u00a0/g, ' ')}`,
      tone:
        percent < 0
          ? 'border-rose-300/25 bg-rose-500/10 text-rose-100 hover:border-rose-300/50 hover:bg-rose-500/15'
          : 'border-emerald-300/25 bg-emerald-500/10 text-emerald-100 hover:border-emerald-300/50 hover:bg-emerald-500/15',
    };
  });
}

function getBudgetChangeDelta(change: ProjectMetaAdsBudgetChange) {
  if (change.deltaDailyBudget != null) {
    return {
      deltaDailyBudget: change.deltaDailyBudget,
      deltaPercent: change.deltaPercent ?? null,
    };
  }
  const previous = Number(change.previousDailyBudget);
  const next = Number(change.newDailyBudget);
  if (!Number.isFinite(next)) {
    return {
      deltaDailyBudget: null,
      deltaPercent: null,
    };
  }
  const deltaDailyBudget = Number((next - (Number.isFinite(previous) ? previous : 0)).toFixed(2));
  const deltaPercent =
    Number.isFinite(previous) && previous > 0
      ? Number(((deltaDailyBudget / previous) * 100).toFixed(2))
      : null;
  return {
    deltaDailyBudget,
    deltaPercent,
  };
}

type CampaignFallbackAccumulator = ProjectMetaAdsCampaignSummary &
  FrequencyAccumulator & {
    cpaSpendTotal: number;
    cpaResultTotal: number;
  };

function addFiniteMetric(
  target: ProjectMetaAdsCampaignSummary,
  key: keyof Pick<
    ProjectMetaAdsCampaignSummary,
    'spend' | 'resultCount' | 'dailyBudget' | 'impressions' | 'reach' | 'clicks' | 'videoP75Watched'
  >,
  value: number | null | undefined,
) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return;
  }
  target[key] = Number(target[key] ?? 0) + numericValue;
}

function buildCampaignFallback(
  snapshots: ProjectMetaAdsSnapshot[],
): ProjectMetaAdsCampaignSummary[] {
  const campaigns = new Map<string, CampaignFallbackAccumulator>();

  for (const snapshot of snapshots) {
    const campaignId = snapshot.campaignId ?? snapshot.entityId;
    const campaign =
      campaigns.get(campaignId) ??
      ({
        campaignId,
        campaignName: snapshot.campaignName ?? snapshot.entityName,
        objective: snapshot.campaignObjective,
        resultType: snapshot.resultType,
        budgetLevel: 'adset',
        editableBudgetLevel: 'adset',
        adSets: [],
        cpaSpendTotal: 0,
        cpaResultTotal: 0,
        frequencyWeightedTotal: 0,
        frequencyWeight: 0,
        frequencyTotal: 0,
        frequencyCount: 0,
      } as CampaignFallbackAccumulator);
    campaigns.set(campaignId, campaign);

    campaign.campaignName ??= snapshot.campaignName ?? snapshot.entityName;
    campaign.objective ??= snapshot.campaignObjective;
    campaign.resultType ??= snapshot.resultType;
    addFiniteMetric(campaign, 'spend', snapshot.spend);
    addFiniteMetric(campaign, 'resultCount', snapshot.resultCount);
    addFiniteMetric(campaign, 'dailyBudget', snapshot.dailyBudget);
    addFiniteMetric(campaign, 'impressions', snapshot.impressions);
    addFiniteMetric(campaign, 'reach', snapshot.reach);
    addFiniteMetric(campaign, 'clicks', snapshot.clicks);
    addFiniteMetric(campaign, 'videoP75Watched', snapshot.videoP75Watched);
    addFrequencySample(campaign, snapshot.frequency, snapshot.impressions);
    campaign.frequency = resolveAverageFrequency(campaign) ?? undefined;
    if (Number(snapshot.resultCount ?? 0) > 0) {
      campaign.cpaSpendTotal += Number(snapshot.spend ?? 0);
      campaign.cpaResultTotal += Number(snapshot.resultCount ?? 0);
    }
    campaign.adSets.push(snapshot);
  }

  return Array.from(campaigns.values()).map((campaign) => {
    const cpa =
      campaign.cpaResultTotal > 0
        ? Number((campaign.cpaSpendTotal / campaign.cpaResultTotal).toFixed(2))
        : null;
    const ctr =
      Number(campaign.impressions ?? 0) > 0
        ? Number(
            ((Number(campaign.clicks ?? 0) / Number(campaign.impressions ?? 0)) * 100).toFixed(2),
          )
        : undefined;
    return {
      campaignId: campaign.campaignId,
      campaignName: campaign.campaignName,
      objective: campaign.objective,
      spend: campaign.spend,
      cpa,
      resultCount: campaign.resultCount,
      resultType: campaign.resultType,
      dailyBudget: campaign.dailyBudget,
      impressions: campaign.impressions,
      reach: campaign.reach,
      frequency: campaign.frequency,
      clicks: campaign.clicks,
      ctr,
      videoP75Watched: campaign.videoP75Watched,
      budgetLevel: campaign.budgetLevel,
      editableBudgetLevel: campaign.editableBudgetLevel,
      budgetMode: campaign.budgetMode,
      adSets: campaign.adSets,
    };
  });
}

function getAdAccountDigits(value?: string) {
  return (value ?? '').replace(/^act_/i, '').replace(/\D/g, '');
}

function toAdAccountId(value: string) {
  const digits = getAdAccountDigits(value);
  return digits ? `act_${digits}` : '';
}

function isSupportedGraphVersion(value?: string) {
  const match = value?.trim().match(/^v(\d+)\.0$/);
  return match ? Number(match[1]) >= 24 : false;
}

function getGraphVersionOptions(effectiveVersion?: string) {
  return Array.from(
    new Set([
      'v24.0',
      'v25.0',
      ...(isSupportedGraphVersion(effectiveVersion) ? [effectiveVersion] : []),
    ]),
  );
}

function normalizeSettings(project: TProject): MetaAdsSettingsState {
  return {
    enabled: project.metaAds?.enabled ?? false,
    adAccountId: project.metaAds?.adAccountId ?? '',
    tokenSecretName: project.metaAds?.tokenSecretName ?? '',
    graphVersion: isSupportedGraphVersion(project.metaAds?.graphVersion)
      ? project.metaAds?.graphVersion
      : '',
    credentialMode: project.metaAds?.tokenSecretName ? 'project_secret' : 'tenant_default',
    accountProfile: project.metaAds?.accountProfile ?? 'custom',
    automationMode: project.metaAds?.automationMode ?? 'recommend',
    budgetLevel: 'adset',
    scheduleIntervalMinutes: project.metaAds?.scheduleIntervalMinutes ?? 180,
    lastRunAt: project.metaAds?.lastRunAt,
    ruleGroups: project.metaAds?.ruleGroups ?? [],
    ruleOverrides: project.metaAds?.ruleOverrides ?? [],
    rules: {
      ...defaultRules,
      ...(project.metaAds?.rules ?? {}),
    },
    creativeRules: {
      ...defaultCreativeRules,
      ...(project.metaAds?.creativeRules ?? {}),
    },
  };
}

function createMetaAdsBriefStorageKey() {
  const id =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `meta_ads_brief:${id}`;
}

function getRequestErrorMessage(error: unknown, fallback: string) {
  const requestError = error as RequestError;
  if (typeof requestError.response?.data?.message === 'string') {
    return requestError.response.data.message;
  }
  if (typeof requestError.message === 'string') {
    return requestError.message;
  }
  return fallback;
}

function getMetricValue(campaign: ProjectMetaAdsCampaignSummary, key: string) {
  if (key === 'budget') {
    return campaign.dailyBudget ?? 0;
  }
  if (key === 'frequency') {
    return campaign.frequency ?? 0;
  }
  if (key === 'spend') {
    return campaign.spend ?? 0;
  }
  if (key === 'cpa') {
    return campaign.cpa;
  }
  if (key === 'result') {
    return campaign.resultCount ?? 0;
  }
  if (key === 'ctr') {
    return campaign.ctr ?? 0;
  }
  if (key === 'clicks') {
    return campaign.clicks ?? 0;
  }
  return campaign.campaignName ?? campaign.campaignId;
}

function compareNumberSort(
  left: ProjectMetaAdsCampaignSummary,
  right: ProjectMetaAdsCampaignSummary,
  key: string,
  direction: 'asc' | 'desc',
) {
  const leftRaw = getMetricValue(left, key);
  const rightRaw = getMetricValue(right, key);
  const emptyValue = key === 'cpa' && direction === 'asc' ? Infinity : -Infinity;
  const leftValue = typeof leftRaw === 'number' && Number.isFinite(leftRaw) ? leftRaw : emptyValue;
  const rightValue =
    typeof rightRaw === 'number' && Number.isFinite(rightRaw) ? rightRaw : emptyValue;
  return direction === 'asc' ? leftValue - rightValue : rightValue - leftValue;
}

function getRecommendationLabel(
  recommendation: ProjectMetaAdsRecommendation | undefined,
  currency: string,
) {
  if (!recommendation) {
    return '-';
  }
  const current = formatMoney(recommendation.currentDailyBudget, currency);
  const proposed = formatMoney(recommendation.proposedDailyBudget, currency);
  return `${recommendation.action}: ${current} -> ${proposed}`;
}

function canApplyRecommendation(recommendation: ProjectMetaAdsRecommendation | undefined) {
  return Boolean(recommendation && recommendation.action !== 'hold');
}

function getAdThumbnailUrl(ad: ProjectMetaAdsAdSummary) {
  return ad.thumbnailUrl || ad.imageUrl;
}

function collectAdThumbnails(ads: ProjectMetaAdsAdSummary[]) {
  const urls = new Set<string>();
  for (const ad of ads) {
    const thumbnailUrl = getAdThumbnailUrl(ad);
    if (thumbnailUrl) {
      urls.add(thumbnailUrl);
    }
    if (urls.size >= 3) {
      break;
    }
  }
  return Array.from(urls);
}

function getAdPreviewUrl(ad: ProjectMetaAdsAdSummary) {
  return ad.imageUrl || ad.thumbnailUrl;
}

function toDateInputValue(date: Date) {
  const localTimestamp = date.getTime() - date.getTimezoneOffset() * 60 * 1000;
  return new Date(localTimestamp).toISOString().slice(0, 10);
}

function getDateInputDaysAgo(daysAgo: number) {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return toDateInputValue(date);
}

export default function ProjectMetaAdsPanel({
  project,
  canEdit,
}: {
  project: TProject;
  canEdit: boolean;
}) {
  const localize = useLocalize();
  const navigate = useNavigate();
  const { user } = useAuthContext();
  const { showToast } = useToastContext();
  const tableScrollRef = useRef<HTMLDivElement | null>(null);
  const stickyHorizontalScrollRef = useRef<HTMLDivElement | null>(null);
  const isSyncingHorizontalScrollRef = useRef(false);
  const [settings, setSettings] = useState(() => normalizeSettings(project));
  const [settingsDraft, setSettingsDraft] = useState<MetaAdsSettingsState | null>(null);
  const [settingsDraftToken, setSettingsDraftToken] = useState('');
  const [showSettingsDraftToken, setShowSettingsDraftToken] = useState(false);
  const [credentialsDialogOpen, setCredentialsDialogOpen] = useState(false);
  const [tenantAccessToken, setTenantAccessToken] = useState('');
  const [showTenantAccessToken, setShowTenantAccessToken] = useState(false);
  const [selectedEntityIds, setSelectedEntityIds] = useState<string[]>([]);
  const [expandedCampaignIds, setExpandedCampaignIds] = useState<string[]>([]);
  const [collapsedAboCampaignIds, setCollapsedAboCampaignIds] = useState<string[]>([]);
  const [budgetEditor, setBudgetEditor] = useState<BudgetEditor | null>(null);
  const [manualDailyBudget, setManualDailyBudget] = useState('');
  const [budgetConfirmation, setBudgetConfirmation] = useState<BudgetConfirmation | null>(null);
  const [ruleGroupDraft, setRuleGroupDraft] = useState<RuleGroupDraft | null>(null);
  const [campaignSearch, setCampaignSearch] = useState('');
  const [objectiveFilter, setObjectiveFilter] = useState('all');
  const [resultTypeSelectorOpen, setResultTypeSelectorOpen] = useState(false);
  const [selectedSummaryResultType, setSelectedSummaryResultType] = useState<string | null>(null);
  const [budgetModeFilter, setBudgetModeFilter] = useState('all');
  const [campaignSort, setCampaignSort] = useState('name_asc');
  const [tableView, setTableView] = useState<TableView>('summary');
  const [biObjectiveFilter, setBiObjectiveFilter] = useState('all');
  const [biResultTypeFilter, setBiResultTypeFilter] = useState('all');
  const [evolutionLevel, setEvolutionLevel] = useState<EvolutionLevel>('campaign');
  const [evolutionMetric, setEvolutionMetric] = useState<EvolutionMetric>('spend');
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('last_7d');
  const [customSince, setCustomSince] = useState(() => getDateInputDaysAgo(6));
  const [customUntil, setCustomUntil] = useState(() => toDateInputValue(new Date()));
  const [runErrorMessage, setRunErrorMessage] = useState<string | null>(null);
  const [settingsDrawer, setSettingsDrawer] = useState<SettingsDrawer>(null);
  const [metricsFullscreen, setMetricsFullscreen] = useState(false);
  const [selectedAdPreview, setSelectedAdPreview] = useState<SelectedAdPreview>(null);
  const [selectedBiRankItem, setSelectedBiRankItem] = useState<MetaAdsBiRankItem | null>(null);
  const [collapsedAdSetAdsIds, setCollapsedAdSetAdsIds] = useState<string[]>([]);
  const startupConfigQuery = useGetStartupConfig();
  const statusParams =
    periodFilter === 'custom'
      ? {
          ...(customSince ? { since: customSince } : {}),
          ...(customUntil ? { until: customUntil } : {}),
        }
      : { datePreset: periodFilter };
  const statusQuery = useProjectMetaAdsQuery(project.projectId, statusParams);
  const updateSettings = useUpdateProjectMetaAdsMutation();
  const updateTenantToken = useUpdateProjectMetaAdsTenantTokenMutation();
  const updateBudget = useUpdateProjectMetaAdsBudgetMutation();
  const runAnalysis = useRunProjectMetaAdsMutation();
  const applyRecommendation = useApplyProjectMetaAdsRecommendationMutation();
  const isStatusLoading = Boolean(statusQuery.isLoading || statusQuery.isFetching);
  const isInitialStatusLoading = isStatusLoading && !statusQuery.data;
  const canManageTenantToken = user?.role === SystemRoles.ADMIN;

  useEffect(() => {
    setSettings(normalizeSettings(project));
    setSettingsDrawer(null);
    setSettingsDraft(null);
    setSettingsDraftToken('');
    setShowSettingsDraftToken(false);
    setCredentialsDialogOpen(false);
    setTenantAccessToken('');
    setShowTenantAccessToken(false);
  }, [project]);

  useEffect(() => {
    if (!metricsFullscreen) {
      return;
    }
    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMetricsFullscreen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousBodyOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [metricsFullscreen]);

  const releaseHorizontalScrollSync = () => {
    window.requestAnimationFrame(() => {
      isSyncingHorizontalScrollRef.current = false;
    });
  };

  const onTableScroll = (event: UIEvent<HTMLDivElement>) => {
    if (isSyncingHorizontalScrollRef.current) {
      return;
    }
    const stickyScroll = stickyHorizontalScrollRef.current;
    if (!stickyScroll || stickyScroll.scrollLeft === event.currentTarget.scrollLeft) {
      return;
    }
    isSyncingHorizontalScrollRef.current = true;
    stickyScroll.scrollLeft = event.currentTarget.scrollLeft;
    releaseHorizontalScrollSync();
  };

  const onStickyHorizontalScroll = (event: UIEvent<HTMLDivElement>) => {
    if (isSyncingHorizontalScrollRef.current) {
      return;
    }
    const tableScroll = tableScrollRef.current;
    if (!tableScroll || tableScroll.scrollLeft === event.currentTarget.scrollLeft) {
      return;
    }
    isSyncingHorizontalScrollRef.current = true;
    tableScroll.scrollLeft = event.currentTarget.scrollLeft;
    releaseHorizontalScrollSync();
  };

  const pendingRecommendations =
    statusQuery.data?.recommendations.filter((item) => item.status === 'pending') ?? [];
  const latestSnapshots = statusQuery.data?.latestSnapshots.slice(0, 8) ?? [];
  const campaigns =
    statusQuery.data?.campaigns && statusQuery.data.campaigns.length > 0
      ? statusQuery.data.campaigns
      : buildCampaignFallback(latestSnapshots);
  const tokenCredentials = statusQuery.data?.credentials;
  const currency = statusQuery.data?.currency ?? 'BRL';
  const graphVersionOptions = getGraphVersionOptions(statusQuery.data?.graphVersion?.effective);
  const trend = statusQuery.data?.trend;
  const trendPoints = trend?.points ?? [];
  const campaignDeltas = trend?.campaignDeltas ?? [];
  const changesByDay = trend?.changesByDay ?? [];
  const dailySpendTrend = trendPoints
    .reduce<Array<{ date: string; spend: number }>>((items, point) => {
      const existing = items.find((item) => item.date === point.date);
      if (existing) {
        existing.spend += Number(point.spend ?? 0);
        return items;
      }
      return [...items, { date: point.date, spend: Number(point.spend ?? 0) }];
    }, [])
    .sort((left, right) => left.date.localeCompare(right.date));
  const maxDailySpend = Math.max(...dailySpendTrend.map((point) => point.spend), 0);
  const totalTrendSpend = dailySpendTrend.reduce((sum, point) => sum + point.spend, 0);
  const latestDailySpend = dailySpendTrend[dailySpendTrend.length - 1]?.spend;
  const peakDailySpend = dailySpendTrend.reduce<{ date: string; spend: number } | null>(
    (peak, point) => (!peak || point.spend > peak.spend ? point : peak),
    null,
  );
  const totalBudgetChangeCount = changesByDay.reduce(
    (sum, point) => sum + Number(point.changeCount ?? 0),
    0,
  );
  const meaningfulDeltas = campaignDeltas.filter(hasMeaningfulDelta);
  const chartWidth = 480;
  const chartHeight = 160;
  const chartPadding = 18;
  const chartBottom = chartHeight - chartPadding;
  const canRenderSpendChart = dailySpendTrend.length > 1 && maxDailySpend > 0;
  const spendChartPoints = dailySpendTrend.map((point, index) => {
    const x =
      chartPadding +
      (index / Math.max(dailySpendTrend.length - 1, 1)) * (chartWidth - chartPadding * 2);
    const y =
      chartBottom -
      (Number(point.spend ?? 0) / Math.max(maxDailySpend, 1)) * (chartHeight - chartPadding * 2);
    return { x, y };
  });
  const spendChartPath = buildChartPath(spendChartPoints);
  const spendChartAreaPath =
    spendChartPoints.length > 0
      ? `${spendChartPath} L ${spendChartPoints[spendChartPoints.length - 1].x.toFixed(
          2,
        )} ${chartBottom} L ${spendChartPoints[0].x.toFixed(2)} ${chartBottom} Z`
      : '';
  const evolutionSeries = (trend?.series ?? [])
    .filter((series) => series.level === evolutionLevel)
    .map((series) => ({
      ...series,
      points: [...series.points].sort((left, right) => left.date.localeCompare(right.date)),
      total: getEvolutionSeriesTotal(series, evolutionMetric),
    }))
    .filter((series) => Number.isFinite(series.total) && Math.abs(series.total) > 0)
    .sort((left, right) => Number(right.total) - Number(left.total))
    .slice(0, EVOLUTION_SERIES_LIMIT);
  const evolutionDates = Array.from(
    new Set(evolutionSeries.flatMap((series) => series.points.map((point) => point.date))),
  ).sort((left, right) => left.localeCompare(right));
  const maxEvolutionValue = Math.max(
    ...evolutionSeries.flatMap((series) =>
      series.points.map((point) => Number(getEvolutionMetricValue(point, evolutionMetric) ?? 0)),
    ),
    0,
  );
  const canRenderEvolutionSeries =
    evolutionSeries.length > 0 && evolutionDates.length > 1 && maxEvolutionValue > 0;
  const evolutionSeriesPaths = evolutionSeries.map((series, seriesIndex) => {
    const points = evolutionDates.map((date, index) => {
      const rawPoint = series.points.find((point) => point.date === date);
      const value = Number(
        getEvolutionMetricValue(rawPoint ?? series.points[0], evolutionMetric) ?? 0,
      );
      const x =
        chartPadding +
        (index / Math.max(evolutionDates.length - 1, 1)) * (chartWidth - chartPadding * 2);
      const y =
        chartBottom - (value / Math.max(maxEvolutionValue, 1)) * (chartHeight - chartPadding * 2);
      return { x, y, value, date };
    });
    return {
      series,
      color: evolutionColors[seriesIndex % evolutionColors.length],
      points,
      path: buildChartPath(points),
    };
  });
  const bestEvolution = [...meaningfulDeltas]
    .sort((left, right) => {
      const resultDiff = Number(right.resultDelta ?? 0) - Number(left.resultDelta ?? 0);
      if (resultDiff !== 0) {
        return resultDiff;
      }
      return Number(left.cpaDelta ?? 0) - Number(right.cpaDelta ?? 0);
    })
    .slice(0, 3);
  const evolutionAlerts = meaningfulDeltas
    .filter(
      (delta) =>
        Number(delta.cpaDelta ?? 0) > 0 ||
        Number(delta.frequencyDelta ?? 0) > 0 ||
        Number(delta.latestChange?.deltaDailyBudget ?? 0) !== 0,
    )
    .slice(0, 4);
  const hasEvolutionSection = Boolean(statusQuery.data?.trend);
  const selectedCount = selectedEntityIds.length;
  const canOpenTrafficAgentChat =
    selectedCount > 0 && selectedCount <= MAX_META_ADS_CHAT_BRIEF_ENTITIES;
  const tokenStatusKey: TranslationKeys =
    tokenCredentials?.effectiveSource === 'project'
      ? 'com_ui_project_meta_ads_project_token_configured'
      : tokenCredentials?.effectiveSource === 'tenant'
        ? 'com_ui_project_meta_ads_tenant_token_configured'
        : 'com_ui_project_meta_ads_token_missing';
  const hasMaskedToken =
    tokenCredentials?.effectiveSource === 'project' ||
    tokenCredentials?.effectiveSource === 'tenant';
  const hasProjectToken =
    tokenCredentials?.effectiveSource === 'project' || Boolean(settingsDraft?.tokenSecretName);
  const selectedCampaignIds = selectedEntityIds
    .filter((id) => id.startsWith('campaign:'))
    .map((id) => id.replace('campaign:', ''));
  const selectedAdSetIds = selectedEntityIds
    .filter((id) => id.startsWith('adset:'))
    .map((id) => id.replace('adset:', ''));
  const canCreateRuleGroup = canEdit;
  const getEntityRuleLabel = (entityLevel: MetaAdsRuleGroup['entityLevel'], entityId: string) =>
    settings.ruleGroups?.find(
      (group) => group.entityLevel === entityLevel && group.entityIds?.includes(entityId),
    )?.name ?? '-';
  const getCampaignName = (campaignId: string) =>
    campaigns.find((campaign) => campaign.campaignId === campaignId)?.campaignName ?? campaignId;
  const getAdSetName = (adSetId: string) =>
    campaigns.flatMap((campaign) => campaign.adSets).find((adSet) => adSet.entityId === adSetId)
      ?.entityName ?? adSetId;
  const selectedRuleGroupLabels =
    selectedCampaignIds.length > 0
      ? selectedCampaignIds.map(getCampaignName)
      : selectedAdSetIds.map(getAdSetName);
  const getEntityRecommendation = (entityId: string) =>
    pendingRecommendations.find((recommendation) => recommendation.entityId === entityId);
  const objectiveOptions = Array.from(
    new Set(campaigns.map((campaign) => campaign.objective || 'UNKNOWN')),
  ).sort((left, right) =>
    getObjectiveLabel(left, localize).localeCompare(getObjectiveLabel(right, localize), 'pt-BR'),
  );
  const biResultTypeOptions = collectBiResultTypes(campaigns).sort((left, right) =>
    getResultTypeLabel(left, localize).localeCompare(getResultTypeLabel(right, localize), 'pt-BR'),
  );
  const biMinSpend = Number(settings.rules.minSpend || defaultRules.minSpend);
  const biRankings = buildMetaAdsBiRankings(
    campaigns,
    biObjectiveFilter,
    biResultTypeFilter,
    Number.isFinite(biMinSpend) && biMinSpend > 0 ? biMinSpend : defaultRules.minSpend,
  );
  const objectiveSummaries =
    statusQuery.data?.summary?.objectives && statusQuery.data.summary.objectives.length > 0
      ? statusQuery.data.summary.objectives
      : buildObjectiveSummaries(campaigns);
  const scopedObjectiveSummary =
    objectiveFilter !== 'all'
      ? objectiveSummaries.find((summary) => (summary.objective || 'UNKNOWN') === objectiveFilter)
      : objectiveSummaries.length === 1
        ? objectiveSummaries[0]
        : undefined;
  const hasMixedObjectiveSummary = objectiveFilter === 'all' && objectiveSummaries.length > 1;
  const summaryResultTypeOptions = buildSummaryResultTypeOptions(
    objectiveSummaries,
    objectiveFilter,
  );
  const selectedSummaryResultTypeOption = selectedSummaryResultType
    ? summaryResultTypeOptions.find((option) => option.resultType === selectedSummaryResultType)
    : undefined;
  const summaryResultType =
    selectedSummaryResultTypeOption?.resultType ??
    (scopedObjectiveSummary?.resultTypes.length === 1
      ? scopedObjectiveSummary.resultTypes[0].resultType
      : undefined);
  const summaryMetricContext = summaryResultType
    ? getResultTypeLabel(summaryResultType, localize)
    : scopedObjectiveSummary
      ? getObjectiveLabel(scopedObjectiveSummary.objective, localize)
      : undefined;
  const summaryTotalSpend =
    scopedObjectiveSummary?.totalSpend ?? statusQuery.data?.summary?.totalSpend;
  const summaryTotalResults =
    selectedSummaryResultTypeOption?.totalResults ??
    (hasMixedObjectiveSummary
      ? null
      : (scopedObjectiveSummary?.totalResults ?? statusQuery.data?.summary?.totalResults));
  const summaryAverageCost =
    selectedSummaryResultTypeOption?.averageCostPerResult ??
    (hasMixedObjectiveSummary
      ? null
      : (scopedObjectiveSummary?.averageCostPerResult ??
        statusQuery.data?.summary?.averageCostPerResult));
  const summaryAverageFrequency =
    scopedObjectiveSummary?.averageFrequency ?? statusQuery.data?.summary?.averageFrequency;
  const filteredCampaigns = campaigns
    .filter((campaign) => {
      const query = campaignSearch.trim().toLowerCase();
      const matchesSearch =
        !query ||
        (campaign.campaignName ?? campaign.campaignId).toLowerCase().includes(query) ||
        getObjectiveLabel(campaign.objective, localize).toLowerCase().includes(query) ||
        campaign.adSets.some((adset) =>
          (adset.entityName ?? adset.entityId).toLowerCase().includes(query),
        );
      const matchesObjective =
        objectiveFilter === 'all' || (campaign.objective || 'UNKNOWN') === objectiveFilter;
      const matchesMode =
        budgetModeFilter === 'all' || (campaign.budgetMode ?? 'UNKNOWN') === budgetModeFilter;
      return matchesSearch && matchesObjective && matchesMode;
    })
    .sort((first, second) => {
      const [key, direction = 'asc'] = campaignSort.split('_') as [string, 'asc' | 'desc'];
      if (key === 'name') {
        const result = String(getMetricValue(first, 'name')).localeCompare(
          String(getMetricValue(second, 'name')),
        );
        return direction === 'desc' ? -result : result;
      }
      return compareNumberSort(first, second, key, direction);
    });

  const onSortColumn = (key: string, defaultDirection: 'asc' | 'desc') => {
    const [activeKey, activeDirection = defaultDirection] = campaignSort.split('_') as [
      string,
      'asc' | 'desc',
    ];
    const nextDirection =
      activeKey === key && activeDirection === defaultDirection
        ? defaultDirection === 'asc'
          ? 'desc'
          : 'asc'
        : defaultDirection;
    setCampaignSort(`${key}_${nextDirection}`);
  };

  const renderSortableHeader = ({
    key,
    label,
    className,
    defaultDirection = 'desc',
  }: {
    key: string;
    label: string;
    className?: string;
    defaultDirection?: 'asc' | 'desc';
  }) => {
    const [activeKey, activeDirection] = campaignSort.split('_') as [string, 'asc' | 'desc'];
    const isActive = activeKey === key;
    return (
      <button
        type="button"
        onClick={() => onSortColumn(key, defaultDirection)}
        className={`inline-flex w-full min-w-0 flex-wrap items-center gap-0.5 text-[10px] font-semibold uppercase leading-tight tracking-[0.08em] text-[#8f8677] transition hover:text-[#f8f1e5] ${
          className ?? ''
        }`}
      >
        <span className="min-w-0 break-words">{label}</span>
        {isActive && (
          <span aria-hidden="true" className="text-amber-200">
            {activeDirection === 'asc' ? '↑' : '↓'}
          </span>
        )}
      </button>
    );
  };

  const saveSettings = (
    nextSettings: MetaAdsSettingsState,
    token: string,
    onSuccess?: () => void,
  ) => {
    const trimmedToken = token.trim();
    logger.debug('MetaAds', 'Saving project Meta Ads settings', {
      projectId: project.projectId,
      hasMetaAccessToken: trimmedToken.length > 0,
      tokenLength: trimmedToken.length,
      tokenSecretName: nextSettings.tokenSecretName,
    });
    setSettings(nextSettings);
    updateSettings.mutate(
      {
        projectId: project.projectId,
        metaAds: nextSettings,
        ...(trimmedToken ? { metaAccessToken: trimmedToken } : {}),
      },
      {
        onSuccess: () => {
          statusQuery.refetch();
          setSettingsDraftToken('');
          setShowSettingsDraftToken(false);
          showToast({ message: localize('com_ui_saved'), status: 'success' });
          onSuccess?.();
          logger.debug('MetaAds', 'Saved project Meta Ads settings', {
            projectId: project.projectId,
            savedProjectToken: trimmedToken.length > 0,
          });
        },
        onError: (error) => {
          const message =
            error instanceof Error ? error.message : localize('com_ui_error_save_admin_settings');
          showToast({ message, status: 'error' });
          logger.error('MetaAds', 'Failed to save project Meta Ads settings', {
            projectId: project.projectId,
            error,
          });
        },
      },
    );
  };

  const onSave = () => {
    saveSettings(settings, '');
  };

  const onClearProjectToken = () => {
    if (!settingsDraft) {
      return;
    }
    const nextSettings = {
      ...settingsDraft,
      tokenSecretName: '',
      credentialMode: 'tenant_default',
    };
    setSettingsDraft(nextSettings);
    setSettingsDraftToken('');
    saveSettings(nextSettings, '', closeCredentialsDialog);
  };

  const onApply = (recommendation: ProjectMetaAdsRecommendation) => {
    if (!recommendation._id) {
      return;
    }
    applyRecommendation.mutate(
      {
        projectId: project.projectId,
        recommendationId: recommendation._id,
      },
      {
        onSuccess: () => {
          statusQuery.refetch();
          showToast({
            message: localize('com_ui_project_meta_ads_apply_success'),
            status: 'success',
          });
        },
        onError: (error) => {
          const message = getRequestErrorMessage(
            error,
            localize('com_ui_project_meta_ads_apply_failed'),
          );
          showToast({ message, status: 'error' });
          logger.error('MetaAds', 'Failed to apply project Meta Ads recommendation', {
            projectId: project.projectId,
            recommendationId: recommendation._id,
            error,
          });
        },
      },
    );
  };

  const onOpenBudgetEditor = (editor: BudgetEditor) => {
    setBudgetEditor(editor);
    setManualDailyBudget(editor.currentBudget == null ? '' : String(editor.currentBudget));
  };

  const onSaveManualBudget = () => {
    if (!budgetEditor) {
      return;
    }
    const dailyBudget = Number(manualDailyBudget);
    if (!Number.isFinite(dailyBudget) || dailyBudget <= 0) {
      showToast({
        message: localize('com_ui_project_meta_ads_invalid_budget'),
        status: 'error',
      });
      return;
    }
    setBudgetConfirmation({
      entityLevel: budgetEditor.entityLevel,
      entityId: budgetEditor.entityId,
      entityName: budgetEditor.entityName,
      dailyBudget,
      currentBudget: budgetEditor.currentBudget,
      reason: 'manual-ui',
    });
  };

  const onConfirmManualBudget = () => {
    if (!budgetConfirmation) {
      return;
    }
    updateBudget.mutate(
      {
        projectId: project.projectId,
        payload: {
          entityLevel: budgetConfirmation.entityLevel,
          entityId: budgetConfirmation.entityId,
          entityName: budgetConfirmation.entityName,
          dailyBudget: budgetConfirmation.dailyBudget,
          reason: budgetConfirmation.reason,
        },
      },
      {
        onSuccess: () => {
          setBudgetEditor(null);
          setBudgetConfirmation(null);
          setManualDailyBudget('');
          statusQuery.refetch();
          showToast({
            message: localize('com_ui_project_meta_ads_budget_success'),
            status: 'success',
          });
        },
        onError: (error) => {
          const message = getRequestErrorMessage(
            error,
            localize('com_ui_project_meta_ads_budget_failed'),
          );
          showToast({ message, status: 'error' });
        },
      },
    );
  };

  const onOpenRuleGroupDraft = () => {
    if (!canCreateRuleGroup) {
      return;
    }
    if (selectedCampaignIds.length === 0 && selectedAdSetIds.length === 0) {
      setRuleGroupDraft({
        scope: 'global',
        name: localize('com_ui_project_meta_ads_global_rules'),
        entityLevel: 'campaign',
        entityIds: [],
        rules: { ...settings.rules },
        creativeRules: { ...settings.creativeRules },
      });
      return;
    }
    const entityLevel = selectedCampaignIds.length > 0 ? 'campaign' : 'adset';
    const entityIds = entityLevel === 'campaign' ? selectedCampaignIds : selectedAdSetIds;
    setRuleGroupDraft({
      scope: 'group',
      name: '',
      entityLevel,
      entityIds,
      rules: { ...settings.rules },
      creativeRules: { ...settings.creativeRules },
    });
  };

  const onEditRuleGroup = (group: MetaAdsRuleGroup) => {
    setRuleGroupDraft({
      id: group.id,
      scope: 'group',
      name: group.name ?? '',
      entityLevel: group.entityLevel,
      entityIds: group.entityIds ?? [],
      rules: { ...defaultRules, ...(group.rules ?? {}) },
      creativeRules: { ...settings.creativeRules },
    });
  };

  const onDeleteRuleGroup = (groupId?: string) => {
    const nextSettings = {
      ...settings,
      ruleGroups: (settings.ruleGroups ?? []).filter((group) => group.id !== groupId),
    };
    setSettings(nextSettings);
    updateSettings.mutate(
      {
        projectId: project.projectId,
        metaAds: nextSettings,
      },
      {
        onSuccess: () => {
          statusQuery.refetch();
          showToast({ message: localize('com_ui_saved'), status: 'success' });
        },
        onError: (error) => {
          const message =
            error instanceof Error ? error.message : localize('com_ui_error_save_admin_settings');
          showToast({ message, status: 'error' });
        },
      },
    );
  };

  const onRuleGroupRuleChange = (key: keyof MetaAdsRulesState, value: string) => {
    setRuleGroupDraft((current) =>
      current
        ? {
            ...current,
            rules: {
              ...current.rules,
              [key]: value === '' ? undefined : Number(value),
            },
          }
        : current,
    );
  };

  const onRuleGroupRuleTextChange = (key: keyof MetaAdsRulesState, value: string) => {
    setRuleGroupDraft((current) =>
      current
        ? {
            ...current,
            rules: {
              ...current.rules,
              [key]: value,
            },
          }
        : current,
    );
  };

  const onAccountProfileChange = (value: MetaAdsSettingsState['accountProfile']) => {
    const profile = value ?? 'custom';
    const nextSettings = {
      ...settings,
      accountProfile: profile,
      rules: {
        ...settings.rules,
        ...(accountProfileRules[profile] ?? {}),
      },
    };
    setSettings(nextSettings);
    setRuleGroupDraft((current) =>
      current?.scope === 'global'
        ? {
            ...current,
            rules: nextSettings.rules,
          }
        : current,
    );
  };

  const onRuleGroupCreativeRuleChange = (
    key: keyof Required<MetaAdsCreativeRules>,
    value: string,
  ) => {
    setRuleGroupDraft((current) =>
      current
        ? {
            ...current,
            creativeRules: {
              ...current.creativeRules,
              [key]: Number(value),
            },
          }
        : current,
    );
  };

  const onSaveRuleGroup = () => {
    if (!ruleGroupDraft) {
      return;
    }
    if (ruleGroupDraft.scope === 'global') {
      const nextSettings = {
        ...settings,
        rules: ruleGroupDraft.rules,
        creativeRules: ruleGroupDraft.creativeRules,
      };
      setSettings(nextSettings);
      updateSettings.mutate(
        {
          projectId: project.projectId,
          metaAds: nextSettings,
        },
        {
          onSuccess: () => {
            setRuleGroupDraft(null);
            statusQuery.refetch();
            showToast({ message: localize('com_ui_saved'), status: 'success' });
          },
          onError: (error) => {
            const message =
              error instanceof Error ? error.message : localize('com_ui_error_save_admin_settings');
            showToast({ message, status: 'error' });
          },
        },
      );
      return;
    }
    if (ruleGroupDraft.entityIds.length === 0) {
      return;
    }
    const nextGroup: MetaAdsRuleGroup = {
      id: ruleGroupDraft.id ?? `${ruleGroupDraft.entityLevel}-${Date.now()}`,
      name:
        ruleGroupDraft.name.trim() || localize('com_ui_project_meta_ads_rule_group_default_name'),
      entityLevel: ruleGroupDraft.entityLevel,
      entityIds: ruleGroupDraft.entityIds,
      enabled: true,
      rules: ruleGroupDraft.rules,
    };
    const existingGroups = settings.ruleGroups ?? [];
    const nextSettings = {
      ...settings,
      ruleGroups: ruleGroupDraft.id
        ? existingGroups.map((group) => (group.id === ruleGroupDraft.id ? nextGroup : group))
        : [...existingGroups, nextGroup],
    };
    setSettings(nextSettings);
    updateSettings.mutate(
      {
        projectId: project.projectId,
        metaAds: nextSettings,
      },
      {
        onSuccess: () => {
          setRuleGroupDraft(null);
          statusQuery.refetch();
          showToast({ message: localize('com_ui_saved'), status: 'success' });
        },
        onError: (error) => {
          const message =
            error instanceof Error ? error.message : localize('com_ui_error_save_admin_settings');
          showToast({ message, status: 'error' });
        },
      },
    );
  };

  const onRunAnalysis = () => {
    setRunErrorMessage(null);
    runAnalysis.mutate(project.projectId, {
      onSuccess: () => {
        statusQuery.refetch();
        showToast({
          message: localize('com_ui_project_meta_ads_run_success'),
          status: 'success',
        });
      },
      onError: (error) => {
        const message = getRequestErrorMessage(
          error,
          localize('com_ui_project_meta_ads_run_failed'),
        );
        setRunErrorMessage(message);
        showToast({ message, status: 'error' });
        logger.error('MetaAds', 'Failed to run project Meta Ads analysis', {
          projectId: project.projectId,
          error,
        });
      },
    });
  };

  const onToggleCampaign = (campaign: ProjectMetaAdsCampaignSummary) => {
    setSelectedEntityIds((current) => {
      const campaignId = `campaign:${campaign.campaignId}`;
      const adSetIds = campaign.adSets.map((adset) => `adset:${adset.entityId}`);
      const campaignIds = [campaignId, ...adSetIds];
      if (current.includes(campaignId)) {
        return current.filter((selectedId) => !campaignIds.includes(selectedId));
      }
      const next = new Set(current);
      campaignIds.forEach((selectedId) => next.add(selectedId));
      return Array.from(next).slice(0, MAX_META_ADS_CHAT_BRIEF_ENTITIES);
    });
  };

  const onToggleAdSet = (entityId: string) => {
    setSelectedEntityIds((current) => {
      const id = `adset:${entityId}`;
      return current.includes(id)
        ? current.filter((selectedId) => selectedId !== id)
        : [...current, id].slice(0, MAX_META_ADS_CHAT_BRIEF_ENTITIES);
    });
  };

  const onToggleCampaignExpanded = (campaign: ProjectMetaAdsCampaignSummary) => {
    if (campaign.budgetMode === 'ABO') {
      setCollapsedAboCampaignIds((current) =>
        current.includes(campaign.campaignId)
          ? current.filter((id) => id !== campaign.campaignId)
          : [...current, campaign.campaignId],
      );
      return;
    }

    setExpandedCampaignIds((current) =>
      current.includes(campaign.campaignId)
        ? current.filter((id) => id !== campaign.campaignId)
        : [...current, campaign.campaignId],
    );
  };

  const onToggleAdSetAds = (adSetId: string) => {
    setCollapsedAdSetAdsIds((current) =>
      current.includes(adSetId) ? current.filter((id) => id !== adSetId) : [...current, adSetId],
    );
  };

  const onCustomSinceChange = (value: string) => {
    setCustomSince(value);
    if (value && customUntil && value > customUntil) {
      setCustomUntil(value);
    }
  };

  const onCustomUntilChange = (value: string) => {
    setCustomUntil(value);
    if (value && customSince && value < customSince) {
      setCustomSince(value);
    }
  };

  const onExpandAllRows = () => {
    setCollapsedAboCampaignIds([]);
    setExpandedCampaignIds(
      campaigns
        .filter((campaign) => campaign.budgetMode !== 'ABO')
        .map((campaign) => campaign.campaignId),
    );
    setCollapsedAdSetAdsIds([]);
  };

  const onCollapseAllRows = () => {
    setCollapsedAboCampaignIds(
      campaigns
        .filter((campaign) => campaign.budgetMode === 'ABO')
        .map((campaign) => campaign.campaignId),
    );
    setExpandedCampaignIds([]);
    setCollapsedAdSetAdsIds(
      campaigns.flatMap((campaign) => campaign.adSets.map((adset) => adset.entityId)),
    );
  };

  const onOpenTrafficAgentChat = () => {
    if (!canOpenTrafficAgentChat || !statusQuery.data) {
      return;
    }
    const brief = buildMetaAdsChatBrief({
      project,
      snapshots: latestSnapshots,
      campaigns,
      recommendations: statusQuery.data.recommendations,
      changes: statusQuery.data.changes,
      selectedEntityIds,
    });
    const storageKey = createMetaAdsBriefStorageKey();
    sessionStorage.setItem(storageKey, JSON.stringify(brief));

    const params = new URLSearchParams({
      project_id: project.projectId,
      meta_ads_brief: storageKey,
    });
    const trafficAgentId = startupConfigQuery.data?.interface?.metaAdsTrafficAgentId;
    if (trafficAgentId) {
      params.set('agent_id', trafficAgentId);
    }
    navigate(`/c/new?${params.toString()}`);
  };

  const openSettingsDrawer = (drawer: Exclude<SettingsDrawer, null>) => {
    setSettingsDrawer(drawer);
    setSettingsDraft(settings);
    setSettingsDraftToken('');
    setShowSettingsDraftToken(false);
    setCredentialsDialogOpen(false);
    setTenantAccessToken('');
    setShowTenantAccessToken(false);
  };

  const closeSettingsDrawer = () => {
    setSettingsDrawer(null);
    setSettingsDraft(null);
    setSettingsDraftToken('');
    setShowSettingsDraftToken(false);
    setCredentialsDialogOpen(false);
    setTenantAccessToken('');
    setShowTenantAccessToken(false);
  };

  const openCredentialsDialog = () => {
    setCredentialsDialogOpen(true);
    setSettingsDraftToken('');
    setTenantAccessToken('');
    setShowSettingsDraftToken(false);
    setShowTenantAccessToken(false);
  };

  const closeCredentialsDialog = () => {
    setCredentialsDialogOpen(false);
    setSettingsDraftToken('');
    setTenantAccessToken('');
    setShowSettingsDraftToken(false);
    setShowTenantAccessToken(false);
  };

  const onSaveSettingsDrawer = () => {
    if (!settingsDraft) {
      return;
    }
    saveSettings(settingsDraft, settingsDraftToken, closeSettingsDrawer);
  };

  const onSaveProjectToken = () => {
    if (!settingsDraft) {
      return;
    }
    saveSettings(settingsDraft, settingsDraftToken, closeCredentialsDialog);
  };

  const onSaveTenantToken = () => {
    const trimmedToken = tenantAccessToken.trim();
    if (!trimmedToken) {
      return;
    }
    updateTenantToken.mutate(
      {
        projectId: project.projectId,
        metaAccessToken: trimmedToken,
      },
      {
        onSuccess: () => {
          setTenantAccessToken('');
          setShowTenantAccessToken(false);
          statusQuery.refetch();
          showToast({ message: localize('com_ui_saved'), status: 'success' });
        },
        onError: (error) => {
          const message =
            error instanceof Error ? error.message : localize('com_ui_error_save_admin_settings');
          showToast({ message, status: 'error' });
        },
      },
    );
  };

  const renderAdMetric = (labelKey: TranslationKeys, value: string) => (
    <div className="border border-border-light bg-surface-primary p-3">
      <div className="text-[11px] font-semibold uppercase text-text-tertiary">
        {localize(labelKey)}
      </div>
      <div className="mt-1 font-mono text-sm text-text-primary">{value}</div>
    </div>
  );

  const tableColumns = tableViewColumns[tableView].map((key) => tableColumnMap[key]);
  const tableColumnCount = tableColumns.length + 2;
  const renderEvolutionDeltaClass = (
    value: number | null | undefined,
    improvesWhenNegative = false,
  ) => {
    if (value == null || Number.isNaN(value) || Math.abs(value) <= 0.005) {
      return 'text-[#d8d0c2]';
    }
    return value < 0 === improvesWhenNegative ? 'text-emerald-200' : 'text-rose-200';
  };
  const renderRankMedia = (item: MetaAdsBiRankItem, size: 'sm' | 'lg' = 'sm') => {
    const thumbnails = item.thumbnailUrls?.slice(0, 3) ?? [];
    const isLarge = size === 'lg';
    const frameClass = isLarge ? 'h-28 w-40' : 'h-12 w-16';
    const emptyClass = isLarge ? 'text-xs' : 'text-[9px]';
    if (thumbnails.length === 0) {
      return (
        <div
          data-testid="meta-ads-rank-media"
          className={`${frameClass} flex shrink-0 items-center justify-center border border-white/10 bg-[#1a1712] px-2 text-center ${emptyClass} text-[#81796b]`}
        >
          {localize('com_ui_project_meta_ads_no_creative_media')}
        </div>
      );
    }
    if (thumbnails.length === 1) {
      return (
        <div
          data-testid="meta-ads-rank-media"
          className={`${frameClass} shrink-0 overflow-hidden border border-white/10 bg-[#1a1712]`}
        >
          <img
            src={thumbnails[0]}
            alt=""
            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
          />
        </div>
      );
    }
    return (
      <div data-testid="meta-ads-rank-media" className={`${frameClass} relative shrink-0`}>
        {thumbnails.map((thumbnailUrl, index) => {
          const offset = isLarge ? index * 12 : index * 6;
          const rotation =
            index === 0
              ? '-rotate-3 group-hover:-rotate-6 group-hover:-translate-x-1'
              : index === 1
                ? 'rotate-1 group-hover:translate-y-0.5'
                : 'rotate-3 group-hover:rotate-6 group-hover:translate-x-1';
          return (
            <div
              key={thumbnailUrl}
              className={`absolute inset-y-0 overflow-hidden border border-white/10 bg-[#1a1712] shadow-[0_18px_30px_-24px_rgba(0,0,0,0.85)] transition duration-300 ease-out group-hover:border-white/20 group-hover:shadow-[0_22px_34px_-22px_rgba(0,0,0,0.95)] ${rotation}`}
              style={{ left: offset, right: Math.max(0, (thumbnails.length - 1 - index) * offset) }}
            >
              <img
                src={thumbnailUrl}
                alt=""
                className="h-full w-full object-cover transition duration-300 ease-out group-hover:scale-105"
              />
            </div>
          );
        })}
      </div>
    );
  };
  const renderBiRankingCard = (
    titleKey: TranslationKeys,
    items: MetaAdsBiRankItem[],
    testId: string,
  ) => (
    <div className="border border-white/10 bg-[#12120f]">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-3 py-2">
        <h5 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#a39a8c]">
          {localize(titleKey)}
        </h5>
        <span className="text-[10px] uppercase tracking-[0.12em] text-[#81796b]">
          {localize('com_ui_project_meta_ads_bi_rank_by')}
        </span>
      </div>
      <div data-testid={testId} className="divide-y divide-white/10">
        {items.length > 0 ? (
          items.map((item, index) => {
            const efficiency = getRankEfficiency(item);
            const displayName = cleanDashboardName(item.name, item.id);
            return (
              <button
                type="button"
                key={`${item.level}:${item.id}`}
                onClick={() => setSelectedBiRankItem(item)}
                className="group grid w-full grid-cols-[2.25rem_4rem_minmax(0,1fr)_auto] gap-3 px-3 py-3 text-left transition duration-200 odd:bg-white/[0.025] hover:bg-white/[0.06] focus:outline-none focus:ring-1 focus:ring-[#f3efe6]/40"
              >
                <span className="mt-0.5 font-mono text-xs text-[#81796b]">#{index + 1}</span>
                {renderRankMedia(item)}
                <div className="min-w-0">
                  <div
                    className="truncate text-sm font-semibold text-[#f3efe6]"
                    title={displayName}
                  >
                    {displayName}
                  </div>
                  <div className="mt-1 flex min-w-0 items-center gap-2 text-[11px] text-[#a39a8c]">
                    <span
                      className="min-w-0 truncate"
                      title={getResultTypeLabel(item.resultType, localize)}
                    >
                      {getResultTypeLabel(item.resultType, localize)}
                    </span>
                    <span className="text-[#5f574d]">/</span>
                    <span className="font-mono">{formatMetric(item.resultCount)}</span>
                    <span>{localize('com_ui_project_meta_ads_results')}</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-sm font-semibold tabular-nums text-[#f3efe6]">
                    {formatRankingCost(efficiency, currency)}
                  </div>
                  <div className="mt-1 text-[10px] uppercase tracking-[0.12em] text-[#81796b]">
                    {localize('com_ui_project_meta_ads_cost_per_result')}
                  </div>
                </div>
              </button>
            );
          })
        ) : (
          <div className="px-3 py-5 text-sm text-[#a39a8c]">
            {localize('com_ui_project_meta_ads_bi_no_rankings')}
          </div>
        )}
      </div>
    </div>
  );
  const getTableRowClass = (
    rowIndex: number,
    level: 'campaign' | 'adset' | 'ad',
    isClickable = false,
  ) => {
    const stripeClass =
      rowIndex % 2 === 0 ? 'bg-[#11100d] dark:bg-[#11100d]' : 'bg-[#181611] dark:bg-[#181611]';
    const levelClass =
      level === 'campaign'
        ? 'font-semibold text-[#f3efe6]'
        : level === 'adset'
          ? 'text-[#bdb5a6]'
          : 'text-[#a69d8d]';
    const cursorClass = isClickable ? 'cursor-pointer' : '';

    return `${cursorClass} ${stripeClass} ${levelClass} border-b border-white/5 transition-colors duration-200 hover:bg-[#282115] dark:hover:bg-[#282115]`;
  };

  const renderEmptyCell = (column: TableColumn) => (
    <td
      key={column.key}
      className={`px-2 py-2 ${
        column.align === 'right' ? 'text-right font-mono tabular-nums' : ''
      } text-[#6f675c]`}
    >
      -
    </td>
  );

  const renderFrequencyValue = (source: {
    frequency?: number | null;
    impressions?: number | null;
    reach?: number | null;
  }) => {
    const hasAuditMetrics = source.impressions != null && source.reach != null;
    const title = hasAuditMetrics
      ? `${localize('com_ui_project_meta_ads_impressions')}: ${formatIntegerMetric(
          source.impressions,
        )} / ${localize('com_ui_project_meta_ads_reach')}: ${formatIntegerMetric(source.reach)}`
      : undefined;
    return <span title={title}>{formatMetric(source.frequency)}</span>;
  };

  const renderLevelCell = (column: TableColumn, labelKey: TranslationKeys) => (
    <td key={column.key} className="px-3 py-3 text-[#9b9284]">
      <span className="inline-flex border border-white/10 bg-white/[0.03] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]">
        {localize(labelKey)}
      </span>
    </td>
  );

  const renderNameTooltip = (value: string) => (
    <span
      aria-hidden="true"
      data-tooltip={value}
      className="pointer-events-none absolute bottom-full left-0 z-[1000] mb-2 hidden max-w-[640px] whitespace-normal border border-amber-400/30 bg-[#2a2114] px-2 py-1 text-xs font-medium leading-5 text-amber-100 shadow-xl before:content-[attr(data-tooltip)] group-focus-within:block group-hover:block"
    />
  );

  const renderBudgetBadge = (value: number | null | undefined, onClick?: () => void) => {
    const content = (
      <>
        <span className="h-1.5 w-1.5 bg-amber-300 shadow-[0_0_12px_rgba(252,211,77,0.7)]" />
        <span>{formatMoney(value, currency)}</span>
      </>
    );

    if (!onClick) {
      return (
        <span className="inline-flex items-center gap-2 border border-white/10 bg-white/[0.035] px-3 py-1.5 font-mono text-xs font-semibold tabular-nums text-[#ded6c8]">
          {content}
        </span>
      );
    }

    return (
      <button
        type="button"
        disabled={!canEdit}
        onClick={onClick}
        className="inline-flex items-center gap-2 border border-amber-300/25 bg-amber-300/[0.08] px-3 py-1.5 font-mono text-xs font-semibold tabular-nums text-[#fff3d7] shadow-[0_12px_26px_-22px_rgba(245,158,11,0.95)] transition duration-200 hover:-translate-y-0.5 hover:border-amber-300/60 hover:bg-amber-300/[0.14] focus:outline-none focus:ring-2 focus:ring-amber-300/40 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-55"
      >
        {content}
      </button>
    );
  };

  const renderCampaignNameCell = (campaign: ProjectMetaAdsCampaignSummary) => (
    <td
      key="name"
      className="sticky left-20 z-10 border-l-2 border-amber-300 bg-inherit px-3 py-3 font-semibold text-[#f3efe6] shadow-[14px_0_26px_-22px_rgba(245,158,11,0.65)] focus-within:z-50 hover:z-50"
    >
      <div className="group relative min-w-0">
        <div className="truncate">{campaign.campaignName ?? campaign.campaignId}</div>
        {renderNameTooltip(campaign.campaignName ?? campaign.campaignId)}
      </div>
    </td>
  );

  const renderAdSetNameCell = (adset: ProjectMetaAdsCampaignSummary['adSets'][number]) => (
    <td
      key="name"
      className="sticky left-20 z-10 border-l-2 border-amber-500/35 bg-inherit px-3 py-3 pl-6 text-[#ddd5c8] shadow-[14px_0_26px_-22px_rgba(245,158,11,0.45)] focus-within:z-50 hover:z-50"
    >
      <div className="group relative min-w-0">
        <div className="truncate">{adset.entityName ?? adset.entityId}</div>
        {renderNameTooltip(adset.entityName ?? adset.entityId)}
      </div>
    </td>
  );

  const renderAdNameCell = (ad: ProjectMetaAdsAdSummary) => {
    const mediaUrl = getAdThumbnailUrl(ad);
    return (
      <td
        key="name"
        className="sticky left-20 z-10 border-l-2 border-white/10 bg-inherit px-3 py-3 pl-9 shadow-[14px_0_26px_-22px_rgba(0,0,0,0.75)] focus-within:z-50 hover:z-50"
      >
        <div className="group relative flex min-w-0 items-center gap-2">
          <div className="h-10 w-16 shrink-0 overflow-hidden border border-white/10 bg-[#242016] shadow-[0_12px_30px_-24px_rgba(245,158,11,0.65)]">
            {mediaUrl ? (
              <img
                src={mediaUrl}
                alt={ad.adName ?? ad.title ?? ad.adId}
                className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center px-1 text-center text-[10px] text-[#8a8172]">
                {localize('com_ui_project_meta_ads_no_creative_media')}
              </div>
            )}
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-[#f3efe6]">
              {ad.adName ?? ad.title ?? ad.adId}
            </div>
            <div className="truncate text-xs text-[#9f9687]">{ad.title ?? ad.body ?? '-'}</div>
          </div>
          {renderNameTooltip(ad.adName ?? ad.title ?? ad.adId)}
        </div>
      </td>
    );
  };

  const renderCampaignActionCell = (
    column: TableColumn,
    recommendation: ProjectMetaAdsRecommendation | undefined,
  ) => (
    <td key={column.key} className="px-2 py-2">
      <div className="flex gap-1">
        {canApplyRecommendation(recommendation) && (
          <button
            type="button"
            disabled={!canEdit || applyRecommendation.isLoading}
            onClick={() => onApply(recommendation)}
            className="h-7 border border-emerald-400/25 bg-emerald-500/10 px-2 text-[11px] font-semibold text-emerald-100 transition duration-200 hover:bg-emerald-400/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {localize('com_ui_project_meta_ads_apply')}
          </button>
        )}
      </div>
    </td>
  );

  const renderCampaignCell = (
    column: TableColumn,
    campaign: ProjectMetaAdsCampaignSummary,
    recommendation: ProjectMetaAdsRecommendation | undefined,
  ) => {
    if (column.key === 'level') {
      return renderLevelCell(column, 'com_ui_project_meta_ads_level_campaign');
    }
    if (column.key === 'name') {
      return renderCampaignNameCell(campaign);
    }
    if (column.key === 'budget') {
      return (
        <td
          key={column.key}
          className="px-2 py-2 text-right font-mono tabular-nums text-text-secondary"
        >
          {campaign.editableBudgetLevel === 'campaign'
            ? renderBudgetBadge(campaign.dailyBudget, () =>
                onOpenBudgetEditor({
                  entityLevel: 'campaign',
                  entityId: campaign.campaignId,
                  entityName: campaign.campaignName,
                  currentBudget: campaign.dailyBudget,
                }),
              )
            : renderBudgetBadge(campaign.dailyBudget)}
        </td>
      );
    }
    if (column.key === 'objective') {
      return (
        <td key={column.key} className="truncate px-2 py-2 text-text-secondary">
          {getObjectiveLabel(campaign.objective, localize)}
        </td>
      );
    }
    if (column.key === 'budgetMode') {
      return (
        <td key={column.key} className="px-2 py-2 text-text-secondary">
          {campaign.budgetMode ?? '-'}
        </td>
      );
    }
    if (column.key === 'frequency') {
      return (
        <td
          key={column.key}
          className="px-2 py-2 text-right font-mono tabular-nums text-text-secondary"
        >
          {renderFrequencyValue(campaign)}
        </td>
      );
    }
    if (column.key === 'result') {
      return (
        <td
          key={column.key}
          className="px-2 py-2 text-right font-mono tabular-nums text-text-secondary"
        >
          {formatMetric(campaign.resultCount)}
        </td>
      );
    }
    if (column.key === 'cpa') {
      return (
        <td
          key={column.key}
          className="px-2 py-2 text-right font-mono tabular-nums text-text-secondary"
        >
          {formatMoney(campaign.cpa, currency)}
        </td>
      );
    }
    if (column.key === 'spend') {
      return (
        <td
          key={column.key}
          className="px-2 py-2 text-right font-mono tabular-nums text-text-secondary"
        >
          {formatMoney(campaign.spend, currency)}
        </td>
      );
    }
    if (column.key === 'ctr') {
      return (
        <td
          key={column.key}
          className="px-2 py-2 text-right font-mono tabular-nums text-text-secondary"
        >
          {formatMetric(campaign.ctr)}
        </td>
      );
    }
    if (column.key === 'clicks') {
      return (
        <td
          key={column.key}
          className="px-2 py-2 text-right font-mono tabular-nums text-text-secondary"
        >
          {formatMetric(campaign.clicks)}
        </td>
      );
    }
    if (column.key === 'video') {
      return (
        <td
          key={column.key}
          className="px-2 py-2 text-right font-mono tabular-nums text-text-secondary"
        >
          {formatMetric(campaign.videoP75Watched)}
        </td>
      );
    }
    if (column.key === 'rule') {
      return (
        <td key={column.key} className="truncate px-2 py-2 text-text-secondary">
          {getEntityRuleLabel('campaign', campaign.campaignId)}
        </td>
      );
    }
    if (column.key === 'recommendation') {
      return (
        <td key={column.key} className="px-2 py-2 text-text-secondary">
          <div className="truncate">{getRecommendationLabel(recommendation, currency)}</div>
          {recommendation?.reason && (
            <div className="truncate text-text-tertiary">{recommendation.reason}</div>
          )}
        </td>
      );
    }
    return renderCampaignActionCell(column, recommendation);
  };

  const renderAdSetCell = (
    column: TableColumn,
    campaign: ProjectMetaAdsCampaignSummary,
    adset: ProjectMetaAdsCampaignSummary['adSets'][number],
    recommendation: ProjectMetaAdsRecommendation | undefined,
  ) => {
    if (column.key === 'level') {
      return renderLevelCell(column, 'com_ui_project_meta_ads_level_ad_set');
    }
    if (column.key === 'name') {
      return renderAdSetNameCell(adset);
    }
    if (column.key === 'budget') {
      return (
        <td
          key={column.key}
          className="px-2 py-2 text-right font-mono tabular-nums text-text-secondary"
        >
          {campaign.editableBudgetLevel === 'adset'
            ? renderBudgetBadge(adset.dailyBudget, () =>
                onOpenBudgetEditor({
                  entityLevel: 'adset',
                  entityId: adset.entityId,
                  entityName: adset.entityName,
                  currentBudget: adset.dailyBudget,
                }),
              )
            : renderBudgetBadge(adset.dailyBudget)}
        </td>
      );
    }
    if (column.key === 'objective') {
      return renderEmptyCell(column);
    }
    if (column.key === 'budgetMode') {
      return (
        <td key={column.key} className="px-2 py-2 text-text-secondary">
          {campaign.budgetMode === 'ABO' ? 'ABO' : '-'}
        </td>
      );
    }
    if (column.key === 'frequency') {
      return (
        <td
          key={column.key}
          className="px-2 py-2 text-right font-mono tabular-nums text-text-secondary"
        >
          {renderFrequencyValue(adset)}
        </td>
      );
    }
    if (column.key === 'result') {
      return (
        <td
          key={column.key}
          className="px-2 py-2 text-right font-mono tabular-nums text-text-secondary"
        >
          {formatMetric(adset.resultCount)}
        </td>
      );
    }
    if (column.key === 'cpa') {
      return (
        <td
          key={column.key}
          className="px-2 py-2 text-right font-mono tabular-nums text-text-secondary"
        >
          {formatMoney(adset.cpa, currency)}
        </td>
      );
    }
    if (column.key === 'spend') {
      return (
        <td
          key={column.key}
          className="px-2 py-2 text-right font-mono tabular-nums text-text-secondary"
        >
          {formatMoney(adset.spend, currency)}
        </td>
      );
    }
    if (column.key === 'ctr') {
      return (
        <td
          key={column.key}
          className="px-2 py-2 text-right font-mono tabular-nums text-text-secondary"
        >
          {formatMetric(adset.ctr)}
        </td>
      );
    }
    if (column.key === 'clicks') {
      return (
        <td
          key={column.key}
          className="px-2 py-2 text-right font-mono tabular-nums text-text-secondary"
        >
          {formatMetric(adset.clicks)}
        </td>
      );
    }
    if (column.key === 'video') {
      return (
        <td
          key={column.key}
          className="px-2 py-2 text-right font-mono tabular-nums text-text-secondary"
        >
          {formatMetric(adset.videoP75Watched)}
        </td>
      );
    }
    if (column.key === 'rule') {
      return (
        <td key={column.key} className="truncate px-2 py-2 text-text-secondary">
          {getEntityRuleLabel('adset', adset.entityId)}
        </td>
      );
    }
    if (column.key === 'recommendation') {
      return (
        <td key={column.key} className="px-2 py-2 text-text-secondary">
          <div className="truncate">{getRecommendationLabel(recommendation, currency)}</div>
          {recommendation?.reason && (
            <div className="truncate text-text-tertiary">{recommendation.reason}</div>
          )}
        </td>
      );
    }
    return renderCampaignActionCell(column, recommendation);
  };

  const renderAdCell = (column: TableColumn, ad: ProjectMetaAdsAdSummary) => {
    if (column.key === 'level') {
      return renderLevelCell(column, 'com_ui_project_meta_ads_level_ad');
    }
    if (column.key === 'name') {
      return renderAdNameCell(ad);
    }
    if (column.key === 'frequency') {
      return (
        <td
          key={column.key}
          className="px-2 py-2 text-right font-mono tabular-nums text-text-secondary"
        >
          {renderFrequencyValue(ad)}
        </td>
      );
    }
    if (column.key === 'result') {
      return (
        <td
          key={column.key}
          className="px-2 py-2 text-right font-mono tabular-nums text-text-secondary"
        >
          {formatMetric(ad.resultCount)}
        </td>
      );
    }
    if (column.key === 'cpa') {
      return (
        <td
          key={column.key}
          className="px-2 py-2 text-right font-mono tabular-nums text-text-secondary"
        >
          {formatMoney(ad.cpa, ad.currency ?? currency)}
        </td>
      );
    }
    if (column.key === 'spend') {
      return (
        <td
          key={column.key}
          className="px-2 py-2 text-right font-mono tabular-nums text-text-secondary"
        >
          {formatMoney(ad.spend, ad.currency ?? currency)}
        </td>
      );
    }
    if (column.key === 'ctr') {
      return (
        <td
          key={column.key}
          className="px-2 py-2 text-right font-mono tabular-nums text-text-secondary"
        >
          {formatMetric(ad.ctr)}
        </td>
      );
    }
    if (column.key === 'clicks') {
      return (
        <td
          key={column.key}
          className="px-2 py-2 text-right font-mono tabular-nums text-text-secondary"
        >
          {formatMetric(ad.clicks)}
        </td>
      );
    }
    return renderEmptyCell(column);
  };

  const renderAdRow = (ad: ProjectMetaAdsAdSummary, rowIndex: number) => {
    return (
      <tr
        key={ad.adId}
        data-testid={`meta-ads-ad-card-${ad.adId}`}
        onClick={() => setSelectedAdPreview(ad)}
        className={`group ${getTableRowClass(rowIndex, 'ad', true)}`}
      >
        <td className="sticky left-0 z-20 bg-inherit px-2 py-2 pl-10 align-middle" />
        <td className="sticky left-10 z-20 bg-inherit px-2 py-2 align-middle">
          <span aria-hidden="true" className="block h-7 w-7" />
        </td>
        {tableColumns.map((column) => renderAdCell(column, ad))}
      </tr>
    );
  };

  const content = (
    <>
      <div
        data-testid="meta-ads-metrics-workspace"
        className={`${
          metricsFullscreen ? 'fixed inset-0 z-[9999] overflow-auto' : 'relative overflow-hidden'
        } ${metaAdsSurface}`}
      >
        <div className="relative flex flex-col gap-4 border-b border-white/10 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-xl font-semibold leading-tight text-[#f8f1e5]">
              {localize('com_ui_project_meta_ads_title')}
            </h3>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[#bdb5a6]">
              <span className="border border-emerald-400/20 bg-emerald-500/10 px-2 py-1 text-emerald-100">
                {localize(tokenStatusKey)}
              </span>
              <span className="border border-white/10 bg-white/[0.03] px-2 py-1">
                {settings.automationMode}
              </span>
              <span className="border border-white/10 bg-white/[0.03] px-2 py-1">
                {localize('com_ui_project_meta_ads_schedule_minutes', {
                  0: String(settings.scheduleIntervalMinutes),
                })}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!canEdit || runAnalysis.isLoading}
              onClick={onRunAnalysis}
              className={metaAdsButton}
            >
              {localize(
                runAnalysis.isLoading
                  ? 'com_ui_project_meta_ads_running'
                  : 'com_ui_project_meta_ads_run',
              )}
            </button>
            <button
              type="button"
              onClick={() => openSettingsDrawer('account')}
              className={metaAdsButton}
            >
              {localize('com_ui_project_meta_ads_account_credentials')}
            </button>
            <button
              type="button"
              onClick={() => openSettingsDrawer('automation')}
              className={metaAdsButton}
            >
              {localize('com_ui_project_meta_ads_automation')}
            </button>
            <button
              type="button"
              disabled={!canEdit}
              onClick={onOpenRuleGroupDraft}
              className={metaAdsButton}
            >
              {localize('com_ui_project_meta_ads_rules')}
            </button>
            {!settingsDrawer && (
              <button
                type="button"
                disabled={!canEdit || updateSettings.isLoading}
                onClick={onSave}
                className={metaAdsPrimaryButton}
              >
                {localize('com_ui_save')}
              </button>
            )}
          </div>
        </div>
        {runErrorMessage && (
          <div
            role="alert"
            className="relative m-5 border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-100"
          >
            {runErrorMessage}
          </div>
        )}

        {settingsDrawer && settingsDraft && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="meta-ads-settings-drawer-title"
            className="fixed inset-0 z-50 flex justify-end bg-black/30"
          >
            <div className="flex h-full w-full max-w-lg flex-col border-l border-border-light bg-surface-primary shadow-xl">
              <div className="border-b border-border-light p-4">
                <h4
                  id="meta-ads-settings-drawer-title"
                  className="text-base font-semibold text-text-primary"
                >
                  {localize(
                    settingsDrawer === 'account'
                      ? 'com_ui_project_meta_ads_account_credentials'
                      : 'com_ui_project_meta_ads_automation',
                  )}
                </h4>
                <div className="mt-2 text-xs text-text-tertiary">
                  {settingsDrawer === 'account'
                    ? localize(tokenStatusKey)
                    : localize('com_ui_project_meta_ads_schedule_minutes', {
                        0: String(settingsDraft.scheduleIntervalMinutes),
                      })}
                </div>
              </div>
              <div className="flex-1 space-y-4 overflow-y-auto p-4">
                {settingsDrawer === 'account' ? (
                  <>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="flex flex-col gap-1 text-xs text-text-secondary">
                        {localize('com_ui_project_meta_ads_enabled')}
                        <select
                          disabled={!canEdit}
                          value={settingsDraft.enabled ? 'true' : 'false'}
                          onChange={(event) =>
                            setSettingsDraft((current) =>
                              current
                                ? { ...current, enabled: event.target.value === 'true' }
                                : current,
                            )
                          }
                          className="h-10 border border-border-light bg-surface-secondary px-3 text-sm text-text-primary"
                        >
                          <option value="false">
                            {localize('com_ui_project_meta_ads_disabled')}
                          </option>
                          <option value="true">
                            {localize('com_ui_project_meta_ads_enabled_state')}
                          </option>
                        </select>
                      </label>
                      <label className="flex flex-col gap-1 text-xs text-text-secondary">
                        {localize('com_ui_project_meta_ads_account')}
                        <input
                          disabled={!canEdit}
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={getAdAccountDigits(settingsDraft.adAccountId)}
                          onChange={(event) =>
                            setSettingsDraft((current) =>
                              current
                                ? { ...current, adAccountId: toAdAccountId(event.target.value) }
                                : current,
                            )
                          }
                          placeholder="123456789"
                          className="h-10 border border-border-light bg-surface-secondary px-3 text-sm text-text-primary"
                        />
                      </label>
                    </div>
                    <label className="flex flex-col gap-1 text-xs text-text-secondary">
                      {localize('com_ui_project_meta_ads_graph_version')}
                      <select
                        disabled={!canEdit}
                        value={settingsDraft.graphVersion ?? ''}
                        onChange={(event) =>
                          setSettingsDraft((current) =>
                            current ? { ...current, graphVersion: event.target.value } : current,
                          )
                        }
                        autoComplete="off"
                        className="h-10 border border-border-light bg-surface-secondary px-3 text-sm text-text-primary"
                      >
                        <option value="">
                          {localize('com_ui_project_meta_ads_graph_version_global', {
                            0: statusQuery.data?.graphVersion?.effective ?? 'v25.0',
                          })}
                        </option>
                        {graphVersionOptions.map((version) => (
                          <option key={version} value={version}>
                            {version}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="border border-border-light bg-surface-secondary p-3">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <div className="text-sm font-medium text-text-primary">
                            {localize('com_ui_project_meta_ads_credentials')}
                          </div>
                          <div className="mt-1 text-xs leading-5 text-text-tertiary">
                            {localize('com_ui_project_meta_ads_credentials_hint')}
                          </div>
                          {tokenCredentials && (
                            <span className="mt-2 inline-flex w-fit items-center gap-2 border border-border-light bg-surface-primary px-2 py-1 text-xs text-text-secondary">
                              {localize(tokenStatusKey)}
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          disabled={!canEdit}
                          onClick={openCredentialsDialog}
                          className="h-8 shrink-0 border border-border-light bg-surface-primary px-3 text-xs font-medium text-text-primary disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {localize('com_ui_project_meta_ads_manage_tokens')}
                        </button>
                      </div>
                    </div>
                    <div className="border border-border-light bg-surface-secondary p-3 text-sm text-text-secondary">
                      <div className="font-medium text-text-primary">
                        {localize(tokenStatusKey)}
                      </div>
                      <div className="mt-2 text-xs leading-5 text-text-tertiary">
                        {localize('com_ui_project_meta_ads_graph_version_hint')}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="grid gap-3">
                    <label className="flex flex-col gap-1 text-xs text-text-secondary">
                      {localize('com_ui_project_meta_ads_mode')}
                      <select
                        disabled={!canEdit}
                        value={settingsDraft.automationMode}
                        onChange={(event) =>
                          setSettingsDraft((current) =>
                            current
                              ? {
                                  ...current,
                                  automationMode: event.target
                                    .value as MetaAdsSettings['automationMode'],
                                }
                              : current,
                          )
                        }
                        className="h-10 border border-border-light bg-surface-secondary px-3 text-sm text-text-primary"
                      >
                        <option value="recommend">
                          {localize('com_ui_project_meta_ads_mode_recommend')}
                        </option>
                        <option value="auto_limited">
                          {localize('com_ui_project_meta_ads_mode_auto_limited')}
                        </option>
                      </select>
                    </label>
                    <label className="flex flex-col gap-1 text-xs text-text-secondary">
                      {localize('com_ui_project_meta_ads_schedule')}
                      <select
                        disabled={!canEdit}
                        value={settingsDraft.scheduleIntervalMinutes}
                        onChange={(event) =>
                          setSettingsDraft((current) =>
                            current
                              ? {
                                  ...current,
                                  scheduleIntervalMinutes: Number(
                                    event.target.value,
                                  ) as ScheduleIntervalMinutes,
                                }
                              : current,
                          )
                        }
                        className="h-10 border border-border-light bg-surface-secondary px-3 text-sm text-text-primary"
                      >
                        {scheduleOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {localize(option.labelKey)}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-2 border-t border-border-light p-4">
                <button
                  type="button"
                  onClick={closeSettingsDrawer}
                  className="h-8 border border-border-light px-3 text-xs font-medium text-text-secondary"
                >
                  {localize('com_ui_cancel')}
                </button>
                <button
                  type="button"
                  disabled={!canEdit || updateSettings.isLoading}
                  onClick={onSaveSettingsDrawer}
                  className="h-8 bg-text-primary px-3 text-xs font-medium text-surface-primary disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {localize('com_ui_save')}
                </button>
              </div>
            </div>
          </div>
        )}

        <OGDialog
          open={credentialsDialogOpen}
          onOpenChange={(open) => {
            if (open) {
              setCredentialsDialogOpen(true);
              return;
            }
            closeCredentialsDialog();
          }}
        >
          <OGDialogContent className="max-w-2xl border border-border-light bg-surface-primary p-0 text-text-primary">
            <OGDialogHeader>
              <div className="border-b border-border-light p-4">
                <OGDialogTitle>{localize('com_ui_project_meta_ads_manage_tokens')}</OGDialogTitle>
                <div className="mt-2 text-xs text-text-tertiary">
                  {localize('com_ui_project_meta_ads_manage_tokens_hint')}
                </div>
              </div>
            </OGDialogHeader>
            <div className="space-y-4 p-4">
              <div className="border border-border-light bg-surface-secondary p-3">
                <div className="flex flex-col gap-1">
                  <div className="text-sm font-medium text-text-primary">
                    {localize('com_ui_project_meta_ads_tenant_token')}
                  </div>
                  <div className="text-xs leading-5 text-text-tertiary">
                    {localize(
                      canManageTenantToken
                        ? 'com_ui_project_meta_ads_tenant_token_hint'
                        : 'com_ui_project_meta_ads_tenant_token_admin_hint',
                    )}
                  </div>
                  <span className="mt-1 inline-flex w-fit border border-border-light bg-surface-primary px-2 py-1 text-xs text-text-secondary">
                    {statusQuery.data?.credentials?.tenantConfigured
                      ? localize('com_ui_project_meta_ads_tenant_token_configured')
                      : localize('com_ui_project_meta_ads_token_missing')}
                  </span>
                </div>
                {canManageTenantToken && (
                  <div className="mt-3 flex h-10 overflow-hidden border border-border-light bg-surface-primary">
                    <input
                      type={showTenantAccessToken ? 'text' : 'password'}
                      autoComplete="new-password"
                      value={tenantAccessToken}
                      onChange={(event) => setTenantAccessToken(event.target.value)}
                      placeholder={localize('com_ui_project_meta_ads_token_placeholder')}
                      className="min-w-0 flex-1 bg-transparent px-3 text-sm text-text-primary outline-none"
                    />
                    {tenantAccessToken.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setShowTenantAccessToken((current) => !current)}
                        className="shrink-0 border-l border-border-light px-3 text-xs font-medium text-text-secondary"
                      >
                        {localize(
                          showTenantAccessToken ? 'com_ui_hide_password' : 'com_ui_show_password',
                        )}
                      </button>
                    )}
                  </div>
                )}
                {canManageTenantToken && (
                  <div className="mt-3 flex justify-end">
                    <button
                      type="button"
                      disabled={!tenantAccessToken.trim() || updateTenantToken.isLoading}
                      onClick={onSaveTenantToken}
                      className="h-8 bg-text-primary px-3 text-xs font-medium text-surface-primary disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {localize('com_ui_project_meta_ads_save_tenant_token')}
                    </button>
                  </div>
                )}
              </div>

              <div className="border border-border-light bg-surface-secondary p-3">
                <div className="flex flex-col gap-1">
                  <div className="text-sm font-medium text-text-primary">
                    {localize('com_ui_project_meta_ads_project_token')}
                  </div>
                  <div className="text-xs leading-5 text-text-tertiary">
                    {localize('com_ui_project_meta_ads_project_token_hint')}
                  </div>
                  <span className="mt-1 inline-flex w-fit border border-border-light bg-surface-primary px-2 py-1 text-xs text-text-secondary">
                    {hasProjectToken
                      ? localize('com_ui_project_meta_ads_project_token_configured')
                      : localize('com_ui_project_meta_ads_project_token_not_configured')}
                  </span>
                </div>
                <div className="mt-3 flex h-10 overflow-hidden border border-border-light bg-surface-primary">
                  <input
                    disabled={!canEdit}
                    type={showSettingsDraftToken ? 'text' : 'password'}
                    name="meta_ads_project_token_new"
                    autoComplete="new-password"
                    value={settingsDraftToken}
                    onChange={(event) => setSettingsDraftToken(event.target.value)}
                    placeholder={
                      hasProjectToken
                        ? localize('com_ui_project_meta_ads_token_keep_existing')
                        : localize('com_ui_project_meta_ads_token_placeholder')
                    }
                    className="min-w-0 flex-1 bg-transparent px-3 text-sm text-text-primary outline-none disabled:cursor-not-allowed"
                  />
                  {settingsDraftToken.length > 0 && (
                    <button
                      type="button"
                      disabled={!canEdit}
                      onClick={() => setShowSettingsDraftToken((current) => !current)}
                      className="shrink-0 border-l border-border-light px-3 text-xs font-medium text-text-secondary disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {localize(
                        showSettingsDraftToken ? 'com_ui_hide_password' : 'com_ui_show_password',
                      )}
                    </button>
                  )}
                </div>
                <div className="mt-3 flex flex-wrap justify-end gap-2">
                  {hasProjectToken && (
                    <button
                      type="button"
                      disabled={!canEdit || updateSettings.isLoading}
                      onClick={onClearProjectToken}
                      className="h-8 border border-border-light bg-surface-primary px-3 text-xs font-medium text-text-secondary disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {localize('com_ui_project_meta_ads_use_tenant_token')}
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={!canEdit || !settingsDraftToken.trim() || updateSettings.isLoading}
                    onClick={onSaveProjectToken}
                    className="h-8 bg-text-primary px-3 text-xs font-medium text-surface-primary disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {localize('com_ui_project_meta_ads_save_project_token')}
                  </button>
                </div>
              </div>
            </div>
            <div className="flex justify-end border-t border-border-light p-4">
              <button
                type="button"
                onClick={closeCredentialsDialog}
                className="h-8 border border-border-light px-3 text-xs font-medium text-text-secondary"
              >
                {localize('com_ui_close')}
              </button>
            </div>
          </OGDialogContent>
        </OGDialog>

        <div>
          <div className="flex flex-col gap-4 border-b border-white/10 bg-[#11100d]/95 p-4 shadow-[0_20px_60px_-44px_rgba(0,0,0,0.85)]">
            {isStatusLoading && (
              <div
                role="status"
                className="flex items-center gap-2 border border-amber-400/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-100"
              >
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-amber-900 border-t-amber-200" />
                <span>{localize('com_ui_project_meta_ads_loading')}</span>
              </div>
            )}
            <div className={`${metaAdsPanel} p-3`}>
              <div className="flex min-w-0 flex-col gap-3">
                <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-7">
                  <label className="flex min-w-0 flex-col gap-1 text-xs text-[#bdb5a6]">
                    <span className={metaAdsLabel}>
                      {localize('com_ui_project_meta_ads_period')}
                    </span>
                    <select
                      value={periodFilter}
                      onChange={(event) => setPeriodFilter(event.target.value as PeriodFilter)}
                      className={metaAdsInput}
                    >
                      {periodFilterOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {localize(option.labelKey)}
                        </option>
                      ))}
                    </select>
                  </label>
                  {periodFilter === 'custom' && (
                    <>
                      <label className="flex min-w-0 flex-col gap-1 text-xs text-[#bdb5a6]">
                        <span className={metaAdsLabel}>
                          {localize('com_ui_project_meta_ads_period_since')}
                        </span>
                        <input
                          type="date"
                          value={customSince}
                          max={customUntil || undefined}
                          onChange={(event) => onCustomSinceChange(event.target.value)}
                          className={metaAdsInput}
                        />
                      </label>
                      <label className="flex min-w-0 flex-col gap-1 text-xs text-[#bdb5a6]">
                        <span className={metaAdsLabel}>
                          {localize('com_ui_project_meta_ads_period_until')}
                        </span>
                        <input
                          type="date"
                          value={customUntil}
                          min={customSince || undefined}
                          onChange={(event) => onCustomUntilChange(event.target.value)}
                          className={metaAdsInput}
                        />
                      </label>
                    </>
                  )}
                  <label className="flex min-w-0 flex-col gap-1 text-xs text-[#bdb5a6]">
                    <span className={metaAdsLabel}>
                      {localize('com_ui_project_meta_ads_search')}
                    </span>
                    <input
                      value={campaignSearch}
                      onChange={(event) => setCampaignSearch(event.target.value)}
                      className={metaAdsInput}
                    />
                  </label>
                  <label className="flex min-w-0 flex-col gap-1 text-xs text-[#bdb5a6]">
                    <span className={metaAdsLabel}>
                      {localize('com_ui_project_meta_ads_budget_mode_filter')}
                    </span>
                    <select
                      value={budgetModeFilter}
                      onChange={(event) => setBudgetModeFilter(event.target.value)}
                      className={metaAdsInput}
                    >
                      <option value="all">{localize('com_ui_all')}</option>
                      <option value="CBO">CBO</option>
                      <option value="ABO">ABO</option>
                      <option value="UNKNOWN">UNKNOWN</option>
                    </select>
                  </label>
                  <label className="flex min-w-0 flex-col gap-1 text-xs text-[#bdb5a6]">
                    <span className={metaAdsLabel}>
                      {localize('com_ui_project_meta_ads_objective_filter')}
                    </span>
                    <select
                      value={objectiveFilter}
                      onChange={(event) => setObjectiveFilter(event.target.value)}
                      className={metaAdsInput}
                    >
                      <option value="all">{localize('com_ui_all')}</option>
                      {objectiveOptions.map((objective) => (
                        <option key={objective} value={objective}>
                          {getObjectiveLabel(objective, localize)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex min-w-0 flex-col gap-1 text-xs text-[#bdb5a6]">
                    <span className={metaAdsLabel}>{localize('com_ui_project_meta_ads_sort')}</span>
                    <select
                      value={campaignSort}
                      onChange={(event) => setCampaignSort(event.target.value)}
                      className={metaAdsInput}
                    >
                      <option value="name_asc">{localize('com_ui_name')}</option>
                      <option value="budget_desc">
                        {localize('com_ui_project_meta_ads_budget_defined')}
                      </option>
                      <option value="frequency_desc">
                        {localize('com_ui_project_meta_ads_frequency')}
                      </option>
                      <option value="spend_desc">
                        {localize('com_ui_project_meta_ads_spend')}
                      </option>
                      <option value="cpa_asc">
                        {localize('com_ui_project_meta_ads_cost_result')}
                      </option>
                      <option value="result_desc">
                        {localize('com_ui_project_meta_ads_result')}
                      </option>
                      <option value="ctr_desc">CTR</option>
                      <option value="clicks_desc">
                        {localize('com_ui_project_meta_ads_clicks')}
                      </option>
                    </select>
                  </label>
                  <label className="flex min-w-0 flex-col gap-1 text-xs text-[#bdb5a6]">
                    <span className={metaAdsLabel}>
                      {localize('com_ui_project_meta_ads_table_view')}
                    </span>
                    <select
                      value={tableView}
                      onChange={(event) => setTableView(event.target.value as TableView)}
                      className={metaAdsInput}
                    >
                      {tableViewOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {localize(option.labelKey)}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="flex flex-wrap items-center justify-start gap-2 xl:justify-end">
                  <span className="h-9 border border-white/10 bg-white/[0.03] px-3 py-2 font-mono text-xs tabular-nums text-[#d7cdbd]">
                    {localize('com_ui_project_meta_ads_selection_count', {
                      0: String(selectedCount),
                    })}
                  </span>
                  <button
                    type="button"
                    disabled={selectedCount === 0}
                    onClick={() => setSelectedEntityIds([])}
                    className={metaAdsGhostButton}
                  >
                    {localize('com_ui_project_meta_ads_clear_selection')}
                  </button>
                  <button
                    type="button"
                    disabled={campaigns.length === 0}
                    onClick={onExpandAllRows}
                    className={metaAdsGhostButton}
                  >
                    {localize('com_ui_project_meta_ads_expand_all')}
                  </button>
                  <button
                    type="button"
                    disabled={campaigns.length === 0}
                    onClick={onCollapseAllRows}
                    className={metaAdsGhostButton}
                  >
                    {localize('com_ui_project_meta_ads_collapse_all')}
                  </button>
                  <button
                    type="button"
                    disabled={!canCreateRuleGroup}
                    onClick={onOpenRuleGroupDraft}
                    className={metaAdsButton}
                  >
                    {localize('com_ui_project_meta_ads_create_rule_group')}
                  </button>
                  <button
                    type="button"
                    disabled={!canOpenTrafficAgentChat}
                    onClick={onOpenTrafficAgentChat}
                    className={metaAdsButton}
                  >
                    {localize('com_ui_project_meta_ads_chat_with_agent')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setMetricsFullscreen((current) => !current)}
                    aria-label={localize(
                      metricsFullscreen
                        ? 'com_ui_project_meta_ads_exit_fullscreen'
                        : 'com_ui_project_meta_ads_enter_fullscreen',
                    )}
                    className={`inline-flex items-center gap-2 ${metaAdsButton}`}
                  >
                    {metricsFullscreen ? (
                      <ArrowsIn className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <ArrowsOut className="h-4 w-4" aria-hidden="true" />
                    )}
                    {localize(
                      metricsFullscreen
                        ? 'com_ui_project_meta_ads_exit_fullscreen'
                        : 'com_ui_project_meta_ads_enter_fullscreen',
                    )}
                  </button>
                </div>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                {
                  labelKey: 'com_ui_project_meta_ads_total_spend' as TranslationKeys,
                  value: formatMoney(summaryTotalSpend, currency),
                  tone: 'border-l-amber-300/35',
                },
                {
                  labelKey: 'com_ui_project_meta_ads_total_results' as TranslationKeys,
                  value: formatMetric(summaryTotalResults),
                  tone: 'border-l-emerald-300/35',
                  context: summaryMetricContext,
                  clickable: summaryResultTypeOptions.length > 0,
                },
                {
                  labelKey: 'com_ui_project_meta_ads_average_cost' as TranslationKeys,
                  value: formatMoney(summaryAverageCost, currency),
                  tone: 'border-l-sky-300/30',
                  context: summaryMetricContext,
                },
                {
                  labelKey: 'com_ui_project_meta_ads_average_frequency' as TranslationKeys,
                  value: formatMetric(summaryAverageFrequency),
                  tone: 'border-l-rose-300/30',
                  context: scopedObjectiveSummary
                    ? getObjectiveLabel(scopedObjectiveSummary.objective, localize)
                    : undefined,
                },
              ].map(({ labelKey, value, tone, context, clickable }) => {
                const content = (
                  <>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8f8677]">
                      {localize(labelKey)}
                    </div>
                    {isInitialStatusLoading ? (
                      <div
                        data-testid="meta-ads-summary-skeleton"
                        className="mt-3 h-7 w-28 animate-pulse bg-white/10"
                      />
                    ) : (
                      <div className="mt-3 font-mono text-2xl font-semibold tabular-nums text-[#f8f1e5]">
                        {value}
                      </div>
                    )}
                    {context && !isInitialStatusLoading && (
                      <div className="mt-2 truncate text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8f8677]">
                        {context}
                      </div>
                    )}
                  </>
                );
                const className = `relative overflow-hidden border border-l-2 border-white/10 ${tone} bg-[#151512] p-4 text-left`;
                return clickable ? (
                  <button
                    key={labelKey}
                    type="button"
                    data-testid={`meta-ads-summary-card-${labelKey}`}
                    disabled={isInitialStatusLoading}
                    onClick={() => setResultTypeSelectorOpen(true)}
                    className={`${className} transition hover:border-white/25 disabled:cursor-wait disabled:opacity-80`}
                  >
                    {content}
                  </button>
                ) : (
                  <div
                    key={labelKey}
                    data-testid={`meta-ads-summary-card-${labelKey}`}
                    className={className}
                  >
                    {content}
                  </div>
                );
              })}
            </div>
            {resultTypeSelectorOpen && (
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="meta-ads-result-type-selector-title"
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4"
              >
                <div className="w-full max-w-xl border border-white/15 bg-[#151512] p-4 shadow-2xl">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h4
                        id="meta-ads-result-type-selector-title"
                        className="text-base font-semibold text-[#f8f1e5]"
                      >
                        {localize('com_ui_project_meta_ads_choose_result_metric')}
                      </h4>
                      <div className="mt-1 text-xs text-[#9f9687]">
                        {localize('com_ui_project_meta_ads_choose_result_metric_hint')}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setResultTypeSelectorOpen(false)}
                      className={metaAdsGhostButton}
                    >
                      {localize('com_ui_close')}
                    </button>
                  </div>
                  <div className="mt-4 space-y-2">
                    {summaryResultTypeOptions.map((option) => (
                      <button
                        key={option.resultType}
                        type="button"
                        onClick={() => {
                          setSelectedSummaryResultType(option.resultType);
                          setResultTypeSelectorOpen(false);
                        }}
                        className={`w-full border p-3 text-left transition ${
                          selectedSummaryResultType === option.resultType
                            ? 'border-emerald-300/60 bg-emerald-500/10'
                            : 'border-white/10 bg-black/10 hover:border-white/25'
                        }`}
                      >
                        <div className="truncate text-sm font-semibold text-[#f8f1e5]">
                          {getResultTypeLabel(option.resultType, localize)}
                        </div>
                        <div className="mt-2 grid gap-2 text-xs text-[#b8ae9f] sm:grid-cols-3">
                          <span>
                            {localize('com_ui_project_meta_ads_results')}:{' '}
                            {formatMetric(option.totalResults)}
                          </span>
                          <span>
                            {localize('com_ui_project_meta_ads_spend')}:{' '}
                            {formatMoney(option.totalSpend, currency)}
                          </span>
                          <span>
                            {localize('com_ui_project_meta_ads_average_cost')}:{' '}
                            {formatMoney(option.averageCostPerResult, currency)}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                  <div className="mt-4 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedSummaryResultType(null);
                        setResultTypeSelectorOpen(false);
                      }}
                      className={metaAdsGhostButton}
                    >
                      {localize('com_ui_project_meta_ads_clear_result_metric')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setResultTypeSelectorOpen(false)}
                      className={metaAdsButton}
                    >
                      {localize('com_ui_cancel')}
                    </button>
                  </div>
                </div>
              </div>
            )}
            {objectiveSummaries.length > 0 && !isInitialStatusLoading && (
              <div data-testid="meta-ads-objective-summary" className={`${metaAdsPanel} p-4`}>
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-semibold text-[#f8f1e5]">
                      {localize('com_ui_project_meta_ads_campaign_objectives')}
                    </h4>
                    <div className="mt-1 text-xs text-[#9f9687]">
                      {formatCountLabel(
                        objectiveSummaries.length,
                        'com_ui_project_meta_ads_objective_count_one',
                        'com_ui_project_meta_ads_objective_count_many',
                        localize,
                      )}
                    </div>
                  </div>
                </div>
                <div
                  className={`mt-4 grid gap-3 ${
                    objectiveSummaries.length > 1 ? '2xl:grid-cols-2' : ''
                  }`}
                >
                  {objectiveSummaries.map((summary, index) => {
                    const accent = objectiveAccentClasses[index % objectiveAccentClasses.length];
                    const resultTypesTotal = summary.resultTypes.reduce(
                      (total, resultType) => total + Number(resultType.totalResults ?? 0),
                      0,
                    );
                    return (
                      <section
                        key={summary.objective || 'UNKNOWN'}
                        className={`min-w-0 border p-4 ${accent.shell}`}
                      >
                        <div className="grid min-w-0 gap-3 md:grid-cols-[minmax(0,1fr)_minmax(74px,90px)_minmax(74px,90px)_minmax(88px,110px)_minmax(72px,90px)_minmax(88px,110px)] md:items-start">
                          <div className="min-w-0 md:self-center">
                            <h5 className={`truncate text-base font-semibold ${accent.text}`}>
                              {getObjectiveLabel(summary.objective, localize)}
                            </h5>
                            <div className="mt-1 text-xs text-[#b8ae9f]">
                              {formatCountLabel(
                                summary.campaignCount,
                                'com_ui_project_meta_ads_campaign_count_one',
                                'com_ui_project_meta_ads_campaign_count_many',
                                localize,
                              )}
                            </div>
                          </div>
                          {[
                            [
                              'com_ui_project_meta_ads_spend',
                              formatMoney(summary.totalSpend, currency),
                            ],
                            ['com_ui_project_meta_ads_results', formatMetric(summary.totalResults)],
                            [
                              'com_ui_project_meta_ads_cost_result',
                              formatMoney(summary.averageCostPerResult, currency),
                            ],
                            ['CTR', formatPercent(summary.averageCtr)],
                            [
                              'com_ui_project_meta_ads_frequency',
                              formatMetric(summary.averageFrequency),
                            ],
                          ].map(([label, value]) => (
                            <div
                              key={label}
                              className="flex items-baseline justify-between gap-3 md:block md:text-right"
                            >
                              <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#847b6d]">
                                {label === 'CTR' ? label : localize(label as TranslationKeys)}
                              </div>
                              <div className="mt-1 font-mono text-sm font-semibold tabular-nums text-[#f8f1e5]">
                                {value}
                              </div>
                            </div>
                          ))}
                        </div>

                        {summary.resultTypes.length > 0 && (
                          <div className="mt-4 space-y-2">
                            <div className="hidden min-w-0 grid-cols-[minmax(0,1fr)_minmax(74px,90px)_minmax(74px,90px)_minmax(88px,110px)_minmax(72px,90px)_minmax(88px,110px)] gap-3 border-b border-white/10 pb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#847b6d] md:grid">
                              <div>{localize('com_ui_project_meta_ads_result_type')}</div>
                              <div className="text-right">
                                {localize('com_ui_project_meta_ads_spend')}
                              </div>
                              <div className="text-right">
                                {localize('com_ui_project_meta_ads_results')}
                              </div>
                              <div className="text-right">
                                {localize('com_ui_project_meta_ads_cost_result')}
                              </div>
                              <div className="text-right">CTR</div>
                              <div className="text-right">
                                {localize('com_ui_project_meta_ads_result_share')}
                              </div>
                            </div>
                            {summary.resultTypes.map((resultType) => {
                              const shareWidth = getShareWidth(
                                Number(resultType.totalResults ?? 0),
                                resultTypesTotal,
                              );
                              return (
                                <div
                                  key={resultType.resultType || 'UNKNOWN'}
                                  className="grid min-w-0 gap-3 border border-white/10 bg-black/10 px-3 py-3 text-xs md:grid-cols-[minmax(0,1fr)_minmax(74px,90px)_minmax(74px,90px)_minmax(88px,110px)_minmax(72px,90px)_minmax(88px,110px)] md:items-center md:py-2"
                                >
                                  <div className="min-w-0">
                                    <div className="truncate font-semibold text-[#f3efe6]">
                                      {getResultTypeLabel(resultType.resultType, localize)}
                                    </div>
                                    <div className="mt-1 h-1 overflow-hidden bg-white/10">
                                      <div
                                        className={`h-full ${accent.bar}`}
                                        style={{ width: shareWidth }}
                                      />
                                    </div>
                                  </div>
                                  {[
                                    [
                                      'com_ui_project_meta_ads_spend',
                                      formatMoney(resultType.totalSpend, currency),
                                      'text-[#d8cfbf]',
                                    ],
                                    [
                                      'com_ui_project_meta_ads_results',
                                      formatMetric(resultType.totalResults),
                                      'text-[#d8cfbf]',
                                    ],
                                    [
                                      'com_ui_project_meta_ads_cost_result',
                                      formatMoney(resultType.averageCostPerResult, currency),
                                      'text-[#f3efe6]',
                                    ],
                                    ['CTR', formatPercent(resultType.averageCtr), 'text-[#d8cfbf]'],
                                    [
                                      'com_ui_project_meta_ads_result_share',
                                      formatSharePercent(
                                        Number(resultType.totalResults ?? 0),
                                        resultTypesTotal,
                                      ),
                                      'text-[#d8cfbf]',
                                    ],
                                  ].map(([labelKey, value, colorClass]) => (
                                    <div
                                      key={labelKey}
                                      className="flex items-baseline justify-between gap-3 md:block md:text-right"
                                    >
                                      <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#847b6d] md:hidden">
                                        {labelKey === 'CTR'
                                          ? labelKey
                                          : localize(labelKey as TranslationKeys)}
                                      </span>
                                      <span className={`font-mono tabular-nums ${colorClass}`}>
                                        {value}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </section>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {pendingRecommendations.length > 0 && campaigns.length === 0 && (
            <div className="border-b border-border-light bg-surface-secondary p-3">
              <div className="space-y-2">
                {pendingRecommendations.map((recommendation) => (
                  <div
                    key={recommendation._id ?? recommendation.entityId}
                    className="flex items-center justify-between gap-3 border border-border-light bg-surface-primary p-2 text-xs"
                  >
                    <div className="min-w-0">
                      <div className="truncate font-medium text-text-primary">
                        {recommendation.entityName ?? recommendation.entityId}
                      </div>
                      <div className="text-text-secondary">
                        {getRecommendationLabel(recommendation, currency)}
                      </div>
                    </div>
                    {canApplyRecommendation(recommendation) && (
                      <button
                        type="button"
                        disabled={!canEdit || applyRecommendation.isLoading}
                        onClick={() => onApply(recommendation)}
                        className="h-7 shrink-0 border border-border-light px-2 font-medium text-text-primary disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {localize('com_ui_project_meta_ads_apply')}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {budgetEditor && (
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="meta-ads-budget-dialog-title"
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4"
            >
              <div className="relative w-full max-w-2xl overflow-hidden border border-white/10 bg-[#151411] p-5 text-[#f3efe6] shadow-[0_28px_90px_-60px_rgba(0,0,0,0.95)] sm:p-6">
                <div className="relative min-w-0">
                  <h4
                    id="meta-ads-budget-dialog-title"
                    className="text-2xl font-semibold leading-tight tracking-tight text-[#f8f1e5]"
                  >
                    {localize('com_ui_project_meta_ads_edit_budget')}
                  </h4>
                  <div className="mt-4 truncate text-lg font-semibold text-[#f3efe6]">
                    {budgetEditor.entityName ?? budgetEditor.entityId}
                  </div>
                  <div className="mt-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8f8677]">
                    {budgetEditor.entityLevel === 'campaign'
                      ? localize('com_ui_project_meta_ads_campaign')
                      : localize('com_ui_project_meta_ads_select_ad_set')}
                  </div>
                  <div className="mt-4 max-w-[56ch] text-sm leading-6 text-[#cfc6b7]">
                    {localize('com_ui_project_meta_ads_manual_budget_hint')}
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-[0.9fr_1.1fr]">
                    <div className="border border-white/10 bg-white/[0.035] p-4">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8f8677]">
                        {localize('com_ui_project_meta_ads_budget_defined')}
                      </div>
                      <div className="mt-2 font-mono text-2xl font-semibold tabular-nums text-[#f8f1e5]">
                        {formatMoney(budgetEditor.currentBudget, currency)}
                      </div>
                    </div>
                    <label className="border border-amber-300/20 bg-amber-300/[0.06] p-4 text-xs text-[#cfc6b7]">
                      <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#b9a06a]">
                        {localize('com_ui_project_meta_ads_new_budget')}
                      </span>
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={manualDailyBudget}
                        onChange={(event) => setManualDailyBudget(event.target.value)}
                        className="mt-2 h-11 w-full border border-white/10 bg-[#1f1b15] px-3 font-mono text-lg font-semibold tabular-nums text-[#f8f1e5] outline-none transition duration-200 focus:border-amber-300/60 focus:ring-2 focus:ring-amber-300/20"
                      />
                    </label>
                  </div>

                  {buildBudgetReferences(budgetEditor.currentBudget, currency).length > 0 && (
                    <div className="mt-5">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8f8677]">
                          {localize('com_ui_project_meta_ads_budget_quick_adjustments')}
                        </div>
                        <div className="h-px flex-1 bg-white/10" />
                      </div>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {buildBudgetReferences(budgetEditor.currentBudget, currency).map(
                          (reference) => (
                            <button
                              key={reference.percent}
                              type="button"
                              aria-label={reference.accessibleLabel}
                              onClick={() => setManualDailyBudget(reference.value.toFixed(2))}
                              className={`group flex min-h-16 items-center justify-between gap-3 border px-3 py-2 text-left transition duration-200 hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-amber-300/25 active:translate-y-0 ${reference.tone}`}
                            >
                              <span className="text-sm font-semibold">{reference.label}</span>
                              <span className="font-mono text-sm font-semibold tabular-nums text-[#f8f1e5]">
                                {reference.formattedValue}
                              </span>
                            </button>
                          ),
                        )}
                      </div>
                    </div>
                  )}
                </div>
                <div className="relative mt-6 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setBudgetEditor(null)}
                    className="h-10 border border-white/10 px-4 text-sm font-semibold text-[#d8cfbf] transition duration-200 hover:bg-white/[0.06] focus:outline-none focus:ring-2 focus:ring-white/15 active:translate-y-px"
                  >
                    {localize('com_ui_cancel')}
                  </button>
                  <button
                    type="button"
                    disabled={updateBudget.isLoading}
                    onClick={onSaveManualBudget}
                    className="h-10 bg-[#f8f1e5] px-5 text-sm font-semibold text-[#14120f] shadow-[0_18px_42px_-28px_rgba(248,241,229,0.9)] transition duration-200 hover:-translate-y-0.5 hover:bg-white focus:outline-none focus:ring-2 focus:ring-amber-300/40 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {localize('com_ui_project_meta_ads_save_budget')}
                  </button>
                </div>
              </div>
            </div>
          )}

          {budgetConfirmation && (
            <div className="border-b border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
              <div className="font-semibold">
                {localize('com_ui_project_meta_ads_confirm_budget_title')}
              </div>
              <div className="mt-1">
                {budgetConfirmation.entityName ?? budgetConfirmation.entityId}:{' '}
                {formatMoney(budgetConfirmation.currentBudget, currency)}
                {' -> '}
                {formatMoney(budgetConfirmation.dailyBudget, currency)}
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => setBudgetConfirmation(null)}
                  className="h-8 border border-amber-300 px-3 text-xs font-medium"
                >
                  {localize('com_ui_cancel')}
                </button>
                <button
                  type="button"
                  disabled={updateBudget.isLoading}
                  onClick={onConfirmManualBudget}
                  className="h-8 bg-amber-900 px-3 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {localize('com_ui_project_meta_ads_confirm_budget')}
                </button>
              </div>
            </div>
          )}

          {ruleGroupDraft && (
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="meta-ads-rule-group-dialog-title"
              className="fixed inset-0 z-50 flex justify-end bg-black/30"
            >
              <div className="flex h-full w-full max-w-lg flex-col border-l border-border-light bg-surface-primary shadow-xl">
                <div className="border-b border-border-light p-4">
                  <h4
                    id="meta-ads-rule-group-dialog-title"
                    className="text-base font-semibold text-text-primary"
                  >
                    {localize(
                      ruleGroupDraft.scope === 'global'
                        ? 'com_ui_project_meta_ads_global_rules'
                        : ruleGroupDraft.id
                          ? 'com_ui_project_meta_ads_edit_rule_group'
                          : 'com_ui_project_meta_ads_create_rule_group',
                    )}
                  </h4>
                  {ruleGroupDraft.scope === 'global' ? (
                    <div className="mt-2 text-xs text-text-tertiary">
                      {localize('com_ui_project_meta_ads_global_rules_hint')}
                    </div>
                  ) : (
                    <div className="mt-2 space-y-2">
                      <div className="text-xs uppercase text-text-tertiary">
                        {ruleGroupDraft.entityLevel === 'campaign'
                          ? localize('com_ui_project_meta_ads_campaign')
                          : localize('com_ui_project_meta_ads_select_ad_set')}
                        {' · '}
                        {ruleGroupDraft.entityIds.length}{' '}
                        {localize('com_ui_project_meta_ads_rule_group_selected')}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {selectedRuleGroupLabels.slice(0, 8).map((label) => (
                          <span
                            key={label}
                            className="border border-border-light bg-surface-secondary px-2 py-1 text-xs text-text-secondary"
                          >
                            {label}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex-1 space-y-4 overflow-y-auto p-4">
                  {ruleGroupDraft.scope === 'group' && (
                    <label className="flex flex-col gap-1 text-xs text-text-secondary">
                      {localize('com_ui_project_meta_ads_rule_group_name')}
                      <input
                        value={ruleGroupDraft.name}
                        onChange={(event) =>
                          setRuleGroupDraft((current) =>
                            current ? { ...current, name: event.target.value } : current,
                          )
                        }
                        className="h-10 border border-border-light bg-surface-secondary px-3 text-sm text-text-primary"
                      />
                    </label>
                  )}
                  {ruleGroupDraft.scope === 'global' && (
                    <label className="flex flex-col gap-1 text-xs text-text-secondary">
                      {localize('com_ui_project_meta_ads_account_profile')}
                      <select
                        value={settings.accountProfile ?? 'custom'}
                        onChange={(event) =>
                          onAccountProfileChange(
                            event.target.value as MetaAdsSettingsState['accountProfile'],
                          )
                        }
                        className="h-10 border border-border-light bg-surface-secondary px-3 text-sm text-text-primary"
                      >
                        {accountProfileOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {localize(option.labelKey)}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="flex flex-col gap-1 text-xs text-text-secondary">
                      {localize('com_ui_project_meta_ads_target_result_type')}
                      <select
                        value={ruleGroupDraft.rules.targetResultType ?? ''}
                        onChange={(event) =>
                          onRuleGroupRuleTextChange('targetResultType', event.target.value)
                        }
                        className="h-10 border border-border-light bg-surface-secondary px-3 text-sm text-text-primary"
                      >
                        <option value="">
                          {localize('com_ui_project_meta_ads_result_type_legacy')}
                        </option>
                        {resultTypeOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {localize(option.labelKey)}
                          </option>
                        ))}
                      </select>
                      <span className="text-[11px] text-text-tertiary">
                        {localize('com_ui_project_meta_ads_target_result_type_hint')}
                      </span>
                    </label>
                    <label className="flex flex-col gap-1 text-xs text-text-secondary">
                      {localize('com_ui_project_meta_ads_primary_metric')}
                      <select
                        value={ruleGroupDraft.rules.primaryMetric ?? 'cpa'}
                        onChange={(event) =>
                          onRuleGroupRuleTextChange('primaryMetric', event.target.value)
                        }
                        className="h-10 border border-border-light bg-surface-secondary px-3 text-sm text-text-primary"
                      >
                        {primaryMetricOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {localize(option.labelKey)}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {numberFields.map((field) => (
                      <label
                        key={field.key}
                        className="flex flex-col gap-1 text-xs text-text-secondary"
                      >
                        {localize(field.labelKey)}
                        <input
                          type="number"
                          step={field.step}
                          min={
                            field.key === 'minRoas' || field.key === 'minSpend'
                              ? '0'
                              : field.key === 'cooldownHours'
                                ? '1'
                                : '0.01'
                          }
                          max={
                            field.key === 'maxIncreasePct' || field.key === 'maxDecreasePct'
                              ? '100'
                              : field.key === 'cooldownHours'
                                ? '168'
                                : undefined
                          }
                          value={ruleGroupDraft.rules[field.key]}
                          onChange={(event) => onRuleGroupRuleChange(field.key, event.target.value)}
                          className="h-10 border border-border-light bg-surface-secondary px-3 text-sm text-text-primary"
                        />
                      </label>
                    ))}
                    {optionalNumberFields.map((field) => (
                      <label
                        key={field.key}
                        className="flex flex-col gap-1 text-xs text-text-secondary"
                      >
                        {localize(field.labelKey)}
                        <input
                          type="number"
                          step={field.step}
                          min="0"
                          value={ruleGroupDraft.rules[field.key] ?? ''}
                          placeholder={localize('com_ui_project_meta_ads_optional_rule')}
                          onChange={(event) => onRuleGroupRuleChange(field.key, event.target.value)}
                          className="h-10 border border-border-light bg-surface-secondary px-3 text-sm text-text-primary"
                        />
                      </label>
                    ))}
                    <label className="flex flex-col gap-1 text-xs text-text-secondary">
                      {localize('com_ui_project_meta_ads_max_frequency_alert')}
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={ruleGroupDraft.creativeRules.maxFrequency}
                        onChange={(event) =>
                          onRuleGroupCreativeRuleChange('maxFrequency', event.target.value)
                        }
                        className="h-10 border border-border-light bg-surface-secondary px-3 text-sm text-text-primary"
                      />
                    </label>
                  </div>
                </div>
                <div className="flex justify-end gap-2 border-t border-border-light p-4">
                  <button
                    type="button"
                    onClick={() => setRuleGroupDraft(null)}
                    className="h-8 border border-border-light px-3 text-xs font-medium text-text-secondary"
                  >
                    {localize('com_ui_cancel')}
                  </button>
                  <button
                    type="button"
                    disabled={updateSettings.isLoading}
                    onClick={onSaveRuleGroup}
                    className="h-8 bg-text-primary px-3 text-xs font-medium text-surface-primary disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {localize('com_ui_project_meta_ads_save_rule_group')}
                  </button>
                </div>
              </div>
            </div>
          )}

          <div
            ref={tableScrollRef}
            onScroll={onTableScroll}
            className="max-w-full overflow-x-auto bg-[#0f0e0b]"
          >
            <table
              className={`w-full ${tableViewMinWidth[tableView]} table-fixed border-separate border-spacing-0 text-left text-xs [&_td:last-child]:border-r-0 [&_td]:border-r [&_td]:border-white/[0.06] [&_th:last-child]:border-r-0 [&_th]:border-r [&_th]:border-white/10`}
            >
              <thead className="sticky top-0 z-30 border-b border-white/10 bg-[#1b1812] text-[11px] uppercase tracking-[0.12em] text-[#8f8677] shadow-[0_16px_40px_-32px_rgba(0,0,0,0.9)]">
                <tr>
                  <th className="sticky left-0 z-40 w-10 border-b border-white/10 bg-[#1b1812] px-2 py-3">
                    <span className="sr-only">
                      {localize('com_ui_project_meta_ads_select_ad_set')}
                    </span>
                  </th>
                  <th className="sticky left-10 z-40 w-10 border-b border-white/10 bg-[#1b1812] px-2 py-3 shadow-[10px_0_18px_-18px_rgba(245,158,11,0.8)]">
                    <span className="sr-only">
                      {localize('com_ui_project_meta_ads_expand_campaign')}
                    </span>
                  </th>
                  {tableColumns.map((column) => {
                    const label =
                      column.label ?? (column.labelKey ? localize(column.labelKey) : '');
                    const alignClass = column.align === 'right' ? 'text-right' : '';
                    const stickyClass =
                      column.key === 'name'
                        ? 'sticky left-20 z-40 bg-[#1b1812] shadow-[14px_0_26px_-22px_rgba(0,0,0,0.9)]'
                        : '';
                    return (
                      <th
                        key={column.key}
                        className={`${column.widthClass} ${alignClass} ${stickyClass} border-b border-white/10 px-3 py-3`}
                      >
                        {column.key === 'actions' ? (
                          <span className="sr-only">{label}</span>
                        ) : column.sortableKey ? (
                          renderSortableHeader({
                            key: column.sortableKey,
                            label,
                            className: column.align === 'right' ? 'justify-end text-right' : '',
                            defaultDirection: column.defaultDirection,
                          })
                        ) : (
                          label
                        )}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {isInitialStatusLoading &&
                  Array.from({ length: 5 }).map((_, index) => (
                    <tr
                      key={`meta-ads-row-skeleton-${index}`}
                      data-testid="meta-ads-row-skeleton"
                      className="border-b border-border-light"
                    >
                      <td className="px-2 py-3" colSpan={tableColumnCount}>
                        <div className="flex items-center gap-4">
                          <div className="h-[18px] w-[18px] animate-pulse border border-border-light bg-surface-secondary" />
                          <div className="h-7 w-7 animate-pulse border border-border-light bg-surface-secondary" />
                          <div className="h-4 w-48 animate-pulse bg-surface-secondary" />
                          <div className="h-4 w-28 animate-pulse bg-surface-secondary" />
                          <div className="h-4 w-24 animate-pulse bg-surface-secondary" />
                          <div className="h-4 w-20 animate-pulse bg-surface-secondary" />
                        </div>
                      </td>
                    </tr>
                  ))}
                {(() => {
                  let rowIndex = 0;
                  return filteredCampaigns.map((campaign) => {
                    const expanded =
                      campaign.budgetMode === 'ABO'
                        ? !collapsedAboCampaignIds.includes(campaign.campaignId)
                        : expandedCampaignIds.includes(campaign.campaignId);
                    const selected = selectedEntityIds.includes(`campaign:${campaign.campaignId}`);
                    const recommendation = getEntityRecommendation(campaign.campaignId);
                    const campaignRowIndex = rowIndex;
                    rowIndex += 1;

                    return (
                      <Fragment key={campaign.campaignId}>
                        <tr
                          data-testid="meta-ads-campaign-row"
                          className={getTableRowClass(campaignRowIndex, 'campaign')}
                        >
                          <td className="sticky left-0 z-20 bg-inherit px-2 py-2 align-middle">
                            <input
                              type="checkbox"
                              checked={selected}
                              aria-label={localize('com_ui_project_meta_ads_select_campaign')}
                              onChange={() => onToggleCampaign(campaign)}
                              className="h-4 w-4 border-border-light bg-surface-primary text-text-primary"
                            />
                          </td>
                          <td className="sticky left-10 z-20 bg-inherit px-2 py-2 align-middle">
                            {campaign.adSets.length > 0 && (
                              <button
                                type="button"
                                aria-label={localize('com_ui_project_meta_ads_expand_campaign')}
                                aria-expanded={expanded}
                                onClick={() => onToggleCampaignExpanded(campaign)}
                                className="h-6 w-6 border border-border-light bg-surface-primary font-mono text-xs leading-none text-text-secondary"
                              >
                                {expanded ? '-' : '+'}
                              </button>
                            )}
                          </td>
                          {tableColumns.map((column) =>
                            renderCampaignCell(column, campaign, recommendation),
                          )}
                        </tr>
                        {expanded &&
                          campaign.adSets.map((adset) => {
                            const adsetSelected = selectedEntityIds.includes(
                              `adset:${adset.entityId}`,
                            );
                            const adsetRecommendation = getEntityRecommendation(adset.entityId);
                            const adsetAds = adset.ads ?? [];
                            const adsCollapsed = collapsedAdSetAdsIds.includes(adset.entityId);
                            const adsetRowIndex = rowIndex;
                            rowIndex += 1;

                            return (
                              <Fragment key={adset.entityId}>
                                <tr
                                  data-testid="meta-ads-adset-row"
                                  className={getTableRowClass(adsetRowIndex, 'adset')}
                                >
                                  <td className="sticky left-0 z-20 bg-inherit px-2 py-2 pl-6 align-middle">
                                    <input
                                      type="checkbox"
                                      checked={adsetSelected}
                                      aria-label={localize('com_ui_project_meta_ads_select_ad_set')}
                                      onChange={() => onToggleAdSet(adset.entityId)}
                                      className="h-4 w-4 border-border-light bg-surface-primary text-text-primary"
                                    />
                                  </td>
                                  <td className="sticky left-10 z-20 bg-inherit px-2 py-2 align-middle">
                                    {adsetAds.length > 0 ? (
                                      <button
                                        type="button"
                                        aria-expanded={!adsCollapsed}
                                        aria-label={localize(
                                          adsCollapsed
                                            ? 'com_ui_project_meta_ads_show_ads'
                                            : 'com_ui_project_meta_ads_hide_ads',
                                        )}
                                        onClick={() => onToggleAdSetAds(adset.entityId)}
                                        className="h-6 w-6 border border-border-light bg-surface-primary font-mono text-xs leading-none text-text-secondary"
                                      >
                                        {adsCollapsed ? '+' : '-'}
                                      </button>
                                    ) : (
                                      <span aria-hidden="true" className="block h-7 w-7" />
                                    )}
                                  </td>
                                  {tableColumns.map((column) =>
                                    renderAdSetCell(column, campaign, adset, adsetRecommendation),
                                  )}
                                </tr>
                                {!adsCollapsed &&
                                  adsetAds.map((ad) => {
                                    const adRowIndex = rowIndex;
                                    rowIndex += 1;
                                    return renderAdRow(ad, adRowIndex);
                                  })}
                              </Fragment>
                            );
                          })}
                      </Fragment>
                    );
                  });
                })()}
              </tbody>
            </table>
            {filteredCampaigns.length === 0 && !isInitialStatusLoading && (
              <div className="border-t border-dashed border-border-light py-8 text-center text-sm text-text-secondary">
                {localize('com_ui_project_meta_ads_no_snapshots')}
              </div>
            )}
          </div>
          <div className="sticky bottom-0 z-50 border-t border-white/10 bg-[#10110f] px-4 py-2">
            <div
              ref={stickyHorizontalScrollRef}
              onScroll={onStickyHorizontalScroll}
              className="max-w-full overflow-x-auto"
              aria-hidden="true"
            >
              <div className={`h-2 w-full ${tableViewMinWidth[tableView]}`} />
            </div>
          </div>
        </div>

        {(settings.ruleGroups ?? []).length > 0 && (
          <div className="border-t border-border-light bg-surface-secondary p-3">
            <h4 className="text-xs font-semibold uppercase text-text-tertiary">
              {localize('com_ui_project_meta_ads_rule_groups')}
            </h4>
            <div className="mt-2 flex flex-wrap gap-2">
              {(settings.ruleGroups ?? []).map((group) => (
                <div
                  key={group.id ?? group.name}
                  className="flex items-center gap-2 border border-border-light bg-surface-primary px-2 py-1 text-xs text-text-secondary"
                >
                  <span className="font-medium text-text-primary">{group.name}</span>
                  <span>
                    {group.entityLevel} · {(group.entityIds ?? []).length}{' '}
                    {localize('com_ui_project_meta_ads_rule_group_selected')}
                  </span>
                  <button
                    type="button"
                    disabled={!canEdit}
                    onClick={() => onEditRuleGroup(group)}
                    className="font-medium text-text-primary disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {localize('com_ui_project_meta_ads_edit_rule_group')}
                  </button>
                  <button
                    type="button"
                    disabled={!canEdit}
                    onClick={() => onDeleteRuleGroup(group.id)}
                    className="font-medium text-text-primary disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {localize('com_ui_project_meta_ads_delete_rule_group')}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="border-t border-white/10 p-3">
          <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-[0.14em] text-[#a39a8c]">
                {localize('com_ui_project_meta_ads_bi_rankings')}
              </h4>
              <p className="mt-1 text-xs text-[#81796b]">
                {localize('com_ui_project_meta_ads_bi_rankings_hint')}
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="flex min-w-48 flex-col gap-1 text-[11px] uppercase tracking-[0.12em] text-[#948b7d]">
                {localize('com_ui_project_meta_ads_objective')}
                <select
                  data-testid="meta-ads-bi-objective-filter"
                  value={biObjectiveFilter}
                  onChange={(event) => setBiObjectiveFilter(event.target.value)}
                  className={metaAdsInput}
                >
                  <option value="all">{localize('com_ui_project_meta_ads_filter_all')}</option>
                  {objectiveOptions.map((objective) => (
                    <option key={objective} value={objective}>
                      {getObjectiveLabel(objective, localize)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex min-w-48 flex-col gap-1 text-[11px] uppercase tracking-[0.12em] text-[#948b7d]">
                {localize('com_ui_project_meta_ads_target_result_type')}
                <select
                  data-testid="meta-ads-bi-result-type-filter"
                  value={biResultTypeFilter}
                  onChange={(event) => setBiResultTypeFilter(event.target.value)}
                  className={metaAdsInput}
                >
                  <option value="all">{localize('com_ui_project_meta_ads_filter_all')}</option>
                  {biResultTypeOptions.map((resultType) => (
                    <option key={resultType} value={resultType}>
                      {getResultTypeLabel(resultType, localize)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
          <div className="grid gap-3 xl:grid-cols-3">
            {renderBiRankingCard(
              'com_ui_project_meta_ads_bi_top_campaigns',
              biRankings.campaigns,
              'meta-ads-bi-campaigns',
            )}
            {renderBiRankingCard(
              'com_ui_project_meta_ads_bi_top_adsets',
              biRankings.adSets,
              'meta-ads-bi-adsets',
            )}
            {renderBiRankingCard(
              'com_ui_project_meta_ads_bi_top_ads',
              biRankings.ads,
              'meta-ads-bi-ads',
            )}
          </div>
        </div>

        {hasEvolutionSection && (
          <div className="border-t border-white/10 p-3">
            <h4 className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-[#a39a8c]">
              {localize('com_ui_project_meta_ads_evolution_analysis')}
            </h4>
            <div
              data-testid="meta-ads-evolution-dashboard"
              className="grid gap-3 xl:grid-cols-[1.4fr_1fr]"
            >
              <div className="border border-white/10 bg-[#12120f] p-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h5 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#a39a8c]">
                      {localize('com_ui_project_meta_ads_evolution_comparison')}
                    </h5>
                    <p className="mt-1 text-xs text-[#81796b]">
                      {localize('com_ui_project_meta_ads_evolution_comparison_hint')}
                    </p>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <select
                      className={metaAdsInput}
                      value={evolutionLevel}
                      onChange={(event) => setEvolutionLevel(event.target.value as EvolutionLevel)}
                    >
                      <option value="campaign">
                        {localize('com_ui_project_meta_ads_level_campaign')}
                      </option>
                      <option value="adset">
                        {localize('com_ui_project_meta_ads_level_ad_set')}
                      </option>
                    </select>
                    <select
                      className={metaAdsInput}
                      value={evolutionMetric}
                      onChange={(event) =>
                        setEvolutionMetric(event.target.value as EvolutionMetric)
                      }
                    >
                      <option value="spend">{localize('com_ui_project_meta_ads_spend')}</option>
                      <option value="resultCount">
                        {localize('com_ui_project_meta_ads_results')}
                      </option>
                      <option value="cpa">{localize('com_ui_project_meta_ads_cpa')}</option>
                    </select>
                  </div>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-4">
                  {[
                    [
                      'com_ui_project_meta_ads_metric' as TranslationKeys,
                      getEvolutionMetricLabel(evolutionMetric, localize),
                    ],
                    [
                      'com_ui_project_meta_ads_series' as TranslationKeys,
                      formatIntegerMetric(evolutionSeries.length),
                    ],
                    [
                      'com_ui_project_meta_ads_peak_value' as TranslationKeys,
                      formatEvolutionMetricValue(maxEvolutionValue, evolutionMetric, currency),
                    ],
                    [
                      'com_ui_project_meta_ads_budget_changes' as TranslationKeys,
                      formatIntegerMetric(totalBudgetChangeCount),
                    ],
                  ].map(([labelKey, value]) => (
                    <div key={labelKey} className="border border-white/10 bg-white/[0.025] p-2">
                      <div className="text-[10px] uppercase tracking-[0.12em] text-[#81796b]">
                        {localize(labelKey)}
                      </div>
                      <div className="mt-1 truncate font-mono text-xs text-[#f3efe6]" title={value}>
                        {value}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-3 h-48 border-b border-white/10">
                  {canRenderEvolutionSeries ? (
                    <svg
                      data-testid="meta-ads-evolution-chart"
                      viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                      role="img"
                      aria-label={localize('com_ui_project_meta_ads_evolution_comparison')}
                      className="h-full w-full text-[#f3efe6]"
                      preserveAspectRatio="none"
                    >
                      {[0.25, 0.5, 0.75].map((line) => (
                        <line
                          key={line}
                          x1={chartPadding}
                          x2={chartWidth - chartPadding}
                          y1={chartBottom - line * (chartHeight - chartPadding * 2)}
                          y2={chartBottom - line * (chartHeight - chartPadding * 2)}
                          stroke="currentColor"
                          strokeOpacity="0.08"
                          vectorEffect="non-scaling-stroke"
                        />
                      ))}
                      {evolutionSeriesPaths.map((seriesPath) => (
                        <Fragment key={seriesPath.series.entityId}>
                          <path
                            d={seriesPath.path}
                            fill="none"
                            stroke={seriesPath.color}
                            strokeWidth="2.2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            vectorEffect="non-scaling-stroke"
                          />
                          {seriesPath.points.map((point) => (
                            <circle
                              key={`${seriesPath.series.entityId}:${point.date}`}
                              cx={point.x}
                              cy={point.y}
                              r="2.5"
                              fill={seriesPath.color}
                            >
                              <title>
                                {`${cleanDashboardName(
                                  seriesPath.series.entityName,
                                  seriesPath.series.entityId,
                                )} · ${formatTrendDate(point.date)} · ${formatEvolutionMetricValue(
                                  point.value,
                                  evolutionMetric,
                                  currency,
                                )}`}
                              </title>
                            </circle>
                          ))}
                        </Fragment>
                      ))}
                    </svg>
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-sm text-[#a39a8c]">
                      {localize('com_ui_project_meta_ads_insufficient_evolution')}
                    </div>
                  )}
                </div>
                <div className="mt-2 flex justify-between gap-3 text-[11px] text-[#81796b]">
                  {evolutionDates.map((date, index) =>
                    shouldShowTrendLabel(index, evolutionDates.length) ? (
                      <span key={date} className="font-mono">
                        {formatTrendDate(date)}
                      </span>
                    ) : null,
                  )}
                </div>
                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  {evolutionSeriesPaths.map((seriesPath) => (
                    <div
                      key={seriesPath.series.entityId}
                      className="flex min-w-0 items-center justify-between gap-3 border border-white/10 bg-white/[0.025] px-2 py-2"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 shrink-0"
                          style={{ backgroundColor: seriesPath.color }}
                        />
                        <div className="min-w-0">
                          <div
                            className="truncate text-xs font-semibold text-[#f3efe6]"
                            title={cleanDashboardName(
                              seriesPath.series.entityName,
                              seriesPath.series.entityId,
                            )}
                          >
                            {cleanDashboardName(
                              seriesPath.series.entityName,
                              seriesPath.series.entityId,
                            )}
                          </div>
                          {seriesPath.series.parentCampaignName && (
                            <div className="truncate text-[10px] text-[#81796b]">
                              {cleanDashboardName(
                                seriesPath.series.parentCampaignName,
                                seriesPath.series.parentCampaignName,
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="font-mono text-xs text-[#f3efe6]">
                        {formatEvolutionMetricValue(
                          seriesPath.series.total,
                          evolutionMetric,
                          currency,
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-1">
                <div className="border border-white/10 bg-[#12120f]">
                  <div className="border-b border-white/10 px-3 py-2">
                    <h5 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#a39a8c]">
                      {localize('com_ui_project_meta_ads_best_evolution')}
                    </h5>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[34rem] text-left text-xs">
                      <thead className="border-b border-white/10 text-[10px] uppercase tracking-[0.12em] text-[#81796b]">
                        <tr>
                          <th className="px-3 py-2">
                            {localize('com_ui_project_meta_ads_campaign')}
                          </th>
                          <th className="px-3 py-2 text-right">
                            {localize('com_ui_project_meta_ads_spend_delta')}
                          </th>
                          <th className="px-3 py-2 text-right">
                            {localize('com_ui_project_meta_ads_results_delta')}
                          </th>
                          <th className="px-3 py-2 text-right">
                            {localize('com_ui_project_meta_ads_cpa_delta')}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/10">
                        {bestEvolution.length > 0 ? (
                          bestEvolution.map((delta) => {
                            const name = cleanDashboardName(delta.campaignName, delta.campaignId);
                            return (
                              <tr key={delta.campaignId} className="odd:bg-white/[0.025]">
                                <td
                                  className="max-w-64 truncate px-3 py-2.5 text-sm font-medium text-[#f3efe6]"
                                  title={name}
                                >
                                  {name}
                                </td>
                                <td
                                  className={`px-3 py-2.5 text-right font-mono ${renderEvolutionDeltaClass(
                                    delta.spendDelta,
                                  )}`}
                                >
                                  {formatSignedMoney(delta.spendDelta, currency)}
                                </td>
                                <td
                                  className={`px-3 py-2.5 text-right font-mono ${renderEvolutionDeltaClass(
                                    delta.resultDelta,
                                  )}`}
                                >
                                  {formatSignedMetric(delta.resultDelta)}
                                </td>
                                <td
                                  className={`px-3 py-2.5 text-right font-mono ${renderEvolutionDeltaClass(
                                    delta.cpaDelta,
                                    true,
                                  )}`}
                                >
                                  {formatSignedMoney(delta.cpaDelta, currency)}
                                </td>
                              </tr>
                            );
                          })
                        ) : (
                          <tr>
                            <td colSpan={4} className="px-3 py-5 text-sm text-[#a39a8c]">
                              {localize('com_ui_project_meta_ads_no_evolution')}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="border border-white/10 bg-[#12120f]">
                  <div className="border-b border-white/10 px-3 py-2">
                    <h5 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#a39a8c]">
                      {localize('com_ui_project_meta_ads_budget_changes')}
                    </h5>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[34rem] text-left text-xs">
                      <thead className="border-b border-white/10 text-[10px] uppercase tracking-[0.12em] text-[#81796b]">
                        <tr>
                          <th className="px-3 py-2">{localize('com_ui_project_meta_ads_name')}</th>
                          <th className="px-3 py-2 text-right">
                            {localize('com_ui_project_meta_ads_budget_delta')}
                          </th>
                          <th className="px-3 py-2 text-right">
                            {localize('com_ui_project_meta_ads_frequency_delta')}
                          </th>
                          <th className="px-3 py-2">{localize('com_ui_project_meta_ads_actor')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/10">
                        {evolutionAlerts.length > 0 ? (
                          evolutionAlerts.map((delta) => {
                            const name = cleanDashboardName(
                              delta.latestChange?.entityName ?? delta.campaignName,
                              delta.campaignId,
                            );
                            const budgetDelta =
                              delta.latestChange?.deltaDailyBudget ?? delta.budgetDelta;
                            return (
                              <tr key={delta.campaignId} className="odd:bg-white/[0.025]">
                                <td
                                  className="max-w-64 truncate px-3 py-2.5 text-sm font-medium text-[#f3efe6]"
                                  title={name}
                                >
                                  {name}
                                </td>
                                <td
                                  className={`px-3 py-2.5 text-right font-mono ${renderEvolutionDeltaClass(
                                    budgetDelta,
                                  )}`}
                                >
                                  {formatSignedMoney(budgetDelta, currency)}
                                </td>
                                <td
                                  className={`px-3 py-2.5 text-right font-mono ${renderEvolutionDeltaClass(
                                    delta.frequencyDelta,
                                    true,
                                  )}`}
                                >
                                  {formatSignedMetric(delta.frequencyDelta)}
                                </td>
                                <td className="px-3 py-2.5 text-[#a39a8c]">
                                  {delta.latestChange?.actor ?? '-'}
                                </td>
                              </tr>
                            );
                          })
                        ) : (
                          <tr>
                            <td colSpan={4} className="px-3 py-5 text-sm text-[#a39a8c]">
                              {localize('com_ui_project_meta_ads_no_history')}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="border border-border-light bg-surface-primary p-3">
        <h4 className="text-xs font-semibold uppercase text-text-tertiary">
          {localize('com_ui_project_meta_ads_history')}
        </h4>
        <div className="mt-3 space-y-2">
          {(statusQuery.data?.changes ?? []).length > 0 ? (
            (statusQuery.data?.changes ?? []).slice(0, 8).map((change) => {
              const delta = getBudgetChangeDelta(change);
              return (
                <div
                  key={change._id ?? `${change.entityId}-${change.createdAt}`}
                  className="flex flex-col gap-1 border border-border-light p-3 text-sm sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="truncate font-medium text-text-primary">
                      {change.entityName ?? change.entityId}
                    </div>
                    <div className="text-xs text-text-secondary">
                      {change.actor ?? '-'} · {change.reason ?? '-'}
                    </div>
                  </div>
                  <div className="text-left sm:text-right">
                    <div className="font-mono text-xs text-text-secondary">
                      {formatMoney(change.previousDailyBudget, currency)}
                      {' -> '}
                      {formatMoney(change.newDailyBudget, currency)}
                    </div>
                    {delta.deltaDailyBudget != null && (
                      <div className="mt-1 font-mono text-[11px] text-text-tertiary">
                        {`${formatSignedMoney(delta.deltaDailyBudget, currency)} · ${formatSignedPercent(delta.deltaPercent)}`}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="border border-dashed border-border-light py-6 text-center text-sm text-text-secondary">
              {localize('com_ui_project_meta_ads_no_history')}
            </div>
          )}
        </div>
      </div>

      <OGDialog
        open={Boolean(selectedBiRankItem)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedBiRankItem(null);
          }
        }}
      >
        {selectedBiRankItem && (
          <OGDialogContent className="max-w-2xl overflow-hidden p-0">
            <OGDialogHeader className="border-b border-white/10 bg-[#12120f] px-5 py-4 text-left">
              <div className="flex gap-4">
                {renderRankMedia(selectedBiRankItem, 'lg')}
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#a39a8c]">
                    {localize('com_ui_project_meta_ads_bi_rank_detail')}
                  </div>
                  <OGDialogTitle className="mt-1 text-base font-semibold text-[#f3efe6]">
                    {cleanDashboardName(selectedBiRankItem.name, selectedBiRankItem.id)}
                  </OGDialogTitle>
                  {selectedBiRankItem.parentName && (
                    <div className="truncate text-xs text-[#81796b]">
                      {cleanDashboardName(
                        selectedBiRankItem.parentName,
                        selectedBiRankItem.parentName,
                      )}
                    </div>
                  )}
                </div>
              </div>
            </OGDialogHeader>
            <div className="bg-[#0f0e0b] p-5">
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  [
                    'com_ui_project_meta_ads_cost_per_result' as TranslationKeys,
                    formatRankingCost(getRankEfficiency(selectedBiRankItem), currency),
                  ],
                  [
                    'com_ui_project_meta_ads_results' as TranslationKeys,
                    formatMetric(selectedBiRankItem.resultCount),
                  ],
                  [
                    'com_ui_project_meta_ads_spend' as TranslationKeys,
                    formatMoney(selectedBiRankItem.spend, currency),
                  ],
                ].map(([labelKey, value]) => (
                  <div key={labelKey} className="border border-white/10 bg-[#151512] p-3">
                    <div className="text-[10px] uppercase tracking-[0.12em] text-[#81796b]">
                      {localize(labelKey)}
                    </div>
                    <div className="mt-2 font-mono text-lg font-semibold text-[#f3efe6]">
                      {value}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 grid gap-2 text-sm text-[#d8d0c2] sm:grid-cols-2">
                {[
                  [
                    'com_ui_project_meta_ads_level' as TranslationKeys,
                    selectedBiRankItem.level === 'campaign'
                      ? localize('com_ui_project_meta_ads_level_campaign')
                      : selectedBiRankItem.level === 'adset'
                        ? localize('com_ui_project_meta_ads_level_ad_set')
                        : localize('com_ui_project_meta_ads_level_ad'),
                  ],
                  [
                    'com_ui_project_meta_ads_objective' as TranslationKeys,
                    getObjectiveLabel(selectedBiRankItem.objective, localize),
                  ],
                  [
                    'com_ui_project_meta_ads_target_result_type' as TranslationKeys,
                    getResultTypeLabel(selectedBiRankItem.resultType, localize),
                  ],
                  [
                    'com_ui_project_meta_ads_ctr' as TranslationKeys,
                    formatPercent(selectedBiRankItem.ctr),
                  ],
                ].map(([labelKey, value]) => (
                  <div
                    key={labelKey}
                    className="flex items-center justify-between gap-3 border-b border-white/10 py-2"
                  >
                    <span className="text-xs uppercase tracking-[0.12em] text-[#81796b]">
                      {localize(labelKey)}
                    </span>
                    <span className="text-right font-medium text-[#f3efe6]">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </OGDialogContent>
        )}
      </OGDialog>

      <OGDialog
        open={Boolean(selectedAdPreview)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedAdPreview(null);
          }
        }}
      >
        {selectedAdPreview && (
          <OGDialogContent className="max-w-4xl overflow-hidden p-0">
            <OGDialogHeader className="border-b border-border-light px-5 py-4 text-left">
              <div className="text-xs font-semibold uppercase text-text-tertiary">
                {localize('com_ui_project_meta_ads_ad_preview')}
              </div>
              <OGDialogTitle className="truncate text-base font-semibold text-text-primary">
                {selectedAdPreview.adName ?? selectedAdPreview.title ?? selectedAdPreview.adId}
              </OGDialogTitle>
            </OGDialogHeader>
            <div className="grid gap-0 md:grid-cols-[1.15fr_1fr]">
              <div className="bg-surface-secondary p-5">
                <div className="overflow-hidden border border-border-light bg-surface-primary">
                  {getAdPreviewUrl(selectedAdPreview) ? (
                    <img
                      src={getAdPreviewUrl(selectedAdPreview)}
                      alt={
                        selectedAdPreview.adName ??
                        selectedAdPreview.title ??
                        selectedAdPreview.adId
                      }
                      className="aspect-video w-full object-cover"
                    />
                  ) : (
                    <div className="flex aspect-video w-full items-center justify-center px-6 text-center text-sm text-text-secondary">
                      {localize('com_ui_project_meta_ads_no_creative_media')}
                    </div>
                  )}
                </div>
                <div className="mt-4 space-y-2 border border-border-light bg-surface-primary p-4">
                  <h4 className="text-lg font-semibold text-text-primary">
                    {selectedAdPreview.title ??
                      selectedAdPreview.adName ??
                      localize('com_ui_project_meta_ads_ad_preview')}
                  </h4>
                  {selectedAdPreview.body && (
                    <p className="text-sm leading-6 text-text-secondary">
                      {selectedAdPreview.body}
                    </p>
                  )}
                  {selectedAdPreview.description && (
                    <p className="text-xs leading-5 text-text-tertiary">
                      {selectedAdPreview.description}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2 text-xs text-text-secondary">
                    {selectedAdPreview.callToActionType && (
                      <span className="border border-border-light px-2 py-1 font-medium text-text-primary">
                        {selectedAdPreview.callToActionType}
                      </span>
                    )}
                    {selectedAdPreview.linkUrl && (
                      <span className="min-w-0 truncate border border-border-light px-2 py-1">
                        {selectedAdPreview.linkUrl}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="p-5">
                <h4 className="text-xs font-semibold uppercase text-text-tertiary">
                  {localize('com_ui_project_meta_ads_ad_metrics')}
                </h4>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {renderAdMetric(
                    'com_ui_project_meta_ads_spend',
                    formatMoney(selectedAdPreview.spend, selectedAdPreview.currency ?? currency),
                  )}
                  {renderAdMetric(
                    'com_ui_project_meta_ads_cost_result',
                    formatMoney(selectedAdPreview.cpa, selectedAdPreview.currency ?? currency),
                  )}
                  {renderAdMetric(
                    'com_ui_project_meta_ads_results',
                    formatMetric(selectedAdPreview.resultCount),
                  )}
                  {renderAdMetric(
                    'com_ui_project_meta_ads_impressions',
                    formatIntegerMetric(selectedAdPreview.impressions),
                  )}
                  {renderAdMetric(
                    'com_ui_project_meta_ads_clicks',
                    formatIntegerMetric(selectedAdPreview.clicks),
                  )}
                  {renderAdMetric(
                    'com_ui_project_meta_ads_frequency',
                    formatMetric(selectedAdPreview.frequency),
                  )}
                  {renderAdMetric(
                    'com_ui_project_meta_ads_ctr',
                    `${formatMetric(selectedAdPreview.ctr)}%`,
                  )}
                  {renderAdMetric(
                    'com_ui_project_meta_ads_video_p75',
                    formatMetric(selectedAdPreview.videoP75Watched),
                  )}
                </div>
              </div>
            </div>
          </OGDialogContent>
        )}
      </OGDialog>
    </>
  );

  return metricsFullscreen ? (
    createPortal(content, document.body)
  ) : (
    <div className="space-y-4">{content}</div>
  );
}
