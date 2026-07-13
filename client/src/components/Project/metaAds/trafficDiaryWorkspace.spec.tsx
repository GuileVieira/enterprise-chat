import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { TrafficDiaryWorkspace } from './trafficDiaryWorkspace';

const mockSave = jest.fn();
const mockComplete = jest.fn();
const mockReopen = jest.fn();

jest.mock('~/data-provider', () => ({
  useProjectMetaAdsDiaryQuery: () => ({ data: { entries: [] } }),
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
});
