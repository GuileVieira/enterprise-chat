import { useState } from 'react';
import { createPortal } from 'react-dom';
import { SystemRoles } from 'librechat-data-provider';
import { useToastContext } from '@librechat/client';
import type { TProject } from 'librechat-data-provider';
import {
  useGetStartupConfig,
  useApplyProjectMetaAdsRecommendationMutation,
  useDuplicateProjectMetaAdsEntityMutation,
  useProjectMetaAdsPerformanceQuery,
  useProjectMetaAdsRankingsQuery,
  useProjectMetaAdsQuery,
  useProjectMetaAdsRulePerformanceQuery,
  useRunProjectMetaAdsMutation,
  useUpdateProjectMetaAdsEntityStatusMutation,
  useUpdateProjectMetaAdsBudgetMutation,
  useUpdateProjectMetaAdsMutation,
  useUpdateProjectMetaAdsTenantTokenMutation,
} from '~/data-provider';
import { useAuthContext, useLocalize } from '~/hooks';
import { MAX_META_ADS_CHAT_BRIEF_ENTITIES } from './metaAdsChatBrief';
import { useMetaAdsSelection } from './metaAds/hooks/useMetaAdsSelection';
import { useMetaAdsTableScrollSync } from './metaAds/hooks/useMetaAdsTableScrollSync';
import { useMetaAdsSettings } from './metaAds/hooks/useMetaAdsSettings';
import { useMetaAdsEntityActions } from './metaAds/hooks/useMetaAdsEntityActions';
import { useMetaAdsRules } from './metaAds/hooks/useMetaAdsRules';
import { useMetaAdsBiWorkspace } from './metaAds/hooks/useMetaAdsBiWorkspace';
import { useMetaAdsBiAdapter } from './metaAds/hooks/useMetaAdsBiAdapter';
import { useMetaAdsTrafficAgent } from './metaAds/hooks/useMetaAdsTrafficAgent';
import { useMetaAdsPeriodFilter } from './metaAds/hooks/useMetaAdsPeriodFilter';
import { useMetaAdsRunAnalysis } from './metaAds/hooks/useMetaAdsRunAnalysis';
import { useMetaAdsOverviewAdapter } from './metaAds/hooks/useMetaAdsOverviewAdapter';
import { buildCampaignFallback } from './metaAds/table';
import { getGraphVersionOptions } from './metaAds/settings';
import { MetaAdsBiWorkspace } from './metaAds/biWorkspace';
import { MetaAdsAiPerformanceWorkspace } from './metaAds/aiPerformanceWorkspace';
import { MetaAdsHistoryPanel } from './metaAds/historyPanel';
import { MetaAdsDialogsLayer } from './metaAds/dialogsLayer';
import { MetaAdsOverviewWorkspace } from './metaAds/overviewWorkspace';
import { MetaAdsRulePerformanceWorkspace } from './metaAds/rulePerformanceWorkspace';
import { MetaAdsWorkspaceShell } from './metaAds/workspaceShell';
import { getMetaAdsTokenStatusKey } from './metaAds/overviewState';
import { cleanDashboardName } from './metaAds/helpers';
import type { WorkspaceTab } from './metaAds/types';
import {
  metaAdsInputLg,
  metaAdsButton,
  metaAdsGhostButton,
  metaAdsPrimaryButton,
  metaAdsLabel,
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
  const tableScroll = useMetaAdsTableScrollSync();
  const [workspaceTab, setWorkspaceTab] = useState<WorkspaceTab>('overview');
  const [runErrorMessage, setRunErrorMessage] = useState<string | null>(null);
  const biWorkspace = useMetaAdsBiWorkspace();
  const selection = useMetaAdsSelection({ maxSelectedEntities: MAX_META_ADS_CHAT_BRIEF_ENTITIES });
  const startupConfigQuery = useGetStartupConfig();
  const overviewPeriod = useMetaAdsPeriodFilter();
  const biPeriod = useMetaAdsPeriodFilter();
  const aiPerformancePeriod = useMetaAdsPeriodFilter();
  const rulePerformancePeriod = useMetaAdsPeriodFilter();
  const statusQuery = useProjectMetaAdsQuery(project.projectId, overviewPeriod.statusParams);
  const biStatusQuery = useProjectMetaAdsQuery(project.projectId, biPeriod.statusParams);
  const aiPerformanceQuery = useProjectMetaAdsPerformanceQuery(
    project.projectId,
    aiPerformancePeriod.statusParams,
  );
  const rulePerformanceQuery = useProjectMetaAdsRulePerformanceQuery(
    project.projectId,
    rulePerformancePeriod.statusParams,
  );
  const biRankingsQuery = useProjectMetaAdsRankingsQuery(project.projectId, {
    ...biPeriod.statusParams,
    level: biWorkspace.biControls.level,
    objective: biWorkspace.biControls.objective,
    resultType: biWorkspace.biControls.resultType,
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
  const isStatusLoading = Boolean(statusQuery.isLoading || statusQuery.isFetching);
  const isInitialStatusLoading = isStatusLoading && !statusQuery.data;
  const canManageTenantToken = user?.role === SystemRoles.ADMIN;
  const canUseMetaAdsActions =
    canEdit ||
    user?.role === SystemRoles.ADMIN ||
    user?.role === SystemRoles.OWNER ||
    user?.role === SystemRoles.AD_MANAGER;

  const pendingRecommendations =
    statusQuery.data?.recommendations.filter((item) => item.status === 'pending') ?? [];
  const latestSnapshots = statusQuery.data?.latestSnapshots.slice(0, 8) ?? [];
  const campaigns =
    statusQuery.data?.campaigns && statusQuery.data.campaigns.length > 0
      ? statusQuery.data.campaigns
      : buildCampaignFallback(latestSnapshots);
  const tokenCredentials = statusQuery.data?.credentials;
  const currency = statusQuery.data?.currency ?? 'BRL';
  const automationMode = settings.automationMode ?? 'recommend';
  const scheduleIntervalMinutes = settings.scheduleIntervalMinutes ?? 180;
  const graphVersionOptions = getGraphVersionOptions(
    statusQuery.data?.graphVersion?.effective,
  ).filter((version): version is string => typeof version === 'string');
  const trend = biStatusQuery.data?.trend ?? statusQuery.data?.trend;
  const { canOpenTrafficAgentChat, onOpenTrafficAgentChat } = useMetaAdsTrafficAgent({
    project,
    startupConfigQuery,
    statusData: statusQuery.data,
    latestSnapshots,
    campaigns,
    selectedEntityIds: selection.selectedEntityIds,
    selectedCount: selection.selectedCount,
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
    selectedCampaignIds: selection.selectedCampaignIds,
    selectedAdSetIds: selection.selectedAdSetIds,
    canUseMetaAdsActions,
    localize,
    showToast,
  });
  const biCampaigns = biStatusQuery.data?.campaigns ?? campaigns;
  const biAdapter = useMetaAdsBiAdapter({
    campaigns,
    biCampaigns,
    settings,
    biWorkspace,
    biPeriod,
    rankingItems: biRankingsQuery.data?.items ?? [],
    adDiagnostics: biStatusQuery.data?.adDiagnostics,
    rankingFetching: biRankingsQuery.isFetching,
    trend,
    currency,
    localize,
  });
  const overviewWorkspaceProps = useMetaAdsOverviewAdapter({
    campaigns,
    pendingRecommendations,
    currency,
    canUseMetaAdsActions,
    isStatusLoading,
    isInitialStatusLoading,
    canOpenTrafficAgentChat,
    savingSettings: updateSettings.isLoading,
    objectiveOptions: biAdapter.objectiveOptions,
    statusSummary: statusQuery.data?.summary,
    settingsState: metaAdsSettings,
    entityActions: metaAdsEntityActions,
    rulesState: metaAdsRules,
    selection,
    tableScroll,
    overviewPeriod,
    applyRecommendation,
    updateEntityStatus,
    localize,
    onOpenTrafficAgentChat,
  });
  const onRunAnalysis = useMetaAdsRunAnalysis({
    projectId: project.projectId,
    runAnalysis,
    statusQuery,
    localize,
    showToast,
    setRunErrorMessage,
  });

  const content = (
    <>
      <MetaAdsWorkspaceShell
        automationMode={automationMode}
        scheduleIntervalMinutes={scheduleIntervalMinutes}
        tokenStatusKey={tokenStatusKey}
        workspaceTab={workspaceTab}
        settingsDrawer={settingsDrawer}
        metricsFullscreen={biWorkspace.metricsFullscreen}
        canUseMetaAdsActions={canUseMetaAdsActions}
        runningAnalysis={runAnalysis.isLoading}
        savingSettings={updateSettings.isLoading}
        runErrorMessage={runErrorMessage}
        localize={localize}
        onRunAnalysis={onRunAnalysis}
        onOpenSettingsDrawer={openSettingsDrawer}
        onOpenRuleGroupDraft={metaAdsRules.onOpenRuleGroupDraft}
        onWorkspaceTabChange={setWorkspaceTab}
        onToggleFullscreen={() => biWorkspace.setMetricsFullscreen((current) => !current)}
        onSave={onSave}
      >
        {workspaceTab === 'overview' && <MetaAdsOverviewWorkspace {...overviewWorkspaceProps} />}

        {workspaceTab === 'bi' && <MetaAdsBiWorkspace {...biAdapter.workspace} />}

        {workspaceTab === 'aiPerformance' && (
          <MetaAdsAiPerformanceWorkspace
            data={aiPerformanceQuery.data}
            fetching={aiPerformanceQuery.isFetching}
            period={{
              periodFilter: aiPerformancePeriod.periodFilter,
              customSince: aiPerformancePeriod.customSince,
              customUntil: aiPerformancePeriod.customUntil,
              appliedCustomSince: aiPerformancePeriod.appliedCustomSince,
              appliedCustomUntil: aiPerformancePeriod.appliedCustomUntil,
              inputClassName: metaAdsInputLg,
              onPeriodFilterChange: aiPerformancePeriod.setPeriodFilter,
              onCustomSinceChange: aiPerformancePeriod.onCustomSinceChange,
              onCustomUntilChange: aiPerformancePeriod.onCustomUntilChange,
              onApplyCustomPeriod: aiPerformancePeriod.onApplyCustomPeriod,
            }}
            currency={currency}
            localize={localize}
          />
        )}

        {workspaceTab === 'rulePerformance' && (
          <MetaAdsRulePerformanceWorkspace
            data={rulePerformanceQuery.data}
            fetching={rulePerformanceQuery.isFetching}
            period={{
              periodFilter: rulePerformancePeriod.periodFilter,
              customSince: rulePerformancePeriod.customSince,
              customUntil: rulePerformancePeriod.customUntil,
              appliedCustomSince: rulePerformancePeriod.appliedCustomSince,
              appliedCustomUntil: rulePerformancePeriod.appliedCustomUntil,
              inputClassName: metaAdsInputLg,
              onPeriodFilterChange: rulePerformancePeriod.setPeriodFilter,
              onCustomSinceChange: rulePerformancePeriod.onCustomSinceChange,
              onCustomUntilChange: rulePerformancePeriod.onCustomUntilChange,
              onApplyCustomPeriod: rulePerformancePeriod.onApplyCustomPeriod,
            }}
            currency={currency}
            localize={localize}
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
        metricsFullscreen={biWorkspace.metricsFullscreen}
        selectedBiRankItem={biWorkspace.selectedBiRankItem}
        onCloseBiRank={() => biWorkspace.setSelectedBiRankItem(null)}
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

  return biWorkspace.metricsFullscreen ? (
    createPortal(content, document.body)
  ) : (
    <div className="space-y-4">{content}</div>
  );
}
