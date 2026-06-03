import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToastContext } from '@librechat/client';
import type { TProject, ProjectMetaAdsRecommendation } from 'librechat-data-provider';
import {
  useGetStartupConfig,
  useApplyProjectMetaAdsRecommendationMutation,
  useProjectMetaAdsQuery,
  useRunProjectMetaAdsMutation,
  useUpdateProjectMetaAdsMutation,
} from '~/data-provider';
import { useLocalize } from '~/hooks';
import type { TranslationKeys } from '~/hooks';
import { logger } from '~/utils';
import { buildMetaAdsChatBrief, MAX_META_ADS_CHAT_BRIEF_ENTITIES } from './metaAdsChatBrief';

type MetaAdsRules = NonNullable<NonNullable<TProject['metaAds']>['rules']>;
type MetaAdsSettings = NonNullable<TProject['metaAds']>;
type MetaAdsSettingsState = Omit<MetaAdsSettings, 'rules'> & {
  rules: Required<MetaAdsRules>;
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
    credentialMode: project.metaAds?.tokenSecretName ? 'project_secret' : 'tenant_default',
    automationMode: project.metaAds?.automationMode ?? 'recommend',
    budgetLevel: 'adset',
    scheduleIntervalMinutes: project.metaAds?.scheduleIntervalMinutes ?? 180,
    lastRunAt: project.metaAds?.lastRunAt,
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
  const [runErrorMessage, setRunErrorMessage] = useState<string | null>(null);
  const startupConfigQuery = useGetStartupConfig();
  const statusQuery = useProjectMetaAdsQuery(project.projectId);
  const updateSettings = useUpdateProjectMetaAdsMutation();
  const runAnalysis = useRunProjectMetaAdsMutation();
  const applyRecommendation = useApplyProjectMetaAdsRecommendationMutation();

  useEffect(() => {
    setSettings(normalizeSettings(project));
  }, [project]);

  const pendingRecommendations =
    statusQuery.data?.recommendations.filter((item) => item.status === 'pending') ?? [];
  const latestSnapshots = statusQuery.data?.latestSnapshots.slice(0, 8) ?? [];
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
    applyRecommendation.mutate({
      projectId: project.projectId,
      recommendationId: recommendation._id,
    });
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

  const onToggleSnapshot = (entityId: string) => {
    setSelectedEntityIds((current) =>
      current.includes(entityId)
        ? current.filter((selectedId) => selectedId !== entityId)
        : [...current, entityId].slice(0, MAX_META_ADS_CHAT_BRIEF_ENTITIES),
    );
  };

  const onOpenTrafficAgentChat = () => {
    if (!canOpenTrafficAgentChat || !statusQuery.data) {
      return;
    }
    const brief = buildMetaAdsChatBrief({
      project,
      snapshots: latestSnapshots,
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
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {numberFields.map((field) => (
            <label key={field.key} className="flex flex-col gap-2 text-sm text-text-secondary">
              {localize(field.labelKey)}
              <input
                disabled={!canEdit}
                type="number"
                step={field.step}
                value={settings.rules[field.key]}
                onChange={(event) => onRuleChange(field.key, event.target.value)}
                className="h-10 rounded-lg border border-border-light bg-surface-primary px-3 text-text-primary"
              />
            </label>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border-light bg-surface-secondary p-4">
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
            <button
              type="button"
              disabled={!canOpenTrafficAgentChat}
              onClick={onOpenTrafficAgentChat}
              className="h-8 rounded-lg border border-border-light bg-surface-primary px-3 text-xs font-medium text-text-primary disabled:cursor-not-allowed disabled:opacity-60"
            >
              {localize('com_ui_project_meta_ads_chat_with_agent')}
            </button>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="text-xs text-text-tertiary">
                <tr>
                  <th className="py-2 pr-3">
                    <span className="sr-only">
                      {localize('com_ui_project_meta_ads_select_ad_set')}
                    </span>
                  </th>
                  <th className="py-2 pr-3">{localize('com_ui_name')}</th>
                  <th className="py-2 pr-3">{localize('com_ui_project_meta_ads_budget')}</th>
                  <th className="py-2 pr-3">{localize('com_ui_project_meta_ads_spend')}</th>
                  <th className="py-2 pr-3">CPA</th>
                  <th className="py-2 pr-3">ROAS</th>
                </tr>
              </thead>
              <tbody>
                {latestSnapshots.map((snapshot) => (
                  <tr
                    key={snapshot._id ?? snapshot.entityId}
                    className="border-t border-border-light"
                  >
                    <td className="py-2 pr-3">
                      <input
                        type="checkbox"
                        checked={selectedEntityIds.includes(snapshot.entityId)}
                        aria-label={localize('com_ui_project_meta_ads_select_ad_set')}
                        onChange={() => onToggleSnapshot(snapshot.entityId)}
                        className="h-4 w-4 rounded border-border-light"
                      />
                    </td>
                    <td className="max-w-[220px] truncate py-2 pr-3 text-text-primary">
                      {snapshot.entityName ?? snapshot.entityId}
                    </td>
                    <td className="py-2 pr-3 text-text-secondary">
                      {formatMetric(snapshot.dailyBudget)}
                    </td>
                    <td className="py-2 pr-3 text-text-secondary">
                      {formatMetric(snapshot.spend)}
                    </td>
                    <td className="py-2 pr-3 text-text-secondary">{formatMetric(snapshot.cpa)}</td>
                    <td className="py-2 pr-3 text-text-secondary">{formatMetric(snapshot.roas)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {latestSnapshots.length === 0 && (
              <div className="rounded-lg border border-dashed border-border-light py-8 text-center text-sm text-text-secondary">
                {localize('com_ui_project_meta_ads_no_snapshots')}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
