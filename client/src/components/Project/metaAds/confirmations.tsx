import { formatMoney } from './formatters';
import type {
  Localize,
  DuplicateDraft,
  BudgetConfirmation,
  MetaAdsDraftSummaryItem,
  EntityStatusConfirmation,
} from './types';

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
  onConfirm: () => void;
  chrome: ConfirmationChrome;
  buttons: Pick<ConfirmationButtons, 'primaryClassName' | 'ghostClassName'>;
}) {
  if (!open) {
    return null;
  }

  const items =
    summary.length > 0
      ? summary
      : [{ key: 'unknown', label: localize('com_ui_project_meta_ads_pending_changes_empty') }];

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
          <div className="text-[10px] uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
            {localize('com_ui_project_meta_ads_pending_changes_summary')}
          </div>
          <ul className="mt-3 space-y-2">
            {items.map((item) => (
              <li
                key={item.key}
                className="rounded-xl border border-slate-200/80 bg-white/80 px-3 py-2 text-sm font-medium text-slate-800 dark:border-white/10 dark:bg-white/[0.055] dark:text-slate-100"
              >
                {item.label}
              </li>
            ))}
          </ul>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200/75 p-4 dark:border-white/10">
          <button type="button" onClick={onCancel} className={buttons.ghostClassName}>
            {localize('com_ui_cancel')}
          </button>
          <button type="button" onClick={onConfirm} className={buttons.primaryClassName}>
            {localize('com_ui_project_meta_ads_discard_draft')}
          </button>
        </div>
      </div>
    </div>
  );
}
