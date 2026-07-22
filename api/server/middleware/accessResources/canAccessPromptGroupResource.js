const { ResourceType } = require('librechat-data-provider');
const { runAsSystem } = require('@librechat/data-schemas');
const { canAccessResource } = require('./canAccessResource');
const { getPromptGroup } = require('~/models');
const mongoose = require('mongoose');

/**
 * PromptGroup ID resolver function
 * Resolves promptGroup ID to MongoDB ObjectId
 *
 * @param {string} groupId - PromptGroup ID from route parameter
 * @returns {Promise<Object|null>} PromptGroup document with _id field, or null if not found
 */
const resolvePromptGroupId = async (groupId) => {
  return await runAsSystem(() => getPromptGroup({ _id: groupId }));
};

const resolveProjectInheritance = async ({ resourceId, requiredPermission }) => {
  const Project = mongoose.models.Project;
  if (!Project) {
    return [];
  }
  const projects = await Project.find({ promptGroupIds: resourceId.toString() })
    .select('_id')
    .lean();
  return projects.map((project) => ({
    resourceType: ResourceType.PROJECT,
    resourceId: project._id,
    requiredPermission,
  }));
};

/**
 * PromptGroup-specific middleware factory that creates middleware to check promptGroup access permissions.
 * This middleware extends the generic canAccessResource to handle promptGroup ID resolution.
 *
 * @param {Object} options - Configuration options
 * @param {number} options.requiredPermission - The permission bit required (1=view, 2=edit, 4=delete, 8=share)
 * @param {string} [options.resourceIdParam='groupId'] - The name of the route parameter containing the promptGroup ID
 * @returns {Function} Express middleware function
 *
 * @example
 * // Basic usage for viewing promptGroups
 * router.get('/prompts/groups/:groupId',
 *   canAccessPromptGroupResource({ requiredPermission: 1 }),
 *   getPromptGroup
 * );
 *
 * @example
 * // Custom resource ID parameter and edit permission
 * router.patch('/prompts/groups/:id',
 *   canAccessPromptGroupResource({
 *     requiredPermission: 2,
 *     resourceIdParam: 'id'
 *   }),
 *   updatePromptGroup
 * );
 */
const canAccessPromptGroupResource = (options) => {
  const { requiredPermission, resourceIdParam = 'groupId' } = options;

  if (!requiredPermission || typeof requiredPermission !== 'number') {
    throw new Error(
      'canAccessPromptGroupResource: requiredPermission is required and must be a number',
    );
  }

  return canAccessResource({
    resourceType: ResourceType.PROMPTGROUP,
    requiredPermission,
    resourceIdParam,
    idResolver: resolvePromptGroupId,
    inheritedResourceResolver: resolveProjectInheritance,
  });
};

module.exports = {
  canAccessPromptGroupResource,
};
