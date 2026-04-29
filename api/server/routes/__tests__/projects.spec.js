const express = require('express');
const request = require('supertest');

jest.mock('~/models', () => ({
  getProjects: jest.fn(),
  getProjectById: jest.fn(),
  createProject: jest.fn(),
  updateProject: jest.fn(),
  deleteProject: jest.fn(),
  archiveProject: jest.fn(),
}));

jest.mock('~/server/middleware', () => ({
  requireJwtAuth: (req, res, next) => {
    req.user = req.user || { id: 'test-user-123' };
    next();
  },
}));

describe('Projects Routes', () => {
  let app;
  const {
    getProjects,
    getProjectById,
    createProject,
    updateProject,
    deleteProject,
    archiveProject,
  } = require('~/models');

  beforeAll(() => {
    const projectsRouter = require('../projects');

    app = express();
    app.use(express.json());
    app.use('/api/projects', projectsRouter);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /', () => {
    it('should return projects for the authenticated user', async () => {
      const mockProjects = [
        { projectId: 'proj-1', name: 'Project One', user: 'test-user-123' },
        { projectId: 'proj-2', name: 'Project Two', user: 'test-user-123' },
      ];
      getProjects.mockResolvedValue(mockProjects);

      const response = await request(app).get('/api/projects');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockProjects);
      expect(getProjects).toHaveBeenCalledWith('test-user-123');
    });

    it('should return 500 on error', async () => {
      getProjects.mockRejectedValue(new Error('DB error'));

      const response = await request(app).get('/api/projects');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Internal server error');
    });
  });

  describe('POST /', () => {
    it('should create a new project', async () => {
      const mockProject = { projectId: 'proj-1', name: 'New Project', user: 'test-user-123' };
      createProject.mockResolvedValue(mockProject);

      const response = await request(app).post('/api/projects').send({ name: 'New Project' });

      expect(response.status).toBe(201);
      expect(response.body).toEqual(mockProject);
      expect(createProject).toHaveBeenCalledWith('test-user-123', { name: 'New Project' });
    });

    it('should return 500 on error', async () => {
      createProject.mockRejectedValue(new Error('DB error'));

      const response = await request(app).post('/api/projects').send({ name: 'New Project' });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Internal server error');
    });
  });

  describe('GET /:projectId', () => {
    it('should return a project by id', async () => {
      const mockProject = { projectId: 'proj-1', name: 'Project One', user: 'test-user-123' };
      getProjectById.mockResolvedValue(mockProject);

      const response = await request(app).get('/api/projects/proj-1');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockProject);
      expect(getProjectById).toHaveBeenCalledWith('test-user-123', 'proj-1');
    });

    it('should return 404 when project not found', async () => {
      getProjectById.mockResolvedValue(null);

      const response = await request(app).get('/api/projects/non-existent');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Project not found');
    });
  });

  describe('PUT /:projectId', () => {
    it('should update a project', async () => {
      const mockProject = { projectId: 'proj-1', name: 'Updated', user: 'test-user-123' };
      updateProject.mockResolvedValue(mockProject);

      const response = await request(app).put('/api/projects/proj-1').send({ name: 'Updated' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockProject);
      expect(updateProject).toHaveBeenCalledWith('test-user-123', 'proj-1', { name: 'Updated' });
    });

    it('should return 404 when project not found', async () => {
      updateProject.mockResolvedValue(null);

      const response = await request(app).put('/api/projects/non-existent').send({ name: 'X' });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Project not found');
    });
  });

  describe('DELETE /:projectId', () => {
    it('should delete a project', async () => {
      const mockProject = { projectId: 'proj-1', name: 'Deleted', user: 'test-user-123' };
      deleteProject.mockResolvedValue(mockProject);

      const response = await request(app).delete('/api/projects/proj-1');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockProject);
      expect(deleteProject).toHaveBeenCalledWith('test-user-123', 'proj-1');
    });

    it('should return 404 when project not found', async () => {
      deleteProject.mockResolvedValue(null);

      const response = await request(app).delete('/api/projects/non-existent');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Project not found');
    });
  });

  describe('PUT /:projectId/archive', () => {
    it('should archive a project', async () => {
      const mockProject = { projectId: 'proj-1', name: 'Project', isArchived: true };
      archiveProject.mockResolvedValue(mockProject);

      const response = await request(app).put('/api/projects/proj-1/archive').send({ isArchived: true });

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockProject);
      expect(archiveProject).toHaveBeenCalledWith('test-user-123', 'proj-1', true);
    });

    it('should return 400 when isArchived is not a boolean', async () => {
      const response = await request(app).put('/api/projects/proj-1/archive').send({ isArchived: 'yes' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('isArchived must be a boolean');
    });

    it('should return 404 when project not found', async () => {
      archiveProject.mockResolvedValue(null);

      const response = await request(app).put('/api/projects/non-existent/archive').send({ isArchived: true });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Project not found');
    });
  });
});
