const { logger, runAsSystem } = require('@librechat/data-schemas');
const { ResourceType, PermissionBits } = require('librechat-data-provider');
const { loadProjectMemories } = require('@librechat/api');
const { checkPermission } = require('~/server/services/PermissionService');
const db = require('~/models');

const emptyProjectContext = () => ({
  projectId: undefined,
  projectInstructions: '',
  projectMemories: '',
  projectFileIds: [],
});

/**
 * Loads project instructions, memories, and file ids after checking PROJECT VIEW.
 *
 * @param {object} params
 * @param {ServerRequest} params.req
 * @param {string | null | undefined} [params.conversationId]
 * @param {string | null | undefined} [params.projectId]
 */
const loadProjectContext = async ({ req, conversationId, projectId: requestProjectId }) => {
  let projectId = requestProjectId;
  try {
    logger.debug('[loadProjectContext] Project context request', {
      conversationId,
      projectId,
      hasRequestProjectId: !!projectId,
    });

    if (!projectId && conversationId && conversationId !== 'new') {
      const conversation = await db.getConvo(req.user.id, conversationId);
      projectId = conversation?.projectId;
    }

    if (!projectId) {
      return emptyProjectContext();
    }

    const project = await db.getProjectById(projectId);
    if (project?._id) {
      const hasProjectAccess = await checkPermission({
        userId: req.user.id,
        role: req.user.role,
        resourceType: ResourceType.PROJECT,
        resourceId: project._id,
        requiredPermission: PermissionBits.VIEW,
      });
      if (!hasProjectAccess) {
        logger.warn(`[loadProjectContext] User ${req.user.id} denied project context ${projectId}`);
        return emptyProjectContext();
      }
    }

    const projectInstructions = project?.instructions ?? '';
    const projectMemories =
      (await loadProjectMemories(
        project,
        async (uid) => {
          const memories = await db.getAllUserMemories(uid);
          return memories.map((m) => ({ key: m.key, value: m.value }));
        },
        req.user.id,
      )) ?? '';

    let projectFileIds = [];
    if (project?.projectId) {
      const declaredIds = Array.isArray(project.fileIds) ? project.fileIds.filter(Boolean) : [];
      const projectFiles = await runAsSystem(async () =>
        db.getFiles(
          {
            $or: [{ projectId: project.projectId }, { file_id: { $in: declaredIds } }],
          },
          null,
          { text: 0 },
        ),
      );
      projectFileIds = [
        ...new Set((projectFiles ?? []).map((file) => file?.file_id).filter(Boolean)),
      ];
      logger.debug('[loadProjectContext] Project files resolved', {
        projectId: project.projectId,
        declaredFileIds: declaredIds.length,
        projectFileIds: projectFileIds.length,
      });
    }

    return {
      projectId: project?.projectId ?? projectId,
      projectInstructions,
      projectMemories,
      projectFileIds,
    };
  } catch (err) {
    logger.error('[loadProjectContext] Error loading project context', err);
    return emptyProjectContext();
  }
};

module.exports = { loadProjectContext };
