import { fireEvent, render, screen } from '@testing-library/react';
import type { ProjectMeeting } from 'librechat-data-provider';
import MeetingDetails from '../MeetingDetails';

jest.mock('~/hooks', () => ({
  useLocalize: () => (key: string) => key,
}));

const meeting: ProjectMeeting = {
  id: 'meeting-1',
  projectId: 'project-1',
  userId: 'user-1',
  title: 'Reunião',
  status: 'completed',
  duration: 10,
  transcript: 'Primeira fala. Segunda fala.',
  utterances: [
    { speaker: 'A', text: 'Primeira fala.', start: 0, end: 1000 },
    { speaker: 'A', text: 'Segunda fala.', start: 2000, end: 3000 },
  ],
  speakerNames: { A: 'Ana' },
  insights: {
    summary: 'Resumo',
    decisions: [],
    nextSteps: ['Enviar proposta.'],
    tasks: [],
  },
  indexStatus: 'indexed',
  recordedAt: '2026-07-23T13:00:00.000Z',
  createdAt: '2026-07-23T13:01:00.000Z',
  updatedAt: '2026-07-23T13:02:00.000Z',
};

describe('MeetingDetails', () => {
  it('uses one renamed speaker label across every transcript occurrence', () => {
    const onSpeakerChange = jest.fn();
    const onSave = jest.fn();
    const onTitleChange = jest.fn();
    const onTitleSave = jest.fn();
    const { rerender } = render(
      <MeetingDetails
        meeting={meeting}
        canEdit
        title="Reunião"
        speakerNames={{ A: 'Speaker A' }}
        indexing={false}
        generatingInsights={false}
        onTitleChange={onTitleChange}
        onTitleSave={onTitleSave}
        onIndexRetry={jest.fn()}
        onInsightsRetry={jest.fn()}
        onSpeakerChange={onSpeakerChange}
        onSave={onSave}
      />,
    );

    fireEvent.change(screen.getByLabelText('Speaker A'), { target: { value: 'Ana' } });
    expect(onSpeakerChange).toHaveBeenCalledWith('A', 'Ana');

    rerender(
      <MeetingDetails
        meeting={meeting}
        canEdit
        title="Planejamento"
        speakerNames={{ A: 'Ana' }}
        indexing={false}
        generatingInsights={false}
        onTitleChange={onTitleChange}
        onTitleSave={onTitleSave}
        onIndexRetry={jest.fn()}
        onInsightsRetry={jest.fn()}
        onSpeakerChange={onSpeakerChange}
        onSave={onSave}
      />,
    );
    expect(screen.getAllByText(/Ana/)).toHaveLength(2);

    fireEvent.click(screen.getAllByText('com_ui_save')[1]);
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('edits the meeting title and exposes indexed agent access', () => {
    const onTitleChange = jest.fn();
    const onTitleSave = jest.fn();
    render(
      <MeetingDetails
        meeting={meeting}
        canEdit
        title="Reunião"
        speakerNames={{ A: 'Ana' }}
        indexing={false}
        generatingInsights={false}
        onTitleChange={onTitleChange}
        onTitleSave={onTitleSave}
        onIndexRetry={jest.fn()}
        onInsightsRetry={jest.fn()}
        onSpeakerChange={jest.fn()}
        onSave={jest.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText('com_ui_meeting_title'), {
      target: { value: 'Planejamento semanal' },
    });
    expect(onTitleChange).toHaveBeenCalledWith('Planejamento semanal');
    expect(screen.getByText('com_ui_meeting_index_indexed')).toBeInTheDocument();
  });

  it('retries a meeting that is not indexed', () => {
    const onIndexRetry = jest.fn();
    render(
      <MeetingDetails
        meeting={{ ...meeting, indexStatus: 'failed', indexError: 'File embedding failed.' }}
        canEdit
        title="Reunião"
        speakerNames={{ A: 'Ana' }}
        indexing={false}
        generatingInsights={false}
        onTitleChange={jest.fn()}
        onTitleSave={jest.fn()}
        onIndexRetry={onIndexRetry}
        onInsightsRetry={jest.fn()}
        onSpeakerChange={jest.fn()}
        onSave={jest.fn()}
      />,
    );

    fireEvent.click(screen.getByText('com_ui_meeting_retry_index'));
    expect(onIndexRetry).toHaveBeenCalledTimes(1);
    expect(screen.getByText('File embedding failed.')).toBeInTheDocument();
  });

  it('regenerates missing meeting insights', () => {
    const onInsightsRetry = jest.fn();
    render(
      <MeetingDetails
        meeting={{
          ...meeting,
          insights: { summary: '', decisions: [], nextSteps: [], tasks: [] },
        }}
        canEdit
        title="Reunião"
        speakerNames={{ A: 'Ana' }}
        indexing={false}
        generatingInsights={false}
        onTitleChange={jest.fn()}
        onTitleSave={jest.fn()}
        onIndexRetry={jest.fn()}
        onInsightsRetry={onInsightsRetry}
        onSpeakerChange={jest.fn()}
        onSave={jest.fn()}
      />,
    );

    fireEvent.click(screen.getByText('com_ui_meeting_generate_insights'));
    expect(onInsightsRetry).toHaveBeenCalledTimes(1);
  });
});
