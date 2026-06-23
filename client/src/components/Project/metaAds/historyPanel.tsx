import type { ProjectMetaAdsBudgetChange } from 'librechat-data-provider';

import { formatMoney, formatSignedMoney, formatSignedPercent } from './formatters';
import { getBudgetChangeDelta } from './table';
import type { Localize } from './types';

export function MetaAdsHistoryPanel({
  changes,
  currency,
  localize,
}: {
  changes: ProjectMetaAdsBudgetChange[];
  currency: string;
  localize: Localize;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_18px_58px_-46px_rgba(15,23,42,0.42)] dark:border-white/10 dark:bg-[#172033]">
      <div className="border-b border-slate-200/70 bg-slate-50 px-4 py-3 dark:border-white/10 dark:bg-[#121a2b]">
        <h4 className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
          {localize('com_ui_project_meta_ads_history')}
        </h4>
      </div>
      <div className="space-y-2 p-4">
        {changes.length > 0 ? (
          changes.slice(0, 8).map((change) => {
            const delta = getBudgetChangeDelta(change);
            return (
              <div
                key={change._id ?? `${change.entityId}-${change.createdAt}`}
                className="flex flex-col gap-1 rounded-2xl border border-slate-200/80 bg-slate-50 p-3 text-sm dark:border-white/10 dark:bg-[#121a2b] sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="truncate font-medium text-slate-950 dark:text-white">
                    {change.entityName ?? change.entityId}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {change.actor ?? '-'} · {change.reason ?? '-'}
                  </div>
                </div>
                <div className="text-left sm:text-right">
                  <div className="font-mono text-xs text-slate-600 dark:text-slate-300">
                    {formatMoney(change.previousDailyBudget, currency)}
                    {' -> '}
                    {formatMoney(change.newDailyBudget, currency)}
                  </div>
                  {delta.deltaDailyBudget != null && (
                    <div className="mt-1 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                      {`${formatSignedMoney(
                        delta.deltaDailyBudget,
                        currency,
                      )} · ${formatSignedPercent(delta.deltaPercent)}`}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 py-6 text-center text-sm text-slate-500 dark:border-white/15 dark:text-slate-400">
            {localize('com_ui_project_meta_ads_no_history')}
          </div>
        )}
      </div>
    </div>
  );
}
