const path = require('path');
const mongoose = require('mongoose');
const { logger } = require('@librechat/data-schemas');
const { ensureRequiredCollectionsExist } = require('@librechat/api');
const {
  AccessRoleIds,
  ResourceType,
  PrincipalType,
  PermissionBits,
} = require('librechat-data-provider');

require('module-alias')({ base: path.resolve(__dirname, '..', 'api') });
const connect = require('./connect');

const { grantPermission } = require('~/server/services/PermissionService');
const { findRoleByIdentifier } = require('~/models');
const { Project, AclEntry, User } = require('~/db/models');

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

const hasProjectViewAcl = async ({ principalType, principalId, resourceId }) => {
  if (!principalId || !resourceId) {
    return false;
  }
  return Boolean(
    await AclEntry.exists({
      resourceType: ResourceType.PROJECT,
      principalType,
      principalId: principalIdFilter({ principalType, principalId }),
      resourceId,
      permBits: { $bitsAllSet: PermissionBits.VIEW },
    }),
  );
};

const userIdString = (userId) => userId?.toString?.() ?? String(userId);

const listTenantUsers = async ({ tenantId, ownerId }) => {
  if (!tenantId) {
    return [];
  }

  const ownerIdString = ownerId ? userIdString(ownerId) : null;
  const users = await User.find({ tenantId }).select('_id').lean();
  return users.filter((user) => userIdString(user._id) !== ownerIdString);
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
  const viewerRole = await findRoleByIdentifier(AccessRoleIds.PROJECT_VIEWER);
  if (!ownerRole || !editorRole || !viewerRole) {
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
    tenantUserGrants: 0,
    alreadyOk: 0,
    projects: [],
  };

  for (let i = 0; i < projects.length; i += batchSize) {
    const batch = projects.slice(i, i + batchSize);

    for (const project of batch) {
      try {
        const ownerMissing =
          project.user &&
          !(await hasProjectViewAcl({
            principalType: PrincipalType.USER,
            principalId: project.user,
            resourceId: project._id,
          }));
        const tenantMissing =
          project.tenantId &&
          !(await hasProjectViewAcl({
            principalType: PrincipalType.TENANT,
            principalId: project.tenantId,
            resourceId: project._id,
          }));
        const tenantUsers = await listTenantUsers({
          tenantId: project.tenantId,
          ownerId: project.user,
        });
        const missingTenantUsers = [];

        for (const tenantUser of tenantUsers) {
          const hasView = await hasProjectViewAcl({
            principalType: PrincipalType.USER,
            principalId: tenantUser._id,
            resourceId: project._id,
          });
          if (!hasView) {
            missingTenantUsers.push(tenantUser);
          }
        }

        if (!ownerMissing && !tenantMissing && missingTenantUsers.length === 0) {
          results.alreadyOk++;
          continue;
        }

        results.projects.push({
          _id: project._id,
          projectId: project.projectId,
          name: project.name,
          ...(ownerMissing ? { missingOwnerAcl: true } : {}),
          ...(tenantMissing ? { missingTenantAcl: true } : {}),
          ...(missingTenantUsers.length
            ? {
                missingTenantUserAcls: missingTenantUsers.map((user) => userIdString(user._id)),
              }
            : {}),
        });

        if (dryRun) {
          if (ownerMissing) {
            results.ownerGrants++;
          }
          if (tenantMissing) {
            results.tenantGrants++;
          }
          results.tenantUserGrants += missingTenantUsers.length;
          results.migrated =
            results.ownerGrants + results.tenantGrants + results.tenantUserGrants;
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

        for (const tenantUser of missingTenantUsers) {
          await grantPermission({
            principalType: PrincipalType.USER,
            principalId: tenantUser._id,
            resourceType: ResourceType.PROJECT,
            resourceId: project._id,
            accessRoleId: AccessRoleIds.PROJECT_VIEWER,
            grantedBy: project.user || tenantUser._id,
          });
          results.tenantUserGrants++;
        }

        results.migrated = results.ownerGrants + results.tenantGrants + results.tenantUserGrants;
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
