const mongoose = require('mongoose');
const { logger, runAsSystem } = require('@librechat/data-schemas');
const {
  logAgentMigrationWarning,
  logPromptMigrationWarning,
  checkAgentPermissionsMigration,
  checkPromptPermissionsMigration,
} = require('@librechat/api');
const { findRoleByIdentifier } = require('~/models');
const { ensureTenantProjectAccess } = require('~/server/services/Projects/access');

async function migrateTenantProjectFiles() {
  const Project = mongoose.models.Project;
  const File = mongoose.models.File;

  if (!Project || !File) {
    logger.warn('[projectFileMigration] Project/File models not ready; skipping');
    return;
  }

  const projects = await runAsSystem(async () =>
    Project.find({ tenantId: { $exists: true, $ne: null } })
      .select('_id projectId user tenantId fileIds')
      .lean(),
  );

  let projectsChecked = 0;
  let tenantGrantsEnsured = 0;
  let filesUpdated = 0;
  let fileRefsRepaired = 0;
  let deadRefsRemoved = 0;

  for (const project of projects) {
    projectsChecked += 1;

    try {
      await ensureTenantProjectAccess({ project, grantedBy: project.user });
      tenantGrantsEnsured += 1;
    } catch (error) {
      logger.error(
        `[projectFileMigration] Failed ensuring tenant ACL for project ${project.projectId}:`,
        error,
      );
    }

    const declaredIds = Array.isArray(project.fileIds) ? project.fileIds.filter(Boolean) : [];
    const validFileIds = new Set();

    for (const id of declaredIds) {
      const file = await runAsSystem(async () =>
        File.findOne({ $or: [{ file_id: id }, { temp_file_id: id }] })
          .select('_id file_id temp_file_id projectId tenantId')
          .lean(),
      );

      if (!file?.file_id) {
        deadRefsRemoved += 1;
        continue;
      }

      validFileIds.add(file.file_id);
      if (file.file_id !== id) {
        fileRefsRepaired += 1;
      }

      const set = {};
      if (file.projectId !== project.projectId) {
        set.projectId = project.projectId;
      }
      if (!file.tenantId) {
        set.tenantId = project.tenantId;
      }

      if (Object.keys(set).length > 0) {
        await runAsSystem(async () => File.updateOne({ _id: file._id }, { $set: set }));
        filesUpdated += 1;
      }
    }

    const projectFiles = await runAsSystem(async () =>
      File.find({ projectId: project.projectId }).select('file_id tenantId').lean(),
    );

    for (const file of projectFiles) {
      if (file?.file_id) {
        validFileIds.add(file.file_id);
      }
      if (file?._id && !file.tenantId) {
        await runAsSystem(async () =>
          File.updateOne({ _id: file._id }, { $set: { tenantId: project.tenantId } }),
        );
        filesUpdated += 1;
      }
    }

    const nextFileIds = Array.from(validFileIds);
    const hasChanged =
      nextFileIds.length !== declaredIds.length ||
      nextFileIds.some((fileId, index) => fileId !== declaredIds[index]);

    if (hasChanged) {
      await runAsSystem(async () =>
        Project.updateOne({ _id: project._id }, { $set: { fileIds: nextFileIds } }),
      );
    }
  }

  logger.info(
    `[projectFileMigration] checked=${projectsChecked} tenant_acl=${tenantGrantsEnsured} ` +
      `files_updated=${filesUpdated} refs_repaired=${fileRefsRepaired} ` +
      `dead_refs_removed=${deadRefsRemoved}`,
  );
}

/**
 * Check if permissions migrations are needed for shared resources
 * This runs at the end to ensure all systems are initialized
 */
async function checkMigrations() {
  try {
    await migrateTenantProjectFiles();
  } catch (error) {
    logger.error('Failed to migrate tenant project files:', error);
  }

  try {
    const agentMigrationResult = await checkAgentPermissionsMigration({
      mongoose,
      methods: {
        findRoleByIdentifier,
      },
      AgentModel: mongoose.models.Agent,
    });
    logAgentMigrationWarning(agentMigrationResult);
  } catch (error) {
    logger.error('Failed to check agent permissions migration:', error);
  }
  try {
    const promptMigrationResult = await checkPromptPermissionsMigration({
      mongoose,
      methods: {
        findRoleByIdentifier,
      },
      PromptGroupModel: mongoose.models.PromptGroup,
    });
    logPromptMigrationWarning(promptMigrationResult);
  } catch (error) {
    logger.error('Failed to check prompt permissions migration:', error);
  }
}

module.exports = {
  checkMigrations,
  migrateTenantProjectFiles,
};
