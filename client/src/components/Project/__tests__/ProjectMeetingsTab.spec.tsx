import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ProjectMeetingsTab from '../ProjectMeetingsTab';

const mockCreateProjectMeetingUpload = jest.fn();
const mockCompleteProjectMeetingUpload = jest.fn();
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

jest.mock('librechat-data-provider', () => ({
  dataService: {
    createProjectMeetingUpload: (...args: unknown[]) => mockCreateProjectMeetingUpload(...args),
    completeProjectMeetingUpload: (...args: unknown[]) => mockCompleteProjectMeetingUpload(...args),
    deleteProjectMeeting: jest.fn(),
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

jest.mock('~/hooks', () => ({
  useAuthContext: () => ({ user: { id: 'user-1' } }),
  useLocalize: () => (key: string) => key,
}));

jest.mock('../meetingStorage', () => ({
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
  mimeType: string;
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;

  constructor(_stream: MediaStream, options?: MediaRecorderOptions) {
    this.mimeType = options?.mimeType ?? 'audio/webm';
  }

  start() {}

  pause() {}

  resume() {}

  stop() {
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
    mockGetProjectMeetings.mockResolvedValue([]);
    mockListMeetingChunkIndexes.mockResolvedValue([]);
    mockListMeetingRecordings.mockResolvedValue([]);
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
    expect(mockSaveMeetingChunk).toHaveBeenCalledWith('recording-1', 0, expect.any(Blob));
    expect(mockUploadProjectMeetingChunk).toHaveBeenCalledWith(
      'project-1',
      'meeting-1',
      0,
      expect.any(Blob),
    );
    expect(stopTrack).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(mockDeleteMeetingChunks).toHaveBeenCalledWith('recording-1'));
  });

  it('shows a localized error when microphone permission is denied', async () => {
    getUserMedia.mockRejectedValue(new DOMException('Denied', 'NotAllowedError'));
    renderTab();

    fireEvent.click(screen.getByRole('button', { name: 'com_ui_meeting_start' }));

    expect(await screen.findByText('com_ui_meeting_microphone_denied')).toBeInTheDocument();
  });

  it('restores and completes a pending chunked upload after reload', async () => {
    mockListMeetingRecordings.mockResolvedValue([
      {
        key: 'recording-pending',
        meetingId: 'meeting-pending',
        projectId: 'project-1',
        mimeType: 'audio/webm',
        duration: 1800,
        recordedAt: '2026-08-04T15:00:00.000Z',
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
    expect(mockDeleteMeetingChunks).toHaveBeenCalledWith('recording-pending');
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
