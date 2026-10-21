import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ProjectMeetingsTab from '../ProjectMeetingsTab';

const mockCreateProjectMeetingUpload = jest.fn();
const mockCompleteProjectMeetingUpload = jest.fn();
const mockDeleteProjectMeeting = jest.fn();
const mockDeleteMeetingChunk = jest.fn();
const mockDeleteMeetingChunks = jest.fn();
const mockGetProjectMeeting = jest.fn();
const mockGetProjectMeetings = jest.fn();
const mockListMeetingChunkIndexes = jest.fn();
const mockListMeetingRecordings = jest.fn();
const mockReadMeetingChunk = jest.fn();
const mockSaveMeetingChunk = jest.fn();
const mockSaveMeetingRecording = jest.fn();
const mockUploadProjectMeetingChunk = jest.fn();
const mockExpireMeetingRecordings = jest.fn();
const mockLocalize = (key: string) => key;

jest.mock('librechat-data-provider', () => ({
  ...jest.requireActual('librechat-data-provider'),
  dataService: {
    createProjectMeetingUpload: (...args: unknown[]) => mockCreateProjectMeetingUpload(...args),
    completeProjectMeetingUpload: (...args: unknown[]) => mockCompleteProjectMeetingUpload(...args),
    deleteProjectMeeting: (...args: unknown[]) => mockDeleteProjectMeeting(...args),
    getProjectMeeting: (...args: unknown[]) => mockGetProjectMeeting(...args),
    getProjectMeetings: (...args: unknown[]) => mockGetProjectMeetings(...args),
    retryProjectMeetingIndex: jest.fn(),
    retryProjectMeetingInsights: jest.fn(),
    updateProjectMeeting: jest.fn(),
    updateProjectMeetingSpeakers: jest.fn(),
    uploadProjectMeetingChunk: (...args: unknown[]) => mockUploadProjectMeetingChunk(...args),
  },
  DynamicQueryKeys: {
    projectMeetings: (projectId: string) => ['projectMeetings', projectId],
    projectFiles: (projectId: string) => ['projectFiles', projectId],
  },
}));

jest.mock('~/utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), error: jest.fn() },
}));

jest.mock('~/hooks', () => ({
  useAuthContext: () => ({ user: { id: 'user-1' } }),
  useLocalize: () => mockLocalize,
}));

jest.mock('../meetingStorage', () => ({
  expireMeetingRecordings: (...args: unknown[]) => mockExpireMeetingRecordings(...args),
  MEETING_RECORDING_RETENTION_MS: 24 * 60 * 60 * 1000,
  deleteMeetingChunk: (...args: unknown[]) => mockDeleteMeetingChunk(...args),
  deleteMeetingChunks: (...args: unknown[]) => mockDeleteMeetingChunks(...args),
  listMeetingChunkIndexes: (...args: unknown[]) => mockListMeetingChunkIndexes(...args),
  listMeetingRecordings: (...args: unknown[]) => mockListMeetingRecordings(...args),
  readMeetingChunk: (...args: unknown[]) => mockReadMeetingChunk(...args),
  saveMeetingChunk: (...args: unknown[]) => mockSaveMeetingChunk(...args),
  saveMeetingRecording: (...args: unknown[]) => mockSaveMeetingRecording(...args),
}));

class FakeMediaRecorder {
  static isTypeSupported = () => true;
  static latest: FakeMediaRecorder;
  state: RecordingState = 'inactive';
  mimeType: string;
  audioBitsPerSecond: number;
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;

  constructor(_stream: MediaStream, options?: MediaRecorderOptions) {
    this.mimeType = options?.mimeType ?? 'audio/webm';
    this.audioBitsPerSecond = options?.audioBitsPerSecond ?? 128000;
    FakeMediaRecorder.latest = this;
  }

  start() {
    this.state = 'recording';
  }

  pause() {
    this.state = 'paused';
  }

  resume() {
    this.state = 'recording';
  }

  stop() {
    this.state = 'inactive';
    this.ondataavailable?.({ data: new Blob(['audio'], { type: this.mimeType }) });
    this.onstop?.();
  }
}

const renderTab = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <ProjectMeetingsTab projectId="project-1" canEdit />
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

describe('ProjectMeetingsTab recorder', () => {
  const stopTrack = jest.fn();
  const getUserMedia = jest.fn();
  const releaseWakeLock = jest.fn();
  const requestWakeLock = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(global, 'crypto', {
      configurable: true,
      value: { randomUUID: () => 'recording-1' },
    });
    Object.defineProperty(global.navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia },
    });
    Object.defineProperty(global.navigator, 'wakeLock', {
      configurable: true,
      value: { request: requestWakeLock },
    });
    Object.defineProperty(global, 'MediaRecorder', {
      configurable: true,
      value: FakeMediaRecorder,
    });
    getUserMedia.mockResolvedValue({
      getTracks: () => [{ stop: stopTrack }],
    });
    requestWakeLock.mockResolvedValue({
      addEventListener: jest.fn(),
      release: releaseWakeLock,
    });
    mockSaveMeetingChunk.mockResolvedValue(undefined);
    mockSaveMeetingRecording.mockResolvedValue(undefined);
    mockDeleteMeetingChunk.mockResolvedValue(undefined);
    mockGetProjectMeeting.mockResolvedValue({ id: 'meeting-1', status: 'uploading' });
    mockGetProjectMeetings.mockResolvedValue([]);
    mockListMeetingChunkIndexes.mockResolvedValue([]);
    mockListMeetingRecordings.mockResolvedValue([]);
    mockExpireMeetingRecordings.mockResolvedValue(null);
    mockReadMeetingChunk.mockResolvedValue(new Blob(['audio'], { type: 'audio/webm' }));
    mockDeleteMeetingChunks.mockResolvedValue(undefined);
    mockUploadProjectMeetingChunk.mockResolvedValue(undefined);
    mockCreateProjectMeetingUpload.mockResolvedValue({
      id: 'meeting-1',
      status: 'uploading',
      speakerNames: {},
    });
    mockCompleteProjectMeetingUpload.mockResolvedValue({
      id: 'meeting-1',
      status: 'processing',
      speakerNames: {},
    });
    Reflect.deleteProperty(global, 'AudioContext');
  });

  it('starts, pauses, resumes, finishes and submits browser audio', async () => {
    renderTab();

    fireEvent.click(screen.getByRole('button', { name: 'com_ui_meeting_start' }));
    await screen.findByRole('button', { name: 'com_ui_meeting_pause' });
    await waitFor(() => expect(requestWakeLock).toHaveBeenCalledWith('screen'));
    expect(screen.getByText('com_ui_meeting_keep_page_open')).toBeInTheDocument();
    expect(
      screen.getByRole('img', { name: 'com_ui_meeting_waveform_recording' }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'com_ui_meeting_pause' }));
    await waitFor(() => expect(releaseWakeLock).toHaveBeenCalledTimes(1));
    expect(screen.queryByText('com_ui_meeting_keep_page_open')).toBeNull();
    expect(screen.getByRole('button', { name: 'com_ui_meeting_upload_audio' })).toBeDisabled();
    expect(screen.getByText('com_ui_meeting_recorder_paused')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'com_ui_meeting_resume' }));
    await waitFor(() => expect(requestWakeLock).toHaveBeenCalledTimes(2));
    fireEvent.click(screen.getByRole('button', { name: 'com_ui_meeting_finish' }));

    await waitFor(() => expect(mockCompleteProjectMeetingUpload).toHaveBeenCalledTimes(1));
    expect(mockCreateProjectMeetingUpload).toHaveBeenCalledTimes(1);
    expect(FakeMediaRecorder.latest.audioBitsPerSecond).toBe(48000);
    expect(mockSaveMeetingChunk).toHaveBeenCalledWith('recording-1', 0, expect.any(Blob));
    expect(mockUploadProjectMeetingChunk).toHaveBeenCalledWith(
      'project-1',
      'meeting-1',
      0,
      expect.any(Blob),
    );
    expect(stopTrack).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(mockSaveMeetingRecording).toHaveBeenCalledWith(
        expect.objectContaining({ submitted: true, uploadedIndexes: [0] }),
      ),
    );
    expect(mockDeleteMeetingChunk).not.toHaveBeenCalled();
    expect(mockDeleteMeetingChunks).not.toHaveBeenCalled();
  });

  it('preserves local audio when the upload no longer exists and sends no chunks', async () => {
    mockListMeetingRecordings.mockResolvedValue([
      {
        key: 'missing',
        meetingId: 'missing',
        projectId: 'project-1',
        mimeType: 'audio/webm',
        duration: 10,
        totalChunks: 1,
        recordedAt: new Date().toISOString(),
      },
    ]);
    mockGetProjectMeeting.mockRejectedValueOnce({ response: { status: 404 } });
    renderTab();
    fireEvent.click(await screen.findByRole('button', { name: 'com_ui_meeting_retry_upload' }));
    expect(await screen.findByText('com_ui_meeting_upload_missing')).toBeInTheDocument();
    expect(mockUploadProjectMeetingChunk).not.toHaveBeenCalled();
    expect(mockDeleteMeetingChunks).not.toHaveBeenCalled();
  });

  it('cleans retained audio only after the server reports completed', async () => {
    mockListMeetingRecordings.mockResolvedValue([
      {
        key: 'completed-local',
        meetingId: 'completed',
        projectId: 'project-1',
        mimeType: 'audio/webm',
        duration: 10,
        totalChunks: 1,
        submitted: true,
        recordedAt: new Date().toISOString(),
      },
    ]);
    mockGetProjectMeeting.mockResolvedValueOnce({
      id: 'completed',
      status: 'completed',
      title: 'Completed',
      recordedAt: new Date().toISOString(),
      duration: 10,
      utterances: [],
      transcript: '',
      participants: [],
      insights: { summary: '', decisions: [], nextSteps: [], tasks: [] },
      speakerNames: {},
    });
    renderTab();
    fireEvent.click(await screen.findByRole('button', { name: 'com_ui_meeting_check_status' }));
    await waitFor(() => expect(mockDeleteMeetingChunks).toHaveBeenCalledWith('completed-local'));
    expect(mockUploadProjectMeetingChunk).not.toHaveBeenCalled();
    expect(mockCompleteProjectMeetingUpload).not.toHaveBeenCalled();
  });

  it('resumes without uploading acknowledged retained chunks again', async () => {
    mockListMeetingRecordings.mockResolvedValue([
      {
        key: 'retained',
        meetingId: 'retained',
        projectId: 'project-1',
        mimeType: 'audio/webm',
        duration: 10,
        totalChunks: 2,
        uploadedIndexes: [0],
        recordedAt: new Date().toISOString(),
      },
    ]);
    mockListMeetingChunkIndexes.mockResolvedValue([0, 1]);
    renderTab();
    fireEvent.click(await screen.findByRole('button', { name: 'com_ui_meeting_retry_upload' }));
    await waitFor(() => expect(mockCompleteProjectMeetingUpload).toHaveBeenCalled());
    expect(mockUploadProjectMeetingChunk).toHaveBeenCalledTimes(1);
    expect(mockUploadProjectMeetingChunk).toHaveBeenCalledWith(
      'project-1',
      'retained',
      1,
      expect.any(Blob),
    );
    expect(mockDeleteMeetingChunks).not.toHaveBeenCalled();
  });

  it('discards only the local backup after transcription submission', async () => {
    mockListMeetingRecordings.mockResolvedValue([
      {
        key: 'backup',
        meetingId: 'backup',
        projectId: 'project-1',
        submitted: true,
        mimeType: 'audio/webm',
        duration: 10,
        totalChunks: 1,
        recordedAt: new Date().toISOString(),
      },
    ]);
    renderTab();
    fireEvent.click(await screen.findByRole('button', { name: 'com_ui_meeting_discard_backup' }));
    expect(mockDeleteMeetingChunks).not.toHaveBeenCalled();
    expect(mockDeleteProjectMeeting).not.toHaveBeenCalled();
    expect(await screen.findByRole('dialog')).toHaveTextContent(
      'com_ui_meeting_discard_backup_confirm',
    );
    fireEvent.click(screen.getByRole('button', { name: 'com_ui_meeting_discard_confirm_action' }));
    await waitFor(() => expect(mockDeleteMeetingChunks).toHaveBeenCalledWith('backup'));
    expect(mockDeleteProjectMeeting).not.toHaveBeenCalled();
  });

  it('allows explicit discard when the server no longer has the upload', async () => {
    mockListMeetingRecordings.mockResolvedValue([
      {
        key: 'orphan',
        meetingId: 'orphan',
        projectId: 'project-1',
        mimeType: 'audio/webm',
        duration: 10,
        totalChunks: 1,
        recordedAt: new Date().toISOString(),
      },
    ]);
    mockDeleteProjectMeeting.mockRejectedValueOnce({ response: { status: 404 } });
    renderTab();
    fireEvent.click(await screen.findByRole('button', { name: 'com_ui_meeting_discard_upload' }));
    expect(mockDeleteMeetingChunks).not.toHaveBeenCalled();
    expect(mockDeleteProjectMeeting).not.toHaveBeenCalled();
    fireEvent.click(
      await screen.findByRole('button', { name: 'com_ui_meeting_discard_confirm_action' }),
    );
    await waitFor(() => expect(mockDeleteMeetingChunks).toHaveBeenCalledWith('orphan'));
  });

  it('explains call capture on keyboard focus without toggling recording source', async () => {
    renderTab();
    const hint = screen.getByRole('button', { name: 'com_ui_more_info' });
    act(() => hint.focus());
    expect(await screen.findByRole('tooltip')).toHaveTextContent(
      'com_ui_meeting_capture_call_hint',
    );
    expect(screen.getByRole('checkbox')).not.toBeChecked();
  });

  it('keeps audio when the discard confirmation is cancelled', async () => {
    mockListMeetingRecordings.mockResolvedValue([
      {
        key: 'keep',
        meetingId: 'keep',
        projectId: 'project-1',
        submitted: true,
        mimeType: 'audio/webm',
        duration: 10,
        totalChunks: 1,
        recordedAt: new Date().toISOString(),
      },
    ]);
    renderTab();
    fireEvent.click(await screen.findByRole('button', { name: 'com_ui_meeting_discard_backup' }));
    await screen.findByRole('dialog');
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(mockDeleteMeetingChunks).not.toHaveBeenCalled();
    expect(mockDeleteProjectMeeting).not.toHaveBeenCalled();
  });

  it('shows a localized error when microphone permission is denied', async () => {
    getUserMedia.mockRejectedValue(new DOMException('Denied', 'NotAllowedError'));
    renderTab();

    fireEvent.click(screen.getByRole('button', { name: 'com_ui_meeting_start' }));

    expect(await screen.findByText('com_ui_meeting_microphone_denied')).toBeInTheDocument();
  });

  it('stops capture and preserves the pending recording when local storage is full', async () => {
    renderTab();
    fireEvent.click(screen.getByRole('button', { name: 'com_ui_meeting_start' }));
    await screen.findByRole('button', { name: 'com_ui_meeting_pause' });
    mockSaveMeetingChunk.mockRejectedValueOnce(new DOMException('Full', 'QuotaExceededError'));
    mockReadMeetingChunk.mockResolvedValueOnce(undefined);
    await act(async () => {
      FakeMediaRecorder.latest.ondataavailable?.({ data: new Blob(['audio']) });
    });
    expect(await screen.findByText('com_ui_meeting_local_full')).toBeInTheDocument();
    expect(FakeMediaRecorder.latest.state).toBe('inactive');
    expect(stopTrack).toHaveBeenCalledTimes(1);
    expect(mockDeleteMeetingChunks).not.toHaveBeenCalled();
    expect(mockCompleteProjectMeetingUpload).not.toHaveBeenCalled();
    expect(mockSaveMeetingRecording).toHaveBeenLastCalledWith(
      expect.objectContaining({ totalChunks: 0 }),
    );
  });

  it('clears an expired pending upload while the page remains open', async () => {
    jest.useFakeTimers();
    const expiresAt = Date.now() + 60_000;
    const pending = {
      key: 'expiring',
      meetingId: 'expiring',
      projectId: 'project-1',
      mimeType: 'audio/webm',
      duration: 5,
      totalChunks: 1,
      recordedAt: new Date(expiresAt - 24 * 60 * 60 * 1000).toISOString(),
    };
    mockExpireMeetingRecordings.mockImplementation(async () =>
      Date.now() < expiresAt ? expiresAt : null,
    );
    mockListMeetingRecordings.mockImplementation(async () =>
      Date.now() < expiresAt ? [pending] : [],
    );
    const { unmount } = renderTab();
    try {
      await screen.findByRole('button', { name: 'com_ui_meeting_retry_upload' });
      await act(async () => {
        jest.advanceTimersByTime(60_000);
      });
      expect(
        await screen.findByRole('button', { name: 'com_ui_meeting_start' }),
      ).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'com_ui_meeting_retry_upload' })).toBeNull();
      expect(screen.getByText('com_ui_meeting_local_expired')).toBeInTheDocument();
    } finally {
      unmount();
      jest.useRealTimers();
    }
  });

  it('restores and completes a pending chunked upload after reload', async () => {
    mockListMeetingRecordings.mockResolvedValue([
      {
        key: 'recording-pending',
        meetingId: 'meeting-pending',
        projectId: 'project-1',
        mimeType: 'audio/webm',
        duration: 1800,
        recordedAt: new Date(Date.now() - 1800 * 1000).toISOString(),
        totalChunks: 2,
      },
    ]);
    mockListMeetingChunkIndexes.mockResolvedValue([1]);

    renderTab();
    fireEvent.click(await screen.findByRole('button', { name: 'com_ui_meeting_retry_upload' }));

    await waitFor(() =>
      expect(mockCompleteProjectMeetingUpload).toHaveBeenCalledWith(
        'project-1',
        'meeting-pending',
        2,
        1800,
      ),
    );
    expect(mockUploadProjectMeetingChunk).toHaveBeenCalledWith(
      'project-1',
      'meeting-pending',
      1,
      expect.any(Blob),
    );
    expect(mockDeleteMeetingChunks).not.toHaveBeenCalled();
    expect(mockSaveMeetingRecording).toHaveBeenCalledWith(
      expect.objectContaining({ submitted: true }),
    );
  });

  it('shows an accessible spinner while a transcript is processing', async () => {
    const meeting = {
      id: 'meeting-1',
      title: 'Reunião',
      status: 'processing',
      recordedAt: '2026-07-29T20:00:00.000Z',
      duration: 5,
      speakerNames: {},
    };
    mockGetProjectMeetings.mockResolvedValue([meeting]);
    mockGetProjectMeeting.mockResolvedValue(meeting);

    renderTab();

    const status = await screen.findByRole('status');
    expect(status).toHaveTextContent('com_ui_meeting_status_processing');
    expect(status.querySelector('.animate-spin')).toBeInTheDocument();
    expect(screen.getByText('com_ui_meeting_history')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Reunião/ }));
    expect(screen.getByRole('button', { name: /Reunião/ })).toHaveAttribute('aria-current', 'true');
  });

  it('uploads an existing audio file for transcription', async () => {
    renderTab();
    expect(screen.queryByRole('img', { name: 'com_ui_meeting_waveform_inactive' })).toBeNull();
    const audio = new File(['audio'], 'cliente.mp3', { type: 'audio/mpeg' });
    fireEvent.change(screen.getByText('com_ui_meeting_known_participants').nextElementSibling!, {
      target: { value: 'Ana, Bruno, Ana' },
    });

    fireEvent.change(document.querySelector('input[type="file"]') as HTMLInputElement, {
      target: { files: [audio] },
    });

    await waitFor(() => expect(mockCreateProjectMeetingUpload).toHaveBeenCalledTimes(1));
    expect(mockCreateProjectMeetingUpload).toHaveBeenCalledWith('project-1', {
      duration: 0,
      recordedAt: expect.any(String),
      mimeType: 'audio/mpeg',
      participants: ['Ana', 'Bruno'],
    });
    expect(mockUploadProjectMeetingChunk).toHaveBeenCalledWith(
      'project-1',
      'meeting-1',
      0,
      expect.any(Blob),
    );
    await waitFor(() => expect(mockCompleteProjectMeetingUpload).toHaveBeenCalledTimes(1));
  });

  it('filters meetings by title, summary, or transcript speech', async () => {
    mockGetProjectMeetings.mockResolvedValue([
      {
        id: 'meeting-sales',
        title: 'Reunião comercial',
        status: 'completed',
        recordedAt: '2026-07-31T20:00:00.000Z',
        duration: 30,
        insights: { summary: 'Negociação com cliente', decisions: [], nextSteps: [], tasks: [] },
        transcript: '',
        utterances: [],
        speakerNames: {},
      },
      {
        id: 'meeting-product',
        title: 'Produto',
        status: 'completed',
        recordedAt: '2026-07-30T20:00:00.000Z',
        duration: 20,
        insights: { summary: '', decisions: [], nextSteps: [], tasks: [] },
        transcript: 'Precisamos revisar a integração financeira',
        utterances: [],
        speakerNames: {},
      },
    ]);
    renderTab();

    const search = await screen.findByPlaceholderText('com_ui_meeting_search_placeholder');
    fireEvent.change(search, { target: { value: 'negociacao' } });
    expect(screen.getByText('Reunião comercial')).toBeInTheDocument();
    expect(screen.queryByText('Produto')).toBeNull();

    fireEvent.change(search, { target: { value: 'financeira' } });
    expect(screen.getByText('Produto')).toBeInTheDocument();
    expect(screen.queryByText('Reunião comercial')).toBeNull();
  });

  it('scales waveform bars from the real microphone signal level', async () => {
    const analyser = {
      fftSize: 256,
      smoothingTimeConstant: 0,
      getByteTimeDomainData: (samples: Uint8Array) => samples.fill(200),
    };
    class FakeAudioContext {
      createAnalyser = () => analyser;
      createMediaStreamSource = () => ({ connect: jest.fn() });
      close = jest.fn().mockResolvedValue(undefined);
    }
    Object.defineProperty(global, 'AudioContext', {
      configurable: true,
      value: FakeAudioContext,
    });
    jest.spyOn(global, 'requestAnimationFrame').mockReturnValue(1);
    renderTab();

    fireEvent.click(screen.getByRole('button', { name: 'com_ui_meeting_start' }));

    const waveform = await screen.findByRole('img', {
      name: 'com_ui_meeting_waveform_recording',
    });
    expect(waveform.querySelectorAll('[data-waveform-bar]')).toHaveLength(28);
    expect(waveform.querySelector('[data-waveform-bar]')).not.toHaveStyle({
      transform: 'scaleY(0.12)',
    });
  });
});
