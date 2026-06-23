import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { SystemRoles } from 'librechat-data-provider';
import { useToastContext } from '@librechat/client';
import type {
  TProject,
  ProjectMetaAdsAdSummary,
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
import { logger } from '~/utils';
import { buildMetaAdsChatBrief, MAX_META_ADS_CHAT_BRIEF_ENTITIES } from './metaAdsChatBrief';
import { useMetaAdsSelection } from './metaAds/hooks/useMetaAdsSelection';
import { useMetaAdsTableScrollSync } from './metaAds/hooks/useMetaAdsTableScrollSync';
import { tableColumnMap, tableViewMinWidth } from './metaAds/constants';
import {
  defaultRules,
  accountProfileRules,
  getRuleOverrideKey,
  hasRulePerformanceMetric,
} from './metaAds/rules';
import {
  buildMetaAdsRuleRows,
  getMetaAdsEntityRuleLabel,
  getMetaAdsRuleDraftEntityLabels,
} from './metaAds/rulesState';
import { buildMetaAdsBiState } from './metaAds/biState';
import { buildMetaAdsEvolutionState } from './metaAds/evolutionState';
import { getTableViewColumns, buildCampaignFallback } from './metaAds/table';
import {
  normalizeSettings,
  toDateInputValue,
  getDateInputDaysAgo,
  getGraphVersionOptions,
} from './metaAds/settings';
import { getRequestErrorMessage } from './metaAds/errors';
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
import { MetaAdsPendingRecommendationsPanel } from './metaAds/pendingRecommendationsPanel';
import { MetaAdsRankMedia } from './metaAds/rankMedia';
import { MetaAdsSettingsDrawer } from './metaAds/settingsDrawer';
import { MetaAdsSummaryCards } from './metaAds/summaryCards';
import { MetaAdsWorkspaceShell } from './metaAds/workspaceShell';
import { getMetaAdsTableRowClass } from './metaAds/overviewCells';
import { createMetaAdsOverviewRenderers } from './metaAds/overviewRenderers';
import { MetaAdsOverviewTable } from './metaAds/overviewTable';
import { MetaAdsOverviewToolbar } from './metaAds/overviewToolbar';
import {
  buildMetaAdsOverviewState,
  buildMetaAdsSummaryCardItems,
  getMetaAdsTokenStatusKey,
  getNextMetaAdsSortDirection,
} from './metaAds/overviewState';
import { MetaAdsRuleGroupDialog } from './metaAds/ruleGroupDialog';
import { MetaAdsRulesWorkspace } from './metaAds/rulesWorkspace';
import { cleanDashboardName, createMetaAdsBriefStorageKey } from './metaAds/helpers';
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
  metaAdsInput,
  metaAdsInputLg,
  metaAdsButton,
  metaAdsGhostButton,
  metaAdsPrimaryButton,
  metaAdsLabel,
  metaAdsStickyCell,
  metaAdsModalOverlay,
  metaAdsModalShell,
  metaAdsDrawerShell,
  metaAdsModalHeader,
  metaAdsModalTile,
} from './metaAds/chrome';

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
  const { tableScrollRef, stickyHorizontalScrollRef, onTableScroll, onStickyHorizontalScroll } =
    useMetaAdsTableScrollSync();
  const [settings, setSettings] = useState(() => normalizeSettings(project));
  const [settingsDraft, setSettingsDraft] = useState<MetaAdsSettingsState | null>(null);
  const [settingsDraftToken, setSettingsDraftToken] = useState('');
  const [showSettingsDraftToken, setShowSettingsDraftToken] = useState(false);
  const [credentialsDialogOpen, setCredentialsDialogOpen] = useState(false);
  const [tenantAccessToken, setTenantAccessToken] = useState('');
  const [showTenantAccessToken, setShowTenantAccessToken] = useState(false);
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
  const {
    selectedEntityIds,
    expandedCampaignIds,
    collapsedAboCampaignIds,
    collapsedAdSetAdsIds,
    selectedCampaignIds,
    selectedAdSetIds,
    selectedCount,
    clearSelection,
    onToggleCampaign,
    onToggleAdSet,
    onToggleCampaignExpanded,
    onToggleAdSetAds,
    expandAllRows,
    collapseAllRows,
  } = useMetaAdsSelection({ maxSelectedEntities: MAX_META_ADS_CHAT_BRIEF_ENTITIES });
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
  const {
    evolutionDates,
    evolutionSeriesPaths,
    maxEvolutionValue,
    totalBudgetChangeCount,
    bestEvolution,
    evolutionAlerts,
    hasEvolutionSection,
  } = buildMetaAdsEvolutionState({ trend, controls: biControls });
  const canOpenTrafficAgentChat =
    selectedCount > 0 && selectedCount <= MAX_META_ADS_CHAT_BRIEF_ENTITIES;
  const tokenStatusKey = getMetaAdsTokenStatusKey(tokenCredentials);
  const hasProjectToken =
    tokenCredentials?.effectiveSource === 'project' || Boolean(settingsDraft?.tokenSecretName);
  const canCreateRuleGroup = canUseMetaAdsActions;
  const getEntityRuleLabel = (entityLevel: MetaAdsRuleGroup['entityLevel'], entityId: string) =>
    getMetaAdsEntityRuleLabel(settings, entityLevel, entityId);
  const ruleDraftEntityLabels = getMetaAdsRuleDraftEntityLabels(ruleGroupDraft, campaigns);
  const ruleRows = buildMetaAdsRuleRows({ settings, campaigns, localize });
  const getEntityRecommendation = (entityId: string) =>
    pendingRecommendations.find((recommendation) => recommendation.entityId === entityId);
  const biCampaigns = biStatusQuery.data?.campaigns ?? campaigns;
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
    rankingItems: biRankingsQuery.data?.items ?? [],
    adDiagnostics: biStatusQuery.data?.adDiagnostics,
    localize,
  });
  const {
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
  } = buildMetaAdsOverviewState({
    campaigns,
    settings,
    summary: statusQuery.data?.summary,
    campaignSearch,
    objectiveFilter,
    budgetModeFilter,
    campaignSort,
    selectedSummaryResultType,
    localize,
  });

  const onSortColumn = (key: string, defaultDirection: 'asc' | 'desc') => {
    const nextDirection = getNextMetaAdsSortDirection({ campaignSort, key, defaultDirection });
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
  const summaryCards = buildMetaAdsSummaryCardItems({
    isEcommerceDashboard,
    summaryAverageRoas,
    summaryTotalSpend,
    summaryTotalResults,
    summaryAverageCost,
    summaryAverageFrequency,
    summaryMetricContext,
    summaryResultTypeOptionsLength: summaryResultTypeOptions.length,
    scopedObjectiveSummary,
    currency,
    localize,
  });
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
      <MetaAdsWorkspaceShell
        automationMode={settings.automationMode}
        scheduleIntervalMinutes={settings.scheduleIntervalMinutes}
        tokenStatusKey={tokenStatusKey}
        workspaceTab={workspaceTab}
        settingsDrawer={settingsDrawer}
        metricsFullscreen={metricsFullscreen}
        canUseMetaAdsActions={canUseMetaAdsActions}
        runningAnalysis={runAnalysis.isLoading}
        savingSettings={updateSettings.isLoading}
        runErrorMessage={runErrorMessage}
        localize={localize}
        onRunAnalysis={onRunAnalysis}
        onOpenSettingsDrawer={openSettingsDrawer}
        onOpenRuleGroupDraft={onOpenRuleGroupDraft}
        onWorkspaceTabChange={setWorkspaceTab}
        onToggleFullscreen={() => setMetricsFullscreen((current) => !current)}
        onSave={onSave}
      >
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
            <MetaAdsOverviewToolbar
              loading={isStatusLoading}
              campaignSearch={campaignSearch}
              budgetModeFilter={budgetModeFilter}
              objectiveFilter={objectiveFilter}
              campaignSort={campaignSort}
              tableView={tableView}
              selectedCount={selectedCount}
              campaignCount={campaigns.length}
              canCreateRuleGroup={canCreateRuleGroup}
              canOpenTrafficAgentChat={canOpenTrafficAgentChat}
              objectiveOptions={objectiveOptions}
              localize={localize}
              onCampaignSearchChange={setCampaignSearch}
              onBudgetModeFilterChange={setBudgetModeFilter}
              onObjectiveFilterChange={setObjectiveFilter}
              onCampaignSortChange={setCampaignSort}
              onTableViewChange={setTableView}
              onClearSelection={clearSelection}
              onExpandAllRows={() => expandAllRows(campaigns)}
              onCollapseAllRows={() => collapseAllRows(campaigns)}
              onCreateRuleGroup={onOpenRuleGroupDraft}
              onOpenTrafficAgentChat={onOpenTrafficAgentChat}
            />
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

            {campaigns.length === 0 && (
              <MetaAdsPendingRecommendationsPanel
                recommendations={pendingRecommendations}
                currency={currency}
                canUseMetaAdsActions={canUseMetaAdsActions}
                applyingRecommendation={applyRecommendation.isLoading}
                localize={localize}
                onApply={onApply}
              />
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
      </MetaAdsWorkspaceShell>

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
