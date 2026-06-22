import type {
  ProjectMetaAdsAdSummary,
  ProjectMetaAdsAdSetSummary,
  ProjectMetaAdsRankingItem,
  ProjectMetaAdsCampaignSummary,
} from 'librechat-data-provider';
import type {
  BiRankingSort,
  BiRankingSortKey,
  MetaAdsBiRankItem,
  MetaAdsBiRankings,
} from './types';
import { BI_TOP_LIMIT } from './constants';

export function getAdThumbnailUrl(ad: ProjectMetaAdsAdSummary) {
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

export function getRankEfficiency(item: MetaAdsBiRankItem) {
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

function getRankMetricForResultType(item: MetaAdsBiRankItem, resultTypeFilter: string) {
  if (resultTypeFilter === 'all') {
    return item;
  }
  const resultType = item.resultType || 'UNKNOWN';
  if (resultType === resultTypeFilter) {
    return item;
  }
  const breakdown = item.resultTypeBreakdown?.find(
    (resultTypeItem) => (resultTypeItem.resultType || 'UNKNOWN') === resultTypeFilter,
  );
  if (!breakdown) {
    return item;
  }
  return {
    ...item,
    resultType: breakdown.resultType,
    resultCount: breakdown.totalResults,
    spend: breakdown.totalSpend,
    cpa: breakdown.averageCostPerResult,
  };
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

function getBiRankingNumericValue(
  item: MetaAdsBiRankItem | ProjectMetaAdsRankingItem,
  key: BiRankingSortKey,
) {
  if (key === 'cpa') {
    return getRankEfficiency(item as MetaAdsBiRankItem);
  }
  const value = item[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function getSortedBiRankingItems<T extends MetaAdsBiRankItem | ProjectMetaAdsRankingItem>(
  items: T[],
  sort: BiRankingSort,
) {
  return [...items].sort((left, right) => {
    const leftValue = getBiRankingNumericValue(left, sort.key);
    const rightValue = getBiRankingNumericValue(right, sort.key);
    const missingValue =
      sort.direction === 'asc' ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;
    const normalizedLeft = leftValue ?? missingValue;
    const normalizedRight = rightValue ?? missingValue;
    const diff =
      sort.direction === 'asc'
        ? normalizedLeft - normalizedRight
        : normalizedRight - normalizedLeft;
    if (Math.abs(diff) > 0.005) {
      return diff;
    }
    return Number(right.resultCount ?? 0) - Number(left.resultCount ?? 0);
  });
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
    resultTypeBreakdown: adSet.resultTypeBreakdown,
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
    resultTypeBreakdown: ad.resultTypeBreakdown,
    thumbnailUrls: collectAdThumbnails([ad]),
  };
}

export function buildMetaAdsBiRankings(
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
      resultTypeBreakdown: campaign.resultTypeBreakdown,
      thumbnailUrls: collectAdThumbnails(
        (campaign.adSets ?? []).flatMap((adSet) => adSet.ads ?? []),
      ),
    };
    const filteredCampaignItem = getRankMetricForResultType(campaignItem, resultTypeFilter);
    if (matchesBiFilters(filteredCampaignItem, objectiveFilter, resultTypeFilter)) {
      campaignItems.push(filteredCampaignItem);
    }

    for (const adSet of campaign.adSets ?? []) {
      const adSetItem = toAdSetRankItem(campaign, adSet);
      const filteredAdSetItem = getRankMetricForResultType(adSetItem, resultTypeFilter);
      if (matchesBiFilters(filteredAdSetItem, objectiveFilter, resultTypeFilter)) {
        adSetItems.push(filteredAdSetItem);
      }

      for (const ad of adSet.ads ?? []) {
        const adItem = toAdRankItem(campaign, adSet, ad);
        const filteredAdItem = getRankMetricForResultType(adItem, resultTypeFilter);
        if (matchesBiFilters(filteredAdItem, objectiveFilter, resultTypeFilter)) {
          adItems.push(filteredAdItem);
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
