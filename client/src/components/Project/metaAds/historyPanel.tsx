import { Minus, TrendingDown, TrendingUp } from 'lucide-react';
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

function TruncatedHoverText({ value, className }: { value: string; className: string }) {
  return (
    <span className="group relative block min-w-0" tabIndex={0}>
      <span className={className} title={value}>
        {value}
      </span>
      <span className="pointer-events-none absolute left-0 top-full z-30 mt-2 hidden max-w-[min(560px,80vw)] rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-xs font-medium leading-5 text-slate-900 shadow-[0_18px_48px_-28px_rgba(15,23,42,0.65)] group-hover:block group-focus:block dark:border-white/10 dark:bg-[#0f1728] dark:text-white">
        {value}
      </span>
    </span>
  );
}

function getBudgetChangeVisual(deltaDailyBudget?: number | null) {
  if (deltaDailyBudget == null || Number.isNaN(deltaDailyBudget) || deltaDailyBudget === 0) {
    return {
      Icon: Minus,
      labelKey: 'com_ui_project_meta_ads_budget_unchanged',
      rowClassName: 'border-slate-200/80 bg-slate-50 dark:border-white/10 dark:bg-[#121a2b]',
      badgeClassName:
        'border-slate-300/80 bg-slate-100 text-slate-600 dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-300',
      valueClassName: 'text-slate-500 dark:text-slate-400',
      budgetClassName: 'text-slate-600 dark:text-slate-300',
    };
  }
  if (deltaDailyBudget > 0) {
    return {
      Icon: TrendingUp,
      labelKey: 'com_ui_project_meta_ads_budget_increased',
      rowClassName:
        'border-emerald-300/45 bg-emerald-50/75 dark:border-emerald-300/20 dark:bg-emerald-300/[0.08]',
      badgeClassName:
        'border-emerald-300/70 bg-emerald-100 text-emerald-800 dark:border-emerald-300/25 dark:bg-emerald-300/15 dark:text-emerald-200',
      valueClassName: 'text-emerald-700 dark:text-emerald-200',
      budgetClassName: 'text-emerald-900 dark:text-emerald-100',
    };
  }
  return {
    Icon: TrendingDown,
    labelKey: 'com_ui_project_meta_ads_budget_decreased',
    rowClassName:
      'border-rose-300/45 bg-rose-50/75 dark:border-rose-300/20 dark:bg-rose-300/[0.08]',
    badgeClassName:
      'border-rose-300/70 bg-rose-100 text-rose-800 dark:border-rose-300/25 dark:bg-rose-300/15 dark:text-rose-200',
    valueClassName: 'text-rose-700 dark:text-rose-200',
    budgetClassName: 'text-rose-900 dark:text-rose-100',
  };
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
            <div className="hidden grid-cols-[minmax(220px,1.4fr)_150px_90px_minmax(180px,1fr)_minmax(190px,0.7fr)_minmax(150px,0.55fr)] gap-4 px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400 xl:grid">
              <div>{localize('com_ui_project_meta_ads_name')}</div>
              <div>{localize('com_ui_date')}</div>
              <div>{localize('com_ui_project_meta_ads_actor')}</div>
              <div>{localize('com_ui_project_meta_ads_reason')}</div>
              <div className="text-right">{localize('com_ui_project_meta_ads_budget')}</div>
              <div className="text-right">{localize('com_ui_project_meta_ads_budget_delta')}</div>
            </div>
            {changes.slice(0, 8).map((change) => {
              const delta = getBudgetChangeDelta(change);
              const visual = getBudgetChangeVisual(delta.deltaDailyBudget);
              const Icon = visual.Icon;
              const entityName = change.entityName ?? change.entityId;
              const reason = change.reason ?? '-';
              return (
                <div
                  key={change._id ?? `${change.entityId}-${change.createdAt}`}
                  className={`grid gap-3 rounded-2xl border p-3 text-sm ${visual.rowClassName} md:grid-cols-2 xl:grid-cols-[minmax(220px,1.4fr)_150px_90px_minmax(180px,1fr)_minmax(190px,0.7fr)_minmax(150px,0.55fr)] xl:items-center xl:gap-4`}
                >
                  <div className="min-w-0">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400 xl:hidden">
                      {localize('com_ui_project_meta_ads_name')}
                    </div>
                    <TruncatedHoverText
                      value={entityName}
                      className="block truncate font-medium text-slate-950 dark:text-white"
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400 xl:hidden">
                      {localize('com_ui_date')}
                    </div>
                    <div className="font-mono text-xs text-slate-600 dark:text-slate-300">
                      {formatChangeDateTime(change.createdAt)}
                    </div>
                  </div>
                  <div className="min-w-0">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400 xl:hidden">
                      {localize('com_ui_project_meta_ads_actor')}
                    </div>
                    <div className="truncate text-xs text-slate-500 dark:text-slate-400">
                      {change.actor ?? '-'}
                    </div>
                  </div>
                  <div className="min-w-0">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400 xl:hidden">
                      {localize('com_ui_project_meta_ads_reason')}
                    </div>
                    <TruncatedHoverText
                      value={reason}
                      className="block truncate text-xs text-slate-500 dark:text-slate-400"
                    />
                  </div>
                  <div className={`font-mono text-xs ${visual.budgetClassName} xl:text-right`}>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400 xl:hidden">
                      {localize('com_ui_project_meta_ads_budget')}
                    </div>
                    <span>{formatMoney(change.previousDailyBudget, currency)}</span>
                    <span className="mx-1 text-slate-400 dark:text-slate-500">→</span>
                    <span className="font-semibold">
                      {formatMoney(change.newDailyBudget, currency)}
                    </span>
                  </div>
                  <div className={`font-mono text-[11px] ${visual.valueClassName} xl:text-right`}>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400 xl:hidden">
                      {localize('com_ui_project_meta_ads_budget_delta')}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 xl:flex-col xl:items-end xl:gap-1">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 font-sans text-[10px] font-semibold uppercase tracking-[0.08em] ${visual.badgeClassName}`}
                      >
                        <Icon className="h-3 w-3" aria-hidden="true" />
                        {localize(visual.labelKey as Parameters<typeof localize>[0])}
                      </span>
                      <span className="font-semibold">
                        {delta.deltaDailyBudget != null
                          ? `${formatSignedMoney(
                              delta.deltaDailyBudget,
                              currency,
                            )} · ${formatSignedPercent(delta.deltaPercent)}`
                          : '-'}
                      </span>
                    </div>
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
