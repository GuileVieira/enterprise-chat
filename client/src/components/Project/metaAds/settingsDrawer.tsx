import { scheduleOptions } from './constants';
import { getAdAccountDigits, toAdAccountId } from './settings';
import type {
  Localize,
  SettingsDrawer,
  MetaAdsSettings,
  MetaAdsSettingsState,
  ScheduleIntervalMinutes,
} from './types';

type SettingsDrawerChrome = {
  modalOverlayClassName: string;
  drawerShellClassName: string;
  modalHeaderClassName: string;
  modalTileClassName: string;
};

type SettingsDrawerControls = {
  inputClassName: string;
  buttonClassName: string;
  primaryButtonClassName: string;
  ghostButtonClassName: string;
};

export function MetaAdsSettingsDrawer({
  drawer,
  draft,
  tokenConfigured,
  tokenStatusLabel,
  effectiveGraphVersion,
  graphVersionOptions,
  canUseMetaAdsActions,
  saving,
  localize,
  onDraftChange,
  onOpenCredentials,
  onClose,
  onSave,
  chrome,
  controls,
}: {
  drawer: SettingsDrawer;
  draft: MetaAdsSettingsState | null;
  tokenConfigured: boolean;
  tokenStatusLabel: string;
  effectiveGraphVersion: string;
  graphVersionOptions: string[];
  canUseMetaAdsActions: boolean;
  saving: boolean;
  localize: Localize;
  onDraftChange: (draft: MetaAdsSettingsState) => void;
  onOpenCredentials: () => void;
  onClose: () => void;
  onSave: () => void;
  chrome: SettingsDrawerChrome;
  controls: SettingsDrawerControls;
}) {
  if (!drawer || !draft) {
    return null;
  }

  const updateDraft = (patch: Partial<MetaAdsSettingsState>) =>
    onDraftChange({ ...draft, ...patch });

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="meta-ads-settings-drawer-title"
      className={`${chrome.modalOverlayClassName} flex justify-end p-0`}
    >
      <div className={`${chrome.drawerShellClassName} max-w-lg`}>
        <div className={chrome.modalHeaderClassName}>
          <h4
            id="meta-ads-settings-drawer-title"
            className="text-base font-semibold text-slate-950 dark:text-white"
          >
            {localize(
              drawer === 'account'
                ? 'com_ui_project_meta_ads_account_credentials'
                : 'com_ui_project_meta_ads_automation',
            )}
          </h4>
          <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            {drawer === 'account'
              ? tokenStatusLabel
              : localize('com_ui_project_meta_ads_schedule_minutes', {
                  0: String(draft.scheduleIntervalMinutes),
                })}
          </div>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {drawer === 'account' ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-1 text-xs text-slate-600 dark:text-slate-300">
                  {localize('com_ui_project_meta_ads_enabled')}
                  <select
                    disabled={!canUseMetaAdsActions}
                    value={draft.enabled ? 'true' : 'false'}
                    onChange={(event) => updateDraft({ enabled: event.target.value === 'true' })}
                    className={controls.inputClassName}
                  >
                    <option value="false">{localize('com_ui_project_meta_ads_disabled')}</option>
                    <option value="true">
                      {localize('com_ui_project_meta_ads_enabled_state')}
                    </option>
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-xs text-slate-600 dark:text-slate-300">
                  {localize('com_ui_project_meta_ads_account')}
                  <input
                    disabled={!canUseMetaAdsActions}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={getAdAccountDigits(draft.adAccountId)}
                    onChange={(event) =>
                      updateDraft({ adAccountId: toAdAccountId(event.target.value) })
                    }
                    placeholder="123456789"
                    className={controls.inputClassName}
                  />
                </label>
              </div>
              <label className="flex flex-col gap-1 text-xs text-slate-600 dark:text-slate-300">
                {localize('com_ui_project_meta_ads_graph_version')}
                <select
                  disabled={!canUseMetaAdsActions}
                  value={draft.graphVersion ?? ''}
                  onChange={(event) => updateDraft({ graphVersion: event.target.value })}
                  autoComplete="off"
                  className={controls.inputClassName}
                >
                  <option value="">
                    {localize('com_ui_project_meta_ads_graph_version_global', {
                      0: effectiveGraphVersion,
                    })}
                  </option>
                  {graphVersionOptions.map((version) => (
                    <option key={version} value={version}>
                      {version}
                    </option>
                  ))}
                </select>
              </label>
              <div className={chrome.modalTileClassName}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="text-sm font-medium text-slate-950 dark:text-white">
                      {localize('com_ui_project_meta_ads_credentials')}
                    </div>
                    <div className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                      {localize('com_ui_project_meta_ads_credentials_hint')}
                    </div>
                    {tokenConfigured && (
                      <span className="mt-2 inline-flex w-fit items-center gap-2 rounded-full border border-slate-200/80 bg-white/80 px-3 py-1 text-xs text-slate-600 dark:border-white/10 dark:bg-white/[0.055] dark:text-slate-300">
                        {tokenStatusLabel}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    disabled={!canUseMetaAdsActions}
                    onClick={onOpenCredentials}
                    className={controls.buttonClassName}
                  >
                    {localize('com_ui_project_meta_ads_manage_tokens')}
                  </button>
                </div>
              </div>
              <div
                className={`${chrome.modalTileClassName} text-sm text-slate-600 dark:text-slate-300`}
              >
                <div className="font-medium text-slate-950 dark:text-white">{tokenStatusLabel}</div>
                <div className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
                  {localize('com_ui_project_meta_ads_graph_version_hint')}
                </div>
              </div>
            </>
          ) : (
            <div className="grid gap-3">
              <label className="flex flex-col gap-1 text-xs text-slate-600 dark:text-slate-300">
                {localize('com_ui_project_meta_ads_mode')}
                <select
                  disabled={!canUseMetaAdsActions}
                  value={draft.automationMode}
                  onChange={(event) =>
                    updateDraft({
                      automationMode: event.target.value as MetaAdsSettings['automationMode'],
                    })
                  }
                  className={controls.inputClassName}
                >
                  <option value="recommend">
                    {localize('com_ui_project_meta_ads_mode_recommend')}
                  </option>
                  <option value="auto_limited">
                    {localize('com_ui_project_meta_ads_mode_auto_limited')}
                  </option>
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs text-slate-600 dark:text-slate-300">
                {localize('com_ui_project_meta_ads_schedule')}
                <select
                  disabled={!canUseMetaAdsActions}
                  value={draft.scheduleIntervalMinutes}
                  onChange={(event) =>
                    updateDraft({
                      scheduleIntervalMinutes: Number(
                        event.target.value,
                      ) as ScheduleIntervalMinutes,
                    })
                  }
                  className={controls.inputClassName}
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
        <div className="flex justify-end gap-2 border-t border-slate-200/75 p-4 dark:border-white/10">
          <button type="button" onClick={onClose} className={controls.ghostButtonClassName}>
            {localize('com_ui_cancel')}
          </button>
          <button
            type="button"
            disabled={!canUseMetaAdsActions || saving}
            onClick={onSave}
            className={controls.primaryButtonClassName}
          >
            {localize('com_ui_save')}
          </button>
        </div>
      </div>
    </div>
  );
}
