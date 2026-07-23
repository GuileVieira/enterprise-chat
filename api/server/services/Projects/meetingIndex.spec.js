const { formatMeetingIndexText, getMeetingFileId } = require('./meetingIndex');

describe('meetingIndex', () => {
  const meeting = {
    _id: 'meeting-1',
    title: 'Planejamento',
    recordedAt: '2026-07-23T13:00:00.000Z',
    duration: 125,
    speakerNames: new Map([
      ['A', 'Ana'],
      ['B', 'Bruno'],
    ]),
    utterances: [
      { speaker: 'A', start: 1000, end: 4000, text: 'Vamos lançar sexta.' },
      { speaker: 'B', start: 65000, end: 68000, text: 'Eu preparo a campanha.' },
    ],
    insights: {
      summary: 'Equipe alinhou o lançamento.',
      decisions: ['Lançar sexta.'],
      nextSteps: ['Preparar campanha.'],
      tasks: ['Bruno prepara a campanha.'],
    },
  };

  it('indexes dated, timed and named utterances with generated insights', () => {
    const text = formatMeetingIndexText(meeting, {
      projectId: 'project-1',
      name: 'Projeto Alpha',
    });

    expect(getMeetingFileId(meeting)).toBe('meeting:meeting-1');
    expect(text).toContain('Data: 2026-07-23T13:00:00.000Z');
    expect(text).toContain('[0:01] Ana: Vamos lançar sexta.');
    expect(text).toContain('[1:05] Bruno: Eu preparo a campanha.');
    expect(text).toContain('## Decisões\n- Lançar sexta.');
    expect(text).toContain('## Próximos passos\n- Preparar campanha.');
  });
});
