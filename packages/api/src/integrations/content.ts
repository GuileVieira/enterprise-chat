import mongoose, { Types } from 'mongoose';
import { isMemoryEnabled } from '@librechat/data-schemas';
import {
  PermissionBits,
  PermissionTypes,
  Permissions,
  ResourceType,
} from 'librechat-data-provider';
import type { RequestHandler } from 'express';
import type { IntegrationReaders, IntegrationProject } from './reads';
import type { IntegrationRequest } from './contracts';
import { projectStoredPrompt } from '../prompts/protection';
import { projectStoredMemories } from '../memory/protection';
import {
  assertQuery,
  integrationHandler,
  invalid,
  notFound,
  paginate,
  paginationCursor,
  IntegrationError,
  scalar,
} from './contracts';

interface PromptGroup {
  _id: Types.ObjectId;
  tenantId: string;
  name: string;
  oneliner?: string;
  productionId: Types.ObjectId;
  updatedAt?: Date;
}
interface Prompt {
  _id: Types.ObjectId;
  tenantId: string;
  groupId: Types.ObjectId;
  prompt: string;
  type: string;
  createdAt?: Date;
  updatedAt?: Date;
}
interface Memory {
  _id: Types.ObjectId;
  key: string;
  value: string;
  agentId?: string;
  updated_at?: Date;
  updatedAt?: Date;
  version?: number;
}
export interface IntegrationPrompt {
  id: string;
  groupId?: string;
  name?: string;
  prompt: string;
  type?: string;
  production?: boolean;
  updatedAt?: Date;
  source: string;
  projectId?: string;
  contentFilterBlocked?: true;
}
export interface IntegrationMemory {
  id: string;
  key?: string;
  value?: string;
  agentId?: string;
  updatedAt?: Date;
  version?: number;
  source: string;
  contentFilterBlocked?: true;
}
export interface IntegrationContent {
  prompt(
    req: IntegrationRequest,
    id: string,
    inheritedProject?: IntegrationProject,
  ): Promise<IntegrationPrompt>;
  projectPrompts(
    req: IntegrationRequest,
    projectId: string,
  ): Promise<{ items: IntegrationPrompt[]; warnings: string[] }>;
  personalMemories(
    req: IntegrationRequest,
    agentId?: string,
    paged?: boolean,
  ): Promise<IntegrationMemory[]>;
  projectMemories(
    req: IntegrationRequest,
    projectId: string,
    agentId?: string,
  ): Promise<IntegrationMemory[]>;
  handlers: {
    [name in 'prompt' | 'projectPrompts' | 'memories' | 'projectMemories']: RequestHandler;
  };
}
export function createIntegrationContent(readers: IntegrationReaders): IntegrationContent {
  async function prompt(
    req: IntegrationRequest,
    id: string,
    inheritedProject?: IntegrationProject,
  ) {
    if (!Types.ObjectId.isValid(id)) throw notFound();
    const version = await mongoose.models.Prompt.findOne({
      _id: id,
      tenantId: req.user.tenantId,
    }).lean<Prompt>();
    const group = await mongoose.models.PromptGroup.findOne({
      _id: version?.groupId ?? new Types.ObjectId(id),
      tenantId: req.user.tenantId,
    }).lean<PromptGroup>();
    if (!group) throw notFound();
    let inherited = inheritedProject?.promptGroupIds?.includes(String(group._id)) === true;
    if (!inherited) {
      const projects = await mongoose.models.Project.find({
        tenantId: req.user.tenantId,
        promptGroupIds: String(group._id),
      }).lean<IntegrationProject[]>();
      for (const project of projects) {
        if (await readers.allowed(req, ResourceType.PROJECT, project._id, PermissionBits.VIEW)) {
          inherited = true;
          break;
        }
      }
    }
    if (!inherited) {
      await readers.feature(req, PermissionTypes.PROMPTS);
      if (!(await readers.allowed(req, ResourceType.PROMPTGROUP, group._id, PermissionBits.VIEW)))
        throw notFound();
    }
    const resolved =
      version ??
      (await mongoose.models.Prompt.findOne({
        _id: group.productionId,
        groupId: group._id,
        tenantId: req.user.tenantId,
      }).lean<Prompt>());
    if (!resolved || String(resolved.groupId) !== String(group._id)) throw notFound();
    const projected = projectStoredPrompt(
      {
        id: String(resolved._id),
        groupId: String(group._id),
        name: group.name,
        prompt: resolved.prompt,
        type: resolved.type,
        production: String(group.productionId) === String(resolved._id),
        updatedAt: resolved.updatedAt,
        source: 'prompt_group',
      },
      req.config?.filters,
    );
    return projected;
  }
  async function projectPrompts(req: IntegrationRequest, projectId: string) {
    const project = await readers.project(req, projectId);
    const groups = [];
    let unavailable = false;
    for (const id of project.promptGroupIds ?? []) {
      try {
        groups.push(await prompt(req, id, project));
      } catch (error) {
        if (!(error instanceof Error && 'status' in error && error.status === 404)) throw error;
        unavailable = true;
      }
    }
    const snippets = (project.promptSnippets ?? []).map((snippet, index) =>
      projectStoredPrompt(
        {
          id: `snippet:${project.projectId}:${index}`,
          name: snippet.title,
          prompt: snippet.content,
          source: 'project_snippet',
          projectId: project.projectId,
        },
        req.config?.filters,
      ),
    );
    return {
      items: [...groups, ...snippets],
      warnings: unavailable ? ['Some optional references are unavailable'] : [],
    };
  }
  async function personalMemories(req: IntegrationRequest, agentId?: string, paged = false) {
    if (!isMemoryEnabled(req.config?.memory))
      throw new IntegrationError(403, 'memory_disabled', 'Memory disabled');
    await readers.feature(req, PermissionTypes.MEMORIES, Permissions.READ);
    if (agentId) await readers.memoryAgent(req, agentId);
    const page = paged ? paginationCursor(req, { agentId }) : undefined;
    if (page?.after && !/^[a-f0-9]{24}$/.test(page.after)) throw invalid();
    const rows = await mongoose.models.MemoryEntry.find({
      userId: req.user.id,
      tenantId: req.user.tenantId,
      ...(agentId ? { agentId } : { agentId: { $in: [null, ''] } }),
      ...(page?.after ? { _id: { $gt: new Types.ObjectId(page.after) } } : {}),
    })
      .sort({ _id: 1 })
      .limit(page ? page.limit + 1 : 1001)
      .select('_id key value agentId updated_at')
      .lean<Memory[]>();
    if (!paged && rows.length > 1000)
      throw new IntegrationError(413, 'scope_too_large', 'Memory context exceeds 1000 records');
    return projectStoredMemories(
      rows.map((row) => ({
        id: String(row._id),
        key: row.key,
        value: row.value,
        agentId: row.agentId,
        updatedAt: row.updated_at,
        source: 'personal',
      })),
      req.config?.filters,
    );
  }
  async function projectMemories(req: IntegrationRequest, projectId: string, agentId?: string) {
    const project = await readers.project(req, projectId);
    if (!isMemoryEnabled(req.config?.memory))
      throw new IntegrationError(403, 'memory_disabled', 'Memory disabled');
    await readers.feature(req, PermissionTypes.MEMORIES, Permissions.READ);
    const inline = projectStoredMemories(
      (project.memories ?? []).map((row, index) => ({
        id: `project:${project.projectId}:${index}`,
        key: row.key,
        value: row.value,
        version: row.version ?? 1,
        updatedAt: row.updatedAt,
        source: 'project',
      })),
      req.config?.filters,
    );
    const personal = project.memoryKeys?.length
      ? (await personalMemories(req, agentId)).filter((row) =>
          project.memoryKeys?.includes(row.key),
        )
      : [];
    let shared: ReturnType<
      typeof projectStoredMemories<{
        id: string;
        key: string;
        value: string;
        version: number;
        updatedAt?: Date;
        source: string;
      }>
    > = [];
    if (project.sharedMemoryIds?.length) {
      await readers.feature(req, PermissionTypes.SHARED_MEMORIES, Permissions.READ);
      const ids = project.sharedMemoryIds.filter((id) => Types.ObjectId.isValid(id));
      const rows = await mongoose.models.SharedMemory.find({
        tenantId: req.user.tenantId,
        _id: { $in: ids },
        status: 'active',
      }).lean<Memory[]>();
      shared = projectStoredMemories(
        rows.map((row) => ({
          id: String(row._id),
          key: row.key,
          value: row.value,
          version: row.version ?? 1,
          updatedAt: row.updatedAt,
          source: 'shared',
        })),
        req.config?.filters,
      );
    }
    return [...inline, ...personal, ...shared];
  }
  return {
    prompt,
    projectPrompts,
    personalMemories,
    projectMemories,
    handlers: {
      prompt: integrationHandler((req) => prompt(req, req.params.id)),
      projectPrompts: integrationHandler(async (req) => {
        assertQuery(req);
        const result = await projectPrompts(req, req.params.projectId);
        return { ...paginate(req, result.items, (row) => row.id), warnings: result.warnings };
      }),
      memories: integrationHandler(async (req) => {
        assertQuery(req, ['agentId']);
        const agentId = scalar(req.query.agentId);
        return paginate(req, await personalMemories(req, agentId, true), (row) => row.id, {
          agentId,
        });
      }),
      projectMemories: integrationHandler(async (req) => {
        assertQuery(req, ['agentId']);
        const agentId = scalar(req.query.agentId);
        return paginate(
          req,
          await projectMemories(req, req.params.projectId, agentId),
          (row) => row.id,
          { agentId },
        );
      }),
    },
  };
}
