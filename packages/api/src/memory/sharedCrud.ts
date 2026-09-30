import mongoose from 'mongoose';
import type { Response } from 'express';
import type { IProject } from '@librechat/data-schemas';

import { isScalarString, isSharedMemoryKey } from './shared';
import type { AuthenticatedRequest } from './sharedRouteHandlers';

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
    if (
      !isScalarString(req.params.projectId) ||
      !Array.isArray(idsInput) ||
      idsInput.some((id) => !validObjectId(id))
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
    const localKeys = new Set((project.memories || []).map((memory) => memory.key));
    const conflicts = memories
      .filter((memory) => localKeys.has(memory.key))
      .map((memory) => ({ memoryId: String(memory._id), key: memory.key }));
    if (conflicts.length) {
      res.status(409).json({ error: 'Local memory key conflict.', conflicts });
      return;
    }
    const updated = await mongoose.models.Project.findOneAndUpdate(
      { _id: project._id, tenantId: req.user.tenantId },
      { $addToSet: { sharedMemoryIds: { $each: ids } } },
      { new: true },
    ).lean<ProjectRecord>();
    res.json({ memoryIds: updated?.sharedMemoryIds || [] });
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
    const updated = await mongoose.models.Project.findOneAndUpdate(
      { _id: project._id, tenantId: req.user.tenantId, 'memories.key': { $ne: key } },
      { $push: { memories: { key, value: memory.value } } },
      { new: true },
    ).lean<ProjectRecord>();
    if (updated) res.status(201).json({ key, value: memory.value });
    else res.status(409).json({ error: 'Project memory key already exists.' });
  };

  return { link, unlink, copy };
}
