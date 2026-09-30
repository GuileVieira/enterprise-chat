const express = require('express');
const mongoose = require('mongoose');
const { logger } = require('@librechat/data-schemas');
const {
  Tokenizer,
  isSharedMemoryKey,
  isScalarString,
  validateSharedMemoryImportRequest,
  generateCheckAccess,
  createAgentMemoryPartitionMiddleware,
  blockFilteredMemoryContent,
  projectStoredMemories,
  createSharedMemoryService,
  createSharedMemoryReadHandlers,
  createSharedMemoryCrudHandlers,
  createSharedMemoryExportHandler,
  createSharedImportHandler,
  createSharedMemoryProjectHandlers,
  createSharedLibraryHandlers,
  createSharedImportSupport,
  createSharedMemoryLifecycleHandlers,
  ImportOperationConflictError,
  SharedMemoryBusyError,
} = require('@librechat/api');
const {
  PermissionBits,
  ResourceType,
  PrincipalType,
  AccessRoleIds,
  PermissionTypes,
  Permissions,
} = require('librechat-data-provider');
const { getRoleByName, getAgent } = require('~/models');
const { hasCapability } = require('~/server/middleware/roles/capabilities');
const { requireJwtAuth, configMiddleware } = require('~/server/middleware');
const { checkPermission, grantPermission } = require('~/server/services/PermissionService');
const { findProjectForRequest } = require('~/server/services/Projects/access');

const router = express.Router();
router.use(requireJwtAuth, express.json({ limit: '1mb' }), configMiddleware);
const requireLibraryWriteEnabled = (req, res, next) => {
  const allowlist = (process.env.SHARED_MEMORY_LIBRARY_TENANTS || '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
  if (!allowlist.includes('*') && !allowlist.includes(String(req.user.tenantId)))
    return res.status(404).json({ error: 'Shared memory library writes are not enabled.' });
  next();
};

const checkSharedRead = generateCheckAccess({
  permissionType: PermissionTypes.SHARED_MEMORIES,
  permissions: [Permissions.READ],
  getRoleByName,
});
const checkSharedCreate = generateCheckAccess({
  permissionType: PermissionTypes.SHARED_MEMORIES,
  permissions: [Permissions.CREATE],
  getRoleByName,
});
const checkSharedUpdate = generateCheckAccess({
  permissionType: PermissionTypes.SHARED_MEMORIES,
  permissions: [Permissions.UPDATE],
  getRoleByName,
});
const validateAgentPartition = createAgentMemoryPartitionMiddleware({
  source: 'query',
  getAgent,
  getRoleByName,
  hasCapability,
  checkPermission,
});
const validateBodyAgentPartition = createAgentMemoryPartitionMiddleware({
  source: 'body',
  getAgent,
  getRoleByName,
  hasCapability,
  checkPermission,
});
const validateImportAgentPartition = (req, res, next) => {
  const agentId =
    req.body?.destination?.type === 'personal' ? req.body.destination.agentId : undefined;
  if (!agentId) return next();
  req.body.agentId = agentId;
  return validateBodyAgentPartition(req, res, next);
};
const validatePublishAgentPartition = (req, res, next) => {
  const agentId = req.body?.source?.type === 'personal' ? req.body.source.agentId : undefined;
  if (!agentId) return next();
  req.body.agentId = agentId;
  return validateBodyAgentPartition(req, res, next);
};
const validKey = isSharedMemoryKey;
const scalarString = isScalarString;
const validProjectId = (value) => scalarString(value, 256);
const tenant = (req) => req.user.tenantId;
const view = (doc) => ({
  id: String(doc._id),
  key: doc.key,
  value: doc.value,
  tokenCount: doc.tokenCount,
  status: doc.status,
  authorId: doc.authorId ? String(doc.authorId) : undefined,
  version: doc.version,
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt,
});
const countTokens = (value) => Tokenizer.getTokenCount(value, 'o200k_base');
const audit = (req, action, details = {}) =>
  logger.info('[shared-memory-audit]', {
    action,
    tenantId: tenant(req),
    actorId: req.user.id,
    ...details,
  });
async function hasRolePermissions(req, type, required) {
  const role = await getRoleByName(req.user.role);
  return required.every((permission) => role?.permissions?.[type]?.[permission] === true);
}
const sharedService = () => createSharedMemoryService(mongoose.models);
const typedReadHandlers = createSharedMemoryReadHandlers({
  projectFor,
  projectEditPermission: PermissionBits.EDIT,
  projectViewPermission: PermissionBits.VIEW,
  projectStoredMemories,
});
const typedCrudHandlers = createSharedMemoryCrudHandlers({
  projectFor,
  projectEditPermission: PermissionBits.EDIT,
});
const typedExportHandler = createSharedMemoryExportHandler({
  projectFor,
  hasRolePermissions,
  projectViewPermission: PermissionBits.VIEW,
  memoryPermissionType: PermissionTypes.MEMORIES,
  memoryUsePermission: Permissions.USE,
  memoryReadPermission: Permissions.READ,
  projectStoredMemories,
});
const typedProjectHandlers = createSharedMemoryProjectHandlers({
  projectFor,
  hasRolePermissions,
  withLibraryWrite,
  assertLibraryQuota,
  countTokens,
  projectStoredMemories,
  blockFilteredMemoryContent,
  audit,
  view,
  projectEditPermission: PermissionBits.EDIT,
  memoryPermissionType: PermissionTypes.MEMORIES,
  memoryUsePermission: Permissions.USE,
  memoryReadPermission: Permissions.READ,
});
const typedLibraryHandlers = createSharedLibraryHandlers({
  projectFor,
  projectViewPermission: PermissionBits.VIEW,
  projectStoredMemories,
  blockFilteredMemoryContent,
  withLibraryWrite,
  assertLibraryQuota,
  countTokens,
  audit,
  view,
});
const typedLifecycleHandlers = createSharedMemoryLifecycleHandlers({
  projectFor,
  checkPermission,
  grantPermission,
  projectViewPermission: PermissionBits.VIEW,
  projectEditPermission: PermissionBits.EDIT,
  resourceTypeProject: ResourceType.PROJECT,
  principalTypeUser: PrincipalType.USER,
  projectOwnerAccessRoleId: AccessRoleIds.PROJECT_OWNER,
});
async function assertLibraryQuota(req, tokenDelta) {
  return sharedService().assertQuota(tenant(req), tokenDelta, req.config?.memory?.tokenLimit);
}
async function acquireLibraryLock(req) {
  return sharedService().acquire(tenant(req));
}
const releaseLibraryLock = (req, token) => sharedService().release(tenant(req), token);
async function withLibraryWrite(req, write) {
  const token = await acquireLibraryLock(req);
  try {
    return await write();
  } finally {
    await releaseLibraryLock(req, token);
  }
}
async function projectFor(req, permission) {
  const projectId = req.params.projectId || req.body?.projectId;
  if (!validProjectId(projectId)) return null;
  const project = await findProjectForRequest({ projectId, user: req.user });
  if (!project?._id) return null;
  const allowed = await checkPermission({
    userId: req.user.id,
    role: req.user.role,
    resourceType: ResourceType.PROJECT,
    resourceId: project._id,
    requiredPermission: permission,
  });
  return allowed ? project : null;
}

const importSupport = createSharedImportSupport({
  projectFor,
  projectEditPermission: PermissionBits.EDIT,
  getRoleByName,
  projectStoredMemories,
  countTokens,
});
const typedImportHandler = createSharedImportHandler({
  ...importSupport,
  projectFor,
  projectEditPermission: PermissionBits.EDIT,
  memoryUse: Permissions.USE,
  memoryCreate: Permissions.CREATE,
  memoryUpdate: Permissions.UPDATE,
  countTokens,
  validKey,
  audit,
  ImportOperationConflictError,
  SharedMemoryBusyError,
});

router.get('/shared-memories', checkSharedRead, typedLibraryHandlers.list);
router.post(
  '/shared-memories',
  requireLibraryWriteEnabled,
  checkSharedCreate,
  typedLibraryHandlers.create,
);

router.post(
  '/shared-memories/publish',
  requireLibraryWriteEnabled,
  checkSharedCreate,
  validatePublishAgentPartition,
  typedProjectHandlers.publish,
);

router.patch(
  '/shared-memories/:id',
  requireLibraryWriteEnabled,
  checkSharedUpdate,
  typedLibraryHandlers.update,
);
router.post(
  '/shared-memories/:id/archive',
  requireLibraryWriteEnabled,
  checkSharedUpdate,
  typedLibraryHandlers.archive,
);
router.post(
  '/shared-memories/:id/restore',
  requireLibraryWriteEnabled,
  checkSharedUpdate,
  typedLibraryHandlers.restore,
);

router.post(
  '/projects/:projectId/shared-memories',
  requireLibraryWriteEnabled,
  typedCrudHandlers.link,
);

router.delete('/projects/:projectId/shared-memories/:memoryId', typedCrudHandlers.unlink);

router.post('/shared-memories/:id/copy', requireLibraryWriteEnabled, typedCrudHandlers.copy);

router.post(
  '/shared-memories/import/preview',
  (req, res, next) =>
    validateSharedMemoryImportRequest(req.body, false)
      ? next()
      : res.status(400).json({ error: 'Invalid import request.' }),
  validateImportAgentPartition,
  async (req, res) => {
    try {
      res.json(await importSupport.preview(req));
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  },
);

router.post(
  '/shared-memories/import',
  requireLibraryWriteEnabled,
  (req, res, next) =>
    validateSharedMemoryImportRequest(req.body, true)
      ? next()
      : res.status(400).json({ error: 'Invalid import request.' }),
  validateImportAgentPartition,
  typedImportHandler,
);

router.get('/shared-memories/export', checkSharedRead, validateAgentPartition, typedExportHandler);

router.get('/shared-memories/deletion-impact', typedLifecycleHandlers.selfDeletionImpact);
router.get(
  '/shared-memories/users/:userId/deletion-impact',
  typedLifecycleHandlers.userDeletionImpact,
);
router.get(
  '/projects/:projectId/shared-memories/deletion-impact',
  typedLifecycleHandlers.projectDeletionImpact,
);

router.get(
  '/projects/:projectId/shared-memories/legacy-candidates',
  typedReadHandlers.legacyCandidates,
);

router.post(
  '/projects/:projectId/shared-memories/legacy-resolutions',
  requireLibraryWriteEnabled,
  checkSharedCreate,
  typedProjectHandlers.resolveLegacy,
);

router.get(
  '/projects/:projectId/shared-memories/context-status',
  checkSharedRead,
  typedReadHandlers.contextStatus,
);

router.post('/projects/:projectId/shared-memories/owner', typedLifecycleHandlers.reassignOwner);
router.get('/shared-memories/:id/consumers', typedLifecycleHandlers.consumers);

module.exports = router;
