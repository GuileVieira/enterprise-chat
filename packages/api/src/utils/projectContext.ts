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

interface SharedMemoryEntry extends UserMemoryEntry {
  id: string;
  tokenCount?: number;
}

/**
 * Loads and formats project memories for injection into conversation context.
 * Combines embedded project memories with referenced user memories (by key).
 */
export async function loadProjectMemories(
  project:
    | { memories?: IProjectMemory[]; memoryKeys?: string[]; sharedMemoryIds?: string[] }
    | null
    | undefined,
  getUserMemories?: (userId: string) => Promise<UserMemoryEntry[]>,
  userId?: string,
  getSharedMemories?: (ids: string[]) => Promise<SharedMemoryEntry[]>,
  sharedTokenLimit?: number,
): Promise<string | null> {
  if (!project) {
    return null;
  }

  const lines: string[] = [];
  const localKeys = new Set(project.memories?.map((memory) => memory.key) ?? []);

  if (project.memories && project.memories.length > 0) {
    for (const mem of project.memories) {
      lines.push(`- ${mem.key}: ${mem.value}`);
    }
  }

  if (project.sharedMemoryIds?.length && getSharedMemories) {
    try {
      const uniqueIds = [...new Set(project.sharedMemoryIds)];
      const shared = await getSharedMemories(uniqueIds);
      const byId = new Map(shared.map((memory) => [memory.id, memory]));
      let sharedTokens = 0;
      let omitted = 0;
      let unavailable = 0;
      for (const id of uniqueIds) {
        const memory = byId.get(id);
        if (!memory) {
          unavailable++;
          continue;
        }
        if (localKeys.has(memory.key)) continue;
        const next = sharedTokens + (memory.tokenCount || 0);
        if (sharedTokenLimit && next > sharedTokenLimit) {
          omitted++;
          continue;
        }
        sharedTokens = next;
        lines.push(`- ${memory.key}: ${memory.value}`);
      }
      if (omitted) lines.push(`- [${omitted} shared memories omitted by context limit]`);
      if (unavailable) lines.push(`- [${unavailable} shared memories unavailable]`);
    } catch {
      // Keep legacy/local context available if tenant library is temporarily unavailable.
    }
  }

  if (project.memoryKeys && project.memoryKeys.length > 0 && getUserMemories && userId) {
    try {
      const userMemories = await getUserMemories(userId);
      const keySet = new Set(project.memoryKeys);
      for (const mem of userMemories) {
        if (keySet.has(mem.key) && !localKeys.has(mem.key)) {
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

/**
 * Loads project file IDs for injection into conversation context.
 * Optionally validates file IDs against the database to filter out orphaned references.
 */
export async function loadProjectFileIds(
  project: { fileIds?: string[] } | null | undefined,
  validateFileIds?: (fileIds: string[]) => Promise<string[]>,
): Promise<string[] | null> {
  if (!project?.fileIds || project.fileIds.length === 0) {
    return null;
  }
  if (validateFileIds) {
    const validIds = await validateFileIds(project.fileIds);
    return validIds.length > 0 ? validIds : null;
  }
  return project.fileIds;
}
