import type { TProject } from 'librechat-data-provider';
import type { MetaAdsSettingsState } from './types';
import { defaultRules, defaultCreativeRules } from './rules';

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

export function normalizeSettings(project: TProject): MetaAdsSettingsState {
  const currentMonth = toDateInputValue(new Date()).slice(0, 7);
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
    monthlyBudget: {
      month: project.metaAds?.monthlyBudget?.month ?? currentMonth,
      baseAmount: project.metaAds?.monthlyBudget?.baseAmount ?? 0,
      additionalAmount: project.metaAds?.monthlyBudget?.additionalAmount ?? 0,
      allowedOverspendPct: project.metaAds?.monthlyBudget?.allowedOverspendPct ?? 0,
    },
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
