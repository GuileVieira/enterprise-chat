import type { TranslationKeys } from '~/hooks';
import type {
  DatePreset,
  PeriodFilter,
  TableView,
  WorkspaceTab,
  TableColumn,
  TableColumnKey,
  ScheduleIntervalMinutes,
} from './types';

export const scheduleOptions: Array<{
  value: ScheduleIntervalMinutes;
  labelKey: TranslationKeys;
}> = [
  { value: 30, labelKey: 'com_ui_project_meta_ads_schedule_30' },
  { value: 60, labelKey: 'com_ui_project_meta_ads_schedule_60' },
  { value: 120, labelKey: 'com_ui_project_meta_ads_schedule_120' },
  { value: 180, labelKey: 'com_ui_project_meta_ads_schedule_180' },
  { value: 360, labelKey: 'com_ui_project_meta_ads_schedule_360' },
  { value: 720, labelKey: 'com_ui_project_meta_ads_schedule_720' },
  { value: 1440, labelKey: 'com_ui_project_meta_ads_schedule_1440' },
];

export const periodOptions = [
  { value: 'today', labelKey: 'com_ui_project_meta_ads_period_today' },
  { value: 'yesterday', labelKey: 'com_ui_project_meta_ads_period_yesterday' },
  { value: 'last_7d', labelKey: 'com_ui_project_meta_ads_period_last_7d' },
  { value: 'last_14d', labelKey: 'com_ui_project_meta_ads_period_last_14d' },
  { value: 'last_30d', labelKey: 'com_ui_project_meta_ads_period_last_30d' },
] as const satisfies Array<{ value: DatePreset; labelKey: TranslationKeys }>;

export const periodFilterOptions: Array<{ value: PeriodFilter; labelKey: TranslationKeys }> = [
  ...periodOptions,
  { value: 'custom', labelKey: 'com_ui_project_meta_ads_period_custom' },
];

export const workspaceTabOptions: Array<{ value: WorkspaceTab; labelKey: TranslationKeys }> = [
  { value: 'overview', labelKey: 'com_ui_project_meta_ads_tab_overview' },
  { value: 'bi', labelKey: 'com_ui_project_meta_ads_tab_bi' },
];

export const tableViewOptions: Array<{ value: TableView; labelKey: TranslationKeys }> = [
  { value: 'summary', labelKey: 'com_ui_project_meta_ads_view_summary' },
  { value: 'performance', labelKey: 'com_ui_project_meta_ads_view_performance' },
  { value: 'creative', labelKey: 'com_ui_project_meta_ads_view_creative' },
  { value: 'rules', labelKey: 'com_ui_project_meta_ads_view_rules' },
];

export const tableColumnMap: Record<TableColumnKey, TableColumn> = {
  level: {
    key: 'level',
    labelKey: 'com_ui_project_meta_ads_delivery',
    widthClass: 'w-28',
  },
  adStatus: {
    key: 'adStatus',
    labelKey: 'com_ui_project_meta_ads_ad_status',
    widthClass: 'w-12',
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
  roas: {
    key: 'roas',
    labelKey: 'com_ui_project_meta_ads_roas',
    widthClass: 'w-24',
    align: 'right',
    sortableKey: 'roas',
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

export const tableViewColumns: Record<TableView, TableColumnKey[]> = {
  summary: [
    'level',
    'adStatus',
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
    'adStatus',
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
  creative: [
    'level',
    'adStatus',
    'name',
    'budget',
    'spend',
    'ctr',
    'cpa',
    'frequency',
    'result',
    'clicks',
    'actions',
  ],
  rules: ['level', 'adStatus', 'name', 'budget', 'rule', 'recommendation', 'actions'],
};

export const ecommerceTableViewColumns: Record<TableView, TableColumnKey[]> = {
  summary: [
    'level',
    'adStatus',
    'name',
    'budget',
    'objective',
    'budgetMode',
    'roas',
    'spend',
    'result',
    'cpa',
    'ctr',
    'clicks',
    'rule',
    'recommendation',
    'actions',
  ],
  performance: [
    'level',
    'adStatus',
    'name',
    'budget',
    'objective',
    'budgetMode',
    'roas',
    'spend',
    'result',
    'cpa',
    'ctr',
    'clicks',
    'actions',
  ],
  creative: [
    'level',
    'adStatus',
    'name',
    'budget',
    'roas',
    'spend',
    'ctr',
    'cpa',
    'result',
    'clicks',
    'actions',
  ],
  rules: tableViewColumns.rules,
};

export const tableViewMinWidth: Record<TableView, string> = {
  summary: 'min-w-[1948px]',
  performance: 'min-w-[1588px]',
  creative: 'min-w-[1208px]',
  rules: 'min-w-[1108px]',
};

export const BI_TOP_LIMIT = 5;
export const EVOLUTION_SERIES_LIMIT = 5;
export const evolutionColors = ['#38bdf8', '#14b8a6', '#8b5cf6', '#f59e0b', '#db2777'] as const;

export const objectiveLabelKeys: Record<string, TranslationKeys> = {
  OUTCOME_APP_PROMOTION: 'com_ui_project_meta_ads_objective_app_promotion',
  OUTCOME_AWARENESS: 'com_ui_project_meta_ads_objective_awareness',
  OUTCOME_ENGAGEMENT: 'com_ui_project_meta_ads_objective_engagement',
  OUTCOME_LEADS: 'com_ui_project_meta_ads_objective_leads',
  OUTCOME_SALES: 'com_ui_project_meta_ads_objective_sales',
  OUTCOME_TRAFFIC: 'com_ui_project_meta_ads_objective_traffic',
  UNKNOWN: 'com_ui_project_meta_ads_objective_unknown',
};

export const resultTypeLabelKeys: Record<string, TranslationKeys> = {
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
