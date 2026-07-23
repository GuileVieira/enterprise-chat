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
  recordedAt: '2026-07-23T13:00:00.000Z',
  createdAt: '2026-07-23T13:01:00.000Z',
  updatedAt: '2026-07-23T13:02:00.000Z',
};

describe('MeetingDetails', () => {
  it('uses one renamed speaker label across every transcript occurrence', () => {
    const onSpeakerChange = jest.fn();
    const onSave = jest.fn();
    const { rerender } = render(
      <MeetingDetails
        meeting={meeting}
        canEdit
        speakerNames={{ A: 'Speaker A' }}
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
        speakerNames={{ A: 'Ana' }}
        onSpeakerChange={onSpeakerChange}
        onSave={onSave}
      />,
    );
    expect(screen.getAllByText(/Ana/)).toHaveLength(2);

    fireEvent.click(screen.getByText('com_ui_save'));
    expect(onSave).toHaveBeenCalledTimes(1);
  });
});
