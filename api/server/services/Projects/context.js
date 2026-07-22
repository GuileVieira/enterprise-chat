const { logger, runAsSystem } = require('@librechat/data-schemas');
const { ResourceType, PermissionBits } = require('librechat-data-provider');
const { loadProjectMemories } = require('@librechat/api');
const { checkPermission } = require('~/server/services/PermissionService');
const db = require('~/models');
const mongoose = require('mongoose');

const emptyProjectContext = () => ({
  projectId: undefined,
  projectInstructions: '',
  projectMemories: '',
  projectFileIds: [],
});

function formatTrafficDiary(entries, kind) {
  if (!entries.length) {
    return '';
  }

  const weeks = entries
    .map((entry) => {
      const entryDate = entry.date || entry.weekStart;
      const answers = (entry.answers ?? [])
        .filter((answer) => answer.answer?.trim())
        .map((answer) => `- ${answer.question}: ${answer.answer.trim()}`)
        .join('\n');
      return [`### Dia ${entryDate}${entry.status === 'draft' ? ' (rascunho)' : ''}`, answers]
        .filter(Boolean)
        .join('\n');
    })
    .filter(Boolean)
    .join('\n\n');

  const title = kind === 'strategist' ? 'Diário da estrategista' : 'Diário do gestor de tráfego';
  return weeks ? `## ${title}\n\n${weeks}` : '';
}

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
        logger.warn('[loadProjectContext] Project context ACL missing', {
          projectId,
          projectMongoId: project._id,
          tenantId: project.tenantId,
          userTenantId: req.user.tenantId,
          userId: req.user.id,
        });
        return emptyProjectContext();
      }
    }

    const projectInstructions = project?.instructions ?? '';
    let projectMemories =
      (await loadProjectMemories(
        project,
        async (uid) => {
          const memories = await db.getAllUserMemories(uid);
          return memories.map((m) => ({ key: m.key, value: m.value }));
        },
        req.user.id,
      )) ?? '';

    const TrafficDiaryEntry = mongoose.models.TrafficDiaryEntry;
    if (TrafficDiaryEntry && project?.projectId) {
      try {
        const diaryQuery = {
          projectId: project.projectId,
          ...(project.tenantId ? { tenantId: project.tenantId } : {}),
        };
        const [managerEntries, strategistEntries] = await runAsSystem(() =>
          Promise.all([
            TrafficDiaryEntry.find({ ...diaryQuery, kind: 'manager' })
              .sort({ date: -1, weekStart: -1 })
              .limit(7)
              .lean(),
            TrafficDiaryEntry.find({ ...diaryQuery, kind: 'strategist' })
              .sort({ date: -1, weekStart: -1 })
              .limit(7)
              .lean(),
          ]),
        );
        const managerDiary = formatTrafficDiary(managerEntries, 'manager');
        const strategistDiary = formatTrafficDiary(strategistEntries, 'strategist');
        projectMemories = [projectMemories, managerDiary, strategistDiary]
          .filter(Boolean)
          .join('\n\n');
      } catch (error) {
        logger.error('[loadProjectContext] Traffic diary context failed', error);
      }
    }

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
