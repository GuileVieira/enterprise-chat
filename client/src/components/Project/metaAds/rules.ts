import type { TranslationKeys } from '~/hooks';
import type {
  RuleRowType,
  RuleGroupDraft,
  MetaAdsRulesState,
  MetaAdsRuleOverride,
  MetaAdsCreativeRules,
} from './types';

export const defaultRules: MetaAdsRulesState = {
  targetCpa: 45,
  targetResultType: '',
  primaryMetric: 'cpa',
  minRoas: 2,
  maxIncreasePct: 25,
  maxDecreasePct: 25,
  minDailyBudget: 20,
  maxDailyBudget: 2000,
  cooldownHours: 24,
  minSpend: 10,
  enabledSections: {
    performance: true,
    creatives: true,
    noResultSpendCap: false,
  },
  noResultSpendCap: {
    enabled: false,
    minSpend: 10,
  },
};

export const defaultCreativeRules: Required<MetaAdsCreativeRules> = {
  maxFrequency: 5,
  pauseHighCost: {
    enabled: false,
    maxCostPerResult: 45,
    lookbackDays: 3,
    minCreativesInScope: 3,
    minSpend: 10,
    cooldownHours: 24,
    targetResultType: '',
  },
};

export const accountProfileOptions = [
  { value: 'local_business', labelKey: 'com_ui_project_meta_ads_profile_local_business' },
  { value: 'ecommerce', labelKey: 'com_ui_project_meta_ads_profile_ecommerce' },
  { value: 'lead_gen', labelKey: 'com_ui_project_meta_ads_profile_lead_gen' },
  { value: 'traffic', labelKey: 'com_ui_project_meta_ads_profile_traffic' },
  { value: 'custom', labelKey: 'com_ui_project_meta_ads_profile_custom' },
] as const;

export const resultTypeOptions = [
  {
    value: 'onsite_conversion.messaging_conversation_started_7d',
    labelKey: 'com_ui_project_meta_ads_result_type_message',
  },
  { value: 'lead', labelKey: 'com_ui_project_meta_ads_result_type_lead' },
  { value: 'purchase', labelKey: 'com_ui_project_meta_ads_result_type_purchase' },
  { value: 'link_click', labelKey: 'com_ui_project_meta_ads_result_type_link_click' },
  {
    value: 'instagram_profile_visit',
    labelKey: 'com_ui_project_meta_ads_result_type_instagram_profile_visit',
  },
  { value: 'thruplay', labelKey: 'com_ui_project_meta_ads_result_type_thruplay' },
  {
    value: 'landing_page_view',
    labelKey: 'com_ui_project_meta_ads_result_type_landing_page_view',
  },
  { value: 'post_engagement', labelKey: 'com_ui_project_meta_ads_result_type_post_engagement' },
] as const;

export const primaryMetricOptions = [
  { value: 'cpa', labelKey: 'com_ui_project_meta_ads_primary_metric_cpa' },
  { value: 'roas', labelKey: 'com_ui_project_meta_ads_primary_metric_roas' },
  { value: 'cpc', labelKey: 'com_ui_project_meta_ads_primary_metric_cpc' },
  { value: 'ctr', labelKey: 'com_ui_project_meta_ads_primary_metric_ctr' },
] as const;

export const accountProfileRules: Record<
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

export const numberFields: Array<{
  key: keyof MetaAdsRulesState;
  labelKey: TranslationKeys;
  hintKey: TranslationKeys;
  step: string;
}> = [
  {
    key: 'targetCpa',
    labelKey: 'com_ui_project_meta_ads_target_cpa',
    hintKey: 'com_ui_project_meta_ads_target_cpa_hint',
    step: '0.01',
  },
  {
    key: 'minRoas',
    labelKey: 'com_ui_project_meta_ads_min_roas',
    hintKey: 'com_ui_project_meta_ads_min_roas_hint',
    step: '0.01',
  },
  {
    key: 'maxIncreasePct',
    labelKey: 'com_ui_project_meta_ads_max_increase',
    hintKey: 'com_ui_project_meta_ads_max_increase_hint',
    step: '1',
  },
  {
    key: 'maxDecreasePct',
    labelKey: 'com_ui_project_meta_ads_max_decrease',
    hintKey: 'com_ui_project_meta_ads_max_decrease_hint',
    step: '1',
  },
  {
    key: 'minDailyBudget',
    labelKey: 'com_ui_project_meta_ads_min_budget',
    hintKey: 'com_ui_project_meta_ads_min_budget_hint',
    step: '0.01',
  },
  {
    key: 'maxDailyBudget',
    labelKey: 'com_ui_project_meta_ads_max_budget',
    hintKey: 'com_ui_project_meta_ads_max_budget_hint',
    step: '0.01',
  },
  {
    key: 'cooldownHours',
    labelKey: 'com_ui_project_meta_ads_cooldown',
    hintKey: 'com_ui_project_meta_ads_cooldown_hint',
    step: '1',
  },
  {
    key: 'minSpend',
    labelKey: 'com_ui_project_meta_ads_min_spend',
    hintKey: 'com_ui_project_meta_ads_min_spend_hint',
    step: '0.01',
  },
];

export const optionalNumberFields: Array<{
  key: keyof MetaAdsRulesState;
  labelKey: TranslationKeys;
  hintKey: TranslationKeys;
  step: string;
}> = [
  {
    key: 'minCtr',
    labelKey: 'com_ui_project_meta_ads_min_ctr',
    hintKey: 'com_ui_project_meta_ads_min_ctr_hint',
    step: '0.01',
  },
  {
    key: 'maxCpc',
    labelKey: 'com_ui_project_meta_ads_max_cpc',
    hintKey: 'com_ui_project_meta_ads_max_cpc_hint',
    step: '0.01',
  },
  {
    key: 'maxCpm',
    labelKey: 'com_ui_project_meta_ads_max_cpm',
    hintKey: 'com_ui_project_meta_ads_max_cpm_hint',
    step: '0.01',
  },
];

export const performanceMetricRuleKeys: Array<keyof MetaAdsRulesState> = [
  'targetCpa',
  'minRoas',
  'minCtr',
  'maxCpc',
  'maxCpm',
];

export function getRuleOverrideKey(ruleOverride: MetaAdsRuleOverride) {
  return `${ruleOverride.entityLevel}:${ruleOverride.entityId}`;
}

export function getRuleRowTypeLabelKey(type: RuleRowType): TranslationKeys {
  if (type === 'global') {
    return 'com_ui_project_meta_ads_rule_type_global';
  }
  if (type === 'group') {
    return 'com_ui_project_meta_ads_rule_type_group';
  }
  return 'com_ui_project_meta_ads_rule_type_override';
}

export function getRuleDraftTitleKey(ruleGroupDraft: RuleGroupDraft): TranslationKeys {
  if (ruleGroupDraft.scope === 'global') {
    return 'com_ui_project_meta_ads_global_rules';
  }
  if (ruleGroupDraft.scope === 'override') {
    return 'com_ui_project_meta_ads_edit_rule_override';
  }
  return ruleGroupDraft.id
    ? 'com_ui_project_meta_ads_edit_rule_group'
    : 'com_ui_project_meta_ads_create_rule_group';
}

export function hasRulePerformanceMetric(rules: MetaAdsRulesState) {
  return performanceMetricRuleKeys.some((key) => {
    const value = rules[key];
    return typeof value === 'number' && Number.isFinite(value) && value > 0;
  });
}
