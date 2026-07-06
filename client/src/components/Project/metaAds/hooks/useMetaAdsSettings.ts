import { useEffect, useState } from 'react';
import type { TProject } from 'librechat-data-provider';
import type {
  useProjectMetaAdsQuery,
  useUpdateProjectMetaAdsMutation,
  useUpdateProjectMetaAdsTenantTokenMutation,
} from '~/data-provider';
import { logger } from '~/utils';
import { normalizeSettings } from '../settings';
import type {
  Localize,
  RequestError,
  SettingsDrawer,
  MetaAdsDraftStatus,
  MetaAdsSettingsState,
  MetaAdsDraftSummaryItem,
} from '../types';

type ToastStatus = 'success' | 'error' | 'warning' | 'info';

type ShowToast = (toast: { message: string; status: ToastStatus }) => void;

type UseMetaAdsSettingsParams = {
  project: TProject;
  statusQuery: ReturnType<typeof useProjectMetaAdsQuery>;
  updateSettings: ReturnType<typeof useUpdateProjectMetaAdsMutation>;
  updateTenantToken: ReturnType<typeof useUpdateProjectMetaAdsTenantTokenMutation>;
  localize: Localize;
  showToast: ShowToast;
};

function getSettingsDraftStorageKey(projectId: string) {
  return `orqest:metaAds:${projectId}:settingsDraft`;
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

function hasSettingsChange(
  savedSettings: MetaAdsSettingsState,
  draftSettings: MetaAdsSettingsState,
  keys: Array<keyof MetaAdsSettingsState>,
) {
  return keys.some(
    (key) => JSON.stringify(savedSettings[key]) !== JSON.stringify(draftSettings[key]),
  );
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
    sections.push({ key: 'automation', label: localize('com_ui_project_meta_ads_automation') });
  }
  if (hasSettingsChange(savedSettings, draftSettings, ['rules', 'creativeRules'])) {
    sections.push({
      key: 'global-rules',
      label: localize('com_ui_project_meta_ads_global_rules'),
    });
  }
  if (hasSettingsChange(savedSettings, draftSettings, ['ruleGroups'])) {
    sections.push({
      key: 'rule-groups',
      label: localize('com_ui_project_meta_ads_rule_groups'),
    });
  }
  if (hasSettingsChange(savedSettings, draftSettings, ['ruleOverrides'])) {
    sections.push({
      key: 'rule-overrides',
      label: localize('com_ui_project_meta_ads_rule_overrides'),
    });
  }
  if (hasSettingsChange(savedSettings, draftSettings, ['monthlyBudget', 'monthlyBudgets'])) {
    sections.push({
      key: 'monthly-budget',
      label: localize('com_ui_project_meta_ads_monthly_budget'),
    });
  }
  return sections;
}

export function useMetaAdsSettings({
  project,
  statusQuery,
  updateSettings,
  updateTenantToken,
  localize,
  showToast,
}: UseMetaAdsSettingsParams) {
  const [settings, setSettings] = useState(() => normalizeSettings(project));
  const [hasUnsavedSettingsDraft, setHasUnsavedSettingsDraft] = useState(false);
  const [settingsDraft, setSettingsDraft] = useState<MetaAdsSettingsState | null>(null);
  const [settingsDraftToken, setSettingsDraftToken] = useState('');
  const [draftStatus, setDraftStatus] = useState<MetaAdsDraftStatus>('idle');
  const [discardDraftDialogOpen, setDiscardDraftDialogOpen] = useState(false);
  const [showSettingsDraftToken, setShowSettingsDraftToken] = useState(false);
  const [credentialsDialogOpen, setCredentialsDialogOpen] = useState(false);
  const [tenantAccessToken, setTenantAccessToken] = useState('');
  const [showTenantAccessToken, setShowTenantAccessToken] = useState(false);
  const [settingsDrawer, setSettingsDrawer] = useState<SettingsDrawer>(null);

  useEffect(() => {
    const storedDraft = readStoredSettingsDraft(project.projectId);
    setSettings(storedDraft ?? normalizeSettings(project));
    setHasUnsavedSettingsDraft(Boolean(storedDraft));
    setDraftStatus(storedDraft ? 'pending' : 'idle');
    setDiscardDraftDialogOpen(false);
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
          setHasUnsavedSettingsDraft(false);
          setDraftStatus('published');
          setDiscardDraftDialogOpen(false);
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

  const onSave = () => {
    saveSettings(settings, '');
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

  const onConfirmDiscardSettingsDraft = () => {
    if (!hasUnsavedSettingsDraft) {
      setDiscardDraftDialogOpen(false);
      return;
    }
    const savedSettings = normalizeSettings(project);
    clearStoredSettingsDraft(project.projectId);
    setSettings(savedSettings);
    setHasUnsavedSettingsDraft(false);
    setDraftStatus('idle');
    setDiscardDraftDialogOpen(false);
    closeSettingsDrawer();
  };

  const settingsDraftSummary = hasUnsavedSettingsDraft
    ? buildSettingsDraftSummary(normalizeSettings(project), settings, localize)
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
    hasUnsavedSettingsDraft,
    draftStatus,
    settingsDraftSummary,
    discardDraftDialogOpen,
    settingsDraft,
    settingsDraftToken,
    showSettingsDraftToken,
    credentialsDialogOpen,
    tenantAccessToken,
    showTenantAccessToken,
    settingsDrawer,
    setSettings: setWorkingSettings,
    setSettingsDraft,
    setSettingsDraftToken,
    setShowSettingsDraftToken,
    setCredentialsDialogOpen,
    setTenantAccessToken,
    setShowTenantAccessToken,
    saveSettings,
    onSave,
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
