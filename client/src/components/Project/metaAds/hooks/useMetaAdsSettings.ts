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

export function useMetaAdsSettings({
  project,
  statusQuery,
  updateSettings,
  updateTenantToken,
  localize,
  showToast,
}: UseMetaAdsSettingsParams) {
  const [settings, setSettings] = useState(() => normalizeSettings(project));
  const [settingsDraft, setSettingsDraft] = useState<MetaAdsSettingsState | null>(null);
  const [settingsDraftToken, setSettingsDraftToken] = useState('');
  const [showSettingsDraftToken, setShowSettingsDraftToken] = useState(false);
  const [credentialsDialogOpen, setCredentialsDialogOpen] = useState(false);
  const [tenantAccessToken, setTenantAccessToken] = useState('');
  const [showTenantAccessToken, setShowTenantAccessToken] = useState(false);
  const [settingsDrawer, setSettingsDrawer] = useState<SettingsDrawer>(null);

  useEffect(() => {
    setSettings(normalizeSettings(project));
    setSettingsDrawer(null);
    setSettingsDraft(null);
    setSettingsDraftToken('');
    setShowSettingsDraftToken(false);
    setCredentialsDialogOpen(false);
    setTenantAccessToken('');
    setShowTenantAccessToken(false);
  }, [project]);

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
    settingsDraft,
    settingsDraftToken,
    showSettingsDraftToken,
    credentialsDialogOpen,
    tenantAccessToken,
    showTenantAccessToken,
    settingsDrawer,
    setSettings,
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
    openCredentialsDialog,
    closeCredentialsDialog,
    onSaveSettingsDrawer,
    onSaveProjectToken,
    onSaveTenantToken,
  };
}
