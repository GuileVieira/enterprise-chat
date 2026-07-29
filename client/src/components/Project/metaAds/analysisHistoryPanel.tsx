import { CheckCircle2, MinusCircle, XCircle } from 'lucide-react';
import type { ProjectMetaAdsAutomationRun } from 'librechat-data-provider';

import type { Localize } from './types';

function formatRunDateTime(value?: string): string {
  if (!value) {
    return '-';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '-';
  }
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

function TruncatedHoverText({ value, className }: { value: string; className: string }) {
  return (
    <span className="group relative block min-w-0" tabIndex={0}>
      <span className={className}>{value}</span>
      <span className="pointer-events-none absolute left-0 top-full z-30 mt-2 hidden max-w-[min(560px,80vw)] rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-xs font-medium leading-5 text-slate-900 shadow-[0_18px_48px_-28px_rgba(15,23,42,0.65)] group-hover:block group-focus:block dark:border-white/10 dark:bg-[#0f1728] dark:text-white">
        {value}
      </span>
    </span>
  );
}

function getRunVisual(outcome: ProjectMetaAdsAutomationRun['outcome']) {
  if (outcome === 'failed') {
    return {
      Icon: XCircle,
      className:
        'border-rose-300/70 bg-rose-50 text-rose-800 dark:border-rose-300/25 dark:bg-rose-300/10 dark:text-rose-200',
    };
  }
  if (outcome === 'applied' || outcome === 'recommended') {
    return {
      Icon: CheckCircle2,
      className:
        'border-emerald-300/70 bg-emerald-50 text-emerald-800 dark:border-emerald-300/25 dark:bg-emerald-300/10 dark:text-emerald-200',
    };
  }
  return {
    Icon: MinusCircle,
    className:
      'border-slate-300/80 bg-slate-100 text-slate-700 dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-200',
  };
}

export function MetaAdsAnalysisHistoryPanel({
  runs,
  localize,
}: {
  runs: ProjectMetaAdsAutomationRun[];
  localize: Localize;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_18px_58px_-46px_rgba(15,23,42,0.42)] dark:border-white/10 dark:bg-[#172033]">
      <div className="border-b border-slate-200/70 bg-slate-50 px-4 py-3 dark:border-white/10 dark:bg-[#121a2b]">
        <h4 className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
          {localize('com_ui_project_meta_ads_analysis_history')}
        </h4>
      </div>
      <div className="max-h-[360px] space-y-2 overflow-y-auto p-4 pr-3">
        {runs.length > 0 ? (
          runs.slice(0, 8).map((run) => {
            const { Icon, className } = getRunVisual(run.outcome);
            const reason = run.errorMessage || run.reasonSamples?.[0] || '-';
            const recommendations = run.recommendations?.slice(0, 3) ?? [];
            return (
              <div
                key={run._id ?? `${run.projectId}-${run.startedAt}`}
                className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-3 text-sm dark:border-white/10 dark:bg-[#121a2b]"
              >
                <div className="grid gap-3 md:grid-cols-[160px_140px_minmax(0,1fr)_150px] md:items-center">
                  <div className="font-mono text-xs text-slate-600 dark:text-slate-300">
                    {formatRunDateTime(run.startedAt)}
                  </div>
                  <span
                    className={`inline-flex w-fit items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] ${className}`}
                  >
                    <Icon className="h-3 w-3" aria-hidden="true" />
                    {localize(
                      `com_ui_project_meta_ads_run_outcome_${run.outcome}` as Parameters<
                        typeof localize
                      >[0],
                    )}
                  </span>
                  <TruncatedHoverText
                    value={reason}
                    className="block truncate text-xs text-slate-600 dark:text-slate-300"
                  />
                  <div className="text-xs text-slate-500 dark:text-slate-400 md:text-right">
                    {run.evaluatedCount ?? 0} {localize('com_ui_project_meta_ads_evaluated_short')}
                    {' · '}
                    {run.holdCount ?? 0} {localize('com_ui_project_meta_ads_held_short')}
                  </div>
                </div>
                {recommendations.length > 0 && (
                  <div className="mt-3 space-y-1 border-t border-slate-200/70 pt-3 dark:border-white/10">
                    {recommendations.map((recommendation) => (
                      <div
                        key={recommendation._id ?? recommendation.entityId}
                        className="grid gap-2 text-xs text-slate-600 dark:text-slate-300 md:grid-cols-[minmax(0,1fr)_90px_minmax(0,1.4fr)]"
                      >
                        <TruncatedHoverText
                          value={recommendation.entityName ?? recommendation.entityId}
                          className="block truncate font-semibold text-slate-900 dark:text-white"
                        />
                        <span>{recommendation.action}</span>
                        <TruncatedHoverText
                          value={recommendation.reason ?? '-'}
                          className="block truncate"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 py-6 text-center text-sm text-slate-500 dark:border-white/15 dark:text-slate-400">
            {localize('com_ui_project_meta_ads_no_analysis_history')}
          </div>
        )}
      </div>
    </div>
  );
}
