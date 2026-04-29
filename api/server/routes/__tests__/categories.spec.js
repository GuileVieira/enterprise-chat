const express = require('express');
const request = require('supertest');

jest.mock('~/models', () => ({
  getCategories: jest.fn(),
  createPromptCategory: jest.fn(),
  updatePromptCategory: jest.fn(),
  deletePromptCategory: jest.fn(),
  countPromptCategoryUsage: jest.fn(),
}));

jest.mock('~/server/middleware', () => ({
  requireJwtAuth: (req, res, next) => {
    req.user = req.user || { id: 'test-user-123', role: 'admin' };
    next();
  },
}));

jest.mock('~/server/middleware/roles/admin', () => (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Forbidden' });
  }
  next();
});

describe('Categories Routes', () => {
  let app;
  const {
    getCategories,
    createPromptCategory,
    updatePromptCategory,
    deletePromptCategory,
    countPromptCategoryUsage,
  } = require('~/models');

  beforeAll(() => {
    const categoriesRouter = require('../categories');

    app = express();
    app.use(express.json());
    app.use('/api/categories', categoriesRouter);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /', () => {
    it('should return categories for the authenticated user', async () => {
      const mockCategories = [
        { label: 'Briefing', value: 'briefing', icon: '📋' },
        { label: 'SEO', value: 'seo', icon: '🔍' },
      ];
      getCategories.mockResolvedValue(mockCategories);

      const response = await request(app).get('/api/categories');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockCategories);
      expect(getCategories).toHaveBeenCalledTimes(1);
    });

    it('should handle errors gracefully', async () => {
      getCategories.mockRejectedValue(new Error('DB error'));

      const response = await request(app).get('/api/categories');

      expect(response.status).toBe(500);
      expect(response.body.message).toBe('Failed to retrieve categories');
    });
  });

  describe('POST /', () => {
    it('should create a category when user is admin', async () => {
      const mockCategory = {
        _id: 'cat-123',
        label: 'Nova Categoria',
        value: 'nova_categoria',
        icon: '🎯',
        order: 5,
      };
      createPromptCategory.mockResolvedValue(mockCategory);

      const response = await request(app).post('/api/categories').send({
        label: 'Nova Categoria',
        value: 'nova_categoria',
        icon: '🎯',
        order: 5,
      });

      expect(response.status).toBe(201);
      expect(response.body).toEqual(mockCategory);
      expect(createPromptCategory).toHaveBeenCalledWith({
        label: 'Nova Categoria',
        value: 'nova_categoria',
        icon: '🎯',
        order: 5,
      });
    });

    it('should return 400 when label or value is missing', async () => {
      const response = await request(app)
        .post('/api/categories')
        .send({ label: 'Sem Value' });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Label and value are required');
      expect(createPromptCategory).not.toHaveBeenCalled();
    });

    it('should return 403 when user is not admin', async () => {
      const nonAdminApp = express();
      nonAdminApp.use(express.json());
      nonAdminApp.use((req, res, next) => {
        req.user = { id: 'test-user-123', role: 'user' };
        next();
      });

      jest.resetModules();
      jest.doMock('~/server/middleware', () => ({
        requireJwtAuth: (req, res, next) => {
          req.user = { id: 'test-user-123', role: 'user' };
          next();
        },
      }));
      jest.doMock('~/server/middleware/roles/admin', () => (req, res, next) => {
        if (req.user.role !== 'admin') {
          return res.status(403).json({ message: 'Forbidden' });
        }
        next();
      });

      const categoriesRouter = require('../categories');
      nonAdminApp.use('/api/categories', categoriesRouter);

      const response = await request(nonAdminApp)
        .post('/api/categories')
        .send({ label: 'Test', value: 'test' });

      expect(response.status).toBe(403);
    });
  });

  describe('PATCH /:id', () => {
    it('should update a category when user is admin', async () => {
      const mockCategory = {
        _id: 'cat-123',
        label: 'Categoria Atualizada',
        value: 'nova_categoria',
        icon: '🎨',
      };
      updatePromptCategory.mockResolvedValue(mockCategory);

      const response = await request(app)
        .patch('/api/categories/cat-123')
        .send({ label: 'Categoria Atualizada', icon: '🎨' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockCategory);
      expect(updatePromptCategory).toHaveBeenCalledWith('cat-123', {
        label: 'Categoria Atualizada',
        icon: '🎨',
      });
    });

    it('should return 404 when category not found', async () => {
      updatePromptCategory.mockResolvedValue(null);

      const response = await request(app)
        .patch('/api/categories/nonexistent')
        .send({ label: 'Test' });

      expect(response.status).toBe(404);
      expect(response.body.message).toBe('Category not found');
    });
  });

  describe('DELETE /:id', () => {
    it('should delete a category when not in use', async () => {
      countPromptCategoryUsage.mockResolvedValue(0);
      deletePromptCategory.mockResolvedValue(true);

      const response = await request(app)
        .delete('/api/categories/cat-123')
        .query({ value: 'briefing' });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Category deleted');
      expect(countPromptCategoryUsage).toHaveBeenCalledWith('briefing');
      expect(deletePromptCategory).toHaveBeenCalledWith('cat-123');
    });

    it('should return 409 when category is in use', async () => {
      countPromptCategoryUsage.mockResolvedValue(3);

      const response = await request(app)
        .delete('/api/categories/cat-123')
        .query({ value: 'briefing' });

      expect(response.status).toBe(409);
      expect(response.body.message).toBe('Category is in use');
      expect(response.body.usageCount).toBe(3);
      expect(deletePromptCategory).not.toHaveBeenCalled();
    });

    it('should return 404 when category not found', async () => {
      countPromptCategoryUsage.mockResolvedValue(0);
      deletePromptCategory.mockResolvedValue(false);

      const response = await request(app)
        .delete('/api/categories/nonexistent')
        .query({ value: 'test' });

      expect(response.status).toBe(404);
      expect(response.body.message).toBe('Category not found');
    });

    it('should allow delete without value query (skips usage check)', async () => {
      deletePromptCategory.mockResolvedValue(true);

      const response = await request(app).delete('/api/categories/cat-123');

      expect(response.status).toBe(200);
      expect(countPromptCategoryUsage).not.toHaveBeenCalled();
    });
  });
});
