import { useEffect, useState } from 'react';
import type { TProject } from 'librechat-data-provider';
import type {
  ProjectMetaAdsBudgetChange,
  ProjectMetaAdsManualBudgetResponse,
} from 'librechat-data-provider';
import type {
  useProjectMetaAdsQuery,
  useUpdateProjectMetaAdsMutation,
  useUpdateProjectMetaAdsBudgetMutation,
  useUpdateProjectMetaAdsTenantTokenMutation,
} from '~/data-provider';
import type { TranslationKeys } from '~/hooks';
import { logger } from '~/utils';
import { normalizeSettings } from '../settings';
import { numberFields, optionalNumberFields } from '../rules';
import type {
  Localize,
  RequestError,
  SettingsDrawer,
  ManualBudgetDraft,
  MetaAdsDraftStatus,
  MetaAdsDraftDetail,
  MetaAdsDraftSectionKey,
  MetaAdsSettingsState,
  MetaAdsDraftSummaryItem,
} from '../types';

type ToastStatus = 'success' | 'error' | 'warning' | 'info';

type ShowToast = (toast: { message: string; status: ToastStatus }) => void;

type UseMetaAdsSettingsParams = {
  project: TProject;
  statusQuery: ReturnType<typeof useProjectMetaAdsQuery>;
  updateSettings: ReturnType<typeof useUpdateProjectMetaAdsMutation>;
  updateBudget: ReturnType<typeof useUpdateProjectMetaAdsBudgetMutation>;
  updateTenantToken: ReturnType<typeof useUpdateProjectMetaAdsTenantTokenMutation>;
  onManualBudgetChange?: (change: ProjectMetaAdsBudgetChange) => void;
  localize: Localize;
  showToast: ShowToast;
};

function getSettingsDraftStorageKey(projectId: string) {
  return `orqest:metaAds:${projectId}:settingsDraft`;
}

function getManualBudgetDraftStorageKey(projectId: string) {
  return `orqest:metaAds:${projectId}:manualBudgetDrafts`;
}

function readStoredSettingsDraft(projectId: string): MetaAdsSettingsState | null {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    const storedValue = window.localStorage.getItem(getSettingsDraftStorageKey(projectId));
    return storedValue ? (JSON.parse(storedValue) as MetaAdsSettingsState) : null;
  } catch {
    return null;
  }
}

function writeStoredSettingsDraft(projectId: string, settings: MetaAdsSettingsState) {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(getSettingsDraftStorageKey(projectId), JSON.stringify(settings));
}

function clearStoredSettingsDraft(projectId: string) {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.removeItem(getSettingsDraftStorageKey(projectId));
}

function readStoredManualBudgetDrafts(projectId: string): ManualBudgetDraft[] {
  if (typeof window === 'undefined') {
    return [];
  }
  try {
    const storedValue = window.localStorage.getItem(getManualBudgetDraftStorageKey(projectId));
    const parsedValue = storedValue ? JSON.parse(storedValue) : [];
    return Array.isArray(parsedValue) ? (parsedValue as ManualBudgetDraft[]) : [];
  } catch {
    return [];
  }
}

function writeStoredManualBudgetDrafts(projectId: string, drafts: ManualBudgetDraft[]) {
  if (typeof window === 'undefined') {
    return;
  }
  if (drafts.length === 0) {
    window.localStorage.removeItem(getManualBudgetDraftStorageKey(projectId));
    return;
  }
  window.localStorage.setItem(getManualBudgetDraftStorageKey(projectId), JSON.stringify(drafts));
}

function hasSettingsChange(
  savedSettings: MetaAdsSettingsState,
  draftSettings: MetaAdsSettingsState,
  keys: Array<keyof MetaAdsSettingsState>,
) {
  return keys.some(
    (key) => JSON.stringify(savedSettings[key]) !== JSON.stringify(draftSettings[key]),
  );
}

function formatDraftValue(value: unknown, localize: Localize) {
  if (value === undefined || value === null || value === '') {
    return '-';
  }
  if (typeof value === 'boolean') {
    return localize(value ? 'com_ui_yes' : 'com_ui_no');
  }
  if (Array.isArray(value)) {
    return value.length > 0 ? String(value.length) : '-';
  }
  return String(value);
}

function addDraftDetail(
  details: MetaAdsDraftDetail[],
  localize: Localize,
  key: string,
  labelKey: TranslationKeys,
  savedValue: unknown,
  draftValue: unknown,
) {
  if (JSON.stringify(savedValue) === JSON.stringify(draftValue)) {
    return;
  }
  details.push({
    key,
    label: localize(labelKey),
    savedValue: formatDraftValue(savedValue, localize),
    draftValue: formatDraftValue(draftValue, localize),
  });
}

function getNamedItems(value: Array<{ id?: string; name?: string; overrideKey?: string }>) {
  return value.map((item, index) => ({
    id: item.id ?? item.overrideKey ?? item.name ?? `item-${index}`,
    label: item.name ?? item.overrideKey ?? item.id ?? `#${index + 1}`,
    raw: item,
  }));
}

function buildCollectionDetails({
  key,
  labelKey,
  savedItems,
  draftItems,
  localize,
}: {
  key: string;
  labelKey: TranslationKeys;
  savedItems: Array<{ id?: string; name?: string; overrideKey?: string }>;
  draftItems: Array<{ id?: string; name?: string; overrideKey?: string }>;
  localize: Localize;
}) {
  const details: MetaAdsDraftDetail[] = [];
  addDraftDetail(details, localize, `${key}-count`, labelKey, savedItems.length, draftItems.length);

  const savedNamedItems = getNamedItems(savedItems);
  const draftNamedItems = getNamedItems(draftItems);
  const savedById = new Map(savedNamedItems.map((item) => [item.id, item]));
  const draftById = new Map(draftNamedItems.map((item) => [item.id, item]));
  const created = draftNamedItems.filter((item) => !savedById.has(item.id));
  const removed = savedNamedItems.filter((item) => !draftById.has(item.id));
  const changed = draftNamedItems.filter((item) => {
    const savedItem = savedById.get(item.id);
    return savedItem && JSON.stringify(savedItem.raw) !== JSON.stringify(item.raw);
  });

  if (created.length > 0) {
    details.push({
      key: `${key}-created`,
      label: localize('com_ui_project_meta_ads_discard_created'),
      savedValue: '-',
      draftValue: created.map((item) => item.label).join(', '),
    });
  }
  if (removed.length > 0) {
    details.push({
      key: `${key}-removed`,
      label: localize('com_ui_project_meta_ads_discard_removed'),
      savedValue: removed.map((item) => item.label).join(', '),
      draftValue: '-',
    });
  }
  if (changed.length > 0) {
    details.push({
      key: `${key}-changed`,
      label: localize('com_ui_project_meta_ads_discard_changed'),
      savedValue: '-',
      draftValue: changed.map((item) => item.label).join(', '),
    });
  }

  return details;
}

function buildCredentialsDetails(
  savedSettings: MetaAdsSettingsState,
  draftSettings: MetaAdsSettingsState,
  localize: Localize,
) {
  const details: MetaAdsDraftDetail[] = [];
  addDraftDetail(
    details,
    localize,
    'enabled',
    'com_ui_project_meta_ads_enabled',
    savedSettings.enabled,
    draftSettings.enabled,
  );
  addDraftDetail(
    details,
    localize,
    'adAccountId',
    'com_ui_project_meta_ads_account',
    savedSettings.adAccountId,
    draftSettings.adAccountId,
  );
  addDraftDetail(
    details,
    localize,
    'tokenSecretName',
    'com_ui_project_meta_ads_project_token',
    savedSettings.tokenSecretName,
    draftSettings.tokenSecretName,
  );
  addDraftDetail(
    details,
    localize,
    'graphVersion',
    'com_ui_project_meta_ads_graph_version',
    savedSettings.graphVersion,
    draftSettings.graphVersion,
  );
  return details;
}

function buildAutomationDetails(
  savedSettings: MetaAdsSettingsState,
  draftSettings: MetaAdsSettingsState,
  localize: Localize,
) {
  const details: MetaAdsDraftDetail[] = [];
  addDraftDetail(
    details,
    localize,
    'automationMode',
    'com_ui_project_meta_ads_mode',
    savedSettings.automationMode,
    draftSettings.automationMode,
  );
  addDraftDetail(
    details,
    localize,
    'scheduleIntervalMinutes',
    'com_ui_project_meta_ads_schedule',
    savedSettings.scheduleIntervalMinutes,
    draftSettings.scheduleIntervalMinutes,
  );
  addDraftDetail(
    details,
    localize,
    'automationAnalysisPreset',
    'com_ui_project_meta_ads_rule_change_automationAnalysisPreset',
    savedSettings.automationAnalysisPreset,
    draftSettings.automationAnalysisPreset,
  );
  addDraftDetail(
    details,
    localize,
    'clientGoalResultType',
    'com_ui_project_meta_ads_result_type',
    savedSettings.clientGoal?.resultType,
    draftSettings.clientGoal?.resultType,
  );
  addDraftDetail(
    details,
    localize,
    'clientGoalMonthlyTarget',
    'com_ui_project_meta_ads_client_goal',
    savedSettings.clientGoal?.monthlyTarget,
    draftSettings.clientGoal?.monthlyTarget,
  );
  return details;
}

function buildGlobalRulesDetails(
  savedSettings: MetaAdsSettingsState,
  draftSettings: MetaAdsSettingsState,
  localize: Localize,
) {
  const details: MetaAdsDraftDetail[] = [];
  [...numberFields, ...optionalNumberFields].forEach((field) => {
    addDraftDetail(
      details,
      localize,
      `rules-${String(field.key)}`,
      field.labelKey,
      savedSettings.rules[field.key],
      draftSettings.rules[field.key],
    );
  });
  addDraftDetail(
    details,
    localize,
    'rules-targetResultType',
    'com_ui_project_meta_ads_target_result_type',
    savedSettings.rules.targetResultType,
    draftSettings.rules.targetResultType,
  );
  addDraftDetail(
    details,
    localize,
    'rules-primaryMetric',
    'com_ui_project_meta_ads_primary_metric',
    savedSettings.rules.primaryMetric,
    draftSettings.rules.primaryMetric,
  );
  addDraftDetail(
    details,
    localize,
    'creativeRules-maxFrequency',
    'com_ui_project_meta_ads_max_frequency_alert',
    savedSettings.creativeRules.maxFrequency,
    draftSettings.creativeRules.maxFrequency,
  );
  return details;
}

function buildMonthlyBudgetDetails(
  savedSettings: MetaAdsSettingsState,
  draftSettings: MetaAdsSettingsState,
  localize: Localize,
) {
  const details: MetaAdsDraftDetail[] = [];
  addDraftDetail(
    details,
    localize,
    'monthlyBudget-month',
    'com_ui_project_meta_ads_month',
    savedSettings.monthlyBudget?.month,
    draftSettings.monthlyBudget?.month,
  );
  addDraftDetail(
    details,
    localize,
    'monthlyBudget-baseAmount',
    'com_ui_project_meta_ads_monthly_base_amount',
    savedSettings.monthlyBudget?.baseAmount,
    draftSettings.monthlyBudget?.baseAmount,
  );
  addDraftDetail(
    details,
    localize,
    'monthlyBudget-additionalAmount',
    'com_ui_project_meta_ads_monthly_additional_amount',
    savedSettings.monthlyBudget?.additionalAmount,
    draftSettings.monthlyBudget?.additionalAmount,
  );
  addDraftDetail(
    details,
    localize,
    'monthlyBudget-allowedOverspendPct',
    'com_ui_project_meta_ads_monthly_allowed_overspend',
    savedSettings.monthlyBudget?.allowedOverspendPct,
    draftSettings.monthlyBudget?.allowedOverspendPct,
  );
  return details;
}

function buildManualBudgetDraftDetails(drafts: ManualBudgetDraft[]) {
  return drafts.map((draft) => ({
    key: getManualBudgetDraftKey(draft),
    label: draft.entityName ?? draft.entityId,
    savedValue: draft.currentBudget === undefined ? '-' : String(draft.currentBudget),
    draftValue: String(draft.dailyBudget),
  }));
}

function buildSettingsDraftSummary(
  savedSettings: MetaAdsSettingsState,
  draftSettings: MetaAdsSettingsState,
  localize: Localize,
) {
  const sections: MetaAdsDraftSummaryItem[] = [];
  if (
    hasSettingsChange(savedSettings, draftSettings, [
      'enabled',
      'adAccountId',
      'tokenSecretName',
      'graphVersion',
      'credentialMode',
    ])
  ) {
    sections.push({
      key: 'credentials',
      label: localize('com_ui_project_meta_ads_account_credentials'),
      details: buildCredentialsDetails(savedSettings, draftSettings, localize),
    });
  }
  if (
    hasSettingsChange(savedSettings, draftSettings, [
      'automationMode',
      'scheduleIntervalMinutes',
      'automationAnalysisPreset',
      'clientGoal',
    ])
  ) {
    sections.push({
      key: 'automation',
      label: localize('com_ui_project_meta_ads_automation'),
      details: buildAutomationDetails(savedSettings, draftSettings, localize),
    });
  }
  if (hasSettingsChange(savedSettings, draftSettings, ['rules', 'creativeRules'])) {
    sections.push({
      key: 'global-rules',
      label: localize('com_ui_project_meta_ads_global_rules'),
      details: buildGlobalRulesDetails(savedSettings, draftSettings, localize),
    });
  }
  if (hasSettingsChange(savedSettings, draftSettings, ['ruleGroups'])) {
    sections.push({
      key: 'rule-groups',
      label: localize('com_ui_project_meta_ads_rule_groups'),
      details: buildCollectionDetails({
        key: 'rule-groups',
        labelKey: 'com_ui_project_meta_ads_rule_groups',
        savedItems: savedSettings.ruleGroups ?? [],
        draftItems: draftSettings.ruleGroups ?? [],
        localize,
      }),
    });
  }
  if (hasSettingsChange(savedSettings, draftSettings, ['ruleOverrides'])) {
    sections.push({
      key: 'rule-overrides',
      label: localize('com_ui_project_meta_ads_rule_overrides'),
      details: buildCollectionDetails({
        key: 'rule-overrides',
        labelKey: 'com_ui_project_meta_ads_rule_overrides',
        savedItems: savedSettings.ruleOverrides ?? [],
        draftItems: draftSettings.ruleOverrides ?? [],
        localize,
      }),
    });
  }
  if (hasSettingsChange(savedSettings, draftSettings, ['monthlyBudget', 'monthlyBudgets'])) {
    sections.push({
      key: 'monthly-budget',
      label: localize('com_ui_project_meta_ads_monthly_budget'),
      details: buildMonthlyBudgetDetails(savedSettings, draftSettings, localize),
    });
  }
  return sections;
}

function restoreDraftSection(
  draftSettings: MetaAdsSettingsState,
  savedSettings: MetaAdsSettingsState,
  key: MetaAdsDraftSectionKey,
): MetaAdsSettingsState {
  switch (key) {
    case 'credentials':
      return {
        ...draftSettings,
        enabled: savedSettings.enabled,
        adAccountId: savedSettings.adAccountId,
        tokenSecretName: savedSettings.tokenSecretName,
        graphVersion: savedSettings.graphVersion,
        credentialMode: savedSettings.credentialMode,
      };
    case 'automation':
      return {
        ...draftSettings,
        automationMode: savedSettings.automationMode,
        scheduleIntervalMinutes: savedSettings.scheduleIntervalMinutes,
        automationAnalysisPreset: savedSettings.automationAnalysisPreset,
        clientGoal: savedSettings.clientGoal,
      };
    case 'global-rules':
      return {
        ...draftSettings,
        rules: savedSettings.rules,
        creativeRules: savedSettings.creativeRules,
      };
    case 'rule-groups':
      return { ...draftSettings, ruleGroups: savedSettings.ruleGroups };
    case 'rule-overrides':
      return { ...draftSettings, ruleOverrides: savedSettings.ruleOverrides };
    case 'monthly-budget':
      return {
        ...draftSettings,
        monthlyBudget: savedSettings.monthlyBudget,
        monthlyBudgets: savedSettings.monthlyBudgets,
      };
    case 'manual-budgets':
      return draftSettings;
  }
}

function getManualBudgetDraftKey(draft: ManualBudgetDraft) {
  return `${draft.entityLevel}:${draft.entityId}`;
}

export function useMetaAdsSettings({
  project,
  statusQuery,
  updateSettings,
  updateBudget,
  updateTenantToken,
  onManualBudgetChange,
  localize,
  showToast,
}: UseMetaAdsSettingsParams) {
  const [settings, setSettings] = useState(() => normalizeSettings(project));
  const [manualBudgetDrafts, setManualBudgetDrafts] = useState<ManualBudgetDraft[]>([]);
  const [hasUnsavedSettingsDraft, setHasUnsavedSettingsDraft] = useState(false);
  const [settingsDraft, setSettingsDraft] = useState<MetaAdsSettingsState | null>(null);
  const [settingsDraftToken, setSettingsDraftToken] = useState('');
  const [draftStatus, setDraftStatus] = useState<MetaAdsDraftStatus>('idle');
  const [discardDraftDialogOpen, setDiscardDraftDialogOpen] = useState(false);
  const [publishDraftDialogOpen, setPublishDraftDialogOpen] = useState(false);
  const [showSettingsDraftToken, setShowSettingsDraftToken] = useState(false);
  const [credentialsDialogOpen, setCredentialsDialogOpen] = useState(false);
  const [tenantAccessToken, setTenantAccessToken] = useState('');
  const [showTenantAccessToken, setShowTenantAccessToken] = useState(false);
  const [settingsDrawer, setSettingsDrawer] = useState<SettingsDrawer>(null);

  useEffect(() => {
    const storedDraft = readStoredSettingsDraft(project.projectId);
    const storedManualBudgetDrafts = readStoredManualBudgetDrafts(project.projectId);
    setSettings(storedDraft ?? normalizeSettings(project));
    setManualBudgetDrafts(storedManualBudgetDrafts);
    setHasUnsavedSettingsDraft(Boolean(storedDraft) || storedManualBudgetDrafts.length > 0);
    setDraftStatus(storedDraft || storedManualBudgetDrafts.length > 0 ? 'pending' : 'idle');
    setDiscardDraftDialogOpen(false);
    setPublishDraftDialogOpen(false);
    setSettingsDrawer(null);
    setSettingsDraft(null);
    setSettingsDraftToken('');
    setShowSettingsDraftToken(false);
    setCredentialsDialogOpen(false);
    setTenantAccessToken('');
    setShowTenantAccessToken(false);
  }, [project]);

  const setWorkingSettings = (nextSettings: MetaAdsSettingsState) => {
    setSettings(nextSettings);
    writeStoredSettingsDraft(project.projectId, nextSettings);
    setHasUnsavedSettingsDraft(true);
    setDraftStatus('pending');
  };

  const setManualBudgetDraft = (draft: ManualBudgetDraft) => {
    setManualBudgetDrafts((current) => {
      const nextDrafts = [
        draft,
        ...current.filter(
          (item) => getManualBudgetDraftKey(item) !== getManualBudgetDraftKey(draft),
        ),
      ];
      writeStoredManualBudgetDrafts(project.projectId, nextDrafts);
      return nextDrafts;
    });
    setHasUnsavedSettingsDraft(true);
    setDraftStatus('pending');
  };

  const closeCredentialsDialog = () => {
    setCredentialsDialogOpen(false);
    setSettingsDraftToken('');
    setTenantAccessToken('');
    setShowSettingsDraftToken(false);
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

  const saveSettings = (
    nextSettings: MetaAdsSettingsState,
    token: string,
    onSuccess?: () => void,
  ) => {
    const trimmedToken = token.trim();
    const previousSettings = settings;
    logger.debug('MetaAds', 'Saving project Meta Ads settings', {
      projectId: project.projectId,
      hasMetaAccessToken: trimmedToken.length > 0,
      tokenLength: trimmedToken.length,
      tokenSecretName: nextSettings.tokenSecretName,
    });
    setDraftStatus('publishing');
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
          clearStoredSettingsDraft(project.projectId);
          setHasUnsavedSettingsDraft(manualBudgetDrafts.length > 0);
          setDraftStatus(manualBudgetDrafts.length > 0 ? 'pending' : 'published');
          setDiscardDraftDialogOpen(false);
          setPublishDraftDialogOpen(false);
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
          setSettings(previousSettings);
          setDraftStatus('error');
          const details = (error as RequestError)?.response?.data?.details;
          const detailText = Array.isArray(details) ? ` (${details.join(', ')})` : '';
          const message =
            error instanceof Error
              ? `${error.message}${detailText}`
              : localize('com_ui_error_save_admin_settings');
          showToast({ message, status: 'error' });
          logger.error('MetaAds', 'Failed to save project Meta Ads settings', {
            projectId: project.projectId,
            error,
          });
        },
      },
    );
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

  const openCredentialsDialog = () => {
    setCredentialsDialogOpen(true);
    setSettingsDraftToken('');
    setTenantAccessToken('');
    setShowSettingsDraftToken(false);
    setShowTenantAccessToken(false);
  };

  const publishSettingsDrafts = () => {
    const savedSettings = normalizeSettings(project);
    const settingsSummary = buildSettingsDraftSummary(savedSettings, settings, localize);
    const settingsChanged = settingsSummary.length > 0;

    if (manualBudgetDrafts.length === 0) {
      saveSettings(settings, '');
      return;
    }

    setDraftStatus('publishing');

    const saveSettingsDraft = () =>
      new Promise<void>((resolve, reject) => {
        if (!settingsChanged) {
          resolve();
          return;
        }
        updateSettings.mutate(
          {
            projectId: project.projectId,
            metaAds: settings,
          },
          {
            onSuccess: () => resolve(),
            onError: reject,
          },
        );
      });

    const publishBudgetDraft = (draft: ManualBudgetDraft) =>
      new Promise<ProjectMetaAdsManualBudgetResponse>((resolve, reject) => {
        updateBudget.mutate(
          {
            projectId: project.projectId,
            payload: {
              entityLevel: draft.entityLevel,
              entityId: draft.entityId,
              entityName: draft.entityName,
              dailyBudget: draft.dailyBudget,
              reason: draft.reason,
            },
          },
          {
            onSuccess: resolve,
            onError: reject,
          },
        );
      });

    const publishDrafts = async () => {
      const publishedBudgetKeys = new Set<string>();
      let settingsPublished = false;
      try {
        await saveSettingsDraft();
        settingsPublished = settingsChanged;

        for (const draft of manualBudgetDrafts) {
          const response = await publishBudgetDraft(draft);
          publishedBudgetKeys.add(getManualBudgetDraftKey(draft));
          if (response.change) {
            onManualBudgetChange?.(response.change);
          }
        }

        clearStoredSettingsDraft(project.projectId);
        writeStoredManualBudgetDrafts(project.projectId, []);
        setManualBudgetDrafts([]);
        setHasUnsavedSettingsDraft(false);
        setDraftStatus('published');
        setDiscardDraftDialogOpen(false);
        setPublishDraftDialogOpen(false);
        statusQuery.refetch();
        showToast({ message: localize('com_ui_saved'), status: 'success' });
      } catch (error) {
        const remainingBudgetDrafts = manualBudgetDrafts.filter(
          (draft) => !publishedBudgetKeys.has(getManualBudgetDraftKey(draft)),
        );
        if (settingsPublished) {
          clearStoredSettingsDraft(project.projectId);
        }
        writeStoredManualBudgetDrafts(project.projectId, remainingBudgetDrafts);
        setManualBudgetDrafts(remainingBudgetDrafts);
        setHasUnsavedSettingsDraft(
          (!settingsPublished && settingsChanged) || remainingBudgetDrafts.length > 0,
        );
        setDraftStatus('error');
        const requestMessage = (error as RequestError)?.response?.data?.message;
        const message =
          typeof requestMessage === 'string'
            ? requestMessage
            : error instanceof Error
            ? error.message
            : localize('com_ui_project_meta_ads_budget_failed');
        showToast({ message, status: 'error' });
      }
    };

    void publishDrafts();
  };

  const onSave = () => {
    const pendingSummary = buildSettingsDraftSummary(normalizeSettings(project), settings, localize);
    if (pendingSummary.length === 0 && manualBudgetDrafts.length === 0) {
      publishSettingsDrafts();
      return;
    }
    setPublishDraftDialogOpen(true);
  };

  const onOpenPublishSettingsDraft = () => {
    setPublishDraftDialogOpen(true);
  };

  const onCancelPublishSettingsDraft = () => {
    setPublishDraftDialogOpen(false);
  };

  const onConfirmPublishSettingsDraft = () => {
    setPublishDraftDialogOpen(false);
    publishSettingsDrafts();
  };

  const onDiscardSettingsDraft = () => {
    if (!hasUnsavedSettingsDraft) {
      return;
    }
    setDiscardDraftDialogOpen(true);
  };

  const onCancelDiscardSettingsDraft = () => {
    setDiscardDraftDialogOpen(false);
  };

  const onConfirmDiscardSettingsDraft = (selectedKeys: MetaAdsDraftSectionKey[]) => {
    if (!hasUnsavedSettingsDraft) {
      setDiscardDraftDialogOpen(false);
      return;
    }
    const savedSettings = normalizeSettings(project);
    const settingsSummary = buildSettingsDraftSummary(savedSettings, settings, localize);
    const hasManualBudgetSelection = selectedKeys.includes('manual-budgets');
    const selectedKeySet = new Set(selectedKeys);

    if (settingsSummary.length === 0 && manualBudgetDrafts.length === 0) {
      clearStoredSettingsDraft(project.projectId);
      writeStoredManualBudgetDrafts(project.projectId, []);
      setSettings(savedSettings);
      setManualBudgetDrafts([]);
      setHasUnsavedSettingsDraft(false);
      setDraftStatus('idle');
      setDiscardDraftDialogOpen(false);
      closeSettingsDrawer();
      return;
    }

    if (
      !hasManualBudgetSelection &&
      !settingsSummary.some((item) => selectedKeySet.has(item.key))
    ) {
      return;
    }

    if (
      settingsSummary.every((item) => selectedKeySet.has(item.key)) &&
      (manualBudgetDrafts.length === 0 || hasManualBudgetSelection)
    ) {
      clearStoredSettingsDraft(project.projectId);
      writeStoredManualBudgetDrafts(project.projectId, []);
      setSettings(savedSettings);
      setManualBudgetDrafts([]);
      setHasUnsavedSettingsDraft(false);
      setDraftStatus('idle');
      setDiscardDraftDialogOpen(false);
      closeSettingsDrawer();
      return;
    }

    let nextSettings = settings;
    settingsSummary.forEach((item) => {
      if (selectedKeySet.has(item.key)) {
        nextSettings = restoreDraftSection(nextSettings, savedSettings, item.key);
      }
    });
    const nextManualBudgetDrafts = hasManualBudgetSelection ? [] : manualBudgetDrafts;
    writeStoredManualBudgetDrafts(project.projectId, nextManualBudgetDrafts);
    setManualBudgetDrafts(nextManualBudgetDrafts);

    const nextSummary = buildSettingsDraftSummary(savedSettings, nextSettings, localize);
    if (nextSummary.length === 0 && nextManualBudgetDrafts.length === 0) {
      clearStoredSettingsDraft(project.projectId);
      setHasUnsavedSettingsDraft(false);
      setDraftStatus('idle');
    } else {
      writeStoredSettingsDraft(project.projectId, nextSettings);
      setHasUnsavedSettingsDraft(true);
      setDraftStatus('pending');
    }
    setSettings(nextSettings);
    setDiscardDraftDialogOpen(false);
    closeSettingsDrawer();
  };

  const settingsDraftSummary = hasUnsavedSettingsDraft
    ? [
        ...buildSettingsDraftSummary(normalizeSettings(project), settings, localize),
        ...(manualBudgetDrafts.length > 0
          ? [
              {
                key: 'manual-budgets' as const,
                label: localize('com_ui_project_meta_ads_pending_manual_budgets', {
                  0: String(manualBudgetDrafts.length),
                }),
                details: buildManualBudgetDraftDetails(manualBudgetDrafts),
              },
            ]
          : []),
      ]
    : [];

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

  return {
    settings,
    manualBudgetDrafts,
    hasUnsavedSettingsDraft,
    draftStatus,
    settingsDraftSummary,
    discardDraftDialogOpen,
    publishDraftDialogOpen,
    settingsDraft,
    settingsDraftToken,
    showSettingsDraftToken,
    credentialsDialogOpen,
    tenantAccessToken,
    showTenantAccessToken,
    settingsDrawer,
    setSettings: setWorkingSettings,
    setManualBudgetDraft,
    setSettingsDraft,
    setSettingsDraftToken,
    setShowSettingsDraftToken,
    setCredentialsDialogOpen,
    setTenantAccessToken,
    setShowTenantAccessToken,
    saveSettings,
    onSave,
    onOpenPublishSettingsDraft,
    onCancelPublishSettingsDraft,
    onConfirmPublishSettingsDraft,
    onClearProjectToken,
    openSettingsDrawer,
    closeSettingsDrawer,
    onDiscardSettingsDraft,
    onCancelDiscardSettingsDraft,
    onConfirmDiscardSettingsDraft,
    openCredentialsDialog,
    closeCredentialsDialog,
    onSaveSettingsDrawer,
    onSaveProjectToken,
    onSaveTenantToken,
  };
}
