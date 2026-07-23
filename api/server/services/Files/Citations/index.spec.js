const mockGetFiles = jest.fn();

jest.mock('~/models', () => ({
  getFiles: (...args) => mockGetFiles(...args),
  getRoleByName: jest.fn(),
}));

const { enhanceSourcesWithMetadata } = require('./index');

describe('file citation diary metadata', () => {
  it('names diary sources with type/date and preserves the link metadata', async () => {
    mockGetFiles.mockResolvedValue([
      {
        file_id: 'traffic-diary:manager:entry-1',
        filename: 'diario-gestor-2026-07-23.txt',
        source: 'text',
        metadata: {
          trafficDiary: {
            entryId: 'entry-1',
            kind: 'manager',
            projectId: 'project-1',
            date: '2026-07-23',
          },
        },
      },
    ]);

    const [source] = await enhanceSourcesWithMetadata(
      [{ fileId: 'traffic-diary:manager:entry-1' }],
      {},
    );

    expect(source.fileName).toBe('Diário do Gestor — 2026-07-23');
    expect(source.metadata.trafficDiary).toEqual(
      expect.objectContaining({
        entryId: 'entry-1',
        projectId: 'project-1',
        date: '2026-07-23',
      }),
    );
  });
});
