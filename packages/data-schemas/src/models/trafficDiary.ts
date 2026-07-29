import trafficDiarySchema from '~/schema/trafficDiary';
import { applyTenantIsolation } from '~/models/plugins/tenantIsolation';
import type { ITrafficDiaryEntry } from '~/types/trafficDiary';

export function createTrafficDiaryModel(mongoose: typeof import('mongoose')) {
  applyTenantIsolation(trafficDiarySchema);
  return (
    mongoose.models.TrafficDiaryEntry ||
    mongoose.model<ITrafficDiaryEntry>('TrafficDiaryEntry', trafficDiarySchema)
  );
}
