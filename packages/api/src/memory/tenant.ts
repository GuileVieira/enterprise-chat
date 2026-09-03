import { SystemRoles } from 'librechat-data-provider';

import type { IUser } from '@librechat/data-schemas';
import type { FilterQuery } from 'mongoose';

interface TenantMemoryDeps {
  findUsers: (filter: FilterQuery<IUser>, projection: string) => Promise<IUser[]>;
}

export async function getTenantMemoryUserIds(
  user: IUser,
  { findUsers }: TenantMemoryDeps,
): Promise<string[]> {
  const userId = String(user.id);
  if (!user.tenantId) {
    return [userId];
  }

  const owners = await findUsers({ role: SystemRoles.OWNER, tenantId: user.tenantId }, '_id');
  return [...new Set([...owners.map((owner) => String(owner._id)), userId])];
}
