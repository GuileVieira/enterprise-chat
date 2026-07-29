const path = require('path');
const { logger } = require('@librechat/data-schemas');
const { ensureRequiredCollectionsExist } = require('@librechat/api');

require('module-alias')({ base: path.resolve(__dirname, '..', 'api') });
const connect = require('./connect');

const { Project, File } = require('~/db/models');

const toFileIds = (value) => (Array.isArray(value) ? value.filter(Boolean) : []);

async function migrateProjectFiles({ dryRun = true, batchSize = 100 } = {}) {
  await connect();

  logger.info('Starting Project Files Migration', { dryRun, batchSize });

  const mongoose = require('mongoose');
  const db = mongoose.connection.db;
  if (db) {
    await ensureRequiredCollectionsExist(db);
  }

  const projects = await Project.find({
    projectId: { $exists: true, $ne: null, $ne: '' },
    $or: [
      { fileIds: { $exists: true, $ne: [] } },
      { tenantId: { $exists: true, $ne: null, $ne: '' } },
    ],
  })
    .select('_id projectId name tenantId fileIds')
    .lean();

  const results = {
    dryRun,
    checked: projects.length,
    migrated: 0,
    errors: 0,
    filesUpdated: 0,
    projectRefsRepaired: 0,
    deadRefsRemoved: 0,
    projectFileIdsUpdated: 0,
    alreadyOk: 0,
    projects: [],
  };

  for (let i = 0; i < projects.length; i += batchSize) {
    const batch = projects.slice(i, i + batchSize);

    for (const project of batch) {
      try {
        const declaredIds = toFileIds(project.fileIds);
        const validFileIds = new Set();
        const updates = [];
        let fileRefsRepaired = 0;
        let deadRefsRemoved = 0;

        for (const id of declaredIds) {
          const file = await File.findOne({ $or: [{ file_id: id }, { temp_file_id: id }] })
            .select('_id file_id temp_file_id projectId tenantId')
            .lean();

          if (!file?.file_id) {
            deadRefsRemoved++;
            continue;
          }

          validFileIds.add(file.file_id);
          if (file.file_id !== id) {
            fileRefsRepaired++;
          }

          const set = {};
          if (file.projectId !== project.projectId) {
            set.projectId = project.projectId;
          }
          if (project.tenantId && file.tenantId !== project.tenantId) {
            set.tenantId = project.tenantId;
          }
          if (Object.keys(set).length > 0) {
            updates.push({ fileId: file._id, set });
          }
        }

        const filesAlreadyLinked = await File.find({ projectId: project.projectId })
          .select('_id file_id tenantId')
          .lean();

        for (const file of filesAlreadyLinked) {
          if (file?.file_id) {
            validFileIds.add(file.file_id);
          }
          if (project.tenantId && file?._id && file.tenantId !== project.tenantId) {
            updates.push({ fileId: file._id, set: { tenantId: project.tenantId } });
          }
        }

        const nextFileIds = Array.from(validFileIds);
        const projectFileIdsChanged =
          nextFileIds.length !== declaredIds.length ||
          nextFileIds.some((fileId, index) => fileId !== declaredIds[index]);

        if (
          updates.length === 0 &&
          fileRefsRepaired === 0 &&
          deadRefsRemoved === 0 &&
          !projectFileIdsChanged
        ) {
          results.alreadyOk++;
          continue;
        }

        results.projects.push({
          _id: project._id,
          projectId: project.projectId,
          name: project.name,
          filesToUpdate: updates.length,
          fileRefsRepaired,
          deadRefsRemoved,
          projectFileIdsChanged,
        });

        results.filesUpdated += updates.length;
        results.projectRefsRepaired += fileRefsRepaired;
        results.deadRefsRemoved += deadRefsRemoved;
        if (projectFileIdsChanged) {
          results.projectFileIdsUpdated++;
        }
        results.migrated =
          results.filesUpdated + results.projectRefsRepaired + results.deadRefsRemoved;

        if (dryRun) {
          continue;
        }

        for (const update of updates) {
          await File.updateOne({ _id: update.fileId }, { $set: update.set });
        }

        if (projectFileIdsChanged) {
          await Project.updateOne({ _id: project._id }, { $set: { fileIds: nextFileIds } });
        }
      } catch (error) {
        results.errors++;
        logger.error(`Failed to migrate project files "${project.name}"`, {
          projectId: project.projectId,
          error: error.message,
        });
      }
    }
  }

  logger.info('Project files migration completed', results);
  return results;
}

if (require.main === module) {
  const dryRun = process.argv.includes('--dry-run');
  const apply = process.argv.includes('--apply');
  const batchSize =
    parseInt(process.argv.find((arg) => arg.startsWith('--batch-size='))?.split('=')[1]) || 100;

  migrateProjectFiles({ dryRun: !apply || dryRun, batchSize })
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
      process.exit(0);
    })
    .catch((error) => {
      console.error('Project files migration failed:', error);
      process.exit(1);
    });
}

module.exports = { migrateProjectFiles };
