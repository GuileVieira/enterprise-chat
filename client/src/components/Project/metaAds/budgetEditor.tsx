import { buildBudgetReferences } from './table';
import { formatMoney } from './formatters';
import type { BudgetEditor, Localize } from './types';

type BudgetEditorChrome = {
  modalOverlayClassName: string;
  modalShellClassName: string;
  modalTileClassName: string;
};

type BudgetEditorControls = {
  inputClassName: string;
  primaryButtonClassName: string;
  ghostButtonClassName: string;
};

export function MetaAdsBudgetEditorDialog({
  editor,
  dailyBudget,
  currency,
  saving,
  localize,
  onDailyBudgetChange,
  onClose,
  onSave,
  chrome,
  controls,
}: {
  editor: BudgetEditor | null;
  dailyBudget: string;
  currency: string;
  saving: boolean;
  localize: Localize;
  onDailyBudgetChange: (value: string) => void;
  onClose: () => void;
  onSave: () => void;
  chrome: BudgetEditorChrome;
  controls: BudgetEditorControls;
}) {
  if (!editor) {
    return null;
  }

  const references = buildBudgetReferences(editor.currentBudget, currency);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="meta-ads-budget-dialog-title"
      className={`${chrome.modalOverlayClassName} flex items-center justify-center`}
    >
      <div className={`relative w-full max-w-2xl p-5 sm:p-6 ${chrome.modalShellClassName}`}>
        <div className="relative min-w-0">
          <h4
            id="meta-ads-budget-dialog-title"
            className="text-2xl font-semibold leading-tight tracking-tight text-slate-950 dark:text-white"
          >
            {localize('com_ui_project_meta_ads_edit_budget')}
          </h4>
          <div className="mt-4 truncate text-lg font-semibold text-slate-950 dark:text-white">
            {editor.entityName ?? editor.entityId}
          </div>
          <div className="mt-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
            {editor.entityLevel === 'campaign'
              ? localize('com_ui_project_meta_ads_campaign')
              : localize('com_ui_project_meta_ads_select_ad_set')}
          </div>
          <div className="mt-4 max-w-[56ch] text-sm leading-6 text-slate-600 dark:text-slate-300">
            {localize('com_ui_project_meta_ads_manual_budget_hint')}
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-[0.9fr_1.1fr]">
            <div className={chrome.modalTileClassName}>
              <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                {localize('com_ui_project_meta_ads_budget_defined')}
              </div>
              <div className="mt-2 font-mono text-2xl font-semibold tabular-nums text-slate-950 dark:text-white">
                {formatMoney(editor.currentBudget, currency)}
              </div>
            </div>
            <label className="rounded-2xl border border-amber-300/35 bg-amber-300/10 p-4 text-xs text-slate-600 dark:text-slate-300">
              <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-700 dark:text-amber-200">
                {localize('com_ui_project_meta_ads_new_budget')}
              </span>
              <input
                type="text"
                inputMode="decimal"
                value={dailyBudget}
                onChange={(event) => onDailyBudgetChange(event.target.value)}
                className={controls.inputClassName}
              />
            </label>
          </div>

          {references.length > 0 && (
            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between gap-3">
                <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                  {localize('com_ui_project_meta_ads_budget_quick_adjustments')}
                </div>
                <div className="h-px flex-1 bg-slate-200/75 dark:bg-white/10" />
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {references.map((reference) => (
                  <button
                    key={reference.percent}
                    type="button"
                    aria-label={reference.accessibleLabel}
                    onClick={() =>
                      onDailyBudgetChange(reference.value.toFixed(2).replace('.', ','))
                    }
                    className={`group flex min-h-16 items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left shadow-[0_14px_34px_-30px_rgba(15,23,42,0.45)] transition duration-200 hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-amber-300/25 active:translate-y-0 ${reference.tone}`}
                  >
                    <span className="text-sm font-semibold">{reference.label}</span>
                    <span className="font-mono text-sm font-semibold tabular-nums text-[#f8f1e5]">
                      {reference.formattedValue}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="relative mt-6 flex justify-end gap-2">
          <button type="button" onClick={onClose} className={controls.ghostButtonClassName}>
            {localize('com_ui_cancel')}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={onSave}
            className={controls.primaryButtonClassName}
          >
            {localize('com_ui_project_meta_ads_save_budget')}
          </button>
        </div>
      </div>
    </div>
  );
}
