import { Fragment, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { MouseEvent, UIEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowSquareOut, ArrowsIn, ArrowsOut, PencilSimple } from '@phosphor-icons/react';
import { SystemRoles } from 'librechat-data-provider';
import { useToastContext } from '@librechat/client';
import type {
  TProject,
  ProjectMetaAdsAdSummary,
  ProjectMetaAdsCampaignSummary,
  ProjectMetaAdsEvolutionDelta,
  ProjectMetaAdsRankingItem,
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
  EVOLUTION_SERIES_LIMIT,
} from './metaAds/constants';
import {
  defaultRules,
  accountProfileRules,
  getRuleOverrideKey,
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
  getDeltaEntityId,
  getDeltaEntityName,
  hasMeaningfulDelta,
  getEvolutionSeriesTotal,
  matchesBiSeriesFilters,
} from './metaAds/evolution';
import {
  collectBiResultTypes,
  isEcommerceContext,
  calculateWeightedRoas,
  buildObjectiveSummaries,
  buildSummaryResultTypeOptions,
} from './metaAds/summary';
import {
  getTableViewColumns,
  getMetricValue,
  compareNumberSort,
  buildBudgetReferences,
  getBudgetChangeDelta,
  buildCampaignFallback,
} from './metaAds/table';
import {
  toAdAccountId,
  getAdAccountDigits,
  normalizeSettings,
  toDateInputValue,
  getDateInputDaysAgo,
  getGraphVersionOptions,
} from './metaAds/settings';
import { getRequestErrorMessage } from './metaAds/errors';
import { getRecommendationLabel, canApplyRecommendation } from './metaAds/recommendations';
import { MetaAdsAdPreviewDialog, MetaAdsBiRankDetailsDialog } from './metaAds/dialogs';
import {
  MetaAdsDuplicateEntityDialog,
  MetaAdsBudgetConfirmationBanner,
  MetaAdsEntityStatusConfirmationBanner,
} from './metaAds/confirmations';
import { MetaAdsCredentialsDialog } from './metaAds/credentialsDialog';
import { MetaAdsBiControlsPanel } from './metaAds/biControls';
import { MetaAdsOverviewActionCell } from './metaAds/overviewActionCell';
import { MetaAdsOverviewTable } from './metaAds/overviewTable';
import { MetaAdsRuleGroupDialog } from './metaAds/ruleGroupDialog';
import { MetaAdsRulesWorkspace } from './metaAds/rulesWorkspace';
import type {
  RuleRow,
  TableView,
  TableColumn,
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
  MetaAdsRulesState,
  MetaAdsBiControls,
  BudgetConfirmation,
  MetaAdsRuleOverride,
  EvolutionHoverPoint,
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

function cleanDashboardName(value: string | undefined, fallback: string) {
  const cleanedValue = (value ?? '').replace(/^[^\w[]+\s*/u, '').trim();
  return cleanedValue || value || fallback;
}

function createMetaAdsBriefStorageKey() {
  const id =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `meta_ads_brief:${id}`;
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
  const campaignDeltas = trend?.campaignDeltas ?? [];
  const changesByDay = trend?.changesByDay ?? [];
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
  ) => (
    <MetaAdsOverviewActionCell
      key={column.key}
      columnKey={column.key}
      recommendation={recommendation}
      duplicate={duplicate}
      actionMenuKey={actionMenuKey}
      canUseMetaAdsActions={canUseMetaAdsActions}
      applyingRecommendation={applyRecommendation.isLoading}
      localize={localize}
      onApply={onApply}
      onToggleActionMenu={(menuKey) =>
        setActionMenuKey((current) => (current === menuKey ? null : menuKey))
      }
      onOpenDuplicateDraft={onOpenDuplicateDraft}
    />
  );

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

        <MetaAdsCredentialsDialog
          open={credentialsDialogOpen}
          tenantConfigured={Boolean(statusQuery.data?.credentials?.tenantConfigured)}
          canManageTenantToken={canManageTenantToken}
          canUseMetaAdsActions={canUseMetaAdsActions}
          hasProjectToken={hasProjectToken}
          tenantAccessToken={tenantAccessToken}
          showTenantAccessToken={showTenantAccessToken}
          settingsDraftToken={settingsDraftToken}
          showSettingsDraftToken={showSettingsDraftToken}
          savingTenantToken={updateTenantToken.isLoading}
          savingProjectToken={updateSettings.isLoading}
          localize={localize}
          onOpen={() => setCredentialsDialogOpen(true)}
          onClose={closeCredentialsDialog}
          onTenantAccessTokenChange={setTenantAccessToken}
          onToggleTenantAccessToken={() => setShowTenantAccessToken((current) => !current)}
          onSaveTenantToken={onSaveTenantToken}
          onSettingsDraftTokenChange={setSettingsDraftToken}
          onToggleSettingsDraftToken={() => setShowSettingsDraftToken((current) => !current)}
          onClearProjectToken={onClearProjectToken}
          onSaveProjectToken={onSaveProjectToken}
          chrome={{
            modalShellClassName: metaAdsModalShell,
            modalHeaderClassName: metaAdsModalHeader,
            modalTileClassName: metaAdsModalTile,
          }}
          buttons={{
            primaryClassName: metaAdsPrimaryButton,
            ghostClassName: metaAdsGhostButton,
          }}
        />

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

            <MetaAdsBudgetConfirmationBanner
              confirmation={budgetConfirmation}
              currency={currency}
              saving={updateBudget.isLoading}
              localize={localize}
              onCancel={() => setBudgetConfirmation(null)}
              onConfirm={onConfirmManualBudget}
            />

            <MetaAdsEntityStatusConfirmationBanner
              confirmation={entityStatusConfirmation}
              saving={updateEntityStatus.isLoading}
              localize={localize}
              onCancel={() => setEntityStatusConfirmation(null)}
              onConfirm={onConfirmEntityStatus}
            />

            <MetaAdsDuplicateEntityDialog
              draft={duplicateDraft}
              targetName={duplicateTargetName}
              currency={currency}
              saving={duplicateEntity.isLoading}
              localize={localize}
              onTargetNameChange={setDuplicateTargetName}
              onClose={onCloseDuplicateDraft}
              onConfirm={onConfirmDuplicate}
              chrome={{
                modalOverlayClassName: metaAdsModalOverlay,
                drawerShellClassName: metaAdsDrawerShell,
                modalHeaderClassName: metaAdsModalHeader,
                modalTileClassName: metaAdsModalTile,
              }}
              buttons={{
                primaryClassName: metaAdsPrimaryButton,
                ghostClassName: metaAdsGhostButton,
                inputClassName: metaAdsInputLg,
              }}
            />

            <MetaAdsRuleGroupDialog
              draft={ruleGroupDraft}
              settings={settings}
              entityLabels={ruleDraftEntityLabels}
              saving={updateSettings.isLoading}
              localize={localize}
              onNameChange={(name) =>
                setRuleGroupDraft((current) => (current ? { ...current, name } : current))
              }
              onAccountProfileChange={onAccountProfileChange}
              onRuleChange={onRuleGroupRuleChange}
              onRuleTextChange={onRuleGroupRuleTextChange}
              onCreativeRuleChange={onRuleGroupCreativeRuleChange}
              onClose={() => setRuleGroupDraft(null)}
              onSave={onSaveRuleGroup}
              chrome={{
                modalOverlayClassName: metaAdsModalOverlay,
                drawerShellClassName: metaAdsDrawerShell,
                modalHeaderClassName: metaAdsModalHeader,
                modalTileClassName: metaAdsModalTile,
                labelClassName: metaAdsLabel,
              }}
              controls={{
                inputClassName: metaAdsInputLg,
                primaryButtonClassName: metaAdsPrimaryButton,
                ghostButtonClassName: metaAdsGhostButton,
              }}
            />

            <MetaAdsRulesWorkspace
              rows={ruleRows}
              currency={currency}
              canCreateRuleGroup={canCreateRuleGroup}
              canUseMetaAdsActions={canUseMetaAdsActions}
              saving={updateSettings.isLoading}
              localize={localize}
              primaryButtonClassName={metaAdsPrimaryButton}
              onCreateRuleGroup={onOpenRuleGroupDraft}
              onToggleRuleRow={onToggleRuleRow}
              onEditGlobalRule={onEditGlobalRule}
              onEditRuleGroup={onEditRuleGroup}
              onEditRuleOverride={onEditRuleOverride}
              onDeleteRuleGroup={onDeleteRuleGroup}
              onDeleteRuleOverride={onDeleteRuleOverride}
            />

            <MetaAdsOverviewTable
              columns={tableColumns}
              campaigns={filteredCampaigns}
              selectedEntityIds={selectedEntityIds}
              expandedCampaignIds={expandedCampaignIds}
              collapsedAboCampaignIds={collapsedAboCampaignIds}
              collapsedAdSetAdsIds={collapsedAdSetAdsIds}
              tableColumnCount={tableColumnCount}
              tableMinWidthClassName={tableViewMinWidth[tableView]}
              stickyCellClassName={metaAdsStickyCell}
              isInitialStatusLoading={isInitialStatusLoading}
              localize={localize}
              tableScrollRef={tableScrollRef}
              stickyHorizontalScrollRef={stickyHorizontalScrollRef}
              onTableScroll={onTableScroll}
              onStickyHorizontalScroll={onStickyHorizontalScroll}
              onToggleCampaign={onToggleCampaign}
              onToggleCampaignExpanded={onToggleCampaignExpanded}
              onToggleAdSet={onToggleAdSet}
              onToggleAdSetAds={onToggleAdSetAds}
              getTableRowClass={getTableRowClass}
              getEntityRecommendation={getEntityRecommendation}
              renderSortableHeader={renderSortableHeader}
              renderCampaignCell={renderCampaignCell}
              renderAdSetCell={renderAdSetCell}
              renderAdRow={renderAdRow}
            />
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
              <MetaAdsBiControlsPanel
                controls={biControls}
                periodFilter={periodFilter}
                customSince={customSince}
                customUntil={customUntil}
                appliedCustomSince={appliedCustomSince}
                appliedCustomUntil={appliedCustomUntil}
                objectiveOptions={objectiveOptions}
                resultTypeOptions={biResultTypeOptions}
                inputClassName={metaAdsInput}
                localize={localize}
                onPeriodFilterChange={setPeriodFilter}
                onCustomSinceChange={onCustomSinceChange}
                onCustomUntilChange={onCustomUntilChange}
                onApplyCustomPeriod={onApplyCustomPeriod}
                onLevelChange={(level) => setBiControls((current) => ({ ...current, level }))}
                onObjectiveChange={(objective) =>
                  setBiControls((current) => ({ ...current, objective }))
                }
                onResultTypeChange={(resultType) =>
                  setBiControls((current) => ({ ...current, resultType }))
                }
                onMetricChange={(metric) => setBiControls((current) => ({ ...current, metric }))}
              />
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

      <MetaAdsAdPreviewDialog
        ad={selectedAdPreview}
        currency={currency}
        localize={localize}
        metricsFullscreen={metricsFullscreen}
        onClose={() => setSelectedAdPreview(null)}
        chrome={{
          modalShellClassName: metaAdsModalShell,
          modalHeaderClassName: metaAdsModalHeader,
          modalTileClassName: metaAdsModalTile,
        }}
      />

      <MetaAdsBiRankDetailsDialog
        item={selectedBiRankItem}
        currency={currency}
        localize={localize}
        renderRankMedia={renderRankMedia}
        cleanName={cleanDashboardName}
        onClose={() => setSelectedBiRankItem(null)}
        chrome={{
          modalShellClassName: metaAdsModalShell,
          modalHeaderClassName: metaAdsModalHeader,
          modalTileClassName: metaAdsModalTile,
        }}
      />
    </>
  );

  return metricsFullscreen ? (
    createPortal(content, document.body)
  ) : (
    <div className="space-y-4">{content}</div>
  );
}
