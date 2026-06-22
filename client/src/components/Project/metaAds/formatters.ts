import type { ProjectMetaAdsTrendSeries } from 'librechat-data-provider';
import type { TranslationKeys } from '~/hooks';
import type { EvolutionMetric, Localize } from './types';
import { objectiveLabelKeys, resultTypeLabelKeys } from './constants';

export function formatMetric(value?: number | null) {
  return value == null || Number.isNaN(value) ? '-' : value.toFixed(2);
}

export function formatIntegerMetric(value?: number | null) {
  return value == null || Number.isNaN(value)
    ? '-'
    : new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value);
}

export function formatMoney(value: number | null | undefined, currency = 'BRL') {
  if (value == null || Number.isNaN(value)) {
    return '-';
  }
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency,
  }).format(value);
}

export function formatRankingCost(value: number | null | undefined, currency = 'BRL') {
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

export function formatSignedMoney(value: number | null | undefined, currency = 'BRL') {
  if (value == null || Number.isNaN(value)) {
    return '-';
  }
  let sign = '';
  if (value > 0) {
    sign = '+';
  } else if (value < 0) {
    sign = '-';
  }
  return `${sign}${formatMoney(Math.abs(value), currency)}`;
}

export function formatSignedPercent(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) {
    return '-';
  }
  let sign = '';
  if (value > 0) {
    sign = '+';
  } else if (value < 0) {
    sign = '-';
  }
  return `${sign}${Math.abs(value).toFixed(2)}%`;
}

export function formatPercent(value: number | null | undefined) {
  return value == null || Number.isNaN(value) ? '-' : `${value.toFixed(2)}%`;
}

export function formatSignedMetric(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) {
    return '-';
  }
  let sign = '';
  if (value > 0) {
    sign = '+';
  } else if (value < 0) {
    sign = '-';
  }
  return `${sign}${Math.abs(value).toFixed(2)}`;
}

export function formatTrendDate(value: string) {
  const [, yearOnly, monthOnly] = value.match(/^(\d{4})-(\d{2})$/) ?? [];
  if (yearOnly && monthOnly) {
    return `${monthOnly}/${yearOnly}`;
  }
  const [, , month, day] = value.match(/^(\d{4})-(\d{2})-(\d{2})$/) ?? [];
  return month && day ? `${day}/${month}` : value;
}

export function shouldShowTrendLabel(index: number, total: number) {
  if (total <= 4) {
    return true;
  }
  if (index === 0 || index === total - 1) {
    return true;
  }
  const interval = Math.ceil((total - 2) / 2);
  return (index - 1) % interval === 0;
}

export function buildChartPath(points: Array<{ x: number; y: number }>) {
  return points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(' ');
}

export function getEvolutionMetricValue(
  point: ProjectMetaAdsTrendSeries['points'][number],
  metric: EvolutionMetric,
) {
  const value = point[metric];
  return value == null || Number.isNaN(Number(value)) ? null : Number(value);
}

export function formatEvolutionMetricValue(
  value: number | null | undefined,
  metric: EvolutionMetric,
  currency: string,
) {
  if (metric === 'spend' || metric === 'cpa') {
    return formatMoney(value, currency);
  }
  if (metric === 'ctr') {
    return formatPercent(value);
  }
  return formatMetric(value);
}

export function getEvolutionMetricLabel(metric: EvolutionMetric, localize: Localize) {
  const labelKeys: Record<EvolutionMetric, TranslationKeys> = {
    spend: 'com_ui_project_meta_ads_spend',
    resultCount: 'com_ui_project_meta_ads_results',
    cpa: 'com_ui_project_meta_ads_cpa',
    ctr: 'com_ui_project_meta_ads_ctr',
    frequency: 'com_ui_project_meta_ads_frequency',
    clicks: 'com_ui_project_meta_ads_clicks',
  };
  return localize(labelKeys[metric]);
}

export function toMetaAdsLabelKey(value?: string | null) {
  return (value || 'UNKNOWN').replace(/\./g, '_');
}

export function formatMetaAdsCode(value?: string | null) {
  const normalized = (value || 'UNKNOWN').replace(/^OUTCOME_/, '').replace(/[_.]+/g, ' ');
  return normalized
    .toLowerCase()
    .replace(/(^|\s)\S/g, (letter) => letter.toLocaleUpperCase('pt-BR'));
}

export function getObjectiveLabel(objective: string | undefined, localize: Localize) {
  const key = objectiveLabelKeys[objective || 'UNKNOWN'];
  return key ? localize(key) : formatMetaAdsCode(objective);
}

export function getResultTypeLabel(resultType: string | undefined, localize: Localize) {
  const key = resultTypeLabelKeys[toMetaAdsLabelKey(resultType)];
  return key ? localize(key) : formatMetaAdsCode(resultType);
}

export function formatCountLabel(
  count: number,
  singularKey: TranslationKeys,
  pluralKey: TranslationKeys,
  localize: Localize,
) {
  return localize(count === 1 ? singularKey : pluralKey, { 0: String(count) });
}
