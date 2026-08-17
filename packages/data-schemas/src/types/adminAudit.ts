import type { Types } from 'mongoose';

export interface IAdminAudit {
  _id: Types.ObjectId;
  tenantId?: string;
  actorId: Types.ObjectId;
  targetUserId: Types.ObjectId;
  action: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}
