const { EToolResources, Tools } = require('librechat-data-provider');

const mockGetFiles = jest.fn();
const mockFilterFilesByAgentAccess = jest.fn();

jest.mock('@librechat/data-schemas', () => ({
  logger: {
    debug: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  },
}));

jest.mock('~/models', () => ({
  getFiles: (...args) => mockGetFiles(...args),
}));

jest.mock('~/server/services/Files/permissions', () => ({
  filterFilesByAgentAccess: (...args) => mockFilterFilesByAgentAccess(...args),
}));

const { primeFiles } = require('./fileSearch');

describe('file_search primeFiles', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFilterFilesByAgentAccess.mockImplementation(({ files }) => Promise.resolve(files));
  });

  it('builds explicit project-file instructions when file_search resources are loaded', async () => {
    mockGetFiles.mockResolvedValue([
      {
        file_id: 'project-file',
        filename: 'DNA de Marca - Marmofort.docx',
        projectId: 'proj-123',
      },
    ]);

    const result = await primeFiles({
      req: { user: { id: 'user-1', role: 'USER' } },
      agentId: 'agent-1',
      tool_resources: {
        [EToolResources.file_search]: {
          file_ids: ['project-file'],
        },
      },
    });

    expect(result.files).toEqual([
      {
        file_id: 'project-file',
        filename: 'DNA de Marca - Marmofort.docx',
        projectId: 'proj-123',
      },
    ]);
    expect(result.toolContext).toContain(`Use the ${Tools.file_search} tool`);
    expect(result.toolContext).toContain('DNA de Marca - Marmofort.docx');
    expect(result.toolContext).toContain('anexo');
    expect(result.toolContext).toContain('arquivo');
    expect(result.toolContext).toContain('documento');
  });
});
