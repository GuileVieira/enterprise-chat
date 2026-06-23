import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { MouseEvent, UIEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowsIn, ArrowsOut } from '@phosphor-icons/react';
import { SystemRoles } from 'librechat-data-provider';
import { useToastContext } from '@librechat/client';
import type {
  TProject,
  ProjectMetaAdsAdSummary,
  ProjectMetaAdsCampaignSummary,
  ProjectMetaAdsEvolutionDelta,
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
import { buildMetaAdsBiRankings, getSortedBiRankingItems } from './metaAds/bi';
import {
  formatMoney,
  formatMetric,
  buildChartPath,
  getObjectiveLabel,
  getResultTypeLabel,
  getEvolutionMetricValue,
} from './metaAds/formatters';
import {
  getDeltaEntityId,
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
  buildCampaignFallback,
} from './metaAds/table';
import {
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
import { MetaAdsBiRankingCard } from './metaAds/biRankingCard';
import { MetaAdsBudgetEditorDialog } from './metaAds/budgetEditor';
import { MetaAdsEvolutionDashboard } from './metaAds/evolutionDashboard';
import { MetaAdsHistoryPanel } from './metaAds/historyPanel';
import { MetaAdsRankMedia } from './metaAds/rankMedia';
import { MetaAdsSettingsDrawer } from './metaAds/settingsDrawer';
import { MetaAdsSummaryCards } from './metaAds/summaryCards';
import { getMetaAdsTableRowClass } from './metaAds/overviewCells';
import { createMetaAdsOverviewRenderers } from './metaAds/overviewRenderers';
import { MetaAdsOverviewTable } from './metaAds/overviewTable';
import { MetaAdsRuleGroupDialog } from './metaAds/ruleGroupDialog';
import { MetaAdsRulesWorkspace } from './metaAds/rulesWorkspace';
import type {
  RuleRow,
  TableView,
  BudgetEditor,
  RuleGroupDraft,
  PeriodFilter,
  SettingsDrawer,
  WorkspaceTab,
  DuplicateDraft,
  MetaAdsRuleGroup,
  BiRankingSort,
  MetaAdsBiRankItem,
  MetaAdsRulesState,
  MetaAdsBiControls,
  BudgetConfirmation,
  MetaAdsRuleOverride,
  MetaAdsSettingsState,
  BiRankingSortKey,
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
  const [selectedAdPreview, setSelectedAdPreview] = useState<ProjectMetaAdsAdSummary | null>(null);
  const [collapsedAdSetAdsIds, setCollapsedAdSetAdsIds] = useState<string[]>([]);
  const onBiRankingSort = (key: BiRankingSortKey) => {
    setBiRankingSort((current) => {
      if (current.key === key) {
        return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' };
      }

      return { key, direction: key === 'cpa' ? 'asc' : 'desc' };
    });
  };
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
  const getTableRowClass = getMetaAdsTableRowClass;
  const { renderCampaignCell, renderAdSetCell, renderAdRow } = createMetaAdsOverviewRenderers({
    columns: tableColumns,
    currency,
    actionMenuKey,
    stickyCellClassName: metaAdsStickyCell,
    canUseMetaAdsActions,
    applyingRecommendation: applyRecommendation.isLoading,
    updatingEntityStatus: updateEntityStatus.isLoading,
    localize,
    getTableRowClass,
    getEntityRuleLabel,
    getDuplicateName,
    onApply,
    onToggleActionMenu: (menuKey) =>
      setActionMenuKey((current) => (current === menuKey ? null : menuKey)),
    onOpenDuplicateDraft,
    onOpenBudgetEditor,
    onOpenEntityStatusConfirmation,
    onPreviewAd: setSelectedAdPreview,
  });

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

        <MetaAdsSettingsDrawer
          drawer={settingsDrawer}
          draft={settingsDraft}
          tokenConfigured={Boolean(tokenCredentials)}
          tokenStatusLabel={localize(tokenStatusKey)}
          effectiveGraphVersion={statusQuery.data?.graphVersion?.effective ?? 'v25.0'}
          graphVersionOptions={graphVersionOptions}
          canUseMetaAdsActions={canUseMetaAdsActions}
          saving={updateSettings.isLoading}
          localize={localize}
          onDraftChange={setSettingsDraft}
          onOpenCredentials={openCredentialsDialog}
          onClose={closeSettingsDrawer}
          onSave={onSaveSettingsDrawer}
          chrome={{
            modalOverlayClassName: metaAdsModalOverlay,
            drawerShellClassName: metaAdsDrawerShell,
            modalHeaderClassName: metaAdsModalHeader,
            modalTileClassName: metaAdsModalTile,
          }}
          controls={{
            inputClassName: metaAdsInputLg,
            buttonClassName: metaAdsButton,
            primaryButtonClassName: metaAdsPrimaryButton,
            ghostButtonClassName: metaAdsGhostButton,
          }}
        />

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
              <MetaAdsSummaryCards
                cards={summaryCards}
                resultTypeOptions={summaryResultTypeOptions}
                selectorOpen={resultTypeSelectorOpen}
                selectedResultType={selectedSummaryResultType}
                initialLoading={isInitialStatusLoading}
                currency={currency}
                localize={localize}
                onOpenSelector={() => setResultTypeSelectorOpen(true)}
                onCloseSelector={() => setResultTypeSelectorOpen(false)}
                onSelectResultType={(resultType) => {
                  setSelectedSummaryResultType(resultType);
                  setResultTypeSelectorOpen(false);
                }}
                onClearResultType={() => {
                  setSelectedSummaryResultType(null);
                  setResultTypeSelectorOpen(false);
                }}
                chrome={{
                  modalOverlayClassName: metaAdsModalOverlay,
                  modalShellClassName: metaAdsModalShell,
                }}
                buttons={{
                  buttonClassName: metaAdsButton,
                  ghostButtonClassName: metaAdsGhostButton,
                }}
              />
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

            <MetaAdsBudgetEditorDialog
              editor={budgetEditor}
              dailyBudget={manualDailyBudget}
              currency={currency}
              saving={updateBudget.isLoading}
              localize={localize}
              onDailyBudgetChange={setManualDailyBudget}
              onClose={() => setBudgetEditor(null)}
              onSave={onSaveManualBudget}
              chrome={{
                modalOverlayClassName: metaAdsModalOverlay,
                modalShellClassName: metaAdsModalShell,
                modalTileClassName: metaAdsModalTile,
              }}
              controls={{
                inputClassName: metaAdsInputLg,
                primaryButtonClassName: metaAdsPrimaryButton,
                ghostButtonClassName: metaAdsGhostButton,
              }}
            />

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
              <MetaAdsBiRankingCard
                titleKey={selectedBiRankingTitleKey}
                items={selectedBiRankingItems}
                testId={selectedBiRankingTestId}
                emptyMessageKey={
                  biControls.level === 'ad'
                    ? adRankingEmptyMessageKey
                    : 'com_ui_project_meta_ads_bi_no_rankings'
                }
                sort={biRankingSort}
                fetching={biRankingsQuery.isFetching}
                currency={currency}
                localize={localize}
                onSort={onBiRankingSort}
                onSelect={setSelectedBiRankItem}
              />
            </div>

            {hasEvolutionSection && (
              <MetaAdsEvolutionDashboard
                level={biControls.level}
                metric={biControls.metric}
                seriesPaths={evolutionSeriesPaths}
                dates={evolutionDates}
                maxValue={maxEvolutionValue}
                totalBudgetChangeCount={totalBudgetChangeCount}
                bestEvolution={bestEvolution}
                evolutionAlerts={evolutionAlerts}
                currency={currency}
                localize={localize}
                cleanName={cleanDashboardName}
              />
            )}
          </div>
        )}
      </div>

      {workspaceTab === 'overview' && (
        <MetaAdsHistoryPanel
          changes={biStatusQuery.data?.changes ?? statusQuery.data?.changes ?? []}
          currency={currency}
          localize={localize}
        />
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
        renderRankMedia={(item, size) => (
          <MetaAdsRankMedia item={item} size={size} localize={localize} />
        )}
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
