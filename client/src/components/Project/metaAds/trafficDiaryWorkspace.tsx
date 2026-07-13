import { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle, Plus, Sparkle } from '@phosphor-icons/react';
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

const diarySections = [
  {
    key: 'context',
    questionIds: ['measurement', 'strategy', 'client_feedback'],
  },
  {
    key: 'decisions',
    questionIds: ['changes', 'creative_learning'],
  },
  {
    key: 'next_steps',
    questionIds: ['next_steps'],
  },
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

function getDefaultAnswers(localize: ReturnType<typeof useLocalize>) {
  return diarySections.flatMap((section) =>
    section.questionIds.map((id) => ({
      id,
      question: localize(`com_ui_project_meta_ads_diary_question_${id}`),
      answer: '',
    })),
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
  const defaultAnswers = useMemo(() => getDefaultAnswers(localize), [localize]);
  const defaultAnswersRef = useRef(defaultAnswers);
  defaultAnswersRef.current = defaultAnswers;
  const [weekStart, setWeekStart] = useState(currentWeekStart);
  const [answers, setAnswers] = useState<ProjectTrafficDiaryAnswer[]>(defaultAnswers);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const entries = diaryQuery.data?.entries ?? [];
  const entry = entries.find((item) => item.weekStart === weekStart);
  const historyEntries = entries.filter((item) => item.weekStart !== currentWeekStart);
  const isCompleted = entry?.status === 'completed';
  const isSaving = saveDiary.isLoading || completeDiary.isLoading || reopenDiary.isLoading;

  useEffect(() => {
    setAnswers(entry?.answers.length ? entry.answers : defaultAnswersRef.current);
    setError(null);
    setNotice(null);
  }, [entry?.answers, entry?.updatedAt, entry?.weekStart]);

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

  const save = async (showNotice = true) => {
    try {
      setError(null);
      const savedAnswers = answers.filter(
        (answer) =>
          !answer.parentQuestionId ||
          answer.question.trim().length > 0 ||
          answer.answer.trim().length > 0,
      );
      const savedEntry = await saveDiary.mutateAsync({
        projectId: project.projectId,
        weekStart,
        answers: savedAnswers,
      });
      if (showNotice) {
        setNotice(localize('com_ui_project_meta_ads_diary_saved'));
      }
      return savedEntry;
    } catch {
      setError(localize('com_ui_project_meta_ads_diary_save_error'));
      return null;
    }
  };

  const complete = async () => {
    const savedEntry = await save(false);
    if (!savedEntry) {
      return;
    }
    try {
      setError(null);
      await completeDiary.mutateAsync({ projectId: project.projectId, entryId: savedEntry._id });
      setNotice(localize('com_ui_project_meta_ads_diary_completed_success'));
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
      setNotice(localize('com_ui_project_meta_ads_diary_reopened_success'));
    } catch {
      setError(localize('com_ui_project_meta_ads_diary_reopen_error'));
    }
  };

  const answersForSection = (section: (typeof diarySections)[number]) =>
    answers.filter(
      (answer) =>
        (section.questionIds as readonly string[]).includes(answer.id) ||
        (answer.parentQuestionId != null &&
          (section.questionIds as readonly string[]).includes(answer.parentQuestionId)),
    );

  return (
    <div id="meta-ads-diary-tab-panel" role="tabpanel" className="space-y-5 p-5">
      <header className="flex flex-col gap-4 rounded-2xl border border-slate-200/70 bg-white/70 p-5 dark:border-white/10 dark:bg-slate-950/20 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-xl font-semibold tracking-tight">
              {localize('com_ui_project_meta_ads_diary_title')}
            </h3>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 dark:bg-white/10 dark:text-slate-200">
              {entry
                ? localize(
                    isCompleted
                      ? 'com_ui_project_meta_ads_diary_completed'
                      : 'com_ui_project_meta_ads_diary_draft',
                  )
                : localize('com_ui_project_meta_ads_diary_new_week')}
            </span>
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
            {localize('com_ui_project_meta_ads_diary_description')}
          </p>
          <p className="mt-3 text-sm font-medium text-slate-900 dark:text-white">
            {formatDate(weekStart)}
          </p>
          {entry && (
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {localize('com_ui_project_meta_ads_diary_entry_meta', {
                0: entry.createdBy.name || localize('com_ui_project_meta_ads_diary_manager'),
                1: formatDateTime(entry.updatedAt || entry.createdAt),
              })}
            </p>
          )}
        </div>
        {weekStart !== currentWeekStart && (
          <button
            type="button"
            onClick={() => setWeekStart(currentWeekStart)}
            className="self-start rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400 dark:border-white/15 dark:text-slate-200"
          >
            {localize('com_ui_project_meta_ads_diary_this_week')}
          </button>
        )}
      </header>

      {(error || notice) && (
        <div
          role="status"
          className={`flex items-center gap-2 rounded-xl px-4 py-3 text-sm ${
            error
              ? 'bg-red-500/10 text-red-700 dark:text-red-200'
              : 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-100'
          }`}
        >
          {!error && <CheckCircle className="h-4 w-4" aria-hidden="true" />}
          {error || notice}
        </div>
      )}

      <div className="sticky top-0 z-10 -mx-5 border-y border-slate-200/80 bg-white/95 px-5 py-4 shadow-[0_12px_32px_-28px_rgba(15,23,42,0.8)] backdrop-blur dark:border-white/10 dark:bg-slate-950/95">
        <div className="flex flex-wrap items-center gap-2">
          {canEdit && !isCompleted && (
            <>
              <button
                type="button"
                onClick={() => void save()}
                disabled={isSaving}
                className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/15 dark:text-slate-100"
              >
                {localize('com_ui_project_meta_ads_diary_save')}
              </button>
              <button
                type="button"
                onClick={() => void complete()}
                disabled={isSaving}
                className="rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {localize('com_ui_project_meta_ads_diary_complete')}
              </button>
            </>
          )}
          {canEdit && isCompleted && (
            <button
              type="button"
              onClick={() => void reopen()}
              disabled={isSaving}
              className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/15 dark:text-slate-100"
            >
              {localize('com_ui_project_meta_ads_diary_reopen')}
            </button>
          )}
          {entry && (
            <button
              type="button"
              onClick={() => onAnalyze(entry)}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
            >
              <Sparkle className="h-4 w-4" aria-hidden="true" />
              {localize('com_ui_project_meta_ads_diary_analyze')}
            </button>
          )}
          {entry && !isCompleted && (
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {localize('com_ui_project_meta_ads_diary_analyze_hint')}
            </span>
          )}
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="min-w-0 space-y-5">
          {diarySections.map((section) => {
            const sectionAnswers = answersForSection(section);
            if (sectionAnswers.length === 0) {
              return null;
            }
            return (
              <section key={section.key} className="space-y-3">
                <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                  {localize(`com_ui_project_meta_ads_diary_section_${section.key}`)}
                </h4>
                <div className="space-y-3">
                  {sectionAnswers.map((item) => (
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
                                answer.id === item.id
                                  ? { ...answer, question: event.target.value }
                                  : answer,
                              ),
                            )
                          }
                          placeholder={localize('com_ui_project_meta_ads_diary_extra_question')}
                          className="mb-3 w-full border-b border-slate-300 bg-transparent pb-2 text-sm font-semibold dark:border-white/20"
                        />
                      ) : (
                        <label className="block max-w-3xl text-sm font-semibold leading-6">
                          {item.question}
                        </label>
                      )}
                      <textarea
                        value={item.answer}
                        disabled={isCompleted || !canEdit}
                        onChange={(event) => updateAnswer(item.id, event.target.value)}
                        rows={3}
                        className="mt-3 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm leading-6 transition focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 dark:border-white/15 dark:bg-slate-900"
                      />
                    </div>
                  ))}
                </div>
              </section>
            );
          })}

          {canEdit && !isCompleted && (
            <button
              type="button"
              onClick={addQuestion}
              className="inline-flex items-center gap-2 text-sm font-semibold text-teal-700 transition hover:text-teal-900 dark:text-teal-200 dark:hover:text-teal-100"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              {localize('com_ui_project_meta_ads_diary_add_question')}
            </button>
          )}
        </div>

        <aside className="min-w-0 xl:sticky xl:top-4 xl:self-start">
          <div className="rounded-2xl border border-slate-200/70 bg-white/55 p-3 dark:border-white/10 dark:bg-slate-950/20">
            <h4 className="px-1 pb-3 text-sm font-semibold">
              {localize('com_ui_project_meta_ads_diary_history')}
            </h4>
            <div className="flex gap-3 overflow-x-auto pb-1 xl:max-h-[460px] xl:flex-col xl:overflow-y-auto xl:pr-1">
              <button
                type="button"
                onClick={() => setWeekStart(currentWeekStart)}
                className={`w-56 shrink-0 rounded-xl border p-3 text-left transition xl:w-full ${
                  weekStart === currentWeekStart
                    ? 'border-teal-400 bg-teal-50 dark:border-teal-300/50 dark:bg-teal-300/10'
                    : 'border-slate-200 bg-white/70 hover:border-slate-300 dark:border-white/10 dark:bg-white/[0.03]'
                }`}
              >
                <span className="block text-sm font-semibold">{formatDate(currentWeekStart)}</span>
                <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
                  {localize('com_ui_project_meta_ads_diary_this_week')}
                </span>
              </button>
              {historyEntries.map((historyEntry) => {
                const isSelected = historyEntry.weekStart === weekStart;
                const author =
                  historyEntry.createdBy.name || localize('com_ui_project_meta_ads_diary_manager');
                return (
                  <button
                    key={historyEntry._id}
                    type="button"
                    onClick={() => setWeekStart(historyEntry.weekStart)}
                    className={`w-56 shrink-0 rounded-xl border p-3 text-left transition xl:w-full ${
                      isSelected
                        ? 'border-teal-400 bg-teal-50 dark:border-teal-300/50 dark:bg-teal-300/10'
                        : 'border-slate-200 bg-white/70 hover:border-slate-300 dark:border-white/10 dark:bg-white/[0.03]'
                    }`}
                  >
                    <span className="block text-sm font-semibold">
                      {formatDate(historyEntry.weekStart)}
                    </span>
                    <span className="mt-1 block text-xs text-slate-500 dark:text-slate-300">
                      {localize(
                        historyEntry.status === 'completed'
                          ? 'com_ui_project_meta_ads_diary_completed'
                          : 'com_ui_project_meta_ads_diary_draft',
                      )}
                    </span>
                    <span className="mt-2 block text-sm text-slate-700 dark:text-slate-200">
                      {author}
                    </span>
                    <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
                      {formatDateTime(historyEntry.updatedAt || historyEntry.createdAt)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
