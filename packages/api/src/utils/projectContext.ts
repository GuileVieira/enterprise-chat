/**
 * Loads project instructions for injection into conversation context.
 */
export async function loadProjectInstructions(
  getProjectById: (user: string, projectId: string) => Promise<{ instructions?: string } | null>,
  userId: string,
  projectId?: string | null,
): Promise<string | null> {
  if (!projectId) {
    return null;
  }
  try {
    const project = await getProjectById(userId, projectId);
    return project?.instructions || null;
  } catch {
    return null;
  }
}

interface IProjectMemory {
  key: string;
  value: string;
}

interface UserMemoryEntry {
  key: string;
  value: string;
}

/**
 * Loads and formats project memories for injection into conversation context.
 * Combines embedded project memories with referenced user memories (by key).
 */
export async function loadProjectMemories(
  project: { memories?: IProjectMemory[]; memoryKeys?: string[] } | null | undefined,
  getUserMemories?: (userId: string) => Promise<UserMemoryEntry[]>,
  userId?: string,
): Promise<string | null> {
  if (!project) {
    return null;
  }

  const lines: string[] = [];

  if (project.memories && project.memories.length > 0) {
    for (const mem of project.memories) {
      lines.push(`- ${mem.key}: ${mem.value}`);
    }
  }

  if (project.memoryKeys && project.memoryKeys.length > 0 && getUserMemories && userId) {
    try {
      const userMemories = await getUserMemories(userId);
      const keySet = new Set(project.memoryKeys);
      for (const mem of userMemories) {
        if (keySet.has(mem.key)) {
          lines.push(`- ${mem.key}: ${mem.value}`);
        }
      }
    } catch {
      // Gracefully skip user memory references on error
    }
  }

  if (lines.length === 0) {
    return null;
  }

  return `## Project Memories\n\n${lines.join('\n')}`;
}
