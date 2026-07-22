const express = require('express');
const router = express.Router();
const { requireJwtAuth } = require('~/server/middleware');
const checkAdmin = require('~/server/middleware/roles/admin');
const {
  getCategories,
  createPromptCategory,
  updatePromptCategory,
  deletePromptCategory,
  countPromptCategoryUsage,
} = require('~/models');

router.get('/', requireJwtAuth, async (req, res) => {
  try {
    const categories = await getCategories();
    res.status(200).send(categories);
  } catch (error) {
    res.status(500).send({ message: 'Failed to retrieve categories', error: error.message });
  }
});

router.post('/', requireJwtAuth, checkAdmin, async (req, res) => {
  try {
    const { label, value, icon, order } = req.body;
    if (!label || !value) {
      return res.status(400).send({ message: 'Label and value are required' });
    }
    const category = await createPromptCategory({ label, value, icon, order });
    res.status(201).send(category);
  } catch (error) {
    res.status(500).send({ message: 'Failed to create category', error: error.message });
  }
});

router.patch('/:id', requireJwtAuth, checkAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { label, icon, order } = req.body;
    const category = await updatePromptCategory(id, { label, icon, order });
    if (!category) {
      return res.status(404).send({ message: 'Category not found' });
    }
    res.status(200).send(category);
  } catch (error) {
    res.status(500).send({ message: 'Failed to update category', error: error.message });
  }
});

router.delete('/:id', requireJwtAuth, checkAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { value } = req.query;

    if (value) {
      const usageCount = await countPromptCategoryUsage(value);
      if (usageCount > 0) {
        return res.status(409).send({
          message: 'Category is in use',
          usageCount,
        });
      }
    }

    const deleted = await deletePromptCategory(id);
    if (!deleted) {
      return res.status(404).send({ message: 'Category not found' });
    }
    res.status(200).send({ message: 'Category deleted' });
  } catch (error) {
    res.status(500).send({ message: 'Failed to delete category', error: error.message });
  }
});

module.exports = router;
