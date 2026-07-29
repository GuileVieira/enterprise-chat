const { ResourceType } = require('librechat-data-provider');
const { canAccessResource } = require('./canAccessResource');
const { findProjectForRequest } = require('~/server/services/Projects/access');

/**
 * Project ID resolver function
 * Resolves custom project ID (e.g., "550e8400-e29b-41d4-a716-446655440000") to MongoDB ObjectId
 *
 * @param {string} projectCustomId - Custom project ID from route parameter
 * @returns {Promise<Object|null>} Project document with _id field, or null if not found
 */
const resolveProjectId = async (projectCustomId, req) => {
  return await findProjectForRequest({ projectId: projectCustomId, user: req.user });
};

/**
 * Project-specific middleware factory that creates middleware to check project access permissions.
 * This middleware extends the generic canAccessResource to handle project custom ID resolution.
 *
 * @param {Object} options - Configuration options
 * @param {number} options.requiredPermission - The permission bit required (1=view, 2=edit, 4=delete, 8=share)
 * @param {string} [options.resourceIdParam='projectId'] - The name of the route parameter containing the project custom ID
 * @returns {Function} Express middleware function
 */
const canAccessProjectResource = (options) => {
  const { requiredPermission, resourceIdParam = 'projectId' } = options;

  if (!requiredPermission || typeof requiredPermission !== 'number') {
    throw new Error(
      'canAccessProjectResource: requiredPermission is required and must be a number',
    );
  }

  return canAccessResource({
    resourceType: ResourceType.PROJECT,
    requiredPermission,
    resourceIdParam,
    idResolver: resolveProjectId,
  });
};

module.exports = {
  canAccessProjectResource,
};
