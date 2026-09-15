import type { Model } from 'mongoose';
import type { IMeeting } from '~/types/meeting';
import { applyTenantIsolation } from '~/models/plugins/tenantIsolation';
import meetingSchema from '~/schema/meeting';

export function createMeetingModel(mongoose: typeof import('mongoose')): Model<IMeeting> {
  applyTenantIsolation(meetingSchema);
  return mongoose.models.Meeting || mongoose.model<IMeeting>('Meeting', meetingSchema);
}
