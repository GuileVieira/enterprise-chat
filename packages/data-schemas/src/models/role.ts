import roleSchema from '~/schema/role';
import type { IRole } from '~/types';

export function createRoleModel(mongoose: typeof import('mongoose')) {
  return mongoose.models.Role || mongoose.model<IRole>('Role', roleSchema);
}
