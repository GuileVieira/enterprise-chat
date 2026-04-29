import { loadProjectInstructions } from './projectContext';

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
