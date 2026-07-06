import { useEffect, useMemo, useState } from 'react';

import type {
  Localize,
  DuplicateDraft,
  BudgetConfirmation,
  MetaAdsDraftSectionKey,
  MetaAdsDraftSummaryItem,
  EntityStatusConfirmation,
} from './types';
import { formatMoney } from './formatters';

type ConfirmationChrome = {
  modalOverlayClassName: string;
  drawerShellClassName: string;
  modalHeaderClassName: string;
  modalTileClassName: string;
};

type ConfirmationButtons = {
  primaryClassName: string;
  ghostClassName: string;
  inputClassName: string;
};

export function MetaAdsBudgetConfirmationBanner({
  confirmation,
  currency,
  saving,
  localize,
  onCancel,
  onConfirm,
}: {
  confirmation: BudgetConfirmation | null;
  currency: string;
  saving: boolean;
  localize: Localize;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!confirmation) {
    return null;
  }

  return (
    <div className="border-b border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
      <div className="font-semibold">
        {localize('com_ui_project_meta_ads_confirm_budget_title')}
      </div>
      <div className="mt-1">
        {confirmation.entityName ?? confirmation.entityId}:{' '}
        {formatMoney(confirmation.currentBudget, currency)}
        {' -> '}
        {formatMoney(confirmation.dailyBudget, currency)}
      </div>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="h-8 border border-amber-300 px-3 text-xs font-medium"
        >
          {localize('com_ui_cancel')}
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={onConfirm}
          className="h-8 bg-amber-900 px-3 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {localize('com_ui_project_meta_ads_confirm_budget')}
        </button>
      </div>
    </div>
  );
}

export function MetaAdsEntityStatusConfirmationBanner({
  confirmation,
  saving,
  localize,
  onCancel,
  onConfirm,
}: {
  confirmation: EntityStatusConfirmation | null;
  saving: boolean;
  localize: Localize;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!confirmation) {
    return null;
  }

  return (
    <div className="border-b border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
      <div className="font-semibold">
        {localize('com_ui_project_meta_ads_confirm_ad_status_title')}
      </div>
      <div className="mt-1">
        {confirmation.entityName ?? confirmation.entityId}: {confirmation.currentStatus || '-'}
        {' -> '}
        {confirmation.nextStatus}
      </div>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="h-8 border border-amber-300 px-3 text-xs font-medium"
        >
          {localize('com_ui_cancel')}
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={onConfirm}
          className="h-8 bg-amber-900 px-3 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {localize(
            confirmation.nextStatus === 'ACTIVE'
              ? 'com_ui_project_meta_ads_confirm_activate_ad'
              : 'com_ui_project_meta_ads_confirm_deactivate_ad',
          )}
        </button>
      </div>
    </div>
  );
}

export function MetaAdsDuplicateEntityDialog({
  draft,
  targetName,
  currency,
  saving,
  localize,
  onTargetNameChange,
  onClose,
  onConfirm,
  chrome,
  buttons,
}: {
  draft: DuplicateDraft | null;
  targetName: string;
  currency: string;
  saving: boolean;
  localize: Localize;
  onTargetNameChange: (value: string) => void;
  onClose: () => void;
  onConfirm: () => void;
  chrome: ConfirmationChrome;
  buttons: ConfirmationButtons;
}) {
  if (!draft) {
    return null;
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="meta-ads-duplicate-title"
      className={`${chrome.modalOverlayClassName} flex justify-end p-0`}
    >
      <div className={`${chrome.drawerShellClassName} max-w-md`}>
        <div className={chrome.modalHeaderClassName}>
          <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
            {draft.entityLevel === 'campaign'
              ? localize('com_ui_project_meta_ads_level_campaign')
              : localize('com_ui_project_meta_ads_level_ad_set')}
          </div>
          <h4
            id="meta-ads-duplicate-title"
            className="mt-1 text-base font-semibold text-slate-950 dark:text-white"
          >
            {localize('com_ui_project_meta_ads_duplicate_title')}
          </h4>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <div>
            <div className="text-[10px] uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
              {localize('com_ui_project_meta_ads_original')}
            </div>
            <div className="mt-1 truncate text-sm font-medium text-slate-950 dark:text-white">
              {draft.entityName ?? draft.entityId}
            </div>
          </div>
          <label className="block">
            <span className="text-[10px] uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
              {localize('com_ui_project_meta_ads_duplicate_name')}
            </span>
            <input
              value={targetName}
              onChange={(event) => onTargetNameChange(event.target.value)}
              className={buttons.inputClassName}
            />
          </label>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className={chrome.modalTileClassName}>
              <div className="uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                {localize('com_ui_project_meta_ads_status')}
              </div>
              <div className="mt-2 font-mono text-slate-950 dark:text-white">
                {draft.status || '-'}
              </div>
            </div>
            <div className={chrome.modalTileClassName}>
              <div className="uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                {localize('com_ui_project_meta_ads_budget_defined')}
              </div>
              <div className="mt-2 font-mono text-slate-950 dark:text-white">
                {formatMoney(draft.budget, currency)}
              </div>
            </div>
          </div>
          {draft.status?.toUpperCase() === 'ACTIVE' && (
            <div className="rounded-2xl border border-amber-300/35 bg-amber-300/10 p-3 text-xs leading-5 text-amber-800 dark:text-amber-100">
              {localize('com_ui_project_meta_ads_duplicate_active_warning')}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200/75 p-4 dark:border-white/10">
          <button type="button" onClick={onClose} className={buttons.ghostClassName}>
            {localize('com_ui_cancel')}
          </button>
          <button
            type="button"
            disabled={saving || !targetName.trim()}
            onClick={onConfirm}
            className={buttons.primaryClassName}
          >
            {localize('com_ui_project_meta_ads_duplicate_confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}

export function MetaAdsDiscardDraftDialog({
  open,
  summary,
  localize,
  onCancel,
  onConfirm,
  chrome,
  buttons,
}: {
  open: boolean;
  summary: MetaAdsDraftSummaryItem[];
  localize: Localize;
  onCancel: () => void;
  onConfirm: (selectedKeys: MetaAdsDraftSectionKey[]) => void;
  chrome: ConfirmationChrome;
  buttons: Pick<ConfirmationButtons, 'primaryClassName' | 'ghostClassName'>;
}) {
  const allKeySignature = useMemo(() => summary.map((item) => item.key).join('|'), [summary]);
  const allKeys = useMemo(
    () => (allKeySignature ? (allKeySignature.split('|') as MetaAdsDraftSectionKey[]) : []),
    [allKeySignature],
  );
  const [selectedKeys, setSelectedKeys] = useState<MetaAdsDraftSectionKey[]>(allKeys);
  const [expandedKeys, setExpandedKeys] = useState<MetaAdsDraftSectionKey[]>([]);
  const selectedKeySet = useMemo(() => new Set(selectedKeys), [selectedKeys]);
  const expandedKeySet = useMemo(() => new Set(expandedKeys), [expandedKeys]);
  const allSelected = allKeys.length > 0 && selectedKeys.length === allKeys.length;
  const canConfirm = summary.length === 0 || selectedKeys.length > 0;

  useEffect(() => {
    if (open) {
      setSelectedKeys(allKeys);
      setExpandedKeys([]);
    }
  }, [allKeys, open]);

  if (!open) {
    return null;
  }

  const toggleSection = (key: MetaAdsDraftSectionKey, checked: boolean) => {
    setSelectedKeys((current) =>
      checked
        ? Array.from(new Set([...current, key]))
        : current.filter((currentKey) => currentKey !== key),
    );
  };

  const toggleAll = (checked: boolean) => {
    setSelectedKeys(checked ? allKeys : []);
  };

  const toggleDetails = (key: MetaAdsDraftSectionKey) => {
    setExpandedKeys((current) =>
      current.includes(key)
        ? current.filter((currentKey) => currentKey !== key)
        : [...current, key],
    );
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="meta-ads-discard-draft-title"
      className={`${chrome.modalOverlayClassName} flex items-center justify-center p-4`}
    >
      <div className={`${chrome.drawerShellClassName} max-h-[80vh] max-w-md`}>
        <div className={chrome.modalHeaderClassName}>
          <h4
            id="meta-ads-discard-draft-title"
            className="text-base font-semibold text-slate-950 dark:text-white"
          >
            {localize('com_ui_project_meta_ads_discard_draft_confirm')}
          </h4>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-300">
            {localize('com_ui_project_meta_ads_discard_draft_modal_intro')}
          </p>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <label className="flex items-center justify-between gap-3 rounded-xl border border-slate-200/80 bg-white/85 px-3 py-2 text-sm font-semibold text-slate-900 transition hover:border-red-300/60 dark:border-white/10 dark:bg-white/[0.07] dark:text-white">
            <span>{localize('com_ui_project_meta_ads_discard_select_all')}</span>
            <input
              type="checkbox"
              checked={allSelected}
              onChange={(event) => toggleAll(event.target.checked)}
              className="h-4 w-4 accent-red-600"
            />
          </label>
          <div className="mt-4 text-[10px] uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
            {localize('com_ui_project_meta_ads_pending_changes_summary')}
          </div>
          <ul className="mt-3 space-y-2">
            {summary.map((item) => (
              <li key={item.key}>
                <div
                  className={`rounded-xl border px-3 py-2 text-sm font-medium transition ${
                    selectedKeySet.has(item.key)
                      ? 'border-red-300/50 bg-red-50/80 text-red-800 dark:border-red-300/20 dark:bg-red-400/10 dark:text-red-100'
                      : 'border-slate-200/80 bg-white/70 text-slate-700 dark:border-white/10 dark:bg-white/[0.045] dark:text-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <label className="flex min-w-0 flex-1 items-center gap-3">
                      <input
                        type="checkbox"
                        checked={selectedKeySet.has(item.key)}
                        onChange={(event) => toggleSection(item.key, event.target.checked)}
                        className="h-4 w-4 shrink-0 accent-red-600"
                      />
                      <span className="min-w-0 truncate">{item.label}</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => toggleDetails(item.key)}
                      className="border-current/15 shrink-0 rounded-lg border px-2 py-1 text-[11px] font-semibold transition hover:bg-white/55 active:translate-y-px dark:hover:bg-white/10"
                    >
                      <span>
                        {localize(
                          expandedKeySet.has(item.key)
                            ? 'com_ui_project_meta_ads_discard_hide_changes'
                            : 'com_ui_project_meta_ads_discard_show_changes',
                        )}
                      </span>{' '}
                      <span className="font-mono">({item.details.length})</span>
                    </button>
                  </div>
                  {expandedKeySet.has(item.key) && (
                    <div className="border-current/10 mt-3 space-y-2 border-t pt-3">
                      {item.details.length > 0 ? (
                        item.details.map((detail) => (
                          <div
                            key={detail.key}
                            className="border-current/10 rounded-lg border bg-white/45 p-2 dark:bg-white/[0.035]"
                          >
                            <div className="text-xs font-semibold">{detail.label}</div>
                            <div className="mt-2 grid gap-2 text-[11px] sm:grid-cols-2">
                              <div>
                                <div className="uppercase tracking-[0.12em] opacity-60">
                                  {localize('com_ui_project_meta_ads_discard_saved_value')}
                                </div>
                                <div className="mt-1 break-words font-mono">
                                  {detail.savedValue}
                                </div>
                              </div>
                              <div>
                                <div className="uppercase tracking-[0.12em] opacity-60">
                                  {localize('com_ui_project_meta_ads_discard_pending_value')}
                                </div>
                                <div className="mt-1 break-words font-mono">
                                  {detail.draftValue}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-xs opacity-75">
                          {localize('com_ui_project_meta_ads_discard_no_detail')}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </li>
            ))}
            {summary.length === 0 && (
              <li className="rounded-xl border border-slate-200/80 bg-white/80 px-3 py-2 text-sm font-medium text-slate-800 dark:border-white/10 dark:bg-white/[0.055] dark:text-slate-100">
                {localize('com_ui_project_meta_ads_pending_changes_empty')}
              </li>
            )}
          </ul>
          {summary.length > 0 && selectedKeys.length === 0 && (
            <p className="mt-3 text-xs font-medium text-red-600 dark:text-red-300">
              {localize('com_ui_project_meta_ads_discard_select_hint')}
            </p>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200/75 p-4 dark:border-white/10">
          <button type="button" onClick={onCancel} className={buttons.ghostClassName}>
            {localize('com_ui_cancel')}
          </button>
          <button
            type="button"
            disabled={!canConfirm}
            onClick={() => onConfirm(selectedKeys)}
            className={buttons.primaryClassName}
          >
            {localize('com_ui_project_meta_ads_discard_selected')}
          </button>
        </div>
      </div>
    </div>
  );
}
