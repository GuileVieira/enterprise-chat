import type { ProjectMetaAdsRuleChange } from 'librechat-data-provider';

import type { Localize } from './types';

function formatRuleChangeDate(value?: string): string {
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

function formatChangedFields(fields: string[], localize: Localize): string {
  if (fields.length === 0) {
    return '-';
  }
  return fields
    .map((field) =>
      localize(`com_ui_project_meta_ads_rule_change_${field}` as Parameters<typeof localize>[0]),
    )
    .join(', ');
}

export function MetaAdsRuleHistoryPanel({
  changes,
  fetching,
  localize,
}: {
  changes: ProjectMetaAdsRuleChange[];
  fetching: boolean;
  localize: Localize;
}) {
  return (
    <div className="border-t border-slate-200/70 bg-white/35 p-4 dark:border-white/10 dark:bg-slate-950/10">
      <div className="mb-3">
        <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
          {localize('com_ui_project_meta_ads_rule_history')}
        </h4>
        <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
          {localize('com_ui_project_meta_ads_rule_history_hint')}
        </p>
      </div>
      <div className="space-y-2">
        {fetching && changes.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 py-5 text-center text-sm text-slate-500 dark:border-white/15 dark:text-slate-400">
            {localize('com_ui_project_meta_ads_loading')}
          </div>
        ) : changes.length > 0 ? (
          changes.slice(0, 12).map((change) => (
            <div
              key={change._id ?? change.createdAt}
              className="grid gap-2 rounded-2xl border border-slate-200/80 bg-white/80 p-3 text-xs text-slate-600 dark:border-white/10 dark:bg-white/[0.045] dark:text-slate-300 md:grid-cols-[160px_1fr_120px]"
            >
              <div className="font-mono">{formatRuleChangeDate(change.createdAt)}</div>
              <div className="font-medium text-slate-900 dark:text-white">
                {formatChangedFields(change.changedFields ?? [], localize)}
              </div>
              <div className="text-right">{change.actor ?? '-'}</div>
            </div>
          ))
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 py-5 text-center text-sm text-slate-500 dark:border-white/15 dark:text-slate-400">
            {localize('com_ui_project_meta_ads_rule_history_empty')}
          </div>
        )}
      </div>
    </div>
  );
}
