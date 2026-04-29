const express = require('express');
const { logger } = require('@librechat/data-schemas');
const {
  getProjects,
  getProjectById,
  createProject,
  updateProject,
  deleteProject,
  archiveProject,
} = require('~/models');
const { requireJwtAuth } = require('~/server/middleware');

const router = express.Router();

router.use(requireJwtAuth);

/**
 * GET /
 * Retrieves all projects for the authenticated user.
 */
router.get('/', async (req, res) => {
  try {
    const projects = await getProjects(req.user.id);
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
router.post('/', async (req, res) => {
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
router.get('/:projectId', async (req, res) => {
  try {
    const project = await getProjectById(req.user.id, req.params.projectId);
    if (project) {
      res.status(200).json(project);
    } else {
      res.status(404).json({ error: 'Project not found' });
    }
  } catch (error) {
    logger.error('Error getting project:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /:projectId
 * Updates an existing project.
 */
router.put('/:projectId', async (req, res) => {
  try {
    const project = await updateProject(req.user.id, req.params.projectId, req.body);
    if (project) {
      res.status(200).json(project);
    } else {
      res.status(404).json({ error: 'Project not found' });
    }
  } catch (error) {
    logger.error('Error updating project:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /:projectId
 * Deletes a project.
 */
router.delete('/:projectId', async (req, res) => {
  try {
    const project = await deleteProject(req.user.id, req.params.projectId);
    if (project) {
      res.status(200).json(project);
    } else {
      res.status(404).json({ error: 'Project not found' });
    }
  } catch (error) {
    logger.error('Error deleting project:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /:projectId/archive
 * Archives or unarchives a project.
 */
router.put('/:projectId/archive', async (req, res) => {
  try {
    const { isArchived } = req.body;
    if (typeof isArchived !== 'boolean') {
      return res.status(400).json({ error: 'isArchived must be a boolean' });
    }
    const project = await archiveProject(req.user.id, req.params.projectId, isArchived);
    if (project) {
      res.status(200).json(project);
    } else {
      res.status(404).json({ error: 'Project not found' });
    }
  } catch (error) {
    logger.error('Error archiving project:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
