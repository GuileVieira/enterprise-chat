import categoriesSchema from '~/schema/categories';
import { applyTenantIsolation } from '~/models/plugins/tenantIsolation';
import type * as t from '~/types';

export function createCategoryModel(mongoose: typeof import('mongoose')) {
  applyTenantIsolation(categoriesSchema);
  return mongoose.models.Category || mongoose.model<t.ICategory>('Category', categoriesSchema);
}
