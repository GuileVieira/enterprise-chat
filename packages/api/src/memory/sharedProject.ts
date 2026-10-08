import mongoose from 'mongoose';
import type { IProject, IProjectMemory } from '@librechat/data-schemas';
import type { Response } from 'express';
import type { AuthenticatedRequest } from './sharedRouteHandlers';
import { isScalarString, isSharedMemoryKey, SHARED_MEMORY_MAX_VALUE_LENGTH } from './shared';
import { SharedMemoryBusyError, SharedMemoryQuotaError } from './sharedService';

interface ProjectRecord extends IProject {
  _id: mongoose.Types.ObjectId;
}

interface MemoryRecord {
  _id: mongoose.Types.ObjectId;
  key: string;
  value: string;
  authorId?: mongoose.Types.ObjectId;
}

interface PublicationView {
  id: string;
  key: string;
  value: string;
  tokenCount?: number;
  status?: string;
  authorId?: string;
  version?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

interface PublicationSourcePersonal {
  type: 'personal';
  memoryId: string;
  agentId?: string;
}

interface PublicationSourceProject {
  type: 'project';
  projectId: string;
  key: string;
}

type PublicationSource = PublicationSourcePersonal | PublicationSourceProject;

interface LegacyResolution {
  key: string;
  memoryId: string;
}

type ProjectStoredMemories = <T extends Pick<IProjectMemory, 'key' | 'value'>>(
  memories: readonly T[],
  filters?: unknown,
) => Array<T & { contentFilterBlocked?: true }>;

export interface SharedMemoryProjectDependencies {
  projectFor(req: AuthenticatedRequest, permission: number): Promise<ProjectRecord | null>;
  hasRolePermissions(
    req: AuthenticatedRequest,
    type: string,
    required: readonly string[],
  ): Promise<boolean>;
  withLibraryWrite<T>(req: AuthenticatedRequest, write: () => Promise<T>): Promise<T>;
  assertLibraryQuota(req: AuthenticatedRequest, tokenDelta: number): Promise<void>;
  countTokens(value: string): number;
  projectStoredMemories: ProjectStoredMemories;
  blockFilteredMemoryContent(
    req: AuthenticatedRequest,
    res: Response,
    memory: Pick<IProjectMemory, 'key' | 'value'>,
  ): boolean;
  audit(req: AuthenticatedRequest, action: string, details: Record<string, unknown>): void;
  view(memory: MemoryRecord): PublicationView;
  projectEditPermission: number;
  memoryPermissionType: string;
  memoryUsePermission: string;
  memoryReadPermission: string;
}

export interface SharedMemoryProjectHandlers {
  publish(req: AuthenticatedRequest, res: Response): Promise<void>;
  resolveLegacy(req: AuthenticatedRequest, res: Response): Promise<void>;
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  value != null && typeof value === 'object' && !Array.isArray(value);

const validObjectId = (value: unknown): value is string =>
  isScalarString(value, 24) && mongoose.isObjectIdOrHexString(value);

function isPublicationSource(value: unknown): value is PublicationSource {
  if (!isPlainObject(value) || (value.type !== 'personal' && value.type !== 'project')) {
    return false;
  }
  if (value.type === 'personal') {
    return (
      validObjectId(value.memoryId) && (value.agentId == null || isScalarString(value.agentId))
    );
  }
  return isScalarString(value.projectId, 256) && isSharedMemoryKey(value.key);
}

function isLegacyResolution(value: unknown): value is LegacyResolution {
  return isPlainObject(value) && isSharedMemoryKey(value.key) && validObjectId(value.memoryId);
}

function errorCode(error: unknown): number | undefined {
  return isPlainObject(error) && typeof error.code === 'number' ? error.code : undefined;
}

function errorMessage(error: unknown): string | undefined {
  return error instanceof Error ? error.message : undefined;
}

function libraryErrorStatus(error: unknown): number {
  if (errorCode(error) === 11000 || error instanceof SharedMemoryBusyError) {
    return 409;
  }
  return error instanceof SharedMemoryQuotaError ? 400 : 500;
}

export function createSharedMemoryProjectHandlers(
  deps: SharedMemoryProjectDependencies,
): SharedMemoryProjectHandlers {
  const publish = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const source: unknown = req.body?.source;
    if (!isPublicationSource(source)) {
      res.status(400).json({ error: 'Invalid publication source.' });
      return;
    }

    let sourceMemory: Pick<IProjectMemory, 'key' | 'value'> | undefined;
    let project: ProjectRecord | null = null;
    if (source.type === 'personal') {
      const allowed = await deps.hasRolePermissions(req, deps.memoryPermissionType, [
        deps.memoryUsePermission,
        deps.memoryReadPermission,
      ]);
      if (!allowed) {
        res.status(403).json({ error: 'Memory read permission required.' });
        return;
      }
      const personalMemory = await mongoose.models.MemoryEntry.findOne({
        _id: source.memoryId,
        tenantId: req.user.tenantId,
        userId: req.user.id,
        agentId: source.agentId || null,
      }).lean<MemoryRecord>();
      sourceMemory = personalMemory ?? undefined;
    } else {
      req.params.projectId = source.projectId;
      project = await deps.projectFor(req, deps.projectEditPermission);
      sourceMemory = project?.memories?.find((memory) => memory.key === source.key);
    }

    if (!sourceMemory) {
      res.status(404).json({ error: 'Source memory not found.' });
      return;
    }
    if (
      !isSharedMemoryKey(sourceMemory.key) ||
      !sourceMemory.value.trim() ||
      sourceMemory.value.length > SHARED_MEMORY_MAX_VALUE_LENGTH
    ) {
      res.status(400).json({ error: 'Source key or value is not valid for the library.' });
      return;
    }
    if (deps.blockFilteredMemoryContent(req, res, sourceMemory)) {
      return;
    }

    try {
      const memory = await deps.withLibraryWrite(req, async () => {
        const tokenCount = deps.countTokens(sourceMemory.value);
        await deps.assertLibraryQuota(req, tokenCount);
        return mongoose.models.SharedMemory.create({
          tenantId: req.user.tenantId,
          key: sourceMemory.key,
          value: sourceMemory.value,
          tokenCount,
          authorId: req.user.id,
        });
      });
      let sourceReplaced = false;
      if (source.type === 'project' && req.body.replaceWithLink) {
        const updated = await mongoose.models.Project.findOneAndUpdate(
          {
            _id: project?._id,
            tenantId: req.user.tenantId,
            memories: { $elemMatch: { key: source.key, value: sourceMemory.value } },
          },
          {
            $pull: { memories: { key: source.key } },
            $addToSet: { sharedMemoryIds: String(memory._id) },
          },
          { new: true },
        );
        sourceReplaced = Boolean(updated);
      }
      deps.audit(req, 'publish', {
        memoryId: String(memory._id),
        sourceType: source.type,
        sourceReplaced,
      });
      res.status(201).json({ memory: deps.view(memory), sourceReplaced });
    } catch (error) {
      res.status(libraryErrorStatus(error)).json({ error: errorMessage(error) });
    }
  };

  const resolveLegacy = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const resolutions: unknown = req.body?.resolutions;
    const allowed = await deps.hasRolePermissions(req, deps.memoryPermissionType, [
      deps.memoryUsePermission,
      deps.memoryReadPermission,
    ]);
    if (!allowed) {
      res.status(403).json({ error: 'Memory read permission required.' });
      return;
    }
    if (
      !isScalarString(req.params.projectId, 256) ||
      !Array.isArray(resolutions) ||
      resolutions.length === 0 ||
      resolutions.length > 100 ||
      !resolutions.every(isLegacyResolution) ||
      new Set(resolutions.map((item) => item.key)).size !== resolutions.length
    ) {
      res.status(400).json({ error: 'Invalid legacy resolutions.' });
      return;
    }

    const project = await deps.projectFor(req, deps.projectEditPermission);
    if (!project) {
      res.status(403).json({ error: 'Project edit permission required.' });
      return;
    }
    const requestedKeys = new Set(resolutions.map((item) => item.key));
    const pendingKeys = new Set(project.memoryKeys || []);
    const alreadyLinked = await mongoose.models.SharedMemory.find({
      _id: { $in: project.sharedMemoryIds || [] },
      tenantId: req.user.tenantId,
      key: { $in: [...requestedKeys] },
      status: 'active',
    })
      .select('key')
      .lean<MemoryRecord[]>();
    const linkedKeys = new Set(alreadyLinked.map((item) => item.key));
    if (resolutions.some((item) => !pendingKeys.has(item.key) && !linkedKeys.has(item.key))) {
      res.status(409).json({ error: 'One or more legacy keys are no longer pending.' });
      return;
    }
    const sources = await mongoose.models.MemoryEntry.find({
      _id: { $in: resolutions.map((item) => item.memoryId) },
      tenantId: req.user.tenantId,
      userId: req.user.id,
    }).lean<MemoryRecord[]>();
    const byId = new Map(sources.map((item) => [String(item._id), item]));
    if (resolutions.some((item) => byId.get(item.memoryId)?.key !== item.key)) {
      res.status(403).json({ error: 'One or more source memories are unavailable.' });
      return;
    }

    try {
      const linkedIds = await deps.withLibraryWrite(req, async () => {
        const output: string[] = [];
        for (const resolution of resolutions) {
          const source = byId.get(resolution.memoryId);
          if (!source) {
            throw new Error('SOURCE_UNAVAILABLE');
          }
          if (deps.projectStoredMemories([source], req.config?.filters)[0]?.contentFilterBlocked) {
            throw new Error('CONTENT_BLOCKED');
          }
          let shared = await mongoose.models.SharedMemory.findOne({
            tenantId: req.user.tenantId,
            key: source.key,
            status: 'active',
          });
          if (
            shared &&
            (shared.value !== source.value || String(shared.authorId || '') !== String(req.user.id))
          ) {
            throw new Error('KEY_CONFLICT');
          }
          if (!shared) {
            await deps.assertLibraryQuota(req, deps.countTokens(source.value));
            shared = await mongoose.models.SharedMemory.create({
              tenantId: req.user.tenantId,
              key: source.key,
              value: source.value,
              tokenCount: deps.countTokens(source.value),
              authorId: req.user.id,
            });
          }
          output.push(String(shared._id));
        }
        return output;
      });
      await mongoose.models.Project.updateOne(
        { _id: project._id, tenantId: req.user.tenantId },
        {
          $addToSet: { sharedMemoryIds: { $each: linkedIds } },
          $pull: { memoryKeys: { $in: [...requestedKeys] } },
        },
      );
      deps.audit(req, 'resolve-legacy', {
        projectId: req.params.projectId,
        count: linkedIds.length,
      });
      res.json({ resolvedKeys: [...requestedKeys], memoryIds: linkedIds });
    } catch (error) {
      const message = errorMessage(error);
      let status = 500;
      let responseError = message;
      if (message === 'KEY_CONFLICT') {
        status = 409;
        responseError = 'An active library key conflicts with the selected memory.';
      } else if (message === 'CONTENT_BLOCKED') {
        status = 400;
        responseError = 'Content is blocked by memory policy.';
      } else if (error instanceof SharedMemoryQuotaError) {
        status = 400;
      }
      res.status(status).json({ error: responseError });
    }
  };

  return { publish, resolveLegacy };
}
