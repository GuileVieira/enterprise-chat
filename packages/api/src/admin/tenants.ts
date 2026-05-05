import { logger, runAsSystem } from '@librechat/data-schemas';
import type { IUser } from '@librechat/data-schemas';
import type { FilterQuery } from 'mongoose';
import type { Response } from 'express';
import type { ServerRequest } from '~/types/http';
import { parsePagination } from './pagination';

const USER_LIST_FIELDS =
  '_id name username email avatar role provider tenantId createdAt updatedAt';

export interface AdminTenantsDeps {
  findUsers: (
    searchCriteria: FilterQuery<IUser>,
    fieldsToSelect?: string | string[] | null,
    options?: { limit?: number; offset?: number; sort?: Record<string, 1 | -1> },
  ) => Promise<IUser[]>;
  countUsers: (filter?: FilterQuery<IUser>) => Promise<number>;
  countTenantEntities?: (tenantId: string, entity: string) => Promise<number>;
}

export function createAdminTenantsHandlers(deps: AdminTenantsDeps) {
  const { findUsers, countUsers } = deps;

  async function listTenantsHandler(_req: ServerRequest, res: Response) {
    try {
      const users = await runAsSystem(() =>
        findUsers({}, 'tenantId', { limit: 10000, sort: { createdAt: -1 } }),
      );
      const tenantMap = new Map<string, number>();

      for (const user of users) {
        const tid = user.tenantId ?? 'default';
        tenantMap.set(tid, (tenantMap.get(tid) ?? 0) + 1);
      }

      const tenants = Array.from(tenantMap.entries()).map(([id, userCount]) => ({
        id,
        userCount,
      }));

      return res.status(200).json({ tenants });
    } catch (error) {
      logger.error('[adminTenants] listTenants error:', error);
      return res.status(500).json({ message: 'Failed to list tenants' });
    }
  }

  async function listTenantUsersHandler(req: ServerRequest, res: Response) {
    try {
      const { tenantId } = req.params as { tenantId: string };
      const { limit, offset } = parsePagination(req.query);
      const filter = tenantId === 'default' ? { tenantId: { $exists: false } } : { tenantId };

      const [users, total] = await runAsSystem(() =>
        Promise.all([
          findUsers(filter, USER_LIST_FIELDS, { limit, offset, sort: { createdAt: -1 } }),
          countUsers(filter),
        ]),
      );

      const mapped = users.map((u) => ({
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
      logger.error('[adminTenants] listTenantUsers error:', error);
      return res.status(500).json({ message: 'Failed to list tenant users' });
    }
  }

  async function getTenantStatsHandler(req: ServerRequest, res: Response) {
    try {
      const { tenantId } = req.params as { tenantId: string };
      const filter = tenantId === 'default' ? { tenantId: { $exists: false } } : { tenantId };
      const userCount = await runAsSystem(() => countUsers(filter));

      return res.status(200).json({
        tenantId,
        stats: {
          users: userCount,
          conversations: 0,
          agents: 0,
          functions: 0,
          secrets: 0,
        },
      });
    } catch (error) {
      logger.error('[adminTenants] getTenantStats error:', error);
      return res.status(500).json({ message: 'Failed to get tenant stats' });
    }
  }

  return {
    listTenants: listTenantsHandler,
    listTenantUsers: listTenantUsersHandler,
    getTenantStats: getTenantStatsHandler,
  };
}
