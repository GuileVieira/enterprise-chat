import type {
  ProjectMetaAdsSnapshot,
  ProjectMetaAdsBudgetChange,
  ProjectMetaAdsCampaignSummary,
} from 'librechat-data-provider';
import type { TableView, CampaignFallbackAccumulator } from './types';
import { formatMoney } from './formatters';
import { tableViewColumns, ecommerceTableViewColumns } from './constants';
import { addFrequencySample, resolveAverageFrequency } from './summary';

export function getTableViewColumns(tableView: TableView, isEcommerce: boolean) {
  return isEcommerce ? ecommerceTableViewColumns[tableView] : tableViewColumns[tableView];
}

export function buildBudgetReferences(currentBudget: number | null | undefined, currency = 'BRL') {
  const current = Number(currentBudget);
  if (!Number.isFinite(current) || current <= 0) {
    return [];
  }
  return [-30, -20, -15, 15, 20, 30].map((percent) => {
    const value = Number((current * (1 + percent / 100)).toFixed(2));
    const signedPercent = `${percent > 0 ? '+' : ''}${percent}%`;
    const formattedValue = formatMoney(value, currency);
    return {
      percent,
      value,
      label: signedPercent,
      formattedValue,
      accessibleLabel: `${signedPercent} ${formattedValue.replace(/\u00a0/g, ' ')}`,
      tone:
        percent < 0
          ? 'border-rose-200 bg-rose-50 text-rose-900 hover:border-rose-300 hover:bg-rose-100 dark:border-rose-300/30 dark:bg-[#2b1a2a] dark:text-rose-100 dark:hover:border-rose-300/55 dark:hover:bg-[#352031]'
          : 'border-emerald-200 bg-emerald-50 text-emerald-900 hover:border-emerald-300 hover:bg-emerald-100 dark:border-emerald-300/30 dark:bg-[#132b2a] dark:text-emerald-100 dark:hover:border-emerald-300/55 dark:hover:bg-[#173633]',
    };
  });
}

export function getBudgetChangeDelta(change: ProjectMetaAdsBudgetChange) {
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

export function buildCampaignFallback(
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

  return Array.from(campaigns.values()).map((campaign) => toCampaignSummary(campaign));
}

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

function toCampaignSummary(campaign: CampaignFallbackAccumulator): ProjectMetaAdsCampaignSummary {
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
}
