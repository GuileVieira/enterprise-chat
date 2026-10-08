import mongoose from 'mongoose';
import type { IProject } from '@librechat/data-schemas';
import type { Response } from 'express';
import type { AuthenticatedRequest } from './sharedRouteHandlers';
import { SharedMemoryBusyError, SharedMemoryQuotaError } from './sharedService';
import { isScalarString, isSharedMemoryKey } from './shared';

interface ProjectRecord extends IProject {
  _id: mongoose.Types.ObjectId;
}
interface MemoryRecord {
  _id: mongoose.Types.ObjectId;
  key: string;
  value: string;
}

export interface SharedMemoryCrudDependencies {
  projectFor(req: AuthenticatedRequest, permission: number): Promise<ProjectRecord | null>;
  projectEditPermission: number;
  blockFilteredMemoryContent(
    req: AuthenticatedRequest,
    res: Response,
    memory: { key: string; value: string },
  ): boolean;
  withLibraryWrite<T>(req: AuthenticatedRequest, write: () => Promise<T>): Promise<T>;
  assertProjectQuota(
    req: AuthenticatedRequest,
    projectId: mongoose.Types.ObjectId,
    delta: number,
  ): Promise<unknown>;
  countTokens(value: string): number;
}
export interface SharedMemoryCrudHandlers {
  link(req: AuthenticatedRequest, res: Response): Promise<void>;
  unlink(req: AuthenticatedRequest, res: Response): Promise<void>;
  copy(req: AuthenticatedRequest, res: Response): Promise<void>;
}

const validObjectId = (value: unknown): value is string =>
  isScalarString(value, 24) && mongoose.isObjectIdOrHexString(value);

export function createSharedMemoryCrudHandlers(
  deps: SharedMemoryCrudDependencies,
): SharedMemoryCrudHandlers {
  const link = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const idsInput: unknown = req.body?.memoryIds;
    const resolution: unknown = req.body?.conflictResolution;
    const expected: unknown = req.body?.expectedUpdatedAt;
    if (
      !isScalarString(req.params.projectId) ||
      !Array.isArray(idsInput) ||
      idsInput.some((id) => !validObjectId(id)) ||
      (resolution != null && resolution !== 'keep-local' && resolution !== 'use-shared') ||
      (resolution != null && (typeof expected !== 'string' || Number.isNaN(Date.parse(expected))))
    ) {
      res.status(400).json({ error: 'Invalid project or memory IDs.' });
      return;
    }
    const project = await deps.projectFor(req, deps.projectEditPermission);
    if (!project) {
      res.status(403).json({ error: 'Project edit permission required.' });
      return;
    }
    const ids = [...new Set(idsInput as string[])];
    const memories = await mongoose.models.SharedMemory.find({
      _id: { $in: ids },
      tenantId: req.user.tenantId,
      status: 'active',
    })
      .select('_id key')
      .lean<MemoryRecord[]>();
    if (memories.length !== ids.length) {
      res.status(403).json({ error: 'One or more memories are unavailable.' });
      return;
    }
    const localKeys = new Set([
      ...(project.memories || []).map((memory) => memory.key),
      ...(project.memoryKeys || []),
    ]);
    const conflicts = memories
      .filter((memory) => localKeys.has(memory.key))
      .map((memory) => ({ memoryId: String(memory._id), key: memory.key }));
    if (conflicts.length && resolution == null) {
      res.status(409).json({
        error: 'Local memory key conflict.',
        conflicts,
        expectedUpdatedAt: project.updatedAt,
      });
      return;
    }
    const conflictIds = new Set(conflicts.map((conflict) => conflict.memoryId));
    const conflictKeys = conflicts.map((conflict) => conflict.key);
    const selectedIds =
      resolution === 'keep-local' ? ids.filter((id) => !conflictIds.has(id)) : ids;
    const selectedKeys = memories
      .filter((memory) => selectedIds.includes(String(memory._id)))
      .map((memory) => memory.key);
    const update = {
      $addToSet: { sharedMemoryIds: { $each: selectedIds } },
      ...(resolution === 'use-shared'
        ? { $pull: { memories: { key: { $in: conflictKeys } }, memoryKeys: { $in: conflictKeys } } }
        : {}),
    };
    const updated = await mongoose.models.Project.findOneAndUpdate(
      {
        _id: project._id,
        tenantId: req.user.tenantId,
        ...(project.updatedAt
          ? { updatedAt: resolution != null ? new Date(expected as string) : project.updatedAt }
          : {}),
        ...(resolution !== 'use-shared'
          ? {
              'memories.key': {
                $nin: selectedKeys,
              },
              memoryKeys: { $nin: selectedKeys },
            }
          : {}),
      },
      update,
      { new: true },
    ).lean<ProjectRecord>();
    if (!updated) {
      res.status(409).json({ error: 'Project changed since preview. Reload and retry.' });
      return;
    }
    res.json({ memoryIds: updated.sharedMemoryIds || [] });
  };

  const unlink = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    if (!isScalarString(req.params.projectId) || !validObjectId(req.params.memoryId)) {
      res.status(400).json({ error: 'Invalid project or memory ID.' });
      return;
    }
    const project = await deps.projectFor(req, deps.projectEditPermission);
    if (!project) {
      res.status(403).json({ error: 'Project edit permission required.' });
      return;
    }
    await mongoose.models.Project.updateOne(
      { _id: project._id, tenantId: req.user.tenantId },
      { $pull: { sharedMemoryIds: req.params.memoryId } },
    );
    res.status(204).end();
  };

  const copy = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    if (
      !validObjectId(req.params.id) ||
      !isScalarString(req.body?.projectId) ||
      (req.body.key != null && !isSharedMemoryKey(req.body.key))
    ) {
      res.status(400).json({ error: 'Invalid memory, project, or key.' });
      return;
    }
    req.params.projectId = req.body.projectId;
    const project = await deps.projectFor(req, deps.projectEditPermission);
    if (!project) {
      res.status(403).json({ error: 'Project edit permission required.' });
      return;
    }
    const memory = await mongoose.models.SharedMemory.findOne({
      _id: req.params.id,
      tenantId: req.user.tenantId,
      status: 'active',
    }).lean<MemoryRecord>();
    if (!memory) {
      res.status(404).json({ error: 'Memory not found.' });
      return;
    }
    const key = req.body.key || memory.key;
    if (deps.blockFilteredMemoryContent(req, res, { key, value: memory.value })) return;
    try {
      const updated = await deps.withLibraryWrite(req, async () => {
        await deps.assertProjectQuota(req, project._id, deps.countTokens(memory.value));
        return mongoose.models.Project.findOneAndUpdate(
          { _id: project._id, tenantId: req.user.tenantId, 'memories.key': { $ne: key } },
          { $push: { memories: { key, value: memory.value } } },
          { new: true },
        ).lean<ProjectRecord>();
      });
      if (updated) res.status(201).json({ key, value: memory.value });
      else res.status(409).json({ error: 'Project memory key already exists.' });
    } catch (error) {
      let status = 500;
      if (error instanceof SharedMemoryBusyError) status = 409;
      if (error instanceof SharedMemoryQuotaError) status = 400;
      res.status(status).json({ error: error instanceof Error ? error.message : 'Copy failed.' });
    }
  };

  return { link, unlink, copy };
}
