import { useEffect, useState } from 'react';
import type { TProject } from 'librechat-data-provider';
import type {
  useProjectMetaAdsQuery,
  useUpdateProjectMetaAdsMutation,
  useUpdateProjectMetaAdsTenantTokenMutation,
} from '~/data-provider';
import { logger } from '~/utils';
import { normalizeSettings } from '../settings';
import type { Localize, RequestError, MetaAdsSettingsState, SettingsDrawer } from '../types';

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
  const sections = [];
  if (
    hasSettingsChange(savedSettings, draftSettings, [
      'enabled',
      'adAccountId',
      'tokenSecretName',
      'graphVersion',
      'credentialMode',
    ])
  ) {
    sections.push(localize('com_ui_project_meta_ads_account_credentials'));
  }
  if (
    hasSettingsChange(savedSettings, draftSettings, [
      'automationMode',
      'scheduleIntervalMinutes',
      'automationAnalysisPreset',
      'clientGoal',
    ])
  ) {
    sections.push(localize('com_ui_project_meta_ads_automation'));
  }
  if (
    hasSettingsChange(savedSettings, draftSettings, [
      'rules',
      'creativeRules',
      'ruleGroups',
      'ruleOverrides',
    ])
  ) {
    sections.push(localize('com_ui_project_meta_ads_rules'));
  }
  if (hasSettingsChange(savedSettings, draftSettings, ['monthlyBudget', 'monthlyBudgets'])) {
    sections.push(localize('com_ui_project_meta_ads_monthly_budget'));
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
  const [showSettingsDraftToken, setShowSettingsDraftToken] = useState(false);
  const [credentialsDialogOpen, setCredentialsDialogOpen] = useState(false);
  const [tenantAccessToken, setTenantAccessToken] = useState('');
  const [showTenantAccessToken, setShowTenantAccessToken] = useState(false);
  const [settingsDrawer, setSettingsDrawer] = useState<SettingsDrawer>(null);

  useEffect(() => {
    const storedDraft = readStoredSettingsDraft(project.projectId);
    setSettings(storedDraft ?? normalizeSettings(project));
    setHasUnsavedSettingsDraft(Boolean(storedDraft));
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
    const savedSettings = normalizeSettings(project);
    const summary = buildSettingsDraftSummary(savedSettings, settings, localize);
    const message = [
      localize('com_ui_project_meta_ads_discard_draft_confirm'),
      '',
      `${localize('com_ui_project_meta_ads_pending_changes_summary')}: ${
        summary.length > 0 ? summary.join(', ') : localize('com_ui_project_meta_ads_rules')
      }`,
    ].join('\n');
    if (!window.confirm(message)) {
      return;
    }
    clearStoredSettingsDraft(project.projectId);
    setSettings(savedSettings);
    setHasUnsavedSettingsDraft(false);
    closeSettingsDrawer();
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
    openCredentialsDialog,
    closeCredentialsDialog,
    onSaveSettingsDrawer,
    onSaveProjectToken,
    onSaveTenantToken,
  };
}
