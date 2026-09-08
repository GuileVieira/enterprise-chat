import { improvePromptText, clearPromptImproveCache } from './improve';

const originalEnv = process.env.OPENROUTER_API_KEY;
const originalOpenRouterKey = process.env.OPENROUTER_KEY;

describe('improvePromptText', () => {
  beforeEach(() => {
    clearPromptImproveCache();
    process.env.OPENROUTER_API_KEY = 'openrouter-key';
    delete process.env.OPENROUTER_KEY;
  });

  afterAll(() => {
    process.env.OPENROUTER_API_KEY = originalEnv;
    process.env.OPENROUTER_KEY = originalOpenRouterKey;
  });

  it('rejects text with fewer than three words', async () => {
    await expect(improvePromptText({ text: 'too short' })).rejects.toMatchObject({
      statusCode: 400,
      code: 'PROMPT_TOO_SHORT',
    });
  });

  it('returns a controlled error when OPENROUTER_API_KEY is missing', async () => {
    delete process.env.OPENROUTER_API_KEY;
    delete process.env.OPENROUTER_KEY;

    await expect(improvePromptText({ text: 'write better copy' })).rejects.toMatchObject({
      statusCode: 500,
      code: 'OPENROUTER_API_KEY_MISSING',
    });
  });

  it('falls back to OPENROUTER_KEY for existing env files', async () => {
    delete process.env.OPENROUTER_API_KEY;
    process.env.OPENROUTER_KEY = 'legacy-openrouter-key';
    const fetchFn = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'Write a concise launch email.' } }],
      }),
    });

    await improvePromptText({ text: 'write launch email' }, { fetchFn });

    expect(fetchFn).toHaveBeenCalledWith(
      'https://openrouter.ai/api/v1/chat/completions',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer legacy-openrouter-key',
        }),
      }),
    );
  });

  it('calls OpenRouter with Claude Opus and prompt caching enabled', async () => {
    const fetchFn = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'Write a concise launch email.' } }],
      }),
    });

    const result = await improvePromptText({ text: 'write launch email' }, { fetchFn });

    expect(result).toEqual({ improvedText: 'Write a concise launch email.', cached: false });
    expect(fetchFn).toHaveBeenCalledWith(
      'https://openrouter.ai/api/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer openrouter-key',
          'Content-Type': 'application/json',
        }),
        body: expect.any(String),
      }),
    );

    const body = JSON.parse(fetchFn.mock.calls[0][1].body);
    expect(body.model).toBe('anthropic/claude-opus-4.7');
    expect(body.promptCache).toBe(true);
    expect(body.messages[0].role).toBe('system');
    expect(body.messages[0].content).toContain('naturalidade');
    expect(body.messages[0].content).toContain('Nano Banana Pro');
    expect(body.messages[1]).toEqual({
      role: 'user',
      content: '<user_prompt>\nwrite launch email\n</user_prompt>',
    });
  });

  it('caches repeated normalized text for ten minutes', async () => {
    const fetchFn = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'Improved prompt' } }],
      }),
    });

    const first = await improvePromptText({ text: 'write launch email' }, { fetchFn });
    const second = await improvePromptText({ text: '  write   launch email  ' }, { fetchFn });

    expect(first.cached).toBe(false);
    expect(second).toEqual({ improvedText: 'Improved prompt', cached: true });
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });
});
