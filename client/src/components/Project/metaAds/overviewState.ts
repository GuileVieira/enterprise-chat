import type { ProjectMetaAdsCampaignSummary, ProjectMetaAdsStatus } from 'librechat-data-provider';
import type { useLocalize } from '~/hooks';
import { getObjectiveLabel, getResultTypeLabel } from './formatters';
import {
  buildObjectiveSummaries,
  buildSummaryResultTypeOptions,
  calculateWeightedRoas,
  isEcommerceContext,
} from './summary';
import { compareNumberSort, getMetricValue } from './table';
import type { MetaAdsSettingsState } from './types';

type OverviewStateInput = {
  campaigns: ProjectMetaAdsCampaignSummary[];
  settings: MetaAdsSettingsState;
  summary: ProjectMetaAdsStatus['summary'] | undefined;
  campaignSearch: string;
  objectiveFilter: string;
  budgetModeFilter: string;
  campaignSort: string;
  selectedSummaryResultType: string | null;
  localize: ReturnType<typeof useLocalize>;
};

export function buildMetaAdsOverviewState({
  campaigns,
  settings,
  summary,
  campaignSearch,
  objectiveFilter,
  budgetModeFilter,
  campaignSort,
  selectedSummaryResultType,
  localize,
}: OverviewStateInput) {
  const objectiveSummaries =
    summary?.objectives && summary.objectives.length > 0
      ? summary.objectives
      : buildObjectiveSummaries(campaigns);
  const scopedObjectiveSummary = getScopedObjectiveSummary(objectiveSummaries, objectiveFilter);
  const hasMixedObjectiveSummary = objectiveFilter === 'all' && objectiveSummaries.length > 1;
  const isEcommerceDashboard = isEcommerceContext(settings, objectiveFilter, campaigns);
  const summaryResultTypeOptions = buildSummaryResultTypeOptions(
    objectiveSummaries,
    objectiveFilter,
    isEcommerceDashboard,
  );
  const selectedSummaryResultTypeOption = selectedSummaryResultType
    ? summaryResultTypeOptions.find((option) => option.resultType === selectedSummaryResultType)
    : undefined;
  const ecommercePurchaseResultTypeOption = isEcommerceDashboard
    ? summaryResultTypeOptions.find((option) => option.resultType === 'purchase')
    : undefined;
  const effectiveSummaryResultTypeOption =
    selectedSummaryResultTypeOption ?? ecommercePurchaseResultTypeOption;
  const summaryResultType =
    effectiveSummaryResultTypeOption?.resultType ??
    (scopedObjectiveSummary?.resultTypes.length === 1
      ? scopedObjectiveSummary.resultTypes[0].resultType
      : undefined);
  const summaryMetricContext = getSummaryMetricContext({
    summaryResultType,
    scopedObjectiveSummary,
    localize,
  });
  const summaryTotalSpend = scopedObjectiveSummary?.totalSpend ?? summary?.totalSpend;
  const summaryTotalResults =
    effectiveSummaryResultTypeOption?.totalResults ??
    (hasMixedObjectiveSummary
      ? null
      : (scopedObjectiveSummary?.totalResults ?? summary?.totalResults));
  const summaryAverageCost =
    effectiveSummaryResultTypeOption?.averageCostPerResult ??
    (hasMixedObjectiveSummary
      ? null
      : (scopedObjectiveSummary?.averageCostPerResult ?? summary?.averageCostPerResult));
  const summaryAverageFrequency =
    scopedObjectiveSummary?.averageFrequency ?? summary?.averageFrequency;
  const filteredCampaigns = filterAndSortCampaigns({
    campaigns,
    campaignSearch,
    objectiveFilter,
    budgetModeFilter,
    campaignSort,
    localize,
  });
  const summaryAverageRoas = isEcommerceDashboard ? calculateWeightedRoas(filteredCampaigns) : null;

  return {
    scopedObjectiveSummary,
    isEcommerceDashboard,
    summaryResultTypeOptions,
    summaryMetricContext,
    summaryTotalSpend,
    summaryTotalResults,
    summaryAverageCost,
    summaryAverageFrequency,
    summaryAverageRoas,
    filteredCampaigns,
  };
}

function getScopedObjectiveSummary(
  objectiveSummaries: NonNullable<ProjectMetaAdsStatus['summary']>['objectives'],
  objectiveFilter: string,
) {
  if (objectiveFilter !== 'all') {
    return objectiveSummaries?.find(
      (summary) => (summary.objective || 'UNKNOWN') === objectiveFilter,
    );
  }

  return objectiveSummaries?.length === 1 ? objectiveSummaries[0] : undefined;
}

function getSummaryMetricContext({
  summaryResultType,
  scopedObjectiveSummary,
  localize,
}: {
  summaryResultType: string | undefined;
  scopedObjectiveSummary: ReturnType<typeof getScopedObjectiveSummary>;
  localize: ReturnType<typeof useLocalize>;
}) {
  if (summaryResultType) {
    return getResultTypeLabel(summaryResultType, localize);
  }
  if (scopedObjectiveSummary) {
    return getObjectiveLabel(scopedObjectiveSummary.objective, localize);
  }
  return undefined;
}

function filterAndSortCampaigns({
  campaigns,
  campaignSearch,
  objectiveFilter,
  budgetModeFilter,
  campaignSort,
  localize,
}: Pick<
  OverviewStateInput,
  | 'campaigns'
  | 'campaignSearch'
  | 'objectiveFilter'
  | 'budgetModeFilter'
  | 'campaignSort'
  | 'localize'
>) {
  return campaigns
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
}
