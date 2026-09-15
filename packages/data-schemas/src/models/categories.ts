import type { Model } from 'mongoose';
import type * as t from '~/types';
import { applyTenantIsolation } from '~/models/plugins/tenantIsolation';
import categoriesSchema from '~/schema/categories';

export function createCategoryModel(mongoose: typeof import('mongoose')): Model<t.ICategory> {
  applyTenantIsolation(categoriesSchema);
  return mongoose.models.Category || mongoose.model<t.ICategory>('Category', categoriesSchema);
}
