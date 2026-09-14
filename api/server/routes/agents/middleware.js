const { PermissionTypes, Permissions } = require('librechat-data-provider');
const {
  generateCheckAccess,
  createTenantApiHandlers,
  preAuthTenantMiddleware,
  createRequireApiKeyAuth,
  createRemoteAgentAuth,
  createCheckRemoteAgentAccess,
} = require('@librechat/api');
const { getEffectivePermissions } = require('~/server/services/PermissionService');
const { getAppConfig } = require('~/server/services/Config');
const db = require('~/models');

const apiKeyMiddleware = createRequireApiKeyAuth({
  validateAgentApiKey: db.validateAgentApiKey,
  findUser: db.findUser,
});

const requireRemoteAgentAuth = createRemoteAgentAuth({
  apiKeyMiddleware,
  findUser: db.findUser,
  updateUser: db.updateUser,
  getAppConfig,
});

const checkRemoteAgentsFeature = generateCheckAccess({
  permissionType: PermissionTypes.REMOTE_AGENTS,
  permissions: [Permissions.USE],
  getRoleByName: db.getRoleByName,
});

const checkAgentPermission = createCheckRemoteAgentAccess({
  getAgent: db.getAgent,
  getEffectivePermissions,
});

const tenantApi = createTenantApiHandlers({ ...db, getEffectivePermissions });

module.exports = {
  requireProjectAccess: tenantApi.requireProjectAccess,
  remoteCatalog: tenantApi.remoteCatalog,
  checkAgentPermission,
  preAuthTenantMiddleware,
  requireRemoteAgentAuth,
  checkRemoteAgentsFeature,
};
