import { useState } from 'react';
import { createPortal } from 'react-dom';
import { SystemRoles } from 'librechat-data-provider';
import { useToastContext } from '@librechat/client';
import type { TProject } from 'librechat-data-provider';
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
import { MAX_META_ADS_CHAT_BRIEF_ENTITIES } from './metaAdsChatBrief';
import { useMetaAdsSelection } from './metaAds/hooks/useMetaAdsSelection';
import { useMetaAdsTableScrollSync } from './metaAds/hooks/useMetaAdsTableScrollSync';
import { useMetaAdsSettings } from './metaAds/hooks/useMetaAdsSettings';
import { useMetaAdsEntityActions } from './metaAds/hooks/useMetaAdsEntityActions';
import { useMetaAdsRules } from './metaAds/hooks/useMetaAdsRules';
import { useMetaAdsBiWorkspace } from './metaAds/hooks/useMetaAdsBiWorkspace';
import { useMetaAdsTrafficAgent } from './metaAds/hooks/useMetaAdsTrafficAgent';
import { tableColumnMap, tableViewMinWidth } from './metaAds/constants';
import { buildMetaAdsBiState } from './metaAds/biState';
import { buildMetaAdsEvolutionState } from './metaAds/evolutionState';
import { getTableViewColumns, buildCampaignFallback } from './metaAds/table';
import { getGraphVersionOptions } from './metaAds/settings';
import { getRequestErrorMessage } from './metaAds/errors';
import { MetaAdsBiWorkspace } from './metaAds/biWorkspace';
import { MetaAdsHistoryPanel } from './metaAds/historyPanel';
import { MetaAdsDialogsLayer } from './metaAds/dialogsLayer';
import { MetaAdsOverviewWorkspace } from './metaAds/overviewWorkspace';
import { MetaAdsWorkspaceShell } from './metaAds/workspaceShell';
import { getMetaAdsTableRowClass } from './metaAds/overviewCells';
import { createMetaAdsOverviewRenderers } from './metaAds/overviewRenderers';
import {
  buildMetaAdsOverviewState,
  buildMetaAdsSummaryCardItems,
  getMetaAdsTokenStatusKey,
  getNextMetaAdsSortDirection,
} from './metaAds/overviewState';
import { cleanDashboardName } from './metaAds/helpers';
import type { TableView, WorkspaceTab } from './metaAds/types';
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
  const { user } = useAuthContext();
  const { showToast } = useToastContext();
  const { tableScrollRef, stickyHorizontalScrollRef, onTableScroll, onStickyHorizontalScroll } =
    useMetaAdsTableScrollSync();
  const [campaignSearch, setCampaignSearch] = useState('');
  const [objectiveFilter, setObjectiveFilter] = useState('all');
  const [resultTypeSelectorOpen, setResultTypeSelectorOpen] = useState(false);
  const [selectedSummaryResultType, setSelectedSummaryResultType] = useState<string | null>(null);
  const [budgetModeFilter, setBudgetModeFilter] = useState('all');
  const [campaignSort, setCampaignSort] = useState('name_asc');
  const [workspaceTab, setWorkspaceTab] = useState<WorkspaceTab>('overview');
  const [tableView, setTableView] = useState<TableView>('summary');
  const [runErrorMessage, setRunErrorMessage] = useState<string | null>(null);
  const {
    biControls,
    biRankingSort,
    periodFilter,
    customSince,
    customUntil,
    appliedCustomSince,
    appliedCustomUntil,
    metricsFullscreen,
    selectedBiRankItem,
    setBiControls,
    setPeriodFilter,
    setMetricsFullscreen,
    setSelectedBiRankItem,
    onBiRankingSort,
    onCustomSinceChange,
    onCustomUntilChange,
    onApplyCustomPeriod,
  } = useMetaAdsBiWorkspace();
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
  const metaAdsSettings = useMetaAdsSettings({
    project,
    statusQuery,
    updateSettings,
    updateTenantToken,
    localize,
    showToast,
  });
  const { settings, settingsDrawer, setSettings, saveSettings, onSave, openSettingsDrawer } =
    metaAdsSettings;
  const metaAdsEntityActions = useMetaAdsEntityActions({
    project,
    statusQuery,
    updateBudget,
    duplicateEntity,
    updateEntityStatus,
    applyRecommendation,
    localize,
    showToast,
  });
  const {
    actionMenuKey,
    setActionMenuKey,
    getDuplicateName,
    onApply,
    onOpenBudgetEditor,
    onOpenEntityStatusConfirmation,
    onOpenDuplicateDraft,
  } = metaAdsEntityActions;
  const isStatusLoading = Boolean(statusQuery.isLoading || statusQuery.isFetching);
  const isInitialStatusLoading = isStatusLoading && !statusQuery.data;
  const canManageTenantToken = user?.role === SystemRoles.ADMIN;
  const canUseMetaAdsActions =
    canEdit ||
    user?.role === SystemRoles.ADMIN ||
    user?.role === SystemRoles.OWNER ||
    user?.role === SystemRoles.USER;

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
  const { canOpenTrafficAgentChat, onOpenTrafficAgentChat } = useMetaAdsTrafficAgent({
    project,
    startupConfigQuery,
    statusData: statusQuery.data,
    latestSnapshots,
    campaigns,
    selectedEntityIds,
    selectedCount,
  });
  const tokenStatusKey = getMetaAdsTokenStatusKey(tokenCredentials);
  const hasProjectToken =
    tokenCredentials?.effectiveSource === 'project' ||
    Boolean(metaAdsSettings.settingsDraft?.tokenSecretName);
  const metaAdsRules = useMetaAdsRules({
    settings,
    setSettings,
    saveSettings,
    campaigns,
    selectedCampaignIds,
    selectedAdSetIds,
    canUseMetaAdsActions,
    localize,
    showToast,
  });
  const {
    ruleRows,
    canCreateRuleGroup,
    getEntityRuleLabel,
    onOpenRuleGroupDraft,
    onEditGlobalRule,
    onEditRuleGroup,
    onEditRuleOverride,
    onToggleRuleRow,
    onDeleteRuleGroup,
    onDeleteRuleOverride,
  } = metaAdsRules;
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
    onPreviewAd: metaAdsEntityActions.setSelectedAdPreview,
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
        {workspaceTab === 'overview' && (
          <MetaAdsOverviewWorkspace
            filters={{ campaignSort, onSortColumn }}
            selection={{ campaignCount: campaigns.length }}
            toolbar={{
              loading: isStatusLoading,
              campaignSearch,
              budgetModeFilter,
              objectiveFilter,
              campaignSort,
              tableView,
              selectedCount,
              campaignCount: campaigns.length,
              canCreateRuleGroup,
              canOpenTrafficAgentChat,
              objectiveOptions,
              localize,
              onCampaignSearchChange: setCampaignSearch,
              onBudgetModeFilterChange: setBudgetModeFilter,
              onObjectiveFilterChange: setObjectiveFilter,
              onCampaignSortChange: setCampaignSort,
              onTableViewChange: setTableView,
              onClearSelection: clearSelection,
              onExpandAllRows: () => expandAllRows(campaigns),
              onCollapseAllRows: () => collapseAllRows(campaigns),
              onCreateRuleGroup: onOpenRuleGroupDraft,
              onOpenTrafficAgentChat,
            }}
            summary={{
              cards: summaryCards,
              resultTypeOptions: summaryResultTypeOptions,
              selectorOpen: resultTypeSelectorOpen,
              selectedResultType: selectedSummaryResultType,
              initialLoading: isInitialStatusLoading,
              currency,
              localize,
              onOpenSelector: () => setResultTypeSelectorOpen(true),
              onCloseSelector: () => setResultTypeSelectorOpen(false),
              onSelectResultType: (resultType) => {
                setSelectedSummaryResultType(resultType);
                setResultTypeSelectorOpen(false);
              },
              onClearResultType: () => {
                setSelectedSummaryResultType(null);
                setResultTypeSelectorOpen(false);
              },
              chrome: {
                modalOverlayClassName: metaAdsModalOverlay,
                modalShellClassName: metaAdsModalShell,
              },
              buttons: {
                buttonClassName: metaAdsButton,
                ghostButtonClassName: metaAdsGhostButton,
              },
            }}
            actions={{
              pendingRecommendations: {
                recommendations: pendingRecommendations,
                currency,
                canUseMetaAdsActions,
                applyingRecommendation: applyRecommendation.isLoading,
                localize,
                onApply,
              },
            }}
            chrome={{ showPendingRecommendations: true }}
            rules={{
              rows: ruleRows,
              currency,
              canCreateRuleGroup,
              canUseMetaAdsActions,
              saving: updateSettings.isLoading,
              localize,
              primaryButtonClassName: metaAdsPrimaryButton,
              onCreateRuleGroup: onOpenRuleGroupDraft,
              onToggleRuleRow,
              onEditGlobalRule,
              onEditRuleGroup,
              onEditRuleOverride,
              onDeleteRuleGroup,
              onDeleteRuleOverride,
            }}
            table={{
              columns: tableColumns,
              campaigns: filteredCampaigns,
              selectedEntityIds,
              expandedCampaignIds,
              collapsedAboCampaignIds,
              collapsedAdSetAdsIds,
              tableColumnCount,
              tableMinWidthClassName: tableViewMinWidth[tableView],
              stickyCellClassName: metaAdsStickyCell,
              isInitialStatusLoading,
              localize,
              tableScrollRef,
              stickyHorizontalScrollRef,
              onTableScroll,
              onStickyHorizontalScroll,
              onToggleCampaign,
              onToggleCampaignExpanded,
              onToggleAdSet,
              onToggleAdSetAds,
              getTableRowClass,
              getEntityRecommendation,
              renderCampaignCell,
              renderAdSetCell,
              renderAdRow,
            }}
          />
        )}

        {workspaceTab === 'bi' && (
          <MetaAdsBiWorkspace
            controls={biControls}
            period={{
              periodFilter,
              customSince,
              customUntil,
              appliedCustomSince,
              appliedCustomUntil,
              onPeriodFilterChange: setPeriodFilter,
              onCustomSinceChange,
              onCustomUntilChange,
              onApplyCustomPeriod,
            }}
            options={{
              objectiveOptions,
              resultTypeOptions: biResultTypeOptions,
            }}
            ranking={{
              titleKey: selectedBiRankingTitleKey,
              items: selectedBiRankingItems,
              testId: selectedBiRankingTestId,
              adRankingEmptyMessageKey,
              sort: biRankingSort,
              fetching: biRankingsQuery.isFetching,
              onSort: onBiRankingSort,
              onSelect: setSelectedBiRankItem,
            }}
            evolution={{
              enabled: hasEvolutionSection,
              seriesPaths: evolutionSeriesPaths,
              dates: evolutionDates,
              maxValue: maxEvolutionValue,
              totalBudgetChangeCount,
              bestEvolution,
              evolutionAlerts,
              cleanName: cleanDashboardName,
            }}
            inputClassName={metaAdsInput}
            currency={currency}
            localize={localize}
            onControlsChange={{
              level: (level) => setBiControls((current) => ({ ...current, level })),
              objective: (objective) => setBiControls((current) => ({ ...current, objective })),
              resultType: (resultType) => setBiControls((current) => ({ ...current, resultType })),
              metric: (metric) => setBiControls((current) => ({ ...current, metric })),
            }}
          />
        )}
      </MetaAdsWorkspaceShell>

      {workspaceTab === 'overview' && (
        <MetaAdsHistoryPanel
          changes={biStatusQuery.data?.changes ?? statusQuery.data?.changes ?? []}
          currency={currency}
          localize={localize}
        />
      )}

      <MetaAdsDialogsLayer
        settingsState={metaAdsSettings}
        entityActions={metaAdsEntityActions}
        rulesState={metaAdsRules}
        currency={currency}
        localize={localize}
        metricsFullscreen={metricsFullscreen}
        selectedBiRankItem={selectedBiRankItem}
        onCloseBiRank={() => setSelectedBiRankItem(null)}
        cleanName={cleanDashboardName}
        token={{
          configured: Boolean(tokenCredentials),
          tenantConfigured: Boolean(statusQuery.data?.credentials?.tenantConfigured),
          statusLabel: localize(tokenStatusKey),
          effectiveGraphVersion: statusQuery.data?.graphVersion?.effective ?? 'v25.0',
          graphVersionOptions,
          canManageTenantToken,
          canUseMetaAdsActions,
          hasProjectToken,
        }}
        mutations={{
          savingSettings: updateSettings.isLoading,
          savingTenantToken: updateTenantToken.isLoading,
          savingBudget: updateBudget.isLoading,
          savingDuplicate: duplicateEntity.isLoading,
          updatingEntityStatus: updateEntityStatus.isLoading,
        }}
        chrome={{
          overviewActive: workspaceTab === 'overview',
          modalOverlayClassName: metaAdsModalOverlay,
          modalShellClassName: metaAdsModalShell,
          drawerShellClassName: metaAdsDrawerShell,
          modalHeaderClassName: metaAdsModalHeader,
          modalTileClassName: metaAdsModalTile,
          labelClassName: metaAdsLabel,
        }}
        controls={{
          inputClassName: metaAdsInputLg,
          buttonClassName: metaAdsButton,
          primaryButtonClassName: metaAdsPrimaryButton,
          ghostButtonClassName: metaAdsGhostButton,
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
