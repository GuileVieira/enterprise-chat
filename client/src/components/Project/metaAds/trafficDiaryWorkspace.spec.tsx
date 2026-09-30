import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

import { TrafficDiaryWorkspace } from './trafficDiaryWorkspace';

const mockSave = jest.fn();
const mockDelete = jest.fn();
let mockEntries: unknown[] = [];
let mockSpeechConfig = { speechToText: true };
class MockRecognition {
  static latest: MockRecognition;
  lang = '';
  continuous = false;
  interimResults = true;
  onresult:
    | ((event: {
        resultIndex: number;
        results: { isFinal: boolean; 0: { transcript: string } }[];
      }) => void)
    | null = null;

  onerror: ((event: { error: string }) => void) | null = null;
  onend: (() => void) | null = null;
  start = jest.fn();
  stop = jest.fn();
  abort = jest.fn();
  constructor() {
    MockRecognition.latest = this;
  }
}
jest.mock('librechat-data-provider/react-query', () => ({
  useGetCustomConfigSpeechQuery: () => ({ data: mockSpeechConfig }),
}));

jest.mock('~/data-provider', () => ({
  useProjectMetaAdsDiaryQuery: (_projectId: string, kind: string) => ({
    data: {
      entries: mockEntries.filter(
        (entry) => ((entry as { kind?: string }).kind ?? 'manager') === kind,
      ),
    },
  }),
  useSaveProjectMetaAdsDiaryMutation: () => ({ mutateAsync: mockSave, isLoading: false }),
  useDeleteProjectMetaAdsDiaryMutation: () => ({ mutateAsync: mockDelete, isLoading: false }),
}));

jest.mock('~/hooks', () => ({
  useLocalize: () => (key: string) => key,
}));

describe('TrafficDiaryWorkspace', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(window, 'confirm').mockReturnValue(true);
    mockEntries = [];
    mockSpeechConfig = { speechToText: true };
    Object.defineProperty(window, 'webkitSpeechRecognition', {
      configurable: true,
      value: MockRecognition,
    });
    mockSave.mockResolvedValue({
      _id: 'entry-1',
      projectId: 'project-1',
      userId: 'user-1',
      kind: 'manager',
      date: '2026-07-13',
      weekStart: '2026-07-06',
      status: 'draft',
      answers: [],
      createdBy: { id: 'user-1', name: 'Guilherme' },
      events: [],
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('saves partial daily progress as a draft', async () => {
    render(
      <TrafficDiaryWorkspace
        project={{ projectId: 'project-1', name: 'Cliente' }}
        canEdit={true}
        currentUserId="user-1"
        onAnalyze={jest.fn()}
      />,
    );

    expect(screen.queryByText('com_ui_project_meta_ads_diary_save')).not.toBeInTheDocument();

    fireEvent.change(screen.getAllByRole('textbox')[0], { target: { value: 'CPA melhorou.' } });
    fireEvent.click(screen.getByText('com_ui_project_meta_ads_diary_save'));

    await waitFor(() => {
      expect(mockSave).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: 'project-1',
          kind: 'manager',
          answers: expect.arrayContaining([
            expect.objectContaining({
              id: 'measurement',
              answer: 'CPA melhorou.',
            }),
          ]),
        }),
      );
    });
  });

  it('saves strategist answers without touching manager diary answers', async () => {
    render(
      <TrafficDiaryWorkspace
        project={{ projectId: 'project-1', name: 'Cliente' }}
        canEdit={true}
        currentUserId="user-1"
        onAnalyze={jest.fn()}
      />,
    );

    fireEvent.click(screen.getByText('com_ui_project_meta_ads_strategy_diary_tab'));
    fireEvent.change(screen.getAllByRole('textbox')[0], {
      target: { value: 'Focar oferta de avaliação.' },
    });
    fireEvent.click(screen.getByText('com_ui_project_meta_ads_diary_save'));

    await waitFor(() => {
      expect(mockSave).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: 'project-1',
          kind: 'strategist',
          answers: expect.arrayContaining([
            expect.objectContaining({
              id: 'weekly_goal',
              answer: 'Focar oferta de avaliação.',
            }),
          ]),
        }),
      );
    });
  });

  it('lets the strategist add custom questions near the top of the form', () => {
    render(
      <TrafficDiaryWorkspace
        project={{ projectId: 'project-1', name: 'Cliente' }}
        canEdit={true}
        currentUserId="user-1"
        onAnalyze={jest.fn()}
      />,
    );

    fireEvent.click(screen.getByText('com_ui_project_meta_ads_strategy_diary_tab'));
    fireEvent.click(screen.getByText('com_ui_project_meta_ads_diary_add_question'));

    expect(
      screen.getByPlaceholderText('com_ui_project_meta_ads_diary_extra_question'),
    ).toBeVisible();
  });

  it('shows saved weeks with author and update date in history', () => {
    mockEntries = [
      {
        _id: 'entry-1',
        projectId: 'project-1',
        userId: 'user-1',
        date: '2026-07-06',
        weekStart: '2026-07-06',
        status: 'completed',
        answers: [{ id: 'strategy', question: 'Estratégia', answer: 'Testar criativo.' }],
        createdBy: { id: 'user-1', name: 'Guilherme' },
        events: [],
        updatedAt: '2026-07-13T10:00:00.000Z',
      },
    ];

    render(
      <TrafficDiaryWorkspace
        project={{ projectId: 'project-1', name: 'Cliente' }}
        canEdit={true}
        currentUserId="user-1"
        onAnalyze={jest.fn()}
      />,
    );

    expect(screen.getByText('com_ui_project_meta_ads_diary_history')).toBeInTheDocument();
    expect(screen.getAllByText('Guilherme').length).toBeGreaterThan(0);
    expect(screen.getByText('com_ui_project_meta_ads_diary_completed')).toBeInTheDocument();
  });

  it('shows manager and strategist diaries from other users with author names', () => {
    const parts = new Intl.DateTimeFormat('en-CA', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).formatToParts(new Date());
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    const currentDate = `${values.year}-${values.month}-${values.day}`;
    mockEntries = [
      {
        _id: 'entry-owner',
        projectId: 'project-1',
        userId: 'user-1',
        date: currentDate,
        weekStart: currentDate,
        status: 'draft',
        answers: [{ id: 'strategy', question: 'Estratégia', answer: 'Meu diário.' }],
        createdBy: { id: 'user-1', name: 'Owner' },
        events: [],
      },
      {
        _id: 'entry-manager',
        projectId: 'project-1',
        userId: 'manager-1',
        date: currentDate,
        weekStart: currentDate,
        status: 'draft',
        answers: [{ id: 'strategy', question: 'Estratégia', answer: 'Diário do gestor.' }],
        createdBy: { id: 'manager-1', name: 'Marcelo' },
        events: [],
      },
      {
        _id: 'entry-strategist',
        projectId: 'project-1',
        userId: 'manager-2',
        kind: 'strategist',
        date: currentDate,
        weekStart: currentDate,
        status: 'draft',
        answers: [{ id: 'weekly_goal', question: 'Objetivo', answer: 'Planejamento estratégico.' }],
        createdBy: { id: 'manager-2', name: 'Fernanda' },
        events: [],
      },
    ];

    render(
      <TrafficDiaryWorkspace
        project={{ projectId: 'project-1', name: 'Cliente' }}
        canEdit={true}
        currentUserId="user-1"
        onAnalyze={jest.fn()}
      />,
    );

    expect(screen.getByDisplayValue('Meu diário.')).toBeEnabled();
    fireEvent.click(screen.getByText('Marcelo'));
    expect(screen.getByDisplayValue('Diário do gestor.')).toBeDisabled();
    expect(screen.queryByText('com_ui_project_meta_ads_diary_delete')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('com_ui_project_meta_ads_strategy_diary_tab'));
    fireEvent.click(screen.getByText('Fernanda'));
    expect(screen.getByDisplayValue('Planejamento estratégico.')).toBeDisabled();
    expect(screen.queryByText('Marcelo')).not.toBeInTheDocument();
  });

  it('keeps a completed daily record editable and saves it directly', async () => {
    mockEntries = [
      {
        _id: 'entry-1',
        projectId: 'project-1',
        userId: 'user-1',
        date: '2026-07-06',
        weekStart: '2026-07-06',
        status: 'completed',
        answers: [{ id: 'strategy', question: 'Estratégia', answer: 'Testar criativo.' }],
        createdBy: { id: 'user-1', name: 'Guilherme' },
        events: [],
      },
    ];
    render(
      <TrafficDiaryWorkspace
        project={{ projectId: 'project-1', name: 'Cliente' }}
        canEdit={true}
        currentUserId="user-1"
        onAnalyze={jest.fn()}
      />,
    );

    fireEvent.click(screen.getByText('6 de jul. de 2026'));
    expect(screen.queryByText('com_ui_project_meta_ads_diary_save')).not.toBeInTheDocument();

    fireEvent.change(screen.getByDisplayValue('Testar criativo.'), {
      target: { value: 'Testar criativo atualizado.' },
    });
    fireEvent.click(screen.getByText('com_ui_project_meta_ads_diary_save'));

    await waitFor(() => {
      expect(mockSave).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: 'project-1',
          date: '2026-07-06',
          entryId: 'entry-1',
          answers: expect.arrayContaining([
            expect.objectContaining({
              id: 'strategy',
              answer: 'Testar criativo atualizado.',
            }),
          ]),
        }),
      );
    });
    expect(screen.queryByText('com_ui_project_meta_ads_diary_complete')).not.toBeInTheDocument();
  });

  it('deletes a selected diary record', async () => {
    mockEntries = [
      {
        _id: 'entry-1',
        projectId: 'project-1',
        userId: 'user-1',
        date: '2026-07-06',
        weekStart: '2026-07-06',
        status: 'draft',
        answers: [{ id: 'strategy', question: 'Estratégia', answer: 'Testar criativo.' }],
        createdBy: { id: 'user-1', name: 'Guilherme' },
        events: [],
      },
    ];
    mockDelete.mockResolvedValue(undefined);

    render(
      <TrafficDiaryWorkspace
        project={{ projectId: 'project-1', name: 'Cliente' }}
        canEdit={true}
        currentUserId="user-1"
        onAnalyze={jest.fn()}
      />,
    );

    fireEvent.click(screen.getByText('6 de jul. de 2026'));
    fireEvent.click(screen.getByText('com_ui_project_meta_ads_diary_delete'));

    await waitFor(() => {
      expect(mockDelete).toHaveBeenCalledWith({
        projectId: 'project-1',
        entryId: 'entry-1',
        kind: 'manager',
      });
    });
  });
  it('creates multiple same-day entries, then updates the selected entry by ID', async () => {
    mockSave.mockImplementation(
      async (input: {
        projectId: string;
        entryId?: string;
        kind: string;
        date: string;
        answers: { id: string; question: string; answer: string }[];
      }) => {
        const saved = {
          _id: input.entryId || `entry-${mockEntries.length + 1}`,
          projectId: input.projectId,
          userId: 'user-1',
          kind: input.kind,
          date: input.date,
          status: 'draft',
          answers: input.answers,
          createdBy: { id: 'user-1', name: 'Guilherme' },
          events: [],
        };
        mockEntries = [
          ...mockEntries.filter((entry) => (entry as { _id: string })._id !== saved._id),
          saved,
        ];
        return saved;
      },
    );
    render(
      <TrafficDiaryWorkspace
        project={{ projectId: 'project-1', name: 'Cliente' }}
        canEdit={true}
        currentUserId="user-1"
        onAnalyze={jest.fn()}
      />,
    );
    fireEvent.change(screen.getAllByRole('textbox')[0], { target: { value: 'Primeiro' } });
    fireEvent.click(screen.getByText('com_ui_project_meta_ads_diary_save'));
    await waitFor(() =>
      expect(screen.queryByText('com_ui_project_meta_ads_diary_save')).not.toBeInTheDocument(),
    );
    fireEvent.click(screen.getAllByText('com_ui_project_meta_ads_diary_new_entry')[0]);
    expect(screen.getAllByRole('textbox')[0]).toHaveValue('');
    fireEvent.change(screen.getAllByRole('textbox')[0], { target: { value: 'Segundo' } });
    fireEvent.click(screen.getByText('com_ui_project_meta_ads_diary_save'));
    await waitFor(() => expect(mockSave).toHaveBeenCalledTimes(2));
    expect(mockSave.mock.calls[0][0].entryId).toBeUndefined();
    expect(mockSave.mock.calls[1][0].entryId).toBeUndefined();
    expect(mockSave.mock.calls[1][0].date).toBe(mockSave.mock.calls[0][0].date);
    expect(screen.getAllByText('Guilherme')).toHaveLength(2);
    fireEvent.click(screen.getAllByText('Guilherme')[0]);
    expect(screen.getByDisplayValue('Primeiro')).toBeEnabled();
    fireEvent.change(screen.getByDisplayValue('Primeiro'), {
      target: { value: 'Primeiro editado' },
    });
    fireEvent.click(screen.getByText('com_ui_project_meta_ads_diary_save'));
    await waitFor(() => expect(mockSave).toHaveBeenCalledTimes(3));
    expect(mockSave.mock.calls[2][0].entryId).toBe('entry-1');
    expect(mockEntries).toHaveLength(2);
  });

  it('dictates into the selected field without replacing typed text or submitting', () => {
    const onAnalyze = jest.fn();
    const { unmount } = render(
      <TrafficDiaryWorkspace
        project={{ projectId: 'project-1', name: 'Cliente' }}
        canEdit={true}
        currentUserId="user-1"
        onAnalyze={onAnalyze}
      />,
    );
    fireEvent.change(screen.getAllByRole('textbox')[1], { target: { value: 'Texto escrito.' } });
    fireEvent.click(screen.getAllByText('com_ui_project_meta_ads_diary_dictate')[1]);
    const recognition = MockRecognition.latest;
    expect(recognition.lang).toBe('pt-BR');
    expect(recognition.start).toHaveBeenCalledTimes(1);
    act(() =>
      recognition.onresult?.({
        resultIndex: 0,
        results: [{ isFinal: true, 0: { transcript: 'Fala transcrita.' } }],
      }),
    );
    expect(screen.getByDisplayValue('Texto escrito. Fala transcrita.')).toBeVisible();
    expect(screen.getAllByRole('textbox')[0]).toHaveValue('');
    expect(mockSave).not.toHaveBeenCalled();
    expect(onAnalyze).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('com_ui_project_meta_ads_diary_stop_dictation'));
    expect(recognition.stop).toHaveBeenCalledTimes(1);
    unmount();
    expect(recognition.abort).toHaveBeenCalledTimes(1);
    expect(recognition.onresult).toBeNull();
  });

  it('stops dictation when switching diary and reports microphone denial', () => {
    render(
      <TrafficDiaryWorkspace
        project={{ projectId: 'project-1', name: 'Cliente' }}
        canEdit={true}
        currentUserId="user-1"
        onAnalyze={jest.fn()}
      />,
    );
    fireEvent.click(screen.getAllByText('com_ui_project_meta_ads_diary_dictate')[0]);
    const recognition = MockRecognition.latest;
    fireEvent.click(screen.getByText('com_ui_project_meta_ads_strategy_diary_tab'));
    expect(recognition.abort).toHaveBeenCalledTimes(1);
    expect(recognition.onresult).toBeNull();
    fireEvent.click(screen.getAllByText('com_ui_project_meta_ads_diary_dictate')[0]);
    act(() => MockRecognition.latest.onerror?.({ error: 'not-allowed' }));
    expect(screen.getByText('com_ui_microphone_unavailable')).toBeVisible();
  });

  it('hides microphones when admin disables speech or browser lacks recognition', () => {
    mockSpeechConfig = { speechToText: false };
    const props = {
      project: { projectId: 'project-1', name: 'Cliente' },
      canEdit: true,
      currentUserId: 'user-1',
      onAnalyze: jest.fn(),
    };
    const { rerender } = render(<TrafficDiaryWorkspace {...props} />);
    expect(screen.queryByText('com_ui_project_meta_ads_diary_dictate')).not.toBeInTheDocument();
    mockSpeechConfig = { speechToText: true };
    Object.defineProperty(window, 'webkitSpeechRecognition', {
      configurable: true,
      value: undefined,
    });
    rerender(<TrafficDiaryWorkspace {...props} />);
    expect(screen.queryByText('com_ui_project_meta_ads_diary_dictate')).not.toBeInTheDocument();
    expect(screen.getByText('com_ui_speech_not_supported')).toBeVisible();
  });
});
