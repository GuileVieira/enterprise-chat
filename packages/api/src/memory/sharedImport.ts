import mongoose from 'mongoose';
import { randomUUID } from 'node:crypto';
import type {
  SharedMemoryImportPreview,
  SharedMemoryImportResult,
  SharedMemoryImportResultItem,
} from 'librechat-data-provider';
import type { IProjectMemory } from '@librechat/data-schemas';
import type { Response } from 'express';
import type { SharedMemoryService, SharedMemoryServiceModels } from './sharedService';
import type { AuthenticatedRequest } from './sharedRouteHandlers';
import {
  createSharedMemoryService,
  SharedMemoryBusyError,
  SharedMemoryQuotaError,
} from './sharedService';
import { classifyMemoryImport, parseMemoryImport } from './shared';

interface ImportProject {
  _id: mongoose.Types.ObjectId;
  projectId: string;
  updatedAt?: Date;
  memories?: IProjectMemory[];
}
interface RoleRecord {
  permissions?: Record<string, Record<string, boolean>>;
}
export interface SharedImportSupportDependencies {
  projectFor(req: AuthenticatedRequest, permission: number): Promise<ImportProject | null>;
  projectEditPermission: number;
  getRoleByName(role: string): Promise<RoleRecord | null>;
  projectStoredMemories<T extends { key: string; value: string }>(
    items: T[],
    filters?: unknown,
  ): Array<T & { contentFilterBlocked?: true }>;
  countTokens(value: string): number;
}
export interface SharedImportSupport {
  preview(req: AuthenticatedRequest): Promise<SharedMemoryImportPreview>;
  service(): SharedMemoryService;
  canCreateLibrary(req: AuthenticatedRequest): Promise<boolean>;
  canUpdateLibrary(req: AuthenticatedRequest): Promise<boolean>;
  hasMemoryPermissions(req: AuthenticatedRequest, permissions: string[]): Promise<boolean>;
  acquireLibraryLock(req: AuthenticatedRequest): Promise<string>;
  releaseLibraryLock(req: AuthenticatedRequest, token: string): Promise<unknown>;
  acquirePersonalLock(req: AuthenticatedRequest): Promise<string>;
  releasePersonalLock(req: AuthenticatedRequest, token: string): Promise<unknown>;
  assertLibraryQuota(req: AuthenticatedRequest, delta: number): Promise<unknown>;
  assertPersonalQuota(
    req: AuthenticatedRequest,
    agentId: string | undefined,
    delta: number,
  ): Promise<unknown>;
  assertProjectQuota(
    req: AuthenticatedRequest,
    projectId: mongoose.Types.ObjectId,
    delta: number,
  ): Promise<unknown>;
}

export function createSharedImportSupport(
  deps: SharedImportSupportDependencies,
): SharedImportSupport {
  const service = () =>
    createSharedMemoryService(mongoose.models as unknown as SharedMemoryServiceModels);
  const permissions = async (req: AuthenticatedRequest, type: string, required: string[]) => {
    const role = await deps.getRoleByName(req.user.role);
    return required.every((permission) => role?.permissions?.[type]?.[permission] === true);
  };
  const preview = async (req: AuthenticatedRequest): Promise<SharedMemoryImportPreview> => {
    const items = parseMemoryImport(req.body);
    const keys = items.map((item) => item.key).filter((key) => /^[a-z_]+$/.test(key));
    const destination = req.body.destination || { type: 'library' };
    if (!['library', 'project', 'personal'].includes(destination.type))
      throw new Error('Invalid import destination.');
    if (destination.type === 'library' && !(await permissions(req, 'SHARED_MEMORIES', ['READ'])))
      throw new Error('Library read permission required.');
    if (destination.type === 'personal' && !(await permissions(req, 'MEMORIES', ['USE', 'READ'])))
      throw new Error('Memory read permission required.');
    let currentItems: Array<{
      id: string;
      key: string;
      value: string;
      tokenCount: number;
      version: number;
      updatedAt: Date;
    }>;
    if (destination.type === 'project') {
      req.params.projectId = destination.projectId;
      const project = await deps.projectFor(req, deps.projectEditPermission);
      if (!project) throw new Error('Project edit permission required.');
      currentItems = (project.memories || [])
        .filter((item) => keys.includes(item.key))
        .map((item, index) => ({
          id: `local_${index}`,
          key: item.key,
          value: item.value,
          tokenCount: deps.countTokens(item.value),
          version: item.version || 1,
          updatedAt: item.updatedAt || project.updatedAt || new Date(0),
        }));
    } else if (destination.type === 'personal') {
      const memories = await mongoose.models.MemoryEntry.find({
        tenantId: req.user.tenantId,
        userId: req.user.id,
        agentId: destination.agentId || null,
        key: { $in: keys },
      }).lean<
        Array<{
          _id: mongoose.Types.ObjectId;
          key: string;
          value: string;
          tokenCount?: number;
          __v?: number;
          updated_at?: Date;
        }>
      >();
      currentItems = memories.map((item) => ({
        id: String(item._id),
        key: item.key,
        value: item.value,
        tokenCount: item.tokenCount || 0,
        version: item.__v || 0,
        updatedAt: item.updated_at || new Date(0),
      }));
    } else {
      const memories = await mongoose.models.SharedMemory.find({
        tenantId: req.user.tenantId,
        key: { $in: keys },
        status: 'active',
      }).lean<
        Array<{
          _id: mongoose.Types.ObjectId;
          key: string;
          value: string;
          tokenCount: number;
          version: number;
          updatedAt: Date;
        }>
      >();
      currentItems = memories.map((item) => ({
        id: String(item._id),
        key: item.key,
        value: item.value,
        tokenCount: item.tokenCount,
        version: item.version,
        updatedAt: item.updatedAt,
      }));
    }
    const output = classifyMemoryImport(
      items,
      new Map(
        currentItems.map((item) => [
          item.key,
          { ...item, updatedAt: item.updatedAt.toISOString() },
        ]),
      ),
    );
    for (const item of output) {
      if (
        item.existing &&
        deps.projectStoredMemories([item.existing], req.config?.filters)[0]?.contentFilterBlocked
      ) {
        item.existing = undefined;
        item.status = 'invalid';
        item.error = 'Existing memory is blocked by memory policy.';
        continue;
      }
      if (
        item.status !== 'invalid' &&
        deps.projectStoredMemories([item], req.config?.filters)[0]?.contentFilterBlocked
      ) {
        item.status = 'invalid';
        item.error = 'Content is blocked by memory policy.';
      }
    }
    const totals = { new: 0, identical: 0, conflict: 0, invalid: 0 };
    output.forEach((item) => totals[item.status]++);
    return { items: output, totals };
  };
  const acquirePersonalLock = async (req: AuthenticatedRequest) => {
    const token = `${Date.now()}:${randomUUID()}`;
    const user = await mongoose.models.User.findOneAndUpdate(
      { _id: req.user.id, tenantId: req.user.tenantId, memoryWriteLock: null },
      { $set: { memoryWriteLock: token } },
    ).select('_id');
    if (!user) throw new SharedMemoryBusyError('Memory is being updated. Please retry.');
    return token;
  };
  const assertPersonalQuota = async (
    req: AuthenticatedRequest,
    agentId: string | undefined,
    delta: number,
  ) => {
    const limit = req.config?.memory?.tokenLimit;
    if (!limit || delta <= 0) return;
    const [{ total = 0 } = {}] = await mongoose.models.MemoryEntry.aggregate<{ total: number }>([
      {
        $match: {
          tenantId: req.user.tenantId,
          userId: new mongoose.Types.ObjectId(req.user.id),
          agentId: agentId || null,
        },
      },
      { $group: { _id: null, total: { $sum: '$tokenCount' } } },
    ]);
    if (total + delta > limit)
      throw new SharedMemoryQuotaError(`Memory would exceed token limit of ${limit}.`);
  };
  const assertProjectQuota = async (
    req: AuthenticatedRequest,
    projectId: mongoose.Types.ObjectId,
    delta: number,
  ) => {
    const limit = req.config?.memory?.tokenLimit;
    if (!limit || delta <= 0) return;
    const project = await mongoose.models.Project.findOne({
      _id: projectId,
      tenantId: req.user.tenantId,
    })
      .select('memories')
      .lean<ImportProject>();
    const total = (project?.memories || []).reduce(
      (sum, memory) => sum + deps.countTokens(memory.value),
      0,
    );
    if (total + delta > limit)
      throw new SharedMemoryQuotaError(`Project memories would exceed token limit of ${limit}.`);
  };
  return {
    preview,
    service,
    canCreateLibrary: (req) => permissions(req, 'SHARED_MEMORIES', ['CREATE']),
    canUpdateLibrary: (req) => permissions(req, 'SHARED_MEMORIES', ['UPDATE']),
    hasMemoryPermissions: (req, required) => permissions(req, 'MEMORIES', required),
    acquireLibraryLock: (req) => service().acquire(req.user.tenantId),
    releaseLibraryLock: (req, token) => service().release(req.user.tenantId, token),
    acquirePersonalLock,
    releasePersonalLock: (req, token) =>
      mongoose.models.User.updateOne(
        { _id: req.user.id, tenantId: req.user.tenantId, memoryWriteLock: token },
        { $unset: { memoryWriteLock: 1 } },
      ),
    assertLibraryQuota: (req, delta) =>
      service().assertQuota(req.user.tenantId, delta, req.config?.memory?.tokenLimit),
    assertPersonalQuota,
    assertProjectQuota,
  };
}
export interface SharedImportDependencies {
  preview(req: AuthenticatedRequest): Promise<SharedMemoryImportPreview>;
  service(): SharedMemoryService;
  projectFor(req: AuthenticatedRequest, permission: number): Promise<ImportProject | null>;
  projectEditPermission: number;
  canCreateLibrary(req: AuthenticatedRequest): Promise<boolean>;
  canUpdateLibrary(req: AuthenticatedRequest): Promise<boolean>;
  hasMemoryPermissions(req: AuthenticatedRequest, permissions: string[]): Promise<boolean>;
  memoryUse: string;
  memoryCreate: string;
  memoryUpdate: string;
  acquireLibraryLock(req: AuthenticatedRequest): Promise<string>;
  releaseLibraryLock(req: AuthenticatedRequest, token: string): Promise<unknown>;
  acquirePersonalLock(req: AuthenticatedRequest): Promise<string>;
  releasePersonalLock(req: AuthenticatedRequest, token: string): Promise<unknown>;
  assertLibraryQuota(req: AuthenticatedRequest, delta: number): Promise<unknown>;
  assertPersonalQuota(
    req: AuthenticatedRequest,
    agentId: string | undefined,
    delta: number,
  ): Promise<unknown>;
  assertProjectQuota(
    req: AuthenticatedRequest,
    projectId: mongoose.Types.ObjectId,
    delta: number,
  ): Promise<unknown>;
  countTokens(value: string): number;
  validKey(value: unknown): value is string;
  audit(req: AuthenticatedRequest, action: string, details: Record<string, unknown>): void;
  ImportOperationConflictError: new (...args: never[]) => Error;
  SharedMemoryBusyError: new (...args: never[]) => Error;
}
const message = (error: unknown) => (error instanceof Error ? error.message : 'Import failed.');
const code = (error: unknown) =>
  typeof error === 'object' && error != null && 'code' in error
    ? (error as { code?: number }).code
    : undefined;
export function createSharedImportHandler(
  deps: SharedImportDependencies,
): (req: AuthenticatedRequest, res: Response) => Promise<void> {
  const {
    preview,
    projectFor,
    acquireLibraryLock,
    releaseLibraryLock,
    acquirePersonalLock,
    releasePersonalLock,
    assertLibraryQuota,
    assertPersonalQuota,
    assertProjectQuota,
    countTokens,
    validKey,
    audit,
  } = deps;
  return async function importHandler(req: AuthenticatedRequest, res: Response): Promise<void> {
    const startedAt = Date.now();
    let libraryLock;
    let personalLock;
    try {
      const operationInput = {
        tenantId: req.user.tenantId,
        operationId: req.body.operationId,
        actorId: String(req.user.id),
        payload: {
          destination: req.body.destination,
          format: req.body.format,
          content: req.body.content,
          decisions: req.body.decisions || {},
        },
      };
      const binding = await deps.service().bindImport(operationInput);
      const priorResult = binding.result as SharedMemoryImportResult | undefined;
      const failedRefs = priorResult
        ? new Set(
            priorResult.items.filter((item) => item.status === 'failed').map((item) => item.ref),
          )
        : null;
      if (priorResult && failedRefs?.size === 0) {
        res.json(priorResult);
        return;
      }
      const plan = await preview(req),
        results = priorResult ? priorResult.items.filter((item) => item.status !== 'failed') : [];
      const selected = req.body.selectedRefs ? new Set(req.body.selectedRefs) : null;
      const destination = req.body.destination || { type: 'library' };
      let destinationProject = null;
      if (destination.type === 'project') {
        req.params.projectId = destination.projectId;
        destinationProject = await projectFor(req, deps.projectEditPermission);
        if (!destinationProject) {
          res.status(403).json({ error: 'Project edit permission required.' });
          return;
        }
        libraryLock = await acquireLibraryLock(req);
      } else if (destination.type === 'library') {
        if (!(await deps.canCreateLibrary(req))) {
          res.status(403).json({ error: 'Library creation permission required.' });
          return;
        }
        const decisions = (req.body.decisions || {}) as Record<string, { action?: string }>;
        const replaces = Object.values(decisions).some((decision) => decision.action === 'replace');
        if (replaces && !(await deps.canUpdateLibrary(req))) {
          res.status(403).json({ error: 'Library update permission required.' });
          return;
        }
        libraryLock = await acquireLibraryLock(req);
      } else if (!(await deps.hasMemoryPermissions(req, [deps.memoryUse, deps.memoryCreate]))) {
        res.status(403).json({ error: 'Memory creation permission required.' });
        return;
      } else {
        const decisions = (req.body.decisions || {}) as Record<string, { action?: string }>;
        const replaces = Object.values(decisions).some(
          (decision) => decision?.action === 'replace',
        );
        if (replaces && !(await deps.hasMemoryPermissions(req, [deps.memoryUpdate]))) {
          res.status(403).json({ error: 'Memory update permission required.' });
          return;
        }
        personalLock = await acquirePersonalLock(req);
      }
      for (const item of plan.items) {
        if (selected?.has(item.ref) === false) continue;
        if (failedRefs?.has(item.ref) === false) continue;
        let prior: unknown;
        if (destination.type === 'library') {
          prior = await mongoose.models.SharedMemory.findOne({
            tenantId: req.user.tenantId,
            $or: [
              { importOperationId: req.body.operationId, importRef: item.ref },
              { lastImportOperationId: req.body.operationId, lastImportRef: item.ref },
            ],
          })
            .select('_id')
            .lean();
        } else if (destination.type === 'personal') {
          prior = await mongoose.models.MemoryEntry.findOne({
            tenantId: req.user.tenantId,
            userId: req.user.id,
            $or: [
              { importOperationId: req.body.operationId, importRef: item.ref },
              { lastImportOperationId: req.body.operationId, lastImportRef: item.ref },
            ],
          })
            .select('_id')
            .lean();
        } else {
          prior = destinationProject!.memories?.find(
            (memory: IProjectMemory) =>
              (memory.importOperationId === req.body.operationId &&
                memory.importRef === item.ref) ||
              (memory.lastImportOperationId === req.body.operationId &&
                memory.lastImportRef === item.ref),
          );
        }
        if (prior) {
          const priorId =
            typeof prior === 'object' && !Array.isArray(prior) && '_id' in prior
              ? prior._id
              : undefined;
          results.push({
            ref: item.ref,
            status: req.body.decisions?.[item.ref]?.action === 'replace' ? 'updated' : 'created',
            memoryId: priorId ? String(priorId) : `${destinationProject!.projectId}:${item.ref}`,
          });
          continue;
        }
        const decision = req.body.decisions?.[item.ref];
        if (
          item.status === 'invalid' ||
          item.status === 'identical' ||
          (item.status === 'conflict' && !decision)
        ) {
          results.push({ ref: item.ref, status: 'skipped' });
          continue;
        }
        if (decision?.action === 'skip') {
          results.push({ ref: item.ref, status: 'skipped' });
          continue;
        }
        try {
          if (item.status === 'conflict' && decision.action === 'replace') {
            if (destination.type === 'personal') {
              await assertPersonalQuota(
                req,
                destination.agentId,
                countTokens(item.value) - (item.existing!.tokenCount || 0),
              );
              const replaced = await mongoose.models.MemoryEntry.findOneAndUpdate(
                {
                  _id: item.existing!.id,
                  tenantId: req.user.tenantId,
                  userId: req.user.id,
                  updated_at: new Date(decision.expectedUpdatedAt),
                },
                {
                  $set: {
                    value: item.value,
                    tokenCount: countTokens(item.value),
                    lastImportOperationId: req.body.operationId,
                    lastImportRef: item.ref,
                  },
                  $inc: { __v: 1 },
                  $currentDate: { updated_at: true },
                },
                { new: true },
              );
              if (!replaced) throw new Error('VERSION_CONFLICT');
              results.push({ ref: item.ref, status: 'updated', memoryId: String(replaced._id) });
              continue;
            }
            if (destination.type === 'project') {
              await assertProjectQuota(
                req,
                destinationProject!._id,
                countTokens(item.value) - countTokens(item.existing!.value),
              );
              const replaced = await mongoose.models.Project.findOneAndUpdate(
                {
                  _id: destinationProject!._id,
                  tenantId: req.user.tenantId,
                  memories: {
                    $elemMatch: {
                      key: item.key,
                      $or: [
                        { version: decision.expectedVersion },
                        ...(decision.expectedVersion === 1
                          ? [{ version: { $exists: false } }]
                          : []),
                      ],
                    },
                  },
                },
                {
                  $set: {
                    'memories.$.value': item.value,
                    'memories.$.lastImportOperationId': req.body.operationId,
                    'memories.$.lastImportRef': item.ref,
                    'memories.$.updatedAt': new Date(),
                  },
                  $inc: { 'memories.$.version': 1 },
                },
                { new: true },
              );
              if (!replaced) throw new Error('VERSION_CONFLICT');
              results.push({
                ref: item.ref,
                status: 'updated',
                memoryId: `${destinationProject!.projectId}:${item.key}`,
              });
              continue;
            }
            await assertLibraryQuota(
              req,
              countTokens(item.value) - (item.existing!.tokenCount || 0),
            );
            const replaced = await mongoose.models.SharedMemory.findOneAndUpdate(
              {
                _id: item.existing!.id,
                tenantId: req.user.tenantId,
                version: decision.expectedVersion,
              },
              {
                $set: {
                  value: item.value,
                  tokenCount: countTokens(item.value),
                  lastImportOperationId: req.body.operationId,
                  lastImportRef: item.ref,
                },
                $inc: { version: 1 },
              },
              { new: true },
            );
            if (!replaced) throw new Error('VERSION_CONFLICT');
            results.push({ ref: item.ref, status: 'updated', memoryId: String(replaced._id) });
            continue;
          }
          const importKey =
            item.status === 'conflict' && decision.action === 'copy' ? decision.copyKey : item.key;
          if (!validKey(importKey)) throw new Error('COPY_KEY_REQUIRED');
          if (destination.type === 'library')
            await assertLibraryQuota(req, countTokens(item.value));
          if (destination.type === 'personal') {
            await assertPersonalQuota(req, destination.agentId, countTokens(item.value));
            if (
              await mongoose.models.MemoryEntry.exists({
                tenantId: req.user.tenantId,
                userId: req.user.id,
                agentId: destination.agentId || null,
                key: importKey,
              })
            )
              throw Object.assign(new Error('KEY_CONFLICT'), { code: 11000 });
            const doc = await mongoose.models.MemoryEntry.findOneAndUpdate(
              {
                tenantId: req.user.tenantId,
                userId: req.user.id,
                importOperationId: req.body.operationId,
                importRef: item.ref,
              },
              {
                $setOnInsert: {
                  tenantId: req.user.tenantId,
                  userId: req.user.id,
                  agentId: destination.agentId || null,
                  key: importKey,
                  value: item.value,
                  tokenCount: countTokens(item.value),
                  importOperationId: req.body.operationId,
                  importRef: item.ref,
                  updated_at: new Date(),
                },
              },
              { upsert: true, new: true, runValidators: true },
            );
            results.push({ ref: item.ref, status: 'created', memoryId: String(doc._id) });
            continue;
          }
          if (destination.type === 'project') {
            await assertProjectQuota(req, destinationProject!._id, countTokens(item.value));
            const updated = await mongoose.models.Project.findOneAndUpdate(
              {
                _id: destinationProject!._id,
                tenantId: req.user.tenantId,
                'memories.key': { $ne: importKey },
                memories: {
                  $not: {
                    $elemMatch: { importOperationId: req.body.operationId, importRef: item.ref },
                  },
                },
              },
              {
                $push: {
                  memories: {
                    key: importKey,
                    value: item.value,
                    importOperationId: req.body.operationId,
                    importRef: item.ref,
                  },
                },
              },
              { new: true },
            ).lean<ImportProject>();
            if (!updated) throw Object.assign(new Error('KEY_CONFLICT'), { code: 11000 });
            const created = updated?.memories?.find(
              (memory: IProjectMemory) =>
                memory.importOperationId === req.body.operationId && memory.importRef === item.ref,
            );
            results.push({
              ref: item.ref,
              status: 'created',
              memoryId: created ? `${destinationProject!.projectId}:${item.ref}` : undefined,
            });
            continue;
          }
          const doc = await mongoose.models.SharedMemory.findOneAndUpdate(
            {
              tenantId: req.user.tenantId,
              importOperationId: req.body.operationId,
              importRef: item.ref,
            },
            {
              $setOnInsert: {
                tenantId: req.user.tenantId,
                key: importKey,
                value: item.value,
                tokenCount: countTokens(item.value),
                authorId: req.user.id,
                importOperationId: req.body.operationId,
                importRef: item.ref,
              },
            },
            { upsert: true, new: true, runValidators: true },
          );
          results.push({ ref: item.ref, status: 'created', memoryId: String(doc._id) });
        } catch (error) {
          let failure = 'Write failed.';
          if (message(error) === 'VERSION_CONFLICT') failure = 'Memory changed since preview.';
          else if (error instanceof SharedMemoryQuotaError) failure = message(error);
          else if (code(error) === 11000) failure = 'Key conflict.';
          results.push({
            ref: item.ref,
            status: 'failed',
            error: failure,
          });
        }
      }
      const totals: SharedMemoryImportResult['totals'] = {
        created: 0,
        updated: 0,
        skipped: 0,
        failed: 0,
      };
      results.forEach((item: SharedMemoryImportResultItem) => {
        totals[item.status]++;
      });
      const result = { operationId: req.body.operationId, items: results, totals };
      await deps.service().completeImport(operationInput, binding.hash, result);
      audit(req, 'import', {
        operationId: req.body.operationId,
        destination: destination.type,
        durationMs: Date.now() - startedAt,
        ...totals,
      });
      if (libraryLock) await releaseLibraryLock(req, libraryLock);
      if (personalLock) await releasePersonalLock(req, personalLock);
      res.json(result);
    } catch (error) {
      if (libraryLock) await releaseLibraryLock(req, libraryLock);
      if (personalLock) await releasePersonalLock(req, personalLock);
      res
        .status(
          error instanceof deps.ImportOperationConflictError ||
            error instanceof deps.SharedMemoryBusyError
            ? 409
            : 400,
        )
        .json({ error: message(error) });
    }
  };
}
