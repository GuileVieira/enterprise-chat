import { useEffect, useMemo, useState } from 'react';
import { Plus, Sparkle } from '@phosphor-icons/react';
import {
  useCompleteProjectMetaAdsDiaryMutation,
  useProjectMetaAdsDiaryQuery,
  useReopenProjectMetaAdsDiaryMutation,
  useSaveProjectMetaAdsDiaryMutation,
} from '~/data-provider';
import { useLocalize } from '~/hooks';
import type {
  ProjectTrafficDiaryAnswer,
  ProjectTrafficDiaryEntry,
  TProject,
} from 'librechat-data-provider';

const questionKeys = [
  'measurement',
  'strategy',
  'client_feedback',
  'changes',
  'creative_learning',
  'next_steps',
] as const;

function getWeekStart(date = new Date()) {
  const local = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const offset = (local.getDay() + 6) % 7;
  local.setDate(local.getDate() - offset);
  return local.toISOString().slice(0, 10);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' }).format(
    new Date(`${value}T12:00:00`),
  );
}

function formatDateTime(value?: string) {
  if (!value) {
    return '';
  }
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(value),
  );
}

export function TrafficDiaryWorkspace({
  project,
  canEdit,
  onAnalyze,
}: {
  project: TProject;
  canEdit: boolean;
  onAnalyze: (entry: ProjectTrafficDiaryEntry) => void;
}) {
  const localize = useLocalize();
  const currentWeekStart = getWeekStart();
  const diaryQuery = useProjectMetaAdsDiaryQuery(project.projectId);
  const saveDiary = useSaveProjectMetaAdsDiaryMutation();
  const completeDiary = useCompleteProjectMetaAdsDiaryMutation();
  const reopenDiary = useReopenProjectMetaAdsDiaryMutation();
  const questions = useMemo(
    () =>
      questionKeys.map((id) => ({
        id,
        question: localize(`com_ui_project_meta_ads_diary_question_${id}`),
      })),
    [localize],
  );
  const [weekStart, setWeekStart] = useState(currentWeekStart);
  const [answers, setAnswers] = useState<ProjectTrafficDiaryAnswer[]>(() =>
    questions.map((question) => ({ ...question, answer: '' })),
  );
  const [error, setError] = useState<string | null>(null);
  const entries = diaryQuery.data?.entries ?? [];
  const entry = entries.find((item) => item.weekStart === weekStart);
  const isCompleted = entry?.status === 'completed';

  useEffect(() => {
    setAnswers(
      entry?.answers.length
        ? entry.answers
        : questions.map((question) => ({ ...question, answer: '' })),
    );
    setError(null);
  }, [entry?.answers, entry?.updatedAt, entry?.weekStart, questions]);

  const updateAnswer = (id: string, answer: string) => {
    setAnswers((current) => current.map((item) => (item.id === id ? { ...item, answer } : item)));
  };

  const addQuestion = () => {
    setAnswers((current) => [
      ...current,
      {
        id: `custom_${Date.now()}`,
        question: '',
        answer: '',
        parentQuestionId: 'strategy',
      },
    ]);
  };

  const save = async () => {
    try {
      setError(null);
      const savedAnswers = answers.filter(
        (answer) =>
          !answer.parentQuestionId ||
          answer.question.trim().length > 0 ||
          answer.answer.trim().length > 0,
      );
      await saveDiary.mutateAsync({
        projectId: project.projectId,
        weekStart,
        answers: savedAnswers,
      });
    } catch {
      setError(localize('com_ui_project_meta_ads_diary_save_error'));
    }
  };

  const complete = async () => {
    if (!entry) {
      await save();
      return;
    }
    try {
      setError(null);
      await completeDiary.mutateAsync({ projectId: project.projectId, entryId: entry._id });
    } catch {
      setError(localize('com_ui_project_meta_ads_diary_complete_error'));
    }
  };

  const reopen = async () => {
    if (!entry) {
      return;
    }
    try {
      setError(null);
      await reopenDiary.mutateAsync({ projectId: project.projectId, entryId: entry._id });
    } catch {
      setError(localize('com_ui_project_meta_ads_diary_reopen_error'));
    }
  };

  return (
    <div id="meta-ads-diary-tab-panel" role="tabpanel" className="space-y-5 p-5">
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200/70 bg-white/70 p-4 dark:border-white/10 dark:bg-slate-950/20 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h4 className="text-base font-semibold">
            {localize('com_ui_project_meta_ads_diary_title')}
          </h4>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">
            {localize('com_ui_project_meta_ads_diary_description')}
          </p>
        </div>
        <select
          value={weekStart}
          onChange={(event) => setWeekStart(event.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-white/15 dark:bg-slate-900"
        >
          {[currentWeekStart, ...entries.map((item) => item.weekStart)]
            .filter((value, index, values) => values.indexOf(value) === index)
            .map((value) => (
              <option key={value} value={value}>
                {formatDate(value)}
              </option>
            ))}
        </select>
      </div>

      {error && (
        <div role="alert" className="rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {entries.length > 0 && (
        <section className="space-y-3">
          <h5 className="text-sm font-semibold">
            {localize('com_ui_project_meta_ads_diary_history')}
          </h5>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {entries.map((historyEntry) => {
              const isSelected = historyEntry.weekStart === weekStart;
              const author =
                historyEntry.createdBy.name || localize('com_ui_project_meta_ads_diary_manager');
              return (
                <button
                  key={historyEntry._id}
                  type="button"
                  onClick={() => setWeekStart(historyEntry.weekStart)}
                  className={`rounded-2xl border p-4 text-left transition ${
                    isSelected
                      ? 'border-teal-400 bg-teal-50 dark:border-teal-300/50 dark:bg-teal-300/10'
                      : 'border-slate-200/70 bg-white/70 hover:border-slate-300 dark:border-white/10 dark:bg-slate-950/20'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold">{formatDate(historyEntry.weekStart)}</span>
                    <span className="text-xs text-slate-500 dark:text-slate-300">
                      {localize(
                        historyEntry.status === 'completed'
                          ? 'com_ui_project_meta_ads_diary_completed'
                          : 'com_ui_project_meta_ads_diary_draft',
                      )}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{author}</p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {formatDateTime(historyEntry.updatedAt || historyEntry.createdAt)}
                  </p>
                </button>
              );
            })}
          </div>
        </section>
      )}

      <div className="space-y-4">
        {entry && (
          <div className="rounded-xl border border-slate-200/70 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
            {localize('com_ui_project_meta_ads_diary_entry_meta', {
              0: entry.createdBy.name || localize('com_ui_project_meta_ads_diary_manager'),
              1: formatDateTime(entry.updatedAt || entry.createdAt),
            })}
          </div>
        )}
        {answers.map((item) => (
          <div
            key={item.id}
            className="rounded-2xl border border-slate-200/70 bg-white/70 p-4 dark:border-white/10 dark:bg-slate-950/20"
          >
            {item.parentQuestionId ? (
              <input
                value={item.question}
                disabled={isCompleted || !canEdit}
                onChange={(event) =>
                  setAnswers((current) =>
                    current.map((answer) =>
                      answer.id === item.id ? { ...answer, question: event.target.value } : answer,
                    ),
                  )
                }
                placeholder={localize('com_ui_project_meta_ads_diary_extra_question')}
                className="mb-3 w-full border-b border-slate-300 bg-transparent pb-2 text-sm font-semibold dark:border-white/20"
              />
            ) : (
              <label className="block text-sm font-semibold">{item.question}</label>
            )}
            <textarea
              value={item.answer}
              disabled={isCompleted || !canEdit}
              onChange={(event) => updateAnswer(item.id, event.target.value)}
              rows={4}
              className="mt-3 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm dark:border-white/15 dark:bg-slate-900"
            />
          </div>
        ))}
      </div>

      {canEdit && !isCompleted && (
        <button
          type="button"
          onClick={addQuestion}
          className="inline-flex items-center gap-2 text-sm font-semibold text-teal-700 dark:text-teal-200"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          {localize('com_ui_project_meta_ads_diary_add_question')}
        </button>
      )}

      <div className="flex flex-wrap gap-2 border-t border-slate-200/70 pt-4 dark:border-white/10">
        {canEdit && !isCompleted && (
          <>
            <button
              type="button"
              onClick={save}
              disabled={saveDiary.isLoading}
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold"
            >
              {localize('com_ui_project_meta_ads_diary_save')}
            </button>
            <button
              type="button"
              onClick={complete}
              disabled={completeDiary.isLoading || !entry}
              className="rounded-xl bg-teal-600 px-4 py-2 text-sm font-semibold text-white"
            >
              {localize('com_ui_project_meta_ads_diary_complete')}
            </button>
          </>
        )}
        {canEdit && isCompleted && (
          <button
            type="button"
            onClick={reopen}
            disabled={reopenDiary.isLoading}
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold"
          >
            {localize('com_ui_project_meta_ads_diary_reopen')}
          </button>
        )}
        {entry && (
          <button
            type="button"
            onClick={() => onAnalyze(entry)}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white dark:bg-white dark:text-slate-900"
          >
            <Sparkle className="h-4 w-4" aria-hidden="true" />
            {localize('com_ui_project_meta_ads_diary_analyze')}
          </button>
        )}
      </div>
    </div>
  );
}
