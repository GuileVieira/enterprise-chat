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
import { getObjectiveLabel, getResultTypeLabel } from '../formatters';
import { cleanDashboardName } from '../helpers';
import type { Localize, MetaAdsBiRankItem, MetaAdsSettingsState } from '../types';
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
