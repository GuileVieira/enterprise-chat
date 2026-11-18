const multer = require('multer');
const JSZip = require('jszip');
const mongoose = require('mongoose');
const {
  checkAccess,
  encodeAgentArchive,
  decodeAgentArchive,
  importAgentArchive,
  previewAgentArchive,
  createImportHandler,
  buildSkillMarkdown,
  readSkillExportFile,
  getStorageMetadata,
  resolveRequestTenantId,
  resolveToolRoleGrants,
  inspectContent,
  extractAgentContent,
  agentArchiveSkillsEqual,
  parseSkillMarkdown,
  projectAgentManagementResponse,
  projectAgentArchive,
} = require('@librechat/api');
const { logger, runAsSystem, ResourceCapabilityMap } = require('@librechat/data-schemas');
const {
  Tools,
  SkillsScope,
  resolveAgentSkillsScope,
  FileContext,
  ResourceType,
  PermissionBits,
  PermissionTypes,
  Permissions,
  mergeFileConfig,
} = require('librechat-data-provider');
const db = require('~/models');
const v1 = require('~/server/controllers/agents/v1');
const { checkCapability } = require('~/server/services/Config');
const { hasCapability } = require('~/server/middleware/roles/capabilities');
const {
  checkPermission,
  findAccessibleResources,
  grantPermission,
} = require('~/server/services/PermissionService');
const {
  getSkillDbMethods,
  getSkillStrategyFunctions,
  withDeploymentSkillIds,
} = require('~/server/services/Endpoints/agents/skillDeps');
const { getStrategyFunctions } = require('~/server/services/Files/strategies');
const { getFileStrategy } = require('~/server/utils/getFileStrategy');

const MAX_BYTES = 50 * 1024 * 1024;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024, files: 1, fields: 0, parts: 2 },
}).single('file');

function requestWith(req, overrides) {
  const copy = Object.create(req);
  for (const [key, value] of Object.entries(overrides)) {
    Object.defineProperty(copy, key, { value, writable: true, configurable: true });
  }
  return copy;
}

function failure(status, message) {
  return Object.assign(new Error(message), { status });
}

async function invoke(handler, req) {
  let status = 200;
  let body;
  const response = {
    status(code) {
      status = code;
      return response;
    },
    json(value) {
      body = value;
      return response;
    },
    send(value) {
      body = value;
      return response;
    },
    setHeader() {
      return response;
    },
  };
  await handler(req, response);
  if (status >= 400 || body === undefined) {
    throw failure(status >= 400 ? status : 500, 'Archive operation failed');
  }
  return body;
}

async function requireFeature(req, type, create = false) {
  if (
    !req.user?.id ||
    !req.user.tenantId ||
    !(await checkAccess({
      req,
      user: req.user,
      permissionType: type,
      permissions: create ? [Permissions.USE, Permissions.CREATE] : [Permissions.USE],
      getRoleByName: db.getRoleByName,
    }))
  )
    throw failure(403, 'Permission denied');
}

async function exportBundle(req) {
  await requireFeature(req, PermissionTypes.AGENTS);
  let agent = await mongoose.models.Agent.findOne({ id: req.params.id }).lean();
  if (!agent) {
    const ids = await findAccessibleResources({
      userId: req.user.id,
      role: req.user.role,
      resourceType: ResourceType.AGENT,
      requiredPermissions: PermissionBits.EDIT,
    });
    agent = await runAsSystem(() =>
      mongoose.models.Agent.findOne({
        id: req.params.id,
        _id: { $in: ids },
      }).lean(),
    );
  }
  if (!agent) throw failure(404, 'Agent not found');
  const manages =
    agent.tenantId === req.user.tenantId &&
    (await hasCapability(req.user, ResourceCapabilityMap[ResourceType.AGENT]));
  if (
    !manages &&
    !(await checkPermission({
      userId: req.user.id,
      role: req.user.role,
      resourceType: ResourceType.AGENT,
      resourceId: agent._id,
      requiredPermission: PermissionBits.EDIT,
    }))
  )
    throw failure(404, 'Agent not found');
  const scope = resolveAgentSkillsScope(agent.skills, agent.skills_enabled, agent.skills_scope);
  const ids = scope === SkillsScope.selected ? [...new Set(agent.skills ?? [])] : [];
  const skillDb = getSkillDbMethods();
  const skills = [];
  let bytes = 0;
  if (ids.length) {
    await requireFeature(req, PermissionTypes.SKILLS);
    if (!(await checkCapability(req, 'skills'))) throw failure(403, 'Skills disabled');
    const accessible = withDeploymentSkillIds(
      await findAccessibleResources({
        userId: req.user.id,
        role: req.user.role,
        resourceType: ResourceType.SKILL,
        requiredPermissions: PermissionBits.VIEW,
      }),
    );
    const allowed = new Set(accessible.map(String));
    for (const id of ids) {
      if (!allowed.has(String(id))) throw failure(403, 'Skill access denied');
      const skill = await runAsSystem(() => skillDb.getSkillById(id));
      if (!skill) throw failure(404, 'Skill not found');
      const markdown = Buffer.from(buildSkillMarkdown(skill));
      bytes += markdown.length;
      if (bytes > MAX_BYTES) throw failure(413, 'Archive too large');
      const files = [{ path: 'SKILL.md', data: markdown }];
      for (const file of await runAsSystem(() => skillDb.listSkillFiles(skill._id))) {
        const data = await readSkillExportFile(
          req,
          file,
          getSkillStrategyFunctions,
          Math.min(10 * 1024 * 1024, MAX_BYTES - bytes),
        );
        bytes += data.length;
        files.push({ path: file.relativePath, data });
      }
      skills.push({ name: skill.name, files });
    }
  }
  const names = new Set(skills.map((skill) => skill.name));
  if (names.size !== skills.length) throw failure(409, 'Selected skills have duplicate names');
  if (!agent.name || !agent.provider || !agent.model) {
    throw failure(409, 'Agent requires a name, provider and model before export');
  }
  return projectAgentArchive(agent, skills);
}

async function resolveTools(req, tools) {
  const grants = await resolveToolRoleGrants({ req, getRoleByName: db.getRoleByName });
  const permitted = {
    [Tools.file_search]: grants.fileSearch,
    [Tools.web_search]: grants.webSearch,
    [Tools.execute_code]: grants.runCode,
  };
  const resolved = [];
  const warnings = [];
  for (const tool of tools) {
    if (
      tool.kind === 'builtin' &&
      Object.hasOwn(permitted, tool.name) &&
      permitted[tool.name] === true &&
      (await checkCapability(req, tool.name))
    ) {
      resolved.push(tool.name);
    } else {
      warnings.push(`Reconnect tool in destination: ${tool.name}`);
    }
  }
  return { tools: resolved, warnings };
}

function skillImporter(req, resources) {
  const deps = {
    limits: (request) => ({
      maxZipBytes: mergeFileConfig(request.config?.fileConfig).skills?.fileSizeLimit ?? MAX_BYTES,
    }),
    createSkill: async (data) => {
      const result = await db.createSkill(data);
      resources.ids.add(String(result.skill._id));
      return result;
    },
    getSkillById: db.getSkillById,
    deleteSkill: db.deleteSkill,
    upsertSkillFile: db.upsertSkillFile,
    grantPermission,
    saveBuffer: async (request, params) => {
      const source = getFileStrategy(request.config, {
        context: FileContext.skill_file,
        isImage: params.isImage,
      });
      const strategy = getStrategyFunctions(source);
      if (!strategy.saveBuffer || !strategy.deleteFile)
        throw failure(400, 'Storage cannot safely import files');
      const tenantId = resolveRequestTenantId(request);
      const filepath = await strategy.saveBuffer({ ...params, tenantId });
      const saved = { filepath, source, ...getStorageMetadata({ filepath, source }) };
      resources.blobs.push(saved);
      return saved;
    },
    deleteFile: async (request, file) => {
      await getStrategyFunctions(file.source).deleteFile(request, file);
      resources.blobs = resources.blobs.filter((item) => item.filepath !== file.filepath);
    },
  };
  return deps;
}

async function skillRequest(req, skill) {
  const zip = new JSZip();
  for (const file of skill.files) zip.file(file.path, file.data, { createFolders: false });
  const buffer = await zip.generateAsync({ type: 'nodebuffer' });
  return requestWith(req, {
    file: {
      originalname: `${skill.name}.zip`,
      buffer,
      size: buffer.length,
    },
  });
}

async function reusableSkills(req, bundle) {
  const reused = new Map();
  let bytes = 0;
  for (const skill of bundle.skills) {
    const existing = await mongoose.models.Skill.findOne({
      name: skill.name,
      author: req.user._id ?? req.user.id,
      tenantId: req.user.tenantId,
    }).lean();
    if (!existing) continue;
    if (
      !(await checkPermission({
        userId: req.user.id,
        role: req.user.role,
        resourceType: ResourceType.SKILL,
        resourceId: existing._id,
        requiredPermission: PermissionBits.VIEW,
      }))
    )
      throw failure(403, 'Skill access denied');
    const markdown = Buffer.from(buildSkillMarkdown(existing));
    bytes += markdown.length;
    if (bytes > MAX_BYTES) throw failure(413, 'Archive too large');
    const files = [{ path: 'SKILL.md', data: markdown }];
    for (const file of await db.listSkillFiles(existing._id)) {
      const data = await readSkillExportFile(
        req,
        file,
        getSkillStrategyFunctions,
        Math.min(10 * 1024 * 1024, MAX_BYTES - bytes),
      );
      bytes += data.length;
      files.push({ path: file.relativePath, data });
    }
    const incomingMarkdown = skill.files
      .find((file) => file.path === 'SKILL.md')
      .data.toString('utf8');
    const parsed = parseSkillMarkdown(incomingMarkdown);
    const canonicalIncoming = Buffer.from(
      buildSkillMarkdown({
        name: parsed.name || skill.name,
        description: parsed.description || skill.name,
        body: incomingMarkdown,
        frontmatter: parsed.frontmatter,
        alwaysApply: parsed.alwaysApply,
      }),
    );
    const canonicalSkill = {
      ...skill,
      files: skill.files.map((file) =>
        file.path === 'SKILL.md' ? { ...file, data: canonicalIncoming } : file,
      ),
    };
    if (!agentArchiveSkillsEqual(canonicalSkill, { name: existing.name, files })) {
      throw failure(409, 'A different skill with this name already exists');
    }
    reused.set(skill.name, String(existing._id));
  }
  return reused;
}

async function prepare(req) {
  await requireFeature(req, PermissionTypes.AGENTS, true);
  if (!req.file?.buffer) throw failure(400, 'ZIP file required');
  let bundle;
  try {
    bundle = await decodeAgentArchive(req.file.buffer);
  } catch {
    throw failure(400, 'Invalid agent archive');
  }
  if (
    inspectContent(extractAgentContent({ ...bundle.agent, instructions: bundle.instructions }), {
      filters: req.config?.filters,
    })
  )
    throw failure(400, 'Agent content blocked by policy');
  if (bundle.skills.length || bundle.agent.skills_enabled === true) {
    await requireFeature(req, PermissionTypes.SKILLS, bundle.skills.length > 0);
    if (!(await checkCapability(req, 'skills'))) throw failure(403, 'Skills disabled');
  }
  const resources = { ids: new Set(), blobs: [] };
  const deps = skillImporter(req, resources);
  const validate = createImportHandler(deps, { previewOnly: true });
  for (const skill of bundle.skills) {
    const parsed = await invoke(validate, await skillRequest(req, skill));
    if (parsed.name !== skill.name) throw failure(400, 'Skill name differs from manifest');
  }
  return { bundle, resources, deps, reused: await reusableSkills(req, bundle) };
}

async function cleanup(req, resources) {
  const results = await Promise.allSettled([
    ...resources.blobs.map(async (file) => {
      await getStrategyFunctions(file.source).deleteFile(req, {
        ...file,
        user: req.user.id,
        tenantId: req.user.tenantId,
      });
    }),
    ...[...resources.ids].map((id) => db.deleteSkill(id)),
  ]);
  if (results.some((result) => result.status === 'rejected'))
    throw failure(500, 'Storage cleanup failed');
  resources.blobs = [];
  resources.ids.clear();
}

function handleError(error, _req, res, _next) {
  const status = error.name === 'MulterError' ? 400 : error.status || 500;
  if (status >= 500) logger.error('[AgentArchive] Transfer failed', error);
  let code = 'invalid_request';
  if (status >= 500) code = 'internal_error';
  else if (status === 403) code = 'permission_denied';
  else if (status === 404) code = 'not_found';
  else if (status === 409) code = 'conflict';
  return res.status(status).json({
    error: {
      code,
      message: status >= 500 ? 'Agent transfer failed' : error.message,
    },
  });
}

const handlers = {
  export: async (req, res, next) => {
    try {
      const bundle = await exportBundle(req);
      const buffer = await encodeAgentArchive(bundle);
      res.setHeader('Content-Type', 'application/zip');
      const filename = bundle.agent.name.replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 100) || 'agent';
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.zip"`);
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      return res.send(buffer);
    } catch (error) {
      return next(error);
    }
  },
  preview: async (req, res, next) => {
    try {
      const { bundle, reused } = await prepare(req);
      const resolved = await resolveTools(req, bundle.tools);
      resolved.warnings.push(
        ...[...reused.keys()].map((name) => `Reuse unchanged skill in destination: ${name}`),
      );
      return res.json(previewAgentArchive(bundle, resolved));
    } catch (error) {
      return next(error);
    }
  },
  import: async (req, res, next) => {
    let state;
    try {
      state = await prepare(req);
      const agent = await importAgentArchive(req.file.buffer, {
        resolveTools: (tools) => resolveTools(req, tools),
        createSkill: async (skill) => {
          if (state.reused.has(skill.name)) return state.reused.get(skill.name);
          const imported = await invoke(
            createImportHandler(state.deps),
            await skillRequest(req, skill),
          );
          if (imported._importSummary?.filesFailed > 0)
            throw failure(400, 'Skill import incomplete');
          return String(imported._id);
        },
        deleteSkill: async () => {}, // Outer compensation tracks partial creates and blobs too.
        createAgent: (data) => invoke(v1.createAgent, requestWith(req, { body: data })),
      });
      return res
        .status(201)
        .json(req.archiveManagement ? projectAgentManagementResponse(agent) : agent);
    } catch (error) {
      if (state) {
        try {
          await cleanup(req, state.resources);
        } catch (rollbackError) {
          logger.error('[AgentArchive] Rollback failed', rollbackError);
          return next(failure(500, 'Import rollback failed'));
        }
      }
      return next(error);
    }
  },
};

handlers.importManagement = (req, res, next) =>
  handlers.import(requestWith(req, { archiveManagement: true }), res, next);

module.exports = { handlers, upload, handleError };
