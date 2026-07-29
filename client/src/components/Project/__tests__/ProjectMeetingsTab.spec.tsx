import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
    getProjectMeeting: (...args: unknown[]) => mockGetProjectMeeting(...args),
    getProjectMeetings: (...args: unknown[]) => mockGetProjectMeetings(...args),
    updateProjectMeetingSpeakers: jest.fn(),
  },
  DynamicQueryKeys: {
    projectMeetings: (projectId: string) => ['projectMeetings', projectId],
    projectFiles: (projectId: string) => ['projectFiles', projectId],
  },
}));

jest.mock('~/hooks', () => ({
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
      <ProjectMeetingsTab projectId="project-1" canEdit />
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
  });

  it('starts, pauses, resumes, finishes and submits browser audio', async () => {
    renderTab();

    fireEvent.click(screen.getByText('com_ui_meeting_start'));
    await screen.findByText('com_ui_meeting_pause');
    fireEvent.click(screen.getByText('com_ui_meeting_pause'));
    fireEvent.click(screen.getByText('com_ui_meeting_resume'));
    fireEvent.click(screen.getByText('com_ui_meeting_finish'));

    await waitFor(() => expect(mockCreateProjectMeeting).toHaveBeenCalledTimes(1));
    expect(mockSaveMeetingChunk).toHaveBeenCalledWith('recording-1', 0, expect.any(Blob));
    expect(stopTrack).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(mockDeleteMeetingChunks).toHaveBeenCalledWith('recording-1'));
  });

  it('shows a localized error when microphone permission is denied', async () => {
    getUserMedia.mockRejectedValue(new DOMException('Denied', 'NotAllowedError'));
    renderTab();

    fireEvent.click(screen.getByText('com_ui_meeting_start'));

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
  });
});
