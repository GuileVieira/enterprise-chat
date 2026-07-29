const express = require('express');
const { createAdminOverviewHandlers } = require('@librechat/api');
const { SystemCapabilities } = require('@librechat/data-schemas');
const { requireCapability } = require('~/server/middleware/roles/capabilities');
const { requireJwtAuth } = require('~/server/middleware');
const db = require('~/models');

const router = express.Router();

const requireAdminAccess = requireCapability(SystemCapabilities.ACCESS_ADMIN);

const handlers = createAdminOverviewHandlers({
  findUsers: db.findUsers,
  countUsers: db.countUsers,
  countRoles: db.countRoles,
  countGroups: db.countGroups,
  listAllConfigs: db.listAllConfigs,
  countTenantFunctions: db.countTenantFunctions,
  countTenantSecrets: db.countTenantSecrets,
});

router.use(requireJwtAuth, requireAdminAccess);

router.get('/', handlers.getOverview);

module.exports = router;
