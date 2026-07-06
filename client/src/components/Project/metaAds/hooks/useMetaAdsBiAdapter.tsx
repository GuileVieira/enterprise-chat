import type { ComponentProps } from 'react';
import type {
  ProjectMetaAdsCampaignSummary,
  ProjectMetaAdsRankingResponse,
  ProjectMetaAdsTrend,
} from 'librechat-data-provider';
import { metaAdsInput } from '../chrome';
import { buildMetaAdsBiState } from '../biState';
import { MetaAdsBiWorkspace } from '../biWorkspace';
import { buildMetaAdsEvolutionState } from '../evolutionState';
import {
  formatMetric,
  formatMoney,
  formatPercent,
  getObjectiveLabel,
  getResultTypeLabel,
} from '../formatters';
import { cleanDashboardName } from '../helpers';
import type {
  Localize,
  MetaAdsBiControls,
  MetaAdsBiRankItem,
  MetaAdsSettingsState,
} from '../types';
import type { useMetaAdsBiWorkspace } from './useMetaAdsBiWorkspace';
import type { useMetaAdsPeriodFilter } from './useMetaAdsPeriodFilter';

type MetaAdsBiWorkspaceProps = ComponentProps<typeof MetaAdsBiWorkspace>;

type UseMetaAdsBiAdapterParams = {
  campaigns: ProjectMetaAdsCampaignSummary[];
  biCampaigns: ProjectMetaAdsCampaignSummary[];
  settings: MetaAdsSettingsState;
  biWorkspace: ReturnType<typeof useMetaAdsBiWorkspace>;
  biPeriod: ReturnType<typeof useMetaAdsPeriodFilter>;
  rankingItems: ProjectMetaAdsRankingResponse['items'];
  adDiagnostics: Parameters<typeof buildMetaAdsBiState>[0]['adDiagnostics'];
  rankingFetching: boolean;
  trend: ProjectMetaAdsTrend | undefined;
  currency: string;
  localize: Localize;
};

function normalizeSearchValue(value: string | undefined) {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function filterBiRankingItems(
  items: MetaAdsBiWorkspaceProps['ranking']['items'],
  query: string,
  localize: Localize,
) {
  const normalizedQuery = normalizeSearchValue(query);
  if (!normalizedQuery) {
    return items;
  }

  return items.filter((item) => {
    const rankItem = item as MetaAdsBiRankItem;
    const searchableText = [
      item.name,
      item.id,
      item.parentName,
      rankItem.objective,
      rankItem.objective ? getObjectiveLabel(rankItem.objective, localize) : '',
      rankItem.resultType,
      rankItem.resultType ? getResultTypeLabel(rankItem.resultType, localize) : '',
    ]
      .map(normalizeSearchValue)
      .join(' ');

    return searchableText.includes(normalizedQuery);
  });
}

function getCampaignResultMetrics(campaign: ProjectMetaAdsCampaignSummary, resultType: string) {
  if (resultType === 'all') {
    return {
      spend: campaign.spend,
      resultCount: campaign.resultCount,
    };
  }
  const breakdown = campaign.resultTypeBreakdown?.find(
    (item) => (item.resultType || 'UNKNOWN') === resultType,
  );
  return {
    spend: breakdown?.totalSpend ?? campaign.spend,
    resultCount: breakdown?.totalResults ?? campaign.resultCount,
  };
}

function buildBiReportCards({
  campaigns,
  controls,
  currency,
}: {
  campaigns: ProjectMetaAdsCampaignSummary[];
  controls: MetaAdsBiControls;
  currency: string;
}): MetaAdsBiWorkspaceProps['reportCards'] {
  let totalSpend = 0;
  let totalResults = 0;
  let clicks = 0;
  let impressions = 0;
  let roasWeightedTotal = 0;
  let roasWeight = 0;
  for (const campaign of campaigns) {
    if (controls.objective !== 'all' && (campaign.objective || 'UNKNOWN') !== controls.objective) {
      continue;
    }
    const metrics = getCampaignResultMetrics(campaign, controls.resultType);
    const spend = Number(metrics.spend ?? 0);
    const resultCount = Number(metrics.resultCount ?? 0);
    const campaignClicks = Number(campaign.clicks ?? 0);
    const campaignImpressions = Number(campaign.impressions ?? 0);
    const roas = Number(campaign.roas);
    totalSpend += Number.isFinite(spend) ? spend : 0;
    totalResults += Number.isFinite(resultCount) ? resultCount : 0;
    clicks += Number.isFinite(campaignClicks) ? campaignClicks : 0;
    impressions += Number.isFinite(campaignImpressions) ? campaignImpressions : 0;
    if (Number.isFinite(roas) && roas > 0 && Number.isFinite(spend) && spend > 0) {
      roasWeightedTotal += roas * spend;
      roasWeight += spend;
    }
  }
  const averageCost = totalResults > 0 ? totalSpend / totalResults : null;
  const averageRoas = roasWeight > 0 ? roasWeightedTotal / roasWeight : null;
  const ctr = impressions > 0 ? (clicks / impressions) * 100 : null;
  return [
    { labelKey: 'com_ui_project_meta_ads_total_spend', value: formatMoney(totalSpend, currency) },
    { labelKey: 'com_ui_project_meta_ads_total_results', value: formatMetric(totalResults) },
    { labelKey: 'com_ui_project_meta_ads_average_cost', value: formatMoney(averageCost, currency) },
    { labelKey: 'com_ui_project_meta_ads_roas', value: formatMetric(averageRoas) },
    { labelKey: 'com_ui_project_meta_ads_ctr', value: formatPercent(ctr) },
    { labelKey: 'com_ui_project_meta_ads_clicks', value: formatMetric(clicks) },
  ];
}

export function useMetaAdsBiAdapter({
  campaigns,
  biCampaigns,
  settings,
  biWorkspace,
  biPeriod,
  rankingItems,
  adDiagnostics,
  rankingFetching,
  trend,
  currency,
  localize,
}: UseMetaAdsBiAdapterParams): {
  objectiveOptions: ReturnType<typeof buildMetaAdsBiState>['objectiveOptions'];
  workspace: MetaAdsBiWorkspaceProps;
} {
  const {
    biControls,
    biRankingSort,
    biSearchQuery,
    setBiControls,
    setBiSearchQuery,
    setSelectedBiRankItem,
    onBiRankingSort,
  } = biWorkspace;
  const {
    evolutionDates,
    evolutionSeriesPaths,
    maxEvolutionValue,
    totalBudgetChangeCount,
    bestEvolution,
    evolutionAlerts,
    hasEvolutionSection,
  } = buildMetaAdsEvolutionState({ trend, controls: biControls });
  const {
    objectiveOptions,
    biResultTypeOptions,
    selectedBiRankingItems,
    selectedBiRankingTitleKey,
    selectedBiRankingTestId,
    adRankingEmptyMessageKey,
  } = buildMetaAdsBiState({
    campaigns,
    biCampaigns,
    settings,
    controls: biControls,
    sort: biRankingSort,
    rankingItems,
    adDiagnostics,
    localize,
  });
  const filteredBiRankingItems = filterBiRankingItems(
    selectedBiRankingItems,
    biSearchQuery,
    localize,
  );
  const reportCards = buildBiReportCards({
    campaigns: biCampaigns,
    controls: biControls,
    currency,
  });

  return {
    objectiveOptions,
    workspace: {
      controls: biControls,
      period: {
        periodFilter: biPeriod.periodFilter,
        customSince: biPeriod.customSince,
        customUntil: biPeriod.customUntil,
        appliedCustomSince: biPeriod.appliedCustomSince,
        appliedCustomUntil: biPeriod.appliedCustomUntil,
        onPeriodFilterChange: biPeriod.setPeriodFilter,
        onCustomSinceChange: biPeriod.onCustomSinceChange,
        onCustomUntilChange: biPeriod.onCustomUntilChange,
        onApplyCustomPeriod: biPeriod.onApplyCustomPeriod,
      },
      search: {
        query: biSearchQuery,
        onChange: setBiSearchQuery,
      },
      options: {
        objectiveOptions,
        resultTypeOptions: biResultTypeOptions,
      },
      ranking: {
        titleKey: selectedBiRankingTitleKey,
        items: filteredBiRankingItems,
        testId: selectedBiRankingTestId,
        adRankingEmptyMessageKey,
        sort: biRankingSort,
        fetching: rankingFetching,
        onSort: onBiRankingSort,
        onSelect: setSelectedBiRankItem,
      },
      reportCards,
      evolution: {
        enabled: hasEvolutionSection,
        seriesPaths: evolutionSeriesPaths,
        dates: evolutionDates,
        maxValue: maxEvolutionValue,
        totalBudgetChangeCount,
        bestEvolution,
        evolutionAlerts,
        cleanName: cleanDashboardName,
      },
      inputClassName: metaAdsInput,
      currency,
      localize,
      onControlsChange: {
        level: (level) => setBiControls((current) => ({ ...current, level })),
        objective: (objective) => setBiControls((current) => ({ ...current, objective })),
        resultType: (resultType) => setBiControls((current) => ({ ...current, resultType })),
        metric: (metric) => setBiControls((current) => ({ ...current, metric })),
      },
    },
  };
}
