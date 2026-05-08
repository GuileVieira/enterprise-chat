const path = require('path');
const { logger } = require('@librechat/data-schemas');
const { ensureRequiredCollectionsExist } = require('@librechat/api');
const { AccessRoleIds, ResourceType, PrincipalType } = require('librechat-data-provider');

require('module-alias')({ base: path.resolve(__dirname, '..', 'api') });
const connect = require('./connect');

const { grantPermission } = require('~/server/services/PermissionService');
const { findRoleByIdentifier } = require('~/models');
const { Project, AclEntry } = require('~/db/models');

async function migrateProjectPermissions({ dryRun = true, batchSize = 100 } = {}) {
  await connect();

  logger.info('Starting Project Permissions Migration', { dryRun, batchSize });

  const mongoose = require('mongoose');
  const db = mongoose.connection.db;
  if (db) {
    await ensureRequiredCollectionsExist(db);
  }

  const ownerRole = await findRoleByIdentifier(AccessRoleIds.PROJECT_OWNER);
  if (!ownerRole) {
    throw new Error('Required project owner role not found. Run role seeding first.');
  }

  const migratedProjectIds = await AclEntry.distinct('resourceId', {
    resourceType: ResourceType.PROJECT,
    principalType: PrincipalType.USER,
  });

  const projectsToMigrate = await Project.find({
    _id: { $nin: migratedProjectIds },
    user: { $exists: true, $ne: null },
  })
    .select('_id projectId name user')
    .lean();

  if (dryRun) {
    return {
      migrated: 0,
      errors: 0,
      dryRun: true,
      total: projectsToMigrate.length,
      projects: projectsToMigrate.map((project) => ({
        _id: project._id,
        projectId: project.projectId,
        name: project.name,
        user: project.user,
      })),
    };
  }

  const results = {
    migrated: 0,
    errors: 0,
    ownerGrants: 0,
  };

  for (let i = 0; i < projectsToMigrate.length; i += batchSize) {
    const batch = projectsToMigrate.slice(i, i + batchSize);

    for (const project of batch) {
      try {
        await grantPermission({
          principalType: PrincipalType.USER,
          principalId: project.user,
          resourceType: ResourceType.PROJECT,
          resourceId: project._id,
          accessRoleId: AccessRoleIds.PROJECT_OWNER,
          grantedBy: project.user,
        });
        results.ownerGrants++;
        results.migrated++;
      } catch (error) {
        results.errors++;
        logger.error(`Failed to migrate project "${project.name}"`, {
          projectId: project.projectId,
          user: project.user,
          error: error.message,
        });
      }
    }
  }

  logger.info('Project migration completed', results);
  return results;
}

if (require.main === module) {
  const dryRun = process.argv.includes('--dry-run');
  const batchSize =
    parseInt(process.argv.find((arg) => arg.startsWith('--batch-size='))?.split('=')[1]) || 100;

  migrateProjectPermissions({ dryRun, batchSize })
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
      process.exit(0);
    })
    .catch((error) => {
      console.error('Project permissions migration failed:', error);
      process.exit(1);
    });
}

module.exports = { migrateProjectPermissions };
