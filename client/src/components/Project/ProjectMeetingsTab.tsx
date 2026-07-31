import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowsIn,
  MagnifyingGlass,
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

const waveformShape = [
  0.34, 0.48, 0.4, 0.62, 0.52, 0.76, 0.58, 0.88, 0.68, 1, 0.72, 0.9, 0.62, 0.8, 0.8, 0.62, 0.9,
  0.72, 1, 0.68, 0.88, 0.58, 0.76, 0.52, 0.62, 0.4, 0.48, 0.34,
];

const idleWaveformScale = (factor: number) => 0.12 + factor * 0.22;

const normalizeSearch = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase();

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
  return (
    <div
      role="img"
      aria-label={label}
      className="relative flex h-16 items-center justify-center overflow-hidden rounded-xl border border-border-light bg-surface-primary px-5"
    >
      <span aria-hidden="true" className="absolute inset-x-5 h-px bg-border-light opacity-70" />
      <div className="relative flex items-center justify-center gap-[3px]">
        {waveformShape.map((factor, index) => (
          <span
            key={`${factor}-${index}`}
            ref={(element) => {
              barRefs.current[index] = element;
            }}
            data-waveform-bar
            className={`h-9 w-0.5 origin-center rounded-full bg-green-500 transition-[transform,opacity] duration-75 ${active ? 'opacity-90' : 'opacity-45'}`}
            style={{ transform: `scaleY(${idleWaveformScale(factor)})` }}
          />
        ))}
      </div>
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
  let toneClass =
    'border border-border-medium bg-surface-primary text-text-primary hover:bg-surface-hover focus-visible:ring-ring-primary';
  if (tone === 'success') {
    toneClass =
      'bg-green-600 text-white hover:bg-green-500 focus-visible:ring-green-500 dark:bg-green-500 dark:text-slate-950 dark:hover:bg-green-400';
  } else if (tone === 'danger') {
    toneClass =
      'border border-border-light bg-surface-primary text-text-secondary hover:border-red-400/50 hover:bg-red-500/10 hover:text-red-500 focus-visible:ring-red-500';
  }
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
  const [search, setSearch] = useState('');

  const stopWaveform = (closeContext = false) => {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    waveformBarRefs.current.forEach((bar, index) => {
      if (bar) {
        bar.style.transform = `scaleY(${idleWaveformScale(waveformShape[index] ?? 0.5)})`;
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
          const shape = waveformShape[index] ?? 0.5;
          bar.style.transform = `scaleY(${Math.min(1, Math.max(0.12, volume * (0.55 + shape * 0.45)))})`;
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

  const filteredMeetings = useMemo(() => {
    const query = normalizeSearch(search.trim());
    if (!query) {
      return meetingsQuery.data ?? [];
    }
    return (meetingsQuery.data ?? []).filter((meeting) =>
      normalizeSearch(
        [
          meeting.title,
          meeting.insights?.summary,
          meeting.transcript,
          meeting.utterances?.map((utterance) => utterance.text).join(' '),
        ]
          .filter(Boolean)
          .join(' '),
      ).includes(query),
    );
  }, [meetingsQuery.data, search]);

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  };

  const start = async () => {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
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
      recorder.start(5000);
      animateWaveform();
      setElapsed(0);
      setRecording('recording');
    } catch {
      stopWaveform(true);
      stopStream();
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
    stopWaveform(true);
    stopStream();
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
      className={
        fullscreen
          ? 'fixed inset-0 z-50 overflow-y-auto bg-surface-primary'
          : 'grid items-start gap-6 lg:grid-cols-[360px_minmax(0,1fr)]'
      }
    >
      {fullscreen && (
        <div className="bg-surface-primary/95 sticky top-0 z-10 border-b border-border-light px-6 py-3 backdrop-blur">
          <div className="mx-auto flex max-w-7xl justify-end">
            <button
              type="button"
              onClick={() => setFullscreen((value) => !value)}
              className="btn btn-neutral transition active:scale-[0.98]"
            >
              <ArrowsIn className="h-4 w-4" />
              {localize('com_ui_meeting_collapse')}
            </button>
          </div>
        </div>
      )}
      <aside
        className={
          fullscreen
            ? 'hidden'
            : 'overflow-hidden rounded-2xl border border-border-light bg-surface-secondary'
        }
      >
        {canEdit && (
          <section className="p-5 pb-6">
            <div className="mb-5 flex items-start justify-between">
              <div>
                <h2 className="text-base font-semibold tracking-tight text-text-primary">
                  {localize('com_ui_meeting_recorder')}
                </h2>
                <div className="mt-1 flex items-center gap-1.5 text-xs text-text-secondary">
                  <span
                    className={`size-2 rounded-full ${recording === 'recording' ? 'animate-pulse bg-green-500' : 'bg-text-tertiary'}`}
                  />
                  {localize(`com_ui_meeting_recorder_${recording}`)}
                </div>
              </div>
              <span className="font-mono text-lg tabular-nums text-text-primary">
                {formatTime(elapsed)}
              </span>
            </div>
            {(recording === 'recording' || recording === 'paused') && (
              <AudioWaveform
                active={recording === 'recording'}
                barRefs={waveformBarRefs}
                label={localize(
                  recording === 'recording'
                    ? 'com_ui_meeting_waveform_recording'
                    : 'com_ui_meeting_waveform_inactive',
                )}
              />
            )}
            <div className="mt-4 space-y-2">
              {recording === 'idle' && !pendingUpload && (
                <div className="flex items-start justify-center gap-12 py-2">
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
            {error && (
              <p className="mt-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-500">
                {error}
              </p>
            )}
          </section>
        )}

        <section className="border-t border-border-light">
          <div className="flex items-center justify-between border-b border-border-light px-4 py-3">
            <h2 className="text-sm font-semibold text-text-primary">
              {localize('com_ui_meeting_history')}
            </h2>
            <span className="font-mono text-xs tabular-nums text-text-tertiary">
              {filteredMeetings.length}
            </span>
          </div>
          <div className="border-b border-border-light p-3">
            <label className="relative block">
              <span className="sr-only">{localize('com_ui_meeting_search')}</span>
              <MagnifyingGlass
                aria-hidden="true"
                className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-tertiary"
              />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={localize('com_ui_meeting_search_placeholder')}
                className="focus:ring-ring-primary/30 h-10 w-full rounded-lg border border-border-light bg-surface-primary pl-9 pr-3 text-sm text-text-primary outline-none transition placeholder:text-text-tertiary focus:border-border-medium focus:ring-2"
              />
            </label>
          </div>
          <div className="divide-y divide-border-light">
            {filteredMeetings.map((meeting) => (
              <button
                type="button"
                key={meeting.id}
                onClick={() => openMeeting(meeting)}
                aria-current={selected?.id === meeting.id ? 'true' : undefined}
                className={`relative w-full px-4 py-3.5 text-left transition duration-200 hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring-primary ${
                  selected?.id === meeting.id ? 'bg-surface-hover' : ''
                }`}
              >
                {selected?.id === meeting.id && (
                  <span className="absolute inset-y-3 left-0 w-0.5 rounded-r-full bg-green-500" />
                )}
                <div className="truncate pr-2 text-sm font-medium text-text-primary">
                  {meeting.title}
                </div>
                <div
                  className="mt-1.5 flex items-center gap-1.5 text-xs text-text-secondary"
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
              <div className="px-6 py-10 text-center text-sm leading-6 text-text-secondary">
                {localize('com_ui_meeting_empty')}
              </div>
            )}
            {!meetingsQuery.isLoading &&
              Boolean(meetingsQuery.data?.length) &&
              !filteredMeetings.length && (
                <div className="px-6 py-10 text-center text-sm leading-6 text-text-secondary">
                  {localize('com_ui_meeting_search_empty')}
                </div>
              )}
          </div>
        </section>
      </aside>

      <main className={fullscreen ? 'mx-auto w-full max-w-7xl px-6 py-8' : 'min-w-0'}>
        <MeetingDetails
          meeting={selected}
          canEdit={canEdit}
          title={title}
          speakerNames={speakerNames}
          indexing={retryIndex.isLoading}
          generatingInsights={retryInsights.isLoading}
          canDelete={Boolean(selected && user?.id === selected.userId)}
          deleting={deleteMeeting.isLoading}
          expanded={fullscreen}
          onExpand={() => setFullscreen(true)}
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
      </main>
    </div>
  );
}
