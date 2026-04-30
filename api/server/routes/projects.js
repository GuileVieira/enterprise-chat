const express = require('express');
const { logger } = require('@librechat/data-schemas');
const { generateCheckAccess } = require('@librechat/api');
const {
  PermissionBits,
  PermissionTypes,
  Permissions,
  ResourceType,
} = require('librechat-data-provider');
const {
  getProjects,
  getProjectById,
  findProjectById,
  createProject,
  updateProject,
  deleteProject,
  archiveProject,
  getUserPrincipals,
  findAccessibleResources,
  grantPermission,
  deleteAclEntries,
  getRoleByName,
} = require('~/models');
const { requireJwtAuth } = require('~/server/middleware');
const {
  canAccessProjectResource,
} = require('~/server/middleware/accessResources/canAccessProject');

const checkProjectAccess = generateCheckAccess({
  permissionType: PermissionTypes.PROJECTS,
  permissions: [Permissions.USE],
  getRoleByName,
});

const checkProjectCreate = generateCheckAccess({
  permissionType: PermissionTypes.PROJECTS,
  permissions: [Permissions.USE, Permissions.CREATE],
  getRoleByName,
});

const router = express.Router();

router.use(requireJwtAuth);

/**
 * GET /
 * Retrieves all projects for the authenticated user, including shared ones.
 */
router.get('/', async (req, res) => {
  try {
    const { hasCapability } = require('~/server/middleware/roles/capabilities');
    const { ResourceCapabilityMap } = require('@librechat/data-schemas');
    const cap = ResourceCapabilityMap[ResourceType.PROJECT];
    const hasCap = await hasCapability(req.user, cap);

    const Project = require('~/models').Project || require('mongoose').models.Project;
    let projects;

    if (hasCap) {
      projects = await Project.find({}).sort({ updatedAt: -1 }).lean();
    } else {
      const principals = await getUserPrincipals({ userId: req.user.id, role: req.user.role });
      const accessibleIds = await findAccessibleResources(
        principals,
        ResourceType.PROJECT,
        PermissionBits.VIEW,
      );

      if (accessibleIds.length === 0) {
        return res.status(200).json([]);
      }

      projects = await Project.find({
        _id: { $in: accessibleIds },
      })
        .sort({ updatedAt: -1 })
        .lean();
    }

    res.status(200).json(projects);
  } catch (error) {
    logger.error('Error getting projects:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /
 * Creates a new project for the authenticated user.
 */
router.post('/', checkProjectCreate, async (req, res) => {
  try {
    const project = await createProject(req.user.id, req.body);
    res.status(201).json(project);
  } catch (error) {
    logger.error('Error creating project:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /:projectId
 * Retrieves a single project by ID.
 */
router.get(
  '/:projectId',
  checkProjectAccess,
  canAccessProjectResource({ requiredPermission: PermissionBits.VIEW }),
  async (req, res) => {
    try {
      const project =
        req.resourceAccess?.resourceInfo || (await getProjectById(req.params.projectId));
      if (project) {
        res.status(200).json(project);
      } else {
        res.status(404).json({ error: 'Project not found' });
      }
    } catch (error) {
      logger.error('Error getting project:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * PUT /:projectId
 * Updates an existing project.
 */
router.put(
  '/:projectId',
  checkProjectCreate,
  canAccessProjectResource({ requiredPermission: PermissionBits.EDIT }),
  async (req, res) => {
    try {
      const project = await updateProject(req.params.projectId, req.body);
      if (project) {
        res.status(200).json(project);
      } else {
        res.status(404).json({ error: 'Project not found' });
      }
    } catch (error) {
      logger.error('Error updating project:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * DELETE /:projectId
 * Deletes a project.
 */
router.delete(
  '/:projectId',
  checkProjectCreate,
  canAccessProjectResource({ requiredPermission: PermissionBits.DELETE }),
  async (req, res) => {
    try {
      const project = await deleteProject(req.params.projectId);
      if (project) {
        try {
          await deleteAclEntries({ resourceType: ResourceType.PROJECT, resourceId: project._id });
        } catch (aclError) {
          logger.error('Error deleting project ACL entries:', aclError);
        }
        res.status(200).json(project);
      } else {
        res.status(404).json({ error: 'Project not found' });
      }
    } catch (error) {
      logger.error('Error deleting project:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * PUT /:projectId/archive
 * Archives or unarchives a project.
 */
router.put(
  '/:projectId/archive',
  checkProjectCreate,
  canAccessProjectResource({ requiredPermission: PermissionBits.EDIT }),
  async (req, res) => {
    try {
      const { isArchived } = req.body;
      if (typeof isArchived !== 'boolean') {
        return res.status(400).json({ error: 'isArchived must be a boolean' });
      }
      const project = await archiveProject(req.params.projectId, isArchived);
      if (project) {
        res.status(200).json(project);
      } else {
        res.status(404).json({ error: 'Project not found' });
      }
    } catch (error) {
      logger.error('Error archiving project:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

module.exports = router;
