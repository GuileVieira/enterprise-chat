import mongoose from 'mongoose';
import type { Request, Response } from 'express';
import type { IProject } from '@librechat/data-schemas';

import { buildLegacyCandidateItems, calculateSharedContextStatus } from './sharedHandlers';

export interface AuthenticatedRequest extends Request {
  user: { id: string; tenantId: string; role: string };
  config?: { memory?: { maxInputTokens?: number; tokenLimit?: number }; filters?: unknown };
}

interface ProjectRecord extends IProject {
  _id: mongoose.Types.ObjectId;
}
interface MemoryRecord {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  key: string;
}
interface SharedRecord {
  _id: mongoose.Types.ObjectId;
  key: string;
  tokenCount?: number;
  status: 'active' | 'archived';
}

export interface LegacyHandlerDependencies {
  projectFor(req: AuthenticatedRequest, permission: number): Promise<ProjectRecord | null>;
  projectEditPermission: number;
  projectViewPermission: number;
  projectStoredMemories(
    items: SharedRecord[],
    filters?: unknown,
  ): Array<SharedRecord & { contentFilterBlocked?: true }>;
}

export interface SharedMemoryReadHandlers {
  legacyCandidates(req: AuthenticatedRequest, res: Response): Promise<void>;
  contextStatus(req: AuthenticatedRequest, res: Response): Promise<void>;
}

export function createSharedMemoryReadHandlers(
  deps: LegacyHandlerDependencies,
): SharedMemoryReadHandlers {
  const legacyCandidates = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const project = await deps.projectFor(req, deps.projectEditPermission);
    if (!project) {
      res.status(403).json({ error: 'Project edit permission required.' });
      return;
    }
    const keys = [...new Set(project.memoryKeys || [])];
    const MemoryEntry = mongoose.models.MemoryEntry;
    const [memories, tenantCounts] = await Promise.all([
      MemoryEntry.find({ tenantId: req.user.tenantId, userId: req.user.id, key: { $in: keys } })
        .select('_id userId key')
        .lean<MemoryRecord[]>(),
      MemoryEntry.aggregate<{ _id: string; count: number }>([
        { $match: { tenantId: req.user.tenantId, key: { $in: keys } } },
        { $group: { _id: '$key', count: { $sum: 1 } } },
      ]),
    ]);
    res.json({
      items: buildLegacyCandidateItems(
        keys,
        memories.map((memory) => ({
          id: String(memory._id),
          userId: String(memory.userId),
          key: memory.key,
        })),
        tenantCounts.map((entry) => ({ key: entry._id, count: entry.count })),
      ),
    });
  };

  const contextStatus = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const project = await deps.projectFor(req, deps.projectViewPermission);
    if (!project) {
      res.status(403).json({ error: 'Project view permission required.' });
      return;
    }
    const ids = [...new Set(project.sharedMemoryIds || [])];
    const memories = ids.length
      ? await mongoose.models.SharedMemory.find({
          _id: { $in: ids },
          tenantId: req.user.tenantId,
        }).lean<SharedRecord[]>()
      : [];
    const localKeys = new Set((project.memories || []).map((memory) => memory.key));
    const limit = req.config?.memory?.maxInputTokens ?? req.config?.memory?.tokenLimit;
    res.json(
      calculateSharedContextStatus(
        ids.map(String),
        memories.map((memory) => ({
          id: String(memory._id),
          key: memory.key,
          tokenCount: memory.tokenCount || 0,
          status: memory.status,
          filtered: Boolean(
            deps.projectStoredMemories([memory], req.config?.filters)[0]?.contentFilterBlocked,
          ),
        })),
        localKeys,
        limit,
      ),
    );
  };

  return { legacyCandidates, contextStatus };
}
