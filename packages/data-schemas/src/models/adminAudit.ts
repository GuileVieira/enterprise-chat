import adminAuditSchema from '~/schema/adminAudit';
import { applyTenantIsolation } from '~/models/plugins/tenantIsolation';
import type { IAdminAudit } from '~/types';

export function createAdminAuditModel(mongoose: typeof import('mongoose')) {
  applyTenantIsolation(adminAuditSchema, { includeGlobalDocuments: true });
  return mongoose.models.AdminAudit || mongoose.model<IAdminAudit>('AdminAudit', adminAuditSchema);
}
