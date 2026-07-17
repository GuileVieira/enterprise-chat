const mockGetConvo = jest.fn();
const mockGetProjectById = jest.fn();
const mockGetFiles = jest.fn();
const mockGetAllUserMemories = jest.fn();
const mockCheckPermission = jest.fn();
const mockLoadProjectMemories = jest.fn();
const mockTrafficDiaryFind = jest.fn();

jest.mock('@librechat/data-schemas', () => ({
  logger: {
    debug: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  },
  runAsSystem: (fn) => fn(),
}));

jest.mock('@librechat/api', () => ({
  loadProjectMemories: (...args) => mockLoadProjectMemories(...args),
}));

jest.mock('~/server/services/PermissionService', () => ({
  checkPermission: (...args) => mockCheckPermission(...args),
}));

jest.mock('mongoose', () => ({
  models: {
    TrafficDiaryEntry: {
      find: (...args) => mockTrafficDiaryFind(...args),
    },
  },
}));

jest.mock('~/models', () => ({
  getConvo: (...args) => mockGetConvo(...args),
  getProjectById: (...args) => mockGetProjectById(...args),
  getFiles: (...args) => mockGetFiles(...args),
  getAllUserMemories: (...args) => mockGetAllUserMemories(...args),
}));

const { loadProjectContext } = require('./context');

describe('loadProjectContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCheckPermission.mockResolvedValue(true);
    mockLoadProjectMemories.mockResolvedValue('## Project Memories\n\n- key: value');
    mockTrafficDiaryFind.mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([]),
    });
  });

  const req = { user: { id: 'user-1', role: 'USER' } };

  it('loads instructions, memories, and files from the active project', async () => {
    mockGetProjectById.mockResolvedValue({
      _id: 'mongo-project',
      projectId: 'proj-123',
      instructions: 'Project instructions',
      fileIds: ['linked-file'],
    });
    mockGetFiles.mockResolvedValue([
      { file_id: 'project-file' },
      { file_id: 'traffic-diary:manager:entry-1' },
      { file_id: 'linked-file' },
      { file_id: 'project-file' },
    ]);

    const result = await loadProjectContext({
      req,
      conversationId: 'new',
      projectId: 'proj-123',
    });

    expect(mockCheckPermission).toHaveBeenCalledWith(
      expect.objectContaining({ resourceId: 'mongo-project' }),
    );
    expect(mockGetFiles).toHaveBeenCalledWith(
      {
        $or: [{ projectId: 'proj-123' }, { file_id: { $in: ['linked-file'] } }],
      },
      null,
      { text: 0 },
    );
    expect(result).toEqual({
      projectId: 'proj-123',
      projectInstructions: 'Project instructions',
      projectMemories: '## Project Memories\n\n- key: value',
      projectFileIds: ['project-file', 'traffic-diary:manager:entry-1', 'linked-file'],
    });
  });

  it('resolves project id from an existing conversation', async () => {
    mockGetConvo.mockResolvedValue({ projectId: 'proj-123' });
    mockGetProjectById.mockResolvedValue({ projectId: 'proj-123' });
    mockGetFiles.mockResolvedValue([]);

    await loadProjectContext({ req, conversationId: 'conv-1' });

    expect(mockGetConvo).toHaveBeenCalledWith('user-1', 'conv-1');
    expect(mockGetProjectById).toHaveBeenCalledWith('proj-123');
  });

  it('adds recent manager and strategist diary entries to project context', async () => {
    mockGetProjectById.mockResolvedValue({
      _id: 'mongo-project',
      projectId: 'proj-123',
      tenantId: 'tenant-1',
    });
    mockGetFiles.mockResolvedValue([]);
    mockTrafficDiaryFind.mockReturnValueOnce({
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([
        {
          date: '2026-07-13',
          weekStart: '2026-07-06',
          status: 'completed',
          answers: [{ question: 'Estratégia', answer: 'Validar novo gancho.' }],
        },
      ]),
    });
    mockTrafficDiaryFind.mockReturnValueOnce({
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([
        {
          kind: 'strategist',
          date: '2026-07-14',
          weekStart: '2026-07-14',
          status: 'draft',
          answers: [{ question: 'Estratégia definida', answer: 'Enviar briefing para redação.' }],
        },
      ]),
    });

    const result = await loadProjectContext({ req, projectId: 'proj-123' });

    expect(mockTrafficDiaryFind).toHaveBeenCalledWith({
      projectId: 'proj-123',
      tenantId: 'tenant-1',
      kind: 'manager',
    });
    expect(mockTrafficDiaryFind).toHaveBeenCalledWith({
      projectId: 'proj-123',
      tenantId: 'tenant-1',
      kind: 'strategist',
    });
    expect(result.projectMemories).toContain('## Diário do gestor de tráfego');
    expect(result.projectMemories).toContain('Validar novo gancho.');
    expect(result.projectMemories).toContain('## Diário da estrategista');
    expect(result.projectMemories).toContain('Enviar briefing para redação.');
  });

  it('returns empty context when the user cannot view the project', async () => {
    mockCheckPermission.mockResolvedValue(false);
    mockGetProjectById.mockResolvedValue({
      _id: 'mongo-project',
      projectId: 'proj-123',
      instructions: 'Project instructions',
    });

    const result = await loadProjectContext({
      req,
      conversationId: 'new',
      projectId: 'proj-123',
    });

    expect(result.projectId).toBeUndefined();
    expect(result.projectInstructions).toBe('');
    expect(result.projectMemories).toBe('');
    expect(result.projectFileIds).toEqual([]);
  });

  it('does not load same-tenant legacy projects without PROJECT VIEW', async () => {
    mockCheckPermission.mockResolvedValue(false);
    mockGetProjectById.mockResolvedValue({
      _id: 'mongo-project',
      projectId: 'proj-123',
      tenantId: 'tenant-1',
      instructions: 'Project instructions',
      fileIds: ['linked-file'],
    });
    mockGetFiles.mockResolvedValue([{ file_id: 'project-file' }, { file_id: 'linked-file' }]);

    const result = await loadProjectContext({
      req: { user: { id: 'user-1', role: 'USER', tenantId: 'tenant-1' } },
      conversationId: 'new',
      projectId: 'proj-123',
    });

    expect(result.projectId).toBeUndefined();
    expect(result.projectInstructions).toBe('');
    expect(result.projectMemories).toBe('');
    expect(result.projectFileIds).toEqual([]);
    expect(mockGetFiles).not.toHaveBeenCalled();
    expect(mockLoadProjectMemories).not.toHaveBeenCalled();
  });

  it('does not load project context for cross-tenant projects without ACL entries', async () => {
    mockCheckPermission.mockResolvedValue(false);
    mockGetProjectById.mockResolvedValue({
      _id: 'mongo-project',
      projectId: 'proj-123',
      tenantId: 'tenant-2',
      instructions: 'Private project instructions',
    });

    const result = await loadProjectContext({
      req: { user: { id: 'user-1', role: 'USER', tenantId: 'tenant-1' } },
      conversationId: 'new',
      projectId: 'proj-123',
    });

    expect(result.projectId).toBeUndefined();
    expect(result.projectInstructions).toBe('');
    expect(result.projectMemories).toBe('');
    expect(result.projectFileIds).toEqual([]);
  });
});
