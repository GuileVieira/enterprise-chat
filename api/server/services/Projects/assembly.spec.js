const { generateInsights, getTranscript, submitAudio } = require('./assembly');

describe('AssemblyAI meeting service', () => {
  const originalKey = process.env.ASSEMBLYAI_API_KEY;

  beforeEach(() => {
    process.env.ASSEMBLYAI_API_KEY = 'test-key';
    global.fetch = jest.fn();
  });

  afterAll(() => {
    if (originalKey === undefined) {
      delete process.env.ASSEMBLYAI_API_KEY;
    } else {
      process.env.ASSEMBLYAI_API_KEY = originalKey;
    }
  });

  it('polls a transcript using server-side credentials', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'transcript-1', status: 'processing' }),
    });

    await expect(getTranscript('transcript-1')).resolves.toMatchObject({ status: 'processing' });
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.assemblyai.com/v2/transcript/transcript-1',
      expect.objectContaining({ headers: { authorization: 'test-key' } }),
    );
  });

  it('submits audio using Universal-3.5 Pro with Universal-2 fallback', async () => {
    global.fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ upload_url: 'https://cdn.assemblyai.com/audio' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'transcript-1', status: 'queued' }),
      });

    await expect(submitAudio(__filename)).resolves.toMatchObject({ id: 'transcript-1' });
    expect(JSON.parse(global.fetch.mock.calls[1][1].body)).toMatchObject({
      audio_url: 'https://cdn.assemblyai.com/audio',
      speech_models: ['universal-3-5-pro', 'universal-2'],
      language_detection: true,
      speaker_labels: true,
    });
  });

  it('requests structured meeting insights and parses fenced JSON', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content:
                '```json\n{"summary":"Resumo","decisions":[],"nextSteps":["Enviar"],"tasks":[]}\n```',
            },
          },
        ],
      }),
    });

    await expect(
      generateInsights({ utterances: [{ speaker: 'A', text: 'Vou enviar amanhã.' }] }),
    ).resolves.toEqual({
      summary: 'Resumo',
      decisions: [],
      nextSteps: ['Enviar'],
      tasks: [],
    });
    expect(JSON.parse(global.fetch.mock.calls[0][1].body)).toMatchObject({
      model: 'claude-sonnet-5',
    });
  });

  it('drops invalid insight fields returned by the external model', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: '{"summary":42,"decisions":["Confirmada",null],"tasks":"inválido"}',
            },
          },
        ],
      }),
    });

    await expect(generateInsights({ utterances: [] })).resolves.toEqual({
      summary: '',
      decisions: ['Confirmada'],
      nextSteps: [],
      tasks: [],
    });
  });
});
