import { useEffect, useMemo, useState } from 'react';
import { ArrowClockwise, Check, Clock, WarningCircle, X } from '@phosphor-icons/react';
import type { ProjectTrafficDiaryEntry } from 'librechat-data-provider';
import {
  useProjectMetaAdsDiaryQuery,
  useReprocessProjectMetaAdsDiaryMutation,
} from '~/data-provider';
import { useLocalize } from '~/hooks';

interface ProjectDiaryFilesProps {
  projectId: string;
  canEdit: boolean;
}

export default function ProjectDiaryFiles({ projectId, canEdit }: ProjectDiaryFilesProps) {
  const localize = useLocalize();
  const managerQuery = useProjectMetaAdsDiaryQuery(projectId, 'manager', 'project');
  const strategistQuery = useProjectMetaAdsDiaryQuery(projectId, 'strategist', 'project');
  const reprocess = useReprocessProjectMetaAdsDiaryMutation();
  const [selected, setSelected] = useState<ProjectTrafficDiaryEntry | null>(null);
  const entries = useMemo(
    () =>
      [...(managerQuery.data?.entries ?? []), ...(strategistQuery.data?.entries ?? [])].sort(
        (a, b) => b.date.localeCompare(a.date),
      ),
    [managerQuery.data?.entries, strategistQuery.data?.entries],
  );

  useEffect(() => {
    const entryId = new URLSearchParams(window.location.search).get('diary');
    if (entryId) {
      setSelected(entries.find((entry) => entry._id === entryId) ?? null);
    }
  }, [entries]);

  const status = (entry: ProjectTrafficDiaryEntry) => {
    if (entry.indexStatus === 'failed') {
      return {
        icon: WarningCircle,
        className: 'text-red-600 dark:text-red-400',
        label: localize('com_ui_project_diary_index_failed'),
      };
    }
    if (entry.indexStatus === 'indexed') {
      return {
        icon: Check,
        className: 'text-green-600 dark:text-green-500',
        label: localize('com_ui_indexed'),
      };
    }
    return {
      icon: Clock,
      className: 'text-amber-600 dark:text-amber-400',
      label: localize('com_ui_project_diary_index_pending'),
    };
  };

  if (managerQuery.isLoading || strategistQuery.isLoading) {
    return <div className="h-20 animate-pulse rounded-xl bg-surface-secondary" />;
  }
  if (entries.length === 0) {
    return null;
  }

  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold text-text-primary">
        {localize('com_ui_project_diaries')}
      </h3>
      <div className="space-y-2 rounded-2xl border border-border-light bg-surface-secondary p-2">
        {entries.map((entry) => {
          const index = status(entry);
          const StatusIcon = index.icon;
          const author =
            entry.createdBy?.name ||
            entry.createdBy?.email ||
            entry.lastEditedBy?.name ||
            entry.lastEditedBy?.email ||
            '-';
          return (
            <button
              key={entry._id}
              type="button"
              onClick={() => setSelected(entry)}
              className="flex w-full items-center justify-between gap-3 rounded-xl p-3 text-left transition-colors hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-primary"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-text-primary">
                  {localize(
                    entry.kind === 'strategist'
                      ? 'com_ui_project_meta_ads_strategy_diary_title'
                      : 'com_ui_project_meta_ads_diary_title',
                  )}
                </p>
                <p className="mt-1 text-xs text-text-secondary">
                  {entry.date} · {author}
                </p>
              </div>
              <span className={`flex shrink-0 items-center gap-1 text-xs ${index.className}`}>
                <StatusIcon className="h-3.5 w-3.5" aria-hidden="true" />
                {index.label}
              </span>
            </button>
          );
        })}
      </div>

      {selected && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={localize('com_ui_project_diary_content')}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        >
          <div className="max-h-[85vh] w-full max-w-2xl overflow-auto rounded-2xl bg-surface-primary p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-text-primary">
                  {localize(
                    selected.kind === 'strategist'
                      ? 'com_ui_project_meta_ads_strategy_diary_title'
                      : 'com_ui_project_meta_ads_diary_title',
                  )}
                </h3>
                <p className="mt-1 text-sm text-text-secondary">
                  {selected.date} · {selected.createdBy.name || selected.createdBy.email || '-'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                aria-label={localize('com_ui_close')}
                className="rounded-lg p-2 text-text-secondary hover:bg-surface-hover"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-5 space-y-4">
              {selected.answers
                .filter((answer) => answer.answer)
                .map((answer) => (
                  <div key={answer.id}>
                    <p className="text-sm font-medium text-text-primary">{answer.question}</p>
                    <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-text-secondary">
                      {answer.answer}
                    </p>
                  </div>
                ))}
            </div>
            {selected.indexStatus === 'failed' && canEdit && (
              <button
                type="button"
                disabled={reprocess.isLoading}
                onClick={() =>
                  reprocess.mutate(
                    { projectId, entryId: selected._id, kind: selected.kind },
                    { onSuccess: setSelected },
                  )
                }
                className="mt-5 flex items-center gap-2 rounded-xl bg-text-primary px-4 py-2 text-sm font-medium text-surface-primary disabled:opacity-50"
              >
                <ArrowClockwise className="h-4 w-4" />
                {localize('com_ui_project_diary_reprocess')}
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
