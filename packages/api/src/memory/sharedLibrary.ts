import mongoose from 'mongoose';
import type { Response } from 'express';
import type { ISharedMemory } from '@librechat/data-schemas';
import type { AuthenticatedRequest } from './sharedRouteHandlers';
import { SHARED_MEMORY_MAX_VALUE_LENGTH, isScalarString, isSharedMemoryKey } from './shared';
import { SharedMemoryBusyError, SharedMemoryQuotaError } from './sharedService';

interface ProjectRecord {
  sharedMemoryIds?: string[];
}
interface MemoryView {
  id: string;
  key: string;
  value: string;
  tokenCount: number;
  status: string;
  authorId?: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  contentFilterBlocked?: true;
}
interface SharedRecord extends ISharedMemory {
  _id: mongoose.Types.ObjectId;
}
export interface SharedLibraryDependencies {
  projectFor(req: AuthenticatedRequest, permission: number): Promise<ProjectRecord | null>;
  projectViewPermission: number;
  projectStoredMemories<T extends { key: string; value: string }>(
    items: T[],
    filters?: unknown,
  ): Array<T & { contentFilterBlocked?: true }>;
  blockFilteredMemoryContent(
    req: AuthenticatedRequest,
    res: Response,
    memory: { key: string; value: string },
  ): boolean;
  withLibraryWrite<T>(req: AuthenticatedRequest, write: () => Promise<T>): Promise<T>;
  assertLibraryQuota(req: AuthenticatedRequest, delta: number): Promise<unknown>;
  countTokens(value: string): number;
  audit(req: AuthenticatedRequest, action: string, details: Record<string, unknown>): void;
  view(doc: SharedRecord): MemoryView;
}
export interface SharedLibraryHandlers {
  list(req: AuthenticatedRequest, res: Response): Promise<void>;
  create(req: AuthenticatedRequest, res: Response): Promise<void>;
  update(req: AuthenticatedRequest, res: Response): Promise<void>;
  archive(req: AuthenticatedRequest, res: Response): Promise<void>;
  restore(req: AuthenticatedRequest, res: Response): Promise<void>;
}
const objectId = (value: unknown): value is string =>
  isScalarString(value, 24) && mongoose.isObjectIdOrHexString(value);
const errorCode = (error: unknown) =>
  typeof error === 'object' && error != null && 'code' in error
    ? (error as { code?: number }).code
    : undefined;
const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Shared memory operation failed.';
export function createSharedLibraryHandlers(
  deps: SharedLibraryDependencies,
): SharedLibraryHandlers {
  const list = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
    const filter: Record<string, unknown> = {
      tenantId: req.user.tenantId,
      status: req.query.status === 'archived' ? 'archived' : 'active',
    };
    if (typeof req.query.search === 'string') {
      const search = req.query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = ['key', 'value'].map((field) => ({
        [field]: { $regex: search, $options: 'i' },
      }));
    }
    const [items, total] = await Promise.all([
      mongoose.models.SharedMemory.find(filter)
        .sort({ updatedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean<SharedRecord[]>(),
      mongoose.models.SharedMemory.countDocuments(filter),
    ]);
    let linked = new Set<string>();
    if (typeof req.query.projectId === 'string') {
      req.params.projectId = req.query.projectId;
      const project = await deps.projectFor(req, deps.projectViewPermission);
      if (!project) {
        res.status(403).json({ error: 'Project view permission required.' });
        return;
      }
      linked = new Set(project.sharedMemoryIds || []);
    }
    const authorIds = [
      ...new Set(
        items
          .map((item) => item.authorId && String(item.authorId))
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const authors = await mongoose.models.User.find({
      _id: { $in: authorIds },
      tenantId: req.user.tenantId,
    })
      .select('_id name')
      .lean<Array<{ _id: mongoose.Types.ObjectId; name?: string }>>();
    const names = new Map(authors.map((author) => [String(author._id), author.name]));
    const projected = deps.projectStoredMemories(items.map(deps.view), req.config?.filters);
    res.json({
      items: projected.map((item) => ({
        ...item,
        authorName:
          names.get(String(item.authorId)) || (item.authorId ? 'Usuário removido' : undefined),
        linkedToProject: linked.has(item.id),
      })),
      total,
      page,
      limit,
    });
  };
  const create = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { key, value } = req.body;
    if (
      !isSharedMemoryKey(key) ||
      typeof value !== 'string' ||
      !value.trim() ||
      value.length > SHARED_MEMORY_MAX_VALUE_LENGTH
    ) {
      res.status(400).json({ error: 'Invalid key or value.' });
      return;
    }
    if (deps.blockFilteredMemoryContent(req, res, { key, value })) return;
    try {
      const doc = await deps.withLibraryWrite(req, async () => {
        const tokenCount = deps.countTokens(value);
        await deps.assertLibraryQuota(req, tokenCount);
        return mongoose.models.SharedMemory.create({
          tenantId: req.user.tenantId,
          key,
          value,
          tokenCount,
          authorId: req.user.id,
        }) as Promise<SharedRecord>;
      });
      deps.audit(req, 'create', { memoryId: String(doc._id) });
      res.status(201).json(deps.view(doc));
    } catch (error) {
      const code = errorCode(error);
      res
        .status(
          // eslint-disable-next-line no-nested-ternary
          code === 11000 || error instanceof SharedMemoryBusyError
            ? 409
            : error instanceof SharedMemoryQuotaError
              ? 400
              : 500,
        )
        .json({ error: code === 11000 ? 'Active key already exists.' : errorMessage(error) });
    }
  };
  const update = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { key, value, expectedUpdatedAt } = req.body;
    if (
      !objectId(req.params.id) ||
      !isSharedMemoryKey(key) ||
      typeof value !== 'string' ||
      !value.trim() ||
      typeof expectedUpdatedAt !== 'string' ||
      Number.isNaN(Date.parse(expectedUpdatedAt))
    ) {
      res.status(400).json({ error: 'Invalid update.' });
      return;
    }
    if (deps.blockFilteredMemoryContent(req, res, { key, value })) return;
    const doc = await deps.withLibraryWrite(req, async () => {
      const current = await mongoose.models.SharedMemory.findOne({
        _id: req.params.id,
        tenantId: req.user.tenantId,
      })
        .select('tokenCount')
        .lean<{ tokenCount: number }>();
      if (!current) return null;
      await deps.assertLibraryQuota(req, deps.countTokens(value) - current.tokenCount);
      return mongoose.models.SharedMemory.findOneAndUpdate(
        { _id: req.params.id, tenantId: req.user.tenantId, updatedAt: new Date(expectedUpdatedAt) },
        { $set: { key, value, tokenCount: deps.countTokens(value) }, $inc: { version: 1 } },
        { new: true, runValidators: true },
      ) as Promise<SharedRecord | null>;
    });
    if (doc) {
      deps.audit(req, 'update', { memoryId: String(doc._id) });
      res.json(deps.view(doc));
    } else res.status(409).json({ error: 'Memory changed or is unavailable.' });
  };
  const statusHandler =
    (status: 'active' | 'archived', action: 'restore' | 'archive') =>
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const expected = req.body?.expectedUpdatedAt;
      if (
        !objectId(req.params.id) ||
        typeof expected !== 'string' ||
        Number.isNaN(Date.parse(expected))
      ) {
        res.status(400).json({ error: 'Expected version is required.' });
        return;
      }
      try {
        const doc = await deps.withLibraryWrite(req, async () => {
          const current = await mongoose.models.SharedMemory.findOne({
            _id: req.params.id,
            tenantId: req.user.tenantId,
          })
            .select('tokenCount')
            .lean<{ tokenCount: number }>();
          if (status === 'active' && current)
            await deps.assertLibraryQuota(req, current.tokenCount);
          return mongoose.models.SharedMemory.findOneAndUpdate(
            { _id: req.params.id, tenantId: req.user.tenantId, updatedAt: new Date(expected) },
            { $set: { status }, $inc: { version: 1 } },
            { new: true },
          ) as Promise<SharedRecord | null>;
        });
        if (doc) {
          deps.audit(req, action, { memoryId: String(doc._id) });
          res.json(deps.view(doc));
        } else res.status(409).json({ error: 'Memory changed or is unavailable.' });
      } catch (error) {
        const code = errorCode(error);
        res
          .status(
            // eslint-disable-next-line no-nested-ternary
            code === 11000 || error instanceof SharedMemoryBusyError
              ? 409
              : error instanceof SharedMemoryQuotaError
                ? 400
                : 500,
          )
          .json({ error: code === 11000 ? 'Active key already exists.' : errorMessage(error) });
      }
    };
  return {
    list,
    create,
    update,
    archive: statusHandler('archived', 'archive'),
    restore: statusHandler('active', 'restore'),
  };
}
