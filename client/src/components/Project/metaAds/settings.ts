import type { TProject } from 'librechat-data-provider';
import type {
  MetaAdsRules,
  MetaAdsRuleGroup,
  MetaAdsRuleOverride,
  MetaAdsCreativeRules,
  MetaAdsSettingsState,
} from './types';
import { defaultRules, defaultCreativeRules } from './rules';

export type MonthlyBudgetValues = {
  baseAmount?: number;
  additionalAmount?: number;
  allowedOverspendPct?: number;
};

export type MonthlyBudgetResolution = {
  month: string;
  values: Required<MonthlyBudgetValues>;
  inheritedFrom?: string;
};

export function toAdAccountId(value: string) {
  const digits = getAdAccountDigits(value);
  return digits ? `act_${digits}` : '';
}

export function isSupportedGraphVersion(value?: string) {
  const match = value?.trim().match(/^v(\d+)\.0$/);
  return match ? Number(match[1]) >= 24 : false;
}

export function getGraphVersionOptions(effectiveVersion?: string) {
  return Array.from(
    new Set([
      'v24.0',
      'v25.0',
      ...(isSupportedGraphVersion(effectiveVersion) ? [effectiveVersion] : []),
    ]),
  );
}

function toMonthlyBudgetValues(values?: MonthlyBudgetValues): Required<MonthlyBudgetValues> {
  return {
    baseAmount: values?.baseAmount ?? 0,
    additionalAmount: values?.additionalAmount ?? 0,
    allowedOverspendPct: values?.allowedOverspendPct ?? 0,
  };
}

export function resolveMonthlyBudgetForMonth(
  month: string,
  monthlyBudgets?: Record<string, MonthlyBudgetValues>,
  legacyMonthlyBudget?: MonthlyBudgetValues,
): MonthlyBudgetResolution {
  if (monthlyBudgets?.[month]) {
    return {
      month,
      values: toMonthlyBudgetValues(monthlyBudgets[month]),
    };
  }
  const inheritedFrom = Object.keys(monthlyBudgets ?? {})
    .filter((key) => /^\d{4}-\d{2}$/.test(key) && key <= month)
    .sort()
    .pop();
  if (inheritedFrom) {
    return {
      month,
      inheritedFrom,
      values: toMonthlyBudgetValues(monthlyBudgets?.[inheritedFrom]),
    };
  }
  return {
    month,
    values: toMonthlyBudgetValues(legacyMonthlyBudget),
  };
}

export function normalizeSettings(project: TProject): MetaAdsSettingsState {
  const currentMonth = toDateInputValue(new Date()).slice(0, 7);
  const monthlyBudgets = project.metaAds?.monthlyBudgets ?? {};
  const month = project.metaAds?.monthlyBudget?.month ?? currentMonth;
  const projectCreativeRules = project.metaAds?.creativeRules ?? {};
  const monthlyBudget = resolveMonthlyBudgetForMonth(
    month,
    monthlyBudgets,
    project.metaAds?.monthlyBudget,
  );
  return sanitizeMetaAdsEditableSettings({
    enabled: project.metaAds?.enabled ?? false,
    adAccountId: project.metaAds?.adAccountId ?? '',
    tokenSecretName: project.metaAds?.tokenSecretName ?? '',
    graphVersion: isSupportedGraphVersion(project.metaAds?.graphVersion)
      ? project.metaAds?.graphVersion
      : '',
    credentialMode: project.metaAds?.tokenSecretName ? 'project_secret' : 'tenant_default',
    accountProfile: project.metaAds?.accountProfile ?? 'custom',
    automationMode: project.metaAds?.automationMode ?? 'recommend',
    automationAnalysisPreset: project.metaAds?.automationAnalysisPreset ?? 'last_2d',
    clientGoal: project.metaAds?.clientGoal ?? {
      resultType: 'purchase',
      monthlyTarget: 0,
      monthlyConversionValueTarget: 0,
      targetRoas: 0,
    },
    budgetLevel: 'adset',
    scheduleIntervalMinutes: project.metaAds?.scheduleIntervalMinutes ?? 180,
    lastRunAt: project.metaAds?.lastRunAt,
    monthlyBudget: {
      month,
      ...monthlyBudget.values,
    },
    monthlyBudgets,
    ruleGroups: (project.metaAds?.ruleGroups ?? []).map(stripMetaAdsRuleCollectionCooldown),
    ruleOverrides: (project.metaAds?.ruleOverrides ?? []).map(stripMetaAdsRuleCollectionCooldown),
    rules: stripMetaAdsRuleCooldown({
      ...defaultRules,
      ...(project.metaAds?.rules ?? {}),
    }) as MetaAdsSettingsState['rules'],
    creativeRules: stripMetaAdsCreativeCooldown({
      ...defaultCreativeRules,
      ...projectCreativeRules,
      pauseHighCost: {
        ...defaultCreativeRules.pauseHighCost,
        ...(projectCreativeRules.pauseHighCost ?? {}),
      },
    }) as MetaAdsSettingsState['creativeRules'],
  });
}

export function sanitizeMetaAdsEditableSettings(
  settings: MetaAdsSettingsState,
): MetaAdsSettingsState {
  return {
    ...settings,
    rules: stripMetaAdsRuleCooldown(settings.rules) as MetaAdsSettingsState['rules'],
    creativeRules: stripMetaAdsCreativeCooldown(
      settings.creativeRules,
    ) as MetaAdsSettingsState['creativeRules'],
    ruleGroups: (settings.ruleGroups ?? []).map(stripMetaAdsRuleCollectionCooldown),
    ruleOverrides: (settings.ruleOverrides ?? []).map(stripMetaAdsRuleCollectionCooldown),
  };
}

export function stripMetaAdsRuleCooldown(rules?: MetaAdsRules) {
  if (!rules) {
    return rules;
  }
  const { cooldownHours: _cooldownHours, ...nextRules } = rules;
  return nextRules;
}

export function stripMetaAdsCreativeCooldown(creativeRules?: MetaAdsCreativeRules) {
  if (!creativeRules?.pauseHighCost) {
    return creativeRules;
  }
  const { cooldownHours: _cooldownHours, ...pauseHighCost } = creativeRules.pauseHighCost;
  return {
    ...creativeRules,
    pauseHighCost,
  };
}

function stripMetaAdsRuleCollectionCooldown<T extends MetaAdsRuleGroup | MetaAdsRuleOverride>(
  item: T,
) {
  return {
    ...item,
    rules: stripMetaAdsRuleCooldown(item.rules),
    creativeRules: stripMetaAdsCreativeCooldown(item.creativeRules),
  };
}

export function getAdAccountDigits(value?: string) {
  return (value ?? '').replace(/^act_/i, '').replace(/\D/g, '');
}

export function toDateInputValue(date: Date) {
  const localTimestamp = date.getTime() - date.getTimezoneOffset() * 60 * 1000;
  return new Date(localTimestamp).toISOString().slice(0, 10);
}

export function getDateInputDaysAgo(daysAgo: number) {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return toDateInputValue(date);
}
