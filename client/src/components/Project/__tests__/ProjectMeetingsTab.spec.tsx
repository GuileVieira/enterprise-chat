import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ProjectMeetingsTab from '../ProjectMeetingsTab';

const mockCreateProjectMeeting = jest.fn();
const mockDeleteMeetingChunks = jest.fn();
const mockGetProjectMeeting = jest.fn();
const mockGetProjectMeetings = jest.fn();
const mockReadMeetingChunks = jest.fn();
const mockSaveMeetingChunk = jest.fn();

jest.mock('librechat-data-provider', () => ({
  dataService: {
    createProjectMeeting: (...args: unknown[]) => mockCreateProjectMeeting(...args),
    deleteProjectMeeting: jest.fn(),
    getProjectMeeting: (...args: unknown[]) => mockGetProjectMeeting(...args),
    getProjectMeetings: (...args: unknown[]) => mockGetProjectMeetings(...args),
    retryProjectMeetingIndex: jest.fn(),
    retryProjectMeetingInsights: jest.fn(),
    updateProjectMeeting: jest.fn(),
    updateProjectMeetingSpeakers: jest.fn(),
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
  deleteMeetingChunks: (...args: unknown[]) => mockDeleteMeetingChunks(...args),
  readMeetingChunks: (...args: unknown[]) => mockReadMeetingChunks(...args),
  saveMeetingChunk: (...args: unknown[]) => mockSaveMeetingChunk(...args),
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
    Object.defineProperty(global, 'MediaRecorder', {
      configurable: true,
      value: FakeMediaRecorder,
    });
    getUserMedia.mockResolvedValue({
      getTracks: () => [{ stop: stopTrack }],
    });
    mockSaveMeetingChunk.mockResolvedValue(undefined);
    mockGetProjectMeetings.mockResolvedValue([]);
    mockReadMeetingChunks.mockResolvedValue([new Blob(['audio'], { type: 'audio/webm' })]);
    mockDeleteMeetingChunks.mockResolvedValue(undefined);
    mockCreateProjectMeeting.mockResolvedValue({
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
    expect(
      screen.getByRole('img', { name: 'com_ui_meeting_waveform_recording' }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'com_ui_meeting_pause' }));
    expect(screen.getByRole('button', { name: 'com_ui_meeting_upload_audio' })).toBeDisabled();
    expect(screen.getByText('com_ui_meeting_recorder_paused')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'com_ui_meeting_resume' }));
    fireEvent.click(screen.getByRole('button', { name: 'com_ui_meeting_finish' }));

    await waitFor(() => expect(mockCreateProjectMeeting).toHaveBeenCalledTimes(1));
    expect(mockSaveMeetingChunk).toHaveBeenCalledWith('recording-1', 0, expect.any(Blob));
    expect(stopTrack).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(mockDeleteMeetingChunks).toHaveBeenCalledWith('recording-1'));
  });

  it('shows a localized error when microphone permission is denied', async () => {
    getUserMedia.mockRejectedValue(new DOMException('Denied', 'NotAllowedError'));
    renderTab();

    fireEvent.click(screen.getByRole('button', { name: 'com_ui_meeting_start' }));

    expect(await screen.findByText('com_ui_meeting_microphone_denied')).toBeInTheDocument();
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

    fireEvent.change(document.querySelector('input[type="file"]') as HTMLInputElement, {
      target: { files: [audio] },
    });

    await waitFor(() => expect(mockCreateProjectMeeting).toHaveBeenCalledTimes(1));
    const form = mockCreateProjectMeeting.mock.calls[0][1] as FormData;
    expect(form.get('audio')).toEqual(audio);
    expect(form.get('duration')).toBe('0');
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
