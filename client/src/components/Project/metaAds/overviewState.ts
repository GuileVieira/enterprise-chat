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
  resultTypeFilter: string;
  campaignStatusFilter: string;
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
  resultTypeFilter,
  campaignStatusFilter,
  budgetModeFilter,
  campaignSort,
  selectedSummaryResultType,
  localize,
}: OverviewStateInput) {
  const filteredCampaigns = filterAndSortCampaigns({
    campaigns,
    campaignSearch,
    objectiveFilter,
    resultTypeFilter,
    campaignStatusFilter,
    budgetModeFilter,
    campaignSort,
    localize,
  });
  const summaryCampaigns = filterAndSortCampaigns({
    campaigns,
    campaignSearch,
    objectiveFilter,
    resultTypeFilter: 'all',
    campaignStatusFilter,
    budgetModeFilter,
    campaignSort,
    localize,
  });
  const hasCampaignData = campaigns.length > 0;
  const objectiveSummaries = hasCampaignData
    ? buildObjectiveSummaries(summaryCampaigns)
    : summary?.objectives && summary.objectives.length > 0
      ? summary.objectives
      : buildObjectiveSummaries(campaigns);
  const visibleSummary = hasCampaignData ? buildVisibleCampaignSummary(summaryCampaigns) : null;
  const scopedObjectiveSummary = getScopedObjectiveSummary(objectiveSummaries, objectiveFilter);
  const hasMixedObjectiveSummary = objectiveFilter === 'all' && objectiveSummaries.length > 1;
  const isEcommerceDashboard = isEcommerceContext(settings, objectiveFilter, summaryCampaigns);
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
  const summaryConversionValue = isEcommerceDashboard
    ? calculateConversionValue(summaryCampaigns)
    : null;
  const summaryAverageRoas =
    isEcommerceDashboard && summaryConversionValue != null && Number(summaryTotalSpend ?? 0) > 0
      ? Number((summaryConversionValue / Number(summaryTotalSpend)).toFixed(2))
      : isEcommerceDashboard
        ? calculateWeightedRoas(summaryCampaigns)
        : null;
  const summaryAverageTicket =
    isEcommerceDashboard && summaryConversionValue != null && Number(summaryTotalResults ?? 0) > 0
      ? Number((summaryConversionValue / Number(summaryTotalResults)).toFixed(2))
      : null;

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
    summaryConversionValue,
    summaryAverageTicket,
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

function calculateConversionValue(campaigns: ProjectMetaAdsCampaignSummary[]) {
  let total = 0;
  let hasValue = false;
  for (const campaign of campaigns) {
    const value = Number(campaign.conversionValue);
    if (!Number.isFinite(value)) {
      continue;
    }
    total += value;
    hasValue = true;
  }
  return hasValue ? Number(total.toFixed(2)) : null;
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

export function collectMetaAdsOverviewResultTypes(campaigns: ProjectMetaAdsCampaignSummary[]) {
  const resultTypes = new Set<string>();
  for (const campaign of campaigns) {
    addEntityResultTypes(resultTypes, campaign);
    for (const adset of campaign.adSets) {
      addEntityResultTypes(resultTypes, adset);
      for (const ad of adset.ads ?? []) {
        addEntityResultTypes(resultTypes, ad);
      }
    }
  }
  return Array.from(resultTypes);
}

export function buildMetaAdsSummaryCardItems({
  isEcommerceDashboard,
  summaryAverageRoas,
  summaryConversionValue,
  summaryAverageTicket,
  summaryTotalSpend,
  summaryTotalResults,
  summaryAverageCost,
  summaryAverageFrequency,
  monthlyBudget,
  investmentGoalContext,
  summaryMetricContext,
  goalContext,
  conversionValueGoalContext,
  roasGoalContext,
  summaryResultTypeOptionsLength,
  scopedObjectiveSummary,
  currency,
  localize,
}: {
  isEcommerceDashboard: boolean;
  summaryAverageRoas: number | null;
  summaryConversionValue: number | null;
  summaryAverageTicket: number | null;
  summaryTotalSpend: number | null | undefined;
  summaryTotalResults: number | null | undefined;
  summaryAverageCost: number | null | undefined;
  summaryAverageFrequency: number | null | undefined;
  monthlyBudget: ProjectMetaAdsStatus['monthlyBudget'] | undefined;
  investmentGoalContext?: string | string[];
  summaryMetricContext: string | undefined;
  goalContext?: string;
  conversionValueGoalContext?: string | string[];
  roasGoalContext?: string | string[];
  summaryResultTypeOptionsLength: number;
  scopedObjectiveSummary: ReturnType<typeof getScopedObjectiveSummary>;
  currency: string;
  localize: ReturnType<typeof useLocalize>;
}): MetaAdsSummaryCardItem[] {
  const monthlyBudgetContext = getMonthlyBudgetContext({ monthlyBudget, currency, localize });
  const spendContext = investmentGoalContext ?? monthlyBudgetContext;
  if (isEcommerceDashboard) {
    return [
      {
        labelKey: 'com_ui_project_meta_ads_total_results',
        value: formatMetric(summaryTotalResults),
        tone: 'border-l-emerald-300/35',
        context: goalContext ?? summaryMetricContext,
        clickable: summaryResultTypeOptionsLength > 0,
      },
      {
        labelKey: 'com_ui_project_meta_ads_conversion_value',
        value: formatMoney(summaryConversionValue, currency),
        tone: 'border-l-amber-300/35',
        context: conversionValueGoalContext,
      },
      {
        labelKey: 'com_ui_project_meta_ads_average_cost',
        value: formatMoney(summaryAverageCost, currency),
        tone: 'border-l-sky-300/30',
        context: summaryMetricContext,
      },
      {
        labelKey: 'com_ui_project_meta_ads_total_spend',
        value: formatMoney(summaryTotalSpend, currency),
        tone: 'border-l-rose-300/30',
        context: spendContext,
      },
      {
        labelKey: 'com_ui_project_meta_ads_roas',
        value: formatMetric(summaryAverageRoas),
        tone: 'border-l-violet-300/30',
        context: roasGoalContext,
      },
      {
        labelKey: 'com_ui_project_meta_ads_average_ticket',
        value: formatMoney(summaryAverageTicket, currency),
        tone: 'border-l-cyan-300/30',
      },
    ];
  }

  return [
    {
      labelKey: 'com_ui_project_meta_ads_total_spend',
      value: formatMoney(summaryTotalSpend, currency),
      tone: 'border-l-amber-300/35',
      context: spendContext,
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
  resultTypeFilter,
  campaignStatusFilter,
  budgetModeFilter,
  campaignSort,
  localize,
}: Pick<
  OverviewStateInput,
  | 'campaigns'
  | 'campaignSearch'
  | 'objectiveFilter'
  | 'resultTypeFilter'
  | 'campaignStatusFilter'
  | 'budgetModeFilter'
  | 'campaignSort'
  | 'localize'
>) {
  return campaigns
    .flatMap((campaign) => {
      const filteredCampaign = filterCampaignByResultType(campaign, resultTypeFilter);
      if (!filteredCampaign) {
        return [];
      }
      const query = campaignSearch.trim().toLowerCase();
      const matchesSearch =
        !query ||
        (filteredCampaign.campaignName ?? filteredCampaign.campaignId)
          .toLowerCase()
          .includes(query) ||
        getObjectiveLabel(filteredCampaign.objective, localize).toLowerCase().includes(query) ||
        filteredCampaign.adSets.some((adset) =>
          (adset.entityName ?? adset.entityId).toLowerCase().includes(query),
        );
      const matchesObjective =
        objectiveFilter === 'all' || (filteredCampaign.objective || 'UNKNOWN') === objectiveFilter;
      const matchesStatus =
        campaignStatusFilter === 'all' ||
        (campaignStatusFilter === 'active' && isActiveMetaAdsStatus(filteredCampaign.status)) ||
        (campaignStatusFilter === 'inactive' && !isActiveMetaAdsStatus(filteredCampaign.status));
      const matchesMode =
        budgetModeFilter === 'all' ||
        (filteredCampaign.budgetMode ?? 'UNKNOWN') === budgetModeFilter;
      return matchesSearch && matchesObjective && matchesStatus && matchesMode
        ? [filteredCampaign]
        : [];
    })
    .sort((first, second) => {
      const [key, direction = 'asc'] = campaignSort.split('_') as [string, 'asc' | 'desc'];
      if (key === 'name' || key === 'resultType') {
        const firstValue =
          key === 'resultType'
            ? getResultTypeLabel(String(getMetricValue(first, key)), localize)
            : String(getMetricValue(first, key));
        const secondValue =
          key === 'resultType'
            ? getResultTypeLabel(String(getMetricValue(second, key)), localize)
            : String(getMetricValue(second, key));
        const result = firstValue.localeCompare(secondValue);
        return direction === 'desc' ? -result : result;
      }
      return compareNumberSort(first, second, key, direction);
    });
}

function isActiveMetaAdsStatus(status: string | undefined) {
  const normalizedStatus = typeof status === 'string' ? status.trim().toUpperCase() : '';
  return !normalizedStatus || normalizedStatus === 'ACTIVE';
}

type ResultTypeEntity = {
  resultType?: string;
  resultTypeBreakdown?: Array<{
    resultType?: string;
    totalSpend?: number;
    totalResults?: number;
    averageCostPerResult?: number | null;
  }>;
};

function addEntityResultTypes(resultTypes: Set<string>, entity: ResultTypeEntity) {
  if (entity.resultType) {
    resultTypes.add(entity.resultType || 'UNKNOWN');
  }
  for (const breakdown of entity.resultTypeBreakdown ?? []) {
    resultTypes.add(breakdown.resultType || 'UNKNOWN');
  }
}

function matchesResultType(entity: ResultTypeEntity, resultTypeFilter: string) {
  if (resultTypeFilter === 'all') {
    return true;
  }
  if ((entity.resultType || 'UNKNOWN') === resultTypeFilter) {
    return true;
  }
  return (entity.resultTypeBreakdown ?? []).some(
    (breakdown) => (breakdown.resultType || 'UNKNOWN') === resultTypeFilter,
  );
}

function filterCampaignByResultType(
  campaign: ProjectMetaAdsCampaignSummary,
  resultTypeFilter: string,
) {
  if (resultTypeFilter === 'all') {
    return campaign;
  }

  const adSets = campaign.adSets
    .map((adset) => {
      const ads = (adset.ads ?? []).filter((ad) => matchesResultType(ad, resultTypeFilter));
      if (!matchesResultType(adset, resultTypeFilter) && ads.length === 0) {
        return null;
      }
      return { ...adset, ads };
    })
    .filter((adset): adset is ProjectMetaAdsCampaignSummary['adSets'][number] => adset !== null);

  if (!matchesResultType(campaign, resultTypeFilter) && adSets.length === 0) {
    return null;
  }

  return applyResultTypeMetrics({ ...campaign, adSets }, resultTypeFilter);
}

function applyResultTypeMetrics(
  campaign: ProjectMetaAdsCampaignSummary,
  resultTypeFilter: string,
): ProjectMetaAdsCampaignSummary {
  const breakdown = campaign.resultTypeBreakdown?.find(
    (item) => (item.resultType || 'UNKNOWN') === resultTypeFilter,
  );
  if (breakdown) {
    return {
      ...campaign,
      resultType: breakdown.resultType || resultTypeFilter,
      spend: breakdown.totalSpend,
      resultCount: breakdown.totalResults,
      cpa: breakdown.averageCostPerResult,
    };
  }
  if ((campaign.resultType || 'UNKNOWN') === resultTypeFilter) {
    return campaign;
  }
  const totals = campaign.adSets.reduce(
    (total, adset) => ({
      spend: total.spend + Number(adset.spend ?? 0),
      results: total.results + Number(adset.resultCount ?? 0),
    }),
    { spend: 0, results: 0 },
  );
  return {
    ...campaign,
    resultType: resultTypeFilter,
    spend: Number(totals.spend.toFixed(2)),
    resultCount: Number(totals.results.toFixed(2)),
    cpa: totals.results > 0 ? Number((totals.spend / totals.results).toFixed(2)) : campaign.cpa,
  };
}
