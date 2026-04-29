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
