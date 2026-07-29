import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Microphone, Pause, Play, Square, Trash } from '@phosphor-icons/react';
import { dataService, DynamicQueryKeys, type ProjectMeeting } from 'librechat-data-provider';
import { useLocalize } from '~/hooks';
import MeetingDetails from './MeetingDetails';
import { deleteMeetingChunks, readMeetingChunks, saveMeetingChunk } from './meetingStorage';

interface ProjectMeetingsTabProps {
  projectId: string;
  canEdit: boolean;
}

interface PendingRecording {
  key: string;
  mimeType: string;
  duration: number;
  recordedAt: string;
}

const formatTime = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

export default function ProjectMeetingsTab({ projectId, canEdit }: ProjectMeetingsTabProps) {
  const localize = useLocalize();
  const queryClient = useQueryClient();
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recordingKeyRef = useRef('');
  const chunkIndexRef = useRef(0);
  const chunkWritesRef = useRef(Promise.resolve());
  const startedAtRef = useRef(0);
  const pausedAtRef = useRef(0);
  const pausedTotalRef = useRef(0);
  const [recording, setRecording] = useState<'idle' | 'recording' | 'paused' | 'uploading'>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState('');
  const [pendingUpload, setPendingUpload] = useState<PendingRecording | null>(null);
  const [selected, setSelected] = useState<ProjectMeeting | null>(null);
  const [title, setTitle] = useState('');
  const [speakerNames, setSpeakerNames] = useState<Record<string, string>>({});

  const meetingsQuery = useQuery<ProjectMeeting[]>(
    DynamicQueryKeys.projectMeetings(projectId),
    async () => {
      const meetings = await dataService.getProjectMeetings(projectId);
      return Promise.all(
        meetings.map((meeting) =>
          meeting.status === 'processing'
            ? dataService.getProjectMeeting(projectId, meeting.id)
            : meeting,
        ),
      );
    },
    {
      refetchInterval: (meetings) =>
        meetings?.some((meeting) => meeting.status === 'processing') ? 5000 : false,
    },
  );

  const createMeeting = useMutation(
    async (pending: PendingRecording) => {
      const chunks = await readMeetingChunks(pending.key);
      const audio = new Blob(chunks, { type: pending.mimeType });
      const data = new FormData();
      data.append('audio', audio, `meeting.${pending.mimeType.includes('mp4') ? 'mp4' : 'webm'}`);
      data.append('duration', String(pending.duration));
      data.append('recordedAt', pending.recordedAt);
      return dataService.createProjectMeeting(projectId, data);
    },
    {
      onSuccess: (meeting, pending) => {
        void deleteMeetingChunks(pending.key);
        setPendingUpload(null);
        queryClient.invalidateQueries(DynamicQueryKeys.projectMeetings(projectId));
        setSelected(meeting);
      },
      onError: () => setError(localize('com_ui_meeting_upload_error')),
      onSettled: () => setRecording('idle'),
    },
  );

  const updateSpeakers = useMutation(
    () => dataService.updateProjectMeetingSpeakers(projectId, selected?.id ?? '', speakerNames),
    {
      onSuccess: (meeting) => {
        setSelected(meeting);
        queryClient.invalidateQueries(DynamicQueryKeys.projectMeetings(projectId));
        queryClient.invalidateQueries(DynamicQueryKeys.projectFiles(projectId));
      },
    },
  );

  const updateTitle = useMutation(
    () => dataService.updateProjectMeeting(projectId, selected?.id ?? '', { title }),
    {
      onSuccess: (meeting) => {
        setSelected(meeting);
        setTitle(meeting.title);
        queryClient.invalidateQueries(DynamicQueryKeys.projectMeetings(projectId));
        queryClient.invalidateQueries(DynamicQueryKeys.projectFiles(projectId));
      },
    },
  );

  const retryIndex = useMutation(
    () => dataService.retryProjectMeetingIndex(projectId, selected?.id ?? ''),
    {
      onSuccess: (meeting) => {
        setSelected(meeting);
        queryClient.invalidateQueries(DynamicQueryKeys.projectMeetings(projectId));
        queryClient.invalidateQueries(DynamicQueryKeys.projectFiles(projectId));
      },
    },
  );

  const retryInsights = useMutation(
    () => dataService.retryProjectMeetingInsights(projectId, selected?.id ?? ''),
    {
      onSuccess: (meeting) => {
        setSelected(meeting);
        queryClient.invalidateQueries(DynamicQueryKeys.projectMeetings(projectId));
        queryClient.invalidateQueries(DynamicQueryKeys.projectFiles(projectId));
      },
    },
  );

  useEffect(() => {
    if (recording !== 'recording') {
      return;
    }
    const timer = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAtRef.current - pausedTotalRef.current) / 1000));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [recording]);

  const selectedId = selected?.id;
  useEffect(() => {
    if (!selectedId) {
      return;
    }
    const fresh = meetingsQuery.data?.find((meeting) => meeting.id === selectedId);
    if (fresh) {
      setSelected(fresh);
      setTitle(fresh.title);
      setSpeakerNames(fresh.speakerNames);
    }
  }, [meetingsQuery.data, selectedId]);

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  };

  const start = async () => {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = ['audio/webm;codecs=opus', 'audio/mp4'].find((type) =>
        MediaRecorder.isTypeSupported(type),
      );
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      const key = crypto.randomUUID();
      recordingKeyRef.current = key;
      chunkIndexRef.current = 0;
      chunkWritesRef.current = Promise.resolve();
      startedAtRef.current = Date.now();
      pausedTotalRef.current = 0;
      recorder.ondataavailable = (event) => {
        if (event.data.size) {
          const index = chunkIndexRef.current++;
          chunkWritesRef.current = chunkWritesRef.current.then(() =>
            saveMeetingChunk(key, index, event.data),
          );
        }
      };
      recorderRef.current = recorder;
      streamRef.current = stream;
      recorder.start(5000);
      setElapsed(0);
      setRecording('recording');
    } catch {
      setError(localize('com_ui_meeting_microphone_denied'));
    }
  };

  const pause = () => {
    recorderRef.current?.pause();
    pausedAtRef.current = Date.now();
    setRecording('paused');
  };

  const resume = () => {
    recorderRef.current?.resume();
    pausedTotalRef.current += Date.now() - pausedAtRef.current;
    setRecording('recording');
  };

  const finish = (cancel = false) => {
    const recorder = recorderRef.current;
    if (!recorder) {
      return;
    }
    recorder.onstop = async () => {
      stopStream();
      await chunkWritesRef.current;
      recorderRef.current = null;
      if (cancel) {
        await deleteMeetingChunks(recordingKeyRef.current);
        setRecording('idle');
        setElapsed(0);
        return;
      }
      const pending = {
        key: recordingKeyRef.current,
        mimeType: recorder.mimeType,
        duration: elapsed,
        recordedAt: new Date(startedAtRef.current).toISOString(),
      };
      setPendingUpload(pending);
      setRecording('uploading');
      createMeeting.mutate(pending);
    };
    recorder.stop();
  };

  const retryUpload = () => {
    if (!pendingUpload) {
      return;
    }
    setError('');
    setRecording('uploading');
    createMeeting.mutate(pendingUpload);
  };

  const discardUpload = async () => {
    if (pendingUpload) {
      await deleteMeetingChunks(pendingUpload.key);
    }
    setPendingUpload(null);
    setError('');
    setElapsed(0);
  };

  const openMeeting = (meeting: ProjectMeeting) => {
    setSelected(meeting);
    setTitle(meeting.title);
    setSpeakerNames(meeting.speakerNames);
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
      <div className="space-y-4">
        {canEdit && (
          <div className="rounded-xl border border-border-light bg-surface-secondary p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-medium text-text-primary">
                {localize('com_ui_meeting_recorder')}
              </span>
              <span className="font-mono text-sm text-text-secondary">{formatTime(elapsed)}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {recording === 'idle' && !pendingUpload && (
                <button type="button" onClick={start} className="btn btn-primary">
                  <Microphone className="h-4 w-4" /> {localize('com_ui_meeting_start')}
                </button>
              )}
              {recording === 'idle' && pendingUpload && (
                <>
                  <button type="button" onClick={retryUpload} className="btn btn-primary">
                    {localize('com_ui_meeting_retry_upload')}
                  </button>
                  <button type="button" onClick={discardUpload} className="btn btn-neutral">
                    {localize('com_ui_meeting_discard_upload')}
                  </button>
                </>
              )}
              {recording === 'recording' && (
                <button type="button" onClick={pause} className="btn btn-neutral">
                  <Pause className="h-4 w-4" /> {localize('com_ui_meeting_pause')}
                </button>
              )}
              {recording === 'paused' && (
                <button type="button" onClick={resume} className="btn btn-neutral">
                  <Play className="h-4 w-4" /> {localize('com_ui_meeting_resume')}
                </button>
              )}
              {(recording === 'recording' || recording === 'paused') && (
                <>
                  <button type="button" onClick={() => finish()} className="btn btn-primary">
                    <Square className="h-4 w-4" /> {localize('com_ui_meeting_finish')}
                  </button>
                  <button type="button" onClick={() => finish(true)} className="btn btn-neutral">
                    <Trash className="h-4 w-4" /> {localize('com_ui_meeting_cancel')}
                  </button>
                </>
              )}
              {recording === 'uploading' && (
                <span className="text-sm text-text-secondary">
                  {localize('com_ui_meeting_uploading')}
                </span>
              )}
            </div>
            {error && <p className="mt-3 text-sm text-red-500">{error}</p>}
          </div>
        )}

        <div className="space-y-2">
          {meetingsQuery.data?.map((meeting) => (
            <button
              type="button"
              key={meeting.id}
              onClick={() => openMeeting(meeting)}
              className="w-full rounded-xl border border-border-light bg-surface-secondary p-3 text-left hover:bg-surface-hover"
            >
              <div className="text-sm font-medium text-text-primary">{meeting.title}</div>
              <div
                className="mt-1 flex items-center gap-1.5 text-xs text-text-secondary"
                role={meeting.status === 'processing' ? 'status' : undefined}
                aria-live={meeting.status === 'processing' ? 'polite' : undefined}
              >
                {meeting.status === 'processing' && (
                  <span
                    aria-hidden="true"
                    className="size-3 shrink-0 animate-spin rounded-full border-2 border-text-secondary border-t-transparent"
                  />
                )}
                {new Date(meeting.recordedAt).toLocaleString()} · {formatTime(meeting.duration)} ·{' '}
                {localize(`com_ui_meeting_status_${meeting.status}`)}
              </div>
            </button>
          ))}
          {!meetingsQuery.isLoading && !meetingsQuery.data?.length && (
            <div className="rounded-xl border border-dashed border-border-light p-8 text-center text-sm text-text-secondary">
              {localize('com_ui_meeting_empty')}
            </div>
          )}
        </div>
      </div>

      <MeetingDetails
        meeting={selected}
        canEdit={canEdit}
        title={title}
        speakerNames={speakerNames}
        indexing={retryIndex.isLoading}
        generatingInsights={retryInsights.isLoading}
        onTitleChange={setTitle}
        onTitleSave={() => updateTitle.mutate()}
        onIndexRetry={() => retryIndex.mutate()}
        onInsightsRetry={() => retryInsights.mutate()}
        onSpeakerChange={(speaker, name) =>
          setSpeakerNames((current) => ({ ...current, [speaker]: name }))
        }
        onSave={() => updateSpeakers.mutate()}
      />
    </div>
  );
}
