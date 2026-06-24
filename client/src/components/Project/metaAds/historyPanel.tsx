import type { ProjectMetaAdsBudgetChange } from 'librechat-data-provider';

import { formatMoney, formatSignedMoney, formatSignedPercent } from './formatters';
import { getBudgetChangeDelta } from './table';
import type { Localize } from './types';

function formatChangeDateTime(value?: string): string {
  if (!value) {
    return '-';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '-';
  }
  const parts = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.day}/${values.month}/${values.year} ${values.hour}:${values.minute}`;
}

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
          <>
            <div className="hidden grid-cols-[minmax(0,1.7fr)_140px_90px_minmax(0,1fr)_160px_130px] gap-3 px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400 lg:grid">
              <div>{localize('com_ui_project_meta_ads_name')}</div>
              <div>{localize('com_ui_date')}</div>
              <div>{localize('com_ui_project_meta_ads_actor')}</div>
              <div>{localize('com_ui_project_meta_ads_reason')}</div>
              <div className="text-right">{localize('com_ui_project_meta_ads_budget')}</div>
              <div className="text-right">{localize('com_ui_project_meta_ads_budget_delta')}</div>
            </div>
            {changes.slice(0, 8).map((change) => {
              const delta = getBudgetChangeDelta(change);
              const entityName = change.entityName ?? change.entityId;
              return (
                <div
                  key={change._id ?? `${change.entityId}-${change.createdAt}`}
                  className="grid gap-2 rounded-2xl border border-slate-200/80 bg-slate-50 p-3 text-sm dark:border-white/10 dark:bg-[#121a2b] lg:grid-cols-[minmax(0,1.7fr)_140px_90px_minmax(0,1fr)_160px_130px] lg:items-center lg:gap-3"
                >
                  <div className="min-w-0">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400 lg:hidden">
                      {localize('com_ui_project_meta_ads_name')}
                    </div>
                    <div
                      className="truncate font-medium text-slate-950 dark:text-white"
                      title={entityName}
                    >
                      {entityName}
                    </div>
                  </div>
                  <div className="min-w-0">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400 lg:hidden">
                      {localize('com_ui_date')}
                    </div>
                    <div className="font-mono text-xs text-slate-600 dark:text-slate-300">
                      {formatChangeDateTime(change.createdAt)}
                    </div>
                  </div>
                  <div className="min-w-0">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400 lg:hidden">
                      {localize('com_ui_project_meta_ads_actor')}
                    </div>
                    <div className="truncate text-xs text-slate-500 dark:text-slate-400">
                      {change.actor ?? '-'}
                    </div>
                  </div>
                  <div className="min-w-0">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400 lg:hidden">
                      {localize('com_ui_project_meta_ads_reason')}
                    </div>
                    <div className="truncate text-xs text-slate-500 dark:text-slate-400">
                      {change.reason ?? '-'}
                    </div>
                  </div>
                  <div className="font-mono text-xs text-slate-600 dark:text-slate-300 lg:text-right">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400 lg:hidden">
                      {localize('com_ui_project_meta_ads_budget')}
                    </div>
                    {formatMoney(change.previousDailyBudget, currency)}
                    {' -> '}
                    {formatMoney(change.newDailyBudget, currency)}
                  </div>
                  <div className="font-mono text-[11px] text-slate-500 dark:text-slate-400 lg:text-right">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400 lg:hidden">
                      {localize('com_ui_project_meta_ads_budget_delta')}
                    </div>
                    {delta.deltaDailyBudget != null
                      ? `${formatSignedMoney(
                          delta.deltaDailyBudget,
                          currency,
                        )} · ${formatSignedPercent(delta.deltaPercent)}`
                      : '-'}
                  </div>
                </div>
              );
            })}
          </>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 py-6 text-center text-sm text-slate-500 dark:border-white/15 dark:text-slate-400">
            {localize('com_ui_project_meta_ads_no_history')}
          </div>
        )}
      </div>
    </div>
  );
}
