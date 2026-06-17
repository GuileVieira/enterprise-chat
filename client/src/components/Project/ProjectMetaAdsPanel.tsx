import { Fragment, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowsIn, ArrowsOut } from '@phosphor-icons/react';
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
  ProjectMetaAdsCampaignDelta,
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
  scope: 'global' | 'group';
  name: string;
  entityLevel: MetaAdsRuleGroup['entityLevel'];
  entityIds: string[];
  rules: Required<MetaAdsRules>;
  creativeRules: Required<MetaAdsCreativeRules>;
};
type BudgetConfirmation = ProjectMetaAdsManualBudgetPayload & {
  currentBudget?: number;
};
type ScheduleIntervalMinutes = NonNullable<MetaAdsSettings['scheduleIntervalMinutes']>;
type SelectedAdPreview = ProjectMetaAdsAdSummary | null;
type RequestError = {
  message?: unknown;
  response?: {
    data?: {
      message?: unknown;
    };
  };
};
type SettingsDrawer = 'account' | 'automation' | null;

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
  maxIncreasePct: 25,
  maxDecreasePct: 25,
  minDailyBudget: 20,
  maxDailyBudget: 500,
  cooldownHours: 24,
  minSpend: 10,
};
const defaultCreativeRules: Required<MetaAdsCreativeRules> = {
  maxFrequency: 5,
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

function formatIntegerMetric(value?: number | null) {
  return value == null || Number.isNaN(value)
    ? '-'
    : new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value);
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

function buildChartPath(points: Array<{ x: number; y: number }>) {
  return points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(' ');
}

function hasMeaningfulDelta(delta: ProjectMetaAdsCampaignDelta) {
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

function cleanDashboardName(value: string | undefined, fallback: string) {
  const cleanedValue = (value ?? '').replace(/^[^\w[]+\s*/u, '').trim();
  return cleanedValue || value || fallback;
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

function getAdThumbnailUrl(ad: ProjectMetaAdsAdSummary) {
  return ad.thumbnailUrl || ad.imageUrl;
}

function getAdPreviewUrl(ad: ProjectMetaAdsAdSummary) {
  return ad.imageUrl || ad.thumbnailUrl;
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
  const [settingsDraft, setSettingsDraft] = useState<MetaAdsSettingsState | null>(null);
  const [settingsDraftToken, setSettingsDraftToken] = useState('');
  const [showSettingsDraftToken, setShowSettingsDraftToken] = useState(false);
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
  const [settingsDrawer, setSettingsDrawer] = useState<SettingsDrawer>(null);
  const [metricsFullscreen, setMetricsFullscreen] = useState(false);
  const [selectedAdPreview, setSelectedAdPreview] = useState<SelectedAdPreview>(null);
  const [collapsedAdSetAdsIds, setCollapsedAdSetAdsIds] = useState<string[]>([]);
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
    setSettingsDrawer(null);
    setSettingsDraft(null);
    setSettingsDraftToken('');
    setShowSettingsDraftToken(false);
  }, [project]);

  useEffect(() => {
    if (!metricsFullscreen) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMetricsFullscreen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [metricsFullscreen]);

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
  const meaningfulDeltas = campaignDeltas.filter(hasMeaningfulDelta);
  const chartWidth = 480;
  const chartHeight = 160;
  const chartPadding = 18;
  const chartBottom = chartHeight - chartPadding;
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
        Number(delta.cpaDelta ?? 0) > 0 ||
        Number(delta.frequencyDelta ?? 0) > 0 ||
        Number(delta.latestChange?.deltaDailyBudget ?? 0) !== 0,
    )
    .slice(0, 4);
  const hasCompactEvolutionState =
    trendPoints.length > 0 &&
    !canRenderSpendChart &&
    bestEvolution.length === 0 &&
    evolutionAlerts.length === 0;
  const hasEvolutionSection =
    canRenderSpendChart ||
    bestEvolution.length > 0 ||
    evolutionAlerts.length > 0 ||
    changesByDay.length > 0;
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
  const canCreateRuleGroup = canEdit;
  const getEntityRuleLabel = (entityLevel: MetaAdsRuleGroup['entityLevel'], entityId: string) =>
    settings.ruleGroups?.find(
      (group) => group.entityLevel === entityLevel && group.entityIds?.includes(entityId),
    )?.name ?? '-';
  const getCampaignName = (campaignId: string) =>
    campaigns.find((campaign) => campaign.campaignId === campaignId)?.campaignName ?? campaignId;
  const getAdSetName = (adSetId: string) =>
    campaigns.flatMap((campaign) => campaign.adSets).find((adSet) => adSet.entityId === adSetId)
      ?.entityName ?? adSetId;
  const selectedRuleGroupLabels =
    selectedCampaignIds.length > 0
      ? selectedCampaignIds.map(getCampaignName)
      : selectedAdSetIds.map(getAdSetName);
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

  const onUseTenantToken = () => {
    setSettingsDraftToken('');
    setSettingsDraft((current) =>
      current
        ? {
            ...current,
            tokenSecretName: '',
            credentialMode: 'tenant_default',
          }
        : current,
    );
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
    if (ruleGroupDraft.scope === 'global') {
      const nextSettings = {
        ...settings,
        rules: ruleGroupDraft.rules,
        creativeRules: ruleGroupDraft.creativeRules,
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
  };

  const closeSettingsDrawer = () => {
    setSettingsDrawer(null);
    setSettingsDraft(null);
    setSettingsDraftToken('');
    setShowSettingsDraftToken(false);
  };

  const onSaveSettingsDrawer = () => {
    if (!settingsDraft) {
      return;
    }
    saveSettings(settingsDraft, settingsDraftToken, closeSettingsDrawer);
  };

  const renderAdMetric = (labelKey: TranslationKeys, value: string) => (
    <div className="border border-border-light bg-surface-primary p-3">
      <div className="text-[11px] font-semibold uppercase text-text-tertiary">
        {localize(labelKey)}
      </div>
      <div className="mt-1 font-mono text-sm text-text-primary">{value}</div>
    </div>
  );

  const renderAdRow = (ad: ProjectMetaAdsAdSummary) => {
    const mediaUrl = getAdThumbnailUrl(ad);
    return (
      <tr
        key={ad.adId}
        data-testid={`meta-ads-ad-card-${ad.adId}`}
        onClick={() => setSelectedAdPreview(ad)}
        className="group cursor-pointer border-b border-border-light bg-surface-primary transition duration-200 hover:bg-surface-secondary"
      >
        <td className="px-2 py-2 pl-10 align-middle" />
        <td className="px-2 py-2 align-middle">
          <span aria-hidden="true" className="block h-7 w-7" />
        </td>
        <td className="px-2 py-2 text-text-secondary">
          {localize('com_ui_project_meta_ads_level_ad')}
        </td>
        <td className="px-2 py-2" title={ad.adName ?? ad.title ?? ad.adId}>
          <div className="flex min-w-0 items-center gap-2">
            <div className="h-9 w-16 shrink-0 overflow-hidden border border-border-light bg-surface-secondary">
              {mediaUrl ? (
                <img
                  src={mediaUrl}
                  alt={ad.adName ?? ad.title ?? ad.adId}
                  className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center px-1 text-center text-[10px] text-text-tertiary">
                  {localize('com_ui_project_meta_ads_no_creative_media')}
                </div>
              )}
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-text-primary">
                {ad.adName ?? ad.title ?? ad.adId}
              </div>
              <div className="truncate text-xs text-text-secondary">
                {ad.title ?? ad.body ?? '-'}
              </div>
            </div>
          </div>
        </td>
        <td className="px-2 py-2 text-right font-mono text-text-tertiary">-</td>
        <td className="px-2 py-2 text-text-tertiary">-</td>
        <td className="px-2 py-2 text-text-tertiary">-</td>
        <td className="px-2 py-2 text-right font-mono text-text-secondary">
          {formatMetric(ad.frequency)}
        </td>
        <td className="px-2 py-2 text-right font-mono text-text-secondary">
          {formatMetric(ad.resultCount)}
        </td>
        <td className="px-2 py-2 text-right font-mono text-text-secondary">
          {formatMoney(ad.cpa, ad.currency ?? currency)}
        </td>
        <td className="px-2 py-2 text-right font-mono text-text-secondary">
          {formatMoney(ad.spend, ad.currency ?? currency)}
        </td>
        <td className="px-2 py-2 text-right font-mono text-text-secondary">
          {formatMetric(ad.ctr)}
        </td>
        <td className="px-2 py-2 text-right font-mono text-text-secondary">
          {formatMetric(ad.clicks)}
        </td>
        <td className="px-2 py-2 text-right font-mono text-text-tertiary">-</td>
        <td className="px-2 py-2 text-text-tertiary">-</td>
        <td className="px-2 py-2 text-text-tertiary">-</td>
        <td className="px-2 py-2" />
      </tr>
    );
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
              onClick={() => openSettingsDrawer('account')}
              className="h-8 border border-border-light px-3 text-xs font-medium text-text-primary"
            >
              {localize('com_ui_project_meta_ads_account_credentials')}
            </button>
            <button
              type="button"
              onClick={() => openSettingsDrawer('automation')}
              className="h-8 border border-border-light px-3 text-xs font-medium text-text-primary"
            >
              {localize('com_ui_project_meta_ads_automation')}
            </button>
            <button
              type="button"
              disabled={!canEdit}
              onClick={onOpenRuleGroupDraft}
              className="h-8 border border-border-light px-3 text-xs font-medium text-text-primary disabled:cursor-not-allowed disabled:opacity-60"
            >
              {localize('com_ui_project_meta_ads_rules')}
            </button>
            {!settingsDrawer && (
              <button
                type="button"
                disabled={!canEdit || updateSettings.isLoading}
                onClick={onSave}
                className="h-8 bg-text-primary px-3 text-xs font-medium text-surface-primary disabled:cursor-not-allowed disabled:opacity-60"
              >
                {localize('com_ui_save')}
              </button>
            )}
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

        {settingsDrawer && settingsDraft && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="meta-ads-settings-drawer-title"
            className="fixed inset-0 z-50 flex justify-end bg-black/30"
          >
            <div className="flex h-full w-full max-w-lg flex-col border-l border-border-light bg-surface-primary shadow-xl">
              <div className="border-b border-border-light p-4">
                <h4
                  id="meta-ads-settings-drawer-title"
                  className="text-base font-semibold text-text-primary"
                >
                  {localize(
                    settingsDrawer === 'account'
                      ? 'com_ui_project_meta_ads_account_credentials'
                      : 'com_ui_project_meta_ads_automation',
                  )}
                </h4>
                <div className="mt-2 text-xs text-text-tertiary">
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
                      <label className="flex flex-col gap-1 text-xs text-text-secondary">
                        {localize('com_ui_project_meta_ads_enabled')}
                        <select
                          disabled={!canEdit}
                          value={settingsDraft.enabled ? 'true' : 'false'}
                          onChange={(event) =>
                            setSettingsDraft((current) =>
                              current
                                ? { ...current, enabled: event.target.value === 'true' }
                                : current,
                            )
                          }
                          className="h-10 border border-border-light bg-surface-secondary px-3 text-sm text-text-primary"
                        >
                          <option value="false">
                            {localize('com_ui_project_meta_ads_disabled')}
                          </option>
                          <option value="true">
                            {localize('com_ui_project_meta_ads_enabled_state')}
                          </option>
                        </select>
                      </label>
                      <label className="flex flex-col gap-1 text-xs text-text-secondary">
                        {localize('com_ui_project_meta_ads_account')}
                        <input
                          disabled={!canEdit}
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
                          className="h-10 border border-border-light bg-surface-secondary px-3 text-sm text-text-primary"
                        />
                      </label>
                    </div>
                    <label className="flex flex-col gap-1 text-xs text-text-secondary">
                      {localize('com_ui_project_meta_ads_graph_version')}
                      <select
                        disabled={!canEdit}
                        value={settingsDraft.graphVersion ?? ''}
                        onChange={(event) =>
                          setSettingsDraft((current) =>
                            current ? { ...current, graphVersion: event.target.value } : current,
                          )
                        }
                        autoComplete="off"
                        className="h-10 border border-border-light bg-surface-secondary px-3 text-sm text-text-primary"
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
                    <div className="flex flex-col gap-2 text-xs text-text-secondary">
                      <span>{localize('com_ui_project_meta_ads_project_token')}</span>
                      <div className="flex h-10 overflow-hidden border border-border-light bg-surface-secondary">
                        <input
                          disabled={!canEdit}
                          type={showSettingsDraftToken ? 'text' : 'password'}
                          name="meta_ads_project_token_new"
                          autoComplete="new-password"
                          value={settingsDraftToken}
                          onChange={(event) => setSettingsDraftToken(event.target.value)}
                          placeholder={
                            hasMaskedToken
                              ? localize('com_ui_project_meta_ads_token_keep_existing')
                              : localize('com_ui_project_meta_ads_token_placeholder')
                          }
                          className="min-w-0 flex-1 bg-transparent px-3 text-sm text-text-primary outline-none disabled:cursor-not-allowed"
                        />
                        {settingsDraftToken.length > 0 && (
                          <button
                            type="button"
                            disabled={!canEdit}
                            onClick={() => setShowSettingsDraftToken((current) => !current)}
                            className="shrink-0 border-l border-border-light px-3 text-xs font-medium text-text-secondary disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {localize(
                              showSettingsDraftToken
                                ? 'com_ui_hide_password'
                                : 'com_ui_show_password',
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
                      {settingsDraft.tokenSecretName && (
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
                    <div className="border border-border-light bg-surface-secondary p-3 text-sm text-text-secondary">
                      <div className="font-medium text-text-primary">
                        {localize(tokenStatusKey)}
                      </div>
                      <div className="mt-2 text-xs leading-5 text-text-tertiary">
                        {localize('com_ui_project_meta_ads_graph_version_hint')}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="grid gap-3">
                    <label className="flex flex-col gap-1 text-xs text-text-secondary">
                      {localize('com_ui_project_meta_ads_mode')}
                      <select
                        disabled={!canEdit}
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
                        className="h-10 border border-border-light bg-surface-secondary px-3 text-sm text-text-primary"
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
                        className="h-10 border border-border-light bg-surface-secondary px-3 text-sm text-text-primary"
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
              <div className="flex justify-end gap-2 border-t border-border-light p-4">
                <button
                  type="button"
                  onClick={closeSettingsDrawer}
                  className="h-8 border border-border-light px-3 text-xs font-medium text-text-secondary"
                >
                  {localize('com_ui_cancel')}
                </button>
                <button
                  type="button"
                  disabled={!canEdit || updateSettings.isLoading}
                  onClick={onSaveSettingsDrawer}
                  className="h-8 bg-text-primary px-3 text-xs font-medium text-surface-primary disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {localize('com_ui_save')}
                </button>
              </div>
            </div>
          </div>
        )}

        <div
          className={
            metricsFullscreen
              ? 'fixed inset-3 z-50 flex flex-col overflow-hidden border border-border-light bg-surface-primary shadow-2xl'
              : ''
          }
          data-testid="meta-ads-metrics-workspace"
        >
          <div className="flex flex-col gap-3 border-b border-border-light bg-surface-primary p-3">
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
                  </select>
                </label>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="h-8 border border-border-light px-3 py-2 font-mono text-xs text-text-secondary">
                  {localize('com_ui_project_meta_ads_selection_count', {
                    0: String(selectedCount),
                  })}
                </span>
                <button
                  type="button"
                  disabled={selectedCount === 0}
                  onClick={() => setSelectedEntityIds([])}
                  className="h-8 border border-border-light px-3 text-xs font-medium text-text-secondary disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {localize('com_ui_project_meta_ads_clear_selection')}
                </button>
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
                <button
                  type="button"
                  onClick={() => setMetricsFullscreen((current) => !current)}
                  aria-label={localize(
                    metricsFullscreen
                      ? 'com_ui_project_meta_ads_exit_fullscreen'
                      : 'com_ui_project_meta_ads_enter_fullscreen',
                  )}
                  className="inline-flex h-8 items-center gap-2 border border-border-light px-3 text-xs font-medium text-text-primary"
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
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="meta-ads-rule-group-dialog-title"
              className="fixed inset-0 z-50 flex justify-end bg-black/30"
            >
              <div className="flex h-full w-full max-w-lg flex-col border-l border-border-light bg-surface-primary shadow-xl">
                <div className="border-b border-border-light p-4">
                  <h4
                    id="meta-ads-rule-group-dialog-title"
                    className="text-base font-semibold text-text-primary"
                  >
                    {localize(
                      ruleGroupDraft.scope === 'global'
                        ? 'com_ui_project_meta_ads_global_rules'
                        : ruleGroupDraft.id
                          ? 'com_ui_project_meta_ads_edit_rule_group'
                          : 'com_ui_project_meta_ads_create_rule_group',
                    )}
                  </h4>
                  {ruleGroupDraft.scope === 'global' ? (
                    <div className="mt-2 text-xs text-text-tertiary">
                      {localize('com_ui_project_meta_ads_global_rules_hint')}
                    </div>
                  ) : (
                    <div className="mt-2 space-y-2">
                      <div className="text-xs uppercase text-text-tertiary">
                        {ruleGroupDraft.entityLevel === 'campaign'
                          ? localize('com_ui_project_meta_ads_campaign')
                          : localize('com_ui_project_meta_ads_select_ad_set')}
                        {' · '}
                        {ruleGroupDraft.entityIds.length}{' '}
                        {localize('com_ui_project_meta_ads_rule_group_selected')}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {selectedRuleGroupLabels.slice(0, 8).map((label) => (
                          <span
                            key={label}
                            className="border border-border-light bg-surface-secondary px-2 py-1 text-xs text-text-secondary"
                          >
                            {label}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex-1 space-y-4 overflow-y-auto p-4">
                  {ruleGroupDraft.scope === 'group' && (
                    <label className="flex flex-col gap-1 text-xs text-text-secondary">
                      {localize('com_ui_project_meta_ads_rule_group_name')}
                      <input
                        value={ruleGroupDraft.name}
                        onChange={(event) =>
                          setRuleGroupDraft((current) =>
                            current ? { ...current, name: event.target.value } : current,
                          )
                        }
                        className="h-10 border border-border-light bg-surface-secondary px-3 text-sm text-text-primary"
                      />
                    </label>
                  )}
                  <div className="grid gap-3 sm:grid-cols-2">
                    {numberFields.map((field) => (
                      <label
                        key={field.key}
                        className="flex flex-col gap-1 text-xs text-text-secondary"
                      >
                        {localize(field.labelKey)}
                        <input
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
                          value={ruleGroupDraft.rules[field.key]}
                          onChange={(event) => onRuleGroupRuleChange(field.key, event.target.value)}
                          className="h-10 border border-border-light bg-surface-secondary px-3 text-sm text-text-primary"
                        />
                      </label>
                    ))}
                    <label className="flex flex-col gap-1 text-xs text-text-secondary">
                      {localize('com_ui_project_meta_ads_max_frequency_alert')}
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={ruleGroupDraft.creativeRules.maxFrequency}
                        onChange={(event) =>
                          onRuleGroupCreativeRuleChange('maxFrequency', event.target.value)
                        }
                        className="h-10 border border-border-light bg-surface-secondary px-3 text-sm text-text-primary"
                      />
                    </label>
                  </div>
                </div>
                <div className="flex justify-end gap-2 border-t border-border-light p-4">
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

          <div
            className={
              metricsFullscreen
                ? 'min-h-0 max-w-full flex-1 overflow-auto'
                : 'max-w-full overflow-x-auto'
            }
          >
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
                  <th className="w-40 px-2 py-2">
                    {localize('com_ui_project_meta_ads_objective')}
                  </th>
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
                        className="border-b border-border-light"
                      >
                        <td className="px-2 py-2 align-middle">
                          <input
                            type="checkbox"
                            checked={selected}
                            aria-label={localize('com_ui_project_meta_ads_select_campaign')}
                            onChange={() => onToggleCampaign(campaign)}
                            className="h-4 w-4 border-border-light bg-surface-primary text-text-primary"
                          />
                        </td>
                        <td className="px-2 py-2 align-middle">
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
                        <td className="px-2 py-2 text-text-secondary">
                          {localize('com_ui_project_meta_ads_level_campaign')}
                        </td>
                        <td
                          className="truncate px-2 py-2 font-medium text-text-primary"
                          title={campaign.campaignName ?? campaign.campaignId}
                        >
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
                            <div className="truncate text-text-tertiary">
                              {recommendation.reason}
                            </div>
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
                          const adsetSelected = selectedEntityIds.includes(
                            `adset:${adset.entityId}`,
                          );
                          const adsetRecommendation = getEntityRecommendation(adset.entityId);
                          const adsetAds = adset.ads ?? [];
                          const adsCollapsed = collapsedAdSetAdsIds.includes(adset.entityId);
                          return (
                            <Fragment key={adset.entityId}>
                              <tr className="bg-surface-secondary/40 border-b border-border-light">
                                <td className="px-2 py-2 pl-6 align-middle">
                                  <input
                                    type="checkbox"
                                    checked={adsetSelected}
                                    aria-label={localize('com_ui_project_meta_ads_select_ad_set')}
                                    onChange={() => onToggleAdSet(adset.entityId)}
                                    className="h-4 w-4 border-border-light bg-surface-primary text-text-primary"
                                  />
                                </td>
                                <td className="px-2 py-2 align-middle">
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
                                <td className="px-2 py-2 text-text-secondary">
                                  {localize('com_ui_project_meta_ads_level_ad_set')}
                                </td>
                                <td
                                  className="truncate px-2 py-2 text-text-primary"
                                  title={adset.entityName ?? adset.entityId}
                                >
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
                              {!adsCollapsed && adsetAds.map((ad) => renderAdRow(ad))}
                            </Fragment>
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

        {(settings.ruleGroups ?? []).length > 0 && (
          <div className="border-t border-border-light bg-surface-secondary p-3">
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

        {hasCompactEvolutionState && (
          <div className="border-t border-border-light bg-surface-secondary px-3 py-2 text-sm text-text-secondary">
            {localize('com_ui_project_meta_ads_insufficient_evolution')}
          </div>
        )}

        {hasEvolutionSection && (
          <div className="border-t border-border-light p-3">
            <h4 className="mb-3 text-xs font-semibold uppercase text-text-tertiary">
              {localize('com_ui_project_meta_ads_evolution_analysis')}
            </h4>
            <div
              data-testid="meta-ads-evolution-dashboard"
              className="grid gap-3 xl:grid-cols-[1.4fr_1fr]"
            >
              <div className="border border-border-light bg-surface-primary p-3">
                <div className="flex items-center justify-between gap-3">
                  <h5 className="text-xs font-semibold uppercase text-text-tertiary">
                    {localize('com_ui_project_meta_ads_evolution')}
                  </h5>
                  <span className="font-mono text-[11px] text-text-tertiary">
                    {trendPoints.length} {localize('com_ui_project_meta_ads_trend_points')}
                  </span>
                </div>
                <div className="mt-3 h-44 border-b border-border-light">
                  {canRenderSpendChart ? (
                    <svg
                      data-testid="meta-ads-evolution-chart"
                      viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                      role="img"
                      aria-label={localize('com_ui_project_meta_ads_evolution')}
                      className="h-full w-full text-text-primary"
                      preserveAspectRatio="none"
                    >
                      <path d={spendChartAreaPath} fill="currentColor" opacity="0.08" />
                      <path
                        d={spendChartPath}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        vectorEffect="non-scaling-stroke"
                      />
                      {spendChartPoints.map((point, index) => (
                        <circle
                          key={dailySpendTrend[index].date}
                          cx={point.x}
                          cy={point.y}
                          r="3"
                          fill="currentColor"
                        >
                          <title>
                            {`${formatTrendDate(dailySpendTrend[index].date)} · ${formatMoney(
                              dailySpendTrend[index].spend,
                              currency,
                            )}`}
                          </title>
                        </circle>
                      ))}
                    </svg>
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-sm text-text-secondary">
                      {localize('com_ui_project_meta_ads_insufficient_evolution')}
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
                  <h5 className="text-xs font-semibold uppercase text-text-tertiary">
                    {localize('com_ui_project_meta_ads_best_evolution')}
                  </h5>
                  <div className="mt-3 divide-y divide-border-light">
                    {bestEvolution.length > 0 ? (
                      bestEvolution.map((delta) => (
                        <div key={delta.campaignId} className="py-2 first:pt-0 last:pb-0">
                          <div className="truncate text-sm font-medium text-text-primary">
                            {cleanDashboardName(delta.campaignName, delta.campaignId)}
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
                  <h5 className="text-xs font-semibold uppercase text-text-tertiary">
                    {localize('com_ui_project_meta_ads_budget_changes')}
                  </h5>
                  <div className="mt-3 divide-y divide-border-light">
                    {evolutionAlerts.length > 0 ? (
                      evolutionAlerts.map((delta) => (
                        <div key={delta.campaignId} className="py-2 first:pt-0 last:pb-0">
                          <div className="truncate text-sm font-medium text-text-primary">
                            {cleanDashboardName(
                              delta.latestChange?.entityName ?? delta.campaignName,
                              delta.campaignId,
                            )}
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
          </div>
        )}
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

      <OGDialog
        open={Boolean(selectedAdPreview)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedAdPreview(null);
          }
        }}
      >
        {selectedAdPreview && (
          <OGDialogContent className="max-w-4xl overflow-hidden p-0">
            <OGDialogHeader className="border-b border-border-light px-5 py-4 text-left">
              <div className="text-xs font-semibold uppercase text-text-tertiary">
                {localize('com_ui_project_meta_ads_ad_preview')}
              </div>
              <OGDialogTitle className="truncate text-base font-semibold text-text-primary">
                {selectedAdPreview.adName ?? selectedAdPreview.title ?? selectedAdPreview.adId}
              </OGDialogTitle>
            </OGDialogHeader>
            <div className="grid gap-0 md:grid-cols-[1.15fr_1fr]">
              <div className="bg-surface-secondary p-5">
                <div className="overflow-hidden border border-border-light bg-surface-primary">
                  {getAdPreviewUrl(selectedAdPreview) ? (
                    <img
                      src={getAdPreviewUrl(selectedAdPreview)}
                      alt={
                        selectedAdPreview.adName ??
                        selectedAdPreview.title ??
                        selectedAdPreview.adId
                      }
                      className="aspect-video w-full object-cover"
                    />
                  ) : (
                    <div className="flex aspect-video w-full items-center justify-center px-6 text-center text-sm text-text-secondary">
                      {localize('com_ui_project_meta_ads_no_creative_media')}
                    </div>
                  )}
                </div>
                <div className="mt-4 space-y-2 border border-border-light bg-surface-primary p-4">
                  <h4 className="text-lg font-semibold text-text-primary">
                    {selectedAdPreview.title ??
                      selectedAdPreview.adName ??
                      localize('com_ui_project_meta_ads_ad_preview')}
                  </h4>
                  {selectedAdPreview.body && (
                    <p className="text-sm leading-6 text-text-secondary">
                      {selectedAdPreview.body}
                    </p>
                  )}
                  {selectedAdPreview.description && (
                    <p className="text-xs leading-5 text-text-tertiary">
                      {selectedAdPreview.description}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2 text-xs text-text-secondary">
                    {selectedAdPreview.callToActionType && (
                      <span className="border border-border-light px-2 py-1 font-medium text-text-primary">
                        {selectedAdPreview.callToActionType}
                      </span>
                    )}
                    {selectedAdPreview.linkUrl && (
                      <span className="min-w-0 truncate border border-border-light px-2 py-1">
                        {selectedAdPreview.linkUrl}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="p-5">
                <h4 className="text-xs font-semibold uppercase text-text-tertiary">
                  {localize('com_ui_project_meta_ads_ad_metrics')}
                </h4>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {renderAdMetric(
                    'com_ui_project_meta_ads_spend',
                    formatMoney(selectedAdPreview.spend, selectedAdPreview.currency ?? currency),
                  )}
                  {renderAdMetric(
                    'com_ui_project_meta_ads_cost_result',
                    formatMoney(selectedAdPreview.cpa, selectedAdPreview.currency ?? currency),
                  )}
                  {renderAdMetric(
                    'com_ui_project_meta_ads_results',
                    formatMetric(selectedAdPreview.resultCount),
                  )}
                  {renderAdMetric(
                    'com_ui_project_meta_ads_impressions',
                    formatIntegerMetric(selectedAdPreview.impressions),
                  )}
                  {renderAdMetric(
                    'com_ui_project_meta_ads_clicks',
                    formatIntegerMetric(selectedAdPreview.clicks),
                  )}
                  {renderAdMetric(
                    'com_ui_project_meta_ads_frequency',
                    formatMetric(selectedAdPreview.frequency),
                  )}
                  {renderAdMetric(
                    'com_ui_project_meta_ads_ctr',
                    `${formatMetric(selectedAdPreview.ctr)}%`,
                  )}
                  {renderAdMetric(
                    'com_ui_project_meta_ads_video_p75',
                    formatMetric(selectedAdPreview.videoP75Watched),
                  )}
                </div>
              </div>
            </div>
          </OGDialogContent>
        )}
      </OGDialog>
    </div>
  );
}
