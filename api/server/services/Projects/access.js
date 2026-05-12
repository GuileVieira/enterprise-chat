const mongoose = require('mongoose');
const { runAsSystem } = require('@librechat/data-schemas');
const {
  ResourceType,
  PermissionBits,
  PrincipalType,
  AccessRoleIds,
} = require('librechat-data-provider');
const { checkPermission } = require('~/server/services/PermissionService');

const PROJECT_TENANT_PERMISSIONS = PermissionBits.VIEW | PermissionBits.EDIT;

const isObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

const projectIdentityFilter = (projectId) => {
  const filters = [{ projectId }];
  if (isObjectId(projectId)) {
    filters.push({ _id: new mongoose.Types.ObjectId(projectId) });
  }
  return { $or: filters };
};

const tenantMatches = (project, tenantId) => {
  if (!project?.tenantId) {
    return true;
  }
  return Boolean(tenantId && project.tenantId === tenantId);
};

const findProjectForRequest = async ({ projectId, user }) => {
  if (!projectId) {
    return null;
  }

  const Project = mongoose.models.Project;
  const project = await runAsSystem(async () =>
    Project.findOne(projectIdentityFilter(projectId)).lean(),
  );

  if (!tenantMatches(project, user?.tenantId)) {
    return null;
  }

  return project;
};

const userCanAccessProject = async ({ req, project, requiredPermission }) => {
  if (!project?._id || !req?.user?.id) {
    return false;
  }

  return await checkPermission({
    userId: req.user.id,
    role: req.user.role,
    resourceType: ResourceType.PROJECT,
    resourceId: project._id,
    requiredPermission,
  });
};

const ensureTenantProjectAccess = async ({ project, grantedBy }) => {
  if (!project?.tenantId || !project?._id) {
    return null;
  }

  const { grantPermission } = require('~/server/services/PermissionService');
  return await grantPermission({
    principalType: PrincipalType.TENANT,
    principalId: project.tenantId,
    resourceType: ResourceType.PROJECT,
    resourceId: project._id,
    accessRoleId: AccessRoleIds.PROJECT_EDITOR,
    grantedBy: grantedBy ?? project.user,
  });
};

const ensureOwnerProjectAccess = async ({ project }) => {
  if (!project?.user || !project?._id) {
    return null;
  }

  const { grantPermission } = require('~/server/services/PermissionService');
  return await grantPermission({
    principalType: PrincipalType.USER,
    principalId: project.user,
    resourceType: ResourceType.PROJECT,
    resourceId: project._id,
    accessRoleId: AccessRoleIds.PROJECT_OWNER,
    grantedBy: project.user,
  });
};

module.exports = {
  PROJECT_TENANT_PERMISSIONS,
  ensureOwnerProjectAccess,
  ensureTenantProjectAccess,
  findProjectForRequest,
  projectIdentityFilter,
  userCanAccessProject,
};
