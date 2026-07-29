import { OGDialog, OGDialogTitle, OGDialogHeader, OGDialogContent } from '@librechat/client';
import type { Localize } from './types';

type MetaAdsDialogChrome = {
  modalShellClassName: string;
  modalHeaderClassName: string;
  modalTileClassName: string;
};

export function MetaAdsCredentialsDialog({
  open,
  tenantConfigured,
  canManageTenantToken,
  canUseMetaAdsActions,
  hasProjectToken,
  tenantAccessToken,
  showTenantAccessToken,
  settingsDraftToken,
  showSettingsDraftToken,
  savingTenantToken,
  savingProjectToken,
  localize,
  onOpen,
  onClose,
  onTenantAccessTokenChange,
  onToggleTenantAccessToken,
  onSaveTenantToken,
  onSettingsDraftTokenChange,
  onToggleSettingsDraftToken,
  onClearProjectToken,
  onSaveProjectToken,
  chrome,
  buttons,
}: {
  open: boolean;
  tenantConfigured: boolean;
  canManageTenantToken: boolean;
  canUseMetaAdsActions: boolean;
  hasProjectToken: boolean;
  tenantAccessToken: string;
  showTenantAccessToken: boolean;
  settingsDraftToken: string;
  showSettingsDraftToken: boolean;
  savingTenantToken: boolean;
  savingProjectToken: boolean;
  localize: Localize;
  onOpen: () => void;
  onClose: () => void;
  onTenantAccessTokenChange: (value: string) => void;
  onToggleTenantAccessToken: () => void;
  onSaveTenantToken: () => void;
  onSettingsDraftTokenChange: (value: string) => void;
  onToggleSettingsDraftToken: () => void;
  onClearProjectToken: () => void;
  onSaveProjectToken: () => void;
  chrome: MetaAdsDialogChrome;
  buttons: {
    primaryClassName: string;
    ghostClassName: string;
  };
}) {
  return (
    <OGDialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen) {
          onOpen();
          return;
        }
        onClose();
      }}
    >
      <OGDialogContent className={`max-w-2xl p-0 ${chrome.modalShellClassName}`}>
        <OGDialogHeader>
          <div className={chrome.modalHeaderClassName}>
            <OGDialogTitle>{localize('com_ui_project_meta_ads_manage_tokens')}</OGDialogTitle>
            <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              {localize('com_ui_project_meta_ads_manage_tokens_hint')}
            </div>
          </div>
        </OGDialogHeader>
        <div className="space-y-4 p-4">
          <TenantTokenSection
            tenantConfigured={tenantConfigured}
            canManageTenantToken={canManageTenantToken}
            tenantAccessToken={tenantAccessToken}
            showTenantAccessToken={showTenantAccessToken}
            savingTenantToken={savingTenantToken}
            localize={localize}
            onTenantAccessTokenChange={onTenantAccessTokenChange}
            onToggleTenantAccessToken={onToggleTenantAccessToken}
            onSaveTenantToken={onSaveTenantToken}
            tileClassName={chrome.modalTileClassName}
            primaryButtonClassName={buttons.primaryClassName}
          />

          <ProjectTokenSection
            canUseMetaAdsActions={canUseMetaAdsActions}
            hasProjectToken={hasProjectToken}
            settingsDraftToken={settingsDraftToken}
            showSettingsDraftToken={showSettingsDraftToken}
            savingProjectToken={savingProjectToken}
            localize={localize}
            onSettingsDraftTokenChange={onSettingsDraftTokenChange}
            onToggleSettingsDraftToken={onToggleSettingsDraftToken}
            onClearProjectToken={onClearProjectToken}
            onSaveProjectToken={onSaveProjectToken}
            tileClassName={chrome.modalTileClassName}
            primaryButtonClassName={buttons.primaryClassName}
            ghostButtonClassName={buttons.ghostClassName}
          />
        </div>
        <div className="flex justify-end border-t border-slate-200/75 p-4 dark:border-white/10">
          <button type="button" onClick={onClose} className={buttons.ghostClassName}>
            {localize('com_ui_close')}
          </button>
        </div>
      </OGDialogContent>
    </OGDialog>
  );
}

function TenantTokenSection({
  tenantConfigured,
  canManageTenantToken,
  tenantAccessToken,
  showTenantAccessToken,
  savingTenantToken,
  localize,
  onTenantAccessTokenChange,
  onToggleTenantAccessToken,
  onSaveTenantToken,
  tileClassName,
  primaryButtonClassName,
}: {
  tenantConfigured: boolean;
  canManageTenantToken: boolean;
  tenantAccessToken: string;
  showTenantAccessToken: boolean;
  savingTenantToken: boolean;
  localize: Localize;
  onTenantAccessTokenChange: (value: string) => void;
  onToggleTenantAccessToken: () => void;
  onSaveTenantToken: () => void;
  tileClassName: string;
  primaryButtonClassName: string;
}) {
  return (
    <div className={tileClassName}>
      <div className="flex flex-col gap-1">
        <div className="text-sm font-medium text-slate-950 dark:text-white">
          {localize('com_ui_project_meta_ads_global_token_title')}
        </div>
        <div className="text-xs leading-5 text-slate-500 dark:text-slate-400">
          {localize(
            canManageTenantToken
              ? 'com_ui_project_meta_ads_tenant_token_hint'
              : 'com_ui_project_meta_ads_tenant_token_admin_hint',
          )}
        </div>
        <span className="mt-1 inline-flex w-fit rounded-full border border-slate-200/80 bg-white/80 px-3 py-1 text-xs text-slate-600 dark:border-white/10 dark:bg-white/[0.055] dark:text-slate-300">
          {tenantConfigured
            ? localize('com_ui_project_meta_ads_tenant_token_configured')
            : localize('com_ui_project_meta_ads_token_missing')}
        </span>
      </div>
      {canManageTenantToken && (
        <div className="mt-3 flex h-11 overflow-hidden rounded-xl border border-slate-200/90 bg-white/90 dark:border-white/10 dark:bg-slate-950/35">
          <input
            type={showTenantAccessToken ? 'text' : 'password'}
            autoComplete="new-password"
            value={tenantAccessToken}
            onChange={(event) => onTenantAccessTokenChange(event.target.value)}
            placeholder={localize('com_ui_project_meta_ads_token_placeholder')}
            className="min-w-0 flex-1 bg-transparent px-3 text-sm text-slate-800 outline-none dark:text-slate-100"
          />
          {tenantAccessToken.length > 0 && (
            <button
              type="button"
              onClick={onToggleTenantAccessToken}
              className="shrink-0 border-l border-slate-200/75 px-3 text-xs font-medium text-slate-500 dark:border-white/10 dark:text-slate-400"
            >
              {localize(showTenantAccessToken ? 'com_ui_hide_password' : 'com_ui_show_password')}
            </button>
          )}
        </div>
      )}
      {canManageTenantToken && (
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            disabled={!tenantAccessToken.trim() || savingTenantToken}
            onClick={onSaveTenantToken}
            className={primaryButtonClassName}
          >
            {localize('com_ui_project_meta_ads_save_tenant_token')}
          </button>
        </div>
      )}
    </div>
  );
}

function ProjectTokenSection({
  canUseMetaAdsActions,
  hasProjectToken,
  settingsDraftToken,
  showSettingsDraftToken,
  savingProjectToken,
  localize,
  onSettingsDraftTokenChange,
  onToggleSettingsDraftToken,
  onClearProjectToken,
  onSaveProjectToken,
  tileClassName,
  primaryButtonClassName,
  ghostButtonClassName,
}: {
  canUseMetaAdsActions: boolean;
  hasProjectToken: boolean;
  settingsDraftToken: string;
  showSettingsDraftToken: boolean;
  savingProjectToken: boolean;
  localize: Localize;
  onSettingsDraftTokenChange: (value: string) => void;
  onToggleSettingsDraftToken: () => void;
  onClearProjectToken: () => void;
  onSaveProjectToken: () => void;
  tileClassName: string;
  primaryButtonClassName: string;
  ghostButtonClassName: string;
}) {
  return (
    <div className={tileClassName}>
      <div className="flex flex-col gap-1">
        <div className="text-sm font-medium text-slate-950 dark:text-white">
          {localize('com_ui_project_meta_ads_local_token_title')}
        </div>
        <div className="text-xs leading-5 text-slate-500 dark:text-slate-400">
          {localize('com_ui_project_meta_ads_project_token_hint')}
        </div>
        <span className="mt-1 inline-flex w-fit rounded-full border border-slate-200/80 bg-white/80 px-3 py-1 text-xs text-slate-600 dark:border-white/10 dark:bg-white/[0.055] dark:text-slate-300">
          {hasProjectToken
            ? localize('com_ui_project_meta_ads_project_token_configured')
            : localize('com_ui_project_meta_ads_project_token_not_configured')}
        </span>
      </div>
      <div className="mt-3 flex h-11 overflow-hidden rounded-xl border border-slate-200/90 bg-white/90 dark:border-white/10 dark:bg-slate-950/35">
        <input
          disabled={!canUseMetaAdsActions}
          type={showSettingsDraftToken ? 'text' : 'password'}
          name="meta_ads_project_token_new"
          autoComplete="new-password"
          value={settingsDraftToken}
          onChange={(event) => onSettingsDraftTokenChange(event.target.value)}
          placeholder={localize(
            hasProjectToken
              ? 'com_ui_project_meta_ads_token_keep_existing'
              : 'com_ui_project_meta_ads_token_placeholder',
          )}
          className="min-w-0 flex-1 bg-transparent px-3 text-sm text-slate-800 outline-none disabled:cursor-not-allowed dark:text-slate-100"
        />
        {settingsDraftToken.length > 0 && (
          <button
            type="button"
            disabled={!canUseMetaAdsActions}
            onClick={onToggleSettingsDraftToken}
            className="shrink-0 border-l border-slate-200/75 px-3 text-xs font-medium text-slate-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:text-slate-400"
          >
            {localize(showSettingsDraftToken ? 'com_ui_hide_password' : 'com_ui_show_password')}
          </button>
        )}
      </div>
      <div className="mt-3 flex flex-wrap justify-end gap-2">
        {hasProjectToken && (
          <button
            type="button"
            disabled={!canUseMetaAdsActions || savingProjectToken}
            onClick={onClearProjectToken}
            className={ghostButtonClassName}
          >
            {localize('com_ui_project_meta_ads_use_tenant_token')}
          </button>
        )}
        <button
          type="button"
          disabled={!canUseMetaAdsActions || !settingsDraftToken.trim() || savingProjectToken}
          onClick={onSaveProjectToken}
          className={primaryButtonClassName}
        >
          {localize('com_ui_project_meta_ads_save_project_token')}
        </button>
      </div>
    </div>
  );
}
