import tenantFunctionSchema from '~/schema/tenantFunction';
import { applyTenantIsolation } from '~/models/plugins/tenantIsolation';
import type { ITenantFunction } from '~/types';

export function createTenantFunctionModel(mongoose: typeof import('mongoose')) {
  applyTenantIsolation(tenantFunctionSchema);
  return (
    mongoose.models.TenantFunction ||
    mongoose.model<ITenantFunction>('TenantFunction', tenantFunctionSchema)
  );
}
