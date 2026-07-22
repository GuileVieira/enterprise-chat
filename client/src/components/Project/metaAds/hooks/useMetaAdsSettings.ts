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
import { logger } from '~/utils';
import { normalizeSettings, sanitizeMetaAdsEditableSettings } from '../settings';
import type {
  Localize,
  RequestError,
  SettingsDrawer,
  ManualBudgetDraft,
  MetaAdsDraftStatus,
  MetaAdsDraftSectionKey,
  MetaAdsSettingsState,
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

function buildManualBudgetDraftDetails(drafts: ManualBudgetDraft[]) {
  return drafts.map((draft) => ({
    key: getManualBudgetDraftKey(draft),
    label: draft.entityName ?? draft.entityId,
    savedValue: draft.currentBudget === undefined ? '-' : String(draft.currentBudget),
    draftValue: String(draft.dailyBudget),
  }));
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
    const nextPublishedSettings = normalizeSettings(project);
    const storedManualBudgetDrafts = readStoredManualBudgetDrafts(project.projectId);
    clearStoredSettingsDraft(project.projectId);
    setSettings(nextPublishedSettings);
    setManualBudgetDrafts(storedManualBudgetDrafts);
    setHasUnsavedSettingsDraft(storedManualBudgetDrafts.length > 0);
    setDraftStatus(storedManualBudgetDrafts.length > 0 ? 'pending' : 'idle');
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
    const sanitizedSettings = sanitizeMetaAdsEditableSettings(nextSettings);
    saveSettings(sanitizedSettings, '');
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
    const sanitizedSettings = sanitizeMetaAdsEditableSettings(nextSettings);
    logger.debug('MetaAds', 'Saving project Meta Ads settings', {
      projectId: project.projectId,
      hasMetaAccessToken: trimmedToken.length > 0,
      tokenLength: trimmedToken.length,
      tokenSecretName: sanitizedSettings.tokenSecretName,
    });
    setDraftStatus('publishing');
    setSettings(sanitizedSettings);
    updateSettings.mutate(
      {
        projectId: project.projectId,
        metaAds: sanitizedSettings,
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

  const publishSettingsDrafts = (selectedKeys?: MetaAdsDraftSectionKey[]) => {
    const selectedKeySet = new Set(selectedKeys ?? settingsDraftSummary.map((item) => item.key));
    const hasManualBudgetSelection = selectedKeySet.has('manual-budgets');
    const budgetDraftsToPublish = hasManualBudgetSelection ? manualBudgetDrafts : [];

    if (budgetDraftsToPublish.length === 0) {
      return;
    }

    setDraftStatus('publishing');

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
      try {
        for (const draft of budgetDraftsToPublish) {
          const response = await publishBudgetDraft(draft);
          publishedBudgetKeys.add(getManualBudgetDraftKey(draft));
          if (response.change) {
            onManualBudgetChange?.(response.change);
          }
        }

        const nextManualBudgetDrafts = manualBudgetDrafts.filter(
          (draft) => !publishedBudgetKeys.has(getManualBudgetDraftKey(draft)),
        );
        writeStoredManualBudgetDrafts(project.projectId, nextManualBudgetDrafts);
        setManualBudgetDrafts(nextManualBudgetDrafts);
        const hasPendingDraft = nextManualBudgetDrafts.length > 0;
        setHasUnsavedSettingsDraft(hasPendingDraft);
        setDraftStatus(hasPendingDraft ? 'pending' : 'published');
        setDiscardDraftDialogOpen(false);
        setPublishDraftDialogOpen(false);
        statusQuery.refetch();
        showToast({ message: localize('com_ui_saved'), status: 'success' });
      } catch (error) {
        const remainingBudgetDrafts = manualBudgetDrafts.filter(
          (draft) => !publishedBudgetKeys.has(getManualBudgetDraftKey(draft)),
        );
        writeStoredManualBudgetDrafts(project.projectId, remainingBudgetDrafts);
        setManualBudgetDrafts(remainingBudgetDrafts);
        setHasUnsavedSettingsDraft(remainingBudgetDrafts.length > 0);
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
    saveSettings(settings, '');
  };

  const onOpenPublishSettingsDraft = () => {
    if (settingsDraftSummary.length === 0) {
      return;
    }
    setPublishDraftDialogOpen(true);
  };

  const onCancelPublishSettingsDraft = () => {
    setPublishDraftDialogOpen(false);
  };

  const onConfirmPublishSettingsDraft = (selectedKeys: MetaAdsDraftSectionKey[]) => {
    setPublishDraftDialogOpen(false);
    publishSettingsDrafts(selectedKeys);
  };

  const onDiscardSettingsDraft = () => {
    if (manualBudgetDrafts.length === 0) {
      return;
    }
    setDiscardDraftDialogOpen(true);
  };

  const onCancelDiscardSettingsDraft = () => {
    setDiscardDraftDialogOpen(false);
  };

  const onConfirmDiscardSettingsDraft = (selectedKeys: MetaAdsDraftSectionKey[]) => {
    if (manualBudgetDrafts.length === 0) {
      setDiscardDraftDialogOpen(false);
      return;
    }
    const hasManualBudgetSelection = selectedKeys.includes('manual-budgets');
    if (!hasManualBudgetSelection) {
      setDiscardDraftDialogOpen(false);
      return;
    }

    const nextManualBudgetDrafts: ManualBudgetDraft[] = [];
    writeStoredManualBudgetDrafts(project.projectId, nextManualBudgetDrafts);
    setManualBudgetDrafts(nextManualBudgetDrafts);
    setHasUnsavedSettingsDraft(false);
    setDraftStatus('idle');
    setDiscardDraftDialogOpen(false);
    closeSettingsDrawer();
  };

  const settingsDraftSummary =
    manualBudgetDrafts.length > 0
      ? [
          {
            key: 'manual-budgets' as const,
            label: localize('com_ui_project_meta_ads_pending_manual_budgets', {
              0: String(manualBudgetDrafts.length),
            }),
            details: buildManualBudgetDraftDetails(manualBudgetDrafts),
          },
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
