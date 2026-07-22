const addTitle = require('./title');
const initializeClient = require('./initalize');
const getLogStores = require('~/cache/getLogStores');
const { saveConvo } = require('~/models');

jest.mock('./initalize');
jest.mock('~/cache/getLogStores');
jest.mock('~/models', () => ({
  saveConvo: jest.fn(),
}));

describe('assistants addTitle', () => {
  let openai;
  let cache;

  beforeEach(() => {
    jest.clearAllMocks();

    openai = {
      chat: {
        completions: {
          create: jest.fn().mockResolvedValue({
            choices: [
              {
                message: {
                  content: 'Análise de Contrato',
                },
              },
            ],
          }),
        },
      },
    };

    cache = {
      set: jest.fn(),
    };

    initializeClient.mockResolvedValue({ openai });
    getLogStores.mockReturnValue(cache);
    saveConvo.mockResolvedValue();
  });

  it('asks for conversation titles in pt-BR', async () => {
    await addTitle(
      {
        user: { id: 'user-123' },
        body: {},
        config: {},
      },
      {
        text: 'Como revisar um contrato?',
        responseText: 'Você pode começar pelos riscos principais.',
        conversationId: 'convo-123',
      },
    );

    expect(openai.chat.completions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: [
          expect.objectContaining({
            content: expect.stringContaining('português do Brasil'),
          }),
        ],
      }),
    );
    expect(cache.set).toHaveBeenCalledWith('user-123-convo-123', 'Análise de Contrato', 120000);
  });
});
