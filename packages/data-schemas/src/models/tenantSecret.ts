import type { Model } from 'mongoose';
import type { ITenantSecret } from '~/types';
import { applyTenantIsolation } from '~/models/plugins/tenantIsolation';
import tenantSecretSchema from '~/schema/tenantSecret';

export function createTenantSecretModel(mongoose: typeof import('mongoose')): Model<ITenantSecret> {
  applyTenantIsolation(tenantSecretSchema);
  return (
    mongoose.models.TenantSecret ||
    mongoose.model<ITenantSecret>('TenantSecret', tenantSecretSchema)
  );
}
