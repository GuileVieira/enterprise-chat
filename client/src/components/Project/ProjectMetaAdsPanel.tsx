import { Fragment, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { MouseEvent, UIEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowSquareOut,
  ArrowsIn,
  ArrowsOut,
  Copy,
  DotsThreeVertical,
  Info,
  PencilSimple,
  Play,
  Pause,
  Trash,
} from '@phosphor-icons/react';
import { SystemRoles } from 'librechat-data-provider';
import {
  OGDialog,
  OGDialogTitle,
  OGDialogHeader,
  OGDialogContent,
  useToastContext,
} from '@librechat/client';
import type {
  TProject,
  ProjectMetaAdsAdSummary,
  ProjectMetaAdsCampaignSummary,
  ProjectMetaAdsEvolutionDelta,
  ProjectMetaAdsTrendSeries,
  ProjectMetaAdsRankingItem,
  ProjectMetaAdsRecommendation,
  ProjectMetaAdsEntityStatusLevel,
} from 'librechat-data-provider';
import {
  useGetStartupConfig,
  useApplyProjectMetaAdsRecommendationMutation,
  useDuplicateProjectMetaAdsEntityMutation,
  useProjectMetaAdsRankingsQuery,
  useProjectMetaAdsQuery,
  useRunProjectMetaAdsMutation,
  useUpdateProjectMetaAdsEntityStatusMutation,
  useUpdateProjectMetaAdsBudgetMutation,
  useUpdateProjectMetaAdsMutation,
  useUpdateProjectMetaAdsTenantTokenMutation,
} from '~/data-provider';
import { useAuthContext, useLocalize } from '~/hooks';
import type { TranslationKeys } from '~/hooks';
import { logger } from '~/utils';
import { buildMetaAdsChatBrief, MAX_META_ADS_CHAT_BRIEF_ENTITIES } from './metaAdsChatBrief';
import {
  BI_TOP_LIMIT,
  tableColumnMap,
  tableViewOptions,
  evolutionColors,
  scheduleOptions,
  tableViewMinWidth,
  workspaceTabOptions,
  periodFilterOptions,
  EVOLUTION_SERIES_LIMIT,
} from './metaAds/constants';
import {
  defaultRules,
  numberFields,
  resultTypeOptions,
  accountProfileRules,
  primaryMetricOptions,
  accountProfileOptions,
  optionalNumberFields,
  getRuleOverrideKey,
  getRuleDraftTitleKey,
  getRuleRowTypeLabelKey,
  hasRulePerformanceMetric,
} from './metaAds/rules';
import {
  getRankEfficiency,
  getAdThumbnailUrl,
  buildMetaAdsBiRankings,
  getSortedBiRankingItems,
} from './metaAds/bi';
import {
  formatMoney,
  formatMetric,
  formatPercent,
  formatTrendDate,
  buildChartPath,
  formatSignedMoney,
  getObjectiveLabel,
  formatRankingCost,
  formatSignedMetric,
  getResultTypeLabel,
  formatSignedPercent,
  formatIntegerMetric,
  shouldShowTrendLabel,
  getEvolutionMetricValue,
  getEvolutionMetricLabel,
  formatEvolutionMetricValue,
} from './metaAds/formatters';
import {
  collectBiResultTypes,
  isEcommerceContext,
  calculateWeightedRoas,
  buildObjectiveSummaries,
  buildSummaryResultTypeOptions,
} from './metaAds/summary';
import {
  getTableViewColumns,
  buildBudgetReferences,
  getBudgetChangeDelta,
  buildCampaignFallback,
} from './metaAds/table';
import {
  toAdAccountId,
  getAdAccountDigits,
  normalizeSettings,
  getGraphVersionOptions,
} from './metaAds/settings';
import type {
  Localize,
  RuleRow,
  TableView,
  TableColumn,
  RequestError,
  BudgetEditor,
  RuleGroupDraft,
  PeriodFilter,
  SettingsDrawer,
  WorkspaceTab,
  DuplicateDraft,
  MetaAdsSettings,
  MetaAdsRuleGroup,
  BiRankingSort,
  MetaAdsBiRankItem,
  EvolutionMetric,
  MetaAdsRulesState,
  MetaAdsBiControls,
  BudgetConfirmation,
  MetaAdsRuleOverride,
  EvolutionHoverPoint,
  MetaAdsBiRankLevel,
  MetaAdsSettingsState,
  BiRankingSortKey,
  ScheduleIntervalMinutes,
  EntityStatusConfirmation,
} from './metaAds/types';
import {
  MetaAdsBadge,
  MetaAdsButton,
  MetaAdsField,
  MetaAdsInput,
  MetaAdsPanel,
  MetaAdsSelect,
  metaAdsButtonClassName,
  metaAdsGhostButtonClassName,
  metaAdsInputClassName,
  metaAdsInputLargeClassName,
  metaAdsLabelClassName,
  metaAdsModalTileClassName,
  metaAdsPrimaryButtonClassName,
} from './metaAds/ui';

const metaAdsSurface =
  'overflow-hidden rounded-[28px] border border-slate-200/80 bg-[radial-gradient(circle_at_top_left,rgba(20,184,166,0.12),transparent_34%),linear-gradient(135deg,#f8fbff_0%,#eef5ff_45%,#f7f2ff_100%)] text-slate-950 shadow-[0_24px_80px_-52px_rgba(15,23,42,0.45)] dark:border-white/10 dark:bg-[radial-gradient(circle_at_top_left,rgba(20,184,166,0.18),transparent_34%),linear-gradient(135deg,#111827_0%,#172033_48%,#241b3a_100%)] dark:text-slate-50 dark:shadow-[0_30px_100px_-60px_rgba(15,23,42,0.95)]';
const metaAdsInput = metaAdsInputClassName;
const metaAdsInputLg = metaAdsInputLargeClassName;
const metaAdsButton = metaAdsButtonClassName;
const metaAdsGhostButton = metaAdsGhostButtonClassName;
const metaAdsPrimaryButton = metaAdsPrimaryButtonClassName;
const metaAdsLabel = metaAdsLabelClassName;
const metaAdsStickyCell =
  'bg-white group-odd:bg-slate-50 shadow-[12px_0_28px_-24px_rgba(15,23,42,0.55)] group-hover:bg-teal-50 dark:bg-[#172033] dark:group-odd:bg-[#1b263b] dark:group-hover:bg-[#183247] dark:shadow-[12px_0_28px_-24px_rgba(0,0,0,0.9)]';
const metaAdsModalOverlay = 'fixed inset-0 z-[10020] bg-slate-950/55 p-4 dark:bg-black/65';
const metaAdsModalShell =
  'overflow-hidden rounded-3xl border border-slate-200/80 bg-white text-slate-950 shadow-[0_28px_90px_-52px_rgba(15,23,42,0.75)] dark:border-white/10 dark:bg-[#121a2b] dark:text-slate-50 dark:shadow-[0_28px_90px_-54px_rgba(0,0,0,0.95)]';
const metaAdsDrawerShell =
  'flex h-full w-full flex-col border-l border-slate-200/80 bg-white text-slate-950 shadow-[0_28px_90px_-52px_rgba(15,23,42,0.75)] dark:border-white/10 dark:bg-[#121a2b] dark:text-slate-50 dark:shadow-[0_28px_90px_-54px_rgba(0,0,0,0.95)]';
const metaAdsModalHeader =
  'border-b border-slate-200/75 bg-slate-50 px-5 py-4 text-left dark:border-white/10 dark:bg-[#172033]';
const metaAdsModalTile = metaAdsModalTileClassName;

function getEvolutionSeriesTotal(series: ProjectMetaAdsTrendSeries, metric: EvolutionMetric) {
  if (metric === 'cpa') {
    const lastPoint = [...series.points]
      .reverse()
      .find((point) => getEvolutionMetricValue(point, metric) != null);
    return getEvolutionMetricValue(lastPoint ?? series.points[0], metric) ?? 0;
  }
  return series.points.reduce(
    (sum, point) => sum + Number(getEvolutionMetricValue(point, metric) ?? 0),
    0,
  );
}

function hasMeaningfulDelta(delta: ProjectMetaAdsEvolutionDelta) {
  return [
    delta.spendDelta,
    delta.resultDelta,
    delta.cpaDelta,
    delta.budgetDelta,
    delta.frequencyDelta,
  ].some((value) => {
    const numericValue = Number(value ?? 0);
    return Number.isFinite(numericValue) && Math.abs(numericValue) > 0.005;
  });
}

function matchesBiSeriesFilters(
  series: ProjectMetaAdsTrendSeries,
  objectiveFilter: string,
  resultTypeFilter: string,
) {
  return (
    (objectiveFilter === 'all' || !series.objective || series.objective === objectiveFilter) &&
    (resultTypeFilter === 'all' || !series.resultType || series.resultType === resultTypeFilter)
  );
}

function getDeltaEntityId(delta: ProjectMetaAdsEvolutionDelta) {
  return delta.entityId || delta.campaignId || '';
}

function getDeltaEntityName(delta: ProjectMetaAdsEvolutionDelta) {
  return delta.entityName || delta.campaignName;
}

function cleanDashboardName(value: string | undefined, fallback: string) {
  const cleanedValue = (value ?? '').replace(/^[^\w[]+\s*/u, '').trim();
  return cleanedValue || value || fallback;
}

function RuleFieldLabel({
  labelKey,
  hintKey,
  localize,
}: {
  labelKey: TranslationKeys;
  hintKey: TranslationKeys;
  localize: Localize;
}) {
  return (
    <span className="group/rule-label relative inline-flex w-fit max-w-full items-center gap-1.5">
      <span>{localize(labelKey)}</span>
      <span
        aria-hidden="true"
        className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-white/10 text-[#948b7d] transition group-hover/rule-label:border-amber-300/40 group-hover/rule-label:text-amber-100"
      >
        <Info size={11} weight="bold" />
      </span>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-0 top-full z-20 mt-1 hidden w-64 border border-white/10 bg-[#1b1812] p-2 text-[11px] normal-case leading-4 tracking-normal text-[#d8d0c2] shadow-xl group-focus-within/rule-label:block group-hover/rule-label:block"
      >
        {localize(hintKey)}
      </span>
    </span>
  );
}

function createMetaAdsBriefStorageKey() {
  const id =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `meta_ads_brief:${id}`;
}

function getRequestErrorMessage(error: unknown, fallback: string) {
  const requestError = error as RequestError;
  if (typeof requestError.response?.data?.message === 'string') {
    return requestError.response.data.message;
  }
  if (typeof requestError.message === 'string') {
    return requestError.message;
  }
  return fallback;
}

function getMetricValue(campaign: ProjectMetaAdsCampaignSummary, key: string) {
  if (key === 'budget') {
    return campaign.dailyBudget ?? 0;
  }
  if (key === 'frequency') {
    return campaign.frequency ?? 0;
  }
  if (key === 'spend') {
    return campaign.spend ?? 0;
  }
  if (key === 'roas') {
    return campaign.roas ?? 0;
  }
  if (key === 'cpa') {
    return campaign.cpa;
  }
  if (key === 'result') {
    return campaign.resultCount ?? 0;
  }
  if (key === 'ctr') {
    return campaign.ctr ?? 0;
  }
  if (key === 'clicks') {
    return campaign.clicks ?? 0;
  }
  return campaign.campaignName ?? campaign.campaignId;
}

function compareNumberSort(
  left: ProjectMetaAdsCampaignSummary,
  right: ProjectMetaAdsCampaignSummary,
  key: string,
  direction: 'asc' | 'desc',
) {
  const leftRaw = getMetricValue(left, key);
  const rightRaw = getMetricValue(right, key);
  const emptyValue = key === 'cpa' && direction === 'asc' ? Infinity : -Infinity;
  const leftValue = typeof leftRaw === 'number' && Number.isFinite(leftRaw) ? leftRaw : emptyValue;
  const rightValue =
    typeof rightRaw === 'number' && Number.isFinite(rightRaw) ? rightRaw : emptyValue;
  return direction === 'asc' ? leftValue - rightValue : rightValue - leftValue;
}

function getRecommendationLabel(
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

function canApplyRecommendation(recommendation: ProjectMetaAdsRecommendation | undefined) {
  return Boolean(recommendation && recommendation.action !== 'hold');
}

function toDateInputValue(date: Date) {
  const localTimestamp = date.getTime() - date.getTimezoneOffset() * 60 * 1000;
  return new Date(localTimestamp).toISOString().slice(0, 10);
}

function getDateInputDaysAgo(daysAgo: number) {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return toDateInputValue(date);
}

export default function ProjectMetaAdsPanel({
  project,
  canEdit,
}: {
  project: TProject;
  canEdit: boolean;
}) {
  const localize = useLocalize();
  const navigate = useNavigate();
  const { user } = useAuthContext();
  const { showToast } = useToastContext();
  const tableScrollRef = useRef<HTMLDivElement | null>(null);
  const stickyHorizontalScrollRef = useRef<HTMLDivElement | null>(null);
  const isSyncingHorizontalScrollRef = useRef(false);
  const [settings, setSettings] = useState(() => normalizeSettings(project));
  const [settingsDraft, setSettingsDraft] = useState<MetaAdsSettingsState | null>(null);
  const [settingsDraftToken, setSettingsDraftToken] = useState('');
  const [showSettingsDraftToken, setShowSettingsDraftToken] = useState(false);
  const [credentialsDialogOpen, setCredentialsDialogOpen] = useState(false);
  const [tenantAccessToken, setTenantAccessToken] = useState('');
  const [showTenantAccessToken, setShowTenantAccessToken] = useState(false);
  const [selectedEntityIds, setSelectedEntityIds] = useState<string[]>([]);
  const [expandedCampaignIds, setExpandedCampaignIds] = useState<string[]>([]);
  const [collapsedAboCampaignIds, setCollapsedAboCampaignIds] = useState<string[]>([]);
  const [budgetEditor, setBudgetEditor] = useState<BudgetEditor | null>(null);
  const [manualDailyBudget, setManualDailyBudget] = useState('');
  const [budgetConfirmation, setBudgetConfirmation] = useState<BudgetConfirmation | null>(null);
  const [entityStatusConfirmation, setEntityStatusConfirmation] =
    useState<EntityStatusConfirmation | null>(null);
  const [duplicateDraft, setDuplicateDraft] = useState<DuplicateDraft | null>(null);
  const [duplicateTargetName, setDuplicateTargetName] = useState('');
  const [actionMenuKey, setActionMenuKey] = useState<string | null>(null);
  const [ruleGroupDraft, setRuleGroupDraft] = useState<RuleGroupDraft | null>(null);
  const [campaignSearch, setCampaignSearch] = useState('');
  const [objectiveFilter, setObjectiveFilter] = useState('all');
  const [resultTypeSelectorOpen, setResultTypeSelectorOpen] = useState(false);
  const [selectedSummaryResultType, setSelectedSummaryResultType] = useState<string | null>(null);
  const [budgetModeFilter, setBudgetModeFilter] = useState('all');
  const [campaignSort, setCampaignSort] = useState('name_asc');
  const [workspaceTab, setWorkspaceTab] = useState<WorkspaceTab>('overview');
  const [tableView, setTableView] = useState<TableView>('summary');
  const [biControls, setBiControls] = useState<MetaAdsBiControls>({
    level: 'campaign',
    objective: 'all',
    resultType: 'all',
    metric: 'spend',
  });
  const [biRankingSort, setBiRankingSort] = useState<BiRankingSort>({
    key: 'cpa',
    direction: 'asc',
  });
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('last_7d');
  const [customSince, setCustomSince] = useState(() => getDateInputDaysAgo(6));
  const [customUntil, setCustomUntil] = useState(() => toDateInputValue(new Date()));
  const [appliedCustomSince, setAppliedCustomSince] = useState(() => getDateInputDaysAgo(6));
  const [appliedCustomUntil, setAppliedCustomUntil] = useState(() => toDateInputValue(new Date()));
  const [runErrorMessage, setRunErrorMessage] = useState<string | null>(null);
  const [settingsDrawer, setSettingsDrawer] = useState<SettingsDrawer>(null);
  const [metricsFullscreen, setMetricsFullscreen] = useState(false);
  const [selectedBiRankItem, setSelectedBiRankItem] = useState<MetaAdsBiRankItem | null>(null);
  const [hoveredEvolutionPoint, setHoveredEvolutionPoint] = useState<EvolutionHoverPoint | null>(
    null,
  );
  const [selectedAdPreview, setSelectedAdPreview] = useState<ProjectMetaAdsAdSummary | null>(null);
  const [collapsedAdSetAdsIds, setCollapsedAdSetAdsIds] = useState<string[]>([]);
  const startupConfigQuery = useGetStartupConfig();
  const tableStatusParams = { datePreset: 'last_7d' };
  const biStatusParams =
    periodFilter === 'custom'
      ? {
          ...(appliedCustomSince ? { since: appliedCustomSince } : {}),
          ...(appliedCustomUntil ? { until: appliedCustomUntil } : {}),
        }
      : { datePreset: periodFilter };
  const statusQuery = useProjectMetaAdsQuery(project.projectId, tableStatusParams);
  const biStatusQuery = useProjectMetaAdsQuery(project.projectId, biStatusParams);
  const biRankingsQuery = useProjectMetaAdsRankingsQuery(project.projectId, {
    ...biStatusParams,
    level: biControls.level,
    objective: biControls.objective,
    resultType: biControls.resultType,
  });
  const updateSettings = useUpdateProjectMetaAdsMutation();
  const updateTenantToken = useUpdateProjectMetaAdsTenantTokenMutation();
  const updateBudget = useUpdateProjectMetaAdsBudgetMutation();
  const duplicateEntity = useDuplicateProjectMetaAdsEntityMutation();
  const updateEntityStatus = useUpdateProjectMetaAdsEntityStatusMutation();
  const runAnalysis = useRunProjectMetaAdsMutation();
  const applyRecommendation = useApplyProjectMetaAdsRecommendationMutation();
  const isStatusLoading = Boolean(statusQuery.isLoading || statusQuery.isFetching);
  const isInitialStatusLoading = isStatusLoading && !statusQuery.data;
  const canManageTenantToken = user?.role === SystemRoles.ADMIN;
  const canUseMetaAdsActions =
    canEdit ||
    user?.role === SystemRoles.ADMIN ||
    user?.role === SystemRoles.OWNER ||
    user?.role === SystemRoles.USER;

  useEffect(() => {
    setSettings(normalizeSettings(project));
    setSettingsDrawer(null);
    setSettingsDraft(null);
    setSettingsDraftToken('');
    setShowSettingsDraftToken(false);
    setCredentialsDialogOpen(false);
    setTenantAccessToken('');
    setShowTenantAccessToken(false);
    setSelectedAdPreview(null);
    setEntityStatusConfirmation(null);
    setDuplicateDraft(null);
    setDuplicateTargetName('');
    setActionMenuKey(null);
  }, [project]);

  useEffect(() => {
    if (!metricsFullscreen) {
      return;
    }
    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMetricsFullscreen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousBodyOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [metricsFullscreen]);

  useEffect(() => {
    if (!actionMenuKey) {
      return;
    }
    const closeMenu = () => setActionMenuKey(null);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeMenu();
      }
    };
    window.addEventListener('click', closeMenu);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('click', closeMenu);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [actionMenuKey]);

  useEffect(() => {
    setHoveredEvolutionPoint(null);
  }, [
    biControls.level,
    biControls.metric,
    biControls.objective,
    biControls.resultType,
    appliedCustomSince,
    appliedCustomUntil,
    periodFilter,
  ]);

  const releaseHorizontalScrollSync = () => {
    window.requestAnimationFrame(() => {
      isSyncingHorizontalScrollRef.current = false;
    });
  };

  const onTableScroll = (event: UIEvent<HTMLDivElement>) => {
    if (isSyncingHorizontalScrollRef.current) {
      return;
    }
    const stickyScroll = stickyHorizontalScrollRef.current;
    if (!stickyScroll || stickyScroll.scrollLeft === event.currentTarget.scrollLeft) {
      return;
    }
    isSyncingHorizontalScrollRef.current = true;
    stickyScroll.scrollLeft = event.currentTarget.scrollLeft;
    releaseHorizontalScrollSync();
  };

  const onStickyHorizontalScroll = (event: UIEvent<HTMLDivElement>) => {
    if (isSyncingHorizontalScrollRef.current) {
      return;
    }
    const tableScroll = tableScrollRef.current;
    if (!tableScroll || tableScroll.scrollLeft === event.currentTarget.scrollLeft) {
      return;
    }
    isSyncingHorizontalScrollRef.current = true;
    tableScroll.scrollLeft = event.currentTarget.scrollLeft;
    releaseHorizontalScrollSync();
  };

  const pendingRecommendations =
    statusQuery.data?.recommendations.filter((item) => item.status === 'pending') ?? [];
  const latestSnapshots = statusQuery.data?.latestSnapshots.slice(0, 8) ?? [];
  const campaigns =
    statusQuery.data?.campaigns && statusQuery.data.campaigns.length > 0
      ? statusQuery.data.campaigns
      : buildCampaignFallback(latestSnapshots);
  const tokenCredentials = statusQuery.data?.credentials;
  const currency = statusQuery.data?.currency ?? 'BRL';
  const graphVersionOptions = getGraphVersionOptions(statusQuery.data?.graphVersion?.effective);
  const trend = biStatusQuery.data?.trend ?? statusQuery.data?.trend;
  const trendPoints = trend?.points ?? [];
  const campaignDeltas = trend?.campaignDeltas ?? [];
  const changesByDay = trend?.changesByDay ?? [];
  const dailySpendTrend = trendPoints
    .reduce<Array<{ date: string; spend: number }>>((items, point) => {
      const existing = items.find((item) => item.date === point.date);
      if (existing) {
        existing.spend += Number(point.spend ?? 0);
        return items;
      }
      return [...items, { date: point.date, spend: Number(point.spend ?? 0) }];
    }, [])
    .sort((left, right) => left.date.localeCompare(right.date));
  const maxDailySpend = Math.max(...dailySpendTrend.map((point) => point.spend), 0);
  const totalTrendSpend = dailySpendTrend.reduce((sum, point) => sum + point.spend, 0);
  const latestDailySpend = dailySpendTrend[dailySpendTrend.length - 1]?.spend;
  const peakDailySpend = dailySpendTrend.reduce<{ date: string; spend: number } | null>(
    (peak, point) => (!peak || point.spend > peak.spend ? point : peak),
    null,
  );
  const totalBudgetChangeCount = changesByDay.reduce(
    (sum, point) => sum + Number(point.changeCount ?? 0),
    0,
  );
  const chartWidth = 480;
  const chartHeight = 160;
  const chartPadding = 18;
  const chartBottom = chartHeight - chartPadding;
  const getEvolutionTooltipTransform = (point: EvolutionHoverPoint) => {
    const ratio = point.x / chartWidth;
    if (ratio < 0.18) {
      return 'translate(0, calc(-100% - 10px))';
    }
    if (ratio > 0.82) {
      return 'translate(-100%, calc(-100% - 10px))';
    }
    return 'translate(-50%, calc(-100% - 10px))';
  };
  const canRenderSpendChart = dailySpendTrend.length > 1 && maxDailySpend > 0;
  const spendChartPoints = dailySpendTrend.map((point, index) => {
    const x =
      chartPadding +
      (index / Math.max(dailySpendTrend.length - 1, 1)) * (chartWidth - chartPadding * 2);
    const y =
      chartBottom -
      (Number(point.spend ?? 0) / Math.max(maxDailySpend, 1)) * (chartHeight - chartPadding * 2);
    return { x, y };
  });
  const spendChartPath = buildChartPath(spendChartPoints);
  const spendChartAreaPath =
    spendChartPoints.length > 0
      ? `${spendChartPath} L ${spendChartPoints[spendChartPoints.length - 1].x.toFixed(
          2,
        )} ${chartBottom} L ${spendChartPoints[0].x.toFixed(2)} ${chartBottom} Z`
      : '';
  const evolutionSeries = (trend?.series ?? [])
    .filter(
      (series) =>
        series.level === biControls.level &&
        matchesBiSeriesFilters(series, biControls.objective, biControls.resultType),
    )
    .map((series) => ({
      ...series,
      points: [...series.points].sort((left, right) => left.date.localeCompare(right.date)),
      total: getEvolutionSeriesTotal(series, biControls.metric),
    }))
    .filter((series) => Number.isFinite(series.total) && Math.abs(series.total) > 0)
    .sort((left, right) => Number(right.total) - Number(left.total))
    .slice(0, EVOLUTION_SERIES_LIMIT);
  const evolutionDates = Array.from(
    new Set(evolutionSeries.flatMap((series) => series.points.map((point) => point.date))),
  ).sort((left, right) => left.localeCompare(right));
  const maxEvolutionValue = Math.max(
    ...evolutionSeries.flatMap((series) =>
      series.points.map((point) => Number(getEvolutionMetricValue(point, biControls.metric) ?? 0)),
    ),
    0,
  );
  const canRenderEvolutionSeries =
    evolutionSeries.length > 0 && evolutionDates.length > 1 && maxEvolutionValue > 0;
  const evolutionSeriesPaths = evolutionSeries.map((series, seriesIndex) => {
    const points = evolutionDates.map((date, index) => {
      const rawPoint = series.points.find((point) => point.date === date);
      const value = Number(
        getEvolutionMetricValue(rawPoint ?? series.points[0], biControls.metric) ?? 0,
      );
      const x =
        chartPadding +
        (index / Math.max(evolutionDates.length - 1, 1)) * (chartWidth - chartPadding * 2);
      const y =
        chartBottom - (value / Math.max(maxEvolutionValue, 1)) * (chartHeight - chartPadding * 2);
      return { x, y, value, date, rawPoint };
    });
    return {
      series,
      color: evolutionColors[seriesIndex % evolutionColors.length],
      points,
      path: buildChartPath(points),
    };
  });
  const evolutionSeriesIds = new Set(evolutionSeries.map((series) => series.entityId));
  const evolutionDeltas =
    trend?.entityDeltas && trend.entityDeltas.length > 0
      ? trend.entityDeltas
      : (campaignDeltas as ProjectMetaAdsEvolutionDelta[]);
  const meaningfulDeltas = evolutionDeltas
    .filter((delta) => (delta.level ?? 'campaign') === biControls.level)
    .filter(
      (delta) => evolutionSeriesIds.size === 0 || evolutionSeriesIds.has(getDeltaEntityId(delta)),
    )
    .filter(hasMeaningfulDelta);
  const bestEvolution = [...meaningfulDeltas]
    .sort((left, right) => {
      const resultDiff = Number(right.resultDelta ?? 0) - Number(left.resultDelta ?? 0);
      if (resultDiff !== 0) {
        return resultDiff;
      }
      return Number(left.cpaDelta ?? 0) - Number(right.cpaDelta ?? 0);
    })
    .slice(0, 3);
  const evolutionAlerts = meaningfulDeltas
    .filter(
      (delta) =>
        biControls.level !== 'ad' &&
        (Number(delta.cpaDelta ?? 0) > 0 ||
          Number(delta.frequencyDelta ?? 0) > 0 ||
          Number(delta.latestChange?.deltaDailyBudget ?? 0) !== 0),
    )
    .slice(0, 4);
  const hasEvolutionSection = Boolean(trend);
  const selectedCount = selectedEntityIds.length;
  const canOpenTrafficAgentChat =
    selectedCount > 0 && selectedCount <= MAX_META_ADS_CHAT_BRIEF_ENTITIES;
  const tokenStatusKey: TranslationKeys =
    tokenCredentials?.effectiveSource === 'project'
      ? 'com_ui_project_meta_ads_project_token_configured'
      : tokenCredentials?.effectiveSource === 'tenant'
        ? 'com_ui_project_meta_ads_tenant_token_configured'
        : 'com_ui_project_meta_ads_token_missing';
  const hasMaskedToken =
    tokenCredentials?.effectiveSource === 'project' ||
    tokenCredentials?.effectiveSource === 'tenant';
  const hasProjectToken =
    tokenCredentials?.effectiveSource === 'project' || Boolean(settingsDraft?.tokenSecretName);
  const selectedCampaignIds = selectedEntityIds
    .filter((id) => id.startsWith('campaign:'))
    .map((id) => id.replace('campaign:', ''));
  const selectedAdSetIds = selectedEntityIds
    .filter((id) => id.startsWith('adset:'))
    .map((id) => id.replace('adset:', ''));
  const canCreateRuleGroup = canUseMetaAdsActions;
  const getEntityRuleLabel = (entityLevel: MetaAdsRuleGroup['entityLevel'], entityId: string) =>
    settings.ruleGroups?.find(
      (group) => group.entityLevel === entityLevel && group.entityIds?.includes(entityId),
    )?.name ?? '-';
  const getCampaignName = (campaignId: string) =>
    campaigns.find((campaign) => campaign.campaignId === campaignId)?.campaignName ?? campaignId;
  const getAdSetName = (adSetId: string) =>
    campaigns.flatMap((campaign) => campaign.adSets).find((adSet) => adSet.entityId === adSetId)
      ?.entityName ?? adSetId;
  const getRuleEntityLabel = (entityLevel: MetaAdsRuleGroup['entityLevel'], entityId: string) =>
    entityLevel === 'campaign' ? getCampaignName(entityId) : getAdSetName(entityId);
  const ruleDraftEntityLabels = ruleGroupDraft
    ? ruleGroupDraft.entityIds.map((entityId) =>
        getRuleEntityLabel(ruleGroupDraft.entityLevel, entityId),
      )
    : [];
  const ruleRows: RuleRow[] = [
    {
      key: 'global',
      type: 'global',
      enabled: settings.enabled,
      name: localize('com_ui_project_meta_ads_global_rules'),
      scopeLabel: localize('com_ui_project_meta_ads_scope_all_campaigns'),
      precedenceLabel: localize('com_ui_project_meta_ads_precedence_global'),
      entityIds: [],
      rules: settings.rules,
      creativeRules: settings.creativeRules,
    },
    ...(settings.ruleGroups ?? []).map<RuleRow>((group) => ({
      key: `group:${group.id}`,
      type: 'group',
      enabled: group.enabled !== false,
      name: group.name,
      scopeLabel: `${group.entityLevel === 'campaign' ? localize('com_ui_project_meta_ads_level_campaign') : localize('com_ui_project_meta_ads_level_ad_set')} · ${
        group.entityIds?.length ?? 0
      }`,
      precedenceLabel: localize('com_ui_project_meta_ads_precedence_group'),
      entityLevel: group.entityLevel,
      entityIds: group.entityIds ?? [],
      group,
      rules: { ...defaultRules, ...(group.rules ?? {}) },
    })),
    ...(settings.ruleOverrides ?? []).map<RuleRow>((override) => {
      const isCampaign = override.entityLevel === 'campaign';
      return {
        key: `override:${getRuleOverrideKey(override)}`,
        type: isCampaign ? 'campaign_override' : 'adset_override',
        enabled: override.enabled !== false,
        name:
          override.entityName ||
          (isCampaign ? getCampaignName(override.entityId) : getAdSetName(override.entityId)),
        scopeLabel: `${isCampaign ? localize('com_ui_project_meta_ads_level_campaign') : localize('com_ui_project_meta_ads_level_ad_set')} · ${override.entityId}`,
        precedenceLabel: localize(
          isCampaign
            ? 'com_ui_project_meta_ads_precedence_campaign_override'
            : 'com_ui_project_meta_ads_precedence_adset_override',
        ),
        entityLevel: override.entityLevel,
        entityIds: [override.entityId],
        override,
        rules: { ...defaultRules, ...(override.rules ?? {}) },
      };
    }),
  ];
  const getEntityRecommendation = (entityId: string) =>
    pendingRecommendations.find((recommendation) => recommendation.entityId === entityId);
  const objectiveOptions = Array.from(
    new Set(campaigns.map((campaign) => campaign.objective || 'UNKNOWN')),
  ).sort((left, right) =>
    getObjectiveLabel(left, localize).localeCompare(getObjectiveLabel(right, localize), 'pt-BR'),
  );
  const biCampaigns = biStatusQuery.data?.campaigns ?? campaigns;
  const biResultTypeOptions = collectBiResultTypes(biCampaigns).sort((left, right) =>
    getResultTypeLabel(left, localize).localeCompare(getResultTypeLabel(right, localize), 'pt-BR'),
  );
  const biMinSpend = Number(settings.rules.minSpend || defaultRules.minSpend);
  const fallbackBiRankings = buildMetaAdsBiRankings(
    biCampaigns,
    biControls.objective,
    biControls.resultType,
    Number.isFinite(biMinSpend) && biMinSpend > 0 ? biMinSpend : defaultRules.minSpend,
  );
  const selectedBiRankingItems = getSortedBiRankingItems(
    (biRankingsQuery.data?.items ?? []).length > 0
      ? (biRankingsQuery.data?.items ?? [])
      : biControls.level === 'campaign'
        ? fallbackBiRankings.campaigns
        : biControls.level === 'adset'
          ? fallbackBiRankings.adSets
          : fallbackBiRankings.ads,
    biRankingSort,
  ).slice(0, BI_TOP_LIMIT);
  const selectedBiRankingTitleKey: TranslationKeys =
    biControls.level === 'campaign'
      ? 'com_ui_project_meta_ads_bi_top_campaigns'
      : biControls.level === 'adset'
        ? 'com_ui_project_meta_ads_bi_top_adsets'
        : 'com_ui_project_meta_ads_bi_top_ads';
  const selectedBiRankingTestId =
    biControls.level === 'campaign'
      ? 'meta-ads-bi-campaigns'
      : biControls.level === 'adset'
        ? 'meta-ads-bi-adsets'
        : 'meta-ads-bi-ads';
  const adRankingEmptyMessageKey: TranslationKeys =
    biStatusQuery.data?.adDiagnostics?.adInsightsFetched === 0
      ? 'com_ui_project_meta_ads_bi_no_ad_insights'
      : biStatusQuery.data?.adDiagnostics &&
          biStatusQuery.data.adDiagnostics.adInsightsFetched > 0 &&
          biStatusQuery.data.adDiagnostics.adsAttachedToAdSets === 0
        ? 'com_ui_project_meta_ads_bi_no_attached_ads'
        : 'com_ui_project_meta_ads_bi_no_rankings';
  const objectiveSummaries =
    statusQuery.data?.summary?.objectives && statusQuery.data.summary.objectives.length > 0
      ? statusQuery.data.summary.objectives
      : buildObjectiveSummaries(campaigns);
  const scopedObjectiveSummary =
    objectiveFilter !== 'all'
      ? objectiveSummaries.find((summary) => (summary.objective || 'UNKNOWN') === objectiveFilter)
      : objectiveSummaries.length === 1
        ? objectiveSummaries[0]
        : undefined;
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
  const summaryMetricContext = summaryResultType
    ? getResultTypeLabel(summaryResultType, localize)
    : scopedObjectiveSummary
      ? getObjectiveLabel(scopedObjectiveSummary.objective, localize)
      : undefined;
  const summaryTotalSpend =
    scopedObjectiveSummary?.totalSpend ?? statusQuery.data?.summary?.totalSpend;
  const summaryTotalResults =
    effectiveSummaryResultTypeOption?.totalResults ??
    (hasMixedObjectiveSummary
      ? null
      : (scopedObjectiveSummary?.totalResults ?? statusQuery.data?.summary?.totalResults));
  const summaryAverageCost =
    effectiveSummaryResultTypeOption?.averageCostPerResult ??
    (hasMixedObjectiveSummary
      ? null
      : (scopedObjectiveSummary?.averageCostPerResult ??
        statusQuery.data?.summary?.averageCostPerResult));
  const summaryAverageFrequency =
    scopedObjectiveSummary?.averageFrequency ?? statusQuery.data?.summary?.averageFrequency;
  const filteredCampaigns = campaigns
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
  const summaryAverageRoas = isEcommerceDashboard ? calculateWeightedRoas(filteredCampaigns) : null;

  const onSortColumn = (key: string, defaultDirection: 'asc' | 'desc') => {
    const [activeKey, activeDirection = defaultDirection] = campaignSort.split('_') as [
      string,
      'asc' | 'desc',
    ];
    const nextDirection =
      activeKey === key && activeDirection === defaultDirection
        ? defaultDirection === 'asc'
          ? 'desc'
          : 'asc'
        : defaultDirection;
    setCampaignSort(`${key}_${nextDirection}`);
  };

  const renderSortableHeader = ({
    key,
    label,
    className,
    defaultDirection = 'desc',
  }: {
    key: string;
    label: string;
    className?: string;
    defaultDirection?: 'asc' | 'desc';
  }) => {
    const [activeKey, activeDirection] = campaignSort.split('_') as [string, 'asc' | 'desc'];
    const isActive = activeKey === key;
    return (
      <button
        type="button"
        onClick={() => onSortColumn(key, defaultDirection)}
        className={`inline-flex w-full min-w-0 flex-wrap items-center gap-0.5 text-[10px] font-semibold uppercase leading-tight tracking-[0.08em] text-[#8f8677] transition hover:text-[#f8f1e5] ${
          className ?? ''
        }`}
      >
        <span className="min-w-0 break-words">{label}</span>
        {isActive && (
          <span aria-hidden="true" className="text-amber-200">
            {activeDirection === 'asc' ? '↑' : '↓'}
          </span>
        )}
      </button>
    );
  };

  const saveSettings = (
    nextSettings: MetaAdsSettingsState,
    token: string,
    onSuccess?: () => void,
  ) => {
    const trimmedToken = token.trim();
    logger.debug('MetaAds', 'Saving project Meta Ads settings', {
      projectId: project.projectId,
      hasMetaAccessToken: trimmedToken.length > 0,
      tokenLength: trimmedToken.length,
      tokenSecretName: nextSettings.tokenSecretName,
    });
    setSettings(nextSettings);
    updateSettings.mutate(
      {
        projectId: project.projectId,
        metaAds: nextSettings,
        ...(trimmedToken ? { metaAccessToken: trimmedToken } : {}),
      },
      {
        onSuccess: () => {
          statusQuery.refetch();
          setSettingsDraftToken('');
          setShowSettingsDraftToken(false);
          showToast({ message: localize('com_ui_saved'), status: 'success' });
          onSuccess?.();
          logger.debug('MetaAds', 'Saved project Meta Ads settings', {
            projectId: project.projectId,
            savedProjectToken: trimmedToken.length > 0,
          });
        },
        onError: (error) => {
          const message =
            error instanceof Error ? error.message : localize('com_ui_error_save_admin_settings');
          showToast({ message, status: 'error' });
          logger.error('MetaAds', 'Failed to save project Meta Ads settings', {
            projectId: project.projectId,
            error,
          });
        },
      },
    );
  };

  const onSave = () => {
    saveSettings(settings, '');
  };

  const onClearProjectToken = () => {
    if (!settingsDraft) {
      return;
    }
    const nextSettings: MetaAdsSettingsState = {
      ...settingsDraft,
      tokenSecretName: '',
      credentialMode: 'tenant_default',
    };
    setSettingsDraft(nextSettings);
    setSettingsDraftToken('');
    saveSettings(nextSettings, '', closeCredentialsDialog);
  };

  const onApply = (recommendation: ProjectMetaAdsRecommendation) => {
    if (!recommendation._id) {
      return;
    }
    applyRecommendation.mutate(
      {
        projectId: project.projectId,
        recommendationId: recommendation._id,
      },
      {
        onSuccess: () => {
          statusQuery.refetch();
          showToast({
            message: localize('com_ui_project_meta_ads_apply_success'),
            status: 'success',
          });
        },
        onError: (error) => {
          const message = getRequestErrorMessage(
            error,
            localize('com_ui_project_meta_ads_apply_failed'),
          );
          showToast({ message, status: 'error' });
          logger.error('MetaAds', 'Failed to apply project Meta Ads recommendation', {
            projectId: project.projectId,
            recommendationId: recommendation._id,
            error,
          });
        },
      },
    );
  };

  const onOpenBudgetEditor = (editor: BudgetEditor) => {
    setBudgetEditor(editor);
    setManualDailyBudget(editor.currentBudget == null ? '' : String(editor.currentBudget));
  };

  const onSaveManualBudget = () => {
    if (!budgetEditor) {
      return;
    }
    const dailyBudget = Number(manualDailyBudget);
    if (!Number.isFinite(dailyBudget) || dailyBudget <= 0) {
      showToast({
        message: localize('com_ui_project_meta_ads_invalid_budget'),
        status: 'error',
      });
      return;
    }
    setBudgetConfirmation({
      entityLevel: budgetEditor.entityLevel,
      entityId: budgetEditor.entityId,
      entityName: budgetEditor.entityName,
      dailyBudget,
      currentBudget: budgetEditor.currentBudget,
      reason: 'manual-ui',
    });
  };

  const onConfirmManualBudget = () => {
    if (!budgetConfirmation) {
      return;
    }
    updateBudget.mutate(
      {
        projectId: project.projectId,
        payload: {
          entityLevel: budgetConfirmation.entityLevel,
          entityId: budgetConfirmation.entityId,
          entityName: budgetConfirmation.entityName,
          dailyBudget: budgetConfirmation.dailyBudget,
          reason: budgetConfirmation.reason,
        },
      },
      {
        onSuccess: () => {
          setBudgetEditor(null);
          setBudgetConfirmation(null);
          setManualDailyBudget('');
          statusQuery.refetch();
          showToast({
            message: localize('com_ui_project_meta_ads_budget_success'),
            status: 'success',
          });
        },
        onError: (error) => {
          const message = getRequestErrorMessage(
            error,
            localize('com_ui_project_meta_ads_budget_failed'),
          );
          showToast({ message, status: 'error' });
        },
      },
    );
  };

  const onOpenEntityStatusConfirmation = (
    event: MouseEvent<HTMLButtonElement>,
    entity: {
      entityLevel: ProjectMetaAdsEntityStatusLevel;
      entityId: string;
      entityName?: string;
      status?: string;
    },
  ) => {
    event.stopPropagation();
    const currentStatus =
      typeof entity.status === 'string' ? entity.status.trim().toUpperCase() : '';
    const nextStatus = currentStatus === 'PAUSED' ? 'ACTIVE' : 'PAUSED';
    setEntityStatusConfirmation({
      entityLevel: entity.entityLevel,
      entityId: entity.entityId,
      entityName: entity.entityName,
      currentStatus,
      nextStatus,
    });
  };

  const onConfirmEntityStatus = () => {
    if (!entityStatusConfirmation) {
      return;
    }
    updateEntityStatus.mutate(
      {
        projectId: project.projectId,
        entityLevel: entityStatusConfirmation.entityLevel,
        entityId: entityStatusConfirmation.entityId,
        payload: {
          entityName: entityStatusConfirmation.entityName,
          status: entityStatusConfirmation.nextStatus,
        },
      },
      {
        onSuccess: () => {
          setEntityStatusConfirmation(null);
          statusQuery.refetch();
          showToast({
            message: localize('com_ui_project_meta_ads_ad_status_success'),
            status: 'success',
          });
        },
        onError: (error) => {
          const message = getRequestErrorMessage(
            error,
            localize('com_ui_project_meta_ads_ad_status_failed'),
          );
          showToast({ message, status: 'error' });
        },
      },
    );
  };

  const getDuplicateName = (name?: string) => {
    const baseName = typeof name === 'string' && name.trim() ? name.trim() : 'Meta Ads';
    return `${baseName} - cópia`;
  };

  const onOpenDuplicateDraft = (draft: DuplicateDraft) => {
    setActionMenuKey(null);
    setDuplicateDraft(draft);
    setDuplicateTargetName(getDuplicateName(draft.entityName ?? draft.entityId));
  };

  const onCloseDuplicateDraft = () => {
    setDuplicateDraft(null);
    setDuplicateTargetName('');
  };

  const onConfirmDuplicate = () => {
    if (!duplicateDraft) {
      return;
    }
    duplicateEntity.mutate(
      {
        projectId: project.projectId,
        payload: {
          entityLevel: duplicateDraft.entityLevel,
          entityId: duplicateDraft.entityId,
          entityName: duplicateDraft.entityName,
          targetName: duplicateTargetName.trim(),
        },
      },
      {
        onSuccess: () => {
          onCloseDuplicateDraft();
          statusQuery.refetch();
          showToast({
            message: localize('com_ui_project_meta_ads_duplicate_success'),
            status: 'success',
          });
        },
        onError: (error) => {
          const message = getRequestErrorMessage(
            error,
            localize('com_ui_project_meta_ads_duplicate_failed'),
          );
          showToast({ message, status: 'error' });
        },
      },
    );
  };

  const onOpenRuleGroupDraft = () => {
    if (!canCreateRuleGroup) {
      return;
    }
    if (selectedCampaignIds.length === 0 && selectedAdSetIds.length === 0) {
      setRuleGroupDraft({
        scope: 'global',
        name: localize('com_ui_project_meta_ads_global_rules'),
        entityLevel: 'campaign',
        entityIds: [],
        rules: { ...settings.rules },
        creativeRules: { ...settings.creativeRules },
      });
      return;
    }
    const entityLevel = selectedCampaignIds.length > 0 ? 'campaign' : 'adset';
    const entityIds = entityLevel === 'campaign' ? selectedCampaignIds : selectedAdSetIds;
    setRuleGroupDraft({
      scope: 'group',
      name: '',
      entityLevel,
      entityIds,
      rules: { ...settings.rules },
      creativeRules: { ...settings.creativeRules },
    });
  };

  const onEditGlobalRule = () => {
    setRuleGroupDraft({
      scope: 'global',
      name: localize('com_ui_project_meta_ads_global_rules'),
      entityLevel: 'campaign',
      entityIds: [],
      rules: { ...settings.rules },
      creativeRules: { ...settings.creativeRules },
    });
  };

  const onEditRuleGroup = (group: MetaAdsRuleGroup) => {
    setRuleGroupDraft({
      id: group.id,
      scope: 'group',
      name: group.name ?? '',
      entityLevel: group.entityLevel,
      entityIds: group.entityIds ?? [],
      rules: { ...defaultRules, ...(group.rules ?? {}) },
      creativeRules: { ...settings.creativeRules },
    });
  };

  const onEditRuleOverride = (ruleOverride: MetaAdsRuleOverride) => {
    setRuleGroupDraft({
      overrideKey: getRuleOverrideKey(ruleOverride),
      scope: 'override',
      name: ruleOverride.entityName ?? '',
      entityLevel: ruleOverride.entityLevel,
      entityIds: [ruleOverride.entityId],
      entityName: ruleOverride.entityName,
      rules: { ...defaultRules, ...(ruleOverride.rules ?? {}) },
      creativeRules: { ...settings.creativeRules },
    });
  };

  const onToggleRuleRow = (row: RuleRow) => {
    if (!canUseMetaAdsActions) {
      return;
    }
    if (row.type === 'global') {
      saveSettings({ ...settings, enabled: !row.enabled }, '');
      return;
    }
    if (row.type === 'group' && row.group?.id) {
      const nextSettings = {
        ...settings,
        ruleGroups: (settings.ruleGroups ?? []).map((group) =>
          group.id === row.group?.id ? { ...group, enabled: !row.enabled } : group,
        ),
      };
      saveSettings(nextSettings, '');
      return;
    }
    if (row.override) {
      const targetKey = getRuleOverrideKey(row.override);
      const nextSettings = {
        ...settings,
        ruleOverrides: (settings.ruleOverrides ?? []).map((ruleOverride) =>
          getRuleOverrideKey(ruleOverride) === targetKey
            ? { ...ruleOverride, enabled: !row.enabled }
            : ruleOverride,
        ),
      };
      saveSettings(nextSettings, '');
    }
  };

  const onDeleteRuleGroup = (groupId?: string) => {
    const nextSettings = {
      ...settings,
      ruleGroups: (settings.ruleGroups ?? []).filter((group) => group.id !== groupId),
    };
    saveSettings(nextSettings, '');
  };

  const onDeleteRuleOverride = (ruleOverride: MetaAdsRuleOverride) => {
    const targetKey = getRuleOverrideKey(ruleOverride);
    const nextSettings = {
      ...settings,
      ruleOverrides: (settings.ruleOverrides ?? []).filter(
        (currentRuleOverride) => getRuleOverrideKey(currentRuleOverride) !== targetKey,
      ),
    };
    saveSettings(nextSettings, '');
  };

  const onRuleGroupRuleChange = (key: keyof MetaAdsRulesState, value: string) => {
    setRuleGroupDraft((current) =>
      current
        ? {
            ...current,
            rules: {
              ...current.rules,
              [key]: value === '' ? undefined : Number(value),
            },
          }
        : current,
    );
  };

  const onRuleGroupRuleTextChange = (key: keyof MetaAdsRulesState, value: string) => {
    setRuleGroupDraft((current) =>
      current
        ? {
            ...current,
            rules: {
              ...current.rules,
              [key]: value,
            },
          }
        : current,
    );
  };

  const onAccountProfileChange = (value: MetaAdsSettingsState['accountProfile']) => {
    const profile = value ?? 'custom';
    const nextSettings = {
      ...settings,
      accountProfile: profile,
      rules: {
        ...settings.rules,
        ...(accountProfileRules[profile] ?? {}),
      },
    };
    setSettings(nextSettings);
    setRuleGroupDraft((current) =>
      current?.scope === 'global'
        ? {
            ...current,
            rules: nextSettings.rules,
          }
        : current,
    );
  };

  const onRuleGroupCreativeRuleChange = (
    key: keyof Required<MetaAdsCreativeRules>,
    value: string,
  ) => {
    setRuleGroupDraft((current) =>
      current
        ? {
            ...current,
            creativeRules: {
              ...current.creativeRules,
              [key]: Number(value),
            },
          }
        : current,
    );
  };

  const onSaveRuleGroup = () => {
    if (!ruleGroupDraft) {
      return;
    }
    if (!hasRulePerformanceMetric(ruleGroupDraft.rules)) {
      showToast({
        message: localize('com_ui_project_meta_ads_metric_required'),
        status: 'error',
      });
      return;
    }
    if (ruleGroupDraft.scope === 'global') {
      const nextSettings = {
        ...settings,
        rules: ruleGroupDraft.rules,
        creativeRules: ruleGroupDraft.creativeRules,
      };
      saveSettings(nextSettings, '', () => setRuleGroupDraft(null));
      return;
    }
    if (ruleGroupDraft.scope === 'override') {
      const targetKey = ruleGroupDraft.overrideKey;
      const nextSettings = {
        ...settings,
        ruleOverrides: (settings.ruleOverrides ?? []).map((ruleOverride) =>
          getRuleOverrideKey(ruleOverride) === targetKey
            ? {
                ...ruleOverride,
                entityName: ruleGroupDraft.name.trim() || ruleGroupDraft.entityName,
                rules: ruleGroupDraft.rules,
              }
            : ruleOverride,
        ),
      };
      saveSettings(nextSettings, '', () => setRuleGroupDraft(null));
      return;
    }
    if (ruleGroupDraft.entityIds.length === 0) {
      return;
    }
    const nextGroup: MetaAdsRuleGroup = {
      id: ruleGroupDraft.id ?? `${ruleGroupDraft.entityLevel}-${Date.now()}`,
      name:
        ruleGroupDraft.name.trim() || localize('com_ui_project_meta_ads_rule_group_default_name'),
      entityLevel: ruleGroupDraft.entityLevel,
      entityIds: ruleGroupDraft.entityIds,
      enabled:
        ruleGroupDraft.id == null
          ? true
          : (settings.ruleGroups ?? []).find((group) => group.id === ruleGroupDraft.id)?.enabled,
      rules: ruleGroupDraft.rules,
    };
    const existingGroups = settings.ruleGroups ?? [];
    const nextSettings = {
      ...settings,
      ruleGroups: ruleGroupDraft.id
        ? existingGroups.map((group) => (group.id === ruleGroupDraft.id ? nextGroup : group))
        : [...existingGroups, nextGroup],
    };
    saveSettings(nextSettings, '', () => setRuleGroupDraft(null));
  };

  const onRunAnalysis = () => {
    setRunErrorMessage(null);
    runAnalysis.mutate(project.projectId, {
      onSuccess: () => {
        statusQuery.refetch();
        showToast({
          message: localize('com_ui_project_meta_ads_run_success'),
          status: 'success',
        });
      },
      onError: (error) => {
        const message = getRequestErrorMessage(
          error,
          localize('com_ui_project_meta_ads_run_failed'),
        );
        setRunErrorMessage(message);
        showToast({ message, status: 'error' });
        logger.error('MetaAds', 'Failed to run project Meta Ads analysis', {
          projectId: project.projectId,
          error,
        });
      },
    });
  };

  const onToggleCampaign = (campaign: ProjectMetaAdsCampaignSummary) => {
    setSelectedEntityIds((current) => {
      const campaignId = `campaign:${campaign.campaignId}`;
      const adSetIds = campaign.adSets.map((adset) => `adset:${adset.entityId}`);
      const campaignIds = [campaignId, ...adSetIds];
      if (current.includes(campaignId)) {
        return current.filter((selectedId) => !campaignIds.includes(selectedId));
      }
      const next = new Set(current);
      campaignIds.forEach((selectedId) => next.add(selectedId));
      return Array.from(next).slice(0, MAX_META_ADS_CHAT_BRIEF_ENTITIES);
    });
  };

  const onToggleAdSet = (entityId: string) => {
    setSelectedEntityIds((current) => {
      const id = `adset:${entityId}`;
      return current.includes(id)
        ? current.filter((selectedId) => selectedId !== id)
        : [...current, id].slice(0, MAX_META_ADS_CHAT_BRIEF_ENTITIES);
    });
  };

  const onToggleCampaignExpanded = (campaign: ProjectMetaAdsCampaignSummary) => {
    if (campaign.budgetMode === 'ABO') {
      setCollapsedAboCampaignIds((current) =>
        current.includes(campaign.campaignId)
          ? current.filter((id) => id !== campaign.campaignId)
          : [...current, campaign.campaignId],
      );
      return;
    }

    setExpandedCampaignIds((current) =>
      current.includes(campaign.campaignId)
        ? current.filter((id) => id !== campaign.campaignId)
        : [...current, campaign.campaignId],
    );
  };

  const onToggleAdSetAds = (adSetId: string) => {
    setCollapsedAdSetAdsIds((current) =>
      current.includes(adSetId) ? current.filter((id) => id !== adSetId) : [...current, adSetId],
    );
  };

  const onCustomSinceChange = (value: string) => {
    setCustomSince(value);
    if (value && customUntil && value > customUntil) {
      setCustomUntil(value);
    }
  };

  const onCustomUntilChange = (value: string) => {
    setCustomUntil(value);
    if (value && customSince && value < customSince) {
      setCustomSince(value);
    }
  };

  const onApplyCustomPeriod = () => {
    setAppliedCustomSince(customSince);
    setAppliedCustomUntil(customUntil);
  };

  const onExpandAllRows = () => {
    setCollapsedAboCampaignIds([]);
    setExpandedCampaignIds(
      campaigns
        .filter((campaign) => campaign.budgetMode !== 'ABO')
        .map((campaign) => campaign.campaignId),
    );
    setCollapsedAdSetAdsIds([]);
  };

  const onCollapseAllRows = () => {
    setCollapsedAboCampaignIds(
      campaigns
        .filter((campaign) => campaign.budgetMode === 'ABO')
        .map((campaign) => campaign.campaignId),
    );
    setExpandedCampaignIds([]);
    setCollapsedAdSetAdsIds(
      campaigns.flatMap((campaign) => campaign.adSets.map((adset) => adset.entityId)),
    );
  };

  const onOpenTrafficAgentChat = () => {
    if (!canOpenTrafficAgentChat || !statusQuery.data) {
      return;
    }
    const brief = buildMetaAdsChatBrief({
      project,
      snapshots: latestSnapshots,
      campaigns,
      recommendations: statusQuery.data.recommendations,
      changes: statusQuery.data.changes,
      selectedEntityIds,
    });
    const storageKey = createMetaAdsBriefStorageKey();
    sessionStorage.setItem(storageKey, JSON.stringify(brief));

    const params = new URLSearchParams({
      project_id: project.projectId,
      meta_ads_brief: storageKey,
    });
    const trafficAgentId = startupConfigQuery.data?.interface?.metaAdsTrafficAgentId;
    if (trafficAgentId) {
      params.set('agent_id', trafficAgentId);
    }
    navigate(`/c/new?${params.toString()}`);
  };

  const openSettingsDrawer = (drawer: Exclude<SettingsDrawer, null>) => {
    setSettingsDrawer(drawer);
    setSettingsDraft(settings);
    setSettingsDraftToken('');
    setShowSettingsDraftToken(false);
    setCredentialsDialogOpen(false);
    setTenantAccessToken('');
    setShowTenantAccessToken(false);
  };

  const closeSettingsDrawer = () => {
    setSettingsDrawer(null);
    setSettingsDraft(null);
    setSettingsDraftToken('');
    setShowSettingsDraftToken(false);
    setCredentialsDialogOpen(false);
    setTenantAccessToken('');
    setShowTenantAccessToken(false);
  };

  const openCredentialsDialog = () => {
    setCredentialsDialogOpen(true);
    setSettingsDraftToken('');
    setTenantAccessToken('');
    setShowSettingsDraftToken(false);
    setShowTenantAccessToken(false);
  };

  const closeCredentialsDialog = () => {
    setCredentialsDialogOpen(false);
    setSettingsDraftToken('');
    setTenantAccessToken('');
    setShowSettingsDraftToken(false);
    setShowTenantAccessToken(false);
  };

  const onSaveSettingsDrawer = () => {
    if (!settingsDraft) {
      return;
    }
    saveSettings(settingsDraft, settingsDraftToken, closeSettingsDrawer);
  };

  const onSaveProjectToken = () => {
    if (!settingsDraft) {
      return;
    }
    saveSettings(settingsDraft, settingsDraftToken, closeCredentialsDialog);
  };

  const onSaveTenantToken = () => {
    const trimmedToken = tenantAccessToken.trim();
    if (!trimmedToken) {
      return;
    }
    updateTenantToken.mutate(
      {
        projectId: project.projectId,
        metaAccessToken: trimmedToken,
      },
      {
        onSuccess: () => {
          setTenantAccessToken('');
          setShowTenantAccessToken(false);
          statusQuery.refetch();
          showToast({ message: localize('com_ui_saved'), status: 'success' });
        },
        onError: (error) => {
          const message =
            error instanceof Error ? error.message : localize('com_ui_error_save_admin_settings');
          showToast({ message, status: 'error' });
        },
      },
    );
  };

  const tableColumns = getTableViewColumns(tableView, isEcommerceDashboard).map(
    (key) => tableColumnMap[key],
  );
  const tableColumnCount = tableColumns.length + 2;
  const summaryCards = isEcommerceDashboard
    ? [
        {
          labelKey: 'com_ui_project_meta_ads_average_roas' as TranslationKeys,
          value: formatMetric(summaryAverageRoas),
          tone: 'border-l-emerald-300/35',
        },
        {
          labelKey: 'com_ui_project_meta_ads_total_spend' as TranslationKeys,
          value: formatMoney(summaryTotalSpend, currency),
          tone: 'border-l-amber-300/35',
        },
        {
          labelKey: 'com_ui_project_meta_ads_total_results' as TranslationKeys,
          value: formatMetric(summaryTotalResults),
          tone: 'border-l-sky-300/30',
          context: summaryMetricContext,
          clickable: summaryResultTypeOptions.length > 0,
        },
        {
          labelKey: 'com_ui_project_meta_ads_average_cost' as TranslationKeys,
          value: formatMoney(summaryAverageCost, currency),
          tone: 'border-l-rose-300/30',
          context: summaryMetricContext,
        },
      ]
    : [
        {
          labelKey: 'com_ui_project_meta_ads_total_spend' as TranslationKeys,
          value: formatMoney(summaryTotalSpend, currency),
          tone: 'border-l-amber-300/35',
        },
        {
          labelKey: 'com_ui_project_meta_ads_total_results' as TranslationKeys,
          value: formatMetric(summaryTotalResults),
          tone: 'border-l-emerald-300/35',
          context: summaryMetricContext,
          clickable: summaryResultTypeOptions.length > 0,
        },
        {
          labelKey: 'com_ui_project_meta_ads_average_cost' as TranslationKeys,
          value: formatMoney(summaryAverageCost, currency),
          tone: 'border-l-sky-300/30',
          context: summaryMetricContext,
        },
        {
          labelKey: 'com_ui_project_meta_ads_average_frequency' as TranslationKeys,
          value: formatMetric(summaryAverageFrequency),
          tone: 'border-l-rose-300/30',
          context: scopedObjectiveSummary
            ? getObjectiveLabel(scopedObjectiveSummary.objective, localize)
            : undefined,
        },
      ];
  const renderEvolutionDeltaClass = (
    value: number | null | undefined,
    improvesWhenNegative = false,
  ) => {
    if (value == null || Number.isNaN(value) || Math.abs(value) <= 0.005) {
      return 'text-[#d8d0c2]';
    }
    return value < 0 === improvesWhenNegative ? 'text-emerald-200' : 'text-rose-200';
  };
  const renderRankMedia = (item: MetaAdsBiRankItem, size: 'sm' | 'lg' = 'sm') => {
    const thumbnails = item.thumbnailUrls?.slice(0, 3) ?? [];
    const isLarge = size === 'lg';
    const frameClass = isLarge ? 'h-28 w-40' : 'h-12 w-16';
    const emptyClass = isLarge ? 'text-xs' : 'text-[9px]';
    if (thumbnails.length === 0) {
      return (
        <div
          data-testid="meta-ads-rank-media"
          className={`${frameClass} flex shrink-0 items-center justify-center border border-white/10 bg-[#1a1712] px-2 text-center ${emptyClass} text-[#81796b]`}
        >
          {localize('com_ui_project_meta_ads_no_creative_media')}
        </div>
      );
    }
    if (thumbnails.length === 1) {
      return (
        <div
          data-testid="meta-ads-rank-media"
          className={`${frameClass} shrink-0 overflow-hidden border border-white/10 bg-[#1a1712]`}
        >
          <img
            src={thumbnails[0]}
            alt=""
            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
          />
        </div>
      );
    }
    return (
      <div data-testid="meta-ads-rank-media" className={`${frameClass} relative shrink-0`}>
        {thumbnails.map((thumbnailUrl, index) => {
          const offset = isLarge ? index * 12 : index * 6;
          const rotation =
            index === 0
              ? '-rotate-3 group-hover:-rotate-6 group-hover:-translate-x-1'
              : index === 1
                ? 'rotate-1 group-hover:translate-y-0.5'
                : 'rotate-3 group-hover:rotate-6 group-hover:translate-x-1';
          return (
            <div
              key={thumbnailUrl}
              className={`absolute inset-y-0 overflow-hidden border border-white/10 bg-[#1a1712] shadow-[0_18px_30px_-24px_rgba(0,0,0,0.85)] transition duration-300 ease-out group-hover:border-white/20 group-hover:shadow-[0_22px_34px_-22px_rgba(0,0,0,0.95)] ${rotation}`}
              style={{ left: offset, right: Math.max(0, (thumbnails.length - 1 - index) * offset) }}
            >
              <img
                src={thumbnailUrl}
                alt=""
                className="h-full w-full object-cover transition duration-300 ease-out group-hover:scale-105"
              />
            </div>
          );
        })}
      </div>
    );
  };
  const renderBiRankingCard = (
    titleKey: TranslationKeys,
    items: Array<MetaAdsBiRankItem | ProjectMetaAdsRankingItem>,
    testId: string,
    emptyMessageKey: TranslationKeys = 'com_ui_project_meta_ads_bi_no_rankings',
  ) => {
    const sortColumns: Array<[BiRankingSortKey, TranslationKeys]> = [
      ['spend', 'com_ui_project_meta_ads_spend'],
      ['resultCount', 'com_ui_project_meta_ads_results'],
      ['cpa', 'com_ui_project_meta_ads_cpa'],
      ['ctr', 'com_ui_project_meta_ads_ctr'],
      ['frequency', 'com_ui_project_meta_ads_frequency'],
    ];
    const onSort = (key: BiRankingSortKey) => {
      setBiRankingSort((current) => ({
        key,
        direction:
          current.key === key
            ? current.direction === 'asc'
              ? 'desc'
              : 'asc'
            : key === 'cpa'
              ? 'asc'
              : 'desc',
      }));
    };
    return (
      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white/80 shadow-[0_18px_58px_-46px_rgba(15,23,42,0.42)] backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.045]">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200/70 px-4 py-3 dark:border-white/10">
          <h5 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-600 dark:text-slate-300">
            {localize(titleKey)}
          </h5>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:bg-white/[0.06] dark:text-slate-400">
            {biRankingsQuery.isFetching
              ? localize('com_ui_project_meta_ads_loading')
              : localize('com_ui_project_meta_ads_bi_rank_by')}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table data-testid={testId} className="w-full min-w-[58rem] text-left text-xs">
            <thead className="border-b border-slate-200/70 bg-slate-50/70 text-[10px] uppercase tracking-[0.12em] text-slate-500 dark:border-white/10 dark:bg-white/[0.035] dark:text-slate-400">
              <tr>
                <th className="w-12 px-3 py-2">#</th>
                <th className="px-3 py-2">{localize('com_ui_project_meta_ads_name')}</th>
                <th className="px-3 py-2">
                  {localize('com_ui_project_meta_ads_target_result_type')}
                </th>
                {sortColumns.map(([key, labelKey]) => (
                  <th key={key} className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => onSort(key)}
                      className="font-semibold uppercase tracking-[0.12em] text-slate-500 transition hover:text-teal-700 dark:text-slate-400 dark:hover:text-teal-200"
                    >
                      {localize(labelKey)}
                      {biRankingSort.key === key
                        ? biRankingSort.direction === 'asc'
                          ? ' ↑'
                          : ' ↓'
                        : ''}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/70 dark:divide-white/10">
              {items.length > 0 ? (
                items.map((item, index) => {
                  const displayName = cleanDashboardName(item.name, item.id);
                  return (
                    <tr
                      key={`${item.level}:${item.id}`}
                      onClick={() => setSelectedBiRankItem(item as MetaAdsBiRankItem)}
                      className="cursor-pointer transition duration-200 odd:bg-slate-50/70 hover:bg-teal-50/70 dark:odd:bg-white/[0.025] dark:hover:bg-teal-300/[0.08]"
                    >
                      <td className="px-3 py-3 font-mono text-slate-400 dark:text-slate-500">
                        #{index + 1}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex min-w-0 items-center gap-3">
                          {renderRankMedia(item as MetaAdsBiRankItem)}
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                              {displayName}
                            </div>
                            {'parentName' in item && item.parentName && (
                              <div className="truncate text-[10px] text-slate-500 dark:text-slate-400">
                                {item.parentName}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-slate-500 dark:text-slate-400">
                        {getResultTypeLabel(item.resultType, localize)}
                      </td>
                      <td className="px-3 py-3 text-right font-mono text-slate-900 dark:text-white">
                        {formatMoney(item.spend, currency)}
                      </td>
                      <td className="px-3 py-3 text-right font-mono text-slate-900 dark:text-white">
                        {formatMetric(item.resultCount)}
                      </td>
                      <td className="px-3 py-3 text-right font-mono text-slate-900 dark:text-white">
                        {formatRankingCost(getRankEfficiency(item as MetaAdsBiRankItem), currency)}
                      </td>
                      <td className="px-3 py-3 text-right font-mono text-slate-900 dark:text-white">
                        {formatPercent(item.ctr)}
                      </td>
                      <td className="px-3 py-3 text-right font-mono text-slate-900 dark:text-white">
                        {formatMetric(item.frequency)}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="px-3 py-5 text-sm text-slate-500 dark:text-slate-400">
                    {localize(emptyMessageKey)}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };
  const getTableRowClass = (
    rowIndex: number,
    level: 'campaign' | 'adset' | 'ad',
    isClickable = false,
  ) => {
    const stripeClass =
      rowIndex % 2 === 0
        ? 'bg-white/75 dark:bg-white/[0.035]'
        : 'bg-slate-50/70 dark:bg-white/[0.06]';
    const levelClass =
      level === 'campaign'
        ? 'font-semibold text-slate-950 dark:text-white'
        : level === 'adset'
          ? 'text-slate-700 dark:text-slate-300'
          : 'text-slate-500 dark:text-slate-400';
    const cursorClass = isClickable ? 'cursor-pointer' : '';

    return `group ${cursorClass} ${stripeClass} ${levelClass} border-b border-slate-200/70 transition-colors duration-200 hover:bg-teal-50/70 dark:border-white/5 dark:hover:bg-teal-300/[0.08]`;
  };

  const renderEmptyCell = (column: TableColumn) => (
    <td
      key={column.key}
      className={`px-2 py-2 ${
        column.align === 'right' ? 'text-right font-mono tabular-nums' : ''
      } text-slate-400 dark:text-slate-600`}
    >
      -
    </td>
  );

  const renderFrequencyValue = (source: {
    frequency?: number | null;
    impressions?: number | null;
    reach?: number | null;
  }) => {
    const hasAuditMetrics = source.impressions != null && source.reach != null;
    const title = hasAuditMetrics
      ? `${localize('com_ui_project_meta_ads_impressions')}: ${formatIntegerMetric(
          source.impressions,
        )} / ${localize('com_ui_project_meta_ads_reach')}: ${formatIntegerMetric(source.reach)}`
      : undefined;
    return <span title={title}>{formatMetric(source.frequency)}</span>;
  };

  const renderLevelCell = (column: TableColumn, labelKey: TranslationKeys) => (
    <td key={column.key} className="px-3 py-3 text-slate-500 dark:text-slate-400">
      <span className="inline-flex rounded-lg border border-slate-200 bg-white/80 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] dark:border-white/10 dark:bg-white/[0.055]">
        {localize(labelKey)}
      </span>
    </td>
  );

  const renderNameTooltip = (value: string) => (
    <span
      aria-hidden="true"
      data-tooltip={value}
      className="pointer-events-none absolute bottom-full left-0 z-[1000] mb-2 hidden max-w-[640px] whitespace-normal rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium leading-5 text-slate-800 shadow-xl before:content-[attr(data-tooltip)] group-focus-within:block group-hover:block dark:border-teal-300/25 dark:bg-[#101827] dark:text-teal-100"
    />
  );

  const renderEvolutionNameCell = (name: string) => (
    <td className="max-w-64 px-3 py-2.5 text-sm font-medium text-slate-900 focus-within:z-50 hover:z-50 dark:text-white">
      <div className="group relative min-w-0">
        <div className="truncate">{name}</div>
        {renderNameTooltip(name)}
      </div>
    </td>
  );

  const renderStatusBadge = (status: string | undefined) => {
    const normalizedStatus = typeof status === 'string' ? status.trim().toUpperCase() : '';
    if (!normalizedStatus || normalizedStatus === 'ACTIVE') {
      return null;
    }
    return (
      <span className="ml-2 inline-flex shrink-0 border border-rose-300/30 bg-rose-500/10 px-1.5 py-0.5 align-middle text-[9px] font-semibold uppercase tracking-[0.12em] text-rose-100">
        {normalizedStatus}
      </span>
    );
  };

  const renderBudgetBadge = (value: number | null | undefined, onClick?: () => void) => {
    const content = (
      <>
        <span className="h-1.5 w-1.5 rounded-full bg-amber-300 shadow-[0_0_12px_rgba(252,211,77,0.7)]" />
        <span>{formatMoney(value, currency)}</span>
      </>
    );

    if (!onClick) {
      return (
        <span className="inline-flex items-center gap-2 rounded-xl border border-slate-200/80 bg-white/70 px-3 py-1.5 font-mono text-xs font-semibold tabular-nums text-slate-800 shadow-[0_10px_28px_-24px_rgba(15,23,42,0.55)] dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200">
          {content}
        </span>
      );
    }

    return (
      <button
        type="button"
        disabled={!canUseMetaAdsActions}
        onClick={onClick}
        className="inline-flex items-center gap-2 rounded-xl border border-amber-300/45 bg-amber-300/10 px-3 py-1.5 font-mono text-xs font-semibold tabular-nums text-amber-900 shadow-[0_14px_30px_-24px_rgba(245,158,11,0.75)] transition duration-200 hover:-translate-y-0.5 hover:border-amber-300/70 hover:bg-amber-300/15 focus:outline-none focus:ring-2 focus:ring-amber-300/40 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-55 dark:border-amber-300/25 dark:bg-amber-300/[0.08] dark:text-[#fff3d7] dark:shadow-[0_12px_26px_-22px_rgba(245,158,11,0.95)] dark:hover:border-amber-300/60 dark:hover:bg-amber-300/[0.14]"
      >
        {content}
      </button>
    );
  };

  const renderEntityStatusToggleCell = ({
    entityLevel,
    entityId,
    entityName,
    status,
  }: {
    entityLevel: ProjectMetaAdsEntityStatusLevel;
    entityId: string;
    entityName?: string;
    status?: string;
  }) => {
    const normalizedStatus = typeof status === 'string' ? status.trim().toUpperCase() : '';
    const isActive = normalizedStatus === 'ACTIVE';
    const canToggle = isActive || normalizedStatus === 'PAUSED';
    const labelKey: TranslationKeys = isActive
      ? 'com_ui_project_meta_ads_deactivate_ad'
      : 'com_ui_project_meta_ads_activate_ad';

    return (
      <td
        key="adStatus"
        className={`sticky left-20 z-30 px-2 py-2 align-middle ${metaAdsStickyCell}`}
      >
        {canToggle && (
          <button
            type="button"
            role="switch"
            aria-checked={isActive}
            aria-label={localize(labelKey)}
            title={localize(labelKey)}
            disabled={!canUseMetaAdsActions || updateEntityStatus.isLoading}
            onClick={(event) =>
              onOpenEntityStatusConfirmation(event, {
                entityLevel,
                entityId,
                entityName,
                status,
              })
            }
            className={`relative inline-flex h-5 w-9 items-center rounded-full border transition duration-200 focus:outline-none focus:ring-2 focus:ring-teal-300/40 active:scale-95 disabled:cursor-not-allowed disabled:opacity-45 ${
              isActive
                ? 'border-teal-300/60 bg-teal-400/25 hover:border-teal-200/70 hover:bg-teal-400/30'
                : 'border-slate-300 bg-slate-200/70 hover:border-rose-300/45 hover:bg-rose-100 dark:border-white/15 dark:bg-white/[0.055] dark:hover:border-rose-200/35 dark:hover:bg-rose-300/10'
            }`}
          >
            <span
              aria-hidden="true"
              className={`h-3.5 w-3.5 rounded-full bg-white shadow-[0_4px_12px_-8px_rgba(0,0,0,0.9)] transition duration-200 dark:bg-slate-50 ${
                isActive ? 'translate-x-[18px]' : 'translate-x-0.5'
              }`}
            />
          </button>
        )}
      </td>
    );
  };

  const renderCampaignNameCell = (campaign: ProjectMetaAdsCampaignSummary) => (
    <td
      key="name"
      className={`sticky left-32 z-30 border-l-2 border-teal-300 px-3 py-3 font-semibold text-slate-950 focus-within:z-50 hover:z-50 dark:text-white ${metaAdsStickyCell}`}
    >
      <div className="group relative min-w-0">
        <div className="truncate">
          {campaign.campaignName ?? campaign.campaignId}
          {renderStatusBadge(campaign.status)}
        </div>
        {renderNameTooltip(campaign.campaignName ?? campaign.campaignId)}
      </div>
    </td>
  );

  const renderAdSetNameCell = (adset: ProjectMetaAdsCampaignSummary['adSets'][number]) => (
    <td
      key="name"
      className={`sticky left-32 z-30 border-l-2 border-teal-300/35 px-3 py-3 pl-6 text-slate-700 focus-within:z-50 hover:z-50 dark:text-slate-200 ${metaAdsStickyCell}`}
    >
      <div className="group relative min-w-0">
        <div className="truncate">
          {adset.entityName ?? adset.entityId}
          {renderStatusBadge(adset.status)}
        </div>
        {renderNameTooltip(adset.entityName ?? adset.entityId)}
      </div>
    </td>
  );

  const renderAdNameCell = (ad: ProjectMetaAdsAdSummary) => {
    const mediaUrl = getAdThumbnailUrl(ad);
    const openAdPreview = (event: MouseEvent<HTMLElement>) => {
      event.stopPropagation();
      setSelectedAdPreview(ad);
    };
    return (
      <td
        key="name"
        className={`sticky left-32 z-30 border-l-2 border-slate-200 px-3 py-3 pl-9 focus-within:z-50 hover:z-50 dark:border-white/10 ${metaAdsStickyCell}`}
      >
        <div className="group relative flex min-w-0 items-center gap-2">
          <button
            type="button"
            aria-label={localize('com_ui_project_meta_ads_open_meta_ads')}
            title={localize('com_ui_project_meta_ads_open_meta_ads')}
            onClick={openAdPreview}
            className="relative h-10 w-16 shrink-0 overflow-hidden border border-white/10 bg-[#242016] text-left shadow-[0_12px_30px_-24px_rgba(245,158,11,0.65)] focus:outline-none focus:ring-2 focus:ring-amber-300/60"
          >
            {mediaUrl ? (
              <img
                src={mediaUrl}
                alt={ad.adName ?? ad.title ?? ad.adId}
                className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center px-1 text-center text-[10px] text-[#8a8172]">
                {localize('com_ui_project_meta_ads_no_creative_media')}
              </div>
            )}
            <span className="absolute inset-0 flex items-center justify-center gap-1 bg-black/70 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
              <ArrowSquareOut className="h-3.5 w-3.5 text-white" aria-hidden="true" />
            </span>
          </button>
          <button type="button" onClick={openAdPreview} className="min-w-0 text-left">
            <div className="truncate text-sm font-medium text-slate-900 dark:text-white">
              {ad.adName ?? ad.title ?? ad.adId}
            </div>
            <div className="truncate text-xs text-slate-500 dark:text-slate-400">
              {ad.title ?? ad.body ?? '-'}
            </div>
          </button>
          {renderNameTooltip(ad.adName ?? ad.title ?? ad.adId)}
        </div>
      </td>
    );
  };

  const renderCampaignActionCell = (
    column: TableColumn,
    recommendation: ProjectMetaAdsRecommendation | undefined,
    duplicate?: DuplicateDraft,
  ) => {
    const menuKey = duplicate ? `${duplicate.entityLevel}:${duplicate.entityId}` : '';
    const duplicateLabelKey: TranslationKeys =
      duplicate?.entityLevel === 'campaign'
        ? 'com_ui_project_meta_ads_duplicate_campaign'
        : 'com_ui_project_meta_ads_duplicate_adset';
    return (
      <td
        key={column.key}
        className={`px-2 py-2 ${actionMenuKey === menuKey ? 'relative z-[1000]' : ''}`}
      >
        <div className="relative flex items-center gap-1">
          {canApplyRecommendation(recommendation) && (
            <button
              type="button"
              disabled={!canUseMetaAdsActions || applyRecommendation.isLoading}
              onClick={() => {
                if (recommendation) {
                  onApply(recommendation);
                }
              }}
              className="h-7 rounded-lg border border-emerald-300/35 bg-emerald-300/10 px-2 text-[11px] font-semibold text-emerald-700 transition duration-200 hover:bg-emerald-300/15 disabled:cursor-not-allowed disabled:opacity-60 dark:text-emerald-100"
            >
              {localize('com_ui_project_meta_ads_apply')}
            </button>
          )}
          {duplicate && (
            <>
              <button
                type="button"
                aria-label={localize('com_ui_project_meta_ads_actions')}
                aria-expanded={actionMenuKey === menuKey}
                disabled={!canUseMetaAdsActions}
                onClick={(event) => {
                  event.stopPropagation();
                  setActionMenuKey((current) => (current === menuKey ? null : menuKey));
                }}
                className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200/80 bg-white text-slate-500 shadow-[0_10px_24px_-22px_rgba(15,23,42,0.55)] transition duration-200 hover:border-teal-300/60 hover:bg-teal-50 hover:text-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-300/35 disabled:cursor-not-allowed disabled:opacity-45 dark:border-white/10 dark:bg-[#172033] dark:text-slate-300 dark:hover:bg-[#183247] dark:hover:text-teal-100"
              >
                <DotsThreeVertical className="h-4 w-4" aria-hidden="true" />
              </button>
              {actionMenuKey === menuKey && (
                <div className="absolute right-0 top-9 z-[1200] min-w-56 overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-1.5 shadow-[0_22px_60px_-34px_rgba(15,23,42,0.75)] dark:border-white/10 dark:bg-[#121a2b] dark:shadow-[0_22px_60px_-34px_rgba(0,0,0,0.95)]">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onOpenDuplicateDraft(duplicate);
                    }}
                    className="flex w-full items-center gap-2 whitespace-nowrap rounded-xl px-3 py-2.5 text-left text-xs font-semibold text-slate-800 transition hover:bg-teal-50 hover:text-teal-800 dark:text-slate-100 dark:hover:bg-[#183247] dark:hover:text-teal-100"
                  >
                    <Copy
                      className="h-3.5 w-3.5 text-teal-600 dark:text-teal-200"
                      aria-hidden="true"
                    />
                    {localize(duplicateLabelKey)}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </td>
    );
  };

  const renderCampaignCell = (
    column: TableColumn,
    campaign: ProjectMetaAdsCampaignSummary,
    recommendation: ProjectMetaAdsRecommendation | undefined,
  ) => {
    if (column.key === 'level') {
      return renderLevelCell(column, 'com_ui_project_meta_ads_level_campaign');
    }
    if (column.key === 'adStatus') {
      return renderEntityStatusToggleCell({
        entityLevel: 'campaign',
        entityId: campaign.campaignId,
        entityName: campaign.campaignName,
        status: campaign.status,
      });
    }
    if (column.key === 'name') {
      return renderCampaignNameCell(campaign);
    }
    if (column.key === 'budget') {
      return (
        <td
          key={column.key}
          className="px-2 py-2 text-right font-mono tabular-nums text-text-secondary"
        >
          {campaign.editableBudgetLevel === 'campaign'
            ? renderBudgetBadge(campaign.dailyBudget, () =>
                onOpenBudgetEditor({
                  entityLevel: 'campaign',
                  entityId: campaign.campaignId,
                  entityName: campaign.campaignName,
                  currentBudget: campaign.dailyBudget,
                }),
              )
            : renderBudgetBadge(campaign.dailyBudget)}
        </td>
      );
    }
    if (column.key === 'objective') {
      return (
        <td key={column.key} className="truncate px-2 py-2 text-text-secondary">
          {getObjectiveLabel(campaign.objective, localize)}
        </td>
      );
    }
    if (column.key === 'budgetMode') {
      return (
        <td key={column.key} className="px-2 py-2 text-text-secondary">
          {campaign.budgetMode ?? '-'}
        </td>
      );
    }
    if (column.key === 'frequency') {
      return (
        <td
          key={column.key}
          className="px-2 py-2 text-right font-mono tabular-nums text-text-secondary"
        >
          {renderFrequencyValue(campaign)}
        </td>
      );
    }
    if (column.key === 'result') {
      return (
        <td
          key={column.key}
          className="px-2 py-2 text-right font-mono tabular-nums text-text-secondary"
        >
          {formatMetric(campaign.resultCount)}
        </td>
      );
    }
    if (column.key === 'cpa') {
      return (
        <td
          key={column.key}
          className="px-2 py-2 text-right font-mono tabular-nums text-text-secondary"
        >
          {formatMoney(campaign.cpa, currency)}
        </td>
      );
    }
    if (column.key === 'roas') {
      return (
        <td
          key={column.key}
          className="px-2 py-2 text-right font-mono tabular-nums text-text-secondary"
        >
          {formatMetric(campaign.roas)}
        </td>
      );
    }
    if (column.key === 'spend') {
      return (
        <td
          key={column.key}
          className="px-2 py-2 text-right font-mono tabular-nums text-text-secondary"
        >
          {formatMoney(campaign.spend, currency)}
        </td>
      );
    }
    if (column.key === 'ctr') {
      return (
        <td
          key={column.key}
          className="px-2 py-2 text-right font-mono tabular-nums text-text-secondary"
        >
          {formatMetric(campaign.ctr)}
        </td>
      );
    }
    if (column.key === 'clicks') {
      return (
        <td
          key={column.key}
          className="px-2 py-2 text-right font-mono tabular-nums text-text-secondary"
        >
          {formatMetric(campaign.clicks)}
        </td>
      );
    }
    if (column.key === 'video') {
      return (
        <td
          key={column.key}
          className="px-2 py-2 text-right font-mono tabular-nums text-text-secondary"
        >
          {formatMetric(campaign.videoP75Watched)}
        </td>
      );
    }
    if (column.key === 'rule') {
      return (
        <td key={column.key} className="truncate px-2 py-2 text-text-secondary">
          {getEntityRuleLabel('campaign', campaign.campaignId)}
        </td>
      );
    }
    if (column.key === 'recommendation') {
      return (
        <td key={column.key} className="px-2 py-2 text-text-secondary">
          <div className="truncate">{getRecommendationLabel(recommendation, currency)}</div>
          {recommendation?.reason && (
            <div className="truncate text-text-tertiary">{recommendation.reason}</div>
          )}
        </td>
      );
    }
    return renderCampaignActionCell(column, recommendation, {
      entityLevel: 'campaign',
      entityId: campaign.campaignId,
      entityName: campaign.campaignName,
      targetName: getDuplicateName(campaign.campaignName ?? campaign.campaignId),
      status: campaign.status,
      budget: campaign.dailyBudget,
    });
  };

  const renderAdSetCell = (
    column: TableColumn,
    campaign: ProjectMetaAdsCampaignSummary,
    adset: ProjectMetaAdsCampaignSummary['adSets'][number],
    recommendation: ProjectMetaAdsRecommendation | undefined,
  ) => {
    if (column.key === 'level') {
      return renderLevelCell(column, 'com_ui_project_meta_ads_level_ad_set');
    }
    if (column.key === 'adStatus') {
      return renderEntityStatusToggleCell({
        entityLevel: 'adset',
        entityId: adset.entityId,
        entityName: adset.entityName,
        status: adset.status,
      });
    }
    if (column.key === 'name') {
      return renderAdSetNameCell(adset);
    }
    if (column.key === 'budget') {
      return (
        <td
          key={column.key}
          className="px-2 py-2 text-right font-mono tabular-nums text-text-secondary"
        >
          {campaign.editableBudgetLevel === 'adset'
            ? renderBudgetBadge(adset.dailyBudget, () =>
                onOpenBudgetEditor({
                  entityLevel: 'adset',
                  entityId: adset.entityId,
                  entityName: adset.entityName,
                  currentBudget: adset.dailyBudget,
                }),
              )
            : renderBudgetBadge(adset.dailyBudget)}
        </td>
      );
    }
    if (column.key === 'objective') {
      return (
        <td key={column.key} className="truncate px-2 py-2 text-text-secondary">
          {getObjectiveLabel(campaign.objective, localize)}
        </td>
      );
    }
    if (column.key === 'budgetMode') {
      return (
        <td key={column.key} className="px-2 py-2 text-text-secondary">
          {campaign.budgetMode ?? '-'}
        </td>
      );
    }
    if (column.key === 'frequency') {
      return (
        <td
          key={column.key}
          className="px-2 py-2 text-right font-mono tabular-nums text-text-secondary"
        >
          {renderFrequencyValue(adset)}
        </td>
      );
    }
    if (column.key === 'result') {
      return (
        <td
          key={column.key}
          className="px-2 py-2 text-right font-mono tabular-nums text-text-secondary"
        >
          {formatMetric(adset.resultCount)}
        </td>
      );
    }
    if (column.key === 'cpa') {
      return (
        <td
          key={column.key}
          className="px-2 py-2 text-right font-mono tabular-nums text-text-secondary"
        >
          {formatMoney(adset.cpa, currency)}
        </td>
      );
    }
    if (column.key === 'roas') {
      return (
        <td
          key={column.key}
          className="px-2 py-2 text-right font-mono tabular-nums text-text-secondary"
        >
          {formatMetric(adset.roas)}
        </td>
      );
    }
    if (column.key === 'spend') {
      return (
        <td
          key={column.key}
          className="px-2 py-2 text-right font-mono tabular-nums text-text-secondary"
        >
          {formatMoney(adset.spend, currency)}
        </td>
      );
    }
    if (column.key === 'ctr') {
      return (
        <td
          key={column.key}
          className="px-2 py-2 text-right font-mono tabular-nums text-text-secondary"
        >
          {formatMetric(adset.ctr)}
        </td>
      );
    }
    if (column.key === 'clicks') {
      return (
        <td
          key={column.key}
          className="px-2 py-2 text-right font-mono tabular-nums text-text-secondary"
        >
          {formatMetric(adset.clicks)}
        </td>
      );
    }
    if (column.key === 'video') {
      return (
        <td
          key={column.key}
          className="px-2 py-2 text-right font-mono tabular-nums text-text-secondary"
        >
          {formatMetric(adset.videoP75Watched)}
        </td>
      );
    }
    if (column.key === 'rule') {
      return (
        <td key={column.key} className="truncate px-2 py-2 text-text-secondary">
          {getEntityRuleLabel('adset', adset.entityId)}
        </td>
      );
    }
    if (column.key === 'recommendation') {
      return (
        <td key={column.key} className="px-2 py-2 text-text-secondary">
          <div className="truncate">{getRecommendationLabel(recommendation, currency)}</div>
          {recommendation?.reason && (
            <div className="truncate text-text-tertiary">{recommendation.reason}</div>
          )}
        </td>
      );
    }
    return renderCampaignActionCell(column, recommendation, {
      entityLevel: 'adset',
      entityId: adset.entityId,
      entityName: adset.entityName,
      targetName: getDuplicateName(adset.entityName ?? adset.entityId),
      status: adset.status,
      budget: adset.dailyBudget,
    });
  };

  const renderAdCell = (
    column: TableColumn,
    campaign: ProjectMetaAdsCampaignSummary,
    ad: ProjectMetaAdsAdSummary,
  ) => {
    if (column.key === 'level') {
      return renderLevelCell(column, 'com_ui_project_meta_ads_level_ad');
    }
    if (column.key === 'adStatus') {
      return renderEntityStatusToggleCell({
        entityLevel: 'ad',
        entityId: ad.adId,
        entityName: ad.adName ?? ad.title,
        status: ad.status,
      });
    }
    if (column.key === 'name') {
      return renderAdNameCell(ad);
    }
    if (column.key === 'objective') {
      return (
        <td key={column.key} className="truncate px-2 py-2 text-text-secondary">
          {getObjectiveLabel(campaign.objective, localize)}
        </td>
      );
    }
    if (column.key === 'budgetMode') {
      return (
        <td key={column.key} className="px-2 py-2 text-text-secondary">
          {campaign.budgetMode ?? '-'}
        </td>
      );
    }
    if (column.key === 'frequency') {
      return (
        <td
          key={column.key}
          className="px-2 py-2 text-right font-mono tabular-nums text-text-secondary"
        >
          {renderFrequencyValue(ad)}
        </td>
      );
    }
    if (column.key === 'result') {
      return (
        <td
          key={column.key}
          className="px-2 py-2 text-right font-mono tabular-nums text-text-secondary"
        >
          {formatMetric(ad.resultCount)}
        </td>
      );
    }
    if (column.key === 'cpa') {
      return (
        <td
          key={column.key}
          className="px-2 py-2 text-right font-mono tabular-nums text-text-secondary"
        >
          {formatMoney(ad.cpa, ad.currency ?? currency)}
        </td>
      );
    }
    if (column.key === 'roas') {
      return (
        <td
          key={column.key}
          className="px-2 py-2 text-right font-mono tabular-nums text-text-secondary"
        >
          {formatMetric(ad.roas)}
        </td>
      );
    }
    if (column.key === 'spend') {
      return (
        <td
          key={column.key}
          className="px-2 py-2 text-right font-mono tabular-nums text-text-secondary"
        >
          {formatMoney(ad.spend, ad.currency ?? currency)}
        </td>
      );
    }
    if (column.key === 'ctr') {
      return (
        <td
          key={column.key}
          className="px-2 py-2 text-right font-mono tabular-nums text-text-secondary"
        >
          {formatMetric(ad.ctr)}
        </td>
      );
    }
    if (column.key === 'clicks') {
      return (
        <td
          key={column.key}
          className="px-2 py-2 text-right font-mono tabular-nums text-text-secondary"
        >
          {formatMetric(ad.clicks)}
        </td>
      );
    }
    return renderEmptyCell(column);
  };

  const renderAdRow = (
    campaign: ProjectMetaAdsCampaignSummary,
    ad: ProjectMetaAdsAdSummary,
    rowIndex: number,
  ) => {
    return (
      <tr
        key={ad.adId}
        data-testid={`meta-ads-ad-card-${ad.adId}`}
        onClick={() => setSelectedAdPreview(ad)}
        className={`group ${getTableRowClass(rowIndex, 'ad', true)}`}
      >
        <td className={`sticky left-0 z-30 px-2 py-2 pl-10 align-middle ${metaAdsStickyCell}`} />
        <td className={`sticky left-10 z-30 px-2 py-2 align-middle ${metaAdsStickyCell}`}>
          <span aria-hidden="true" className="block h-7 w-7" />
        </td>
        {tableColumns.map((column) => renderAdCell(column, campaign, ad))}
      </tr>
    );
  };

  const content = (
    <>
      <div
        data-testid="meta-ads-metrics-workspace"
        className={`${
          metricsFullscreen
            ? 'fixed inset-0 z-[9999] h-screen !overflow-y-auto !rounded-none'
            : 'relative overflow-hidden'
        } ${metaAdsSurface}`}
      >
        <div className="relative flex flex-col gap-5 border-b border-slate-200/70 p-5 dark:border-white/10 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-2xl font-semibold leading-tight tracking-tight text-slate-950 dark:text-white">
              {localize('com_ui_project_meta_ads_title')}
            </h3>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-300">
              <MetaAdsBadge variant="success">{localize(tokenStatusKey)}</MetaAdsBadge>
              <MetaAdsBadge className="font-normal">{settings.automationMode}</MetaAdsBadge>
              <MetaAdsBadge className="font-normal">
                {localize('com_ui_project_meta_ads_schedule_minutes', {
                  0: String(settings.scheduleIntervalMinutes),
                })}
              </MetaAdsBadge>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <MetaAdsButton
              disabled={!canUseMetaAdsActions || runAnalysis.isLoading}
              onClick={onRunAnalysis}
            >
              {localize(
                runAnalysis.isLoading
                  ? 'com_ui_project_meta_ads_running'
                  : 'com_ui_project_meta_ads_run',
              )}
            </MetaAdsButton>
            <MetaAdsButton onClick={() => openSettingsDrawer('account')}>
              {localize('com_ui_project_meta_ads_account_credentials')}
            </MetaAdsButton>
            <MetaAdsButton onClick={() => openSettingsDrawer('automation')}>
              {localize('com_ui_project_meta_ads_automation')}
            </MetaAdsButton>
            <MetaAdsButton disabled={!canUseMetaAdsActions} onClick={onOpenRuleGroupDraft}>
              {localize('com_ui_project_meta_ads_rules')}
            </MetaAdsButton>
            <MetaAdsButton
              onClick={() => setMetricsFullscreen((current) => !current)}
              aria-label={localize(
                metricsFullscreen
                  ? 'com_ui_project_meta_ads_exit_fullscreen'
                  : 'com_ui_project_meta_ads_enter_fullscreen',
              )}
              className="inline-flex items-center gap-2"
            >
              {metricsFullscreen ? (
                <ArrowsIn className="h-4 w-4" aria-hidden="true" />
              ) : (
                <ArrowsOut className="h-4 w-4" aria-hidden="true" />
              )}
              {localize(
                metricsFullscreen
                  ? 'com_ui_project_meta_ads_exit_fullscreen'
                  : 'com_ui_project_meta_ads_enter_fullscreen',
              )}
            </MetaAdsButton>
            {!settingsDrawer && (
              <MetaAdsButton
                variant="primary"
                disabled={!canUseMetaAdsActions || updateSettings.isLoading}
                onClick={onSave}
              >
                {localize('com_ui_save')}
              </MetaAdsButton>
            )}
          </div>
        </div>
        {runErrorMessage && (
          <div
            role="alert"
            className="relative m-5 border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-100"
          >
            {runErrorMessage}
          </div>
        )}
        <div
          role="tablist"
          aria-label={localize('com_ui_project_meta_ads_title')}
          className="flex flex-wrap gap-1 border-b border-slate-200/70 bg-white/35 px-4 py-3 backdrop-blur dark:border-white/10 dark:bg-slate-950/10"
        >
          {workspaceTabOptions.map((option) => {
            const isSelected = workspaceTab === option.value;
            return (
              <button
                key={option.value}
                type="button"
                role="tab"
                id={`meta-ads-tab-${option.value}`}
                aria-selected={isSelected}
                aria-controls={`meta-ads-${option.value}-tab-panel`}
                data-testid={`meta-ads-workspace-tab-${option.value}`}
                onClick={() => setWorkspaceTab(option.value)}
                className={`rounded-xl border px-4 py-2 text-xs font-semibold transition ${
                  isSelected
                    ? 'border-teal-300/70 bg-teal-50 text-teal-800 shadow-[0_12px_30px_-24px_rgba(20,184,166,0.65)] dark:border-teal-300/35 dark:bg-teal-300/10 dark:text-teal-100'
                    : 'border-transparent text-slate-500 hover:border-slate-200 hover:bg-white/70 hover:text-slate-900 dark:text-slate-400 dark:hover:border-white/10 dark:hover:bg-white/[0.055] dark:hover:text-slate-100'
                }`}
              >
                {localize(option.labelKey)}
              </button>
            );
          })}
        </div>

        {settingsDrawer && settingsDraft && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="meta-ads-settings-drawer-title"
            className={`${metaAdsModalOverlay} flex justify-end p-0`}
          >
            <div className={`${metaAdsDrawerShell} max-w-lg`}>
              <div className={metaAdsModalHeader}>
                <h4
                  id="meta-ads-settings-drawer-title"
                  className="text-base font-semibold text-slate-950 dark:text-white"
                >
                  {localize(
                    settingsDrawer === 'account'
                      ? 'com_ui_project_meta_ads_account_credentials'
                      : 'com_ui_project_meta_ads_automation',
                  )}
                </h4>
                <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  {settingsDrawer === 'account'
                    ? localize(tokenStatusKey)
                    : localize('com_ui_project_meta_ads_schedule_minutes', {
                        0: String(settingsDraft.scheduleIntervalMinutes),
                      })}
                </div>
              </div>
              <div className="flex-1 space-y-4 overflow-y-auto p-4">
                {settingsDrawer === 'account' ? (
                  <>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="flex flex-col gap-1 text-xs text-slate-600 dark:text-slate-300">
                        {localize('com_ui_project_meta_ads_enabled')}
                        <select
                          disabled={!canUseMetaAdsActions}
                          value={settingsDraft.enabled ? 'true' : 'false'}
                          onChange={(event) =>
                            setSettingsDraft((current) =>
                              current
                                ? { ...current, enabled: event.target.value === 'true' }
                                : current,
                            )
                          }
                          className={metaAdsInputLg}
                        >
                          <option value="false">
                            {localize('com_ui_project_meta_ads_disabled')}
                          </option>
                          <option value="true">
                            {localize('com_ui_project_meta_ads_enabled_state')}
                          </option>
                        </select>
                      </label>
                      <label className="flex flex-col gap-1 text-xs text-slate-600 dark:text-slate-300">
                        {localize('com_ui_project_meta_ads_account')}
                        <input
                          disabled={!canUseMetaAdsActions}
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={getAdAccountDigits(settingsDraft.adAccountId)}
                          onChange={(event) =>
                            setSettingsDraft((current) =>
                              current
                                ? { ...current, adAccountId: toAdAccountId(event.target.value) }
                                : current,
                            )
                          }
                          placeholder="123456789"
                          className={metaAdsInputLg}
                        />
                      </label>
                    </div>
                    <label className="flex flex-col gap-1 text-xs text-slate-600 dark:text-slate-300">
                      {localize('com_ui_project_meta_ads_graph_version')}
                      <select
                        disabled={!canUseMetaAdsActions}
                        value={settingsDraft.graphVersion ?? ''}
                        onChange={(event) =>
                          setSettingsDraft((current) =>
                            current ? { ...current, graphVersion: event.target.value } : current,
                          )
                        }
                        autoComplete="off"
                        className={metaAdsInputLg}
                      >
                        <option value="">
                          {localize('com_ui_project_meta_ads_graph_version_global', {
                            0: statusQuery.data?.graphVersion?.effective ?? 'v25.0',
                          })}
                        </option>
                        {graphVersionOptions.map((version) => (
                          <option key={version} value={version}>
                            {version}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className={metaAdsModalTile}>
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <div className="text-sm font-medium text-slate-950 dark:text-white">
                            {localize('com_ui_project_meta_ads_credentials')}
                          </div>
                          <div className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                            {localize('com_ui_project_meta_ads_credentials_hint')}
                          </div>
                          {tokenCredentials && (
                            <span className="mt-2 inline-flex w-fit items-center gap-2 rounded-full border border-slate-200/80 bg-white/80 px-3 py-1 text-xs text-slate-600 dark:border-white/10 dark:bg-white/[0.055] dark:text-slate-300">
                              {localize(tokenStatusKey)}
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          disabled={!canUseMetaAdsActions}
                          onClick={openCredentialsDialog}
                          className={metaAdsButton}
                        >
                          {localize('com_ui_project_meta_ads_manage_tokens')}
                        </button>
                      </div>
                    </div>
                    <div
                      className={`${metaAdsModalTile} text-sm text-slate-600 dark:text-slate-300`}
                    >
                      <div className="font-medium text-slate-950 dark:text-white">
                        {localize(tokenStatusKey)}
                      </div>
                      <div className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
                        {localize('com_ui_project_meta_ads_graph_version_hint')}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="grid gap-3">
                    <label className="flex flex-col gap-1 text-xs text-slate-600 dark:text-slate-300">
                      {localize('com_ui_project_meta_ads_mode')}
                      <select
                        disabled={!canUseMetaAdsActions}
                        value={settingsDraft.automationMode}
                        onChange={(event) =>
                          setSettingsDraft((current) =>
                            current
                              ? {
                                  ...current,
                                  automationMode: event.target
                                    .value as MetaAdsSettings['automationMode'],
                                }
                              : current,
                          )
                        }
                        className={metaAdsInputLg}
                      >
                        <option value="recommend">
                          {localize('com_ui_project_meta_ads_mode_recommend')}
                        </option>
                        <option value="auto_limited">
                          {localize('com_ui_project_meta_ads_mode_auto_limited')}
                        </option>
                      </select>
                    </label>
                    <label className="flex flex-col gap-1 text-xs text-slate-600 dark:text-slate-300">
                      {localize('com_ui_project_meta_ads_schedule')}
                      <select
                        disabled={!canUseMetaAdsActions}
                        value={settingsDraft.scheduleIntervalMinutes}
                        onChange={(event) =>
                          setSettingsDraft((current) =>
                            current
                              ? {
                                  ...current,
                                  scheduleIntervalMinutes: Number(
                                    event.target.value,
                                  ) as ScheduleIntervalMinutes,
                                }
                              : current,
                          )
                        }
                        className={metaAdsInputLg}
                      >
                        {scheduleOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {localize(option.labelKey)}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-2 border-t border-slate-200/75 p-4 dark:border-white/10">
                <button type="button" onClick={closeSettingsDrawer} className={metaAdsGhostButton}>
                  {localize('com_ui_cancel')}
                </button>
                <button
                  type="button"
                  disabled={!canUseMetaAdsActions || updateSettings.isLoading}
                  onClick={onSaveSettingsDrawer}
                  className={metaAdsPrimaryButton}
                >
                  {localize('com_ui_save')}
                </button>
              </div>
            </div>
          </div>
        )}

        <OGDialog
          open={credentialsDialogOpen}
          onOpenChange={(open) => {
            if (open) {
              setCredentialsDialogOpen(true);
              return;
            }
            closeCredentialsDialog();
          }}
        >
          <OGDialogContent className={`max-w-2xl p-0 ${metaAdsModalShell}`}>
            <OGDialogHeader>
              <div className={metaAdsModalHeader}>
                <OGDialogTitle>{localize('com_ui_project_meta_ads_manage_tokens')}</OGDialogTitle>
                <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  {localize('com_ui_project_meta_ads_manage_tokens_hint')}
                </div>
              </div>
            </OGDialogHeader>
            <div className="space-y-4 p-4">
              <div className={metaAdsModalTile}>
                <div className="flex flex-col gap-1">
                  <div className="text-sm font-medium text-slate-950 dark:text-white">
                    {localize('com_ui_project_meta_ads_global_token_title')}
                  </div>
                  <div className="text-xs leading-5 text-slate-500 dark:text-slate-400">
                    {localize(
                      canManageTenantToken
                        ? 'com_ui_project_meta_ads_tenant_token_hint'
                        : 'com_ui_project_meta_ads_tenant_token_admin_hint',
                    )}
                  </div>
                  <span className="mt-1 inline-flex w-fit rounded-full border border-slate-200/80 bg-white/80 px-3 py-1 text-xs text-slate-600 dark:border-white/10 dark:bg-white/[0.055] dark:text-slate-300">
                    {statusQuery.data?.credentials?.tenantConfigured
                      ? localize('com_ui_project_meta_ads_tenant_token_configured')
                      : localize('com_ui_project_meta_ads_token_missing')}
                  </span>
                </div>
                {canManageTenantToken && (
                  <div className="mt-3 flex h-11 overflow-hidden rounded-xl border border-slate-200/90 bg-white/90 dark:border-white/10 dark:bg-slate-950/35">
                    <input
                      type={showTenantAccessToken ? 'text' : 'password'}
                      autoComplete="new-password"
                      value={tenantAccessToken}
                      onChange={(event) => setTenantAccessToken(event.target.value)}
                      placeholder={localize('com_ui_project_meta_ads_token_placeholder')}
                      className="min-w-0 flex-1 bg-transparent px-3 text-sm text-slate-800 outline-none dark:text-slate-100"
                    />
                    {tenantAccessToken.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setShowTenantAccessToken((current) => !current)}
                        className="shrink-0 border-l border-slate-200/75 px-3 text-xs font-medium text-slate-500 dark:border-white/10 dark:text-slate-400"
                      >
                        {localize(
                          showTenantAccessToken ? 'com_ui_hide_password' : 'com_ui_show_password',
                        )}
                      </button>
                    )}
                  </div>
                )}
                {canManageTenantToken && (
                  <div className="mt-3 flex justify-end">
                    <button
                      type="button"
                      disabled={!tenantAccessToken.trim() || updateTenantToken.isLoading}
                      onClick={onSaveTenantToken}
                      className={metaAdsPrimaryButton}
                    >
                      {localize('com_ui_project_meta_ads_save_tenant_token')}
                    </button>
                  </div>
                )}
              </div>

              <div className={metaAdsModalTile}>
                <div className="flex flex-col gap-1">
                  <div className="text-sm font-medium text-slate-950 dark:text-white">
                    {localize('com_ui_project_meta_ads_local_token_title')}
                  </div>
                  <div className="text-xs leading-5 text-slate-500 dark:text-slate-400">
                    {localize('com_ui_project_meta_ads_project_token_hint')}
                  </div>
                  <span className="mt-1 inline-flex w-fit rounded-full border border-slate-200/80 bg-white/80 px-3 py-1 text-xs text-slate-600 dark:border-white/10 dark:bg-white/[0.055] dark:text-slate-300">
                    {hasProjectToken
                      ? localize('com_ui_project_meta_ads_project_token_configured')
                      : localize('com_ui_project_meta_ads_project_token_not_configured')}
                  </span>
                </div>
                <div className="mt-3 flex h-11 overflow-hidden rounded-xl border border-slate-200/90 bg-white/90 dark:border-white/10 dark:bg-slate-950/35">
                  <input
                    disabled={!canUseMetaAdsActions}
                    type={showSettingsDraftToken ? 'text' : 'password'}
                    name="meta_ads_project_token_new"
                    autoComplete="new-password"
                    value={settingsDraftToken}
                    onChange={(event) => setSettingsDraftToken(event.target.value)}
                    placeholder={
                      hasProjectToken
                        ? localize('com_ui_project_meta_ads_token_keep_existing')
                        : localize('com_ui_project_meta_ads_token_placeholder')
                    }
                    className="min-w-0 flex-1 bg-transparent px-3 text-sm text-slate-800 outline-none disabled:cursor-not-allowed dark:text-slate-100"
                  />
                  {settingsDraftToken.length > 0 && (
                    <button
                      type="button"
                      disabled={!canUseMetaAdsActions}
                      onClick={() => setShowSettingsDraftToken((current) => !current)}
                      className="shrink-0 border-l border-slate-200/75 px-3 text-xs font-medium text-slate-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:text-slate-400"
                    >
                      {localize(
                        showSettingsDraftToken ? 'com_ui_hide_password' : 'com_ui_show_password',
                      )}
                    </button>
                  )}
                </div>
                <div className="mt-3 flex flex-wrap justify-end gap-2">
                  {hasProjectToken && (
                    <button
                      type="button"
                      disabled={!canUseMetaAdsActions || updateSettings.isLoading}
                      onClick={onClearProjectToken}
                      className={metaAdsGhostButton}
                    >
                      {localize('com_ui_project_meta_ads_use_tenant_token')}
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={
                      !canUseMetaAdsActions ||
                      !settingsDraftToken.trim() ||
                      updateSettings.isLoading
                    }
                    onClick={onSaveProjectToken}
                    className={metaAdsPrimaryButton}
                  >
                    {localize('com_ui_project_meta_ads_save_project_token')}
                  </button>
                </div>
              </div>
            </div>
            <div className="flex justify-end border-t border-slate-200/75 p-4 dark:border-white/10">
              <button type="button" onClick={closeCredentialsDialog} className={metaAdsGhostButton}>
                {localize('com_ui_close')}
              </button>
            </div>
          </OGDialogContent>
        </OGDialog>

        {workspaceTab === 'overview' && (
          <div
            id="meta-ads-overview-tab-panel"
            role="tabpanel"
            aria-labelledby="meta-ads-tab-overview"
            data-testid="meta-ads-overview-tab-panel"
          >
            <div className="flex flex-col gap-4 border-b border-slate-200/70 bg-white/45 p-4 shadow-[0_20px_60px_-50px_rgba(15,23,42,0.35)] backdrop-blur dark:border-white/10 dark:bg-slate-950/10 dark:shadow-[0_20px_70px_-54px_rgba(0,0,0,0.9)]">
              {isStatusLoading && (
                <div
                  role="status"
                  className="flex items-center gap-2 rounded-2xl border border-amber-300/35 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 dark:border-amber-300/20 dark:bg-amber-300/10 dark:text-amber-100"
                >
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-amber-900 border-t-amber-200" />
                  <span>{localize('com_ui_project_meta_ads_loading')}</span>
                </div>
              )}
              <MetaAdsPanel className="p-3">
                <div className="flex min-w-0 flex-col gap-3">
                  <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-7">
                    <MetaAdsField label={localize('com_ui_project_meta_ads_search')}>
                      <MetaAdsInput
                        value={campaignSearch}
                        onChange={(event) => setCampaignSearch(event.target.value)}
                      />
                    </MetaAdsField>
                    <MetaAdsField label={localize('com_ui_project_meta_ads_budget_mode_filter')}>
                      <MetaAdsSelect
                        value={budgetModeFilter}
                        onChange={(event) => setBudgetModeFilter(event.target.value)}
                      >
                        <option value="all">{localize('com_ui_all')}</option>
                        <option value="CBO">CBO</option>
                        <option value="ABO">ABO</option>
                        <option value="UNKNOWN">UNKNOWN</option>
                      </MetaAdsSelect>
                    </MetaAdsField>
                    <MetaAdsField label={localize('com_ui_project_meta_ads_objective_filter')}>
                      <MetaAdsSelect
                        value={objectiveFilter}
                        onChange={(event) => setObjectiveFilter(event.target.value)}
                      >
                        <option value="all">{localize('com_ui_all')}</option>
                        {objectiveOptions.map((objective) => (
                          <option key={objective} value={objective}>
                            {getObjectiveLabel(objective, localize)}
                          </option>
                        ))}
                      </MetaAdsSelect>
                    </MetaAdsField>
                    <MetaAdsField label={localize('com_ui_project_meta_ads_sort')}>
                      <MetaAdsSelect
                        value={campaignSort}
                        onChange={(event) => setCampaignSort(event.target.value)}
                      >
                        <option value="name_asc">{localize('com_ui_name')}</option>
                        <option value="budget_desc">
                          {localize('com_ui_project_meta_ads_budget_defined')}
                        </option>
                        <option value="frequency_desc">
                          {localize('com_ui_project_meta_ads_frequency')}
                        </option>
                        <option value="spend_desc">
                          {localize('com_ui_project_meta_ads_spend')}
                        </option>
                        <option value="roas_desc">
                          {localize('com_ui_project_meta_ads_roas')}
                        </option>
                        <option value="cpa_asc">
                          {localize('com_ui_project_meta_ads_cost_result')}
                        </option>
                        <option value="result_desc">
                          {localize('com_ui_project_meta_ads_result')}
                        </option>
                        <option value="ctr_desc">CTR</option>
                        <option value="clicks_desc">
                          {localize('com_ui_project_meta_ads_clicks')}
                        </option>
                      </MetaAdsSelect>
                    </MetaAdsField>
                    <MetaAdsField label={localize('com_ui_project_meta_ads_table_view')}>
                      <MetaAdsSelect
                        value={tableView}
                        onChange={(event) => setTableView(event.target.value as TableView)}
                      >
                        {tableViewOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {localize(option.labelKey)}
                          </option>
                        ))}
                      </MetaAdsSelect>
                    </MetaAdsField>
                  </div>
                  <div className="flex flex-wrap items-center justify-start gap-2 xl:justify-end">
                    <span className="h-10 rounded-xl border border-slate-200 bg-white/70 px-3 py-2.5 font-mono text-xs tabular-nums text-slate-600 dark:border-white/10 dark:bg-white/[0.055] dark:text-slate-300">
                      {localize('com_ui_project_meta_ads_selection_count', {
                        0: String(selectedCount),
                      })}
                    </span>
                    <MetaAdsButton
                      variant="ghost"
                      disabled={selectedCount === 0}
                      onClick={() => setSelectedEntityIds([])}
                    >
                      {localize('com_ui_project_meta_ads_clear_selection')}
                    </MetaAdsButton>
                    <MetaAdsButton
                      variant="ghost"
                      disabled={campaigns.length === 0}
                      onClick={onExpandAllRows}
                    >
                      {localize('com_ui_project_meta_ads_expand_all')}
                    </MetaAdsButton>
                    <MetaAdsButton
                      variant="ghost"
                      disabled={campaigns.length === 0}
                      onClick={onCollapseAllRows}
                    >
                      {localize('com_ui_project_meta_ads_collapse_all')}
                    </MetaAdsButton>
                    <MetaAdsButton disabled={!canCreateRuleGroup} onClick={onOpenRuleGroupDraft}>
                      {localize('com_ui_project_meta_ads_create_rule_group')}
                    </MetaAdsButton>
                    <MetaAdsButton
                      disabled={!canOpenTrafficAgentChat}
                      onClick={onOpenTrafficAgentChat}
                    >
                      {localize('com_ui_project_meta_ads_chat_with_agent')}
                    </MetaAdsButton>
                  </div>
                </div>
              </MetaAdsPanel>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {summaryCards.map(({ labelKey, value, tone, context, clickable }) => {
                  const showResultMetricCta =
                    clickable && !isInitialStatusLoading && value.trim() === '-';
                  const content = (
                    <>
                      <div className="flex items-start justify-between gap-3">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                          {localize(labelKey as TranslationKeys)}
                        </div>
                        {clickable && (
                          <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-teal-300/35 bg-teal-300/10 px-2 py-1 text-[10px] font-semibold text-teal-700 opacity-90 transition group-hover:border-teal-300/70 group-hover:bg-teal-300/15 dark:text-teal-200">
                            <PencilSimple size={11} weight="bold" />
                            {localize('com_ui_project_meta_ads_change_result_metric')}
                          </span>
                        )}
                      </div>
                      {isInitialStatusLoading ? (
                        <div
                          data-testid="meta-ads-summary-skeleton"
                          className="mt-4 h-8 w-28 animate-pulse rounded-lg bg-slate-200/80 dark:bg-white/10"
                        />
                      ) : showResultMetricCta ? (
                        <div className="mt-4 rounded-xl border border-dashed border-teal-300/45 bg-teal-300/10 px-3 py-3 text-sm font-semibold text-teal-800 transition group-hover:border-teal-300/75 group-hover:bg-teal-300/15 dark:text-teal-100">
                          {localize('com_ui_project_meta_ads_click_to_choose_result_metric')}
                        </div>
                      ) : (
                        <div className="mt-4 font-mono text-3xl font-semibold tabular-nums tracking-tight text-slate-950 dark:text-white">
                          {value}
                        </div>
                      )}
                      {context && !isInitialStatusLoading && (
                        <div className="mt-2 truncate text-xs font-medium text-slate-500 dark:text-slate-400">
                          {context}
                        </div>
                      )}
                    </>
                  );
                  const className = `group relative overflow-hidden rounded-2xl border border-l-4 border-slate-200/80 ${tone} bg-white/82 p-5 text-left shadow-[0_16px_42px_-36px_rgba(15,23,42,0.48)] transition duration-300 dark:border-white/10 dark:bg-white/[0.055] dark:shadow-[0_16px_46px_-38px_rgba(0,0,0,0.92)]`;
                  return clickable ? (
                    <button
                      key={labelKey}
                      type="button"
                      data-testid={`meta-ads-summary-card-${labelKey}`}
                      disabled={isInitialStatusLoading}
                      onClick={() => setResultTypeSelectorOpen(true)}
                      className={`${className} hover:-translate-y-0.5 hover:border-teal-300/60 hover:shadow-[0_22px_54px_-40px_rgba(20,184,166,0.55)] disabled:cursor-wait disabled:opacity-80`}
                    >
                      {content}
                    </button>
                  ) : (
                    <div
                      key={labelKey}
                      data-testid={`meta-ads-summary-card-${labelKey}`}
                      className={className}
                    >
                      {content}
                    </div>
                  );
                })}
              </div>
              {resultTypeSelectorOpen && (
                <div
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="meta-ads-result-type-selector-title"
                  className={`${metaAdsModalOverlay} flex items-center justify-center`}
                >
                  <div
                    className={`flex max-h-[82vh] w-full max-w-xl flex-col p-4 ${metaAdsModalShell}`}
                  >
                    <div className="flex items-start justify-between gap-3 border-b border-slate-200/75 pb-4 dark:border-white/10">
                      <div>
                        <h4
                          id="meta-ads-result-type-selector-title"
                          className="text-base font-semibold text-slate-950 dark:text-white"
                        >
                          {localize('com_ui_project_meta_ads_choose_result_metric')}
                        </h4>
                        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          {localize('com_ui_project_meta_ads_choose_result_metric_hint')}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setResultTypeSelectorOpen(false)}
                        className={metaAdsGhostButton}
                      >
                        {localize('com_ui_close')}
                      </button>
                    </div>
                    <div className="mt-4 min-h-0 space-y-2 overflow-y-auto pr-1">
                      {summaryResultTypeOptions.map((option) => (
                        <button
                          key={option.resultType}
                          type="button"
                          onClick={() => {
                            setSelectedSummaryResultType(option.resultType);
                            setResultTypeSelectorOpen(false);
                          }}
                          className={`w-full rounded-2xl border p-3 text-left transition ${
                            selectedSummaryResultType === option.resultType
                              ? 'border-teal-300/70 bg-teal-300/10'
                              : 'border-slate-200/80 bg-white hover:border-teal-300/45 hover:bg-teal-50 dark:border-white/10 dark:bg-[#172033] dark:hover:bg-[#183247]'
                          }`}
                        >
                          <div className="truncate text-sm font-semibold text-slate-950 dark:text-white">
                            {getResultTypeLabel(option.resultType, localize)}
                          </div>
                          <div className="mt-2 grid gap-2 text-xs text-slate-500 dark:text-slate-400 sm:grid-cols-3">
                            <span>
                              {localize('com_ui_project_meta_ads_results')}:{' '}
                              {formatMetric(option.totalResults)}
                            </span>
                            <span>
                              {localize('com_ui_project_meta_ads_spend')}:{' '}
                              {formatMoney(option.totalSpend, currency)}
                            </span>
                            <span>
                              {localize('com_ui_project_meta_ads_average_cost')}:{' '}
                              {formatMoney(option.averageCostPerResult, currency)}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                    <div className="mt-4 flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedSummaryResultType(null);
                          setResultTypeSelectorOpen(false);
                        }}
                        className={metaAdsGhostButton}
                      >
                        {localize('com_ui_project_meta_ads_clear_result_metric')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setResultTypeSelectorOpen(false)}
                        className={metaAdsButton}
                      >
                        {localize('com_ui_cancel')}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {pendingRecommendations.length > 0 && campaigns.length === 0 && (
              <div className="border-b border-border-light bg-surface-secondary p-3">
                <div className="space-y-2">
                  {pendingRecommendations.map((recommendation) => (
                    <div
                      key={recommendation._id ?? recommendation.entityId}
                      className="flex items-center justify-between gap-3 border border-border-light bg-surface-primary p-2 text-xs"
                    >
                      <div className="min-w-0">
                        <div className="truncate font-medium text-text-primary">
                          {recommendation.entityName ?? recommendation.entityId}
                        </div>
                        <div className="text-text-secondary">
                          {getRecommendationLabel(recommendation, currency)}
                        </div>
                      </div>
                      {canApplyRecommendation(recommendation) && (
                        <button
                          type="button"
                          disabled={!canUseMetaAdsActions || applyRecommendation.isLoading}
                          onClick={() => onApply(recommendation)}
                          className="h-7 shrink-0 border border-border-light px-2 font-medium text-text-primary disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {localize('com_ui_project_meta_ads_apply')}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {budgetEditor && (
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="meta-ads-budget-dialog-title"
                className={`${metaAdsModalOverlay} flex items-center justify-center`}
              >
                <div className={`relative w-full max-w-2xl p-5 sm:p-6 ${metaAdsModalShell}`}>
                  <div className="relative min-w-0">
                    <h4
                      id="meta-ads-budget-dialog-title"
                      className="text-2xl font-semibold leading-tight tracking-tight text-slate-950 dark:text-white"
                    >
                      {localize('com_ui_project_meta_ads_edit_budget')}
                    </h4>
                    <div className="mt-4 truncate text-lg font-semibold text-slate-950 dark:text-white">
                      {budgetEditor.entityName ?? budgetEditor.entityId}
                    </div>
                    <div className="mt-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                      {budgetEditor.entityLevel === 'campaign'
                        ? localize('com_ui_project_meta_ads_campaign')
                        : localize('com_ui_project_meta_ads_select_ad_set')}
                    </div>
                    <div className="mt-4 max-w-[56ch] text-sm leading-6 text-slate-600 dark:text-slate-300">
                      {localize('com_ui_project_meta_ads_manual_budget_hint')}
                    </div>

                    <div className="mt-5 grid gap-3 sm:grid-cols-[0.9fr_1.1fr]">
                      <div className={metaAdsModalTile}>
                        <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                          {localize('com_ui_project_meta_ads_budget_defined')}
                        </div>
                        <div className="mt-2 font-mono text-2xl font-semibold tabular-nums text-slate-950 dark:text-white">
                          {formatMoney(budgetEditor.currentBudget, currency)}
                        </div>
                      </div>
                      <label className="rounded-2xl border border-amber-300/35 bg-amber-300/10 p-4 text-xs text-slate-600 dark:text-slate-300">
                        <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-700 dark:text-amber-200">
                          {localize('com_ui_project_meta_ads_new_budget')}
                        </span>
                        <input
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={manualDailyBudget}
                          onChange={(event) => setManualDailyBudget(event.target.value)}
                          className={metaAdsInputLg}
                        />
                      </label>
                    </div>

                    {buildBudgetReferences(budgetEditor.currentBudget, currency).length > 0 && (
                      <div className="mt-5">
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                            {localize('com_ui_project_meta_ads_budget_quick_adjustments')}
                          </div>
                          <div className="h-px flex-1 bg-slate-200/75 dark:bg-white/10" />
                        </div>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                          {buildBudgetReferences(budgetEditor.currentBudget, currency).map(
                            (reference) => (
                              <button
                                key={reference.percent}
                                type="button"
                                aria-label={reference.accessibleLabel}
                                onClick={() => setManualDailyBudget(reference.value.toFixed(2))}
                                className={`group flex min-h-16 items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left shadow-[0_14px_34px_-30px_rgba(15,23,42,0.45)] transition duration-200 hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-amber-300/25 active:translate-y-0 ${reference.tone}`}
                              >
                                <span className="text-sm font-semibold">{reference.label}</span>
                                <span className="font-mono text-sm font-semibold tabular-nums text-[#f8f1e5]">
                                  {reference.formattedValue}
                                </span>
                              </button>
                            ),
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="relative mt-6 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setBudgetEditor(null)}
                      className={metaAdsGhostButton}
                    >
                      {localize('com_ui_cancel')}
                    </button>
                    <button
                      type="button"
                      disabled={updateBudget.isLoading}
                      onClick={onSaveManualBudget}
                      className={metaAdsPrimaryButton}
                    >
                      {localize('com_ui_project_meta_ads_save_budget')}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {budgetConfirmation && (
              <div className="border-b border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
                <div className="font-semibold">
                  {localize('com_ui_project_meta_ads_confirm_budget_title')}
                </div>
                <div className="mt-1">
                  {budgetConfirmation.entityName ?? budgetConfirmation.entityId}:{' '}
                  {formatMoney(budgetConfirmation.currentBudget, currency)}
                  {' -> '}
                  {formatMoney(budgetConfirmation.dailyBudget, currency)}
                </div>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setBudgetConfirmation(null)}
                    className="h-8 border border-amber-300 px-3 text-xs font-medium"
                  >
                    {localize('com_ui_cancel')}
                  </button>
                  <button
                    type="button"
                    disabled={updateBudget.isLoading}
                    onClick={onConfirmManualBudget}
                    className="h-8 bg-amber-900 px-3 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {localize('com_ui_project_meta_ads_confirm_budget')}
                  </button>
                </div>
              </div>
            )}

            {entityStatusConfirmation && (
              <div className="border-b border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
                <div className="font-semibold">
                  {localize('com_ui_project_meta_ads_confirm_ad_status_title')}
                </div>
                <div className="mt-1">
                  {entityStatusConfirmation.entityName ?? entityStatusConfirmation.entityId}:{' '}
                  {entityStatusConfirmation.currentStatus || '-'}
                  {' -> '}
                  {entityStatusConfirmation.nextStatus}
                </div>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setEntityStatusConfirmation(null)}
                    className="h-8 border border-amber-300 px-3 text-xs font-medium"
                  >
                    {localize('com_ui_cancel')}
                  </button>
                  <button
                    type="button"
                    disabled={updateEntityStatus.isLoading}
                    onClick={onConfirmEntityStatus}
                    className="h-8 bg-amber-900 px-3 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {localize(
                      entityStatusConfirmation.nextStatus === 'ACTIVE'
                        ? 'com_ui_project_meta_ads_confirm_activate_ad'
                        : 'com_ui_project_meta_ads_confirm_deactivate_ad',
                    )}
                  </button>
                </div>
              </div>
            )}

            {duplicateDraft && (
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="meta-ads-duplicate-title"
                className={`${metaAdsModalOverlay} flex justify-end p-0`}
              >
                <div className={`${metaAdsDrawerShell} max-w-md`}>
                  <div className={metaAdsModalHeader}>
                    <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                      {duplicateDraft.entityLevel === 'campaign'
                        ? localize('com_ui_project_meta_ads_level_campaign')
                        : localize('com_ui_project_meta_ads_level_ad_set')}
                    </div>
                    <h4
                      id="meta-ads-duplicate-title"
                      className="mt-1 text-base font-semibold text-slate-950 dark:text-white"
                    >
                      {localize('com_ui_project_meta_ads_duplicate_title')}
                    </h4>
                  </div>
                  <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                        {localize('com_ui_project_meta_ads_original')}
                      </div>
                      <div className="mt-1 truncate text-sm font-medium text-slate-950 dark:text-white">
                        {duplicateDraft.entityName ?? duplicateDraft.entityId}
                      </div>
                    </div>
                    <label className="block">
                      <span className="text-[10px] uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                        {localize('com_ui_project_meta_ads_duplicate_name')}
                      </span>
                      <input
                        value={duplicateTargetName}
                        onChange={(event) => setDuplicateTargetName(event.target.value)}
                        className={metaAdsInputLg}
                      />
                    </label>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className={metaAdsModalTile}>
                        <div className="uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                          {localize('com_ui_project_meta_ads_status')}
                        </div>
                        <div className="mt-2 font-mono text-slate-950 dark:text-white">
                          {duplicateDraft.status || '-'}
                        </div>
                      </div>
                      <div className={metaAdsModalTile}>
                        <div className="uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                          {localize('com_ui_project_meta_ads_budget_defined')}
                        </div>
                        <div className="mt-2 font-mono text-slate-950 dark:text-white">
                          {formatMoney(duplicateDraft.budget, currency)}
                        </div>
                      </div>
                    </div>
                    {duplicateDraft.status?.toUpperCase() === 'ACTIVE' && (
                      <div className="rounded-2xl border border-amber-300/35 bg-amber-300/10 p-3 text-xs leading-5 text-amber-800 dark:text-amber-100">
                        {localize('com_ui_project_meta_ads_duplicate_active_warning')}
                      </div>
                    )}
                  </div>
                  <div className="flex justify-end gap-2 border-t border-slate-200/75 p-4 dark:border-white/10">
                    <button
                      type="button"
                      onClick={onCloseDuplicateDraft}
                      className={metaAdsGhostButton}
                    >
                      {localize('com_ui_cancel')}
                    </button>
                    <button
                      type="button"
                      disabled={duplicateEntity.isLoading || !duplicateTargetName.trim()}
                      onClick={onConfirmDuplicate}
                      className={metaAdsPrimaryButton}
                    >
                      {localize('com_ui_project_meta_ads_duplicate_confirm')}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {ruleGroupDraft && (
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="meta-ads-rule-group-dialog-title"
                className={`${metaAdsModalOverlay} flex justify-end p-0`}
              >
                <div className={`${metaAdsDrawerShell} max-w-xl`}>
                  <div className={metaAdsModalHeader}>
                    <h4
                      id="meta-ads-rule-group-dialog-title"
                      className="text-base font-semibold text-slate-950 dark:text-white"
                    >
                      {localize(getRuleDraftTitleKey(ruleGroupDraft))}
                    </h4>
                    {ruleGroupDraft.scope === 'global' ? (
                      <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                        {localize('com_ui_project_meta_ads_global_rules_hint')}
                      </div>
                    ) : (
                      <div className="mt-2 space-y-2">
                        <div className="text-xs uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
                          {ruleGroupDraft.entityLevel === 'campaign'
                            ? localize('com_ui_project_meta_ads_campaign')
                            : localize('com_ui_project_meta_ads_select_ad_set')}
                          {' · '}
                          {ruleGroupDraft.entityIds.length}{' '}
                          {localize('com_ui_project_meta_ads_rule_group_selected')}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {ruleDraftEntityLabels.slice(0, 8).map((label) => (
                            <span
                              key={label}
                              className="rounded-full border border-slate-200/80 bg-white/70 px-3 py-1 text-xs text-slate-600 dark:border-white/10 dark:bg-white/[0.055] dark:text-slate-300"
                            >
                              {label}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 space-y-4 overflow-y-auto p-4">
                    {(ruleGroupDraft.scope === 'group' || ruleGroupDraft.scope === 'override') && (
                      <label className="flex flex-col gap-1 text-xs text-slate-600 dark:text-slate-300">
                        <RuleFieldLabel
                          localize={localize}
                          labelKey="com_ui_project_meta_ads_rule_group_name"
                          hintKey="com_ui_project_meta_ads_rule_group_name_hint"
                        />
                        <input
                          aria-label={localize('com_ui_project_meta_ads_rule_group_name')}
                          value={ruleGroupDraft.name}
                          onChange={(event) =>
                            setRuleGroupDraft((current) =>
                              current ? { ...current, name: event.target.value } : current,
                            )
                          }
                          className={metaAdsInputLg}
                        />
                      </label>
                    )}
                    {ruleGroupDraft.scope === 'global' && (
                      <div className={metaAdsModalTile}>
                        <h5 className={metaAdsLabel}>
                          {localize('com_ui_project_meta_ads_rule_section_target')}
                        </h5>
                        <label className="mt-2 flex flex-col gap-1 text-xs text-slate-600 dark:text-slate-300">
                          <RuleFieldLabel
                            localize={localize}
                            labelKey="com_ui_project_meta_ads_account_profile"
                            hintKey="com_ui_project_meta_ads_account_profile_hint"
                          />
                          <select
                            aria-label={localize('com_ui_project_meta_ads_account_profile')}
                            value={settings.accountProfile ?? 'custom'}
                            onChange={(event) =>
                              onAccountProfileChange(
                                event.target.value as MetaAdsSettingsState['accountProfile'],
                              )
                            }
                            className={metaAdsInputLg}
                          >
                            {accountProfileOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {localize(option.labelKey)}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                    )}
                    <div className={metaAdsModalTile}>
                      <h5 className={metaAdsLabel}>
                        {localize('com_ui_project_meta_ads_rule_section_performance')}
                      </h5>
                      <div className="mt-2 grid gap-3 sm:grid-cols-2">
                        <label className="flex flex-col gap-1 text-xs text-slate-600 dark:text-slate-300">
                          <RuleFieldLabel
                            localize={localize}
                            labelKey="com_ui_project_meta_ads_target_result_type"
                            hintKey="com_ui_project_meta_ads_target_result_type_hint"
                          />
                          <select
                            aria-label={localize('com_ui_project_meta_ads_target_result_type')}
                            value={ruleGroupDraft.rules.targetResultType ?? ''}
                            onChange={(event) =>
                              onRuleGroupRuleTextChange('targetResultType', event.target.value)
                            }
                            className={metaAdsInputLg}
                          >
                            <option value="">
                              {localize('com_ui_project_meta_ads_result_type_legacy')}
                            </option>
                            {resultTypeOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {localize(option.labelKey)}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="flex flex-col gap-1 text-xs text-slate-600 dark:text-slate-300">
                          <RuleFieldLabel
                            localize={localize}
                            labelKey="com_ui_project_meta_ads_primary_metric"
                            hintKey="com_ui_project_meta_ads_primary_metric_hint"
                          />
                          <select
                            aria-label={localize('com_ui_project_meta_ads_primary_metric')}
                            value={ruleGroupDraft.rules.primaryMetric ?? 'cpa'}
                            onChange={(event) =>
                              onRuleGroupRuleTextChange('primaryMetric', event.target.value)
                            }
                            className={metaAdsInputLg}
                          >
                            {primaryMetricOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {localize(option.labelKey)}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                    </div>
                    <div className={metaAdsModalTile}>
                      <h5 className={metaAdsLabel}>
                        {localize('com_ui_project_meta_ads_rule_section_budget')}
                      </h5>
                      <div className="mt-2 grid gap-3 sm:grid-cols-2">
                        {numberFields.map((field) => (
                          <label
                            key={field.key}
                            className="flex flex-col gap-1 text-xs text-slate-600 dark:text-slate-300"
                          >
                            <RuleFieldLabel
                              localize={localize}
                              labelKey={field.labelKey}
                              hintKey={field.hintKey}
                            />
                            <input
                              aria-label={localize(field.labelKey)}
                              type="number"
                              step={field.step}
                              min={
                                field.key === 'minRoas' || field.key === 'minSpend'
                                  ? '0'
                                  : field.key === 'cooldownHours'
                                    ? '1'
                                    : '0.01'
                              }
                              max={
                                field.key === 'maxIncreasePct' || field.key === 'maxDecreasePct'
                                  ? '100'
                                  : field.key === 'cooldownHours'
                                    ? '168'
                                    : undefined
                              }
                              value={ruleGroupDraft.rules[field.key] ?? ''}
                              onChange={(event) =>
                                onRuleGroupRuleChange(field.key, event.target.value)
                              }
                              className={metaAdsInputLg}
                            />
                          </label>
                        ))}
                      </div>
                    </div>
                    <div className={metaAdsModalTile}>
                      <h5 className={metaAdsLabel}>
                        {localize('com_ui_project_meta_ads_rule_section_guardrails')}
                      </h5>
                      <div className="mt-2 grid gap-3 sm:grid-cols-2">
                        {optionalNumberFields.map((field) => (
                          <label
                            key={field.key}
                            className="flex flex-col gap-1 text-xs text-slate-600 dark:text-slate-300"
                          >
                            <RuleFieldLabel
                              localize={localize}
                              labelKey={field.labelKey}
                              hintKey={field.hintKey}
                            />
                            <input
                              aria-label={localize(field.labelKey)}
                              type="number"
                              step={field.step}
                              min="0"
                              value={ruleGroupDraft.rules[field.key] ?? ''}
                              placeholder={localize('com_ui_project_meta_ads_optional_rule')}
                              onChange={(event) =>
                                onRuleGroupRuleChange(field.key, event.target.value)
                              }
                              className={metaAdsInputLg}
                            />
                          </label>
                        ))}
                        {ruleGroupDraft.scope === 'global' && (
                          <label className="flex flex-col gap-1 text-xs text-slate-600 dark:text-slate-300">
                            <RuleFieldLabel
                              localize={localize}
                              labelKey="com_ui_project_meta_ads_max_frequency_alert"
                              hintKey="com_ui_project_meta_ads_max_frequency_alert_hint"
                            />
                            <input
                              aria-label={localize('com_ui_project_meta_ads_max_frequency_alert')}
                              type="number"
                              min="0"
                              step="0.01"
                              value={ruleGroupDraft.creativeRules.maxFrequency}
                              onChange={(event) =>
                                onRuleGroupCreativeRuleChange('maxFrequency', event.target.value)
                              }
                              className={metaAdsInputLg}
                            />
                          </label>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 border-t border-slate-200/75 p-4 dark:border-white/10">
                    <button
                      type="button"
                      onClick={() => setRuleGroupDraft(null)}
                      className={metaAdsGhostButton}
                    >
                      {localize('com_ui_cancel')}
                    </button>
                    <button
                      type="button"
                      disabled={updateSettings.isLoading}
                      onClick={onSaveRuleGroup}
                      className={metaAdsPrimaryButton}
                    >
                      {localize('com_ui_project_meta_ads_save_rule_group')}
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="border-t border-slate-200/70 bg-white/35 p-4 dark:border-white/10 dark:bg-slate-950/10">
              <div className="mb-3 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
                    {localize('com_ui_project_meta_ads_rules_workspace')}
                  </h4>
                  <p className="mt-1 max-w-[64ch] text-xs leading-5 text-slate-500 dark:text-slate-400">
                    {localize('com_ui_project_meta_ads_rules_workspace_hint')}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={!canCreateRuleGroup}
                  onClick={onOpenRuleGroupDraft}
                  className={metaAdsPrimaryButton}
                >
                  {localize('com_ui_project_meta_ads_create_rule_group')}
                </button>
              </div>
              <div className="overflow-x-auto rounded-2xl border border-slate-200/80 bg-white/80 dark:border-white/10 dark:bg-white/[0.045]">
                <table className="w-full min-w-[980px] table-fixed border-separate border-spacing-0 text-left text-xs">
                  <thead className="bg-slate-50/90 text-[10px] uppercase tracking-[0.12em] text-slate-500 dark:bg-white/[0.035] dark:text-slate-400">
                    <tr>
                      <th className="w-20 border-b border-slate-200/70 px-3 py-2 dark:border-white/10">
                        {localize('com_ui_project_meta_ads_status')}
                      </th>
                      <th className="w-36 border-b border-slate-200/70 px-3 py-2 dark:border-white/10">
                        {localize('com_ui_project_meta_ads_rule_type')}
                      </th>
                      <th className="w-64 border-b border-slate-200/70 px-3 py-2 dark:border-white/10">
                        {localize('com_ui_project_meta_ads_rule_scope')}
                      </th>
                      <th className="w-36 border-b border-slate-200/70 px-3 py-2 dark:border-white/10">
                        {localize('com_ui_project_meta_ads_target_result_type')}
                      </th>
                      <th className="w-28 border-b border-slate-200/70 px-3 py-2 dark:border-white/10">
                        {localize('com_ui_project_meta_ads_primary_metric')}
                      </th>
                      <th className="w-32 border-b border-slate-200/70 px-3 py-2 text-right dark:border-white/10">
                        {localize('com_ui_project_meta_ads_cpa_roas')}
                      </th>
                      <th className="w-36 border-b border-slate-200/70 px-3 py-2 text-right dark:border-white/10">
                        {localize('com_ui_project_meta_ads_budget_range')}
                      </th>
                      <th className="w-24 border-b border-slate-200/70 px-3 py-2 text-right dark:border-white/10">
                        {localize('com_ui_project_meta_ads_cooldown')}
                      </th>
                      <th className="w-32 border-b border-slate-200/70 px-3 py-2 text-right dark:border-white/10">
                        {localize('com_ui_project_meta_ads_actions')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {ruleRows.map((row) => (
                      <tr
                        key={row.key}
                        data-testid="meta-ads-rule-row"
                        className="group bg-white/60 transition duration-200 odd:bg-slate-50/60 hover:bg-teal-50/70 dark:bg-white/[0.035] dark:odd:bg-white/[0.055] dark:hover:bg-teal-300/[0.08]"
                      >
                        <td className="border-b border-white/[0.06] px-3 py-2">
                          <button
                            type="button"
                            disabled={!canUseMetaAdsActions || updateSettings.isLoading}
                            aria-label={
                              row.enabled
                                ? localize('com_ui_project_meta_ads_disable_rule')
                                : localize('com_ui_project_meta_ads_enable_rule')
                            }
                            onClick={() => onToggleRuleRow(row)}
                            className={`inline-flex h-7 items-center gap-1 rounded-lg border px-2 font-semibold transition ${
                              row.enabled
                                ? 'border-emerald-300/45 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-300/30 dark:bg-emerald-300/10 dark:text-emerald-100 dark:hover:bg-emerald-300/15'
                                : 'border-amber-300/45 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-300/30 dark:bg-amber-300/10 dark:text-amber-100 dark:hover:bg-amber-300/15'
                            } disabled:cursor-not-allowed disabled:opacity-50`}
                          >
                            {row.enabled ? <Pause size={14} /> : <Play size={14} />}
                            {localize(
                              row.enabled
                                ? 'com_ui_project_meta_ads_rule_enabled'
                                : 'com_ui_project_meta_ads_rule_disabled',
                            )}
                          </button>
                        </td>
                        <td className="border-b border-white/[0.06] px-3 py-2">
                          <div className="font-semibold text-slate-900 dark:text-white">
                            {localize(getRuleRowTypeLabelKey(row.type))}
                          </div>
                          <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                            {row.precedenceLabel}
                          </div>
                        </td>
                        <td className="border-b border-white/[0.06] px-3 py-2">
                          <div className="truncate font-semibold text-slate-900 dark:text-white">
                            {row.name}
                          </div>
                          <div className="mt-0.5 truncate text-[11px] text-slate-500 dark:text-slate-400">
                            {row.scopeLabel}
                          </div>
                        </td>
                        <td className="border-b border-slate-200/60 px-3 py-2 text-slate-600 dark:border-white/[0.06] dark:text-slate-300">
                          {getResultTypeLabel(row.rules.targetResultType, localize)}
                        </td>
                        <td className="border-b border-slate-200/60 px-3 py-2 font-mono uppercase text-slate-900 dark:border-white/[0.06] dark:text-white">
                          {row.rules.primaryMetric ?? 'cpa'}
                        </td>
                        <td className="border-b border-slate-200/60 px-3 py-2 text-right font-mono text-slate-900 dark:border-white/[0.06] dark:text-white">
                          {formatMoney(row.rules.targetCpa, currency)} /{' '}
                          {formatMetric(row.rules.minRoas)}
                        </td>
                        <td className="border-b border-slate-200/60 px-3 py-2 text-right font-mono text-slate-900 dark:border-white/[0.06] dark:text-white">
                          {formatMoney(row.rules.minDailyBudget, currency)} -{' '}
                          {formatMoney(row.rules.maxDailyBudget, currency)}
                        </td>
                        <td className="border-b border-slate-200/60 px-3 py-2 text-right font-mono text-slate-900 dark:border-white/[0.06] dark:text-white">
                          {localize('com_ui_project_meta_ads_cooldown_hours_value', {
                            0: String(row.rules.cooldownHours),
                          })}
                        </td>
                        <td className="border-b border-white/[0.06] px-3 py-2">
                          <div className="flex justify-end gap-1">
                            <button
                              type="button"
                              disabled={!canUseMetaAdsActions}
                              aria-label={localize('com_ui_project_meta_ads_edit_rule')}
                              onClick={() => {
                                if (row.type === 'global') {
                                  onEditGlobalRule();
                                  return;
                                }
                                if (row.group) {
                                  onEditRuleGroup(row.group);
                                  return;
                                }
                                if (row.override) {
                                  onEditRuleOverride(row.override);
                                }
                              }}
                              className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:border-teal-300/60 hover:text-teal-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:text-slate-300 dark:hover:border-teal-300/40 dark:hover:text-white"
                            >
                              <PencilSimple size={15} />
                            </button>
                            {row.type !== 'global' && (
                              <button
                                type="button"
                                disabled={!canUseMetaAdsActions}
                                aria-label={localize('com_ui_project_meta_ads_delete_rule')}
                                onClick={() => {
                                  if (row.group) {
                                    onDeleteRuleGroup(row.group.id);
                                    return;
                                  }
                                  if (row.override) {
                                    onDeleteRuleOverride(row.override);
                                  }
                                }}
                                className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:border-red-300/60 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:text-slate-300 dark:hover:border-red-300/40 dark:hover:text-red-100"
                              >
                                <Trash size={15} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {ruleRows.length === 1 && (
                <div className="rounded-b-2xl border-x border-b border-dashed border-slate-200/80 px-3 py-4 text-xs text-slate-500 dark:border-white/10 dark:text-slate-400">
                  {localize('com_ui_project_meta_ads_rules_empty')}
                </div>
              )}
            </div>

            <div
              ref={tableScrollRef}
              onScroll={onTableScroll}
              className="max-w-full overflow-x-auto bg-white/55 dark:bg-slate-950/20"
            >
              <table
                className={`w-full ${tableViewMinWidth[tableView]} table-fixed border-separate border-spacing-0 text-left text-xs [&_td:last-child]:border-r-0 [&_td]:border-r [&_td]:border-slate-200/60 dark:[&_td]:border-white/[0.06] [&_th:last-child]:border-r-0 [&_th]:border-r [&_th]:border-slate-200/70 dark:[&_th]:border-white/10`}
              >
                <thead className="sticky top-0 z-30 border-b border-slate-200 bg-slate-100/95 text-[11px] uppercase tracking-[0.12em] text-slate-500 shadow-[0_16px_36px_-32px_rgba(15,23,42,0.45)] backdrop-blur dark:border-white/10 dark:bg-[#1a2438]/95 dark:text-slate-400 dark:shadow-[0_16px_40px_-32px_rgba(0,0,0,0.9)]">
                  <tr>
                    <th className="sticky left-0 z-40 w-10 border-b border-slate-200 bg-slate-100/95 px-2 py-3 dark:border-white/10 dark:bg-[#1a2438]">
                      <span className="sr-only">
                        {localize('com_ui_project_meta_ads_select_ad_set')}
                      </span>
                    </th>
                    <th className="sticky left-10 z-40 w-10 border-b border-slate-200 bg-slate-100/95 px-2 py-3 shadow-[10px_0_18px_-18px_rgba(20,184,166,0.55)] dark:border-white/10 dark:bg-[#1a2438]">
                      <span className="sr-only">
                        {localize('com_ui_project_meta_ads_expand_campaign')}
                      </span>
                    </th>
                    {tableColumns.map((column) => {
                      const label =
                        column.label ?? (column.labelKey ? localize(column.labelKey) : '');
                      const alignClass = column.align === 'right' ? 'text-right' : '';
                      const stickyClass =
                        column.key === 'adStatus'
                          ? 'sticky left-20 z-40 bg-slate-100/95 dark:bg-[#1a2438]'
                          : column.key === 'name'
                            ? 'sticky left-32 z-40 bg-slate-100/95 shadow-[14px_0_26px_-22px_rgba(15,23,42,0.45)] dark:bg-[#1a2438] dark:shadow-[14px_0_26px_-22px_rgba(0,0,0,0.9)]'
                            : '';
                      return (
                        <th
                          key={column.key}
                          className={`${column.widthClass} ${alignClass} ${stickyClass} border-b border-slate-200 px-3 py-3 dark:border-white/10`}
                        >
                          {column.key === 'actions' || column.key === 'adStatus' ? (
                            <span className="sr-only">{label}</span>
                          ) : column.sortableKey ? (
                            renderSortableHeader({
                              key: column.sortableKey,
                              label,
                              className: column.align === 'right' ? 'justify-end text-right' : '',
                              defaultDirection: column.defaultDirection,
                            })
                          ) : (
                            label
                          )}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {isInitialStatusLoading &&
                    Array.from({ length: 5 }).map((_, index) => (
                      <tr
                        key={`meta-ads-row-skeleton-${index}`}
                        data-testid="meta-ads-row-skeleton"
                        className="border-b border-border-light"
                      >
                        <td className="px-2 py-3" colSpan={tableColumnCount}>
                          <div className="flex items-center gap-4">
                            <div className="h-[18px] w-[18px] animate-pulse border border-border-light bg-surface-secondary" />
                            <div className="h-7 w-7 animate-pulse border border-border-light bg-surface-secondary" />
                            <div className="h-4 w-48 animate-pulse bg-surface-secondary" />
                            <div className="h-4 w-28 animate-pulse bg-surface-secondary" />
                            <div className="h-4 w-24 animate-pulse bg-surface-secondary" />
                            <div className="h-4 w-20 animate-pulse bg-surface-secondary" />
                          </div>
                        </td>
                      </tr>
                    ))}
                  {(() => {
                    let rowIndex = 0;
                    return filteredCampaigns.map((campaign) => {
                      const expanded =
                        campaign.budgetMode === 'ABO'
                          ? !collapsedAboCampaignIds.includes(campaign.campaignId)
                          : expandedCampaignIds.includes(campaign.campaignId);
                      const selected = selectedEntityIds.includes(
                        `campaign:${campaign.campaignId}`,
                      );
                      const recommendation = getEntityRecommendation(campaign.campaignId);
                      const campaignRowIndex = rowIndex;
                      rowIndex += 1;

                      return (
                        <Fragment key={campaign.campaignId}>
                          <tr
                            data-testid="meta-ads-campaign-row"
                            className={getTableRowClass(campaignRowIndex, 'campaign')}
                          >
                            <td
                              className={`sticky left-0 z-30 px-2 py-2 align-middle ${metaAdsStickyCell}`}
                            >
                              <input
                                type="checkbox"
                                checked={selected}
                                aria-label={localize('com_ui_project_meta_ads_select_campaign')}
                                onChange={() => onToggleCampaign(campaign)}
                                className="h-4 w-4 border-border-light bg-surface-primary text-text-primary"
                              />
                            </td>
                            <td
                              className={`sticky left-10 z-30 px-2 py-2 align-middle ${metaAdsStickyCell}`}
                            >
                              {campaign.adSets.length > 0 && (
                                <button
                                  type="button"
                                  aria-label={localize('com_ui_project_meta_ads_expand_campaign')}
                                  aria-expanded={expanded}
                                  onClick={() => onToggleCampaignExpanded(campaign)}
                                  className="h-6 w-6 border border-border-light bg-surface-primary font-mono text-xs leading-none text-text-secondary"
                                >
                                  {expanded ? '-' : '+'}
                                </button>
                              )}
                            </td>
                            {tableColumns.map((column) =>
                              renderCampaignCell(column, campaign, recommendation),
                            )}
                          </tr>
                          {expanded &&
                            campaign.adSets.map((adset) => {
                              const adsetSelected = selectedEntityIds.includes(
                                `adset:${adset.entityId}`,
                              );
                              const adsetRecommendation = getEntityRecommendation(adset.entityId);
                              const adsetAds = adset.ads ?? [];
                              const adsCollapsed = collapsedAdSetAdsIds.includes(adset.entityId);
                              const adsetRowIndex = rowIndex;
                              rowIndex += 1;

                              return (
                                <Fragment key={adset.entityId}>
                                  <tr
                                    data-testid="meta-ads-adset-row"
                                    className={getTableRowClass(adsetRowIndex, 'adset')}
                                  >
                                    <td
                                      className={`sticky left-0 z-30 px-2 py-2 pl-6 align-middle ${metaAdsStickyCell}`}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={adsetSelected}
                                        aria-label={localize(
                                          'com_ui_project_meta_ads_select_ad_set',
                                        )}
                                        onChange={() => onToggleAdSet(adset.entityId)}
                                        className="h-4 w-4 border-border-light bg-surface-primary text-text-primary"
                                      />
                                    </td>
                                    <td
                                      className={`sticky left-10 z-30 px-2 py-2 align-middle ${metaAdsStickyCell}`}
                                    >
                                      {adsetAds.length > 0 ? (
                                        <button
                                          type="button"
                                          aria-expanded={!adsCollapsed}
                                          aria-label={localize(
                                            adsCollapsed
                                              ? 'com_ui_project_meta_ads_show_ads'
                                              : 'com_ui_project_meta_ads_hide_ads',
                                          )}
                                          onClick={() => onToggleAdSetAds(adset.entityId)}
                                          className="h-6 w-6 border border-border-light bg-surface-primary font-mono text-xs leading-none text-text-secondary"
                                        >
                                          {adsCollapsed ? '+' : '-'}
                                        </button>
                                      ) : (
                                        <span aria-hidden="true" className="block h-7 w-7" />
                                      )}
                                    </td>
                                    {tableColumns.map((column) =>
                                      renderAdSetCell(column, campaign, adset, adsetRecommendation),
                                    )}
                                  </tr>
                                  {!adsCollapsed &&
                                    adsetAds.map((ad) => {
                                      const adRowIndex = rowIndex;
                                      rowIndex += 1;
                                      return renderAdRow(campaign, ad, adRowIndex);
                                    })}
                                </Fragment>
                              );
                            })}
                        </Fragment>
                      );
                    });
                  })()}
                </tbody>
              </table>
              {filteredCampaigns.length === 0 && !isInitialStatusLoading && (
                <div className="border-t border-dashed border-border-light py-8 text-center text-sm text-text-secondary">
                  {localize('com_ui_project_meta_ads_no_snapshots')}
                </div>
              )}
            </div>
            <div className="sticky bottom-0 z-20 border-t border-slate-200/70 bg-white/80 px-4 py-2 backdrop-blur dark:border-white/10 dark:bg-[#152033]/80">
              <div
                ref={stickyHorizontalScrollRef}
                onScroll={onStickyHorizontalScroll}
                className="max-w-full overflow-x-auto"
                aria-hidden="true"
              >
                <div className={`h-2 w-full ${tableViewMinWidth[tableView]}`} />
              </div>
            </div>
          </div>
        )}

        {workspaceTab === 'bi' && (
          <div
            id="meta-ads-bi-tab-panel"
            role="tabpanel"
            aria-labelledby="meta-ads-tab-bi"
            data-testid="meta-ads-bi-tab-panel"
          >
            <div className="p-4">
              <div className="mb-4 rounded-2xl border border-slate-200/80 bg-white/70 p-4 shadow-[0_16px_48px_-42px_rgba(15,23,42,0.42)] backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.045]">
                <div>
                  <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
                    {localize('com_ui_project_meta_ads_bi_rankings')}
                  </h4>
                  <p className="mt-1 max-w-[64ch] text-xs leading-5 text-slate-500 dark:text-slate-400">
                    {localize('com_ui_project_meta_ads_bi_rankings_hint')}
                  </p>
                </div>
                <div className="mt-4 grid min-w-0 gap-2 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
                  <label className="flex min-w-40 flex-col gap-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
                    {localize('com_ui_project_meta_ads_period')}
                    <select
                      data-testid="meta-ads-bi-period-filter"
                      value={periodFilter}
                      onChange={(event) => setPeriodFilter(event.target.value as PeriodFilter)}
                      className={metaAdsInput}
                    >
                      {periodFilterOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {localize(option.labelKey)}
                        </option>
                      ))}
                    </select>
                  </label>
                  {periodFilter === 'custom' && (
                    <>
                      <label className="flex min-w-40 flex-col gap-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
                        {localize('com_ui_project_meta_ads_period_since')}
                        <input
                          type="date"
                          value={customSince}
                          max={customUntil || undefined}
                          onChange={(event) => onCustomSinceChange(event.target.value)}
                          className={metaAdsInput}
                        />
                      </label>
                      <label className="flex min-w-40 flex-col gap-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
                        {localize('com_ui_project_meta_ads_period_until')}
                        <input
                          type="date"
                          value={customUntil}
                          min={customSince || undefined}
                          onChange={(event) => onCustomUntilChange(event.target.value)}
                          className={metaAdsInput}
                        />
                      </label>
                      <div className="flex min-w-32 flex-col justify-end">
                        <button
                          type="button"
                          disabled={
                            customSince === appliedCustomSince && customUntil === appliedCustomUntil
                          }
                          onClick={onApplyCustomPeriod}
                          className="h-10 rounded-xl border border-teal-300/50 bg-teal-50 px-3 text-xs font-semibold text-teal-800 transition hover:bg-teal-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 dark:border-teal-300/30 dark:bg-teal-300/10 dark:text-teal-100 dark:hover:bg-teal-300/15 dark:disabled:border-white/10 dark:disabled:bg-white/[0.03] dark:disabled:text-slate-600"
                        >
                          {localize('com_ui_project_meta_ads_period_update')}
                        </button>
                      </div>
                    </>
                  )}
                  <label className="flex min-w-40 flex-col gap-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
                    {localize('com_ui_project_meta_ads_level')}
                    <select
                      data-testid="meta-ads-bi-level-filter"
                      value={biControls.level}
                      onChange={(event) =>
                        setBiControls((current) => ({
                          ...current,
                          level: event.target.value as MetaAdsBiRankLevel,
                        }))
                      }
                      className={metaAdsInput}
                    >
                      <option value="campaign">
                        {localize('com_ui_project_meta_ads_level_campaign')}
                      </option>
                      <option value="adset">
                        {localize('com_ui_project_meta_ads_level_ad_set')}
                      </option>
                      <option value="ad">{localize('com_ui_project_meta_ads_level_ad')}</option>
                    </select>
                  </label>
                  <label className="flex min-w-48 flex-col gap-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
                    {localize('com_ui_project_meta_ads_objective')}
                    <select
                      data-testid="meta-ads-bi-objective-filter"
                      value={biControls.objective}
                      onChange={(event) =>
                        setBiControls((current) => ({
                          ...current,
                          objective: event.target.value,
                        }))
                      }
                      className={metaAdsInput}
                    >
                      <option value="all">{localize('com_ui_project_meta_ads_filter_all')}</option>
                      {objectiveOptions.map((objective) => (
                        <option key={objective} value={objective}>
                          {getObjectiveLabel(objective, localize)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex min-w-48 flex-col gap-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
                    {localize('com_ui_project_meta_ads_target_result_type')}
                    <select
                      data-testid="meta-ads-bi-result-type-filter"
                      value={biControls.resultType}
                      onChange={(event) =>
                        setBiControls((current) => ({
                          ...current,
                          resultType: event.target.value,
                        }))
                      }
                      className={metaAdsInput}
                    >
                      <option value="all">{localize('com_ui_project_meta_ads_filter_all')}</option>
                      {biResultTypeOptions.map((resultType) => (
                        <option key={resultType} value={resultType}>
                          {getResultTypeLabel(resultType, localize)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex min-w-40 flex-col gap-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
                    {localize('com_ui_project_meta_ads_metric')}
                    <select
                      data-testid="meta-ads-bi-metric-filter"
                      value={biControls.metric}
                      onChange={(event) =>
                        setBiControls((current) => ({
                          ...current,
                          metric: event.target.value as EvolutionMetric,
                        }))
                      }
                      className={metaAdsInput}
                    >
                      <option value="spend">{localize('com_ui_project_meta_ads_spend')}</option>
                      <option value="resultCount">
                        {localize('com_ui_project_meta_ads_results')}
                      </option>
                      <option value="cpa">{localize('com_ui_project_meta_ads_cpa')}</option>
                      <option value="ctr">{localize('com_ui_project_meta_ads_ctr')}</option>
                      <option value="frequency">
                        {localize('com_ui_project_meta_ads_frequency')}
                      </option>
                      <option value="clicks">{localize('com_ui_project_meta_ads_clicks')}</option>
                    </select>
                  </label>
                </div>
              </div>
              {renderBiRankingCard(
                selectedBiRankingTitleKey,
                selectedBiRankingItems,
                selectedBiRankingTestId,
                biControls.level === 'ad'
                  ? adRankingEmptyMessageKey
                  : 'com_ui_project_meta_ads_bi_no_rankings',
              )}
            </div>

            {hasEvolutionSection && (
              <div className="px-4 pb-4">
                <h4 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">
                  {localize('com_ui_project_meta_ads_evolution_analysis')}
                </h4>
                <div data-testid="meta-ads-evolution-dashboard" className="grid gap-3">
                  <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-4 shadow-[0_18px_58px_-46px_rgba(15,23,42,0.42)] backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.045]">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <h5 className="text-sm font-semibold text-slate-900 dark:text-white">
                          {localize('com_ui_project_meta_ads_evolution_comparison')}
                        </h5>
                        <p className="mt-1 max-w-[62ch] text-xs leading-5 text-slate-500 dark:text-slate-400">
                          {localize('com_ui_project_meta_ads_evolution_comparison_hint')}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-4">
                      {[
                        [
                          'com_ui_project_meta_ads_metric' as TranslationKeys,
                          getEvolutionMetricLabel(biControls.metric, localize),
                        ],
                        [
                          'com_ui_project_meta_ads_series' as TranslationKeys,
                          formatIntegerMetric(evolutionSeries.length),
                        ],
                        [
                          'com_ui_project_meta_ads_peak_value' as TranslationKeys,
                          formatEvolutionMetricValue(
                            maxEvolutionValue,
                            biControls.metric,
                            currency,
                          ),
                        ],
                        [
                          'com_ui_project_meta_ads_budget_changes' as TranslationKeys,
                          formatIntegerMetric(totalBudgetChangeCount),
                        ],
                      ]
                        .filter(
                          ([labelKey]) =>
                            biControls.level !== 'ad' ||
                            labelKey !== 'com_ui_project_meta_ads_budget_changes',
                        )
                        .map(([labelKey, value]) => (
                          <div
                            key={labelKey}
                            className="rounded-xl border border-slate-200/75 bg-slate-50/75 p-3 dark:border-white/10 dark:bg-white/[0.035]"
                          >
                            <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
                              {localize(labelKey as TranslationKeys)}
                            </div>
                            <div
                              className="mt-1 truncate font-mono text-sm font-semibold text-slate-900 dark:text-white"
                              title={value}
                            >
                              {value}
                            </div>
                          </div>
                        ))}
                    </div>
                    <div className="relative mt-4 h-56 rounded-2xl border border-slate-200/70 bg-slate-50/70 p-2 dark:border-white/10 dark:bg-slate-950/20">
                      {canRenderEvolutionSeries ? (
                        <svg
                          data-testid="meta-ads-evolution-chart"
                          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                          role="img"
                          aria-label={localize('com_ui_project_meta_ads_evolution_comparison')}
                          className="h-full w-full text-slate-700 dark:text-slate-100"
                          preserveAspectRatio="none"
                        >
                          {[0.25, 0.5, 0.75].map((line) => (
                            <line
                              key={line}
                              x1={chartPadding}
                              x2={chartWidth - chartPadding}
                              y1={chartBottom - line * (chartHeight - chartPadding * 2)}
                              y2={chartBottom - line * (chartHeight - chartPadding * 2)}
                              stroke="currentColor"
                              strokeOpacity="0.08"
                              vectorEffect="non-scaling-stroke"
                            />
                          ))}
                          {evolutionSeriesPaths.map((seriesPath) => (
                            <Fragment key={seriesPath.series.entityId}>
                              <path
                                d={seriesPath.path}
                                fill="none"
                                stroke={seriesPath.color}
                                strokeWidth="2.2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                vectorEffect="non-scaling-stroke"
                              />
                            </Fragment>
                          ))}
                        </svg>
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-sm text-slate-500 dark:text-slate-400">
                          {localize('com_ui_project_meta_ads_insufficient_evolution')}
                        </div>
                      )}
                      {canRenderEvolutionSeries &&
                        evolutionSeriesPaths.flatMap((seriesPath) =>
                          seriesPath.points.map((point) => {
                            const entityName = cleanDashboardName(
                              seriesPath.series.entityName,
                              seriesPath.series.entityId,
                            );
                            const hoverPoint: EvolutionHoverPoint = {
                              seriesId: seriesPath.series.entityId,
                              entityName,
                              parentCampaignName: seriesPath.series.parentCampaignName,
                              date: point.date,
                              value: point.value,
                              x: point.x,
                              y: point.y,
                              color: seriesPath.color,
                              point: point.rawPoint,
                            };
                            return (
                              <button
                                key={`${seriesPath.series.entityId}:${point.date}`}
                                type="button"
                                data-testid="meta-ads-evolution-point"
                                data-date={point.date}
                                data-entity-id={seriesPath.series.entityId}
                                aria-label={`${entityName} ${formatTrendDate(point.date)}`}
                                className="absolute z-20 flex h-5 w-5 -translate-x-1/2 -translate-y-1/2 cursor-crosshair items-center justify-center rounded-full outline-none transition duration-150 hover:scale-125 focus:ring-2 focus:ring-teal-300/60"
                                style={{
                                  left: `${(point.x / chartWidth) * 100}%`,
                                  top: `${(point.y / chartHeight) * 100}%`,
                                }}
                                onMouseEnter={() => setHoveredEvolutionPoint(hoverPoint)}
                                onMouseLeave={() => setHoveredEvolutionPoint(null)}
                                onFocus={() => setHoveredEvolutionPoint(hoverPoint)}
                                onBlur={() => setHoveredEvolutionPoint(null)}
                              >
                                <span
                                  aria-hidden="true"
                                  className="h-2.5 w-2.5 rounded-full shadow-[0_0_0_2px_rgba(255,255,255,0.85)] dark:shadow-[0_0_0_2px_rgba(15,23,42,0.9)]"
                                  style={{ backgroundColor: seriesPath.color }}
                                />
                              </button>
                            );
                          }),
                        )}
                      {hoveredEvolutionPoint && canRenderEvolutionSeries && (
                        <div
                          data-testid="meta-ads-evolution-point-tooltip"
                          className="pointer-events-none absolute z-[1000] min-w-48 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 shadow-[0_18px_60px_-32px_rgba(15,23,42,0.45)] dark:border-teal-300/25 dark:bg-[#101827] dark:text-teal-100 dark:shadow-xl"
                          style={{
                            left: `${(hoveredEvolutionPoint.x / chartWidth) * 100}%`,
                            top: `${(hoveredEvolutionPoint.y / chartHeight) * 100}%`,
                            maxWidth: 'min(18rem, calc(100% - 1rem))',
                            overflowWrap: 'anywhere',
                            transform: getEvolutionTooltipTransform(hoveredEvolutionPoint),
                          }}
                        >
                          <div className="flex items-center gap-2">
                            <span
                              aria-hidden="true"
                              className="h-2 w-2 shrink-0"
                              style={{ backgroundColor: hoveredEvolutionPoint.color }}
                            />
                            <span className="truncate font-semibold text-slate-950 dark:text-white">
                              {hoveredEvolutionPoint.entityName}
                            </span>
                          </div>
                          {hoveredEvolutionPoint.parentCampaignName && (
                            <div className="mt-1 truncate text-[11px] text-slate-500 dark:text-slate-300">
                              {hoveredEvolutionPoint.parentCampaignName}
                            </div>
                          )}
                          <div className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 font-mono">
                            <span className="text-slate-500 dark:text-slate-400">
                              {formatTrendDate(hoveredEvolutionPoint.date)}
                            </span>
                            <span className="text-right text-slate-950 dark:text-white">
                              {formatEvolutionMetricValue(
                                hoveredEvolutionPoint.value,
                                biControls.metric,
                                currency,
                              )}
                            </span>
                            <span className="text-slate-500 dark:text-slate-400">
                              {localize('com_ui_project_meta_ads_results')}
                            </span>
                            <span className="text-right text-slate-950 dark:text-white">
                              {formatMetric(hoveredEvolutionPoint.point?.resultCount)}
                            </span>
                            <span className="text-slate-500 dark:text-slate-400">
                              {localize('com_ui_project_meta_ads_spend')}
                            </span>
                            <span className="text-right text-slate-950 dark:text-white">
                              {formatMoney(hoveredEvolutionPoint.point?.spend, currency)}
                            </span>
                            <span className="text-slate-500 dark:text-slate-400">
                              {localize('com_ui_project_meta_ads_cpa')}
                            </span>
                            <span className="text-right text-slate-950 dark:text-white">
                              {formatMoney(hoveredEvolutionPoint.point?.cpa, currency)}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="mt-2 flex justify-between gap-3 text-[11px] text-slate-500 dark:text-slate-400">
                      {evolutionDates.map((date, index) =>
                        shouldShowTrendLabel(index, evolutionDates.length) ? (
                          <span key={date} className="font-mono">
                            {formatTrendDate(date)}
                          </span>
                        ) : null,
                      )}
                    </div>
                    <div className="mt-3 grid gap-2 md:grid-cols-2">
                      {evolutionSeriesPaths.map((seriesPath) => {
                        const name = cleanDashboardName(
                          seriesPath.series.entityName,
                          seriesPath.series.entityId,
                        );
                        return (
                          <div
                            key={seriesPath.series.entityId}
                            className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-slate-200/75 bg-white/70 px-3 py-2 dark:border-white/10 dark:bg-white/[0.035]"
                          >
                            <div className="flex min-w-0 items-center gap-2">
                              <span
                                className="h-2.5 w-2.5 shrink-0"
                                style={{ backgroundColor: seriesPath.color }}
                              />
                              <div className="min-w-0">
                                <div className="group relative min-w-0">
                                  <div className="truncate text-xs font-semibold text-slate-900 dark:text-white">
                                    {name}
                                  </div>
                                  {renderNameTooltip(name)}
                                </div>
                                {seriesPath.series.parentCampaignName && (
                                  <div className="truncate text-[10px] text-slate-500 dark:text-slate-400">
                                    {cleanDashboardName(
                                      seriesPath.series.parentCampaignName,
                                      seriesPath.series.parentCampaignName,
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="font-mono text-xs font-semibold text-slate-900 dark:text-white">
                              {formatEvolutionMetricValue(
                                seriesPath.series.total,
                                biControls.metric,
                                currency,
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div
                    className={`grid gap-3 ${biControls.level === 'ad' ? '' : 'md:grid-cols-2'}`}
                  >
                    <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white dark:border-white/10 dark:bg-[#172033]">
                      <div className="border-b border-slate-200/70 bg-slate-50 px-4 py-3 dark:border-white/10 dark:bg-[#121a2b]">
                        <h5 className="text-sm font-semibold text-slate-900 dark:text-white">
                          {localize('com_ui_project_meta_ads_best_evolution')}
                        </h5>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[34rem] text-left text-xs">
                          <thead className="border-b border-slate-200/70 bg-slate-50 text-[10px] uppercase tracking-[0.12em] text-slate-500 dark:border-white/10 dark:bg-[#121a2b] dark:text-slate-400">
                            <tr>
                              <th className="px-3 py-2">
                                {localize('com_ui_project_meta_ads_campaign')}
                              </th>
                              <th className="px-3 py-2 text-right">
                                {localize('com_ui_project_meta_ads_spend_delta')}
                              </th>
                              <th className="px-3 py-2 text-right">
                                {localize('com_ui_project_meta_ads_results_delta')}
                              </th>
                              <th className="px-3 py-2 text-right">
                                {localize('com_ui_project_meta_ads_cpa_delta')}
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200/70 dark:divide-white/10">
                            {bestEvolution.length > 0 ? (
                              bestEvolution.map((delta) => {
                                const entityId = getDeltaEntityId(delta);
                                const name = cleanDashboardName(
                                  getDeltaEntityName(delta),
                                  entityId,
                                );
                                return (
                                  <tr
                                    key={entityId}
                                    className="odd:bg-slate-50/80 dark:odd:bg-[#1b263b]"
                                  >
                                    {renderEvolutionNameCell(name)}
                                    <td
                                      className={`px-3 py-2.5 text-right font-mono ${renderEvolutionDeltaClass(
                                        delta.spendDelta,
                                      )}`}
                                    >
                                      {formatSignedMoney(delta.spendDelta, currency)}
                                    </td>
                                    <td
                                      className={`px-3 py-2.5 text-right font-mono ${renderEvolutionDeltaClass(
                                        delta.resultDelta,
                                      )}`}
                                    >
                                      {formatSignedMetric(delta.resultDelta)}
                                    </td>
                                    <td
                                      className={`px-3 py-2.5 text-right font-mono ${renderEvolutionDeltaClass(
                                        delta.cpaDelta,
                                        true,
                                      )}`}
                                    >
                                      {formatSignedMoney(delta.cpaDelta, currency)}
                                    </td>
                                  </tr>
                                );
                              })
                            ) : (
                              <tr>
                                <td
                                  colSpan={4}
                                  className="px-3 py-5 text-sm text-slate-500 dark:text-slate-400"
                                >
                                  {localize('com_ui_project_meta_ads_no_evolution')}
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white/75 dark:border-white/10 dark:bg-white/[0.04]">
                      <div className="border-b border-slate-200/70 px-4 py-3 dark:border-white/10">
                        <h5 className="text-sm font-semibold text-slate-900 dark:text-white">
                          {localize('com_ui_project_meta_ads_budget_changes')}
                        </h5>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[34rem] text-left text-xs">
                          <thead className="border-b border-slate-200/70 bg-slate-50/70 text-[10px] uppercase tracking-[0.12em] text-slate-500 dark:border-white/10 dark:bg-white/[0.035] dark:text-slate-400">
                            <tr>
                              <th className="px-3 py-2">
                                {localize('com_ui_project_meta_ads_name')}
                              </th>
                              <th className="px-3 py-2 text-right">
                                {localize('com_ui_project_meta_ads_budget_delta')}
                              </th>
                              <th className="px-3 py-2 text-right">
                                {localize('com_ui_project_meta_ads_frequency_delta')}
                              </th>
                              <th className="px-3 py-2">
                                {localize('com_ui_project_meta_ads_actor')}
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/10">
                            {evolutionAlerts.length > 0 ? (
                              evolutionAlerts.map((delta) => {
                                const entityId = getDeltaEntityId(delta);
                                const name = cleanDashboardName(
                                  delta.latestChange?.entityName ?? getDeltaEntityName(delta),
                                  entityId,
                                );
                                const budgetDelta =
                                  delta.latestChange?.deltaDailyBudget ?? delta.budgetDelta;
                                return (
                                  <tr key={entityId} className="odd:bg-white/[0.025]">
                                    {renderEvolutionNameCell(name)}
                                    <td
                                      className={`px-3 py-2.5 text-right font-mono ${renderEvolutionDeltaClass(
                                        budgetDelta,
                                      )}`}
                                    >
                                      {formatSignedMoney(budgetDelta, currency)}
                                    </td>
                                    <td
                                      className={`px-3 py-2.5 text-right font-mono ${renderEvolutionDeltaClass(
                                        delta.frequencyDelta,
                                        true,
                                      )}`}
                                    >
                                      {formatSignedMetric(delta.frequencyDelta)}
                                    </td>
                                    <td className="px-3 py-2.5 text-slate-500 dark:text-slate-400">
                                      {delta.latestChange?.actor ?? '-'}
                                    </td>
                                  </tr>
                                );
                              })
                            ) : (
                              <tr>
                                <td
                                  colSpan={4}
                                  className="px-3 py-5 text-sm text-slate-500 dark:text-slate-400"
                                >
                                  {localize('com_ui_project_meta_ads_no_history')}
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {workspaceTab === 'overview' && (
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_18px_58px_-46px_rgba(15,23,42,0.42)] dark:border-white/10 dark:bg-[#172033]">
          <div className="border-b border-slate-200/70 bg-slate-50 px-4 py-3 dark:border-white/10 dark:bg-[#121a2b]">
            <h4 className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
              {localize('com_ui_project_meta_ads_history')}
            </h4>
          </div>
          <div className="space-y-2 p-4">
            {(biStatusQuery.data?.changes ?? statusQuery.data?.changes ?? []).length > 0 ? (
              (biStatusQuery.data?.changes ?? statusQuery.data?.changes ?? [])
                .slice(0, 8)
                .map((change) => {
                  const delta = getBudgetChangeDelta(change);
                  return (
                    <div
                      key={change._id ?? `${change.entityId}-${change.createdAt}`}
                      className="flex flex-col gap-1 rounded-2xl border border-slate-200/80 bg-slate-50 p-3 text-sm dark:border-white/10 dark:bg-[#121a2b] sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <div className="truncate font-medium text-slate-950 dark:text-white">
                          {change.entityName ?? change.entityId}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {change.actor ?? '-'} · {change.reason ?? '-'}
                        </div>
                      </div>
                      <div className="text-left sm:text-right">
                        <div className="font-mono text-xs text-slate-600 dark:text-slate-300">
                          {formatMoney(change.previousDailyBudget, currency)}
                          {' -> '}
                          {formatMoney(change.newDailyBudget, currency)}
                        </div>
                        {delta.deltaDailyBudget != null && (
                          <div className="mt-1 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                            {`${formatSignedMoney(delta.deltaDailyBudget, currency)} · ${formatSignedPercent(delta.deltaPercent)}`}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 py-6 text-center text-sm text-slate-500 dark:border-white/15 dark:text-slate-400">
                {localize('com_ui_project_meta_ads_no_history')}
              </div>
            )}
          </div>
        </div>
      )}

      <OGDialog
        open={Boolean(selectedAdPreview)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedAdPreview(null);
          }
        }}
      >
        {selectedAdPreview && (
          <OGDialogContent
            className={`max-w-3xl p-0 ${metaAdsModalShell}`}
            overlayStyle={metricsFullscreen ? { zIndex: 10010 } : undefined}
            style={metricsFullscreen ? { zIndex: 10020 } : undefined}
          >
            <OGDialogHeader className={metaAdsModalHeader}>
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                {localize('com_ui_project_meta_ads_ad_preview')}
              </div>
              <OGDialogTitle className="mt-1 text-base font-semibold text-slate-950 dark:text-white">
                {selectedAdPreview.adName ?? selectedAdPreview.title ?? selectedAdPreview.adId}
              </OGDialogTitle>
              <div className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">
                {selectedAdPreview.adId}
              </div>
            </OGDialogHeader>
            <div className="grid gap-0 bg-white dark:bg-[#101827] sm:grid-cols-[minmax(220px,280px)_1fr]">
              <div className="border-b border-slate-200/75 bg-slate-50/70 p-5 dark:border-white/10 dark:bg-white/[0.035] sm:border-b-0 sm:border-r">
                <button
                  type="button"
                  aria-label={localize(
                    selectedAdPreview.adsManagerUrl
                      ? 'com_ui_project_meta_ads_open_meta_ads'
                      : 'com_ui_project_meta_ads_manager_unavailable',
                  )}
                  title={localize(
                    selectedAdPreview.adsManagerUrl
                      ? 'com_ui_project_meta_ads_open_meta_ads'
                      : 'com_ui_project_meta_ads_manager_unavailable',
                  )}
                  disabled={!selectedAdPreview.adsManagerUrl}
                  onClick={() => {
                    if (!selectedAdPreview.adsManagerUrl) {
                      return;
                    }
                    window.open(selectedAdPreview.adsManagerUrl, '_blank', 'noopener,noreferrer');
                  }}
                  className="group relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-slate-200/80 bg-slate-100 text-left transition hover:border-teal-300/60 focus:outline-none focus:ring-2 focus:ring-teal-300/60 disabled:cursor-not-allowed disabled:hover:border-slate-200/80 dark:border-white/10 dark:bg-slate-950/35 dark:disabled:hover:border-white/10"
                >
                  {getAdThumbnailUrl(selectedAdPreview) ? (
                    <img
                      src={getAdThumbnailUrl(selectedAdPreview)}
                      alt={
                        selectedAdPreview.adName ??
                        selectedAdPreview.title ??
                        selectedAdPreview.adId
                      }
                      className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center px-3 text-center text-xs text-slate-500 dark:text-slate-400">
                      {localize('com_ui_project_meta_ads_no_creative_media')}
                    </div>
                  )}
                  <div className="absolute inset-x-0 bottom-0 bg-black/75 px-3 py-2 text-xs font-semibold text-white">
                    {localize(
                      selectedAdPreview.adsManagerUrl
                        ? 'com_ui_project_meta_ads_open_meta_ads'
                        : 'com_ui_project_meta_ads_manager_unavailable',
                    )}
                  </div>
                </button>
              </div>
              <div className="space-y-5 p-5">
                <div className="grid gap-3 sm:grid-cols-3">
                  {[
                    [
                      'com_ui_project_meta_ads_spend' as TranslationKeys,
                      formatMoney(selectedAdPreview.spend, selectedAdPreview.currency ?? currency),
                    ],
                    [
                      'com_ui_project_meta_ads_cpa' as TranslationKeys,
                      formatMoney(selectedAdPreview.cpa, selectedAdPreview.currency ?? currency),
                    ],
                    [
                      'com_ui_project_meta_ads_results' as TranslationKeys,
                      formatMetric(selectedAdPreview.resultCount),
                    ],
                    [
                      'com_ui_project_meta_ads_ctr' as TranslationKeys,
                      formatPercent(selectedAdPreview.ctr),
                    ],
                    [
                      'com_ui_project_meta_ads_clicks' as TranslationKeys,
                      formatIntegerMetric(selectedAdPreview.clicks),
                    ],
                    [
                      'com_ui_project_meta_ads_frequency' as TranslationKeys,
                      formatMetric(selectedAdPreview.frequency),
                    ],
                    [
                      'com_ui_project_meta_ads_impressions' as TranslationKeys,
                      formatIntegerMetric(selectedAdPreview.impressions),
                    ],
                  ].map(([labelKey, value]) => (
                    <div key={labelKey} className={metaAdsModalTile}>
                      <div className="text-[10px] uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
                        {localize(labelKey as TranslationKeys)}
                      </div>
                      <div className="mt-2 font-mono text-base font-semibold text-slate-950 dark:text-white">
                        {value}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
                  {[
                    [
                      'com_ui_project_meta_ads_title_text' as TranslationKeys,
                      selectedAdPreview.title,
                    ],
                    [
                      'com_ui_project_meta_ads_body_text' as TranslationKeys,
                      selectedAdPreview.body,
                    ],
                    [
                      'com_ui_project_meta_ads_description_text' as TranslationKeys,
                      selectedAdPreview.description,
                    ],
                    [
                      'com_ui_project_meta_ads_link_url' as TranslationKeys,
                      selectedAdPreview.linkUrl,
                    ],
                    [
                      'com_ui_project_meta_ads_call_to_action' as TranslationKeys,
                      selectedAdPreview.callToActionType,
                    ],
                  ]
                    .filter(([, value]) => Boolean(value))
                    .map(([labelKey, value]) => (
                      <div
                        key={labelKey}
                        className="flex items-start justify-between gap-3 border-b border-slate-200/75 py-2 dark:border-white/10"
                      >
                        <span className="shrink-0 text-xs uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
                          {localize(labelKey as TranslationKeys)}
                        </span>
                        <span className="min-w-0 text-right font-medium text-slate-950 dark:text-white">
                          {value}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </OGDialogContent>
        )}
      </OGDialog>

      <OGDialog
        open={Boolean(selectedBiRankItem)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedBiRankItem(null);
          }
        }}
      >
        {selectedBiRankItem && (
          <OGDialogContent className={`max-w-2xl p-0 ${metaAdsModalShell}`}>
            <OGDialogHeader className={metaAdsModalHeader}>
              <div className="flex gap-4">
                {renderRankMedia(selectedBiRankItem, 'lg')}
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                    {localize('com_ui_project_meta_ads_bi_rank_detail')}
                  </div>
                  <OGDialogTitle className="mt-1 text-base font-semibold text-slate-950 dark:text-white">
                    {cleanDashboardName(selectedBiRankItem.name, selectedBiRankItem.id)}
                  </OGDialogTitle>
                  {selectedBiRankItem.parentName && (
                    <div className="truncate text-xs text-slate-500 dark:text-slate-400">
                      {cleanDashboardName(
                        selectedBiRankItem.parentName,
                        selectedBiRankItem.parentName,
                      )}
                    </div>
                  )}
                </div>
              </div>
            </OGDialogHeader>
            <div className="bg-white p-5 dark:bg-[#101827]">
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  [
                    'com_ui_project_meta_ads_cost_per_result' as TranslationKeys,
                    formatRankingCost(getRankEfficiency(selectedBiRankItem), currency),
                  ],
                  [
                    'com_ui_project_meta_ads_results' as TranslationKeys,
                    formatMetric(selectedBiRankItem.resultCount),
                  ],
                  [
                    'com_ui_project_meta_ads_spend' as TranslationKeys,
                    formatMoney(selectedBiRankItem.spend, currency),
                  ],
                ].map(([labelKey, value]) => (
                  <div key={labelKey} className={metaAdsModalTile}>
                    <div className="text-[10px] uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
                      {localize(labelKey as TranslationKeys)}
                    </div>
                    <div className="mt-2 font-mono text-lg font-semibold text-slate-950 dark:text-white">
                      {value}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 grid gap-2 text-sm text-slate-600 dark:text-slate-300 sm:grid-cols-2">
                {[
                  [
                    'com_ui_project_meta_ads_level' as TranslationKeys,
                    selectedBiRankItem.level === 'campaign'
                      ? localize('com_ui_project_meta_ads_level_campaign')
                      : selectedBiRankItem.level === 'adset'
                        ? localize('com_ui_project_meta_ads_level_ad_set')
                        : localize('com_ui_project_meta_ads_level_ad'),
                  ],
                  [
                    'com_ui_project_meta_ads_objective' as TranslationKeys,
                    getObjectiveLabel(selectedBiRankItem.objective, localize),
                  ],
                  [
                    'com_ui_project_meta_ads_target_result_type' as TranslationKeys,
                    getResultTypeLabel(selectedBiRankItem.resultType, localize),
                  ],
                  [
                    'com_ui_project_meta_ads_ctr' as TranslationKeys,
                    formatPercent(selectedBiRankItem.ctr),
                  ],
                ].map(([labelKey, value]) => (
                  <div
                    key={labelKey}
                    className="flex items-center justify-between gap-3 border-b border-slate-200/75 py-2 dark:border-white/10"
                  >
                    <span className="text-xs uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
                      {localize(labelKey as TranslationKeys)}
                    </span>
                    <span className="text-right font-medium text-slate-950 dark:text-white">
                      {value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </OGDialogContent>
        )}
      </OGDialog>
    </>
  );

  return metricsFullscreen ? (
    createPortal(content, document.body)
  ) : (
    <div className="space-y-4">{content}</div>
  );
}
