const express = require('express');
const { createAdminTenantsHandlers } = require('@librechat/api');
const { SystemCapabilities } = require('@librechat/data-schemas');
const { requireCapability } = require('~/server/middleware/roles/capabilities');
const { requireJwtAuth } = require('~/server/middleware');
const db = require('~/models');

const router = express.Router();

const requireAdminAccess = requireCapability(SystemCapabilities.ACCESS_ADMIN);
const requireReadUsers = requireCapability(SystemCapabilities.READ_USERS);

const handlers = createAdminTenantsHandlers({
  findUsers: db.findUsers,
  countUsers: db.countUsers,
});

router.use(requireJwtAuth, requireAdminAccess);

router.get('/', requireReadUsers, handlers.listTenants);
router.get('/:tenantId/users', requireReadUsers, handlers.listTenantUsers);
router.get('/:tenantId/stats', requireReadUsers, handlers.getTenantStats);

module.exports = router;
