import { Types } from 'mongoose';
import { SystemRoles } from 'librechat-data-provider';

import type { IUser } from '@librechat/data-schemas';

import { getTenantMemoryUserIds } from './tenant';

const user = (overrides: Partial<IUser>): IUser => {
  const _id = overrides._id ?? new Types.ObjectId();
  return {
    id: overrides.id ?? _id.toString(),
    _id,
    email: 'user@tenant.test',
    emailVerified: true,
    provider: 'local',
    ...overrides,
  } as IUser;
};

describe('getTenantMemoryUserIds', () => {
  it('loads tenant owner memories before the current user memory', async () => {
    const ownerId = new Types.ObjectId();
    const currentUser = user({ tenantId: 'tenant-a', role: SystemRoles.USER });
    const findUsers = jest.fn().mockResolvedValue([user({ _id: ownerId })]);

    await expect(getTenantMemoryUserIds(currentUser, { findUsers })).resolves.toEqual([
      ownerId.toString(),
      currentUser.id,
    ]);
    expect(findUsers).toHaveBeenCalledWith(
      { role: SystemRoles.OWNER, tenantId: 'tenant-a' },
      '_id',
    );
  });

  it('does not duplicate the current owner memory', async () => {
    const owner = user({ tenantId: 'tenant-a', role: SystemRoles.OWNER });
    const findUsers = jest.fn().mockResolvedValue([owner]);

    await expect(getTenantMemoryUserIds(owner, { findUsers })).resolves.toEqual([owner.id]);
  });
});
