import { Types } from 'mongoose';
import { randomUUID } from 'node:crypto';
import logger from '~/config/winston';
import type * as t from '~/types';

/**
 * Formats a date in YYYY-MM-DD format
 */
const formatDate = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

// Factory function that takes mongoose instance and returns the methods
export function createMemoryMethods(mongoose: typeof import('mongoose')) {
  const memoryError = (message: string, code: string): Error & { code: string } =>
    Object.assign(new Error(message), { code });

  async function withMemoryWrite<T>(
    userId: string | Types.ObjectId,
    write: () => Promise<T>,
  ): Promise<T> {
    const User = mongoose.models.User;
    const token = `${Date.now()}:${randomUUID()}`;
    const owner = await User.findOneAndUpdate(
      { _id: userId, memoryWriteLock: null },
      { $set: { memoryWriteLock: token } },
    ).select('_id');
    if (!owner) {
      throw memoryError('Memory is being updated. Please retry.', 'MEMORY_BUSY');
    }
    // ponytail: no lock expiry; after a process crash, clear its lock only after confirming it stopped.
    // An expiring lock could let a paused writer exceed the budget on standalone MongoDB.
    try {
      return await write();
    } finally {
      await User.updateOne(
        { _id: userId, memoryWriteLock: token },
        { $unset: { memoryWriteLock: 1 } },
      );
    }
  }

  async function writeMemory(
    params: t.SetMemoryParams,
    mode: 'create' | 'set' | 'update',
    originalKey = params.key,
    expectedUpdatedAt?: string,
  ): Promise<t.MemoryResult> {
    const { userId, key, value, tokenCount = 0, tokenLimit } = params;
    if (!/^[a-z_]+$/.test(key) || !value.trim() || !Number.isFinite(tokenCount) || tokenCount < 0) {
      throw memoryError('Invalid memory key, value or token count.', 'MEMORY_INVALID');
    }
    if (key === 'nothing') return { ok: false };
    return withMemoryWrite(userId, async () => {
      const memories = await getAllUserMemories(userId);
      const existing = memories.find((memory) => memory.key === originalKey);
      if (
        (mode === 'create' && existing) ||
        (key !== originalKey && memories.some((memory) => memory.key === key))
      ) {
        throw memoryError('Memory with this key already exists.', 'MEMORY_DUPLICATE');
      }
      if (mode === 'update' && !existing) {
        throw memoryError('Memory not found.', 'MEMORY_NOT_FOUND');
      }
      if (
        expectedUpdatedAt &&
        existing?.updated_at?.getTime() !== new Date(expectedUpdatedAt).getTime()
      ) {
        throw memoryError('Memory changed. Reload before saving.', 'MEMORY_CONFLICT');
      }
      const currentTotal = memories.reduce((total, memory) => total + (memory.tokenCount || 0), 0);
      const nextTotal = currentTotal - (existing?.tokenCount || 0) + tokenCount;
      if (
        tokenLimit != null &&
        tokenLimit > 0 &&
        nextTotal > tokenLimit &&
        nextTotal > currentTotal
      ) {
        throw memoryError(`Memory would exceed token limit of ${tokenLimit}.`, 'MEMORY_LIMIT');
      }
      const MemoryEntry = mongoose.models.MemoryEntry;
      const updated_at = new Date(Math.max(Date.now(), (existing?.updated_at?.getTime() || 0) + 1));
      if (existing) {
        const updated = await MemoryEntry.findOneAndUpdate(
          { _id: existing._id, userId, key: originalKey },
          { $set: { key, value, tokenCount, updated_at } },
          { runValidators: true },
        );
        if (!updated) throw memoryError('Memory changed. Reload before saving.', 'MEMORY_CONFLICT');
      } else {
        await MemoryEntry.create({ userId, key, value, tokenCount, updated_at });
      }
      return { ok: true };
    });
  }

  const createMemory = (params: t.SetMemoryParams) => writeMemory(params, 'create');
  const setMemory = (params: t.SetMemoryParams) => writeMemory(params, 'set');
  const updateMemory = (params: t.UpdateMemoryParams) =>
    writeMemory(params, 'update', params.originalKey, params.expectedUpdatedAt);

  async function deleteMemory({ userId, key }: t.DeleteMemoryParams): Promise<t.MemoryResult> {
    const result = await mongoose.models.MemoryEntry.findOneAndDelete({ userId, key });
    return { ok: !!result };
  }

  /**
   * Gets all memory entries for a user
   */
  async function getAllUserMemories(
    userId: string | Types.ObjectId,
  ): Promise<t.IMemoryEntryLean[]> {
    try {
      const MemoryEntry = mongoose.models.MemoryEntry;
      return (await MemoryEntry.find({ userId }).lean()) as t.IMemoryEntryLean[];
    } catch (error) {
      throw new Error(
        `Failed to get all memories: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Gets and formats all memories for a user in two different formats
   */
  async function getFormattedMemories({
    userId,
  }: t.GetFormattedMemoriesParams): Promise<t.FormattedMemoriesResult> {
    try {
      const memories = await getAllUserMemories(userId);

      if (!memories || memories.length === 0) {
        return { withKeys: '', withoutKeys: '', totalTokens: 0 };
      }

      const sortedMemories = memories.sort(
        (a, b) => new Date(a.updated_at!).getTime() - new Date(b.updated_at!).getTime(),
      );

      const totalTokens = sortedMemories.reduce((sum, memory) => {
        return sum + (memory.tokenCount || 0);
      }, 0);

      const withKeys = sortedMemories
        .map((memory, index) => {
          const date = formatDate(new Date(memory.updated_at!));
          const tokenInfo = memory.tokenCount ? ` [${memory.tokenCount} tokens]` : '';
          return `${index + 1}. [${date}]. ["key": "${memory.key}"]${tokenInfo}. ["value": "${memory.value}"]`;
        })
        .join('\n\n');

      const withoutKeys = sortedMemories
        .map((memory, index) => {
          const date = formatDate(new Date(memory.updated_at!));
          return `${index + 1}. [${date}]. ${memory.value}`;
        })
        .join('\n\n');

      return { withKeys, withoutKeys, totalTokens };
    } catch (error) {
      logger.error('Failed to get formatted memories:', error);
      return { withKeys: '', withoutKeys: '', totalTokens: 0 };
    }
  }

  /**
   * Deletes all memory entries for a user
   */
  async function deleteAllUserMemories(userId: string | Types.ObjectId): Promise<number> {
    try {
      const MemoryEntry = mongoose.models.MemoryEntry;
      const result = await MemoryEntry.deleteMany({ userId });
      return result.deletedCount;
    } catch (error) {
      throw new Error(
        `Failed to delete all user memories: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  return {
    setMemory,
    createMemory,
    updateMemory,
    deleteMemory,
    getAllUserMemories,
    getFormattedMemories,
    deleteAllUserMemories,
  };
}

export type MemoryMethods = ReturnType<typeof createMemoryMethods>;
