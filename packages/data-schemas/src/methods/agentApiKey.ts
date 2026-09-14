import type { Types } from 'mongoose';
import type {
  AgentApiKeyCreateResult,
  AgentApiKeyCreateData,
  AgentApiKeyListItem,
  IAgentApiKey,
} from '~/types';
import { hashToken, getRandomValues } from '~/crypto';
import logger from '~/config/winston';
import { runAsSystem } from '~/config/tenantContext';

const API_KEY_PREFIX = 'sk-';
const API_KEY_LENGTH = 32;

export function createAgentApiKeyMethods(mongoose: typeof import('mongoose')) {
  async function generateApiKey(): Promise<{ key: string; keyHash: string; keyPrefix: string }> {
    const randomPart = await getRandomValues(API_KEY_LENGTH);
    const key = `${API_KEY_PREFIX}${randomPart}`;
    const keyHash = await hashToken(key);
    const keyPrefix = key.slice(0, 8);
    return { key, keyHash, keyPrefix };
  }

  async function createAgentApiKey(data: AgentApiKeyCreateData): Promise<AgentApiKeyCreateResult> {
    try {
      const AgentApiKey = mongoose.models.AgentApiKey;
      const { key, keyHash, keyPrefix } = await generateApiKey();

      const apiKeyDoc = await AgentApiKey.create({
        userId: data.userId,
        scope: data.scope,
        tenantId: data.tenantId,
        name: data.name,
        keyHash,
        keyPrefix,
        expiresAt: data.expiresAt || undefined,
      });

      return {
        id: apiKeyDoc._id.toString(),
        name: apiKeyDoc.name,
        keyPrefix,
        key,
        createdAt: apiKeyDoc.createdAt,
        expiresAt: apiKeyDoc.expiresAt,
      };
    } catch (error) {
      logger.error('[createAgentApiKey] Error creating API key:', error);
      throw error;
    }
  }

  async function validateAgentApiKey(apiKey: string): Promise<{
    userId: Types.ObjectId;
    keyId: Types.ObjectId;
    tenantId?: string;
    scope?: 'tenant';
  } | null> {
    try {
      return await runAsSystem(async () => {
        const AgentApiKey = mongoose.models.AgentApiKey;
        const keyHash = await hashToken(apiKey);

        const keyDoc = (await AgentApiKey.findOne({ keyHash }).lean()) as IAgentApiKey | null;

        if (!keyDoc) {
          return null;
        }

        if (keyDoc.expiresAt && new Date(keyDoc.expiresAt) < new Date()) {
          return null;
        }

        if (keyDoc.scope === 'tenant') {
          if (!keyDoc.tenantId || keyDoc.tenantId === '__SYSTEM__') return null;
          const owner = await mongoose.models.User.exists({
            _id: keyDoc.userId,
            tenantId: keyDoc.tenantId,
            role: 'OWNER',
            disabled: { $ne: true },
          });
          if (!owner) return null;
        }

        await AgentApiKey.updateOne({ _id: keyDoc._id }, { $set: { lastUsedAt: new Date() } });

        return {
          userId: keyDoc.userId,
          keyId: keyDoc._id as Types.ObjectId,
          tenantId: keyDoc.tenantId,
          scope: keyDoc.scope,
        };
      });
    } catch (error) {
      logger.error('[validateAgentApiKey] Error validating API key:', error);
      return null;
    }
  }

  async function listAgentApiKeys(userId: string | Types.ObjectId): Promise<AgentApiKeyListItem[]> {
    try {
      const AgentApiKey = mongoose.models.AgentApiKey;
      const keys = (await AgentApiKey.find({ userId, scope: { $ne: 'tenant' } })
        .sort({ createdAt: -1 })
        .lean()) as unknown as IAgentApiKey[];

      return keys.map((key) => ({
        id: (key._id as Types.ObjectId).toString(),
        name: key.name,
        keyPrefix: key.keyPrefix,
        lastUsedAt: key.lastUsedAt,
        expiresAt: key.expiresAt,
        createdAt: key.createdAt,
      }));
    } catch (error) {
      logger.error('[listAgentApiKeys] Error listing API keys:', error);
      throw error;
    }
  }

  async function deleteAgentApiKey(
    keyId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
  ): Promise<boolean> {
    try {
      const AgentApiKey = mongoose.models.AgentApiKey;
      const result = await AgentApiKey.deleteOne({ _id: keyId, userId, scope: { $ne: 'tenant' } });
      return result.deletedCount > 0;
    } catch (error) {
      logger.error('[deleteAgentApiKey] Error deleting API key:', error);
      throw error;
    }
  }

  async function deleteAllAgentApiKeys(userId: string | Types.ObjectId): Promise<number> {
    try {
      const AgentApiKey = mongoose.models.AgentApiKey;
      const result = await AgentApiKey.deleteMany({ userId });
      return result.deletedCount;
    } catch (error) {
      logger.error('[deleteAllAgentApiKeys] Error deleting all API keys:', error);
      throw error;
    }
  }

  async function getAgentApiKeyById(
    keyId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
  ): Promise<AgentApiKeyListItem | null> {
    try {
      const AgentApiKey = mongoose.models.AgentApiKey;
      const keyDoc = (await AgentApiKey.findOne({
        _id: keyId,
        userId,
        scope: { $ne: 'tenant' },
      }).lean()) as IAgentApiKey | null;

      if (!keyDoc) {
        return null;
      }

      return {
        id: (keyDoc._id as Types.ObjectId).toString(),
        name: keyDoc.name,
        keyPrefix: keyDoc.keyPrefix,
        lastUsedAt: keyDoc.lastUsedAt,
        expiresAt: keyDoc.expiresAt,
        createdAt: keyDoc.createdAt,
      };
    } catch (error) {
      logger.error('[getAgentApiKeyById] Error getting API key:', error);
      throw error;
    }
  }

  async function listTenantApiKeys(tenantId: string): Promise<AgentApiKeyListItem[]> {
    const keys = await mongoose.models.AgentApiKey.find({ tenantId, scope: 'tenant' })
      .sort({ createdAt: -1 })
      .lean<IAgentApiKey[]>();
    return keys.map((key) => ({
      id: String(key._id),
      name: key.name,
      keyPrefix: key.keyPrefix,
      createdAt: key.createdAt,
      expiresAt: key.expiresAt,
      lastUsedAt: key.lastUsedAt,
    }));
  }

  async function deleteTenantApiKey(tenantId: string, id: string): Promise<boolean> {
    const result = await mongoose.models.AgentApiKey.deleteOne({
      _id: id,
      tenantId,
      scope: 'tenant',
    });
    return result.deletedCount > 0;
  }

  return {
    listTenantApiKeys,
    deleteTenantApiKey,
    createAgentApiKey,
    validateAgentApiKey,
    listAgentApiKeys,
    deleteAgentApiKey,
    deleteAllAgentApiKeys,
    getAgentApiKeyById,
  };
}

export type AgentApiKeyMethods = ReturnType<typeof createAgentApiKeyMethods>;
