/**
 * @import { TUpdateResourcePermissionsRequest, TUpdateResourcePermissionsResponse } from 'librechat-data-provider'
 */

const mongoose = require('mongoose');
const { logger, runAsSystem } = require('@librechat/data-schemas');
const {
  ResourceType,
  SystemRoles,
  PrincipalType,
  AccessRoleIds,
  PermissionBits,
} = require('librechat-data-provider');
const { enrichRemoteAgentPrincipals, backfillRemoteAgentPermissions } = require('@librechat/api');
const {
  bulkUpdateResourcePermissions,
  ensureGroupPrincipalExists,
  getResourcePermissionsMap,
  findAccessibleResources,
  getEffectivePermissions,
  ensurePrincipalExists,
  getAvailableRoles,
  grantPermission,
} = require('~/server/services/PermissionService');
const {
  entraIdPrincipalFeatureEnabled,
  searchEntraIdPrincipals,
} = require('~/server/services/GraphApiService');
const db = require('~/models');

/**
 * Generic controller for resource permission endpoints
 * Delegates validation and logic to PermissionService
 */

/**
 * Validates that the resourceType is one of the supported enum values
 * @param {string} resourceType - The resource type to validate
 * @throws {Error} If resourceType is not valid
 */
const validateResourceType = (resourceType) => {
  const validTypes = Object.values(ResourceType);
  if (!validTypes.includes(resourceType)) {
    throw new Error(`Invalid resourceType: ${resourceType}. Valid types: ${validTypes.join(', ')}`);
  }
};

const getResourceIdVariants = (resourceId) => {
  if (!mongoose.Types.ObjectId.isValid(resourceId)) {
    return [resourceId];
  }

  return [resourceId, mongoose.Types.ObjectId.createFromHexString(resourceId)];
};

const toIdString = (value) => {
  if (!value) {
    return '';
  }

  return value.toString();
};

const getPromptGroupViewerRole = () => AccessRoleIds.PROMPTGROUP_VIEWER;

const isAdminUser = (user) => user?.role === SystemRoles.ADMIN;

const getUserTenantId = async (userId) => {
  if (!userId || typeof db.getUserById !== 'function') {
    return undefined;
  }

  const user = await db.getUserById(userId, 'tenantId').catch((error) => {
    logger.warn('[updateResourcePermissions] Failed to fetch target user tenant', error);
    return null;
  });
  return user?.tenantId;
};

const sameTenant = (left, right) => (left || '') === (right || '');

const normalizePromptGroupPrincipal = async ({ principal, reqUser, action }) => {
  if (isAdminUser(reqUser)) {
    if (principal.type === PrincipalType.TENANT) {
      return {
        ...principal,
        accessRoleId: getPromptGroupViewerRole(),
      };
    }
    return principal;
  }

  if (principal.type !== PrincipalType.USER) {
    throw new Error(`Only admins can ${action} prompt access for this principal type`);
  }

  const targetTenantId = await getUserTenantId(principal.id);
  if (!sameTenant(targetTenantId, reqUser?.tenantId)) {
    throw new Error('Cannot share prompt outside your tenant');
  }

  return {
    ...principal,
    accessRoleId: getPromptGroupViewerRole(),
  };
};

const getAuthorPrincipal = async ({ agent, resourceId, grantedBy }) => {
  const authorId = toIdString(agent?.author);
  if (!authorId || !mongoose.Types.ObjectId.isValid(authorId)) {
    return null;
  }

  let user = null;
  if (typeof db.getUserById === 'function') {
    user = await db.getUserById(authorId).catch((error) => {
      logger.warn('[getResourcePermissions] Failed to fetch agent author', error);
      return null;
    });
  }

  await grantPermission({
    principalType: PrincipalType.USER,
    principalId: authorId,
    resourceType: ResourceType.AGENT,
    resourceId,
    accessRoleId: AccessRoleIds.AGENT_OWNER,
    grantedBy,
  });

  return {
    type: PrincipalType.USER,
    id: authorId,
    name: user?.name || user?.username,
    email: user?.email,
    avatar: user?.avatar,
    source: 'local',
    idOnTheSource: user?.idOnTheSource || authorId,
    accessRoleId: AccessRoleIds.AGENT_OWNER,
  };
};

/**
 * Bulk update permissions for a resource (grant, update, remove)
 * @route PUT /api/{resourceType}/{resourceId}/permissions
 * @param {Object} req - Express request object
 * @param {Object} req.params - Route parameters
 * @param {string} req.params.resourceType - Resource type (e.g., 'agent')
 * @param {string} req.params.resourceId - Resource ID
 * @param {TUpdateResourcePermissionsRequest} req.body - Request body
 * @param {Object} res - Express response object
 * @returns {Promise<TUpdateResourcePermissionsResponse>} Updated permissions response
 */
const updateResourcePermissions = async (req, res) => {
  try {
    const { resourceType, resourceId } = req.params;
    validateResourceType(resourceType);

    /** @type {TUpdateResourcePermissionsRequest} */
    const { updated, removed, public: isPublic, publicAccessRoleId } = req.body;
    const { id: userId } = req.user;

    // Prepare principals for the service call
    const updatedPrincipals = [];
    const revokedPrincipals = [];

    // Add updated principals
    if (updated && Array.isArray(updated)) {
      updatedPrincipals.push(...updated);
    }

    // Add public permission if enabled
    if (isPublic && publicAccessRoleId) {
      updatedPrincipals.push({
        type: PrincipalType.PUBLIC,
        id: null,
        accessRoleId: publicAccessRoleId,
      });
    }

    // Prepare authentication context for enhanced group member fetching
    const useEntraId = isAdminUser(req.user) && entraIdPrincipalFeatureEnabled(req.user);
    const authHeader = req.headers.authorization;
    const accessToken =
      authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;
    const authContext =
      useEntraId && accessToken
        ? {
            accessToken,
            sub: req.user.openidId,
          }
        : null;

    // Ensure updated principals exist in the database before processing permissions
    const validatedPrincipals = [];
    for (const principal of updatedPrincipals) {
      try {
        let principalId;

        if (principal.type === PrincipalType.PUBLIC) {
          principalId = null; // Public principals don't need database records
        } else if (principal.type === PrincipalType.ROLE) {
          principalId = principal.id; // Role principals use role name as ID
        } else if (principal.type === PrincipalType.USER) {
          principalId = await ensurePrincipalExists(principal);
        } else if (principal.type === PrincipalType.GROUP) {
          // Pass authContext to enable member fetching for Entra ID groups when available
          principalId = await ensureGroupPrincipalExists(principal, authContext);
        } else if (principal.type === PrincipalType.TENANT) {
          principalId = principal.id;
        } else {
          logger.error(`Unsupported principal type: ${principal.type}`);
          continue; // Skip invalid principal types
        }

        // Update the principal with the validated ID for ACL operations
        const validatedPrincipal = {
          ...principal,
          id: principalId,
          ...(resourceType === ResourceType.AGENT &&
            principal.type === PrincipalType.TENANT && {
              accessRoleId: AccessRoleIds.AGENT_VIEWER,
            }),
        };

        if (resourceType === ResourceType.PROMPTGROUP) {
          validatedPrincipals.push(
            await normalizePromptGroupPrincipal({
              principal: validatedPrincipal,
              reqUser: req.user,
              action: 'grant',
            }),
          );
        } else {
          validatedPrincipals.push(validatedPrincipal);
        }
      } catch (error) {
        if (resourceType === ResourceType.PROMPTGROUP) {
          return res.status(403).json({
            error: 'Forbidden',
            details: error.message,
          });
        }
        logger.error('Error ensuring principal exists:', {
          principal: {
            type: principal.type,
            id: principal.id,
            name: principal.name,
            source: principal.source,
          },
          error: error.message,
        });
        // Continue with other principals instead of failing the entire operation
        continue;
      }
    }

    // Add removed principals
    if (removed && Array.isArray(removed)) {
      for (const principal of removed) {
        if (resourceType !== ResourceType.PROMPTGROUP || principal.type === PrincipalType.PUBLIC) {
          revokedPrincipals.push(principal);
          continue;
        }

        try {
          revokedPrincipals.push(
            await normalizePromptGroupPrincipal({
              principal,
              reqUser: req.user,
              action: 'revoke',
            }),
          );
        } catch (error) {
          return res.status(403).json({
            error: 'Forbidden',
            details: error.message,
          });
        }
      }
    }

    // If public is disabled, add public to revoked list
    if (!isPublic) {
      revokedPrincipals.push({
        type: PrincipalType.PUBLIC,
        id: null,
      });
    }

    const hasTenantGrant = validatedPrincipals.some(
      (principal) => principal.type === PrincipalType.TENANT,
    );
    if (resourceType === ResourceType.AGENT && hasTenantGrant) {
      await runAsSystem(() =>
        db.updateAgent(
          { _id: resourceId },
          { $unset: { tenantId: '' } },
          { updatingUserId: userId, skipVersioning: true },
        ),
      );
    }

    const results = await bulkUpdateResourcePermissions({
      resourceType,
      resourceId,
      updatedPrincipals: validatedPrincipals,
      revokedPrincipals,
      grantedBy: userId,
    });

    if (results.errors.length > 0) {
      logger.error('[updateResourcePermissions] Permission updates failed', {
        resourceType,
        resourceId,
        errors: results.errors,
      });
      return res.status(400).json({
        error: 'Failed to update permissions',
        details: 'One or more permission updates failed',
        results,
      });
    }

    const isAgentResource =
      resourceType === ResourceType.AGENT || resourceType === ResourceType.REMOTE_AGENT;
    const revokedUserIds = results.revoked
      .filter((p) => p.type === PrincipalType.USER && p.id)
      .map((p) => p.id);

    if (isAgentResource && revokedUserIds.length > 0) {
      db.removeAgentFromUserFavorites(resourceId, revokedUserIds).catch((err) => {
        logger.error('[removeRevokedAgentFromFavorites] Error cleaning up favorites', err);
      });
    }

    /** @type {TUpdateResourcePermissionsResponse} */
    const response = {
      message: 'Permissions updated successfully',
      results: {
        principals: results.granted,
        public: isPublic || false,
        publicAccessRoleId: isPublic ? publicAccessRoleId : undefined,
      },
    };

    res.status(200).json(response);
  } catch (error) {
    logger.error('Error updating resource permissions:', error);
    res.status(400).json({
      error: 'Failed to update permissions',
      details: error.message,
    });
  }
};

/**
 * Get principals with their permission roles for a resource (UI-friendly format)
 * Uses efficient aggregation pipeline to join User/Group data in single query
 * @route GET /api/permissions/{resourceType}/{resourceId}
 */
const getResourcePermissions = async (req, res) => {
  try {
    const { resourceType, resourceId } = req.params;
    validateResourceType(resourceType);

    const resourceIds = getResourceIdVariants(resourceId);
    const results = await runAsSystem(() =>
      db.aggregateAclEntries([
        // Match ACL entries for this resource
        {
          $match: {
            resourceType,
            resourceId: { $in: resourceIds },
          },
        },
        // Lookup AccessRole information
        {
          $lookup: {
            from: 'accessroles',
            localField: 'roleId',
            foreignField: '_id',
            as: 'role',
          },
        },
        // Lookup User information (for user principals)
        {
          $lookup: {
            from: 'users',
            localField: 'principalId',
            foreignField: '_id',
            as: 'userInfo',
          },
        },
        // Lookup Group information (for group principals)
        {
          $lookup: {
            from: 'groups',
            localField: 'principalId',
            foreignField: '_id',
            as: 'groupInfo',
          },
        },
        // Project final structure
        {
          $project: {
            principalType: 1,
            principalId: 1,
            accessRoleId: { $arrayElemAt: ['$role.accessRoleId', 0] },
            userInfo: { $arrayElemAt: ['$userInfo', 0] },
            groupInfo: { $arrayElemAt: ['$groupInfo', 0] },
          },
        },
      ]),
    );

    let principals = [];
    let publicPermission = null;

    // Process aggregation results
    for (const result of results) {
      if (result.principalType === PrincipalType.PUBLIC) {
        publicPermission = {
          public: true,
          publicAccessRoleId: result.accessRoleId,
        };
      } else if (result.principalType === PrincipalType.USER && result.userInfo) {
        principals.push({
          type: PrincipalType.USER,
          id: result.userInfo._id.toString(),
          name: result.userInfo.name || result.userInfo.username,
          email: result.userInfo.email,
          avatar: result.userInfo.avatar,
          source: !result.userInfo._id ? 'entra' : 'local',
          idOnTheSource: result.userInfo.idOnTheSource || result.userInfo._id.toString(),
          accessRoleId: result.accessRoleId,
        });
      } else if (result.principalType === PrincipalType.GROUP && result.groupInfo) {
        principals.push({
          type: PrincipalType.GROUP,
          id: result.groupInfo._id.toString(),
          name: result.groupInfo.name,
          email: result.groupInfo.email,
          description: result.groupInfo.description,
          avatar: result.groupInfo.avatar,
          source: result.groupInfo.source || 'local',
          idOnTheSource: result.groupInfo.idOnTheSource || result.groupInfo._id.toString(),
          accessRoleId: result.accessRoleId,
        });
      } else if (result.principalType === PrincipalType.TENANT) {
        principals.push({
          type: PrincipalType.TENANT,
          id: result.principalId,
          name: `Tenant: ${result.principalId}`,
          description: 'Tenant-wide access',
          source: 'local',
          idOnTheSource: result.principalId,
          accessRoleId: result.accessRoleId,
        });
      } else if (result.principalType === PrincipalType.ROLE) {
        principals.push({
          type: PrincipalType.ROLE,
          /** Role name as ID */
          id: result.principalId,
          /** Display the role name */
          name: result.principalId,
          description: `System role: ${result.principalId}`,
          accessRoleId: result.accessRoleId,
        });
      }
    }

    const hasOwner = principals.some((principal) => {
      if (resourceType === ResourceType.AGENT) {
        return principal.accessRoleId === AccessRoleIds.AGENT_OWNER;
      }

      return false;
    });

    if (resourceType === ResourceType.AGENT && !hasOwner) {
      const agent = await runAsSystem(() => db.getAgent({ _id: resourceIds[1] || resourceId }));
      const authorPrincipal = await getAuthorPrincipal({
        agent,
        resourceId,
        grantedBy: req.user.id,
      });

      if (authorPrincipal) {
        principals.unshift(authorPrincipal);
      }
    }

    if (resourceType === ResourceType.REMOTE_AGENT) {
      const enricherDeps = {
        aggregateAclEntries: db.aggregateAclEntries,
        bulkWriteAclEntries: db.bulkWriteAclEntries,
        findRoleByIdentifier: db.findRoleByIdentifier,
        logger,
      };
      const enrichResult = await enrichRemoteAgentPrincipals(enricherDeps, resourceId, principals);
      principals = enrichResult.principals;
      backfillRemoteAgentPermissions(enricherDeps, resourceId, enrichResult.entriesToBackfill);
    }

    // Return response in format expected by frontend
    const response = {
      resourceType,
      resourceId,
      principals,
      public: publicPermission?.public || false,
      ...(publicPermission?.publicAccessRoleId && {
        publicAccessRoleId: publicPermission.publicAccessRoleId,
      }),
    };

    res.status(200).json(response);
  } catch (error) {
    logger.error('Error getting resource permissions principals:', error);
    res.status(500).json({
      error: 'Failed to get permissions principals',
      details: error.message,
    });
  }
};

/**
 * Get available roles for a resource type
 * @route GET /api/{resourceType}/roles
 */
const getResourceRoles = async (req, res) => {
  try {
    const { resourceType } = req.params;
    validateResourceType(resourceType);

    const roles = await getAvailableRoles({ resourceType });

    res.status(200).json(
      roles.map((role) => ({
        accessRoleId: role.accessRoleId,
        name: role.name,
        description: role.description,
        permBits: role.permBits,
      })),
    );
  } catch (error) {
    logger.error('Error getting resource roles:', error);
    res.status(500).json({
      error: 'Failed to get roles',
      details: error.message,
    });
  }
};

/**
 * Get user's effective permission bitmask for a resource
 * @route GET /api/{resourceType}/{resourceId}/effective
 */
const getUserEffectivePermissions = async (req, res) => {
  try {
    const { resourceType, resourceId } = req.params;
    validateResourceType(resourceType);

    const { id: userId } = req.user;

    let effectiveResourceId = resourceId;
    if (resourceType === ResourceType.PROJECT) {
      const project = await db.findProjectById(resourceId);
      if (project) {
        effectiveResourceId = project._id.toString();
      }
    }

    const permissionBits = await getEffectivePermissions({
      userId,
      role: req.user.role,
      resourceType,
      resourceId: effectiveResourceId,
    });

    res.status(200).json({
      permissionBits,
    });
  } catch (error) {
    logger.error('Error getting user effective permissions:', error);
    res.status(500).json({
      error: 'Failed to get effective permissions',
      details: error.message,
    });
  }
};

/**
 * Search for users and groups to grant permissions
 * Supports hybrid local database + Entra ID search when configured
 * @route GET /api/permissions/search-principals
 */
const searchPrincipals = async (req, res) => {
  try {
    const { q: rawQuery, limit = 20, types } = req.query;

    if (typeof rawQuery !== 'string' || rawQuery.trim().length === 0) {
      return res.status(400).json({
        error: 'Query parameter "q" is required and must not be empty',
      });
    }

    const query = rawQuery.trim();

    if (query.length < 2) {
      return res.status(400).json({
        error: 'Query must be at least 2 characters long',
      });
    }

    const searchLimit = Math.min(Math.max(1, parseInt(limit) || 10), 50);

    let typeFilters = null;
    if (types) {
      const typesArray = Array.isArray(types) ? types : types.split(',');
      const validTypes = typesArray.filter((t) =>
        [PrincipalType.USER, PrincipalType.GROUP, PrincipalType.ROLE].includes(t),
      );
      typeFilters = validTypes.length > 0 ? validTypes : null;
    }

    const localResults = await db.searchPrincipals(query.trim(), searchLimit, typeFilters, {
      tenantId: req.user?.tenantId,
      global: isAdminUser(req.user),
    });
    let allPrincipals = [...localResults];

    const useEntraId = entraIdPrincipalFeatureEnabled(req.user);

    if (useEntraId && localResults.length < searchLimit) {
      try {
        let graphType = 'all';
        if (typeFilters && typeFilters.length === 1) {
          const graphTypeMap = {
            [PrincipalType.USER]: 'users',
            [PrincipalType.GROUP]: 'groups',
          };
          const mappedType = graphTypeMap[typeFilters[0]];
          if (mappedType) {
            graphType = mappedType;
          }
        }

        const authHeader = req.headers.authorization;
        const accessToken =
          authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;

        if (accessToken) {
          const graphResults = await searchEntraIdPrincipals(
            accessToken,
            req.user.openidId,
            query,
            graphType,
            searchLimit - localResults.length,
          );

          const localEmails = new Set(
            localResults.map((p) => p.email?.toLowerCase()).filter(Boolean),
          );
          const localGroupSourceIds = new Set(
            localResults.map((p) => p.idOnTheSource).filter(Boolean),
          );

          for (const principal of graphResults) {
            const isDuplicateByEmail =
              principal.email && localEmails.has(principal.email.toLowerCase());
            const isDuplicateBySourceId =
              principal.idOnTheSource && localGroupSourceIds.has(principal.idOnTheSource);

            if (!isDuplicateByEmail && !isDuplicateBySourceId) {
              allPrincipals.push(principal);
            }
          }
        }
      } catch (graphError) {
        logger.warn('Graph API search failed, falling back to local results:', graphError.message);
      }
    }
    const scoredResults = allPrincipals.map((item) => ({
      ...item,
      _searchScore: db.calculateRelevanceScore(item, query),
    }));

    const finalResults = db
      .sortPrincipalsByRelevance(scoredResults)
      .slice(0, searchLimit)
      .map((result) => {
        const { _searchScore, ...resultWithoutScore } = result;
        return resultWithoutScore;
      });

    res.status(200).json({
      query,
      limit: searchLimit,
      types: typeFilters,
      results: finalResults,
      count: finalResults.length,
      sources: {
        local: finalResults.filter((r) => r.source === 'local').length,
        entra: finalResults.filter((r) => r.source === 'entra').length,
      },
    });
  } catch (error) {
    logger.error('Error searching principals:', error);
    res.status(500).json({
      error: 'Failed to search principals',
    });
  }
};

/**
 * Get user's effective permissions for all accessible resources of a type
 * @route GET /api/permissions/{resourceType}/effective/all
 */
const getAllEffectivePermissions = async (req, res) => {
  try {
    const { resourceType } = req.params;
    validateResourceType(resourceType);

    const { id: userId } = req.user;

    // Find all resources the user has at least VIEW access to
    const accessibleResourceIds = await findAccessibleResources({
      userId,
      role: req.user.role,
      resourceType,
      requiredPermissions: PermissionBits.VIEW,
    });

    if (accessibleResourceIds.length === 0) {
      return res.status(200).json({});
    }

    // Get effective permissions for all accessible resources
    const permissionsMap = await getResourcePermissionsMap({
      userId,
      role: req.user.role,
      resourceType,
      resourceIds: accessibleResourceIds,
    });

    // Convert Map to plain object for JSON response
    const result = {};
    for (const [resourceId, permBits] of permissionsMap) {
      result[resourceId] = permBits;
    }

    res.status(200).json(result);
  } catch (error) {
    logger.error('Error getting all effective permissions:', error);
    res.status(500).json({
      error: 'Failed to get all effective permissions',
      details: error.message,
    });
  }
};

module.exports = {
  updateResourcePermissions,
  getResourcePermissions,
  getResourceRoles,
  getUserEffectivePermissions,
  getAllEffectivePermissions,
  searchPrincipals,
};
