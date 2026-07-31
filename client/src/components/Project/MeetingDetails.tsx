import { useState } from 'react';
import { ArrowsOut, ChatCircle, Copy, DownloadSimple, Trash } from '@phosphor-icons/react';
import type { ProjectMeeting } from 'librechat-data-provider';
import { useLocalize } from '~/hooks';

interface MeetingDetailsProps {
  meeting: ProjectMeeting | null;
  canEdit: boolean;
  title: string;
  speakerNames: Record<string, string>;
  indexing: boolean;
  generatingInsights: boolean;
  canDelete: boolean;
  deleting: boolean;
  expanded?: boolean;
  onExpand?: () => void;
  onTitleChange: (title: string) => void;
  onTitleSave: () => void;
  onIndexRetry: () => void;
  onInsightsRetry: () => void;
  onSpeakerChange: (speaker: string, name: string) => void;
  onSave: () => void;
  onChat: () => void;
  onDelete: () => void;
}

const formatTime = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

type MeetingTab = 'summary' | 'transcript' | 'decisions' | 'nextSteps' | 'tasks';

export default function MeetingDetails({
  meeting,
  canEdit,
  title,
  speakerNames,
  indexing,
  generatingInsights,
  canDelete,
  deleting,
  expanded = false,
  onExpand,
  onTitleChange,
  onTitleSave,
  onIndexRetry,
  onInsightsRetry,
  onSpeakerChange,
  onSave,
  onChat,
  onDelete,
}: MeetingDetailsProps) {
  const localize = useLocalize();
  const [activeTab, setActiveTab] = useState<MeetingTab>('summary');
  if (!meeting) {
    return (
      <div className="flex min-h-80 items-center justify-center rounded-2xl border border-dashed border-border-light bg-surface-secondary px-8 text-center">
        <p className="max-w-sm text-sm leading-6 text-text-secondary">
          {localize('com_ui_meeting_select')}
        </p>
      </div>
    );
  }
  if (meeting.status !== 'completed') {
    return (
      <div className="flex items-center justify-between gap-3 text-sm text-text-secondary">
        <span>{localize(`com_ui_meeting_status_${meeting.status}`)}</span>
        {canDelete && (
          <button
            type="button"
            disabled={deleting}
            onClick={onDelete}
            className="btn btn-neutral text-red-500"
          >
            <Trash className="h-4 w-4" /> {localize('com_ui_meeting_delete')}
          </button>
        )}
      </div>
    );
  }
  const speakers = [...new Set(meeting.utterances.map((item) => item.speaker))];
  const hasInsights =
    Boolean(meeting.insights.summary) ||
    meeting.insights.decisions.length > 0 ||
    meeting.insights.nextSteps.length > 0 ||
    meeting.insights.tasks.length > 0;
  const transcriptText = meeting.utterances
    .map(
      (utterance) =>
        `[${formatTime(utterance.start / 1000)}] ${speakerNames[utterance.speaker] ?? `Speaker ${utterance.speaker}`}: ${utterance.text}`,
    )
    .join('\n\n');
  const fullText = [
    meeting.title,
    new Date(meeting.recordedAt).toLocaleString(),
    `${localize('com_ui_meeting_summary')}: ${meeting.insights.summary || '-'}`,
    `${localize('com_ui_meeting_decisions')}: ${meeting.insights.decisions.join('; ') || '-'}`,
    `${localize('com_ui_meeting_next_steps')}: ${meeting.insights.nextSteps.join('; ') || '-'}`,
    `${localize('com_ui_meeting_tasks')}: ${meeting.insights.tasks.join('; ') || '-'}`,
    '',
    transcriptText,
  ].join('\n');
  const copy = (text: string) => void navigator.clipboard.writeText(text);
  const tabs: Array<{ id: MeetingTab; label: string }> = [
    { id: 'summary', label: localize('com_ui_meeting_summary') },
    { id: 'transcript', label: localize('com_ui_meeting_transcript') },
    { id: 'decisions', label: localize('com_ui_meeting_decisions') },
    { id: 'nextSteps', label: localize('com_ui_meeting_next_steps') },
    { id: 'tasks', label: localize('com_ui_meeting_tasks') },
  ];
  let activeTabHasContent = false;
  if (activeTab === 'summary') {
    activeTabHasContent = Boolean(meeting.insights.summary);
  } else if (activeTab === 'transcript') {
    activeTabHasContent = meeting.utterances.length > 0;
  } else {
    activeTabHasContent = meeting.insights[activeTab].length > 0;
  }
  const exportTranscript = () => {
    const url = URL.createObjectURL(new Blob([fullText], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${meeting.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'reuniao'}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };
  return (
    <article
      className={`space-y-6 ${expanded ? '' : 'rounded-2xl border border-border-light bg-surface-secondary p-6'}`}
    >
      <div
        className={`flex flex-wrap justify-end gap-2 ${expanded ? 'rounded-2xl bg-surface-secondary p-3' : ''}`}
      >
        <button type="button" onClick={onChat} className="btn btn-primary">
          <ChatCircle className="h-4 w-4" /> {localize('com_ui_meeting_chat')}
        </button>
        <button type="button" onClick={() => copy(fullText)} className="btn btn-neutral">
          <Copy className="h-4 w-4" /> {localize('com_ui_meeting_copy_all')}
        </button>
        <button type="button" onClick={exportTranscript} className="btn btn-neutral">
          <DownloadSimple className="h-4 w-4" /> {localize('com_ui_meeting_export')}
        </button>
        {canDelete && (
          <button
            type="button"
            disabled={deleting}
            onClick={onDelete}
            className="btn btn-neutral text-red-500"
          >
            <Trash className="h-4 w-4" /> {localize('com_ui_meeting_delete')}
          </button>
        )}
        {!expanded && onExpand && (
          <button type="button" onClick={onExpand} className="btn btn-neutral">
            <ArrowsOut className="h-4 w-4" /> {localize('com_ui_meeting_expand')}
          </button>
        )}
      </div>
      <div className="grid gap-6 xl:grid-cols-3">
        <section>
          <h3 className="mb-2 font-medium text-text-primary">{localize('com_ui_meeting_title')}</h3>
          <div className="flex gap-2">
            <input
              value={title}
              disabled={!canEdit}
              maxLength={150}
              onChange={(event) => onTitleChange(event.target.value)}
              className="min-w-0 flex-1 rounded-lg border border-border-light bg-surface-primary px-3 py-2 text-sm"
              aria-label={localize('com_ui_meeting_title')}
            />
            {canEdit && (
              <button type="button" onClick={onTitleSave} className="btn btn-primary">
                {localize('com_ui_save')}
              </button>
            )}
          </div>
        </section>
        <section>
          <h3 className="mb-2 font-medium text-text-primary">{localize('com_ui_meeting_index')}</h3>
          <div className="flex items-center gap-2 text-sm text-text-secondary">
            <span>{localize(`com_ui_meeting_index_${meeting.indexStatus ?? 'pending'}`)}</span>
            {canEdit && meeting.indexStatus !== 'indexed' && (
              <button
                type="button"
                disabled={indexing}
                onClick={onIndexRetry}
                className="btn btn-neutral"
              >
                {localize('com_ui_meeting_retry_index')}
              </button>
            )}
          </div>
          {meeting.indexStatus === 'failed' && meeting.indexError && (
            <p className="mt-2 text-xs text-red-500">{meeting.indexError}</p>
          )}
        </section>
        <section>
          <h3 className="mb-2 font-medium text-text-primary">
            {localize('com_ui_meeting_participants')}
          </h3>
          <div className="flex flex-wrap gap-2">
            {speakers.map((speaker) => (
              <input
                key={speaker}
                value={speakerNames[speaker] ?? `Speaker ${speaker}`}
                disabled={!canEdit}
                onChange={(event) => onSpeakerChange(speaker, event.target.value)}
                className="rounded-lg border border-border-light bg-surface-primary px-3 py-2 text-sm"
                aria-label={`Speaker ${speaker}`}
              />
            ))}
            {canEdit && (
              <button type="button" onClick={onSave} className="btn btn-primary">
                {localize('com_ui_save')}
              </button>
            )}
          </div>
        </section>
      </div>
      {!hasInsights && canEdit && (
        <button
          type="button"
          disabled={generatingInsights}
          onClick={onInsightsRetry}
          className="btn btn-primary"
        >
          {localize('com_ui_meeting_generate_insights')}
        </button>
      )}
      <div className="overflow-x-auto border-b border-border-light" role="tablist">
        <div className="flex min-w-max gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              id={`meeting-tab-${tab.id}`}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              aria-controls={`meeting-panel-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              className={`relative px-4 py-3 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring-primary ${
                activeTab === tab.id
                  ? 'text-text-primary after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full after:bg-green-500'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
      <section
        id={`meeting-panel-${activeTab}`}
        role="tabpanel"
        aria-labelledby={`meeting-tab-${activeTab}`}
        className={`min-h-48 ${expanded ? 'rounded-2xl bg-surface-secondary p-6' : ''}`}
      >
        {activeTab === 'summary' && <Insight text={meeting.insights.summary} />}
        {activeTab === 'decisions' && <Insight items={meeting.insights.decisions} />}
        {activeTab === 'nextSteps' && <Insight items={meeting.insights.nextSteps} />}
        {activeTab === 'tasks' && <Insight items={meeting.insights.tasks} />}
        {activeTab === 'transcript' && (
          <div className="space-y-3">
            {meeting.utterances.map((utterance, index) => (
              <div
                key={`${utterance.start}-${index}`}
                className="rounded-xl bg-surface-primary p-3"
              >
                <div className="mb-1 text-xs font-medium text-text-secondary">
                  [{formatTime(utterance.start / 1000)}]{' '}
                  {speakerNames[utterance.speaker] ?? `Speaker ${utterance.speaker}`}
                </div>
                <p className="text-sm leading-6 text-text-primary">{utterance.text}</p>
                <button
                  type="button"
                  onClick={() =>
                    copy(
                      `[${formatTime(utterance.start / 1000)}] ${speakerNames[utterance.speaker] ?? `Speaker ${utterance.speaker}`}: ${utterance.text}`,
                    )
                  }
                  className="mt-2 inline-flex items-center gap-1 text-xs text-text-secondary hover:text-text-primary"
                >
                  <Copy className="h-3.5 w-3.5" /> {localize('com_ui_meeting_copy_segment')}
                </button>
              </div>
            ))}
          </div>
        )}
        {!activeTabHasContent && <p className="text-sm text-text-tertiary">—</p>}
      </section>
    </article>
  );
}

function Insight({ text, items }: { text?: string; items?: string[] }) {
  return (
    <div>
      {text ? <p className="text-sm leading-6 text-text-secondary">{text}</p> : null}
      {items?.length ? (
        <ul className="list-disc space-y-1 pl-5 text-sm text-text-secondary">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
