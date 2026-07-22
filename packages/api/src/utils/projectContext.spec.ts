import { loadProjectInstructions, loadProjectMemories, loadProjectFileIds } from './projectContext';

describe('loadProjectInstructions', () => {
  it('should return null when projectId is not provided', async () => {
    const getProjectById = jest.fn();
    const result = await loadProjectInstructions(getProjectById, 'user-1', undefined);
    expect(result).toBeNull();
    expect(getProjectById).not.toHaveBeenCalled();
  });

  it('should return null when projectId is null', async () => {
    const getProjectById = jest.fn();
    const result = await loadProjectInstructions(getProjectById, 'user-1', null);
    expect(result).toBeNull();
    expect(getProjectById).not.toHaveBeenCalled();
  });

  it('should return instructions when project exists', async () => {
    const getProjectById = jest.fn().mockResolvedValue({ instructions: 'Be helpful' });
    const result = await loadProjectInstructions(getProjectById, 'user-1', 'proj-1');
    expect(result).toBe('Be helpful');
    expect(getProjectById).toHaveBeenCalledWith('user-1', 'proj-1');
  });

  it('should return null when project has empty instructions', async () => {
    const getProjectById = jest.fn().mockResolvedValue({ instructions: '' });
    const result = await loadProjectInstructions(getProjectById, 'user-1', 'proj-1');
    expect(result).toBeNull();
  });

  it('should return null when project is not found', async () => {
    const getProjectById = jest.fn().mockResolvedValue(null);
    const result = await loadProjectInstructions(getProjectById, 'user-1', 'proj-1');
    expect(result).toBeNull();
  });

  it('should return null when getProjectById throws', async () => {
    const getProjectById = jest.fn().mockRejectedValue(new Error('DB error'));
    const result = await loadProjectInstructions(getProjectById, 'user-1', 'proj-1');
    expect(result).toBeNull();
  });
});

describe('loadProjectMemories', () => {
  it('should return null when project is null', async () => {
    const result = await loadProjectMemories(null);
    expect(result).toBeNull();
  });

  it('should return null when project is undefined', async () => {
    const result = await loadProjectMemories(undefined);
    expect(result).toBeNull();
  });

  it('should return null when project has no memories or memoryKeys', async () => {
    const result = await loadProjectMemories({ memories: [], memoryKeys: [] });
    expect(result).toBeNull();
  });

  it('should format embedded project memories', async () => {
    const result = await loadProjectMemories({
      memories: [
        { key: 'tone', value: 'friendly' },
        { key: 'language', value: 'Portuguese' },
      ],
    });
    expect(result).toBe('## Project Memories\n\n- tone: friendly\n- language: Portuguese');
  });

  it('should include user memories referenced by memoryKeys', async () => {
    const getUserMemories = jest.fn().mockResolvedValue([
      { key: 'user_pref_1', value: 'Pref A' },
      { key: 'user_pref_2', value: 'Pref B' },
      { key: 'other', value: 'Other' },
    ]);
    const result = await loadProjectMemories(
      { memories: [], memoryKeys: ['user_pref_1', 'other'] },
      getUserMemories,
      'user-1',
    );
    expect(result).toBe('## Project Memories\n\n- user_pref_1: Pref A\n- other: Other');
    expect(getUserMemories).toHaveBeenCalledWith('user-1');
  });

  it('should merge embedded memories and user memories', async () => {
    const getUserMemories = jest.fn().mockResolvedValue([{ key: 'pref', value: 'Value' }]);
    const result = await loadProjectMemories(
      { memories: [{ key: 'tone', value: 'formal' }], memoryKeys: ['pref'] },
      getUserMemories,
      'user-1',
    );
    expect(result).toBe('## Project Memories\n\n- tone: formal\n- pref: Value');
  });

  it('should gracefully skip user memories when getUserMemories throws', async () => {
    const getUserMemories = jest.fn().mockRejectedValue(new Error('DB error'));
    const result = await loadProjectMemories(
      { memories: [{ key: 'tone', value: 'friendly' }], memoryKeys: ['pref'] },
      getUserMemories,
      'user-1',
    );
    expect(result).toBe('## Project Memories\n\n- tone: friendly');
  });

  it('should skip user memories when getUserMemories is not provided', async () => {
    const result = await loadProjectMemories({
      memories: [{ key: 'tone', value: 'friendly' }],
      memoryKeys: ['pref'],
    });
    expect(result).toBe('## Project Memories\n\n- tone: friendly');
  });
});

describe('loadProjectFileIds', () => {
  it('should return null when project is null', async () => {
    const result = await loadProjectFileIds(null);
    expect(result).toBeNull();
  });

  it('should return null when project is undefined', async () => {
    const result = await loadProjectFileIds(undefined);
    expect(result).toBeNull();
  });

  it('should return null when fileIds is empty', async () => {
    const result = await loadProjectFileIds({ fileIds: [] });
    expect(result).toBeNull();
  });

  it('should return fileIds directly when no validator is provided', async () => {
    const result = await loadProjectFileIds({ fileIds: ['f1', 'f2', 'f3'] });
    expect(result).toEqual(['f1', 'f2', 'f3']);
  });

  it('should filter fileIds through validator', async () => {
    const validateFileIds = jest.fn().mockResolvedValue(['f1', 'f3']);
    const result = await loadProjectFileIds({ fileIds: ['f1', 'f2', 'f3'] }, validateFileIds);
    expect(result).toEqual(['f1', 'f3']);
    expect(validateFileIds).toHaveBeenCalledWith(['f1', 'f2', 'f3']);
  });

  it('should return null when all fileIds are invalid', async () => {
    const validateFileIds = jest.fn().mockResolvedValue([]);
    const result = await loadProjectFileIds({ fileIds: ['f1', 'f2'] }, validateFileIds);
    expect(result).toBeNull();
  });

  it('should propagate error when validator throws', async () => {
    const validateFileIds = jest.fn().mockRejectedValue(new Error('DB error'));
    await expect(loadProjectFileIds({ fileIds: ['f1'] }, validateFileIds)).rejects.toThrow(
      'DB error',
    );
  });
});
