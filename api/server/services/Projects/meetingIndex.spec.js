const { FileContext } = require('librechat-data-provider');
const {
  deleteMeetingIndex,
  formatMeetingIndexText,
  getMeetingFileId,
  syncMeetingIndex,
} = require('./meetingIndex');

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

  it('creates one project-scoped agent file after embedding succeeds', async () => {
    const createFile = jest.fn().mockResolvedValue({});
    const deleteVectorsFn = jest.fn().mockResolvedValue(undefined);
    const uploadVectorsFn = jest.fn().mockResolvedValue({
      filepath: 'vectordb',
      embedded: true,
    });

    await syncMeetingIndex({
      meeting: { ...meeting, userId: 'user-1' },
      project: { projectId: 'project-1', tenantId: 'tenant-1', name: 'Projeto Alpha' },
      req: { user: { id: 'user-1' } },
      createFile,
      deleteVectorsFn,
      uploadVectorsFn,
    });

    expect(uploadVectorsFn).toHaveBeenCalledWith(
      expect.objectContaining({ file_id: 'meeting:meeting-1', entity_id: 'project-1' }),
    );
    expect(createFile).toHaveBeenCalledWith(
      expect.objectContaining({
        file_id: 'meeting:meeting-1',
        projectId: 'project-1',
        tenantId: 'tenant-1',
        context: FileContext.agents,
        embedded: true,
      }),
      true,
    );
  });

  it('deletes the project vectors and file for a meeting', async () => {
    const req = { user: { id: 'user-1' } };
    const deleteFilesFn = jest.fn().mockResolvedValue({ deletedCount: 1 });
    const deleteVectorsFn = jest.fn().mockResolvedValue(undefined);

    await deleteMeetingIndex({ meeting, req, deleteFilesFn, deleteVectorsFn });

    expect(deleteVectorsFn).toHaveBeenCalledWith(req, {
      file_id: 'meeting:meeting-1',
      embedded: true,
    });
    expect(deleteFilesFn).toHaveBeenCalledWith(['meeting:meeting-1']);
  });
});
