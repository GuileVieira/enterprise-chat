import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { TrafficDiaryWorkspace } from './trafficDiaryWorkspace';

const mockSave = jest.fn();
const mockComplete = jest.fn();
const mockReopen = jest.fn();
let mockEntries: unknown[] = [];

jest.mock('~/data-provider', () => ({
  useProjectMetaAdsDiaryQuery: () => ({ data: { entries: mockEntries } }),
  useSaveProjectMetaAdsDiaryMutation: () => ({ mutateAsync: mockSave, isLoading: false }),
  useCompleteProjectMetaAdsDiaryMutation: () => ({
    mutateAsync: mockComplete,
    isLoading: false,
  }),
  useReopenProjectMetaAdsDiaryMutation: () => ({ mutateAsync: mockReopen, isLoading: false }),
}));

jest.mock('~/hooks', () => ({
  useLocalize: () => (key: string) => key,
}));

describe('TrafficDiaryWorkspace', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockEntries = [];
    mockSave.mockResolvedValue({
      _id: 'entry-1',
      projectId: 'project-1',
      weekStart: '2026-07-06',
      status: 'draft',
      answers: [],
      createdBy: { id: 'user-1', name: 'Guilherme' },
      events: [],
    });
  });

  it('saves six default answers as a weekly draft', async () => {
    render(
      <TrafficDiaryWorkspace
        project={{ projectId: 'project-1', name: 'Cliente' }}
        canEdit={true}
        onAnalyze={jest.fn()}
      />,
    );

    const fields = screen.getAllByRole('textbox');
    fields.forEach((field, index) => {
      fireEvent.change(field, { target: { value: `Resposta ${index + 1}` } });
    });
    fireEvent.click(screen.getByText('com_ui_project_meta_ads_diary_save'));

    await waitFor(() => {
      expect(mockSave).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: 'project-1',
          answers: expect.arrayContaining([
            expect.objectContaining({ id: 'measurement', answer: 'Resposta 1' }),
            expect.objectContaining({ id: 'next_steps', answer: 'Resposta 6' }),
          ]),
        }),
      );
    });
  });

  it('shows saved weeks with author and update date in history', () => {
    mockEntries = [
      {
        _id: 'entry-1',
        projectId: 'project-1',
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
        onAnalyze={jest.fn()}
      />,
    );

    expect(screen.getByText('com_ui_project_meta_ads_diary_history')).toBeInTheDocument();
    expect(screen.getAllByText('Guilherme').length).toBeGreaterThan(0);
    expect(screen.getByText('com_ui_project_meta_ads_diary_completed')).toBeInTheDocument();
  });

  it('saves a new week before completing it', async () => {
    render(
      <TrafficDiaryWorkspace
        project={{ projectId: 'project-1', name: 'Cliente' }}
        canEdit={true}
        onAnalyze={jest.fn()}
      />,
    );

    fireEvent.click(screen.getByText('com_ui_project_meta_ads_diary_complete'));

    await waitFor(() => {
      expect(mockSave).toHaveBeenCalled();
      expect(mockComplete).toHaveBeenCalledWith({ projectId: 'project-1', entryId: 'entry-1' });
    });
  });
});
