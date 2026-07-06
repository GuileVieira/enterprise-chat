import { ArrowsIn, ArrowsOut } from '@phosphor-icons/react';
import { workspaceTabOptions } from './constants';
import { MetaAdsBadge, MetaAdsButton } from './ui';
import type { useLocalize } from '~/hooks';
import type { TranslationKeys } from '~/hooks';
import type {
  SettingsDrawer,
  WorkspaceTab,
  MetaAdsDraftStatus,
  MetaAdsDraftSummaryItem,
} from './types';

type MetaAdsWorkspaceShellProps = {
  children: React.ReactNode;
  automationMode: string;
  scheduleIntervalMinutes: number;
  tokenStatusKey: TranslationKeys;
  workspaceTab: WorkspaceTab;
  settingsDrawer: SettingsDrawer;
  metricsFullscreen: boolean;
  canUseMetaAdsActions: boolean;
  runningAnalysis: boolean;
  savingSettings: boolean;
  hasUnsavedSettingsDraft: boolean;
  draftStatus: MetaAdsDraftStatus;
  settingsDraftSummary: MetaAdsDraftSummaryItem[];
  runNoticeMessage: string | null;
  runNoticeStatus: 'success' | 'error';
  localize: ReturnType<typeof useLocalize>;
  onRunAnalysis: () => void;
  onOpenSettingsDrawer: (drawer: Exclude<SettingsDrawer, null>) => void;
  onOpenRuleGroupDraft: () => void;
  onWorkspaceTabChange: (tab: WorkspaceTab) => void;
  onToggleFullscreen: () => void;
  onSave: () => void;
  onPublishDraft: () => void;
  onDiscardDraft: () => void;
};

const metaAdsSurface =
  'overflow-hidden rounded-[28px] border border-slate-200/80 bg-[radial-gradient(circle_at_top_left,rgba(20,184,166,0.12),transparent_34%),linear-gradient(135deg,#f8fbff_0%,#eef5ff_45%,#f7f2ff_100%)] text-slate-950 shadow-[0_24px_80px_-52px_rgba(15,23,42,0.45)] dark:border-white/10 dark:bg-[radial-gradient(circle_at_top_left,rgba(20,184,166,0.18),transparent_34%),linear-gradient(135deg,#111827_0%,#172033_48%,#241b3a_100%)] dark:text-slate-50 dark:shadow-[0_30px_100px_-60px_rgba(15,23,42,0.95)]';

export function MetaAdsWorkspaceShell({
  children,
  automationMode,
  scheduleIntervalMinutes,
  tokenStatusKey,
  workspaceTab,
  settingsDrawer,
  metricsFullscreen,
  canUseMetaAdsActions,
  runningAnalysis,
  savingSettings,
  hasUnsavedSettingsDraft,
  draftStatus,
  settingsDraftSummary,
  runNoticeMessage,
  runNoticeStatus,
  localize,
  onRunAnalysis,
  onOpenSettingsDrawer,
  onOpenRuleGroupDraft,
  onWorkspaceTabChange,
  onToggleFullscreen,
  onSave,
  onPublishDraft,
  onDiscardDraft,
}: MetaAdsWorkspaceShellProps) {
  const draftSummaryText =
    settingsDraftSummary.length > 0
      ? settingsDraftSummary.map((item) => item.label).join(', ')
      : localize('com_ui_project_meta_ads_pending_changes_empty');
  const draftButtonKey =
    draftStatus === 'publishing'
      ? 'com_ui_project_meta_ads_draft_publishing'
      : draftStatus === 'error'
        ? 'com_ui_project_meta_ads_draft_error'
        : 'com_ui_project_meta_ads_publish_draft';

  return (
    <div
      data-testid="meta-ads-metrics-workspace"
      className={`${
        metricsFullscreen
          ? 'fixed inset-0 z-[9999] h-screen !overflow-y-auto !rounded-none'
          : 'relative overflow-hidden'
      } ${metaAdsSurface}`}
    >
      <div className="relative flex flex-col gap-5 border-b border-slate-200/70 p-5 dark:border-white/10 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-2xl font-semibold leading-tight tracking-tight text-slate-950 dark:text-white">
            {localize('com_ui_project_meta_ads_title')}
          </h3>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-300">
            <MetaAdsBadge variant="success">{localize(tokenStatusKey)}</MetaAdsBadge>
            <MetaAdsBadge className="font-normal">{automationMode}</MetaAdsBadge>
            <MetaAdsBadge className="font-normal">
              {localize('com_ui_project_meta_ads_schedule_minutes', {
                0: String(scheduleIntervalMinutes),
              })}
            </MetaAdsBadge>
            {hasUnsavedSettingsDraft && (
              <MetaAdsBadge variant={draftStatus === 'error' ? 'danger' : 'warning'}>
                {localize('com_ui_project_meta_ads_pending_changes_summary')}: {draftSummaryText}
              </MetaAdsBadge>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <MetaAdsButton
            disabled={!canUseMetaAdsActions || runningAnalysis}
            onClick={onRunAnalysis}
          >
            {localize(
              runningAnalysis ? 'com_ui_project_meta_ads_running' : 'com_ui_project_meta_ads_run',
            )}
          </MetaAdsButton>
          <MetaAdsButton onClick={() => onOpenSettingsDrawer('account')}>
            {localize('com_ui_project_meta_ads_account_credentials')}
          </MetaAdsButton>
          <MetaAdsButton onClick={() => onOpenSettingsDrawer('automation')}>
            {localize('com_ui_project_meta_ads_automation')}
          </MetaAdsButton>
          <MetaAdsButton disabled={!canUseMetaAdsActions} onClick={onOpenRuleGroupDraft}>
            {localize('com_ui_project_meta_ads_rules')}
          </MetaAdsButton>
          <MetaAdsButton
            onClick={onToggleFullscreen}
            aria-label={localize(
              metricsFullscreen
                ? 'com_ui_project_meta_ads_exit_fullscreen'
                : 'com_ui_project_meta_ads_enter_fullscreen',
            )}
            className="inline-flex items-center gap-2"
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
          </MetaAdsButton>
          {!settingsDrawer && (
            <MetaAdsButton
              variant="primary"
              disabled={!canUseMetaAdsActions || savingSettings}
              onClick={hasUnsavedSettingsDraft ? onPublishDraft : onSave}
              title={hasUnsavedSettingsDraft ? draftSummaryText : undefined}
              className={
                hasUnsavedSettingsDraft && draftStatus !== 'publishing'
                  ? 'bg-blue-600 text-white shadow-[0_18px_44px_-26px_rgba(37,99,235,0.75)] hover:bg-blue-500 dark:bg-blue-400 dark:text-slate-950 dark:hover:bg-blue-300'
                  : undefined
              }
            >
              {localize(hasUnsavedSettingsDraft ? draftButtonKey : 'com_ui_save')}
            </MetaAdsButton>
          )}
          {hasUnsavedSettingsDraft && !settingsDrawer && (
            <MetaAdsButton
              variant="danger"
              disabled={!canUseMetaAdsActions || savingSettings}
              onClick={onDiscardDraft}
            >
              {localize('com_ui_project_meta_ads_discard_draft')}
            </MetaAdsButton>
          )}
        </div>
      </div>
      {runNoticeMessage && (
        <div
          role="alert"
          className={
            runNoticeStatus === 'success'
              ? 'relative m-5 border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-800 dark:text-emerald-100'
              : 'relative m-5 border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-100'
          }
        >
          {runNoticeMessage}
        </div>
      )}
      <div
        role="tablist"
        aria-label={localize('com_ui_project_meta_ads_title')}
        className="flex flex-wrap gap-1 border-b border-slate-200/70 bg-white/35 px-4 py-3 backdrop-blur dark:border-white/10 dark:bg-slate-950/10"
      >
        {workspaceTabOptions.map((option) => {
          const isSelected = workspaceTab === option.value;
          return (
            <button
              key={option.value}
              type="button"
              role="tab"
              id={`meta-ads-tab-${option.value}`}
              aria-selected={isSelected}
              aria-controls={`meta-ads-${option.value}-tab-panel`}
              data-testid={`meta-ads-workspace-tab-${option.value}`}
              onClick={() => onWorkspaceTabChange(option.value)}
              className={`rounded-xl border px-4 py-2 text-xs font-semibold transition ${
                isSelected
                  ? 'border-teal-300/70 bg-teal-50 text-teal-800 shadow-[0_12px_30px_-24px_rgba(20,184,166,0.65)] dark:border-teal-300/35 dark:bg-teal-300/10 dark:text-teal-100'
                  : 'border-transparent text-slate-500 hover:border-slate-200 hover:bg-white/70 hover:text-slate-900 dark:text-slate-400 dark:hover:border-white/10 dark:hover:bg-white/[0.055] dark:hover:text-slate-100'
              }`}
            >
              {localize(option.labelKey)}
            </button>
          );
        })}
      </div>
      {children}
    </div>
  );
}
