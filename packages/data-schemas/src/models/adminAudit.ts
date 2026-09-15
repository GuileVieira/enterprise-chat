import type { Model } from 'mongoose';
import type { IAdminAudit } from '~/types';
import { applyTenantIsolation } from '~/models/plugins/tenantIsolation';
import adminAuditSchema from '~/schema/adminAudit';

export function createAdminAuditModel(mongoose: typeof import('mongoose')): Model<IAdminAudit> {
  applyTenantIsolation(adminAuditSchema, { includeGlobalDocuments: true });
  return mongoose.models.AdminAudit || mongoose.model<IAdminAudit>('AdminAudit', adminAuditSchema);
}
