const express = require('express');
const request = require('supertest');

const mockProjectFind = jest.fn();
const mockFindProjectForRequest = jest.fn();
const mockEnsureTenantUsersProjectViewAccess = jest.fn();

jest.mock('~/models', () => ({
  getProjects: jest.fn(),
  getProjectById: jest.fn(),
  findProjectById: jest.fn(),
  getTenantFiles: jest.fn(),
  createProject: jest.fn(),
  updateProject: jest.fn(),
  deleteProject: jest.fn(),
  archiveProject: jest.fn(),
  getUserPrincipals: jest.fn(),
  findAccessibleResources: jest.fn(),
  grantPermission: jest.fn(),
  deleteAclEntries: jest.fn(),
  getRoleByName: jest.fn(),
  Project: { find: () => ({ sort: () => ({ lean: mockProjectFind }) }) },
}));

jest.mock('~/server/services/PermissionService', () => ({
  checkPermission: jest.fn(),
}));

jest.mock('~/server/middleware', () => ({
  requireJwtAuth: (req, res, next) => {
    req.user = req.user || { id: 'test-user-123', role: 'USER' };
    next();
  },
}));

jest.mock('@librechat/api', () => ({
  generateCheckAccess: () => (req, res, next) => {
    next();
  },
}));

jest.mock('~/server/middleware/accessResources/canAccessProject', () => ({
  canAccessProjectResource: () => (req, res, next) => {
    next();
  },
}));

jest.mock('~/server/services/Projects/access', () => ({
  findProjectForRequest: (...args) => mockFindProjectForRequest(...args),
  ensureTenantUsersProjectViewAccess: (...args) => mockEnsureTenantUsersProjectViewAccess(...args),
}));

jest.mock('~/server/middleware/roles/capabilities', () => ({
  hasCapability: jest.fn().mockResolvedValue(false),
}));

describe('Projects Routes', () => {
  let app;
  const {
    getProjects,
    getProjectById,
    findProjectById,
    createProject,
    updateProject,
    deleteProject,
    archiveProject,
    getTenantFiles,
    getUserPrincipals,
    findAccessibleResources,
    grantPermission,
    deleteAclEntries,
  } = require('~/models');
  const { checkPermission } = require('~/server/services/PermissionService');

  beforeAll(() => {
    const projectsRouter = require('../projects');

    app = express();
    app.use(express.json());
    app.use('/api/projects', projectsRouter);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    getUserPrincipals.mockResolvedValue([]);
    findAccessibleResources.mockResolvedValue([]);
    mockFindProjectForRequest.mockResolvedValue(null);
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

    it('should include shared projects from accessible resources', async () => {
      const ownProjects = [{ projectId: 'proj-1', name: 'Own Project', user: 'test-user-123' }];
      const sharedProjects = [
        { _id: 'shared-id', projectId: 'proj-2', name: 'Shared Project', user: 'other-user' },
      ];
      getProjects.mockResolvedValue(ownProjects);
      getUserPrincipals.mockResolvedValue([{ id: 'group-1', type: 'group' }]);
      findAccessibleResources.mockResolvedValue(['shared-id']);
      mockProjectFind.mockResolvedValue(sharedProjects);

      const response = await request(app).get('/api/projects');

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
      expect(response.body[0]).toEqual(ownProjects[0]);
      expect(response.body[1]).toEqual(sharedProjects[0]);
    });
  });

  describe('POST /', () => {
    it('should create a new project', async () => {
      const mockProject = {
        projectId: 'proj-1',
        name: 'New Project',
        user: 'test-user-123',
        _id: 'mock-object-id',
      };
      createProject.mockResolvedValue(mockProject);

      const response = await request(app).post('/api/projects').send({ name: 'New Project' });

      expect(response.status).toBe(201);
      expect(response.body).toEqual(mockProject);
      expect(createProject).toHaveBeenCalledWith('test-user-123', { name: 'New Project' });
      expect(mockEnsureTenantUsersProjectViewAccess).toHaveBeenCalledWith({
        project: mockProject,
        grantedBy: 'test-user-123',
      });
    });

    it('should return 500 on error', async () => {
      createProject.mockRejectedValue(new Error('DB error'));

      const response = await request(app).post('/api/projects').send({ name: 'New Project' });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Internal server error');
    });

    it('should grant owner permission after creation', async () => {
      const mockProject = {
        projectId: 'proj-1',
        name: 'New Project',
        user: 'test-user-123',
        _id: 'mock-object-id',
      };
      createProject.mockResolvedValue(mockProject);
      grantPermission.mockResolvedValue(undefined);

      const response = await request(app).post('/api/projects').send({ name: 'New Project' });

      expect(response.status).toBe(201);
      expect(createProject).toHaveBeenCalledWith('test-user-123', { name: 'New Project' });
    });
  });

  describe('project input security', () => {
    it.each(['projectId', 'tenantId', 'user', '_id', 'fileIds.0', 'accessLevel'])(
      'rejects protected field %s before persistence',
      async (field) => {
        for (const method of ['post', 'put']) {
          const url = method === 'post' ? '/api/projects' : '/api/projects/proj-1';
          const response = await request(app)
            [method](url)
            .send({ name: 'Project', [field]: 'bad' });
          expect(response.status).toBe(400);
        }
        expect(createProject).not.toHaveBeenCalled();
        expect(updateProject).not.toHaveBeenCalled();
      },
    );

    it.each(['post', 'put'])('authorizes links on %s', async (method) => {
      const url = method === 'post' ? '/api/projects' : '/api/projects/proj-1';
      getTenantFiles.mockResolvedValue([
        { file_id: 'file', user: 'another-user', projectId: 'source' },
      ]);
      mockFindProjectForRequest.mockResolvedValue({ _id: 'source-mongo' });
      checkPermission.mockResolvedValue(false);
      expect(
        (
          await request(app)
            [method](url)
            .send({ name: 'Project', fileIds: ['file'] })
        ).status,
      ).toBe(403);
      checkPermission.mockResolvedValue(true);
      createProject.mockResolvedValue({ projectId: 'created' });
      updateProject.mockResolvedValue({ projectId: 'proj-1' });
      expect(
        (
          await request(app)
            [method](url)
            .send({ name: 'Project', fileIds: ['file'] })
        ).status,
      ).toBe(method === 'post' ? 201 : 200);
      expect(checkPermission).toHaveBeenCalledWith(
        expect.objectContaining({ resourceId: 'source-mongo' }),
      );
    });
  });

  describe('GET /:projectId', () => {
    it('should return a project by id', async () => {
      const mockProject = { projectId: 'proj-1', name: 'Project One', user: 'test-user-123' };
      getProjectById.mockResolvedValue(mockProject);

      const response = await request(app).get('/api/projects/proj-1');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockProject);
      expect(getProjectById).toHaveBeenCalledWith('proj-1');
    });

    it('should return 404 when project not found', async () => {
      getProjectById.mockResolvedValue(null);
      findProjectById.mockResolvedValue(null);

      const response = await request(app).get('/api/projects/non-existent');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Project not found');
    });

    it('should fallback to findProjectById for shared projects', async () => {
      const mockProject = { projectId: 'proj-1', name: 'Shared Project', user: 'other-user' };
      getProjectById.mockResolvedValue(null);
      findProjectById.mockResolvedValue(mockProject);

      const response = await request(app).get('/api/projects/proj-1');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockProject);
    });
  });

  describe('PUT /:projectId', () => {
    it('should update a project', async () => {
      const mockProject = { projectId: 'proj-1', name: 'Updated', user: 'test-user-123' };
      updateProject.mockResolvedValue(mockProject);

      const response = await request(app).put('/api/projects/proj-1').send({ name: 'Updated' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockProject);
      expect(updateProject).toHaveBeenCalledWith('proj-1', { name: 'Updated' });
    });

    it('should reject prompt groups the user cannot view', async () => {
      checkPermission.mockResolvedValue(false);

      const response = await request(app)
        .put('/api/projects/proj-1')
        .send({ promptGroupIds: ['507f1f77bcf86cd799439011'] });

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Insufficient prompt group permissions');
      expect(updateProject).not.toHaveBeenCalled();
    });

    it('should reject fileIds that are not already attached to the project', async () => {
      getTenantFiles.mockResolvedValue([]);

      const response = await request(app)
        .put('/api/projects/proj-1')
        .send({ fileIds: ['foreign-file'] });

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Insufficient file permissions');
      expect(updateProject).not.toHaveBeenCalled();
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
      expect(deleteProject).toHaveBeenCalledWith('proj-1');
    });

    it('should return 404 when project not found', async () => {
      deleteProject.mockResolvedValue(null);

      const response = await request(app).delete('/api/projects/non-existent');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Project not found');
    });

    it('should delete ACL entries after project deletion', async () => {
      const mockProject = {
        projectId: 'proj-1',
        name: 'Deleted',
        user: 'test-user-123',
        _id: 'mock-object-id',
      };
      deleteProject.mockResolvedValue(mockProject);
      deleteAclEntries.mockResolvedValue(undefined);

      const response = await request(app).delete('/api/projects/proj-1');

      expect(response.status).toBe(200);
      expect(deleteAclEntries).toHaveBeenCalledWith({
        resourceType: 'project',
        resourceId: 'mock-object-id',
      });
    });
  });

  describe('PUT /:projectId/archive', () => {
    it('should archive a project', async () => {
      const mockProject = { projectId: 'proj-1', name: 'Project', isArchived: true };
      archiveProject.mockResolvedValue(mockProject);

      const response = await request(app)
        .put('/api/projects/proj-1/archive')
        .send({ isArchived: true });

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockProject);
      expect(archiveProject).toHaveBeenCalledWith('proj-1', true);
    });

    it('should return 400 when isArchived is not a boolean', async () => {
      const response = await request(app)
        .put('/api/projects/proj-1/archive')
        .send({ isArchived: 'yes' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('isArchived must be a boolean');
    });

    it('should return 404 when project not found', async () => {
      archiveProject.mockResolvedValue(null);

      const response = await request(app)
        .put('/api/projects/non-existent/archive')
        .send({ isArchived: true });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Project not found');
    });
  });
});
