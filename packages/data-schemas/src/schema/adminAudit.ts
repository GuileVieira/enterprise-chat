import { Schema } from 'mongoose';
import type { IAdminAudit } from '~/types';

const adminAuditSchema = new Schema<IAdminAudit>(
  {
    tenantId: { type: String, index: true },
    actorId: { type: Schema.Types.ObjectId, required: true, index: true },
    targetUserId: { type: Schema.Types.ObjectId, required: true, index: true },
    action: { type: String, required: true, maxlength: 100 },
    before: { type: Schema.Types.Mixed },
    after: { type: Schema.Types.Mixed },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

adminAuditSchema.index({ targetUserId: 1, createdAt: -1 });

export default adminAuditSchema;
