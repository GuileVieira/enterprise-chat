import type { Model, Types } from 'mongoose';
import type { IAdminAudit } from '~/types';

interface RecordAdminAuditInput {
  tenantId?: string;
  actorId: string | Types.ObjectId;
  targetUserId: string | Types.ObjectId;
  action: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export function createAdminAuditMethods(mongoose: typeof import('mongoose')) {
  async function recordAdminAudit(input: RecordAdminAuditInput): Promise<IAdminAudit> {
    const AdminAudit = mongoose.models.AdminAudit as Model<IAdminAudit>;
    return (await AdminAudit.create(input)).toObject();
  }

  async function listAdminAudits(
    targetUserId: string | Types.ObjectId,
    limit = 50,
  ): Promise<IAdminAudit[]> {
    const AdminAudit = mongoose.models.AdminAudit as Model<IAdminAudit>;
    return AdminAudit.find({ targetUserId }).sort({ createdAt: -1 }).limit(limit).lean();
  }

  return { recordAdminAudit, listAdminAudits };
}

export type AdminAuditMethods = ReturnType<typeof createAdminAuditMethods>;
