import { useCallback, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { SystemRoles } from 'librechat-data-provider';
import { useToastContext } from '@librechat/client';
import type {
  ProjectMetaAdsCampaignSummary,
  ProjectMetaAdsBudgetChange,
  TProject,
} from 'librechat-data-provider';
import {
  useGetStartupConfig,
  useApplyProjectMetaAdsRecommendationMutation,
  useDuplicateProjectMetaAdsEntityMutation,
  useProjectMetaAdsRankingsQuery,
  useProjectMetaAdsQuery,
  useProjectMetaAdsRuleHistoryQuery,
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
import { MetaAdsHistoryPanel } from './metaAds/historyPanel';
import { MetaAdsDialogsLayer } from './metaAds/dialogsLayer';
import { MetaAdsOverviewWorkspace } from './metaAds/overviewWorkspace';
import { MetaAdsRulePerformanceWorkspace } from './metaAds/rulePerformanceWorkspace';
import { MetaAdsRuleHistoryPanel } from './metaAds/ruleHistoryPanel';
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

function getBudgetChangeCacheKey(change: ProjectMetaAdsBudgetChange): string {
  return (
    change._id ??
    `${change.entityLevel ?? 'campaign'}:${change.entityId}:${change.createdAt ?? ''}:${
      change.newDailyBudget ?? ''
    }`
  );
}

function mergeBudgetChanges(
  confirmedChanges: ProjectMetaAdsBudgetChange[],
  existingChanges: ProjectMetaAdsBudgetChange[],
): ProjectMetaAdsBudgetChange[] {
  const seen = new Set<string>();
  return [...confirmedChanges, ...existingChanges].filter((change) => {
    const key = getBudgetChangeCacheKey(change);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function applyBudgetChangesToCampaigns(
  campaigns: ProjectMetaAdsCampaignSummary[],
  changes: ProjectMetaAdsBudgetChange[],
): ProjectMetaAdsCampaignSummary[] {
  if (changes.length === 0) {
    return campaigns;
  }

  const campaignBudgets = new Map<string, number>();
  const adSetBudgets = new Map<string, number>();
  for (let index = changes.length - 1; index >= 0; index -= 1) {
    const change = changes[index];
    const nextBudget = change.newDailyBudget;
    if (typeof nextBudget !== 'number' || !Number.isFinite(nextBudget)) {
      continue;
    }
    if (change.entityLevel === 'adset') {
      adSetBudgets.set(change.entityId, nextBudget);
      continue;
    }
    campaignBudgets.set(change.entityId, nextBudget);
  }

  if (campaignBudgets.size === 0 && adSetBudgets.size === 0) {
    return campaigns;
  }

  return campaigns.map((campaign) => {
    let changed = false;
    const adSets = campaign.adSets.map((adSet) => {
      const nextAdSetBudget = adSetBudgets.get(adSet.entityId);
      if (nextAdSetBudget == null) {
        return adSet;
      }
      changed = true;
      return { ...adSet, dailyBudget: nextAdSetBudget };
    });

    if (campaignBudgets.has(campaign.campaignId)) {
      changed = true;
    }

    if (!changed) {
      return campaign;
    }

    return {
      ...campaign,
      dailyBudget: campaignBudgets.get(campaign.campaignId) ?? campaign.dailyBudget,
      adSets,
    };
  });
}

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
  const [runNoticeMessage, setRunNoticeMessage] = useState<string | null>(null);
  const [runNoticeStatus, setRunNoticeStatus] = useState<'success' | 'error'>('error');
  const [confirmedBudgetChanges, setConfirmedBudgetChanges] = useState<ProjectMetaAdsBudgetChange[]>(
    [],
  );
  const biWorkspace = useMetaAdsBiWorkspace();
  const selection = useMetaAdsSelection({ maxSelectedEntities: MAX_META_ADS_CHAT_BRIEF_ENTITIES });
  const startupConfigQuery = useGetStartupConfig();
  const overviewPeriod = useMetaAdsPeriodFilter();
  const biPeriod = useMetaAdsPeriodFilter();
  const rulePerformancePeriod = useMetaAdsPeriodFilter();
  const snapshotStatusQuery = useProjectMetaAdsQuery(project.projectId, {
    ...overviewPeriod.statusParams,
    scope: 'snapshot',
  });
  const liveStatusQuery = useProjectMetaAdsQuery(
    project.projectId,
    {
      ...overviewPeriod.statusParams,
      scope: 'live',
    },
    {
      enabled: Boolean(project.projectId && snapshotStatusQuery.data),
      initialData: snapshotStatusQuery.data,
      initialDataUpdatedAt: 0,
    },
  );
  const statusQuery = liveStatusQuery.data ? liveStatusQuery : snapshotStatusQuery;
  const biStatusQuery = useProjectMetaAdsQuery(project.projectId, biPeriod.statusParams, {
    enabled: workspaceTab === 'bi',
  });
  const rulePerformanceQuery = useProjectMetaAdsRulePerformanceQuery(
    project.projectId,
    rulePerformancePeriod.statusParams,
    { enabled: workspaceTab === 'rules' },
  );
  const ruleHistoryQuery = useProjectMetaAdsRuleHistoryQuery(project.projectId, {
    enabled: workspaceTab === 'rules',
  });
  const biRankingsQuery = useProjectMetaAdsRankingsQuery(
    project.projectId,
    {
      ...biPeriod.statusParams,
      level: biWorkspace.biControls.level,
      objective: biWorkspace.biControls.objective,
      resultType: biWorkspace.biControls.resultType,
    },
    {
      enabled: workspaceTab === 'bi',
    },
  );
  const updateSettings = useUpdateProjectMetaAdsMutation();
  const updateTenantToken = useUpdateProjectMetaAdsTenantTokenMutation();
  const updateBudget = useUpdateProjectMetaAdsBudgetMutation();
  const duplicateEntity = useDuplicateProjectMetaAdsEntityMutation();
  const updateEntityStatus = useUpdateProjectMetaAdsEntityStatusMutation();
  const runAnalysis = useRunProjectMetaAdsMutation();
  const applyRecommendation = useApplyProjectMetaAdsRecommendationMutation();
  const onManualBudgetChange = useCallback((change: ProjectMetaAdsBudgetChange) => {
    setConfirmedBudgetChanges((current) => mergeBudgetChanges([change], current));
  }, []);
  const metaAdsSettings = useMetaAdsSettings({
    project,
    statusQuery,
    updateSettings,
    updateBudget,
    updateTenantToken,
    onManualBudgetChange,
    localize,
    showToast,
  });
  const {
    settings,
    settingsDrawer,
    setSettings,
    hasUnsavedSettingsDraft,
    draftStatus,
    settingsDraftSummary,
    onSave,
    onOpenPublishSettingsDraft,
    onDiscardSettingsDraft,
    openSettingsDrawer,
    setManualBudgetDraft,
  } = metaAdsSettings;
  const metaAdsEntityActions = useMetaAdsEntityActions({
    project,
    statusQuery,
    duplicateEntity,
    updateEntityStatus,
    applyRecommendation,
    settings,
    onManualBudgetDraft: setManualBudgetDraft,
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
  const baseCampaigns =
    statusQuery.data?.campaigns && statusQuery.data.campaigns.length > 0
      ? statusQuery.data.campaigns
      : buildCampaignFallback(latestSnapshots);
  const campaigns = useMemo(
    () => applyBudgetChangesToCampaigns(baseCampaigns, confirmedBudgetChanges),
    [baseCampaigns, confirmedBudgetChanges],
  );
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
    campaigns,
    selectedCampaignIds: selection.selectedCampaignIds,
    selectedAdSetIds: selection.selectedAdSetIds,
    canUseMetaAdsActions,
    localize,
    showToast,
  });
  const biCampaigns = useMemo(
    () =>
      biStatusQuery.data?.campaigns
        ? applyBudgetChangesToCampaigns(biStatusQuery.data.campaigns, confirmedBudgetChanges)
        : campaigns,
    [biStatusQuery.data?.campaigns, campaigns, confirmedBudgetChanges],
  );
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
    objectiveOptions: biAdapter.objectiveOptions,
    statusSummary: statusQuery.data?.summary,
    monthlyBudget: statusQuery.data?.monthlyBudget,
    goalProgress: statusQuery.data?.goalProgress,
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
    setRunNoticeMessage,
    setRunNoticeStatus,
  });
  const budgetChanges = useMemo(
    () =>
      mergeBudgetChanges(
        confirmedBudgetChanges,
        biStatusQuery.data?.changes ?? statusQuery.data?.changes ?? [],
      ),
    [confirmedBudgetChanges, biStatusQuery.data?.changes, statusQuery.data?.changes],
  );

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
        savingSettings={updateSettings.isLoading || updateBudget.isLoading}
        hasUnsavedSettingsDraft={hasUnsavedSettingsDraft}
        draftStatus={draftStatus}
        settingsDraftSummary={settingsDraftSummary}
        runNoticeMessage={runNoticeMessage}
        runNoticeStatus={runNoticeStatus}
        localize={localize}
        onRunAnalysis={onRunAnalysis}
        onOpenSettingsDrawer={openSettingsDrawer}
        onOpenRuleGroupDraft={metaAdsRules.onOpenRuleGroupDraft}
        onWorkspaceTabChange={setWorkspaceTab}
        onToggleFullscreen={() => biWorkspace.setMetricsFullscreen((current) => !current)}
        onSave={onSave}
        onPublishDraft={onOpenPublishSettingsDraft}
        onDiscardDraft={onDiscardSettingsDraft}
      >
        {workspaceTab === 'overview' && (
          <>
            <MetaAdsOverviewWorkspace {...overviewWorkspaceProps} />
            <div className="p-5 pt-0">
              <MetaAdsHistoryPanel
                changes={budgetChanges}
                currency={currency}
                localize={localize}
              />
            </div>
          </>
        )}

        {workspaceTab === 'bi' && <MetaAdsBiWorkspace {...biAdapter.workspace} />}

        {workspaceTab === 'rules' && (
          <>
            <MetaAdsRulePerformanceWorkspace
              data={rulePerformanceQuery.data}
              fetching={rulePerformanceQuery.isFetching}
              rows={metaAdsRules.ruleRows}
              canCreateRuleGroup={metaAdsRules.canCreateRuleGroup}
              canUseMetaAdsActions={canUseMetaAdsActions}
              saving={updateSettings.isLoading}
              primaryButtonClassName={metaAdsPrimaryButton}
              onCreateRuleGroup={metaAdsRules.onOpenRuleGroupDraft}
              onToggleRuleRow={metaAdsRules.onToggleRuleRow}
              onEditGlobalRule={metaAdsRules.onEditGlobalRule}
              onEditRuleGroup={metaAdsRules.onEditRuleGroup}
              onEditRuleOverride={metaAdsRules.onEditRuleOverride}
              onDeleteRuleGroup={metaAdsRules.onDeleteRuleGroup}
              onDeleteRuleOverride={metaAdsRules.onDeleteRuleOverride}
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
            <MetaAdsRuleHistoryPanel
              changes={ruleHistoryQuery.data?.changes ?? []}
              fetching={ruleHistoryQuery.isFetching}
              localize={localize}
            />
          </>
        )}
      </MetaAdsWorkspaceShell>

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
