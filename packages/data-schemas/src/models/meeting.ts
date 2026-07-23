import meetingSchema from '~/schema/meeting';
import { applyTenantIsolation } from '~/models/plugins/tenantIsolation';
import type { IMeeting } from '~/types/meeting';

export function createMeetingModel(mongoose: typeof import('mongoose')) {
  applyTenantIsolation(meetingSchema);
  return mongoose.models.Meeting || mongoose.model<IMeeting>('Meeting', meetingSchema);
}
