import { Fragment, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToastContext } from '@librechat/client';
import type {
  TProject,
  ProjectMetaAdsCampaignSummary,
  ProjectMetaAdsBudgetChange,
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
type MetaAdsCreativeRules = NonNullable<NonNullable<TProject['metaAds']>['creativeRules']>;
type MetaAdsSettings = NonNullable<TProject['metaAds']>;
type MetaAdsRuleGroup = NonNullable<MetaAdsSettings['ruleGroups']>[number];
type MetaAdsSettingsState = Omit<MetaAdsSettings, 'rules' | 'creativeRules'> & {
  rules: Required<MetaAdsRules>;
  creativeRules: Required<MetaAdsCreativeRules>;
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
type SelectionCheckboxProps = {
  checked: boolean;
  ariaLabel: string;
  onChange: () => void;
  className?: string;
};
type ExpandToggleProps = {
  expanded: boolean;
  ariaLabel: string;
  onClick: () => void;
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
const defaultCreativeRules: Required<MetaAdsCreativeRules> = {
  maxFrequency: 5,
};

function SelectionCheckbox({
  checked,
  ariaLabel,
  onChange,
  className = '',
}: SelectionCheckboxProps) {
  return (
    <label className={`group inline-grid h-7 w-7 cursor-pointer place-items-center ${className}`}>
      <input
        type="checkbox"
        checked={checked}
        aria-label={ariaLabel}
        onChange={onChange}
        className="peer sr-only"
      />
      <span
        aria-hidden="true"
        className="flex h-[18px] w-[18px] items-center justify-center border border-border-light bg-surface-primary text-transparent transition-colors duration-150 group-hover:border-text-secondary peer-checked:border-text-primary peer-checked:bg-text-primary peer-checked:text-surface-primary peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-text-primary"
      >
        <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none">
          <path
            d="M2.25 6.15 4.7 8.6l5.05-5.2"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    </label>
  );
}

function ExpandToggle({ expanded, ariaLabel, onClick }: ExpandToggleProps) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      aria-expanded={expanded}
      onClick={onClick}
      className="inline-grid h-7 w-7 place-items-center border border-border-light bg-surface-primary text-sm leading-none text-text-secondary transition-colors duration-150 hover:border-text-secondary hover:bg-surface-secondary hover:text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text-primary active:bg-surface-primary"
    >
      <span aria-hidden="true" className="-mt-px font-mono">
        {expanded ? '-' : '+'}
      </span>
    </button>
  );
}

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

function formatMoney(value: number | null | undefined, currency = 'BRL') {
  if (value == null || Number.isNaN(value)) {
    return '-';
  }
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency,
  }).format(value);
}

function formatSignedMoney(value: number | null | undefined, currency = 'BRL') {
  if (value == null || Number.isNaN(value)) {
    return '-';
  }
  const sign = value > 0 ? '+' : value < 0 ? '-' : '';
  return `${sign}${formatMoney(Math.abs(value), currency)}`;
}

function formatSignedPercent(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) {
    return '-';
  }
  const sign = value > 0 ? '+' : value < 0 ? '-' : '';
  return `${sign}${Math.abs(value).toFixed(2)}%`;
}

function formatSignedMetric(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) {
    return '-';
  }
  const sign = value > 0 ? '+' : value < 0 ? '-' : '';
  return `${sign}${Math.abs(value).toFixed(2)}`;
}

function formatTrendDate(value: string) {
  const [, month, day] = value.match(/^(\d{4})-(\d{2})-(\d{2})$/) ?? [];
  return month && day ? `${day}/${month}` : value;
}

function buildBudgetReferences(currentBudget: number | null | undefined, currency = 'BRL') {
  const current = Number(currentBudget);
  if (!Number.isFinite(current) || current <= 0) {
    return [];
  }
  return [15, 20, 30].map((percent) => ({
    percent,
    label: `${percent}% = ${formatMoney(current * (1 + percent / 100), currency)}`,
  }));
}

function getBudgetChangeDelta(change: ProjectMetaAdsBudgetChange) {
  if (change.deltaDailyBudget != null) {
    return {
      deltaDailyBudget: change.deltaDailyBudget,
      deltaPercent: change.deltaPercent ?? null,
    };
  }
  const previous = Number(change.previousDailyBudget);
  const next = Number(change.newDailyBudget);
  if (!Number.isFinite(next)) {
    return {
      deltaDailyBudget: null,
      deltaPercent: null,
    };
  }
  const deltaDailyBudget = Number((next - (Number.isFinite(previous) ? previous : 0)).toFixed(2));
  const deltaPercent =
    Number.isFinite(previous) && previous > 0
      ? Number(((deltaDailyBudget / previous) * 100).toFixed(2))
      : null;
  return {
    deltaDailyBudget,
    deltaPercent,
  };
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

function isSupportedGraphVersion(value?: string) {
  const match = value?.trim().match(/^v(\d+)\.0$/);
  return match ? Number(match[1]) >= 24 : false;
}

function getGraphVersionOptions(effectiveVersion?: string) {
  return Array.from(
    new Set([
      'v24.0',
      'v25.0',
      ...(isSupportedGraphVersion(effectiveVersion) ? [effectiveVersion] : []),
    ]),
  );
}

function normalizeSettings(project: TProject): MetaAdsSettingsState {
  return {
    enabled: project.metaAds?.enabled ?? false,
    adAccountId: project.metaAds?.adAccountId ?? '',
    tokenSecretName: project.metaAds?.tokenSecretName ?? '',
    graphVersion: isSupportedGraphVersion(project.metaAds?.graphVersion)
      ? project.metaAds?.graphVersion
      : '',
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
    creativeRules: {
      ...defaultCreativeRules,
      ...(project.metaAds?.creativeRules ?? {}),
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
  if (key === 'budget') {
    return campaign.dailyBudget ?? 0;
  }
  if (key === 'frequency') {
    return campaign.frequency ?? 0;
  }
  if (key === 'spend') {
    return campaign.spend ?? 0;
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
  const [collapsedAboCampaignIds, setCollapsedAboCampaignIds] = useState<string[]>([]);
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
  const isStatusLoading = Boolean(statusQuery.isLoading || statusQuery.isFetching);
  const isInitialStatusLoading = isStatusLoading && !statusQuery.data;

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
  const currency = statusQuery.data?.currency ?? 'BRL';
  const graphVersionOptions = getGraphVersionOptions(statusQuery.data?.graphVersion?.effective);
  const trend = statusQuery.data?.trend;
  const trendPoints = trend?.points ?? [];
  const campaignDeltas = trend?.campaignDeltas ?? [];
  const changesByDay = trend?.changesByDay ?? [];
  const dailySpendTrend = trendPoints.reduce<Array<{ date: string; spend: number }>>(
    (items, point) => {
      const existing = items.find((item) => item.date === point.date);
      if (existing) {
        existing.spend += Number(point.spend ?? 0);
        return items;
      }
      return [...items, { date: point.date, spend: Number(point.spend ?? 0) }];
    },
    [],
  );
  const maxDailySpend = Math.max(...dailySpendTrend.map((point) => point.spend), 0);
  const bestEvolution = [...campaignDeltas]
    .sort((left, right) => {
      const resultDiff = Number(right.resultDelta ?? 0) - Number(left.resultDelta ?? 0);
      if (resultDiff !== 0) {
        return resultDiff;
      }
      return Number(left.cpaDelta ?? 0) - Number(right.cpaDelta ?? 0);
    })
    .slice(0, 3);
  const evolutionAlerts = campaignDeltas
    .filter(
      (delta) =>
        Number(delta.cpaDelta ?? 0) > 0 ||
        Number(delta.frequencyDelta ?? 0) > 0 ||
        Number(delta.latestChange?.deltaDailyBudget ?? 0) !== 0,
    )
    .slice(0, 4);
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
  const getEntityRuleLabel = (entityLevel: MetaAdsRuleGroup['entityLevel'], entityId: string) =>
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
      const [key, direction = 'asc'] = campaignSort.split('_') as [string, 'asc' | 'desc'];
      if (key === 'name') {
        const result = String(getMetricValue(first, 'name')).localeCompare(
          String(getMetricValue(second, 'name')),
        );
        return direction === 'desc' ? -result : result;
      }
      return compareNumberSort(first, second, key, direction);
    });

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
        className={`inline-flex w-full items-center gap-1 text-xs font-semibold uppercase text-text-tertiary hover:text-text-primary ${
          className ?? ''
        }`}
      >
        <span>{label}</span>
        {isActive && (
          <span aria-hidden="true" className="text-text-primary">
            {activeDirection === 'asc' ? '↑' : '↓'}
          </span>
        )}
      </button>
    );
  };

  const onRuleChange = (key: keyof Required<MetaAdsRules>, value: string) => {
    setSettings((current) => ({
      ...current,
      rules: {
        ...current.rules,
        [key]: Number(value),
      },
    }));
  };

  const onCreativeRuleChange = (key: keyof Required<MetaAdsCreativeRules>, value: string) => {
    setSettings((current) => ({
      ...current,
      creativeRules: {
        ...current.creativeRules,
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
    <div className="space-y-3">
      <div className="border border-border-light bg-surface-primary">
        <div className="flex flex-col gap-3 border-b border-border-light p-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-base font-semibold text-text-primary">
              {localize('com_ui_project_meta_ads_title')}
            </h3>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-text-secondary">
              <span>{localize(tokenStatusKey)}</span>
              <span className="text-text-tertiary">·</span>
              <span>{settings.automationMode}</span>
              <span className="text-text-tertiary">·</span>
              <span>
                {localize('com_ui_project_meta_ads_schedule_minutes', {
                  0: String(settings.scheduleIntervalMinutes),
                })}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!canEdit || runAnalysis.isLoading}
              onClick={onRunAnalysis}
              className="h-8 border border-border-light px-3 text-xs font-medium text-text-primary disabled:cursor-not-allowed disabled:opacity-60"
            >
              {localize(
                runAnalysis.isLoading
                  ? 'com_ui_project_meta_ads_running'
                  : 'com_ui_project_meta_ads_run',
              )}
            </button>
            <button
              type="button"
              onClick={() => setShowSettingsPanel((current) => !current)}
              className="h-8 border border-border-light px-3 text-xs font-medium text-text-primary"
            >
              {localize('com_ui_project_meta_ads_settings')}
            </button>
            <button
              type="button"
              disabled={!canEdit || updateSettings.isLoading}
              onClick={onSave}
              className="h-8 bg-text-primary px-3 text-xs font-medium text-surface-primary disabled:cursor-not-allowed disabled:opacity-60"
            >
              {localize('com_ui_save')}
            </button>
          </div>
        </div>
        {runErrorMessage && (
          <div
            role="alert"
            className="m-3 border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
          >
            {runErrorMessage}
          </div>
        )}

        {showSettingsPanel && (
          <div className="border-b border-border-light bg-surface-secondary p-3">
            <div className="grid gap-3 md:grid-cols-5">
              <label className="flex flex-col gap-1 text-xs text-text-secondary">
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
                  className="h-9 border border-border-light bg-surface-primary px-3 text-sm text-text-primary"
                >
                  <option value="false">{localize('com_ui_project_meta_ads_disabled')}</option>
                  <option value="true">{localize('com_ui_project_meta_ads_enabled_state')}</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs text-text-secondary">
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
                  className="h-9 border border-border-light bg-surface-primary px-3 text-sm text-text-primary"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-text-secondary">
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
                  className="h-9 border border-border-light bg-surface-primary px-3 text-sm text-text-primary"
                >
                  <option value="recommend">
                    {localize('com_ui_project_meta_ads_mode_recommend')}
                  </option>
                  <option value="auto_limited">
                    {localize('com_ui_project_meta_ads_mode_auto_limited')}
                  </option>
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs text-text-secondary">
                {localize('com_ui_project_meta_ads_schedule')}
                <select
                  disabled={!canEdit}
                  value={settings.scheduleIntervalMinutes}
                  onChange={(event) =>
                    setSettings((current) => ({
                      ...current,
                      scheduleIntervalMinutes: Number(
                        event.target.value,
                      ) as ScheduleIntervalMinutes,
                    }))
                  }
                  className="h-9 border border-border-light bg-surface-primary px-3 text-sm text-text-primary"
                >
                  {scheduleOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {localize(option.labelKey)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs text-text-secondary">
                {localize('com_ui_project_meta_ads_graph_version')}
                <select
                  disabled={!canEdit}
                  value={settings.graphVersion ?? ''}
                  onChange={(event) =>
                    setSettings((current) => ({ ...current, graphVersion: event.target.value }))
                  }
                  autoComplete="off"
                  className="h-9 border border-border-light bg-surface-primary px-3 text-sm text-text-primary"
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
            </div>
            <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(260px,1fr)_2fr]">
              <div className="flex flex-col gap-2 text-xs text-text-secondary">
                <span>{localize('com_ui_project_meta_ads_project_token')}</span>
                <div className="flex h-9 overflow-hidden border border-border-light bg-surface-primary">
                  <input
                    disabled={!canEdit}
                    type={showMetaAccessToken ? 'text' : 'password'}
                    name="meta_ads_project_token_new"
                    autoComplete="new-password"
                    value={metaAccessToken}
                    onChange={(event) => setMetaAccessToken(event.target.value)}
                    placeholder={
                      hasMaskedToken
                        ? localize('com_ui_project_meta_ads_token_keep_existing')
                        : localize('com_ui_project_meta_ads_token_placeholder')
                    }
                    className="min-w-0 flex-1 bg-transparent px-3 text-sm text-text-primary outline-none disabled:cursor-not-allowed"
                  />
                  {metaAccessToken.length > 0 && (
                    <button
                      type="button"
                      disabled={!canEdit}
                      onClick={() => setShowMetaAccessToken((current) => !current)}
                      className="shrink-0 border-l border-border-light px-3 text-xs font-medium text-text-secondary disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {localize(
                        showMetaAccessToken ? 'com_ui_hide_password' : 'com_ui_show_password',
                      )}
                    </button>
                  )}
                </div>
                <span className="text-xs leading-5 text-text-tertiary">
                  {localize('com_ui_project_meta_ads_project_token_hint')}
                </span>
                {tokenCredentials && (
                  <span className="inline-flex w-fit items-center gap-2 border border-border-light px-2 py-1 text-xs text-text-secondary">
                    {localize(tokenStatusKey)}
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
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {numberFields.map((field) => (
                  <label
                    key={field.key}
                    className="flex flex-col gap-1 text-xs text-text-secondary"
                  >
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
                      className="h-9 border border-border-light bg-surface-primary px-3 text-sm text-text-primary"
                    />
                  </label>
                ))}
                <label className="flex flex-col gap-1 text-xs text-text-secondary">
                  {localize('com_ui_project_meta_ads_max_frequency_alert')}
                  <input
                    disabled={!canEdit}
                    type="number"
                    step="0.01"
                    min="0"
                    value={settings.creativeRules.maxFrequency}
                    onChange={(event) => onCreativeRuleChange('maxFrequency', event.target.value)}
                    className="h-9 border border-border-light bg-surface-primary px-3 text-sm text-text-primary"
                  />
                </label>
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-3 border-b border-border-light p-3">
          {isStatusLoading && (
            <div
              role="status"
              className="flex items-center gap-2 border border-border-light bg-surface-secondary px-3 py-2 text-xs text-text-secondary"
            >
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-border-light border-t-text-primary" />
              <span>{localize('com_ui_project_meta_ads_loading')}</span>
            </div>
          )}
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="grid gap-2 md:grid-cols-4 lg:flex lg:items-end">
              <label className="flex flex-col gap-1 text-xs text-text-secondary">
                {localize('com_ui_project_meta_ads_period')}
                <select
                  value={datePreset}
                  onChange={(event) =>
                    setDatePreset(event.target.value as (typeof periodOptions)[number]['value'])
                  }
                  className="h-8 border border-border-light bg-surface-primary px-2 text-xs text-text-primary"
                >
                  {periodOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {localize(option.labelKey)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs text-text-secondary">
                {localize('com_ui_project_meta_ads_search')}
                <input
                  value={campaignSearch}
                  onChange={(event) => setCampaignSearch(event.target.value)}
                  className="h-8 border border-border-light bg-surface-primary px-2 text-xs text-text-primary"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-text-secondary">
                {localize('com_ui_project_meta_ads_budget_mode_filter')}
                <select
                  value={budgetModeFilter}
                  onChange={(event) => setBudgetModeFilter(event.target.value)}
                  className="h-8 border border-border-light bg-surface-primary px-2 text-xs text-text-primary"
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
                  className="h-8 border border-border-light bg-surface-primary px-2 text-xs text-text-primary"
                >
                  <option value="name_asc">{localize('com_ui_name')}</option>
                  <option value="budget_desc">
                    {localize('com_ui_project_meta_ads_budget_defined')}
                  </option>
                  <option value="frequency_desc">
                    {localize('com_ui_project_meta_ads_frequency')}
                  </option>
                  <option value="spend_desc">{localize('com_ui_project_meta_ads_spend')}</option>
                  <option value="cpa_asc">{localize('com_ui_project_meta_ads_cost_result')}</option>
                  <option value="result_desc">{localize('com_ui_project_meta_ads_result')}</option>
                  <option value="ctr_desc">CTR</option>
                  <option value="clicks_desc">{localize('com_ui_project_meta_ads_clicks')}</option>
                </select>
              </label>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={!canCreateRuleGroup}
                onClick={onOpenRuleGroupDraft}
                className="h-8 border border-border-light px-3 text-xs font-medium text-text-primary disabled:cursor-not-allowed disabled:opacity-60"
              >
                {localize('com_ui_project_meta_ads_create_rule_group')}
              </button>
              <button
                type="button"
                disabled={!canOpenTrafficAgentChat}
                onClick={onOpenTrafficAgentChat}
                className="h-8 border border-border-light px-3 text-xs font-medium text-text-primary disabled:cursor-not-allowed disabled:opacity-60"
              >
                {localize('com_ui_project_meta_ads_chat_with_agent')}
              </button>
            </div>
          </div>
          <div className="grid border border-border-light sm:grid-cols-4">
            {[
              [
                'com_ui_project_meta_ads_total_spend',
                formatMoney(statusQuery.data?.summary?.totalSpend, currency),
              ],
              [
                'com_ui_project_meta_ads_total_results',
                formatMetric(statusQuery.data?.summary?.totalResults),
              ],
              [
                'com_ui_project_meta_ads_average_cost',
                formatMoney(statusQuery.data?.summary?.averageCostPerResult, currency),
              ],
              [
                'com_ui_project_meta_ads_average_frequency',
                formatMetric(statusQuery.data?.summary?.averageFrequency),
              ],
            ].map(([labelKey, value]) => (
              <div key={labelKey} className="border-border-light p-3 last:border-r-0 sm:border-r">
                <div className="text-[11px] uppercase text-text-tertiary">
                  {localize(labelKey as TranslationKeys)}
                </div>
                {isInitialStatusLoading ? (
                  <div
                    data-testid="meta-ads-summary-skeleton"
                    className="mt-2 h-6 w-24 animate-pulse bg-surface-secondary"
                  />
                ) : (
                  <div className="mt-1 font-mono text-lg font-semibold text-text-primary">
                    {value}
                  </div>
                )}
              </div>
            ))}
          </div>
          {(trendPoints.length > 0 || campaignDeltas.length > 0 || changesByDay.length > 0) && (
            <div className="grid gap-3 xl:grid-cols-[1.4fr_1fr]">
              <div className="border border-border-light bg-surface-primary p-3">
                <div className="flex items-center justify-between gap-3">
                  <h4 className="text-xs font-semibold uppercase text-text-tertiary">
                    {localize('com_ui_project_meta_ads_evolution')}
                  </h4>
                  <span className="font-mono text-[11px] text-text-tertiary">
                    {trendPoints.length} {localize('com_ui_project_meta_ads_trend_points')}
                  </span>
                </div>
                <div className="mt-3 flex h-28 items-end gap-1 border-b border-border-light">
                  {dailySpendTrend.length > 0 ? (
                    dailySpendTrend.map((point) => {
                      const height =
                        maxDailySpend > 0 ? Math.max(8, (point.spend / maxDailySpend) * 100) : 8;
                      return (
                        <div
                          key={point.date}
                          className="flex min-w-8 flex-1 flex-col items-center justify-end gap-1"
                        >
                          <div
                            title={`${formatTrendDate(point.date)} · ${formatMoney(
                              point.spend,
                              currency,
                            )}`}
                            className="bg-text-primary/80 w-full"
                            style={{ height: `${height}%` }}
                          />
                        </div>
                      );
                    })
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-sm text-text-secondary">
                      {localize('com_ui_project_meta_ads_no_evolution')}
                    </div>
                  )}
                </div>
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-text-tertiary">
                  {dailySpendTrend.slice(-8).map((point) => (
                    <span key={point.date} className="font-mono">
                      {formatTrendDate(point.date)} {formatMoney(point.spend, currency)}
                    </span>
                  ))}
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-1">
                <div className="border border-border-light bg-surface-primary p-3">
                  <h4 className="text-xs font-semibold uppercase text-text-tertiary">
                    {localize('com_ui_project_meta_ads_best_evolution')}
                  </h4>
                  <div className="mt-3 divide-y divide-border-light">
                    {bestEvolution.length > 0 ? (
                      bestEvolution.map((delta) => (
                        <div key={delta.campaignId} className="py-2 first:pt-0 last:pb-0">
                          <div className="truncate text-sm font-medium text-text-primary">
                            {delta.campaignName ?? delta.campaignId}
                          </div>
                          <div className="mt-1 grid grid-cols-3 gap-2 font-mono text-xs text-text-secondary">
                            <span>{formatSignedMoney(delta.spendDelta, currency)}</span>
                            <span>{formatSignedMetric(delta.resultDelta)}</span>
                            <span>{formatSignedMoney(delta.cpaDelta, currency)}</span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="py-4 text-sm text-text-secondary">
                        {localize('com_ui_project_meta_ads_no_evolution')}
                      </div>
                    )}
                  </div>
                </div>

                <div className="border border-border-light bg-surface-primary p-3">
                  <h4 className="text-xs font-semibold uppercase text-text-tertiary">
                    {localize('com_ui_project_meta_ads_budget_changes')}
                  </h4>
                  <div className="mt-3 divide-y divide-border-light">
                    {evolutionAlerts.length > 0 ? (
                      evolutionAlerts.map((delta) => (
                        <div key={delta.campaignId} className="py-2 first:pt-0 last:pb-0">
                          <div className="truncate text-sm font-medium text-text-primary">
                            {delta.latestChange?.entityName ??
                              delta.campaignName ??
                              delta.campaignId}
                          </div>
                          <div className="mt-1 flex flex-wrap gap-2 font-mono text-xs text-text-secondary">
                            <span>
                              {formatSignedMoney(
                                delta.latestChange?.deltaDailyBudget ?? delta.budgetDelta,
                                currency,
                              )}
                            </span>
                            {delta.frequencyDelta != null && (
                              <span>
                                {formatSignedMetric(delta.frequencyDelta)}{' '}
                                {localize('com_ui_project_meta_ads_frequency')}
                              </span>
                            )}
                            {delta.latestChange?.actor && <span>{delta.latestChange.actor}</span>}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="py-4 text-sm text-text-secondary">
                        {localize('com_ui_project_meta_ads_no_history')}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {(settings.ruleGroups ?? []).length > 0 && (
          <div className="border-b border-border-light bg-surface-secondary p-3">
            <h4 className="text-xs font-semibold uppercase text-text-tertiary">
              {localize('com_ui_project_meta_ads_rule_groups')}
            </h4>
            <div className="mt-2 flex flex-wrap gap-2">
              {(settings.ruleGroups ?? []).map((group) => (
                <div
                  key={group.id ?? group.name}
                  className="flex items-center gap-2 border border-border-light bg-surface-primary px-2 py-1 text-xs text-text-secondary"
                >
                  <span className="font-medium text-text-primary">{group.name}</span>
                  <span>
                    {group.entityLevel} · {(group.entityIds ?? []).length}{' '}
                    {localize('com_ui_project_meta_ads_rule_group_selected')}
                  </span>
                  <button
                    type="button"
                    disabled={!canEdit}
                    onClick={() => onEditRuleGroup(group)}
                    className="font-medium text-text-primary disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {localize('com_ui_project_meta_ads_edit_rule_group')}
                  </button>
                  <button
                    type="button"
                    disabled={!canEdit}
                    onClick={() => onDeleteRuleGroup(group.id)}
                    className="font-medium text-text-primary disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {localize('com_ui_project_meta_ads_delete_rule_group')}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

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
                  <button
                    type="button"
                    disabled={!canEdit || applyRecommendation.isLoading}
                    onClick={() => onApply(recommendation)}
                    className="h-7 shrink-0 border border-border-light px-2 font-medium text-text-primary disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {localize('com_ui_project_meta_ads_apply')}
                  </button>
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
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          >
            <div className="w-full max-w-md border border-border-light bg-surface-primary p-4 shadow-xl">
              <div className="min-w-0">
                <h4
                  id="meta-ads-budget-dialog-title"
                  className="truncate text-base font-semibold text-text-primary"
                >
                  {localize('com_ui_project_meta_ads_edit_budget')}
                </h4>
                <div className="mt-2 truncate text-sm font-medium text-text-primary">
                  {budgetEditor.entityName ?? budgetEditor.entityId}
                </div>
                <div className="mt-1 text-xs uppercase text-text-tertiary">
                  {budgetEditor.entityLevel === 'campaign'
                    ? localize('com_ui_project_meta_ads_campaign')
                    : localize('com_ui_project_meta_ads_select_ad_set')}
                </div>
                <div className="mt-2 text-xs text-text-secondary">
                  {localize('com_ui_project_meta_ads_manual_budget_hint')}
                </div>
                <div className="mt-3 text-sm text-text-secondary">
                  {localize('com_ui_project_meta_ads_budget_defined')}:{' '}
                  <span className="font-mono text-text-primary">
                    {formatMoney(budgetEditor.currentBudget, currency)}
                  </span>
                </div>
                {buildBudgetReferences(budgetEditor.currentBudget, currency).length > 0 && (
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {buildBudgetReferences(budgetEditor.currentBudget, currency).map(
                      (reference) => (
                        <div
                          key={reference.percent}
                          className="border border-border-light bg-surface-secondary p-2 text-center font-mono text-xs text-text-secondary"
                        >
                          {reference.label}
                        </div>
                      ),
                    )}
                  </div>
                )}
              </div>
              <label className="mt-4 flex flex-col gap-1 text-xs text-text-secondary">
                {localize('com_ui_project_meta_ads_new_budget')}
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={manualDailyBudget}
                  onChange={(event) => setManualDailyBudget(event.target.value)}
                  className="h-9 border border-border-light bg-surface-secondary px-3 text-sm text-text-primary"
                />
              </label>
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setBudgetEditor(null)}
                  className="h-8 border border-border-light px-3 text-xs font-medium text-text-secondary"
                >
                  {localize('com_ui_cancel')}
                </button>
                <button
                  type="button"
                  disabled={updateBudget.isLoading}
                  onClick={onSaveManualBudget}
                  className="h-8 bg-text-primary px-3 text-xs font-medium text-surface-primary disabled:cursor-not-allowed disabled:opacity-60"
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

        {ruleGroupDraft && (
          <div className="border-b border-border-light bg-surface-secondary p-3">
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
                  className="h-9 border border-border-light bg-surface-primary px-3 text-sm text-text-primary"
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
                  className="h-9 border border-border-light bg-surface-primary px-3 text-sm text-text-primary"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-text-secondary">
                {localize('com_ui_project_meta_ads_max_budget')}
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={ruleGroupDraft.rules.maxDailyBudget}
                  onChange={(event) => onRuleGroupRuleChange('maxDailyBudget', event.target.value)}
                  className="h-9 border border-border-light bg-surface-primary px-3 text-sm text-text-primary"
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
                  className="h-8 border border-border-light px-3 text-xs font-medium text-text-secondary"
                >
                  {localize('com_ui_cancel')}
                </button>
                <button
                  type="button"
                  disabled={updateSettings.isLoading}
                  onClick={onSaveRuleGroup}
                  className="h-8 bg-text-primary px-3 text-xs font-medium text-surface-primary disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {localize('com_ui_project_meta_ads_save_rule_group')}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1520px] table-fixed text-left text-xs">
            <thead className="border-b border-border-light bg-surface-secondary text-[11px] uppercase text-text-tertiary">
              <tr>
                <th className="w-10 px-2 py-2">
                  <span className="sr-only">
                    {localize('com_ui_project_meta_ads_select_ad_set')}
                  </span>
                </th>
                <th className="w-10 px-2 py-2">
                  <span className="sr-only">
                    {localize('com_ui_project_meta_ads_expand_campaign')}
                  </span>
                </th>
                <th className="w-28 px-2 py-2">{localize('com_ui_project_meta_ads_delivery')}</th>
                <th className="w-64 px-2 py-2">
                  {renderSortableHeader({
                    key: 'name',
                    label: localize('com_ui_project_meta_ads_campaign'),
                    defaultDirection: 'asc',
                  })}
                </th>
                <th className="w-28 px-2 py-2 text-right">
                  {renderSortableHeader({
                    key: 'budget',
                    label: localize('com_ui_project_meta_ads_budget_defined'),
                    className: 'justify-end text-right',
                  })}
                </th>
                <th className="w-40 px-2 py-2">{localize('com_ui_project_meta_ads_objective')}</th>
                <th className="w-24 px-2 py-2">
                  {localize('com_ui_project_meta_ads_budget_mode')}
                </th>
                <th className="w-24 px-2 py-2 text-right">
                  {renderSortableHeader({
                    key: 'frequency',
                    label: localize('com_ui_project_meta_ads_frequency'),
                    className: 'justify-end text-right',
                  })}
                </th>
                <th className="w-24 px-2 py-2 text-right">
                  {renderSortableHeader({
                    key: 'result',
                    label: localize('com_ui_project_meta_ads_results'),
                    className: 'justify-end text-right',
                  })}
                </th>
                <th className="w-28 px-2 py-2 text-right">
                  {renderSortableHeader({
                    key: 'cpa',
                    label: localize('com_ui_project_meta_ads_cost_result'),
                    className: 'justify-end text-right',
                    defaultDirection: 'asc',
                  })}
                </th>
                <th className="w-28 px-2 py-2 text-right">
                  {renderSortableHeader({
                    key: 'spend',
                    label: localize('com_ui_project_meta_ads_spend'),
                    className: 'justify-end text-right',
                  })}
                </th>
                <th className="w-20 px-2 py-2 text-right">
                  {renderSortableHeader({
                    key: 'ctr',
                    label: 'CTR',
                    className: 'justify-end text-right',
                  })}
                </th>
                <th className="w-20 px-2 py-2 text-right">
                  {renderSortableHeader({
                    key: 'clicks',
                    label: localize('com_ui_project_meta_ads_clicks'),
                    className: 'justify-end text-right',
                  })}
                </th>
                <th className="w-24 px-2 py-2 text-right">
                  {localize('com_ui_project_meta_ads_video_p75')}
                </th>
                <th className="w-40 px-2 py-2">{localize('com_ui_project_meta_ads_rule')}</th>
                <th className="w-64 px-2 py-2">
                  {localize('com_ui_project_meta_ads_recommendation')}
                </th>
                <th className="w-32 px-2 py-2">
                  <span className="sr-only">{localize('com_ui_project_meta_ads_actions')}</span>
                </th>
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
                    <td className="px-2 py-3" colSpan={17}>
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
              {filteredCampaigns.map((campaign) => {
                const expanded =
                  campaign.budgetMode === 'ABO'
                    ? !collapsedAboCampaignIds.includes(campaign.campaignId)
                    : expandedCampaignIds.includes(campaign.campaignId);
                const selected = selectedEntityIds.includes(`campaign:${campaign.campaignId}`);
                const recommendation = getEntityRecommendation(campaign.campaignId);
                return (
                  <Fragment key={campaign.campaignId}>
                    <tr
                      data-testid="meta-ads-campaign-row"
                      className={`border-b border-border-light transition-colors ${
                        selected ? 'bg-surface-secondary/50' : ''
                      }`}
                    >
                      <td className="px-2 py-2 align-middle">
                        <SelectionCheckbox
                          checked={selected}
                          onChange={() => onToggleCampaign(campaign.campaignId)}
                          ariaLabel={localize('com_ui_project_meta_ads_select_campaign')}
                        />
                      </td>
                      <td className="px-2 py-2 align-middle">
                        {campaign.adSets.length > 0 && (
                          <ExpandToggle
                            expanded={expanded}
                            onClick={() => onToggleCampaignExpanded(campaign)}
                            ariaLabel={localize('com_ui_project_meta_ads_expand_campaign')}
                          />
                        )}
                      </td>
                      <td className="px-2 py-2 text-text-secondary">
                        {localize('com_ui_project_meta_ads_active')}
                      </td>
                      <td className="truncate px-2 py-2 font-medium text-text-primary">
                        {campaign.campaignName ?? campaign.campaignId}
                      </td>
                      <td className="px-2 py-2 text-right font-mono text-text-secondary">
                        {campaign.editableBudgetLevel === 'campaign' ? (
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
                            className="border border-border-light bg-surface-secondary px-2 py-1 font-mono text-text-primary underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:text-text-secondary"
                          >
                            {formatMoney(campaign.dailyBudget, currency)}
                          </button>
                        ) : (
                          formatMoney(campaign.dailyBudget, currency)
                        )}
                      </td>
                      <td className="truncate px-2 py-2 text-text-secondary">
                        {campaign.objective ?? '-'}
                      </td>
                      <td className="px-2 py-2 text-text-secondary">
                        {campaign.budgetMode ?? '-'}
                      </td>
                      <td className="px-2 py-2 text-right font-mono text-text-secondary">
                        {formatMetric(campaign.frequency)}
                      </td>
                      <td className="px-2 py-2 text-right font-mono text-text-secondary">
                        {formatMetric(campaign.resultCount)}
                      </td>
                      <td className="px-2 py-2 text-right font-mono text-text-secondary">
                        {formatMoney(campaign.cpa, currency)}
                      </td>
                      <td className="px-2 py-2 text-right font-mono text-text-secondary">
                        {formatMoney(campaign.spend, currency)}
                      </td>
                      <td className="px-2 py-2 text-right font-mono text-text-secondary">
                        {formatMetric(campaign.ctr)}
                      </td>
                      <td className="px-2 py-2 text-right font-mono text-text-secondary">
                        {formatMetric(campaign.clicks)}
                      </td>
                      <td className="px-2 py-2 text-right font-mono text-text-secondary">
                        {formatMetric(campaign.videoP75Watched)}
                      </td>
                      <td className="truncate px-2 py-2 text-text-secondary">
                        {getEntityRuleLabel('campaign', campaign.campaignId)}
                      </td>
                      <td className="px-2 py-2 text-text-secondary">
                        <div className="truncate">
                          {getRecommendationLabel(recommendation, currency)}
                        </div>
                        {recommendation?.reason && (
                          <div className="truncate text-text-tertiary">{recommendation.reason}</div>
                        )}
                      </td>
                      <td className="px-2 py-2">
                        <div className="flex gap-1">
                          {recommendation && (
                            <button
                              type="button"
                              disabled={!canEdit || applyRecommendation.isLoading}
                              onClick={() => onApply(recommendation)}
                              className="h-7 border border-border-light px-2 text-[11px] font-medium text-text-primary disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {localize('com_ui_project_meta_ads_apply')}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {expanded &&
                      campaign.adSets.map((adset) => {
                        const adsetSelected = selectedEntityIds.includes(`adset:${adset.entityId}`);
                        const adsetRecommendation = getEntityRecommendation(adset.entityId);
                        return (
                          <tr
                            key={adset.entityId}
                            className={`border-b border-border-light transition-colors ${
                              adsetSelected ? 'bg-surface-secondary/70' : 'bg-surface-secondary/40'
                            }`}
                          >
                            <td className="px-2 py-2 align-middle">
                              <SelectionCheckbox
                                checked={adsetSelected}
                                onChange={() => onToggleAdSet(adset.entityId)}
                                ariaLabel={localize('com_ui_project_meta_ads_select_ad_set')}
                                className="ml-4"
                              />
                            </td>
                            <td className="px-2 py-2 align-middle">
                              <span aria-hidden="true" className="block h-7 w-7" />
                            </td>
                            <td className="px-2 py-2 text-text-secondary">
                              {localize('com_ui_project_meta_ads_active')}
                            </td>
                            <td className="truncate px-2 py-2 text-text-primary">
                              {adset.entityName ?? adset.entityId}
                            </td>
                            <td className="px-2 py-2 text-right font-mono text-text-secondary">
                              {campaign.editableBudgetLevel === 'adset' ? (
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
                                  className="border border-border-light bg-surface-primary px-2 py-1 font-mono text-text-primary underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:text-text-secondary"
                                >
                                  {formatMoney(adset.dailyBudget, currency)}
                                </button>
                              ) : (
                                formatMoney(adset.dailyBudget, currency)
                              )}
                            </td>
                            <td className="px-2 py-2 text-text-tertiary">-</td>
                            <td className="px-2 py-2 text-text-secondary">
                              {campaign.budgetMode === 'ABO' ? 'ABO' : '-'}
                            </td>
                            <td className="px-2 py-2 text-right font-mono text-text-secondary">
                              {formatMetric(adset.frequency)}
                            </td>
                            <td className="px-2 py-2 text-right font-mono text-text-secondary">
                              {formatMetric(adset.resultCount)}
                            </td>
                            <td className="px-2 py-2 text-right font-mono text-text-secondary">
                              {formatMoney(adset.cpa, currency)}
                            </td>
                            <td className="px-2 py-2 text-right font-mono text-text-secondary">
                              {formatMoney(adset.spend, currency)}
                            </td>
                            <td className="px-2 py-2 text-right font-mono text-text-secondary">
                              {formatMetric(adset.ctr)}
                            </td>
                            <td className="px-2 py-2 text-right font-mono text-text-secondary">
                              {formatMetric(adset.clicks)}
                            </td>
                            <td className="px-2 py-2 text-right font-mono text-text-secondary">
                              {formatMetric(adset.videoP75Watched)}
                            </td>
                            <td className="truncate px-2 py-2 text-text-secondary">
                              {getEntityRuleLabel('adset', adset.entityId)}
                            </td>
                            <td className="px-2 py-2 text-text-secondary">
                              <div className="truncate">
                                {getRecommendationLabel(adsetRecommendation, currency)}
                              </div>
                              {adsetRecommendation?.reason && (
                                <div className="truncate text-text-tertiary">
                                  {adsetRecommendation.reason}
                                </div>
                              )}
                            </td>
                            <td className="px-2 py-2">
                              <div className="flex gap-1">
                                {adsetRecommendation && (
                                  <button
                                    type="button"
                                    disabled={!canEdit || applyRecommendation.isLoading}
                                    onClick={() => onApply(adsetRecommendation)}
                                    className="h-7 border border-border-light px-2 text-[11px] font-medium text-text-primary disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    {localize('com_ui_project_meta_ads_apply')}
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
          {filteredCampaigns.length === 0 && !isInitialStatusLoading && (
            <div className="border-t border-dashed border-border-light py-8 text-center text-sm text-text-secondary">
              {localize('com_ui_project_meta_ads_no_snapshots')}
            </div>
          )}
        </div>
      </div>

      <div className="border border-border-light bg-surface-primary p-3">
        <h4 className="text-xs font-semibold uppercase text-text-tertiary">
          {localize('com_ui_project_meta_ads_history')}
        </h4>
        <div className="mt-3 space-y-2">
          {(statusQuery.data?.changes ?? []).length > 0 ? (
            (statusQuery.data?.changes ?? []).slice(0, 8).map((change) => {
              const delta = getBudgetChangeDelta(change);
              return (
                <div
                  key={change._id ?? `${change.entityId}-${change.createdAt}`}
                  className="flex flex-col gap-1 border border-border-light p-3 text-sm sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="truncate font-medium text-text-primary">
                      {change.entityName ?? change.entityId}
                    </div>
                    <div className="text-xs text-text-secondary">
                      {change.actor ?? '-'} · {change.reason ?? '-'}
                    </div>
                  </div>
                  <div className="text-left sm:text-right">
                    <div className="font-mono text-xs text-text-secondary">
                      {formatMoney(change.previousDailyBudget, currency)}
                      {' -> '}
                      {formatMoney(change.newDailyBudget, currency)}
                    </div>
                    {delta.deltaDailyBudget != null && (
                      <div className="mt-1 font-mono text-[11px] text-text-tertiary">
                        {`${formatSignedMoney(delta.deltaDailyBudget, currency)} · ${formatSignedPercent(delta.deltaPercent)}`}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="border border-dashed border-border-light py-6 text-center text-sm text-text-secondary">
              {localize('com_ui_project_meta_ads_no_history')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
