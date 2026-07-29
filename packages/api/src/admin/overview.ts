import { SystemRoles } from 'librechat-data-provider';
import { logger, runAsSystem } from '@librechat/data-schemas';
import type { IConfig, ITenantFunction, ITenantSecret, IUser } from '@librechat/data-schemas';
import type { FilterQuery } from 'mongoose';
import type { Response } from 'express';
import type { ServerRequest } from '~/types/http';

const RECENT_USER_FIELDS =
  '_id name username email avatar role provider tenantId createdAt updatedAt';
const TENANT_USER_LIMIT = 10000;

export interface AdminOverviewDeps {
  findUsers: (
    searchCriteria: FilterQuery<IUser>,
    fieldsToSelect?: string | string[] | null,
    options?: { limit?: number; offset?: number; sort?: Record<string, 1 | -1> },
  ) => Promise<IUser[]>;
  countUsers: (filter?: FilterQuery<IUser>) => Promise<number>;
  countRoles: () => Promise<number>;
  countGroups: () => Promise<number>;
  listAllConfigs: (filter?: { isActive?: boolean }) => Promise<IConfig[]>;
  countTenantFunctions: (filter?: FilterQuery<ITenantFunction>) => Promise<number>;
  countTenantSecrets: (filter?: FilterQuery<ITenantSecret>) => Promise<number>;
}

export function createAdminOverviewHandlers(deps: AdminOverviewDeps) {
  const {
    findUsers,
    countUsers,
    countRoles,
    countGroups,
    listAllConfigs,
    countTenantFunctions,
    countTenantSecrets,
  } = deps;

  async function getOverviewHandler(_req: ServerRequest, res: Response) {
    try {
      const [
        usersTotal,
        adminsTotal,
        rolesTotal,
        groupsTotal,
        configs,
        activeConfigs,
        functionsTotal,
        activeFunctionsTotal,
        secretsTotal,
        recentUsers,
        tenantUsers,
      ] = await runAsSystem(() =>
        Promise.all([
          countUsers(),
          countUsers({ role: SystemRoles.ADMIN }),
          countRoles(),
          countGroups(),
          listAllConfigs(),
          listAllConfigs({ isActive: true }),
          countTenantFunctions(),
          countTenantFunctions({ isActive: true }),
          countTenantSecrets(),
          findUsers({}, RECENT_USER_FIELDS, { limit: 5, sort: { createdAt: -1 } }),
          findUsers({}, 'tenantId', { limit: TENANT_USER_LIMIT, sort: { createdAt: -1 } }),
        ]),
      );

      const tenantMap = new Map<string, number>();
      for (const user of tenantUsers) {
        const tenantId = user.tenantId ?? 'default';
        tenantMap.set(tenantId, (tenantMap.get(tenantId) ?? 0) + 1);
      }

      const topTenants = Array.from(tenantMap.entries())
        .map(([id, userCount]) => ({ id, userCount }))
        .sort((a, b) => b.userCount - a.userCount)
        .slice(0, 5);

      const mappedRecentUsers = recentUsers.map((user: IUser) => ({
        id: user._id?.toString() ?? '',
        _id: user._id?.toString() ?? '',
        name: user.name ?? '',
        username: user.username ?? '',
        email: user.email ?? '',
        avatar: user.avatar ?? '',
        role: user.role ?? SystemRoles.USER,
        provider: user.provider ?? 'local',
        tenantId: user.tenantId,
        createdAt: user.createdAt?.toISOString(),
        updatedAt: user.updatedAt?.toISOString(),
      }));

      return res.status(200).json({
        usersTotal,
        adminsTotal,
        tenantsTotal: tenantMap.size,
        rolesTotal,
        groupsTotal,
        configOverridesTotal: configs.length,
        activeConfigOverridesTotal: activeConfigs.length,
        functionsTotal,
        activeFunctionsTotal,
        secretsTotal,
        topTenants,
        recentUsers: mappedRecentUsers,
      });
    } catch (error) {
      logger.error('[adminOverview] getOverview error:', error);
      return res.status(500).json({ message: 'Failed to get admin overview' });
    }
  }

  return {
    getOverview: getOverviewHandler,
  };
}
