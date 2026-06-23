import { PencilSimple } from '@phosphor-icons/react';
import type { TranslationKeys } from '~/hooks';

import { formatMetric, formatMoney, getResultTypeLabel } from './formatters';
import type { Localize, SummaryResultTypeOption } from './types';

export type MetaAdsSummaryCardItem = {
  labelKey: TranslationKeys;
  value: string;
  tone: string;
  context?: string;
  clickable?: boolean;
};

function renderSummaryValue({
  value,
  initialLoading,
  showResultMetricCta,
  localize,
}: {
  value: string;
  initialLoading: boolean;
  showResultMetricCta: boolean;
  localize: Localize;
}) {
  if (initialLoading) {
    return (
      <div
        data-testid="meta-ads-summary-skeleton"
        className="mt-4 h-8 w-28 animate-pulse rounded-lg bg-slate-200/80 dark:bg-white/10"
      />
    );
  }

  if (showResultMetricCta) {
    return (
      <div className="mt-4 rounded-xl border border-dashed border-teal-300/45 bg-teal-300/10 px-3 py-3 text-sm font-semibold text-teal-800 transition group-hover:border-teal-300/75 group-hover:bg-teal-300/15 dark:text-teal-100">
        {localize('com_ui_project_meta_ads_click_to_choose_result_metric')}
      </div>
    );
  }

  return (
    <div className="mt-4 font-mono text-3xl font-semibold tabular-nums tracking-tight text-slate-950 dark:text-white">
      {value}
    </div>
  );
}

export function MetaAdsSummaryCards({
  cards,
  resultTypeOptions,
  selectorOpen,
  selectedResultType,
  initialLoading,
  currency,
  localize,
  onOpenSelector,
  onCloseSelector,
  onSelectResultType,
  onClearResultType,
  chrome,
  buttons,
}: {
  cards: MetaAdsSummaryCardItem[];
  resultTypeOptions: SummaryResultTypeOption[];
  selectorOpen: boolean;
  selectedResultType: string | null;
  initialLoading: boolean;
  currency: string;
  localize: Localize;
  onOpenSelector: () => void;
  onCloseSelector: () => void;
  onSelectResultType: (resultType: string) => void;
  onClearResultType: () => void;
  chrome: {
    modalOverlayClassName: string;
    modalShellClassName: string;
  };
  buttons: {
    buttonClassName: string;
    ghostButtonClassName: string;
  };
}) {
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(({ labelKey, value, tone, context, clickable }) => {
          const showResultMetricCta = Boolean(clickable && !initialLoading && value.trim() === '-');
          const content = (
            <>
              <div className="flex items-start justify-between gap-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                  {localize(labelKey)}
                </div>
                {clickable && (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-teal-300/35 bg-teal-300/10 px-2 py-1 text-[10px] font-semibold text-teal-700 opacity-90 transition group-hover:border-teal-300/70 group-hover:bg-teal-300/15 dark:text-teal-200">
                    <PencilSimple size={11} weight="bold" />
                    {localize('com_ui_project_meta_ads_change_result_metric')}
                  </span>
                )}
              </div>
              {renderSummaryValue({ value, initialLoading, showResultMetricCta, localize })}
              {context && !initialLoading && (
                <div className="mt-2 truncate text-xs font-medium text-slate-500 dark:text-slate-400">
                  {context}
                </div>
              )}
            </>
          );
          const className = `group relative overflow-hidden rounded-2xl border border-l-4 border-slate-200/80 ${tone} bg-white/82 p-5 text-left shadow-[0_16px_42px_-36px_rgba(15,23,42,0.48)] transition duration-300 dark:border-white/10 dark:bg-white/[0.055] dark:shadow-[0_16px_46px_-38px_rgba(0,0,0,0.92)]`;
          return clickable ? (
            <button
              key={labelKey}
              type="button"
              data-testid={`meta-ads-summary-card-${labelKey}`}
              disabled={initialLoading}
              onClick={onOpenSelector}
              className={`${className} hover:-translate-y-0.5 hover:border-teal-300/60 hover:shadow-[0_22px_54px_-40px_rgba(20,184,166,0.55)] disabled:cursor-wait disabled:opacity-80`}
            >
              {content}
            </button>
          ) : (
            <div
              key={labelKey}
              data-testid={`meta-ads-summary-card-${labelKey}`}
              className={className}
            >
              {content}
            </div>
          );
        })}
      </div>

      {selectorOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="meta-ads-result-type-selector-title"
          className={`${chrome.modalOverlayClassName} flex items-center justify-center`}
        >
          <div
            className={`flex max-h-[82vh] w-full max-w-xl flex-col p-4 ${chrome.modalShellClassName}`}
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-200/75 pb-4 dark:border-white/10">
              <div>
                <h4
                  id="meta-ads-result-type-selector-title"
                  className="text-base font-semibold text-slate-950 dark:text-white"
                >
                  {localize('com_ui_project_meta_ads_choose_result_metric')}
                </h4>
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {localize('com_ui_project_meta_ads_choose_result_metric_hint')}
                </div>
              </div>
              <button
                type="button"
                onClick={onCloseSelector}
                className={buttons.ghostButtonClassName}
              >
                {localize('com_ui_close')}
              </button>
            </div>
            <div className="mt-4 min-h-0 space-y-2 overflow-y-auto pr-1">
              {resultTypeOptions.map((option) => (
                <button
                  key={option.resultType}
                  type="button"
                  onClick={() => onSelectResultType(option.resultType)}
                  className={`w-full rounded-2xl border p-3 text-left transition ${
                    selectedResultType === option.resultType
                      ? 'border-teal-300/70 bg-teal-300/10'
                      : 'border-slate-200/80 bg-white hover:border-teal-300/45 hover:bg-teal-50 dark:border-white/10 dark:bg-[#172033] dark:hover:bg-[#183247]'
                  }`}
                >
                  <div className="truncate text-sm font-semibold text-slate-950 dark:text-white">
                    {getResultTypeLabel(option.resultType, localize)}
                  </div>
                  <div className="mt-2 grid gap-2 text-xs text-slate-500 dark:text-slate-400 sm:grid-cols-3">
                    <span>
                      {localize('com_ui_project_meta_ads_results')}:{' '}
                      {formatMetric(option.totalResults)}
                    </span>
                    <span>
                      {localize('com_ui_project_meta_ads_spend')}:{' '}
                      {formatMoney(option.totalSpend, currency)}
                    </span>
                    <span>
                      {localize('com_ui_project_meta_ads_average_cost')}:{' '}
                      {formatMoney(option.averageCostPerResult, currency)}
                    </span>
                  </div>
                </button>
              ))}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={onClearResultType}
                className={buttons.ghostButtonClassName}
              >
                {localize('com_ui_project_meta_ads_clear_result_metric')}
              </button>
              <button type="button" onClick={onCloseSelector} className={buttons.buttonClassName}>
                {localize('com_ui_cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
