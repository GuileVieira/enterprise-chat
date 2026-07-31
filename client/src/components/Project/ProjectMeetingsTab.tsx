import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowsIn,
  ArrowsOut,
  Microphone,
  Pause,
  Play,
  Square,
  UploadSimple,
  X,
} from '@phosphor-icons/react';
import { dataService, DynamicQueryKeys, type ProjectMeeting } from 'librechat-data-provider';
import { useAuthContext, useLocalize } from '~/hooks';
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

interface MeetingUpload {
  audio: Blob;
  duration: number;
  recordedAt: string;
  pendingKey?: string;
}

const formatTime = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

const buildMeetingContext = (meeting: ProjectMeeting) =>
  [
    `# ${meeting.title}`,
    `Data: ${new Date(meeting.recordedAt).toLocaleString()}`,
    `Resumo: ${meeting.insights.summary || '-'}`,
    `Decisões: ${meeting.insights.decisions.join('; ') || '-'}`,
    `Próximos passos: ${meeting.insights.nextSteps.join('; ') || '-'}`,
    `Tarefas: ${meeting.insights.tasks.join('; ') || '-'}`,
    '',
    '## Transcrição',
    meeting.utterances
      .map(
        (utterance) =>
          `[${formatTime(utterance.start / 1000)}] ${meeting.speakerNames[utterance.speaker] ?? `Speaker ${utterance.speaker}`}: ${utterance.text}`,
      )
      .join('\n\n') || meeting.transcript,
  ].join('\n');

function AudioWaveform({
  active,
  label,
  barRefs,
}: {
  active: boolean;
  label: string;
  barRefs: React.MutableRefObject<Array<HTMLSpanElement | null>>;
}) {
  const bars = [0.65, 0.82, 1, 0.76, 0.94, 0.7, 0.9, 0.78, 0.86, 0.62];
  return (
    <div
      role="img"
      aria-label={label}
      className="flex h-14 items-center justify-center gap-1 rounded-xl border border-border-light bg-surface-primary px-4"
    >
      {bars.map((factor, index) => (
        <span
          key={`${factor}-${index}`}
          ref={(element) => {
            barRefs.current[index] = element;
          }}
          className={`h-8 w-1 origin-center rounded-full bg-green-500 transition-opacity ${active ? 'opacity-90' : 'opacity-30'}`}
          style={{ transform: 'scaleY(0.16)' }}
        />
      ))}
    </div>
  );
}

function RecorderControl({
  children,
  label,
  onClick,
  prominent = false,
  tone = 'neutral',
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  prominent?: boolean;
  tone?: 'neutral' | 'success' | 'danger';
}) {
  const toneClass =
    tone === 'success'
      ? 'bg-green-600 text-white hover:bg-green-500 focus-visible:ring-green-500 dark:bg-green-500 dark:text-slate-950 dark:hover:bg-green-400'
      : tone === 'danger'
        ? 'border border-border-light bg-surface-primary text-text-secondary hover:border-red-400/50 hover:bg-red-500/10 hover:text-red-500 focus-visible:ring-red-500'
        : 'border border-border-medium bg-surface-primary text-text-primary hover:bg-surface-hover focus-visible:ring-ring-primary';
  return (
    <div className="flex min-w-16 flex-col items-center gap-2">
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        title={label}
        className={`flex items-center justify-center rounded-full transition duration-200 hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-secondary active:scale-95 ${
          prominent ? 'size-14' : 'mt-1 size-12'
        } ${toneClass}`}
      >
        {children}
      </button>
      <span className="text-center text-xs font-medium text-text-secondary">{label}</span>
    </div>
  );
}

export default function ProjectMeetingsTab({ projectId, canEdit }: ProjectMeetingsTabProps) {
  const localize = useLocalize();
  const navigate = useNavigate();
  const { user } = useAuthContext();
  const queryClient = useQueryClient();
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const waveformBarRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
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
  const [fullscreen, setFullscreen] = useState(false);

  const stopWaveform = (closeContext = false) => {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    waveformBarRefs.current.forEach((bar) => {
      if (bar) {
        bar.style.transform = 'scaleY(0.16)';
      }
    });
    if (closeContext) {
      void audioContextRef.current?.close();
      audioContextRef.current = null;
      analyserRef.current = null;
    }
  };

  const animateWaveform = () => {
    const analyser = analyserRef.current;
    if (!analyser) {
      return;
    }
    const samples = new Uint8Array(analyser.fftSize);
    const frame = () => {
      analyser.getByteTimeDomainData(samples);
      const rms = Math.sqrt(
        samples.reduce((sum, sample) => sum + ((sample - 128) / 128) ** 2, 0) / samples.length,
      );
      const volume = Math.min(1, rms * 5.5);
      waveformBarRefs.current.forEach((bar, index) => {
        if (bar) {
          const shape = 0.62 + (1 - Math.abs(index - 4.5) / 5) * 0.38;
          bar.style.transform = `scaleY(${Math.max(0.16, volume * shape)})`;
        }
      });
      animationFrameRef.current = requestAnimationFrame(frame);
    };
    frame();
  };

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
    async (upload: MeetingUpload) => {
      const data = new FormData();
      const extension = upload.audio.type.includes('mp4') ? 'mp4' : 'webm';
      data.append(
        'audio',
        upload.audio,
        upload.audio instanceof File ? upload.audio.name : `meeting.${extension}`,
      );
      data.append('duration', String(upload.duration));
      data.append('recordedAt', upload.recordedAt);
      return dataService.createProjectMeeting(projectId, data);
    },
    {
      onSuccess: (meeting, upload) => {
        if (upload.pendingKey) {
          void deleteMeetingChunks(upload.pendingKey);
        }
        setPendingUpload(null);
        queryClient.invalidateQueries(DynamicQueryKeys.projectMeetings(projectId));
        setSelected(meeting);
      },
      onError: () => setError(localize('com_ui_meeting_upload_error')),
      onSettled: () => setRecording('idle'),
    },
  );

  const deleteMeeting = useMutation(
    () => dataService.deleteProjectMeeting(projectId, selected?.id ?? ''),
    {
      onSuccess: () => {
        setSelected(null);
        queryClient.invalidateQueries(DynamicQueryKeys.projectMeetings(projectId));
        queryClient.invalidateQueries(DynamicQueryKeys.projectFiles(projectId));
      },
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

  useEffect(
    () => () => {
      stopWaveform(true);
      streamRef.current?.getTracks().forEach((track) => track.stop());
    },
    [],
  );

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
      if (typeof AudioContext !== 'undefined') {
        const audioContext = new AudioContext();
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.8;
        audioContext.createMediaStreamSource(stream).connect(analyser);
        audioContextRef.current = audioContext;
        analyserRef.current = analyser;
      }
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
      animateWaveform();
      setElapsed(0);
      setRecording('recording');
    } catch {
      setError(localize('com_ui_meeting_microphone_denied'));
    }
  };

  const pause = () => {
    recorderRef.current?.pause();
    stopWaveform();
    pausedAtRef.current = Date.now();
    setRecording('paused');
  };

  const resume = () => {
    recorderRef.current?.resume();
    animateWaveform();
    pausedTotalRef.current += Date.now() - pausedAtRef.current;
    setRecording('recording');
  };

  const finish = (cancel = false) => {
    const recorder = recorderRef.current;
    if (!recorder) {
      return;
    }
    recorder.onstop = async () => {
      stopWaveform(true);
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
      const chunks = await readMeetingChunks(pending.key);
      createMeeting.mutate({
        audio: new Blob(chunks, { type: pending.mimeType }),
        duration: pending.duration,
        recordedAt: pending.recordedAt,
        pendingKey: pending.key,
      });
    };
    recorder.stop();
  };

  const retryUpload = () => {
    if (!pendingUpload) {
      return;
    }
    setError('');
    setRecording('uploading');
    void readMeetingChunks(pendingUpload.key).then((chunks) =>
      createMeeting.mutate({
        audio: new Blob(chunks, { type: pendingUpload.mimeType }),
        duration: pendingUpload.duration,
        recordedAt: pendingUpload.recordedAt,
        pendingKey: pendingUpload.key,
      }),
    );
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

  const uploadFile = (file?: File) => {
    if (!file) {
      return;
    }
    setError('');
    setRecording('uploading');
    createMeeting.mutate({ audio: file, duration: 0, recordedAt: new Date().toISOString() });
  };

  const openChat = () => {
    if (!selected) {
      return;
    }
    const storageKey = `meeting_context:${crypto.randomUUID()}`;
    sessionStorage.setItem(storageKey, JSON.stringify({ markdown: buildMeetingContext(selected) }));
    navigate(
      `/c/new?${new URLSearchParams({ project_id: projectId, context_brief: storageKey, new_conversation: 'true' })}`,
    );
  };

  const confirmDelete = () => {
    if (selected && window.confirm(localize('com_ui_meeting_delete_confirm'))) {
      deleteMeeting.mutate();
    }
  };

  return (
    <div
      className={`grid gap-5 lg:grid-cols-[320px_1fr] ${
        fullscreen ? 'fixed inset-0 z-[9999] overflow-y-auto bg-surface-primary p-5' : ''
      }`}
    >
      <div className="flex justify-end lg:col-span-2">
        <button
          type="button"
          onClick={() => setFullscreen((value) => !value)}
          className="btn btn-neutral"
        >
          {fullscreen ? <ArrowsIn className="h-4 w-4" /> : <ArrowsOut className="h-4 w-4" />}
          {localize(fullscreen ? 'com_ui_meeting_collapse' : 'com_ui_meeting_expand')}
        </button>
      </div>
      <div className="space-y-4">
        {canEdit && (
          <div className="rounded-xl border border-border-light bg-surface-secondary p-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <span className="text-sm font-medium text-text-primary">
                  {localize('com_ui_meeting_recorder')}
                </span>
                <div className="mt-1 flex items-center gap-1.5 text-xs text-text-secondary">
                  <span
                    className={`size-2 rounded-full ${recording === 'recording' ? 'animate-pulse bg-green-500' : 'bg-text-tertiary'}`}
                  />
                  {localize(`com_ui_meeting_recorder_${recording}`)}
                </div>
              </div>
              <span className="font-mono text-sm text-text-secondary">{formatTime(elapsed)}</span>
            </div>
            <AudioWaveform
              active={recording === 'recording'}
              barRefs={waveformBarRefs}
              label={localize(
                recording === 'recording'
                  ? 'com_ui_meeting_waveform_recording'
                  : 'com_ui_meeting_waveform_inactive',
              )}
            />
            <div className="mt-4 space-y-2">
              {recording === 'idle' && !pendingUpload && (
                <div className="flex items-start justify-center gap-8 py-1">
                  <div className="flex flex-col items-center gap-2">
                    <button
                      type="button"
                      onClick={start}
                      aria-label={localize('com_ui_meeting_start')}
                      title={localize('com_ui_meeting_start')}
                      className="group flex size-14 items-center justify-center rounded-full bg-red-500 text-white shadow-[0_8px_24px_-12px_rgba(239,68,68,0.8)] transition duration-200 hover:scale-105 hover:bg-red-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-secondary active:scale-95"
                    >
                      <Microphone
                        className="size-5 transition-transform group-hover:scale-105"
                        weight="fill"
                      />
                    </button>
                    <span className="text-xs font-medium text-text-secondary">
                      {localize('com_ui_meeting_start')}
                    </span>
                  </div>
                  <div className="flex flex-col items-center gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      aria-label={localize('com_ui_meeting_upload_audio')}
                      title={localize('com_ui_meeting_upload_audio')}
                      className="flex size-14 items-center justify-center rounded-full border border-border-medium bg-surface-primary text-text-primary transition duration-200 hover:scale-105 hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-primary active:scale-95"
                    >
                      <UploadSimple className="size-5" weight="bold" />
                    </button>
                    <span className="text-xs font-medium text-text-secondary">
                      {localize('com_ui_meeting_upload_audio')}
                    </span>
                  </div>
                </div>
              )}
              {recording === 'idle' && pendingUpload && (
                <div className="grid grid-cols-[1fr_auto] gap-2">
                  <button
                    type="button"
                    onClick={retryUpload}
                    className="min-h-11 rounded-xl bg-text-primary px-4 text-sm font-semibold text-surface-primary transition duration-200 hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-primary active:scale-[0.98]"
                  >
                    {localize('com_ui_meeting_retry_upload')}
                  </button>
                  <button
                    type="button"
                    onClick={discardUpload}
                    className="min-h-11 rounded-xl border border-border-light px-3 text-sm font-medium text-text-secondary transition duration-200 hover:bg-surface-hover hover:text-red-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-primary active:scale-[0.98]"
                  >
                    {localize('com_ui_meeting_discard_upload')}
                  </button>
                </div>
              )}
              {(recording === 'recording' || recording === 'paused') && (
                <div className="flex items-start justify-center gap-5 py-1">
                  <RecorderControl
                    label={localize('com_ui_meeting_cancel')}
                    onClick={() => finish(true)}
                    tone="danger"
                  >
                    <X className="size-5" weight="bold" />
                  </RecorderControl>
                  <RecorderControl
                    label={localize(
                      recording === 'recording' ? 'com_ui_meeting_pause' : 'com_ui_meeting_resume',
                    )}
                    onClick={recording === 'recording' ? pause : resume}
                    prominent
                  >
                    {recording === 'recording' ? (
                      <Pause className="size-5" weight="fill" />
                    ) : (
                      <Play className="ml-0.5 size-5" weight="fill" />
                    )}
                  </RecorderControl>
                  <RecorderControl
                    label={localize('com_ui_meeting_finish')}
                    onClick={() => finish()}
                    tone="success"
                  >
                    <Square className="size-4" weight="fill" />
                  </RecorderControl>
                </div>
              )}
              {recording === 'uploading' && (
                <div className="flex min-h-12 items-center gap-3 rounded-xl bg-surface-primary px-3.5 text-sm text-text-secondary">
                  <span
                    className="size-3 animate-pulse rounded-full bg-green-500"
                    aria-hidden="true"
                  />
                  {localize('com_ui_meeting_uploading')}
                </div>
              )}
              {recording !== 'idle' && (
                <button
                  type="button"
                  disabled
                  className="flex min-h-9 w-full cursor-not-allowed items-center justify-center gap-2 rounded-lg text-xs font-medium text-text-tertiary opacity-60"
                >
                  <UploadSimple className="size-4" weight="bold" />
                  {localize('com_ui_meeting_upload_audio')}
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*"
                className="hidden"
                aria-label={localize('com_ui_meeting_upload_audio')}
                onChange={(event) => uploadFile(event.target.files?.[0])}
              />
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
        canDelete={Boolean(selected && user?.id === selected.userId)}
        deleting={deleteMeeting.isLoading}
        onTitleChange={setTitle}
        onTitleSave={() => updateTitle.mutate()}
        onIndexRetry={() => retryIndex.mutate()}
        onInsightsRetry={() => retryInsights.mutate()}
        onSpeakerChange={(speaker, name) =>
          setSpeakerNames((current) => ({ ...current, [speaker]: name }))
        }
        onSave={() => updateSpeakers.mutate()}
        onChat={openChat}
        onDelete={confirmDelete}
      />
    </div>
  );
}
