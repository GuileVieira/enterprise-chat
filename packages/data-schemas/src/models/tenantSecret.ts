import tenantSecretSchema from '~/schema/tenantSecret';
import { applyTenantIsolation } from '~/models/plugins/tenantIsolation';
import type { ITenantSecret } from '~/types';

export function createTenantSecretModel(mongoose: typeof import('mongoose')) {
  applyTenantIsolation(tenantSecretSchema);
  return (
    mongoose.models.TenantSecret || mongoose.model<ITenantSecret>('TenantSecret', tenantSecretSchema)
  );
}
