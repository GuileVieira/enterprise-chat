const express = require('express');
const { logger, runAsSystem } = require('@librechat/data-schemas');
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
  deleteAclEntries,
  getRoleByName,
  getFiles,
} = require('~/models');
const { requireJwtAuth } = require('~/server/middleware');
const { checkPermission } = require('~/server/services/PermissionService');
const {
  findProjectForRequest,
  ensureTenantUsersProjectViewAccess,
} = require('~/server/services/Projects/access');
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

const validateProjectUpdate = async ({ req, res }) => {
  const { promptGroupIds, fileIds } = req.body ?? {};

  if (Array.isArray(promptGroupIds) && promptGroupIds.length > 0) {
    for (const groupId of [...new Set(promptGroupIds)]) {
      const allowed = await checkPermission({
        userId: req.user.id,
        role: req.user.role,
        resourceType: ResourceType.PROMPTGROUP,
        resourceId: groupId,
        requiredPermission: PermissionBits.VIEW,
      });
      if (!allowed) {
        res.status(403).json({ error: 'Insufficient prompt group permissions' });
        return false;
      }
    }
  }

  if (Array.isArray(fileIds) && fileIds.length > 0) {
    const uniqueFileIds = [...new Set(fileIds)];
    const project =
      req.resourceAccess?.resourceInfo ||
      (await findProjectForRequest({ projectId: req.params.projectId, user: req.user }));
    const existingProjectFileIds = Array.isArray(project?.fileIds)
      ? project.fileIds.filter(Boolean)
      : [];
    const files = await runAsSystem(async () =>
      getFiles(
        {
          file_id: { $in: uniqueFileIds },
          $or: [{ projectId: project?.projectId }, { file_id: { $in: existingProjectFileIds } }],
        },
        null,
        { text: 0 },
      ),
    );
    if ((files?.length ?? 0) !== uniqueFileIds.length) {
      res.status(403).json({ error: 'Insufficient file permissions' });
      return false;
    }
  }

  return true;
};

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
      const ownProjects = await getProjects(req.user.id);
      const principals = await getUserPrincipals({ userId: req.user.id, role: req.user.role });
      const accessibleIds = await findAccessibleResources(
        principals,
        ResourceType.PROJECT,
        PermissionBits.VIEW,
      );

      if (accessibleIds.length === 0) {
        return res.status(200).json(ownProjects);
      }

      const sharedProjects = await Project.find({
        _id: { $in: accessibleIds },
      })
        .sort({ updatedAt: -1 })
        .lean();
      const ownProjectIds = new Set(ownProjects.map((project) => project._id?.toString()));
      projects = [
        ...ownProjects,
        ...sharedProjects.filter((project) => !ownProjectIds.has(project._id?.toString())),
      ];
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
    await ensureTenantUsersProjectViewAccess({ project, grantedBy: req.user.id });
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
  canAccessProjectResource({ requiredPermission: PermissionBits.VIEW }),
  async (req, res) => {
    try {
      const project =
        req.resourceAccess?.resourceInfo ||
        (await findProjectForRequest({ projectId: req.params.projectId, user: req.user })) ||
        (await getProjectById(req.params.projectId)) ||
        (await findProjectById(req.params.projectId));
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
  checkProjectAccess,
  canAccessProjectResource({ requiredPermission: PermissionBits.EDIT }),
  async (req, res) => {
    try {
      const isValidUpdate = await validateProjectUpdate({ req, res });
      if (!isValidUpdate) {
        return;
      }
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
  checkProjectAccess,
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
  checkProjectAccess,
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
