import { Types } from 'mongoose';
import { randomUUID } from 'node:crypto';
import type * as t from '~/types';
import logger from '~/config/winston';

const formatDate = (date: Date): string => date.toISOString().split('T')[0];
const partitionFilter = (agentId?: string) => ({ agentId: agentId ?? null });

export function createMemoryMethods(mongoose: typeof import('mongoose')): {
  setMemory: (params: t.SetMemoryParams) => Promise<t.MemoryResult>;
  createMemory: (params: t.SetMemoryParams) => Promise<t.MemoryResult>;
  updateMemory: (params: t.UpdateMemoryParams) => Promise<t.MemoryResult>;
  deleteMemory: (params: t.DeleteMemoryParams) => Promise<t.MemoryResult>;
  setMemoryById: (params: t.SetMemoryByIdParams) => Promise<t.SetMemoryByIdResult>;
  deleteMemoryById: (params: t.MemoryByIdParams) => Promise<t.MemoryResult>;
  getAllUserMemories: (userId: string | Types.ObjectId) => Promise<t.IMemoryEntryLean[]>;
  getUserMemories: (params: t.GetUserMemoriesParams) => Promise<t.IMemoryEntryLean[]>;
  getFormattedMemories: (
    params: t.GetFormattedMemoriesParams,
  ) => Promise<t.FormattedMemoriesResult>;
  deleteAllUserMemories: (userId: string | Types.ObjectId) => Promise<number>;
} {
  const memoryError = (message: string, code: string): Error & { code: string } =>
    Object.assign(new Error(message), { code });

  async function withMemoryWrite<T>(userId: string | Types.ObjectId, write: () => Promise<T>) {
    const User = mongoose.models.User;
    const token = `${Date.now()}:${randomUUID()}`;
    const owner = await User.findOneAndUpdate(
      { _id: userId, memoryWriteLock: null },
      { $set: { memoryWriteLock: token } },
    ).select('_id');
    if (!owner) throw memoryError('Memory is being updated. Please retry.', 'MEMORY_BUSY');
    try {
      return await write();
    } finally {
      await User.updateOne(
        { _id: userId, memoryWriteLock: token },
        { $unset: { memoryWriteLock: 1 } },
      );
    }
  }

  const validateValue = (value: string, tokenCount: number) => {
    if (!value.trim() || !Number.isFinite(tokenCount) || tokenCount < 0) {
      throw memoryError('Invalid memory key, value or token count.', 'MEMORY_INVALID');
    }
  };
  const validateKey = (key: string) => {
    if (!/^[a-z_]+$/.test(key)) {
      throw memoryError('Invalid memory key, value or token count.', 'MEMORY_INVALID');
    }
  };

  const assertBudget = (
    memories: t.IMemoryEntryLean[],
    tokenCount: number,
    replaced: t.IMemoryEntryLean | undefined,
    tokenLimit?: number,
  ) => {
    const current = memories.reduce((sum, memory) => sum + (memory.tokenCount || 0), 0);
    const next = current - (replaced?.tokenCount || 0) + tokenCount;
    if (tokenLimit != null && tokenLimit > 0 && next > tokenLimit && next > current) {
      throw memoryError(`Memory would exceed token limit of ${tokenLimit}.`, 'MEMORY_LIMIT');
    }
  };

  async function writeMemory(
    params: t.SetMemoryParams,
    mode: 'create' | 'set' | 'update',
    originalKey = params.key,
    expectedUpdatedAt?: string,
  ): Promise<t.MemoryResult> {
    const { userId, key, value, tokenCount = 0, tokenLimit, agentId } = params;
    validateKey(key);
    validateValue(value, tokenCount);
    if (key.toLowerCase() === 'nothing') return { ok: false };
    return withMemoryWrite(userId, async () => {
      const memories = await getUserMemories({ userId, agentId });
      const existing = memories.find((memory) => memory.key === originalKey);
      if (
        (mode === 'create' && existing) ||
        (key !== originalKey && memories.some((m) => m.key === key))
      ) {
        throw memoryError('Memory with this key already exists.', 'MEMORY_DUPLICATE');
      }
      if (mode === 'update' && !existing)
        throw memoryError('Memory not found.', 'MEMORY_NOT_FOUND');
      if (
        expectedUpdatedAt &&
        existing?.updated_at?.getTime() !== new Date(expectedUpdatedAt).getTime()
      ) {
        throw memoryError('Memory changed. Reload before saving.', 'MEMORY_CONFLICT');
      }
      assertBudget(memories, tokenCount, existing, tokenLimit);
      const MemoryEntry = mongoose.models.MemoryEntry;
      const updated_at = new Date(Math.max(Date.now(), (existing?.updated_at?.getTime() || 0) + 1));
      if (!existing) {
        await MemoryEntry.create({
          userId,
          key,
          value,
          tokenCount,
          ...(agentId ? { agentId } : {}),
          updated_at,
        });
        return { ok: true };
      }
      const updated = await MemoryEntry.findOneAndUpdate(
        {
          _id: existing._id,
          userId,
          key: originalKey,
          ...partitionFilter(agentId),
          ...(expectedUpdatedAt ? { updated_at: new Date(expectedUpdatedAt) } : {}),
        },
        { $set: { key, value, tokenCount, updated_at } },
        { runValidators: true },
      );
      if (!updated) throw memoryError('Memory changed. Reload before saving.', 'MEMORY_CONFLICT');
      return { ok: true };
    });
  }

  const createMemory = (params: t.SetMemoryParams): Promise<t.MemoryResult> =>
    writeMemory(params, 'create');
  const setMemory = (params: t.SetMemoryParams): Promise<t.MemoryResult> =>
    writeMemory(params, 'set');
  const updateMemory = (params: t.UpdateMemoryParams): Promise<t.MemoryResult> =>
    writeMemory(params, 'update', params.originalKey, params.expectedUpdatedAt);

  async function deleteMemory({
    userId,
    key,
    agentId,
  }: t.DeleteMemoryParams): Promise<t.MemoryResult> {
    return withMemoryWrite(userId, async () => ({
      ok: !!(await mongoose.models.MemoryEntry.findOneAndDelete({
        userId,
        key,
        ...partitionFilter(agentId),
      })),
    }));
  }

  async function setMemoryById(params: t.SetMemoryByIdParams): Promise<t.SetMemoryByIdResult> {
    const { userId, id, value, tokenCount = 0, tokenLimit, expectedUpdatedAt, agentId } = params;
    if (!mongoose.Types.ObjectId.isValid(id)) return { ok: false };
    const normalizedId = new Types.ObjectId(id).toHexString();
    const recordFilter = { _id: id, userId, ...partitionFilter(agentId) };
    if (!(await mongoose.models.MemoryEntry.exists(recordFilter))) return { ok: false };
    return withMemoryWrite(userId, async () => {
      const existing =
        await mongoose.models.MemoryEntry.findOne(recordFilter).lean<t.IMemoryEntryLean>();
      if (!existing) return { ok: false };
      const key = params.key ?? existing.key;
      if (params.key != null) validateKey(key);
      validateValue(value, tokenCount);
      if (key.toLowerCase() === 'nothing') return { ok: false };
      if (
        expectedUpdatedAt &&
        existing.updated_at?.getTime() !== new Date(expectedUpdatedAt).getTime()
      ) {
        return { ok: false, conflict: true };
      }
      const memories = await getUserMemories({ userId, agentId });
      if (
        memories.some((memory) => memory.key === key && memory._id.toHexString() !== normalizedId)
      ) {
        return { ok: false, conflict: true };
      }
      assertBudget(memories, tokenCount, existing, tokenLimit);
      const updated_at = new Date(Math.max(Date.now(), (existing.updated_at?.getTime() || 0) + 1));
      const memory = await mongoose.models.MemoryEntry.findOneAndUpdate(
        {
          ...recordFilter,
          ...(expectedUpdatedAt ? { updated_at: new Date(expectedUpdatedAt) } : {}),
        },
        { $set: { ...(params.key != null ? { key } : {}), value, tokenCount, updated_at } },
        { new: true, runValidators: true },
      ).lean<t.IMemoryEntryLean>();
      return memory ? { ok: true, memory } : { ok: false, conflict: true };
    });
  }

  async function deleteMemoryById({
    userId,
    id,
    agentId,
  }: t.MemoryByIdParams): Promise<t.MemoryResult> {
    if (!mongoose.Types.ObjectId.isValid(id)) return { ok: false };
    const recordFilter = { _id: id, userId, ...partitionFilter(agentId) };
    if (!(await mongoose.models.MemoryEntry.exists(recordFilter))) return { ok: false };
    return withMemoryWrite(userId, async () => ({
      ok: !!(await mongoose.models.MemoryEntry.findOneAndDelete(recordFilter)),
    }));
  }

  async function getAllUserMemories(
    userId: string | Types.ObjectId,
  ): Promise<t.IMemoryEntryLean[]> {
    return mongoose.models.MemoryEntry.find({ userId })
      .sort({ updated_at: -1 })
      .lean<t.IMemoryEntryLean[]>();
  }

  async function getUserMemories({
    userId,
    agentId,
  }: t.GetUserMemoriesParams): Promise<t.IMemoryEntryLean[]> {
    return mongoose.models.MemoryEntry.find({ userId, ...partitionFilter(agentId) })
      .sort({ updated_at: -1 })
      .lean<t.IMemoryEntryLean[]>();
  }

  async function getFormattedMemories({
    userId,
    agentId,
  }: t.GetFormattedMemoriesParams): Promise<t.FormattedMemoriesResult> {
    try {
      const memories = await getUserMemories({ userId, agentId });
      const sorted = memories.sort(
        (a, b) => new Date(a.updated_at!).getTime() - new Date(b.updated_at!).getTime(),
      );
      const tokenCountsByKey = new Map<string, number>();
      let totalTokens = 0;
      for (const memory of sorted) {
        const tokens = memory.tokenCount || 0;
        totalTokens += tokens;
        tokenCountsByKey.set(memory.key, tokens);
      }
      const withKeys = sorted
        .map((memory, index) => {
          const date = formatDate(new Date(memory.updated_at!));
          const tokenInfo = memory.tokenCount ? ` [${memory.tokenCount} tokens]` : '';
          return `${index + 1}. [${date}]. ["key": "${memory.key}"]${tokenInfo}. ["value": "${memory.value}"]`;
        })
        .join('\n\n');
      const withoutKeys = sorted
        .map(
          (memory, index) =>
            `${index + 1}. [${formatDate(new Date(memory.updated_at!))}]. ${memory.value}`,
        )
        .join('\n\n');
      return { withKeys, withoutKeys, totalTokens, tokenCountsByKey };
    } catch (error) {
      logger.error('Failed to get formatted memories:', error);
      return {
        withKeys: '',
        withoutKeys: '',
        totalTokens: 0,
        tokenCountsByKey: new Map<string, number>(),
      };
    }
  }

  async function deleteAllUserMemories(userId: string | Types.ObjectId): Promise<number> {
    return withMemoryWrite(
      userId,
      async () => (await mongoose.models.MemoryEntry.deleteMany({ userId })).deletedCount,
    );
  }

  return {
    setMemory,
    createMemory,
    updateMemory,
    deleteMemory,
    setMemoryById,
    deleteMemoryById,
    getAllUserMemories,
    getUserMemories,
    getFormattedMemories,
    deleteAllUserMemories,
  };
}

export type MemoryMethods = ReturnType<typeof createMemoryMethods>;
