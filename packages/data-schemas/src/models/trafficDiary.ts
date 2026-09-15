import type { Model } from 'mongoose';
import type { ITrafficDiaryEntry } from '~/types/trafficDiary';
import { applyTenantIsolation } from '~/models/plugins/tenantIsolation';
import trafficDiarySchema from '~/schema/trafficDiary';

export function createTrafficDiaryModel(
  mongoose: typeof import('mongoose'),
): Model<ITrafficDiaryEntry> {
  applyTenantIsolation(trafficDiarySchema);
  return (
    mongoose.models.TrafficDiaryEntry ||
    mongoose.model<ITrafficDiaryEntry>('TrafficDiaryEntry', trafficDiarySchema)
  );
}
