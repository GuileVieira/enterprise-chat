import { SystemRoles } from 'librechat-data-provider';
import { logger, runAsSystem, isValidObjectIdString } from '@librechat/data-schemas';
import type {
  IUser,
  AdminUserListItem,
  AdminUserSearchResult,
  UserDeleteResult,
} from '@librechat/data-schemas';
import type { FilterQuery } from 'mongoose';
import type { Response } from 'express';
import type { ServerRequest } from '~/types/http';
import { parsePagination } from './pagination';

const MAX_SEARCH_LENGTH = 200;

const USER_LIST_FIELDS =
  '_id name username email avatar role provider tenantId createdAt updatedAt';

export interface AdminUsersDeps {
  findUsers: (
    searchCriteria: FilterQuery<IUser>,
    fieldsToSelect?: string | string[] | null,
    options?: { limit?: number; offset?: number; sort?: Record<string, 1 | -1> },
  ) => Promise<IUser[]>;
  countUsers: (filter?: FilterQuery<IUser>) => Promise<number>;
  updateUser: (userId: string, updateData: Partial<IUser>) => Promise<IUser | null>;
  deleteUser: (req: ServerRequest, userId: string) => Promise<UserDeleteResult>;
}

export function createAdminUsersHandlers(deps: AdminUsersDeps) {
  const { findUsers, countUsers, updateUser, deleteUser } = deps;

  async function listUsersHandler(req: ServerRequest, res: Response) {
    try {
      const { limit, offset } = parsePagination(req.query);
      const [users, total] = await runAsSystem(() =>
        Promise.all([
          findUsers({}, USER_LIST_FIELDS, { limit, offset, sort: { createdAt: -1 } }),
          countUsers(),
        ]),
      );

      const mapped: AdminUserListItem[] = users.map((u) => ({
        id: u._id?.toString() ?? '',
        _id: u._id?.toString() ?? '',
        name: u.name ?? '',
        username: u.username ?? '',
        email: u.email ?? '',
        avatar: u.avatar ?? '',
        role: u.role ?? 'USER',
        provider: u.provider ?? 'local',
        tenantId: u.tenantId,
        createdAt: u.createdAt?.toISOString(),
        updatedAt: u.updatedAt?.toISOString(),
      }));

      return res.status(200).json({ users: mapped, total, limit, offset });
    } catch (error) {
      logger.error('[adminUsers] listUsers error:', error);
      return res.status(500).json({ error: 'Failed to list users' });
    }
  }

  async function searchUsersHandler(req: ServerRequest, res: Response) {
    try {
      const rawQ = req.query.q;
      const rawLimit = req.query.limit;
      const query = typeof rawQ === 'string' ? rawQ : undefined;
      const limitStr = typeof rawLimit === 'string' ? rawLimit : '20';
      const trimmed = query?.trim() ?? '';

      if (!trimmed) {
        return res.status(400).json({ error: 'Query parameter "q" is required' });
      }

      if (trimmed.length < 2) {
        return res.status(400).json({ error: 'Query must be at least 2 characters' });
      }

      if (trimmed.length > MAX_SEARCH_LENGTH) {
        return res
          .status(400)
          .json({ error: `Query must not exceed ${MAX_SEARCH_LENGTH} characters` });
      }

      const searchLimit = Math.min(Math.max(1, parseInt(limitStr, 10) || 20), 50);
      const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`^${escaped}`, 'i');

      const users = await runAsSystem(() =>
        findUsers(
          { $or: [{ name: regex }, { email: regex }, { username: regex }] },
          '_id name email username avatar tenantId',
          { limit: searchLimit, sort: { name: 1 } },
        ),
      );

      const results: AdminUserSearchResult[] = users.map((u) => ({
        id: u._id?.toString() ?? '',
        _id: u._id?.toString() ?? '',
        name: u.name ?? '',
        email: u.email ?? '',
        username: u.username,
        avatarUrl: u.avatar,
        tenantId: u.tenantId,
      }));

      return res
        .status(200)
        .json({ users: results, total: results.length, capped: results.length >= searchLimit });
    } catch (error) {
      logger.error('[adminUsers] searchUsers error:', error);
      return res.status(500).json({ error: 'Failed to search users' });
    }
  }

  async function deleteUserHandler(req: ServerRequest, res: Response) {
    try {
      const { id } = req.params as { id: string };

      if (!isValidObjectIdString(id)) {
        return res.status(400).json({ error: 'Invalid user ID format' });
      }

      const callerId = req.user?._id?.toString() ?? req.user?.id;
      if (callerId === id) {
        return res.status(403).json({ error: 'Cannot delete your own account' });
      }

      const [targetUser] = await findUsers({ _id: id }, 'role', { limit: 1 });
      if (targetUser?.role === SystemRoles.ADMIN) {
        const adminCount = await countUsers({ role: SystemRoles.ADMIN });
        if (adminCount <= 1) {
          return res.status(400).json({ error: 'Cannot delete the last admin user' });
        }
      }

      const result = await deleteUser(req, id);

      if (result.deletedCount === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      if (targetUser?.role === SystemRoles.ADMIN) {
        const remaining = await countUsers({ role: SystemRoles.ADMIN });
        if (remaining === 0) {
          logger.error(
            `[adminUsers] CRITICAL: last admin deleted via race condition, user: ${id}. ` +
              'Manual DB intervention required to restore an ADMIN user.',
          );
        }
      }

      return res.status(200).json({ message: result.message || 'User deleted successfully' });
    } catch (error) {
      logger.error('[adminUsers] deleteUser error:', error);
      return res.status(500).json({ error: 'Failed to delete user' });
    }
  }

  async function updateUserHandler(req: ServerRequest, res: Response) {
    try {
      const { id } = req.params as { id: string };
      if (!isValidObjectIdString(id)) {
        return res.status(400).json({ error: 'Invalid user ID format' });
      }

      const { name: rawName } = req.body as { name?: unknown };
      if (typeof rawName !== 'string') {
        return res.status(400).json({ error: 'Name is required' });
      }
      const name = rawName.trim();
      if (!name) {
        return res.status(400).json({ error: 'Name cannot be empty' });
      }
      if (name.length > MAX_SEARCH_LENGTH) {
        return res
          .status(400)
          .json({ error: `Name must not exceed ${MAX_SEARCH_LENGTH} characters` });
      }

      const user = await runAsSystem(() => updateUser(id, { name }));
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      return res.status(200).json({ user });
    } catch (error) {
      logger.error('[adminUsers] updateUser error:', error);
      return res.status(500).json({ error: 'Failed to update user' });
    }
  }

  return {
    listUsers: listUsersHandler,
    searchUsers: searchUsersHandler,
    updateUser: updateUserHandler,
    deleteUser: deleteUserHandler,
  };
}
