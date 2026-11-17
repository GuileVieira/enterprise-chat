import { assertKeyResource, keyResourceIds } from './resources';
import mongoose, { Types } from 'mongoose';
import { ResourceCapabilityMap } from '@librechat/data-schemas';
import {
  PermissionBits,
  Permissions,
  PermissionTypes,
  ResourceType,
  hasPermissions,
} from 'librechat-data-provider';
import type { RequestHandler } from 'express';
import type { TFile } from 'librechat-data-provider';
import type { IAgent, IProject } from '@librechat/data-schemas';
import type { AgentManagementReadDeps } from '../agents/reads';
import type { GetRemoteAgentPermissionsDeps } from '../apiKeys/service';
import type { IntegrationRequest } from './contracts';
import { getAgentMemoryPartitionAccess } from '../memory/authorization';
import { checkAccessWithRequestCache } from '../middleware/access';
import { getRemoteAgentPermissions } from '../apiKeys/service';
import { inspectContentWithTraversal } from '../protection/runtime';
import { extractAgentContent, extractFileContent } from '../protection/adapters/submissions';
import {
  IntegrationError,
  assertQuery,
  forbidden,
  integrationHandler,
  notFound,
  paginate,
} from './contracts';

export type IntegrationProject = IProject & { _id: Types.ObjectId };
export interface IntegrationFile {
  _id: Types.ObjectId;
  tenantId?: string;
  file_id: string;
  filename: string;
  type?: string;
  bytes?: number;
  embedded?: boolean;
  metadata?: TFile['metadata'];
  user?: string;
  projectId?: string;
}
export interface IntegrationReadDeps
  extends Pick<
      AgentManagementReadDeps,
      'getRoleByName' | 'checkPermission' | 'hasCapability' | 'findAccessibleResources'
    >,
    GetRemoteAgentPermissionsDeps {
  fileAccess: (
    req: IntegrationRequest,
    files: IntegrationFile[],
    agent?: IAgent,
    execution?: boolean,
  ) => Promise<Set<string>>;
}
export interface IntegrationAgentView {
  id: string;
  name?: string;
  description?: string;
  instructions: string;
  provider: string;
  model: string;
  memoryScope: string;
  skillsEnabled: boolean;
  skillsScope?: IAgent['skills_scope'];
  version: number;
}
export interface IntegrationProjectView {
  id: string;
  name?: string;
  description?: string;
  instructions: string;
  updatedAt?: Date;
  isArchived: boolean;
}
export interface IntegrationFileView {
  id: string;
  name: string;
  mimeType?: string;
  bytes?: number;
  embedded: boolean;
  indexStatus: string;
  contentFilterBlocked?: boolean;
}
export interface IntegrationReaders {
  canManage(req: IntegrationRequest, type: ResourceType): Promise<boolean>;
  feature(req: IntegrationRequest, type: PermissionTypes, permission?: Permissions): Promise<void>;
  allowed(
    req: IntegrationRequest,
    type: ResourceType,
    id: Types.ObjectId,
    bits: PermissionBits,
  ): Promise<boolean>;
  agent(req: IntegrationRequest, id: string, execution?: boolean): Promise<IAgent>;
  memoryAgent(req: IntegrationRequest, id: string): Promise<void>;
  scopedAgents(req: IntegrationRequest): Promise<IAgent[]>;
  project(req: IntegrationRequest, id: string, bits?: PermissionBits): Promise<IntegrationProject>;
  files(
    req: IntegrationRequest,
    source?: IAgent,
    projectId?: string,
    execution?: boolean,
  ): Promise<IntegrationFile[]>;
  fileView(req: IntegrationRequest, file: IntegrationFile): IntegrationFileView;
  agentView(req: IntegrationRequest, agent: IAgent): IntegrationAgentView;
  projectView(req: IntegrationRequest, project: IntegrationProject): IntegrationProjectView;
  handlers: {
    [name in
      | 'identity'
      | 'agents'
      | 'agent'
      | 'projects'
      | 'project'
      | 'projectFiles'
      | 'agentFiles']: RequestHandler;
  };
}
export function createIntegrationReaders(deps: IntegrationReadDeps): IntegrationReaders {
  async function canManage(req: IntegrationRequest, type: ResourceType): Promise<boolean> {
    const cap = ResourceCapabilityMap[type as keyof typeof ResourceCapabilityMap];
    return cap ? deps.hasCapability(req.user, cap).catch(() => false) : false;
  }
  async function feature(
    req: IntegrationRequest,
    permissionType: PermissionTypes,
    permission = Permissions.USE,
  ) {
    if (
      !(await checkAccessWithRequestCache({
        req,
        user: req.user,
        permissionType,
        permissions: [permission],
        getRoleByName: deps.getRoleByName,
      }))
    )
      throw forbidden();
  }
  async function allowed(
    req: IntegrationRequest,
    type: ResourceType,
    id: Types.ObjectId,
    bits: PermissionBits,
  ) {
    return deps.checkPermission({
      userId: req.user.id,
      role: req.user.role,
      resourceType: type,
      resourceId: id,
      requiredPermission: bits,
    });
  }
  async function agent(req: IntegrationRequest, id: string, execution = false): Promise<IAgent> {
    assertKeyResource(req, 'agentIds', id);
    await feature(req, execution ? PermissionTypes.REMOTE_AGENTS : PermissionTypes.AGENTS);
    const row = await mongoose.models.Agent.findOne({
      id,
      tenantId: req.user.tenantId,
    }).lean<IAgent>();
    if (!row) throw notFound();
    if (execution) {
      const bits = await getRemoteAgentPermissions(
        deps,
        req.user.id,
        req.user.role,
        row._id as Types.ObjectId,
      );
      if (!hasPermissions(bits, PermissionBits.VIEW)) throw notFound();
    } else {
      const cap = ResourceCapabilityMap[ResourceType.AGENT];
      const manages = cap && (await deps.hasCapability(req.user, cap).catch(() => false));
      if (
        !manages &&
        !(await allowed(req, ResourceType.AGENT, row._id as Types.ObjectId, PermissionBits.EDIT))
      )
        throw notFound();
    }
    return row;
  }
  async function memoryAgent(req: IntegrationRequest, id: string) {
    assertKeyResource(req, 'agentIds', id);
    const access = await getAgentMemoryPartitionAccess({
      req,
      user: req.user,
      agentId: id,
      getAgent: async (query) =>
        mongoose.models.Agent.findOne({ id: query.id, tenantId: req.user.tenantId })
          .select('_id')
          .lean<{ _id: Types.ObjectId }>(),
      getRoleByName: deps.getRoleByName,
      hasCapability: deps.hasCapability,
      checkPermission: deps.checkPermission,
    });
    if (access !== 'allowed') throw notFound();
  }
  async function project(
    req: IntegrationRequest,
    id: string,
    bits = PermissionBits.VIEW,
  ): Promise<IntegrationProject> {
    const row = await mongoose.models.Project.findOne({
      tenantId: req.user.tenantId,
      $or: [
        { projectId: id },
        ...(Types.ObjectId.isValid(id) ? [{ _id: new Types.ObjectId(id) }] : []),
      ],
    }).lean<IntegrationProject>();
    if (!row || !(await allowed(req, ResourceType.PROJECT, row._id, bits))) throw notFound();
    assertKeyResource(req, 'projectIds', row.projectId);
    return row;
  }
  function agentView(req: IntegrationRequest, row: IAgent) {
    const inspection = inspectContentWithTraversal(
      () =>
        extractAgentContent({
          name: row.name,
          description: row.description,
          instructions: row.instructions,
        }),
      { filters: req.config?.filters },
    );
    if (inspection.finding || inspection.traversalError) throw forbidden();
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      instructions: row.instructions ?? '',
      provider: row.provider,
      model: row.model,
      memoryScope: row.memory_scope ?? 'user',
      skillsEnabled: row.skills_enabled === true,
      skillsScope: row.skills_scope,
      version: row.versions?.length ?? 0,
    };
  }
  function projectView(req: IntegrationRequest, row: IntegrationProject) {
    const inspection = inspectContentWithTraversal(
      () => extractAgentContent({ instructions: row.instructions }),
      { filters: req.config?.filters },
    );
    if (inspection.finding || inspection.traversalError) throw forbidden();
    return {
      id: row.projectId,
      name: row.name,
      description: row.description,
      instructions: row.instructions ?? '',
      updatedAt: row.updatedAt,
      isArchived: row.isArchived === true,
    };
  }
  async function files(
    req: IntegrationRequest,
    source?: IAgent,
    projectId?: string,
    execution = false,
  ): Promise<IntegrationFile[]> {
    const currentProject = projectId ? await project(req, projectId) : undefined;
    const ids = source
      ? [
          ...new Set(
            Object.values(source.tool_resources ?? {}).flatMap(
              (resource) => resource.file_ids ?? [],
            ),
          ),
        ]
      : [];
    const alternatives = [
      ...(ids.length ? [{ file_id: { $in: ids } }] : []),
      ...(currentProject
        ? [
            { projectId: currentProject.projectId },
            { file_id: { $in: currentProject.fileIds ?? [] } },
          ]
        : []),
    ];
    if (!alternatives.length) return [];
    const rows = await mongoose.models.File.find({ tenantId: req.user.tenantId, $or: alternatives })
      .select('_id tenantId file_id filename type bytes embedded user projectId metadata.imageRag')
      .lean<IntegrationFile[]>();
    const projectFiles = new Set(
      currentProject
        ? rows
            .filter(
              (file) =>
                file.projectId === currentProject.projectId ||
                currentProject.fileIds?.includes(file.file_id),
            )
            .map((file) => file.file_id)
        : [],
    );
    const access = await deps.fileAccess(
      req,
      rows.filter((file) => !projectFiles.has(file.file_id)),
      source,
      execution,
    );
    const authorized = rows.filter(
      (file) =>
        (projectFiles.has(file.file_id) || access.has(file.file_id)) &&
        (!file.projectId ||
          !keyResourceIds(req, 'projectIds') ||
          keyResourceIds(req, 'projectIds')!.includes(file.projectId) ||
          projectFiles.has(file.file_id)),
    );
    const authorizedIds = new Set(authorized.map((file) => file.file_id));
    return authorized.map((file) => {
      const image = file.metadata?.imageRag;
      return {
        ...file,
        ...(currentProject && projectFiles.has(file.file_id)
          ? { projectId: currentProject.projectId }
          : {}),
        metadata: image
          ? {
              imageRag: {
                kind: image.kind,
                status: image.status,
                ...(image.sourceImageFileId && authorizedIds.has(image.sourceImageFileId)
                  ? { sourceImageFileName: image.sourceImageFileName }
                  : {}),
              },
            }
          : undefined,
      };
    });
  }
  const fileView = (req: IntegrationRequest, file: IntegrationFile) => {
    const inspection = inspectContentWithTraversal(
      () => extractFileContent({ name: file.filename }),
      { filters: req.config?.filters },
    );
    return {
      id: file.file_id,
      name: inspection.finding || inspection.traversalError ? '' : file.filename,
      ...(inspection.finding || inspection.traversalError ? { contentFilterBlocked: true } : {}),
      mimeType: file.type,
      bytes: file.bytes,
      embedded: file.embedded === true,
      indexStatus: 'unknown',
    };
  };
  const agentCache = new WeakMap<IntegrationRequest, Promise<IAgent[]>>();
  function scopedAgents(req: IntegrationRequest): Promise<IAgent[]> {
    const cached = agentCache.get(req);
    if (cached) return cached;
    const pending = (async () => {
      await feature(req, PermissionTypes.AGENTS);
      const cap = ResourceCapabilityMap[ResourceType.AGENT];
      const manages = cap && (await deps.hasCapability(req.user, cap).catch(() => false));
      const ids = manages
        ? null
        : await deps.findAccessibleResources({
            userId: req.user.id,
            role: req.user.role,
            resourceType: ResourceType.AGENT,
            requiredPermissions: PermissionBits.EDIT,
          });
      const accessible = await mongoose.models.Agent.find({
        tenantId: req.user.tenantId,
        ...(keyResourceIds(req, 'agentIds')
          ? { id: { $in: keyResourceIds(req, 'agentIds') } }
          : {}),
        ...(ids ? { _id: { $in: ids } } : {}),
      })
        .limit(2001)
        .lean<IAgent[]>();
      if (accessible.length > 2000)
        throw new IntegrationError(
          413,
          'scope_too_large',
          'Accessible resource scope exceeds 2000 records',
        );
      return accessible;
    })();
    agentCache.set(req, pending);
    return pending;
  }
  const handlers = {
    identity: integrationHandler(async (req) => ({ ...req.integrationAuth })),
    agents: integrationHandler(async (req) => {
      assertQuery(req);
      return paginate(
        req,
        (await scopedAgents(req)).map((row) => agentView(req, row)),
        (row) => row.id,
      );
    }),
    agent: integrationHandler(async (req) => agentView(req, await agent(req, req.params.id))),
    projects: integrationHandler(async (req) => {
      assertQuery(req);
      const ids = await deps.findAccessibleResources({
        userId: req.user.id,
        role: req.user.role,
        resourceType: ResourceType.PROJECT,
        requiredPermissions: PermissionBits.VIEW,
      });
      const accessible = await mongoose.models.Project.find({
        tenantId: req.user.tenantId,
        ...(keyResourceIds(req, 'projectIds')
          ? { projectId: { $in: keyResourceIds(req, 'projectIds') } }
          : {}),
        _id: { $in: ids },
      })
        .limit(2001)
        .lean<IntegrationProject[]>();
      if (accessible.length > 2000)
        throw new IntegrationError(
          413,
          'scope_too_large',
          'Accessible resource scope exceeds 2000 records',
        );
      return paginate(
        req,
        accessible.map((row) => projectView(req, row)),
        (row) => row.id,
      );
    }),
    project: integrationHandler(async (req) =>
      projectView(req, await project(req, req.params.projectId)),
    ),
    projectFiles: integrationHandler(async (req) => {
      assertQuery(req);
      return paginate(
        req,
        (await files(req, undefined, req.params.projectId)).map((file) => fileView(req, file)),
        (row) => row.id,
      );
    }),
    agentFiles: integrationHandler(async (req) => {
      assertQuery(req);
      return paginate(
        req,
        (await files(req, await agent(req, req.params.id))).map((file) => fileView(req, file)),
        (row) => row.id,
      );
    }),
  };
  return {
    canManage,
    feature,
    allowed,
    agent,
    memoryAgent,
    scopedAgents,
    project,
    files,
    fileView,
    agentView,
    projectView,
    handlers,
  };
}
