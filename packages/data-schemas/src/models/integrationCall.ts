import type { Model } from 'mongoose';
import type { IntegrationCallRecord } from '~/types/integrationCall';
import { applyTenantIsolation } from '~/models/plugins/tenantIsolation';
import integrationCallSchema from '~/schema/integrationCall';

export function createIntegrationCallModel(
  mongoose: typeof import('mongoose'),
): Model<IntegrationCallRecord> {
  applyTenantIsolation(integrationCallSchema);
  return (
    mongoose.models.IntegrationCall ||
    mongoose.model<IntegrationCallRecord>('IntegrationCall', integrationCallSchema)
  );
}
