const path = require('path');
const mongoose = require('mongoose');
const { logger } = require('@librechat/data-schemas');
const { ensureRequiredCollectionsExist } = require('@librechat/api');
const { AccessRoleIds, ResourceType, PrincipalType } = require('librechat-data-provider');

require('module-alias')({ base: path.resolve(__dirname, '..', 'api') });
const connect = require('./connect');

const { grantPermission } = require('~/server/services/PermissionService');
const { findRoleByIdentifier } = require('~/models');
const { Project, AclEntry } = require('~/db/models');

const principalIdFilter = ({ principalType, principalId }) => {
  if (
    principalType === PrincipalType.USER &&
    typeof principalId === 'string' &&
    mongoose.Types.ObjectId.isValid(principalId)
  ) {
    return { $in: [principalId, new mongoose.Types.ObjectId(principalId)] };
  }
  return principalId;
};

const hasProjectAcl = async ({ principalType, principalId, resourceId }) => {
  if (!principalId || !resourceId) {
    return false;
  }
  return Boolean(
    await AclEntry.exists({
      resourceType: ResourceType.PROJECT,
      principalType,
      principalId: principalIdFilter({ principalType, principalId }),
      resourceId,
    }),
  );
};

async function migrateProjectPermissions({ dryRun = true, batchSize = 100 } = {}) {
  await connect();

  logger.info('Starting Project Permissions Migration', { dryRun, batchSize });

  const mongoose = require('mongoose');
  const db = mongoose.connection.db;
  if (db) {
    await ensureRequiredCollectionsExist(db);
  }

  const ownerRole = await findRoleByIdentifier(AccessRoleIds.PROJECT_OWNER);
  const editorRole = await findRoleByIdentifier(AccessRoleIds.PROJECT_EDITOR);
  if (!ownerRole || !editorRole) {
    throw new Error('Required project roles not found. Run role seeding first.');
  }

  const projects = await Project.find({
    $or: [
      { user: { $exists: true, $ne: null } },
      { tenantId: { $exists: true, $ne: null, $ne: '' } },
    ],
  })
    .select('_id projectId name user tenantId')
    .lean();

  const results = {
    dryRun,
    checked: projects.length,
    migrated: 0,
    errors: 0,
    ownerGrants: 0,
    tenantGrants: 0,
    alreadyOk: 0,
    projects: [],
  };

  for (let i = 0; i < projects.length; i += batchSize) {
    const batch = projects.slice(i, i + batchSize);

    for (const project of batch) {
      try {
        const ownerMissing =
          project.user &&
          !(await hasProjectAcl({
            principalType: PrincipalType.USER,
            principalId: project.user,
            resourceId: project._id,
          }));
        const tenantMissing =
          project.tenantId &&
          !(await hasProjectAcl({
            principalType: PrincipalType.TENANT,
            principalId: project.tenantId,
            resourceId: project._id,
          }));

        if (!ownerMissing && !tenantMissing) {
          results.alreadyOk++;
          continue;
        }

        results.projects.push({
          _id: project._id,
          projectId: project.projectId,
          name: project.name,
          ...(ownerMissing ? { missingOwnerAcl: true } : {}),
          ...(tenantMissing ? { missingTenantAcl: true } : {}),
        });

        if (dryRun) {
          if (ownerMissing) {
            results.ownerGrants++;
          }
          if (tenantMissing) {
            results.tenantGrants++;
          }
          results.migrated = results.ownerGrants + results.tenantGrants;
          continue;
        }

        if (ownerMissing) {
          await grantPermission({
            principalType: PrincipalType.USER,
            principalId: project.user,
            resourceType: ResourceType.PROJECT,
            resourceId: project._id,
            accessRoleId: AccessRoleIds.PROJECT_OWNER,
            grantedBy: project.user,
          });
          results.ownerGrants++;
        }

        if (tenantMissing) {
          await grantPermission({
            principalType: PrincipalType.TENANT,
            principalId: project.tenantId,
            resourceType: ResourceType.PROJECT,
            resourceId: project._id,
            accessRoleId: AccessRoleIds.PROJECT_EDITOR,
            grantedBy: project.user,
          });
          results.tenantGrants++;
        }

        results.migrated = results.ownerGrants + results.tenantGrants;
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
  const apply = process.argv.includes('--apply');
  const batchSize =
    parseInt(process.argv.find((arg) => arg.startsWith('--batch-size='))?.split('=')[1]) || 100;

  migrateProjectPermissions({ dryRun: !apply || dryRun, batchSize })
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
