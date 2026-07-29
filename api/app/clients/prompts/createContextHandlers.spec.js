const axios = require('axios');

jest.mock('axios');
jest.mock('@librechat/api', () => ({
  isEnabled: jest.fn(() => false),
  generateShortLivedToken: jest.fn(() => 'mock-jwt-token'),
}));

jest.mock('@librechat/data-schemas', () => ({
  logger: {
    error: jest.fn(),
  },
}));

const createContextHandlers = require('./createContextHandlers');

describe('createContextHandlers', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv, RAG_API_URL: 'http://rag-api.test' };
    axios.post.mockResolvedValue({
      data: [
        [
          {
            page_content: 'Project scoped content',
          },
          0.2,
        ],
      ],
    });
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('queries project files with the project entity id', async () => {
    const handlers = createContextHandlers({ user: { id: 'user-1' } }, 'project query');

    await handlers.processFile({
      file_id: 'file-project',
      filename: 'project.pdf',
      type: 'application/pdf',
      embedded: true,
      projectId: 'project-123',
    });
    await handlers.createContext();

    expect(axios.post).toHaveBeenCalledWith(
      'http://rag-api.test/query',
      {
        file_id: 'file-project',
        query: 'project query',
        k: 4,
        entity_id: 'project-123',
      },
      expect.any(Object),
    );
  });

  it('keeps non-project file queries unscoped', async () => {
    const handlers = createContextHandlers({ user: { id: 'user-1' } }, 'attachment query');

    await handlers.processFile({
      file_id: 'file-attachment',
      filename: 'attachment.pdf',
      type: 'application/pdf',
      embedded: true,
    });
    await handlers.createContext();

    expect(axios.post).toHaveBeenCalledWith(
      'http://rag-api.test/query',
      {
        file_id: 'file-attachment',
        query: 'attachment query',
        k: 4,
      },
      expect.any(Object),
    );
  });
});
