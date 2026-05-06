import type { FilterQuery, Model } from 'mongoose';
import { encryptV2, decryptV2 } from '~/crypto';
import type { ITenantFunction, ITenantSecret } from '~/types';

export function createTenantSecretMethods(mongoose: typeof import('mongoose')) {
  /**
   * Creates or updates a tenant secret. Value is encrypted before storage.
   */
  async function upsertTenantSecret(
    tenantId: string,
    name: string,
    value: string,
    type: ITenantSecret['type'],
  ): Promise<ITenantSecret> {
    const TenantSecret = mongoose.models.TenantSecret as Model<ITenantSecret>;
    const encryptedValue = await encryptV2(value);
    const result = await TenantSecret.findOneAndUpdate(
      { tenantId, name },
      { tenantId, name, value: encryptedValue, type },
      { new: true, upsert: true },
    ).lean();
    return result as ITenantSecret;
  }

  /**
   * Retrieves a decrypted tenant secret by tenantId and name.
   */
  async function getTenantSecret(
    tenantId: string,
    name: string,
  ): Promise<{ name: string; value: string; type: ITenantSecret['type'] } | null> {
    const TenantSecret = mongoose.models.TenantSecret as Model<ITenantSecret>;
    const secret = (await TenantSecret.findOne({ tenantId, name }).lean()) as ITenantSecret | null;
    if (!secret) {
      return null;
    }
    const decryptedValue = await decryptV2(secret.value);
    return { name: secret.name, value: decryptedValue, type: secret.type };
  }

  /**
   * Lists all secrets for a tenant (without values).
   */
  async function listTenantSecrets(tenantId: string): Promise<Array<Omit<ITenantSecret, 'value'>>> {
    const TenantSecret = mongoose.models.TenantSecret as Model<ITenantSecret>;
    const secrets = (await TenantSecret.find({ tenantId }).lean()) as ITenantSecret[];
    return secrets.map((s) => {
      const { value: _value, ...rest } = s;
      return rest;
    });
  }

  /**
   * Counts tenant secrets matching the search parameters.
   */
  async function countTenantSecrets(
    searchParams: FilterQuery<ITenantSecret> = {},
  ): Promise<number> {
    const TenantSecret = mongoose.models.TenantSecret as Model<ITenantSecret>;
    return await TenantSecret.countDocuments(searchParams);
  }

  /**
   * Deletes a tenant secret by tenantId and name.
   */
  async function deleteTenantSecret(tenantId: string, name: string): Promise<ITenantSecret | null> {
    const TenantSecret = mongoose.models.TenantSecret as Model<ITenantSecret>;
    return (await TenantSecret.findOneAndDelete({ tenantId, name }).lean()) as ITenantSecret | null;
  }

  /**
   * Checks if any tenant function references a given secret.
   */
  async function isSecretInUse(tenantId: string, name: string): Promise<boolean> {
    const TenantFunction = mongoose.models.TenantFunction as Model<ITenantFunction>;
    const count = await TenantFunction.countDocuments({
      tenantId,
      'config.auth.secretName': name,
    });
    return count > 0;
  }

  return {
    upsertTenantSecret,
    getTenantSecret,
    listTenantSecrets,
    countTenantSecrets,
    deleteTenantSecret,
    isSecretInUse,
  };
}

export type TenantSecretMethods = ReturnType<typeof createTenantSecretMethods>;
