import { createHash, randomUUID } from 'node:crypto';
import type { Model } from 'mongoose';

interface LibraryState {
  tenantId: string;
  writeLock?: string;
}

interface ImportOperation {
  tenantId: string;
  operationId: string;
  actorId: { toString(): string };
  payloadHash: string;
  result?: unknown;
  toObject(): ImportOperation;
}

interface SharedMemoryUsage {
  tenantId: string;
  status: 'active' | 'archived';
  tokenCount: number;
}

export interface SharedMemoryServiceModels {
  SharedMemory: Model<SharedMemoryUsage>;
  SharedMemoryLibraryState: Model<LibraryState>;
  SharedMemoryImportOperation: Model<ImportOperation>;
}

export interface ImportBindingInput {
  tenantId: string;
  operationId: string;
  actorId: string;
  payload: unknown;
}

export class ImportOperationConflictError extends Error {}
export class SharedMemoryBusyError extends Error {}
export class SharedMemoryQuotaError extends Error {}

export interface SharedMemoryService {
  bindImport(input: ImportBindingInput): Promise<{ hash: string; result?: unknown }>;
  completeImport(input: ImportBindingInput, hash: string, result: unknown): Promise<void>;
  acquire(tenantId: string): Promise<string>;
  release(tenantId: string, token: string): Promise<unknown>;
  assertQuota(tenantId: string, tokenDelta: number, limit?: number): Promise<void>;
}

export function createSharedMemoryService(models: SharedMemoryServiceModels): SharedMemoryService {
  const payloadHash = (payload: unknown) =>
    createHash('sha256').update(JSON.stringify(payload)).digest('hex');

  async function bindImport(
    input: ImportBindingInput,
  ): Promise<{ hash: string; result?: unknown }> {
    const hash = payloadHash(input.payload);
    let operation = await models.SharedMemoryImportOperation.findOne({
      tenantId: input.tenantId,
      operationId: input.operationId,
    }).lean<ImportOperation>();
    if (!operation) {
      try {
        operation = (
          await models.SharedMemoryImportOperation.create({ ...input, payloadHash: hash })
        ).toObject();
      } catch (error) {
        if ((error as { code?: number }).code !== 11000) throw error;
        operation = await models.SharedMemoryImportOperation.findOne({
          tenantId: input.tenantId,
          operationId: input.operationId,
        }).lean<ImportOperation>();
      }
    }
    if (
      !operation ||
      operation.actorId.toString() !== input.actorId ||
      operation.payloadHash !== hash
    ) {
      throw new ImportOperationConflictError('Operation ID is already bound to another import.');
    }
    return { hash, result: operation.result };
  }

  async function completeImport(input: ImportBindingInput, hash: string, result: unknown) {
    await models.SharedMemoryImportOperation.updateOne(
      {
        tenantId: input.tenantId,
        operationId: input.operationId,
        actorId: input.actorId,
        payloadHash: hash,
      },
      { $set: { result } },
    );
  }

  async function acquire(tenantId: string): Promise<string> {
    const token = `${Date.now()}:${randomUUID()}`;
    try {
      const state = await models.SharedMemoryLibraryState.findOneAndUpdate(
        { tenantId, writeLock: { $exists: false } },
        { $setOnInsert: { tenantId }, $set: { writeLock: token } },
        { upsert: true, new: true },
      );
      if (!state) throw new Error('busy');
      return token;
    } catch {
      throw new SharedMemoryBusyError('Library is being updated. Please retry.');
    }
  }

  const release = (tenantId: string, token: string) =>
    models.SharedMemoryLibraryState.updateOne(
      { tenantId, writeLock: token },
      { $unset: { writeLock: 1 } },
    );

  async function assertQuota(tenantId: string, tokenDelta: number, limit?: number) {
    if (!limit || tokenDelta <= 0) return;
    const [{ total = 0 } = {}] = await models.SharedMemory.aggregate<{ total: number }>([
      { $match: { tenantId, status: 'active' } },
      { $group: { _id: null, total: { $sum: '$tokenCount' } } },
    ]);
    if (total + tokenDelta > limit) {
      throw new SharedMemoryQuotaError(`Library would exceed token limit of ${limit}.`);
    }
  }

  return { bindImport, completeImport, acquire, release, assertQuota };
}
