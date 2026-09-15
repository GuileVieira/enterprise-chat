import type { Model } from 'mongoose';
import type { ITenantFunction } from '~/types';
import { applyTenantIsolation } from '~/models/plugins/tenantIsolation';
import tenantFunctionSchema from '~/schema/tenantFunction';

export function createTenantFunctionModel(
  mongoose: typeof import('mongoose'),
): Model<ITenantFunction> {
  applyTenantIsolation(tenantFunctionSchema);
  return (
    mongoose.models.TenantFunction ||
    mongoose.model<ITenantFunction>('TenantFunction', tenantFunctionSchema)
  );
}
