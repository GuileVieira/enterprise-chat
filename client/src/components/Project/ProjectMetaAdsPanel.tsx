import { Fragment, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToastContext } from '@librechat/client';
import type {
  TProject,
  ProjectMetaAdsCampaignSummary,
  ProjectMetaAdsManualBudgetPayload,
  ProjectMetaAdsRecommendation,
} from 'librechat-data-provider';
import {
  useGetStartupConfig,
  useApplyProjectMetaAdsRecommendationMutation,
  useProjectMetaAdsQuery,
  useRunProjectMetaAdsMutation,
  useUpdateProjectMetaAdsBudgetMutation,
  useUpdateProjectMetaAdsMutation,
} from '~/data-provider';
import { useLocalize } from '~/hooks';
import type { TranslationKeys } from '~/hooks';
import { logger } from '~/utils';
import { buildMetaAdsChatBrief, MAX_META_ADS_CHAT_BRIEF_ENTITIES } from './metaAdsChatBrief';

type MetaAdsRules = NonNullable<NonNullable<TProject['metaAds']>['rules']>;
type MetaAdsSettings = NonNullable<TProject['metaAds']>;
type MetaAdsRuleGroup = NonNullable<MetaAdsSettings['ruleGroups']>[number];
type MetaAdsSettingsState = Omit<MetaAdsSettings, 'rules'> & {
  rules: Required<MetaAdsRules>;
};
type BudgetEditor = {
  entityLevel: ProjectMetaAdsManualBudgetPayload['entityLevel'];
  entityId: string;
  entityName?: string;
  currentBudget?: number;
};
type RuleGroupDraft = {
  id?: string;
  name: string;
  entityLevel: MetaAdsRuleGroup['entityLevel'];
  entityIds: string[];
  rules: Required<MetaAdsRules>;
};
type BudgetConfirmation = ProjectMetaAdsManualBudgetPayload & {
  currentBudget?: number;
};
type ScheduleIntervalMinutes = NonNullable<MetaAdsSettings['scheduleIntervalMinutes']>;
type RequestError = {
  message?: unknown;
  response?: {
    data?: {
      message?: unknown;
    };
  };
};

const scheduleOptions: Array<{ value: ScheduleIntervalMinutes; labelKey: TranslationKeys }> = [
  { value: 30, labelKey: 'com_ui_project_meta_ads_schedule_30' },
  { value: 60, labelKey: 'com_ui_project_meta_ads_schedule_60' },
  { value: 120, labelKey: 'com_ui_project_meta_ads_schedule_120' },
  { value: 180, labelKey: 'com_ui_project_meta_ads_schedule_180' },
  { value: 360, labelKey: 'com_ui_project_meta_ads_schedule_360' },
  { value: 720, labelKey: 'com_ui_project_meta_ads_schedule_720' },
  { value: 1440, labelKey: 'com_ui_project_meta_ads_schedule_1440' },
];

const periodOptions = [
  { value: 'today', labelKey: 'com_ui_project_meta_ads_period_today' },
  { value: 'yesterday', labelKey: 'com_ui_project_meta_ads_period_yesterday' },
  { value: 'last_7d', labelKey: 'com_ui_project_meta_ads_period_last_7d' },
  { value: 'last_14d', labelKey: 'com_ui_project_meta_ads_period_last_14d' },
  { value: 'last_30d', labelKey: 'com_ui_project_meta_ads_period_last_30d' },
] as const;

const defaultRules: Required<MetaAdsRules> = {
  targetCpa: 45,
  minRoas: 2,
  maxIncreasePct: 15,
  maxDecreasePct: 20,
  minDailyBudget: 20,
  maxDailyBudget: 500,
  cooldownHours: 24,
  minSpend: 10,
};

const numberFields: Array<{
  key: keyof Required<MetaAdsRules>;
  labelKey: TranslationKeys;
  step: string;
}> = [
  { key: 'targetCpa', labelKey: 'com_ui_project_meta_ads_target_cpa', step: '0.01' },
  { key: 'minRoas', labelKey: 'com_ui_project_meta_ads_min_roas', step: '0.01' },
  { key: 'maxIncreasePct', labelKey: 'com_ui_project_meta_ads_max_increase', step: '1' },
  { key: 'maxDecreasePct', labelKey: 'com_ui_project_meta_ads_max_decrease', step: '1' },
  { key: 'minDailyBudget', labelKey: 'com_ui_project_meta_ads_min_budget', step: '0.01' },
  { key: 'maxDailyBudget', labelKey: 'com_ui_project_meta_ads_max_budget', step: '0.01' },
  { key: 'cooldownHours', labelKey: 'com_ui_project_meta_ads_cooldown', step: '1' },
  { key: 'minSpend', labelKey: 'com_ui_project_meta_ads_min_spend', step: '0.01' },
];

function formatMetric(value?: number | null) {
  return value == null || Number.isNaN(value) ? '-' : value.toFixed(2);
}

function buildCampaignFallback(
  snapshots: NonNullable<ProjectMetaAdsCampaignSummary['adSets']>,
): ProjectMetaAdsCampaignSummary[] {
  return snapshots.map((snapshot) => ({
    campaignId: snapshot.campaignId ?? snapshot.entityId,
    campaignName: snapshot.campaignName ?? snapshot.entityName,
    spend: snapshot.spend,
    cpa: snapshot.cpa,
    roas: snapshot.roas,
    resultCount: snapshot.resultCount,
    resultType: snapshot.resultType,
    dailyBudget: snapshot.dailyBudget,
    budgetLevel: 'adset',
    editableBudgetLevel: 'adset',
    adSets: [snapshot],
  }));
}

function getAdAccountDigits(value?: string) {
  return (value ?? '').replace(/^act_/i, '').replace(/\D/g, '');
}

function toAdAccountId(value: string) {
  const digits = getAdAccountDigits(value);
  return digits ? `act_${digits}` : '';
}

function normalizeSettings(project: TProject): MetaAdsSettingsState {
  return {
    enabled: project.metaAds?.enabled ?? false,
    adAccountId: project.metaAds?.adAccountId ?? '',
    tokenSecretName: project.metaAds?.tokenSecretName ?? '',
    graphVersion: project.metaAds?.graphVersion ?? '',
    credentialMode: project.metaAds?.tokenSecretName ? 'project_secret' : 'tenant_default',
    automationMode: project.metaAds?.automationMode ?? 'recommend',
    budgetLevel: 'adset',
    scheduleIntervalMinutes: project.metaAds?.scheduleIntervalMinutes ?? 180,
    lastRunAt: project.metaAds?.lastRunAt,
    ruleGroups: project.metaAds?.ruleGroups ?? [],
    ruleOverrides: project.metaAds?.ruleOverrides ?? [],
    rules: {
      ...defaultRules,
      ...(project.metaAds?.rules ?? {}),
    },
  };
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
  if (key === 'spend') {
    return campaign.spend ?? 0;
  }
  if (key === 'cpa') {
    return campaign.cpa ?? Number.MAX_SAFE_INTEGER;
  }
  if (key === 'result') {
    return campaign.resultCount ?? 0;
  }
  return campaign.campaignName ?? campaign.campaignId;
}

function getRecommendationLabel(recommendation?: ProjectMetaAdsRecommendation) {
  if (!recommendation) {
    return '-';
  }
  const current = formatMetric(recommendation.currentDailyBudget);
  const proposed = formatMetric(recommendation.proposedDailyBudget);
  return `${recommendation.action}: ${current} -> ${proposed}`;
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
  const { showToast } = useToastContext();
  const [settings, setSettings] = useState(() => normalizeSettings(project));
  const [metaAccessToken, setMetaAccessToken] = useState('');
  const [showMetaAccessToken, setShowMetaAccessToken] = useState(false);
  const [selectedEntityIds, setSelectedEntityIds] = useState<string[]>([]);
  const [expandedCampaignIds, setExpandedCampaignIds] = useState<string[]>([]);
  const [budgetEditor, setBudgetEditor] = useState<BudgetEditor | null>(null);
  const [manualDailyBudget, setManualDailyBudget] = useState('');
  const [budgetConfirmation, setBudgetConfirmation] = useState<BudgetConfirmation | null>(null);
  const [ruleGroupDraft, setRuleGroupDraft] = useState<RuleGroupDraft | null>(null);
  const [campaignSearch, setCampaignSearch] = useState('');
  const [budgetModeFilter, setBudgetModeFilter] = useState('all');
  const [campaignSort, setCampaignSort] = useState('name_asc');
  const [datePreset, setDatePreset] = useState<(typeof periodOptions)[number]['value']>('last_7d');
  const [runErrorMessage, setRunErrorMessage] = useState<string | null>(null);
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);
  const startupConfigQuery = useGetStartupConfig();
  const statusQuery = useProjectMetaAdsQuery(project.projectId, { datePreset });
  const updateSettings = useUpdateProjectMetaAdsMutation();
  const updateBudget = useUpdateProjectMetaAdsBudgetMutation();
  const runAnalysis = useRunProjectMetaAdsMutation();
  const applyRecommendation = useApplyProjectMetaAdsRecommendationMutation();

  useEffect(() => {
    setSettings(normalizeSettings(project));
  }, [project]);

  const pendingRecommendations =
    statusQuery.data?.recommendations.filter((item) => item.status === 'pending') ?? [];
  const latestSnapshots = statusQuery.data?.latestSnapshots.slice(0, 8) ?? [];
  const campaigns =
    statusQuery.data?.campaigns && statusQuery.data.campaigns.length > 0
      ? statusQuery.data.campaigns
      : buildCampaignFallback(latestSnapshots);
  const tokenCredentials = statusQuery.data?.credentials;
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
  const selectedCampaignIds = selectedEntityIds
    .filter((id) => id.startsWith('campaign:'))
    .map((id) => id.replace('campaign:', ''));
  const selectedAdSetIds = selectedEntityIds
    .filter((id) => id.startsWith('adset:'))
    .map((id) => id.replace('adset:', ''));
  const canCreateRuleGroup =
    canEdit && (selectedCampaignIds.length > 0 || selectedAdSetIds.length > 0);
  const getEntityRuleLabel = (
    entityLevel: MetaAdsRuleGroup['entityLevel'],
    entityId: string,
  ) =>
    settings.ruleGroups?.find(
      (group) => group.entityLevel === entityLevel && group.entityIds?.includes(entityId),
    )?.name ?? '-';
  const getEntityRecommendation = (entityId: string) =>
    pendingRecommendations.find((recommendation) => recommendation.entityId === entityId);
  const filteredCampaigns = campaigns
    .filter((campaign) => {
      const query = campaignSearch.trim().toLowerCase();
      const matchesSearch =
        !query ||
        (campaign.campaignName ?? campaign.campaignId).toLowerCase().includes(query) ||
        campaign.adSets.some((adset) =>
          (adset.entityName ?? adset.entityId).toLowerCase().includes(query),
        );
      const matchesMode =
        budgetModeFilter === 'all' || (campaign.budgetMode ?? 'UNKNOWN') === budgetModeFilter;
      return matchesSearch && matchesMode;
    })
    .sort((first, second) => {
      if (campaignSort === 'spend_desc') {
        return Number(getMetricValue(second, 'spend')) - Number(getMetricValue(first, 'spend'));
      }
      if (campaignSort === 'cpa_asc') {
        return Number(getMetricValue(first, 'cpa')) - Number(getMetricValue(second, 'cpa'));
      }
      if (campaignSort === 'result_desc') {
        return Number(getMetricValue(second, 'result')) - Number(getMetricValue(first, 'result'));
      }
      return String(getMetricValue(first, 'name')).localeCompare(
        String(getMetricValue(second, 'name')),
      );
    });

  const onRuleChange = (key: keyof Required<MetaAdsRules>, value: string) => {
    setSettings((current) => ({
      ...current,
      rules: {
        ...current.rules,
        [key]: Number(value),
      },
    }));
  };

  const onSave = () => {
    const trimmedToken = metaAccessToken.trim();
    logger.debug('MetaAds', 'Saving project Meta Ads settings', {
      projectId: project.projectId,
      hasMetaAccessToken: trimmedToken.length > 0,
      tokenLength: trimmedToken.length,
      tokenSecretName: settings.tokenSecretName,
    });
    updateSettings.mutate(
      {
        projectId: project.projectId,
        metaAds: settings,
        ...(trimmedToken ? { metaAccessToken: trimmedToken } : {}),
      },
      {
        onSuccess: () => {
          setMetaAccessToken('');
          statusQuery.refetch();
          showToast({ message: localize('com_ui_saved'), status: 'success' });
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

  const onUseTenantToken = () => {
    setMetaAccessToken('');
    setSettings((current) => ({
      ...current,
      tokenSecretName: '',
      credentialMode: 'tenant_default',
    }));
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

  const onOpenRuleGroupDraft = () => {
    if (!canCreateRuleGroup) {
      return;
    }
    const entityLevel = selectedCampaignIds.length > 0 ? 'campaign' : 'adset';
    const entityIds = entityLevel === 'campaign' ? selectedCampaignIds : selectedAdSetIds;
    setRuleGroupDraft({
      name: '',
      entityLevel,
      entityIds,
      rules: { ...settings.rules },
    });
  };

  const onEditRuleGroup = (group: MetaAdsRuleGroup) => {
    setRuleGroupDraft({
      id: group.id,
      name: group.name ?? '',
      entityLevel: group.entityLevel,
      entityIds: group.entityIds ?? [],
      rules: { ...defaultRules, ...(group.rules ?? {}) },
    });
  };

  const onDeleteRuleGroup = (groupId?: string) => {
    const nextSettings = {
      ...settings,
      ruleGroups: (settings.ruleGroups ?? []).filter((group) => group.id !== groupId),
    };
    setSettings(nextSettings);
    updateSettings.mutate(
      {
        projectId: project.projectId,
        metaAds: nextSettings,
      },
      {
        onSuccess: () => {
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

  const onRuleGroupRuleChange = (key: keyof Required<MetaAdsRules>, value: string) => {
    setRuleGroupDraft((current) =>
      current
        ? {
            ...current,
            rules: {
              ...current.rules,
              [key]: Number(value),
            },
          }
        : current,
    );
  };

  const onSaveRuleGroup = () => {
    if (!ruleGroupDraft || ruleGroupDraft.entityIds.length === 0) {
      return;
    }
    const nextGroup: MetaAdsRuleGroup = {
      id: ruleGroupDraft.id ?? `${ruleGroupDraft.entityLevel}-${Date.now()}`,
      name:
        ruleGroupDraft.name.trim() || localize('com_ui_project_meta_ads_rule_group_default_name'),
      entityLevel: ruleGroupDraft.entityLevel,
      entityIds: ruleGroupDraft.entityIds,
      enabled: true,
      rules: ruleGroupDraft.rules,
    };
    const existingGroups = settings.ruleGroups ?? [];
    const nextSettings = {
      ...settings,
      ruleGroups: ruleGroupDraft.id
        ? existingGroups.map((group) => (group.id === ruleGroupDraft.id ? nextGroup : group))
        : [...existingGroups, nextGroup],
    };
    setSettings(nextSettings);
    updateSettings.mutate(
      {
        projectId: project.projectId,
        metaAds: nextSettings,
      },
      {
        onSuccess: () => {
          setRuleGroupDraft(null);
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

  const onToggleCampaign = (campaignId: string) => {
    setSelectedEntityIds((current) => {
      const id = `campaign:${campaignId}`;
      return current.includes(id)
        ? current.filter((selectedId) => selectedId !== id)
        : [...current, id].slice(0, MAX_META_ADS_CHAT_BRIEF_ENTITIES);
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

  const onToggleCampaignExpanded = (campaignId: string) => {
    setExpandedCampaignIds((current) =>
      current.includes(campaignId)
        ? current.filter((id) => id !== campaignId)
        : [...current, campaignId],
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

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border-light bg-surface-secondary p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-text-primary">
              {localize('com_ui_project_meta_ads_title')}
            </h3>
            <p className="mt-1 text-sm leading-6 text-text-secondary">
              {localize('com_ui_project_meta_ads_description')}
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              disabled={!canEdit || runAnalysis.isLoading}
              onClick={onRunAnalysis}
              className="h-9 rounded-lg border border-border-light bg-surface-primary px-3 text-sm font-medium text-text-primary disabled:cursor-not-allowed disabled:opacity-60"
            >
              {localize(
                runAnalysis.isLoading
                  ? 'com_ui_project_meta_ads_running'
                  : 'com_ui_project_meta_ads_run',
              )}
            </button>
            <button
              type="button"
              disabled={!canEdit || updateSettings.isLoading}
              onClick={onSave}
              className="h-9 rounded-lg bg-text-primary px-3 text-sm font-medium text-surface-primary disabled:cursor-not-allowed disabled:opacity-60"
            >
              {localize('com_ui_save')}
            </button>
          </div>
        </div>
        {runErrorMessage && (
          <div
            role="alert"
            className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
          >
            {runErrorMessage}
          </div>
        )}

        <div className="mt-5 grid gap-4 md:grid-cols-5">
          <label className="flex flex-col gap-2 text-sm text-text-secondary">
            {localize('com_ui_project_meta_ads_enabled')}
            <select
              disabled={!canEdit}
              value={settings.enabled ? 'true' : 'false'}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  enabled: event.target.value === 'true',
                }))
              }
              className="h-10 rounded-lg border border-border-light bg-surface-primary px-3 text-text-primary"
            >
              <option value="false">{localize('com_ui_project_meta_ads_disabled')}</option>
              <option value="true">{localize('com_ui_project_meta_ads_enabled_state')}</option>
            </select>
          </label>
          <label className="flex flex-col gap-2 text-sm text-text-secondary">
            {localize('com_ui_project_meta_ads_account')}
            <input
              disabled={!canEdit}
              inputMode="numeric"
              pattern="[0-9]*"
              value={getAdAccountDigits(settings.adAccountId)}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  adAccountId: toAdAccountId(event.target.value),
                }))
              }
              placeholder="123456789"
              className="h-10 rounded-lg border border-border-light bg-surface-primary px-3 text-text-primary"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm text-text-secondary">
            {localize('com_ui_project_meta_ads_mode')}
            <select
              disabled={!canEdit}
              value={settings.automationMode}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  automationMode: event.target.value as MetaAdsSettings['automationMode'],
                }))
              }
              className="h-10 rounded-lg border border-border-light bg-surface-primary px-3 text-text-primary"
            >
              <option value="recommend">
                {localize('com_ui_project_meta_ads_mode_recommend')}
              </option>
              <option value="auto_limited">
                {localize('com_ui_project_meta_ads_mode_auto_limited')}
              </option>
            </select>
          </label>
          <label className="flex flex-col gap-2 text-sm text-text-secondary">
            {localize('com_ui_project_meta_ads_schedule')}
            <select
              disabled={!canEdit}
              value={settings.scheduleIntervalMinutes}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  scheduleIntervalMinutes: Number(event.target.value) as ScheduleIntervalMinutes,
                }))
              }
              className="h-10 rounded-lg border border-border-light bg-surface-primary px-3 text-text-primary"
            >
              {scheduleOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {localize(option.labelKey)}
                </option>
              ))}
            </select>
          </label>
          <div className="flex flex-col gap-2 text-sm text-text-secondary">
            <span>{localize('com_ui_project_meta_ads_project_token')}</span>
            <div className="flex h-10 overflow-hidden rounded-lg border border-border-light bg-surface-primary">
              <input
                disabled={!canEdit}
                type={showMetaAccessToken ? 'text' : 'password'}
                value={metaAccessToken}
                onChange={(event) => setMetaAccessToken(event.target.value)}
                placeholder={
                  hasMaskedToken
                    ? '********'
                    : localize('com_ui_project_meta_ads_token_placeholder')
                }
                className="min-w-0 flex-1 bg-transparent px-3 text-text-primary outline-none disabled:cursor-not-allowed"
              />
              <button
                type="button"
                disabled={!canEdit}
                onClick={() => setShowMetaAccessToken((current) => !current)}
                className="shrink-0 border-l border-border-light px-3 text-xs font-medium text-text-secondary disabled:cursor-not-allowed disabled:opacity-60"
              >
                {localize(showMetaAccessToken ? 'com_ui_hide_password' : 'com_ui_show_password')}
              </button>
            </div>
            <span className="text-xs leading-5 text-text-tertiary">
              {localize('com_ui_project_meta_ads_project_token_hint')}
            </span>
            {tokenCredentials && (
              <span className="inline-flex w-fit items-center gap-2 rounded-md border border-border-light px-2 py-1 text-xs text-text-secondary">
                {localize(tokenStatusKey)}
                {hasMaskedToken && <span className="font-mono text-text-primary">********</span>}
              </span>
            )}
            {settings.tokenSecretName && (
              <button
                type="button"
                disabled={!canEdit}
                onClick={onUseTenantToken}
                className="w-fit text-xs font-medium text-text-primary underline-offset-4 hover:underline disabled:cursor-not-allowed disabled:opacity-60"
              >
                {localize('com_ui_project_meta_ads_use_tenant_token')}
              </button>
            )}
          </div>
          <label className="flex flex-col gap-2 text-sm text-text-secondary">
            {localize('com_ui_project_meta_ads_graph_version')}
            <input
              disabled={!canEdit}
              value={settings.graphVersion ?? ''}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  graphVersion: event.target.value,
                }))
              }
              placeholder={statusQuery.data?.graphVersion?.effective ?? 'v25.0'}
              className="h-10 rounded-lg border border-border-light bg-surface-primary px-3 text-text-primary"
            />
            <span className="text-xs leading-5 text-text-tertiary">
              {localize('com_ui_project_meta_ads_graph_version_hint')}
            </span>
          </label>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {numberFields.map((field) => (
            <label key={field.key} className="flex flex-col gap-2 text-sm text-text-secondary">
              {localize(field.labelKey)}
              <input
                disabled={!canEdit}
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
                value={settings.rules[field.key]}
                onChange={(event) => onRuleChange(field.key, event.target.value)}
                className="h-10 rounded-lg border border-border-light bg-surface-primary px-3 text-text-primary"
              />
            </label>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border-light bg-surface-secondary p-4 lg:col-span-2">
          <h3 className="text-sm font-semibold text-text-primary">
            {localize('com_ui_project_meta_ads_recommendations')}
          </h3>
          <div className="mt-4 space-y-3">
            {pendingRecommendations.length > 0 ? (
              pendingRecommendations.map((recommendation) => (
                <div
                  key={recommendation._id ?? recommendation.entityId}
                  className="rounded-lg border border-border-light bg-surface-primary p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-text-primary">
                        {recommendation.entityName ?? recommendation.entityId}
                      </div>
                      <div className="mt-1 text-xs text-text-secondary">
                        {recommendation.action}: {formatMetric(recommendation.currentDailyBudget)}
                        {' -> '}
                        {formatMetric(recommendation.proposedDailyBudget)}
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={!canEdit || applyRecommendation.isLoading}
                      onClick={() => onApply(recommendation)}
                      className="h-8 shrink-0 rounded-lg border border-border-light px-3 text-xs font-medium text-text-primary disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {localize('com_ui_project_meta_ads_apply')}
                    </button>
                  </div>
                  <p className="mt-2 text-sm leading-5 text-text-secondary">
                    {recommendation.reason}
                  </p>
                </div>
              ))
            ) : (
              <div className="rounded-lg border border-dashed border-border-light py-8 text-center text-sm text-text-secondary">
                {localize('com_ui_project_meta_ads_no_recommendations')}
              </div>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-border-light bg-surface-secondary p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-sm font-semibold text-text-primary">
              {localize('com_ui_project_meta_ads_latest')}
            </h3>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={!canCreateRuleGroup}
                onClick={onOpenRuleGroupDraft}
                className="h-8 rounded-lg border border-border-light bg-surface-primary px-3 text-xs font-medium text-text-primary disabled:cursor-not-allowed disabled:opacity-60"
              >
                {localize('com_ui_project_meta_ads_create_rule_group')}
              </button>
              <button
                type="button"
                disabled={!canOpenTrafficAgentChat}
                onClick={onOpenTrafficAgentChat}
                className="h-8 rounded-lg border border-border-light bg-surface-primary px-3 text-xs font-medium text-text-primary disabled:cursor-not-allowed disabled:opacity-60"
              >
                {localize('com_ui_project_meta_ads_chat_with_agent')}
              </button>
            </div>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-[220px_1fr]">
            <label className="flex flex-col gap-1 text-xs text-text-secondary">
              {localize('com_ui_project_meta_ads_period')}
              <select
                value={datePreset}
                onChange={(event) =>
                  setDatePreset(event.target.value as (typeof periodOptions)[number]['value'])
                }
                className="h-9 rounded-lg border border-border-light bg-surface-primary px-3 text-sm text-text-primary"
              >
                {periodOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {localize(option.labelKey)}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid gap-2 sm:grid-cols-4">
              {[
                ['com_ui_project_meta_ads_total_spend', statusQuery.data?.summary?.totalSpend],
                ['com_ui_project_meta_ads_total_results', statusQuery.data?.summary?.totalResults],
                [
                  'com_ui_project_meta_ads_average_cost',
                  statusQuery.data?.summary?.averageCostPerResult,
                ],
                [
                  'com_ui_project_meta_ads_average_frequency',
                  statusQuery.data?.summary?.averageFrequency,
                ],
              ].map(([labelKey, value]) => (
                <div
                  key={labelKey}
                  className="rounded-lg border border-border-light bg-surface-primary p-3"
                >
                  <div className="text-xs text-text-tertiary">
                    {localize(labelKey as TranslationKeys)}
                  </div>
                  <div className="mt-1 text-lg font-semibold text-text-primary">
                    {formatMetric(value as number | null | undefined)}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <label className="flex flex-col gap-1 text-xs text-text-secondary">
              {localize('com_ui_project_meta_ads_search')}
              <input
                value={campaignSearch}
                onChange={(event) => setCampaignSearch(event.target.value)}
                className="h-9 rounded-lg border border-border-light bg-surface-primary px-3 text-sm text-text-primary"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-text-secondary">
              {localize('com_ui_project_meta_ads_budget_mode_filter')}
              <select
                value={budgetModeFilter}
                onChange={(event) => setBudgetModeFilter(event.target.value)}
                className="h-9 rounded-lg border border-border-light bg-surface-primary px-3 text-sm text-text-primary"
              >
                <option value="all">{localize('com_ui_all')}</option>
                <option value="CBO">CBO</option>
                <option value="ABO">ABO</option>
                <option value="UNKNOWN">UNKNOWN</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-text-secondary">
              {localize('com_ui_project_meta_ads_sort')}
              <select
                value={campaignSort}
                onChange={(event) => setCampaignSort(event.target.value)}
                className="h-9 rounded-lg border border-border-light bg-surface-primary px-3 text-sm text-text-primary"
              >
                <option value="name_asc">{localize('com_ui_name')}</option>
                <option value="spend_desc">{localize('com_ui_project_meta_ads_spend')}</option>
                <option value="cpa_asc">{localize('com_ui_project_meta_ads_cost_result')}</option>
                <option value="result_desc">{localize('com_ui_project_meta_ads_result')}</option>
              </select>
            </label>
          </div>
          {(settings.ruleGroups ?? []).length > 0 && (
            <div className="mt-4 rounded-lg border border-border-light bg-surface-primary p-3">
              <h4 className="text-xs font-semibold uppercase text-text-tertiary">
                {localize('com_ui_project_meta_ads_rule_groups')}
              </h4>
              <div className="mt-3 space-y-2">
                {(settings.ruleGroups ?? []).map((group) => (
                  <div
                    key={group.id ?? group.name}
                    className="flex flex-col gap-2 rounded-lg border border-border-light p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-text-primary">
                        {group.name}
                      </div>
                      <div className="text-xs text-text-secondary">
                        {group.entityLevel} · {(group.entityIds ?? []).length}{' '}
                        {localize('com_ui_project_meta_ads_rule_group_selected')}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={!canEdit}
                        onClick={() => onEditRuleGroup(group)}
                        className="h-8 rounded-lg border border-border-light px-3 text-xs font-medium text-text-primary disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {localize('com_ui_project_meta_ads_edit_rule_group')}
                      </button>
                      <button
                        type="button"
                        disabled={!canEdit}
                        onClick={() => onDeleteRuleGroup(group.id)}
                        className="h-8 rounded-lg border border-border-light px-3 text-xs font-medium text-text-primary disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {localize('com_ui_project_meta_ads_delete_rule_group')}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {budgetEditor && (
            <div className="mt-4 flex flex-col gap-3 rounded-lg border border-border-light bg-surface-primary p-3 sm:flex-row sm:items-end">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-text-primary">
                  {budgetEditor.entityName ?? budgetEditor.entityId}
                </div>
                <div className="text-xs text-text-secondary">
                  {localize('com_ui_project_meta_ads_manual_budget_hint')}
                </div>
              </div>
              <label className="flex flex-col gap-1 text-xs text-text-secondary">
                {localize('com_ui_project_meta_ads_new_budget')}
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={manualDailyBudget}
                  onChange={(event) => setManualDailyBudget(event.target.value)}
                  className="h-9 w-32 rounded-lg border border-border-light bg-surface-secondary px-3 text-sm text-text-primary"
                />
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setBudgetEditor(null)}
                  className="h-9 rounded-lg border border-border-light px-3 text-xs font-medium text-text-secondary"
                >
                  {localize('com_ui_cancel')}
                </button>
                <button
                  type="button"
                  disabled={updateBudget.isLoading}
                  onClick={onSaveManualBudget}
                  className="h-9 rounded-lg bg-text-primary px-3 text-xs font-medium text-surface-primary disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {localize('com_ui_project_meta_ads_save_budget')}
                </button>
              </div>
            </div>
          )}
          {budgetConfirmation && (
            <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
              <div className="font-semibold">
                {localize('com_ui_project_meta_ads_confirm_budget_title')}
              </div>
              <div className="mt-1">
                {budgetConfirmation.entityName ?? budgetConfirmation.entityId}:{' '}
                {formatMetric(budgetConfirmation.currentBudget)}
                {' -> '}
                {formatMetric(budgetConfirmation.dailyBudget)}
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => setBudgetConfirmation(null)}
                  className="h-8 rounded-lg border border-amber-300 px-3 text-xs font-medium"
                >
                  {localize('com_ui_cancel')}
                </button>
                <button
                  type="button"
                  disabled={updateBudget.isLoading}
                  onClick={onConfirmManualBudget}
                  className="h-8 rounded-lg bg-amber-900 px-3 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {localize('com_ui_project_meta_ads_confirm_budget')}
                </button>
              </div>
            </div>
          )}
          {ruleGroupDraft && (
            <div className="mt-4 rounded-lg border border-border-light bg-surface-primary p-3">
              <div className="grid gap-3 md:grid-cols-4">
                <label className="flex flex-col gap-1 text-xs text-text-secondary md:col-span-2">
                  {localize('com_ui_project_meta_ads_rule_group_name')}
                  <input
                    value={ruleGroupDraft.name}
                    onChange={(event) =>
                      setRuleGroupDraft((current) =>
                        current ? { ...current, name: event.target.value } : current,
                      )
                    }
                    className="h-9 rounded-lg border border-border-light bg-surface-secondary px-3 text-sm text-text-primary"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs text-text-secondary">
                  {localize('com_ui_project_meta_ads_rule_group_target_cpa')}
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={ruleGroupDraft.rules.targetCpa}
                    onChange={(event) => onRuleGroupRuleChange('targetCpa', event.target.value)}
                    className="h-9 rounded-lg border border-border-light bg-surface-secondary px-3 text-sm text-text-primary"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs text-text-secondary">
                  {localize('com_ui_project_meta_ads_max_budget')}
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={ruleGroupDraft.rules.maxDailyBudget}
                    onChange={(event) =>
                      onRuleGroupRuleChange('maxDailyBudget', event.target.value)
                    }
                    className="h-9 rounded-lg border border-border-light bg-surface-secondary px-3 text-sm text-text-primary"
                  />
                </label>
              </div>
              <div className="mt-3 flex items-center justify-between gap-3">
                <span className="text-xs text-text-secondary">
                  {localize('com_ui_project_meta_ads_rule_group_selected')}:{' '}
                  {ruleGroupDraft.entityIds.length}
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setRuleGroupDraft(null)}
                    className="h-8 rounded-lg border border-border-light px-3 text-xs font-medium text-text-secondary"
                  >
                    {localize('com_ui_cancel')}
                  </button>
                  <button
                    type="button"
                    disabled={updateSettings.isLoading}
                    onClick={onSaveRuleGroup}
                    className="h-8 rounded-lg bg-text-primary px-3 text-xs font-medium text-surface-primary disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {localize('com_ui_project_meta_ads_save_rule_group')}
                  </button>
                </div>
              </div>
            </div>
          )}
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[1120px] text-left text-sm">
              <thead className="text-xs text-text-tertiary">
                <tr>
                  <th className="py-2 pr-3">
                    <span className="sr-only">
                      {localize('com_ui_project_meta_ads_select_ad_set')}
                    </span>
                  </th>
                  <th className="py-2 pr-3">
                    <span className="sr-only">
                      {localize('com_ui_project_meta_ads_expand_campaign')}
                    </span>
                  </th>
                  <th className="py-2 pr-3">{localize('com_ui_name')}</th>
                  <th className="py-2 pr-3">{localize('com_ui_project_meta_ads_objective')}</th>
                  <th className="py-2 pr-3">{localize('com_ui_project_meta_ads_budget_mode')}</th>
                  <th className="py-2 pr-3">{localize('com_ui_project_meta_ads_result')}</th>
                  <th className="py-2 pr-3">{localize('com_ui_project_meta_ads_cost_result')}</th>
                  <th className="py-2 pr-3">{localize('com_ui_project_meta_ads_budget')}</th>
                  <th className="py-2 pr-3">{localize('com_ui_project_meta_ads_spend')}</th>
                  <th className="py-2 pr-3">{localize('com_ui_project_meta_ads_reach')}</th>
                  <th className="py-2 pr-3">{localize('com_ui_project_meta_ads_impressions')}</th>
                  <th className="py-2 pr-3">{localize('com_ui_project_meta_ads_clicks')}</th>
                  <th className="py-2 pr-3">{localize('com_ui_project_meta_ads_frequency')}</th>
                  <th className="py-2 pr-3">CTR</th>
                  <th className="py-2 pr-3">CPC</th>
                  <th className="py-2 pr-3">CPM</th>
                  <th className="py-2 pr-3">{localize('com_ui_project_meta_ads_video_p75')}</th>
                  <th className="py-2 pr-3">
                    <span className="sr-only">{localize('com_ui_project_meta_ads_actions')}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredCampaigns.map((campaign) => {
                  const expanded = expandedCampaignIds.includes(campaign.campaignId);
                  const selected = selectedEntityIds.includes(`campaign:${campaign.campaignId}`);
                  return (
                    <Fragment key={campaign.campaignId}>
                      <tr
                        key={campaign.campaignId}
                        data-testid="meta-ads-campaign-row"
                        className="border-t border-border-light"
                      >
                        <td className="py-2 pr-3">
                          <input
                            type="checkbox"
                            checked={selected}
                            aria-label={localize('com_ui_project_meta_ads_select_campaign')}
                            onChange={() => onToggleCampaign(campaign.campaignId)}
                            className="h-4 w-4 rounded border-border-light"
                          />
                        </td>
                        <td className="py-2 pr-3">
                          {campaign.adSets.length > 0 && (
                            <button
                              type="button"
                              aria-label={localize('com_ui_project_meta_ads_expand_campaign')}
                              onClick={() => onToggleCampaignExpanded(campaign.campaignId)}
                              className="h-7 w-7 rounded-md border border-border-light text-xs text-text-secondary"
                            >
                              {expanded ? '-' : '+'}
                            </button>
                          )}
                        </td>
                        <td className="max-w-[240px] truncate py-2 pr-3 font-medium text-text-primary">
                          {campaign.campaignName ?? campaign.campaignId}
                        </td>
                        <td className="py-2 pr-3 text-text-secondary">
                          {campaign.objective ?? '-'}
                        </td>
                        <td className="py-2 pr-3 text-text-secondary">
                          {campaign.budgetMode ?? '-'}
                        </td>
                        <td className="py-2 pr-3 text-text-secondary">
                          {formatMetric(campaign.resultCount)}
                        </td>
                        <td className="py-2 pr-3 text-text-secondary">
                          {formatMetric(campaign.cpa)}
                        </td>
                        <td className="py-2 pr-3 text-text-secondary">
                          {formatMetric(campaign.dailyBudget)}
                        </td>
                        <td className="py-2 pr-3 text-text-secondary">
                          {formatMetric(campaign.spend)}
                        </td>
                        <td className="py-2 pr-3 text-text-secondary">
                          {formatMetric(campaign.reach)}
                        </td>
                        <td className="py-2 pr-3 text-text-secondary">
                          {formatMetric(campaign.impressions)}
                        </td>
                        <td className="py-2 pr-3 text-text-secondary">
                          {formatMetric(campaign.clicks)}
                        </td>
                        <td className="py-2 pr-3 text-text-secondary">
                          {formatMetric(campaign.frequency)}
                        </td>
                        <td className="py-2 pr-3 text-text-secondary">
                          {formatMetric(campaign.ctr)}
                        </td>
                        <td className="py-2 pr-3 text-text-secondary">
                          {formatMetric(campaign.cpc)}
                        </td>
                        <td className="py-2 pr-3 text-text-secondary">
                          {formatMetric(campaign.cpm)}
                        </td>
                        <td className="py-2 pr-3 text-text-secondary">
                          {formatMetric(campaign.videoP75Watched)}
                        </td>
                        <td className="py-2 pr-3">
                          {campaign.editableBudgetLevel === 'campaign' && (
                            <button
                              type="button"
                              disabled={!canEdit}
                              onClick={() =>
                                onOpenBudgetEditor({
                                  entityLevel: 'campaign',
                                  entityId: campaign.campaignId,
                                  entityName: campaign.campaignName,
                                  currentBudget: campaign.dailyBudget,
                                })
                              }
                              className="h-8 rounded-lg border border-border-light px-3 text-xs font-medium text-text-primary disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {localize('com_ui_project_meta_ads_edit_budget')}
                            </button>
                          )}
                        </td>
                      </tr>
                      {expanded &&
                        campaign.adSets.map((adset) => {
                          const adsetSelected = selectedEntityIds.includes(
                            `adset:${adset.entityId}`,
                          );
                          return (
                            <tr key={adset.entityId} className="border-t border-border-light">
                              <td className="py-2 pl-6 pr-3">
                                <input
                                  type="checkbox"
                                  checked={adsetSelected}
                                  aria-label={localize('com_ui_project_meta_ads_select_ad_set')}
                                  onChange={() => onToggleAdSet(adset.entityId)}
                                  className="h-4 w-4 rounded border-border-light"
                                />
                              </td>
                              <td className="py-2 pr-3" />
                              <td className="max-w-[240px] truncate py-2 pr-3 text-text-primary">
                                {adset.entityName ?? adset.entityId}
                              </td>
                              <td className="py-2 pr-3 text-text-tertiary">-</td>
                              <td className="py-2 pr-3 text-text-secondary">
                                {campaign.budgetMode === 'ABO' ? 'ABO' : '-'}
                              </td>
                              <td className="py-2 pr-3 text-text-secondary">
                                {formatMetric(adset.resultCount)}
                              </td>
                              <td className="py-2 pr-3 text-text-secondary">
                                {formatMetric(adset.cpa)}
                              </td>
                              <td className="py-2 pr-3 text-text-secondary">
                                {formatMetric(adset.dailyBudget)}
                              </td>
                              <td className="py-2 pr-3 text-text-secondary">
                                {formatMetric(adset.spend)}
                              </td>
                              <td className="py-2 pr-3 text-text-secondary">
                                {formatMetric(adset.reach)}
                              </td>
                              <td className="py-2 pr-3 text-text-secondary">
                                {formatMetric(adset.impressions)}
                              </td>
                              <td className="py-2 pr-3 text-text-secondary">
                                {formatMetric(adset.clicks)}
                              </td>
                              <td className="py-2 pr-3 text-text-secondary">
                                {formatMetric(adset.frequency)}
                              </td>
                              <td className="py-2 pr-3 text-text-secondary">
                                {formatMetric(adset.ctr)}
                              </td>
                              <td className="py-2 pr-3 text-text-secondary">
                                {formatMetric(adset.cpc)}
                              </td>
                              <td className="py-2 pr-3 text-text-secondary">
                                {formatMetric(adset.cpm)}
                              </td>
                              <td className="py-2 pr-3 text-text-secondary">
                                {formatMetric(adset.videoP75Watched)}
                              </td>
                              <td className="py-2 pr-3">
                                {campaign.editableBudgetLevel === 'adset' && (
                                  <button
                                    type="button"
                                    disabled={!canEdit}
                                    onClick={() =>
                                      onOpenBudgetEditor({
                                        entityLevel: 'adset',
                                        entityId: adset.entityId,
                                        entityName: adset.entityName,
                                        currentBudget: adset.dailyBudget,
                                      })
                                    }
                                    className="h-8 rounded-lg border border-border-light px-3 text-xs font-medium text-text-primary disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    {localize('com_ui_project_meta_ads_edit_budget')}
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
            {filteredCampaigns.length === 0 && (
              <div className="rounded-lg border border-dashed border-border-light py-8 text-center text-sm text-text-secondary">
                {localize('com_ui_project_meta_ads_no_snapshots')}
              </div>
            )}
          </div>
          <div className="mt-4 rounded-lg border border-border-light bg-surface-primary p-3">
            <h4 className="text-xs font-semibold uppercase text-text-tertiary">
              {localize('com_ui_project_meta_ads_history')}
            </h4>
            <div className="mt-3 space-y-2">
              {(statusQuery.data?.changes ?? []).length > 0 ? (
                (statusQuery.data?.changes ?? []).slice(0, 8).map((change) => (
                  <div
                    key={change._id ?? `${change.entityId}-${change.createdAt}`}
                    className="flex flex-col gap-1 rounded-lg border border-border-light p-3 text-sm sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="truncate font-medium text-text-primary">
                        {change.entityName ?? change.entityId}
                      </div>
                      <div className="text-xs text-text-secondary">
                        {change.actor ?? '-'} · {change.reason ?? '-'}
                      </div>
                    </div>
                    <div className="font-mono text-xs text-text-secondary">
                      {formatMetric(change.previousDailyBudget)}
                      {' -> '}
                      {formatMetric(change.newDailyBudget)}
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-lg border border-dashed border-border-light py-6 text-center text-sm text-text-secondary">
                  {localize('com_ui_project_meta_ads_no_history')}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
