const { ContentTypes } = require('librechat-data-provider');
const { Readable } = require('stream');
const createOpenRouterGeminiImageTool = require('../OpenRouterGeminiImageGen');
const { spendTokens } = require('~/models');
const { getStrategyFunctions } = require('~/server/services/Files/strategies');

jest.mock('@librechat/data-schemas', () => ({
  logger: {
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('@librechat/api', () => ({
  getBalanceConfig: jest.fn(() => ({ enabled: true })),
  getTransactionsConfig: jest.fn(() => ({ enabled: true })),
  openRouterGeminiToolkit: {
    openrouter_gemini_image_gen: {
      name: 'openrouter_gemini_image_gen',
      description: 'Generate an image through OpenRouter Gemini',
      schema: {},
    },
  },
}));

jest.mock('~/server/services/Files/strategies', () => ({
  getStrategyFunctions: jest.fn(),
}));

jest.mock('~/models', () => ({
  getFiles: jest.fn().mockResolvedValue([]),
  spendTokens: jest.fn().mockResolvedValue(undefined),
}));

describe('OpenRouterGeminiImageGen', () => {
  const originalFetch = global.fetch;
  let originalEnv;

  beforeEach(() => {
    jest.clearAllMocks();
    originalEnv = { ...process.env };
    process.env.OPENROUTER_KEY = 'test-openrouter-key';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        usage: {
          prompt_tokens: 12,
          completion_tokens: 4,
        },
        choices: [
          {
            message: {
              images: [
                {
                  type: 'image_url',
                  image_url: {
                    url: 'data:image/png;base64,aGVsbG8=',
                  },
                },
              ],
            },
          },
        ],
      }),
    });
  });

  afterEach(() => {
    process.env = originalEnv;
    global.fetch = originalFetch;
  });

  it('sends OpenRouter image generation payload and records returned usage', async () => {
    const tool = createOpenRouterGeminiImageTool({
      isAgent: true,
      userId: 'user-1',
      req: {
        config: {},
        user: { id: 'user-1' },
      },
    });

    const result = await tool.func({
      prompt: 'photo of a glass building at sunrise',
      aspectRatio: '16:9',
      imageSize: '2K',
    });

    expect(global.fetch).toHaveBeenCalledWith(
      'https://openrouter.ai/api/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-openrouter-key',
          'Content-Type': 'application/json',
        }),
      }),
    );

    const payload = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(payload).toMatchObject({
      model: 'google/gemini-3-pro-image-preview',
      modalities: ['image', 'text'],
      image_config: {
        aspect_ratio: '16:9',
        image_size: '2K',
      },
    });
    expect(payload.messages[0].content[0]).toEqual({
      type: 'text',
      text: 'photo of a glass building at sunrise',
    });

    expect(result[1].content[0]).toEqual({
      type: ContentTypes.IMAGE_URL,
      image_url: { url: 'data:image/png;base64,aGVsbG8=' },
    });
    expect(spendTokens).toHaveBeenCalledWith(
      expect.objectContaining({
        user: 'user-1',
        model: 'google/gemini-3-pro-image-preview',
        context: 'image_generation',
      }),
      {
        promptTokens: 12,
        completionTokens: 4,
      },
    );
  });

  it('estimates prompt tokens when OpenRouter omits usage', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValue({
        choices: [
          {
            message: {
              images: [
                {
                  type: 'image_url',
                  image_url: {
                    url: 'data:image/png;base64,aGVsbG8=',
                  },
                },
              ],
            },
          },
        ],
      }),
    });

    const tool = createOpenRouterGeminiImageTool({
      isAgent: true,
      userId: 'user-1',
      req: { config: {}, user: { id: 'user-1' } },
    });

    await tool.func({ prompt: 'four token words here' });

    expect(spendTokens).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'google/gemini-3-pro-image-preview',
        context: 'image_generation',
      }),
      {
        promptTokens: expect.any(Number),
        completionTokens: 0,
      },
    );
    expect(spendTokens.mock.calls[0][1].promptTokens).toBeGreaterThan(0);
  });

  it('sends referenced images as OpenRouter data URLs', async () => {
    getStrategyFunctions.mockReturnValue({
      getDownloadStream: jest.fn().mockResolvedValue(Readable.from([Buffer.from('image-bytes')])),
    });

    const tool = createOpenRouterGeminiImageTool({
      isAgent: true,
      userId: 'user-1',
      fileStrategy: 'local',
      req: { config: {}, user: { id: 'user-1' } },
      imageFiles: [
        {
          file_id: 'image-1',
          filepath: '/images/user/image.png',
          type: 'image/png',
          source: 'local',
        },
      ],
    });

    await tool.func({
      prompt: 'edit this image',
      image_ids: ['image-1'],
    });

    const payload = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(payload.messages[0].content).toEqual([
      { type: 'text', text: 'edit this image' },
      {
        type: 'image_url',
        image_url: {
          url: `data:image/png;base64,${Buffer.from('image-bytes').toString('base64')}`,
        },
      },
    ]);
  });
});
