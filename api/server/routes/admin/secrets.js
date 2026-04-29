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
    const secrets = await db.listTenantSecrets(tenantId);
    return res.json({ secrets });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.post('/', requireManageFunctions, async (req, res) => {
  try {
    const { tenantId, name, value, type } = req.body;
    if (!tenantId || !name || !value || !type) {
      return res.status(400).json({ message: 'tenantId, name, value, and type are required' });
    }
    const secret = await db.upsertTenantSecret(tenantId, name, value, type);
    return res.status(201).json({ secret });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.delete('/:name', requireManageFunctions, async (req, res) => {
  try {
    const { tenantId } = req.query;
    const { name } = req.params;
    if (!tenantId) {
      return res.status(400).json({ message: 'tenantId query param is required' });
    }
    const inUse = await db.isSecretInUse(tenantId, name);
    if (inUse) {
      return res.status(409).json({ message: 'Secret is in use by one or more functions' });
    }
    await db.deleteTenantSecret(tenantId, name);
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

module.exports = router;
