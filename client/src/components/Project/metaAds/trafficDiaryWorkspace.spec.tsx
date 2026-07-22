import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { TrafficDiaryWorkspace } from './trafficDiaryWorkspace';

const mockSave = jest.fn();
const mockDelete = jest.fn();
let mockEntries: unknown[] = [];

jest.mock('~/data-provider', () => ({
  useProjectMetaAdsDiaryQuery: () => ({ data: { entries: mockEntries } }),
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

  it('shows another user diary for the same day with its author in read-only mode', () => {
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
});
