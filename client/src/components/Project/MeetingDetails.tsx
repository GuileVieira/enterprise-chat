import { ChatCircle, Copy, DownloadSimple, Trash } from '@phosphor-icons/react';
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

export default function MeetingDetails({
  meeting,
  canEdit,
  title,
  speakerNames,
  indexing,
  generatingInsights,
  canDelete,
  deleting,
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
  if (!meeting) {
    return <div className="text-sm text-text-secondary">{localize('com_ui_meeting_select')}</div>;
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
  const exportTranscript = () => {
    const url = URL.createObjectURL(new Blob([fullText], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${meeting.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'reuniao'}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-end gap-2">
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
      </div>
      <section>
        <h3 className="mb-2 font-medium text-text-primary">{localize('com_ui_meeting_title')}</h3>
        <div className="flex gap-2">
          <input
            value={title}
            disabled={!canEdit}
            maxLength={150}
            onChange={(event) => onTitleChange(event.target.value)}
            className="min-w-0 flex-1 rounded-lg border border-border-light bg-surface-secondary px-3 py-2 text-sm"
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
              className="rounded-lg border border-border-light bg-surface-secondary px-3 py-2 text-sm"
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
      <Insight title={localize('com_ui_meeting_summary')} text={meeting.insights.summary} />
      <Insight title={localize('com_ui_meeting_decisions')} items={meeting.insights.decisions} />
      <Insight title={localize('com_ui_meeting_next_steps')} items={meeting.insights.nextSteps} />
      <Insight title={localize('com_ui_meeting_tasks')} items={meeting.insights.tasks} />
      <section>
        <h3 className="mb-3 font-medium text-text-primary">
          {localize('com_ui_meeting_transcript')}
        </h3>
        <div className="space-y-3">
          {meeting.utterances.map((utterance, index) => (
            <div
              key={`${utterance.start}-${index}`}
              className="rounded-xl bg-surface-secondary p-3"
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
      </section>
    </div>
  );
}

function Insight({ title, text, items }: { title: string; text?: string; items?: string[] }) {
  return (
    <section>
      <h3 className="mb-2 font-medium text-text-primary">{title}</h3>
      {text ? <p className="text-sm leading-6 text-text-secondary">{text}</p> : null}
      {items?.length ? (
        <ul className="list-disc space-y-1 pl-5 text-sm text-text-secondary">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
