const express = require('express');
const { requireJwtAuth } = require('~/server/middleware');
const { requireCapability } = require('~/server/middleware/roles/capabilities');
const { SystemCapabilities } = require('@librechat/data-schemas');
const db = require('~/models');

const router = express.Router();
const requireAdminAccess = requireCapability(SystemCapabilities.ACCESS_ADMIN);
const requireManageFunctions = requireCapability(SystemCapabilities.MANAGE_CONFIGS);

router.use(requireJwtAuth, requireAdminAccess);

router.get('/', async (req, res) => {
  try {
    const { tenantId } = req.query;
    if (!tenantId) {
      return res.status(400).json({ message: 'tenantId query param is required' });
    }
    const functions = await db.getTenantFunctions({ tenantId });
    return res.json({ functions });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.post('/', requireManageFunctions, async (req, res) => {
  try {
    const payload = req.body;
    if (!payload.tenantId || !payload.id) {
      return res.status(400).json({ message: 'tenantId and id are required' });
    }
    const existing = await db.getTenantFunctionById(payload.tenantId, payload.id);
    if (existing) {
      return res
        .status(409)
        .json({ message: `Function ${payload.id} already exists for tenant ${payload.tenantId}` });
    }
    const fn = await db.createTenantFunction(payload);
    return res.status(201).json({ function: fn });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { tenantId } = req.query;
    const { id } = req.params;
    if (!tenantId) {
      return res.status(400).json({ message: 'tenantId query param is required' });
    }
    const fn = await db.getTenantFunctionById(tenantId, id);
    if (!fn) {
      return res.status(404).json({ message: 'Function not found' });
    }
    return res.json({ function: fn });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.patch('/:id', requireManageFunctions, async (req, res) => {
  try {
    const { tenantId } = req.query;
    const { id } = req.params;
    if (!tenantId) {
      return res.status(400).json({ message: 'tenantId query param is required' });
    }
    const fn = await db.updateTenantFunction(tenantId, id, req.body);
    if (!fn) {
      return res.status(404).json({ message: 'Function not found' });
    }
    return res.json({ function: fn });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.patch('/:id/toggle', requireManageFunctions, async (req, res) => {
  try {
    const { tenantId } = req.query;
    const { id } = req.params;
    const { isActive } = req.body;
    if (!tenantId) {
      return res.status(400).json({ message: 'tenantId query param is required' });
    }
    const fn = await db.toggleTenantFunction(tenantId, id, isActive);
    if (!fn) {
      return res.status(404).json({ message: 'Function not found' });
    }
    return res.json({ function: fn });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.delete('/:id', requireManageFunctions, async (req, res) => {
  try {
    const { tenantId } = req.query;
    const { id } = req.params;
    if (!tenantId) {
      return res.status(400).json({ message: 'tenantId query param is required' });
    }
    await db.deleteTenantFunction(tenantId, id);
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

module.exports = router;
