import type { ProjectMetaAdsCampaignSummary, ProjectMetaAdsStatus } from 'librechat-data-provider';
import type { useLocalize } from '~/hooks';
import type { TranslationKeys } from '~/hooks';
import { formatMetric, formatMoney, getObjectiveLabel, getResultTypeLabel } from './formatters';
import {
  buildObjectiveSummaries,
  buildSummaryResultTypeOptions,
  calculateWeightedRoas,
  addFrequencySample,
  isEcommerceContext,
  resolveAverageFrequency,
} from './summary';
import { compareNumberSort, getMetricValue } from './table';
import type { MetaAdsSettingsState } from './types';
import type { MetaAdsSummaryCardItem } from './summaryCards';

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
  const filteredCampaigns = filterAndSortCampaigns({
    campaigns,
    campaignSearch,
    objectiveFilter,
    budgetModeFilter,
    campaignSort,
    localize,
  });
  const hasCampaignData = campaigns.length > 0;
  const objectiveSummaries = hasCampaignData
    ? buildObjectiveSummaries(filteredCampaigns)
    : summary?.objectives && summary.objectives.length > 0
      ? summary.objectives
      : buildObjectiveSummaries(campaigns);
  const visibleSummary = hasCampaignData ? buildVisibleCampaignSummary(filteredCampaigns) : null;
  const scopedObjectiveSummary = getScopedObjectiveSummary(objectiveSummaries, objectiveFilter);
  const hasMixedObjectiveSummary = objectiveFilter === 'all' && objectiveSummaries.length > 1;
  const isEcommerceDashboard = isEcommerceContext(settings, objectiveFilter, filteredCampaigns);
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
  const summaryTotalSpend =
    visibleSummary?.totalSpend ?? scopedObjectiveSummary?.totalSpend ?? summary?.totalSpend;
  const summaryTotalResults =
    effectiveSummaryResultTypeOption?.totalResults ??
    visibleSummary?.totalResults ??
    (hasMixedObjectiveSummary
      ? null
      : (scopedObjectiveSummary?.totalResults ?? summary?.totalResults));
  const summaryAverageCost =
    effectiveSummaryResultTypeOption?.averageCostPerResult ??
    visibleSummary?.averageCostPerResult ??
    (hasMixedObjectiveSummary
      ? null
      : (scopedObjectiveSummary?.averageCostPerResult ?? summary?.averageCostPerResult));
  const summaryAverageFrequency =
    visibleSummary?.averageFrequency ??
    scopedObjectiveSummary?.averageFrequency ??
    summary?.averageFrequency;
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

function buildVisibleCampaignSummary(campaigns: ProjectMetaAdsCampaignSummary[]) {
  const frequency = {
    frequencyWeightedTotal: 0,
    frequencyWeight: 0,
    frequencyTotal: 0,
    frequencyCount: 0,
  };
  let totalSpend = 0;
  let totalResults = 0;
  for (const campaign of campaigns) {
    const spend = Number(campaign.spend ?? 0);
    const resultCount = Number(campaign.resultCount ?? 0);
    totalSpend += Number.isFinite(spend) ? spend : 0;
    totalResults += Number.isFinite(resultCount) ? resultCount : 0;
    addFrequencySample(frequency, campaign.frequency, campaign.impressions);
  }
  const averageCostPerResult =
    totalResults > 0 ? Number((totalSpend / totalResults).toFixed(2)) : null;
  return {
    totalSpend: Number(totalSpend.toFixed(2)),
    totalResults: Number(totalResults.toFixed(2)),
    averageCostPerResult,
    averageFrequency: resolveAverageFrequency(frequency),
  };
}

export function getMetaAdsTokenStatusKey(
  credentials: ProjectMetaAdsStatus['credentials'] | undefined,
): TranslationKeys {
  if (credentials?.effectiveSource === 'project') {
    return 'com_ui_project_meta_ads_project_token_configured';
  }
  if (credentials?.effectiveSource === 'tenant') {
    return 'com_ui_project_meta_ads_tenant_token_configured';
  }
  return 'com_ui_project_meta_ads_token_missing';
}

export function getNextMetaAdsSortDirection({
  campaignSort,
  key,
  defaultDirection,
}: {
  campaignSort: string;
  key: string;
  defaultDirection: 'asc' | 'desc';
}) {
  const [activeKey, activeDirection = defaultDirection] = campaignSort.split('_') as [
    string,
    'asc' | 'desc',
  ];
  if (activeKey !== key || activeDirection !== defaultDirection) {
    return defaultDirection;
  }
  return defaultDirection === 'asc' ? 'desc' : 'asc';
}

export function buildMetaAdsSummaryCardItems({
  isEcommerceDashboard,
  summaryAverageRoas,
  summaryTotalSpend,
  summaryTotalResults,
  summaryAverageCost,
  summaryAverageFrequency,
  monthlyBudget,
  summaryMetricContext,
  goalContext,
  summaryResultTypeOptionsLength,
  scopedObjectiveSummary,
  currency,
  localize,
}: {
  isEcommerceDashboard: boolean;
  summaryAverageRoas: number | null;
  summaryTotalSpend: number | null | undefined;
  summaryTotalResults: number | null | undefined;
  summaryAverageCost: number | null | undefined;
  summaryAverageFrequency: number | null | undefined;
  monthlyBudget: ProjectMetaAdsStatus['monthlyBudget'] | undefined;
  summaryMetricContext: string | undefined;
  goalContext?: string;
  summaryResultTypeOptionsLength: number;
  scopedObjectiveSummary: ReturnType<typeof getScopedObjectiveSummary>;
  currency: string;
  localize: ReturnType<typeof useLocalize>;
}): MetaAdsSummaryCardItem[] {
  const monthlyBudgetContext = getMonthlyBudgetContext({ monthlyBudget, currency, localize });
  if (isEcommerceDashboard) {
    return [
      {
        labelKey: 'com_ui_project_meta_ads_average_roas',
        value: formatMetric(summaryAverageRoas),
        tone: 'border-l-emerald-300/35',
      },
      {
        labelKey: 'com_ui_project_meta_ads_total_spend',
        value: formatMoney(summaryTotalSpend, currency),
        tone: 'border-l-amber-300/35',
        context: monthlyBudgetContext,
      },
      {
        labelKey: 'com_ui_project_meta_ads_total_results',
        value: formatMetric(summaryTotalResults),
        tone: 'border-l-sky-300/30',
        context: goalContext ?? summaryMetricContext,
        clickable: summaryResultTypeOptionsLength > 0,
      },
      {
        labelKey: 'com_ui_project_meta_ads_average_cost',
        value: formatMoney(summaryAverageCost, currency),
        tone: 'border-l-rose-300/30',
        context: summaryMetricContext,
      },
    ];
  }

  return [
    {
      labelKey: 'com_ui_project_meta_ads_total_spend',
      value: formatMoney(summaryTotalSpend, currency),
      tone: 'border-l-amber-300/35',
      context: monthlyBudgetContext,
    },
    {
      labelKey: 'com_ui_project_meta_ads_total_results',
      value: formatMetric(summaryTotalResults),
      tone: 'border-l-emerald-300/35',
      context: goalContext ?? summaryMetricContext,
      clickable: summaryResultTypeOptionsLength > 0,
    },
    {
      labelKey: 'com_ui_project_meta_ads_average_cost',
      value: formatMoney(summaryAverageCost, currency),
      tone: 'border-l-sky-300/30',
      context: summaryMetricContext,
    },
    {
      labelKey: 'com_ui_project_meta_ads_average_frequency',
      value: formatMetric(summaryAverageFrequency),
      tone: 'border-l-rose-300/30',
      context: scopedObjectiveSummary
        ? getObjectiveLabel(scopedObjectiveSummary.objective, localize)
        : undefined,
    },
  ];
}

function getMonthlyBudgetContext({
  monthlyBudget,
  currency,
  localize,
}: {
  monthlyBudget: ProjectMetaAdsStatus['monthlyBudget'] | undefined;
  currency: string;
  localize: ReturnType<typeof useLocalize>;
}) {
  if (!monthlyBudget) {
    return undefined;
  }
  if (monthlyBudget.exceededBy > 0) {
    return localize('com_ui_project_meta_ads_monthly_budget_exceeded', {
      0: formatMoney(monthlyBudget.exceededBy, currency),
      1: formatMoney(monthlyBudget.limit, currency),
      2: String(monthlyBudget.spentPct),
    });
  }
  return localize('com_ui_project_meta_ads_monthly_budget_remaining', {
    0: formatMoney(monthlyBudget.remaining, currency),
    1: formatMoney(monthlyBudget.limit, currency),
    2: String(monthlyBudget.spentPct),
  });
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
