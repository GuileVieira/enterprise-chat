import type { ProjectMetaAdsRecommendation } from 'librechat-data-provider';
import { formatMoney } from './formatters';

export function getRecommendationLabel(
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

export function canApplyRecommendation(recommendation: ProjectMetaAdsRecommendation | undefined) {
  return Boolean(recommendation && recommendation.action !== 'hold');
}
