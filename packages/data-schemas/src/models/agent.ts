import agentSchema from '~/schema/agent';
import { applyTenantIsolation } from '~/models/plugins/tenantIsolation';
import type { IAgent } from '~/types';

export function createAgentModel(mongoose: typeof import('mongoose')) {
  applyTenantIsolation(agentSchema, { includeGlobalDocuments: true });
  return mongoose.models.Agent || mongoose.model<IAgent>('Agent', agentSchema);
}
