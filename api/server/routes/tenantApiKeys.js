const express = require('express');
const { createTenantApiHandlers } = require('@librechat/api');
const { requireJwtAuth } = require('~/server/middleware');
const { getEffectivePermissions } = require('~/server/services/PermissionService');
const db = require('~/models');

const handlers = createTenantApiHandlers({ ...db, getEffectivePermissions });
const router = express.Router();
router.use(requireJwtAuth);
router.get('/catalog', handlers.manage);
router.get('/', handlers.manage);
router.post('/', handlers.manage);
router.delete('/:id', handlers.manage);
module.exports = router;
