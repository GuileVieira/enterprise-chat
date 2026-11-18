const express = require('express');
const rateLimit = require('express-rate-limit');
const {
  PermissionBits,
  PermissionTypes,
  ResourceType,
  AgentCapabilities,
} = require('librechat-data-provider');
const {
  createIntegrationAuth,
  createIntegrationReaders,
  createIntegrationSkills,
  createIntegrationContent,
  createIntegrationHistory,
  createIntegrationContext,
  createIntegrationToolHandlers,
  IntegrationError,
  limiterCache,
  resolveDownloadPath,
} = require('@librechat/api');
const { checkBan } = require('~/server/middleware');
const { hasCapability } = require('~/server/middleware/roles/capabilities');
const {
  checkPermission,
  getEffectivePermissions,
  findAccessibleResources,
} = require('~/server/services/PermissionService');
const { getAppConfig, checkCapability } = require('~/server/services/Config');
const { getStrategyFunctions } = require('~/server/services/Files/strategies');
const { filterFilesByAgentAccess } = require('~/server/services/Files/permissions');
const { createIntegrationToolService } = require('~/server/services/ToolService');
const db = require('~/models');
const integrationOpenAPI = require('../openapi/integrations.json');

const router = express.Router();
router.use(
  createIntegrationAuth({
    ...db,
    getAppConfig,
    isPrincipalActive: db.isAgentTriggerPrincipalActive,
  }),
);
router.use(checkBan);
router.use(
  rateLimit({
    windowMs: 60 * 1000,
    max: 120,
    keyGenerator: (req) => `${req.integrationAuth.tenantId}:${req.integrationAuth.principalId}`,
    store: limiterCache('integration_principal'),
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res) =>
      res.status(429).json({ error: { code: 'rate_limited', message: 'Request limit exceeded' } }),
  }),
);
const readers = createIntegrationReaders({
  ...db,
  checkPermission,
  getEffectivePermissions,
  findAccessibleResources,
  hasCapability,
  fileAccess: async (req, files, agent, execution) => {
    const inherited = agent
      ? await filterFilesByAgentAccess({
          files,
          userId: req.user.id,
          role: req.user.role,
          agentId: agent.id,
          resourceType: execution ? ResourceType.REMOTE_AGENT : ResourceType.AGENT,
        })
      : [];
    const ids = new Set(inherited.map((file) => file.file_id));
    for (const file of files) {
      if (
        ids.has(file.file_id) ||
        String(file.user) === req.user.id ||
        (await checkPermission({
          userId: req.user.id,
          role: req.user.role,
          resourceType: ResourceType.FILE,
          resourceId: file._id,
          requiredPermission: PermissionBits.VIEW,
        }))
      )
        ids.add(file.file_id);
      else if (file.projectId) {
        try {
          await readers.project(req, file.projectId);
          ids.add(file.file_id);
        } catch (error) {
          if (!(error instanceof IntegrationError && error.status === 404)) throw error;
        }
      }
    }
    return ids;
  },
});
const skills = createIntegrationSkills(
  {
    ...db,
    findAccessibleResources,
    skillsCapability: (req) => checkCapability(req, AgentCapabilities.skills),
    readSkillFile: async (req, file) => {
      const strategy = getStrategyFunctions(file.source);
      if (!strategy.getDownloadStream) return null;
      const stream = await strategy.getDownloadStream(req, resolveDownloadPath(file));
      const chunks = [];
      let bytes = 0;
      const timeout = setTimeout(
        () => stream.destroy(new Error('Skill file read timed out')),
        10000,
      );
      try {
        for await (const chunk of stream) {
          const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
          bytes += buffer.length;
          if (bytes > 512 * 1024) return Buffer.alloc(512 * 1024 + 1);
          chunks.push(buffer);
        }
        return Buffer.concat(chunks);
      } finally {
        clearTimeout(timeout);
        stream.destroy();
      }
    },
  },
  readers,
);
const content = createIntegrationContent(readers);
const history = createIntegrationHistory(readers);
const tools = createIntegrationToolHandlers({
  ...createIntegrationToolService(),
  resolveExportAgent: async (req, id) => skills.effectiveTools(req, await readers.agent(req, id)),
  resolveAgent: async (req, id) => skills.effectiveTools(req, await readers.agent(req, id, true)),
  resolveProject: (req, id, permission = 'view') =>
    readers.project(req, id, permission === 'edit' ? PermissionBits.EDIT : PermissionBits.VIEW),
  resolveFiles: async (req, agent, projectId) =>
    (await readers.files(req, agent, projectId, true)).map((file) => ({
      file_id: file.file_id,
      filename: file.filename,
      projectId: file.projectId,
      metadata: file.metadata,
      fromAgent: Object.values(agent.tool_resources ?? {}).some((resource) =>
        resource.file_ids?.includes(file.file_id),
      ),
    })),
  requireFileSearch: async (req) => {
    await readers.feature(req, PermissionTypes.FILE_SEARCH);
    if (!(await checkCapability(req, AgentCapabilities.file_search)))
      throw new IntegrationError(403, 'permission_denied', 'File search disabled');
  },
  integrationCalls: db,
  getTenantFunctions: db.getTenantFunctions,
  getTenantSecret: db.getTenantSecret,
});
const handlers = {
  ...readers.handlers,
  ...skills.handlers,
  ...content.handlers,
  ...history.handlers,
};
router.get('/openapi.json', (_req, res) => res.json(integrationOpenAPI));
router.get('/identity', handlers.identity);
router.get('/agents', handlers.agents);
router.get('/agents/:id', handlers.agent);
router.get('/agents/:id/context', createIntegrationContext(readers, skills, content));
router.get('/agents/:id/files', handlers.agentFiles);
router.get('/agents/:id/tools', tools.catalog);
router.post('/tools/:toolName/call', tools.call);
router.get('/projects', handlers.projects);
router.get('/projects/:projectId', handlers.project);
router.get('/projects/:projectId/files', handlers.projectFiles);
router.get('/projects/:projectId/prompts', handlers.projectPrompts);
router.get('/projects/:projectId/memories', handlers.projectMemories);
router.get('/skills', handlers.skills);
router.get('/skills/:id', handlers.skill);
router.get('/skills/:id/files', handlers.skillFiles);
router.get('/skills/:id/files/*relativePath', handlers.skillFile);
router.get('/prompts/:id', handlers.prompt);
router.get('/memories', handlers.memories);
router.get('/conversations', handlers.conversations);
router.get('/conversations/:id/messages', handlers.messages);
module.exports = router;
