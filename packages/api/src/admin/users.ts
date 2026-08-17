import { PermissionBits, PrincipalType, ResourceType, SystemRoles } from 'librechat-data-provider';
import { logger, runAsSystem, isValidObjectIdString } from '@librechat/data-schemas';
import type {
  IAclEntry,
  IAdminAudit,
  IGroup,
  IProject,
  IRole,
  ISystemGrant,
  IUser,
  AdminUserListItem,
  AdminUserSearchResult,
  UserDeleteResult,
} from '@librechat/data-schemas';
import type { FilterQuery, Types } from 'mongoose';
import type { Response } from 'express';
import type { ServerRequest } from '~/types/http';
import { parsePagination } from './pagination';

const MAX_SEARCH_LENGTH = 200;

const USER_LIST_FIELDS =
  '_id name username email avatar role provider tenantId disabled createdAt updatedAt';

type Principal = { principalType: PrincipalType; principalId?: string | Types.ObjectId };

export interface AdminUsersDeps {
  findUsers: (
    searchCriteria: FilterQuery<IUser>,
    fieldsToSelect?: string | string[] | null,
    options?: { limit?: number; offset?: number; sort?: Record<string, 1 | -1> },
  ) => Promise<IUser[]>;
  countUsers: (filter?: FilterQuery<IUser>) => Promise<number>;
  updateUser: (userId: string, updateData: Partial<IUser>) => Promise<IUser | null>;
  deleteUser: (req: ServerRequest, userId: string) => Promise<UserDeleteResult>;
  getRoleByName: (roleName: string) => Promise<IRole | null>;
  getUserPrincipals: (params: { userId: string; role?: string | null }) => Promise<Principal[]>;
  getCapabilitiesForPrincipals: (params: {
    principals: Array<{ principalType: PrincipalType; principalId: string | Types.ObjectId }>;
    tenantId?: string;
  }) => Promise<ISystemGrant[]>;
  findEntriesByPrincipal: (
    principalType: string,
    principalId: string | Types.ObjectId,
    resourceType?: string,
  ) => Promise<IAclEntry[]>;
  findProjectsByObjectIds: (
    ids: Array<string | Types.ObjectId>,
  ) => Promise<Array<IProject & { _id: Types.ObjectId }>>;
  getProjects: () => Promise<Array<IProject & { _id: Types.ObjectId }>>;
  getUserGroups: (userId: string) => Promise<IGroup[]>;
  listAdminAudits: (userId: string, limit?: number) => Promise<IAdminAudit[]>;
  recordAdminAudit: (input: {
    tenantId?: string;
    actorId: string;
    targetUserId: string;
    action: string;
    before?: Record<string, unknown>;
    after?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
  }) => Promise<IAdminAudit>;
  deleteAllUserSessions: (userId: string) => Promise<{ deletedCount?: number }>;
  removeUserFromAllGroups: (userId: string) => Promise<void>;
  deleteAclEntries: (filter: Record<string, unknown>) => Promise<unknown>;
  removeUserFromTenant: (userId: string) => Promise<IUser | null>;
  getProjectById: (projectId: string) => Promise<(IProject & { _id: Types.ObjectId }) | null>;
  grantPermission: (
    principalType: string,
    principalId: string,
    resourceType: string,
    resourceId: string | Types.ObjectId,
    permBits: number,
    grantedBy: string,
  ) => Promise<IAclEntry | null>;
  revokePermission: (
    principalType: string,
    principalId: string,
    resourceType: string,
    resourceId: string | Types.ObjectId,
  ) => Promise<unknown>;
}

export function createAdminUsersHandlers(deps: AdminUsersDeps) {
  const { findUsers, countUsers, updateUser, deleteUser } = deps;

  const actorId = (req: ServerRequest) => req.user?._id?.toString() ?? req.user?.id ?? '';

  async function findTarget(id: string) {
    const [user] = await findUsers(
      { _id: id },
      '_id name username email avatar role provider tenantId disabled createdAt updatedAt',
      { limit: 1 },
    );
    return user ?? null;
  }

  async function recordChange(
    req: ServerRequest,
    target: IUser,
    action: string,
    before?: Record<string, unknown>,
    after?: Record<string, unknown>,
    metadata?: Record<string, unknown>,
  ) {
    await deps.recordAdminAudit({
      actorId: actorId(req),
      targetUserId: target._id.toString(),
      tenantId: target.tenantId,
      action,
      before,
      after,
      metadata,
    });
  }

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
        disabled: u.disabled ?? false,
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

      const targetUser = await runAsSystem(() => findTarget(id));
      if (!targetUser) {
        return res.status(404).json({ error: 'User not found' });
      }
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

      await runAsSystem(() =>
        recordChange(req, targetUser, 'user.deleted', {
          name: targetUser.name,
          email: targetUser.email,
          role: targetUser.role,
          tenantId: targetUser.tenantId,
        }),
      );

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

      const body = req.body as { name?: unknown; role?: unknown; disabled?: unknown };
      const target = await runAsSystem(() => findTarget(id));
      if (!target) {
        return res.status(404).json({ error: 'User not found' });
      }
      const update: Partial<IUser> = {};
      if (body.name !== undefined) {
        if (typeof body.name !== 'string' || !body.name.trim()) {
          return res.status(400).json({ error: 'Name cannot be empty' });
        }
        if (body.name.trim().length > MAX_SEARCH_LENGTH) {
          return res
            .status(400)
            .json({ error: `Name must not exceed ${MAX_SEARCH_LENGTH} characters` });
        }
        update.name = body.name.trim();
      }
      if (body.role !== undefined) {
        if (
          typeof body.role !== 'string' ||
          !(await runAsSystem(() => deps.getRoleByName(body.role as string)))
        ) {
          return res.status(400).json({ error: 'Invalid role' });
        }
        update.role = body.role;
      }
      if (body.disabled !== undefined) {
        if (typeof body.disabled !== 'boolean') {
          return res.status(400).json({ error: 'Disabled must be a boolean' });
        }
        update.disabled = body.disabled;
      }
      if (Object.keys(update).length === 0) {
        return res.status(400).json({ error: 'No supported changes provided' });
      }
      const caller = actorId(req);
      if (
        caller === id &&
        (update.disabled === true || (update.role && update.role !== target.role))
      ) {
        return res.status(403).json({ error: 'Cannot disable or change your own role' });
      }
      if (target.role === SystemRoles.ADMIN && update.role && update.role !== SystemRoles.ADMIN) {
        if ((await countUsers({ role: SystemRoles.ADMIN })) <= 1) {
          return res.status(400).json({ error: 'Cannot demote the last admin user' });
        }
      }

      const user = await runAsSystem(async () => {
        const updated = await updateUser(id, update);
        if (updated && update.disabled === true) {
          await deps.deleteAllUserSessions(id);
        }
        if (updated) {
          await recordChange(
            req,
            target,
            'user.updated',
            { name: target.name, role: target.role, disabled: target.disabled ?? false },
            { name: updated.name, role: updated.role, disabled: updated.disabled ?? false },
          );
        }
        return updated;
      });
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      return res.status(200).json({ user });
    } catch (error) {
      logger.error('[adminUsers] updateUser error:', error);
      return res.status(500).json({ error: 'Failed to update user' });
    }
  }

  async function getUserHandler(req: ServerRequest, res: Response) {
    try {
      const { id } = req.params as { id: string };
      if (!isValidObjectIdString(id)) {
        return res.status(400).json({ error: 'Invalid user ID format' });
      }
      const detail = await runAsSystem(async () => {
        const user = await findTarget(id);
        if (!user) return null;
        const [principals, groups, audits, role] = await Promise.all([
          deps.getUserPrincipals({ userId: id, role: user.role }),
          deps.getUserGroups(id),
          deps.listAdminAudits(id),
          user.role ? deps.getRoleByName(user.role) : Promise.resolve(null),
        ]);
        const grants = await deps.getCapabilitiesForPrincipals({
          principals: principals.filter(
            (p): p is Principal & { principalId: string | Types.ObjectId } => p.principalId != null,
          ),
          tenantId: user.tenantId,
        });
        const entries = (
          await Promise.all(
            principals
              .filter((p) => p.principalId != null)
              .map((p) =>
                deps.findEntriesByPrincipal(p.principalType, p.principalId!, ResourceType.PROJECT),
              ),
          )
        ).flat();
        const projectIds = [...new Set(entries.map((entry) => entry.resourceId.toString()))];
        const [projects, allProjects] = await Promise.all([
          deps.findProjectsByObjectIds(projectIds),
          deps.getProjects(),
        ]);
        return {
          user,
          permissions: role
            ? Object.entries(role.permissions).flatMap(([area, values]) =>
                Object.entries(values ?? {})
                  .filter(([, enabled]) => enabled === true)
                  .map(([permission]) => `${area}.${permission}`),
              )
            : [],
          capabilities: [...new Set(grants.map((grant) => grant.capability))].sort(),
          groups: groups.map((group) => ({ id: group._id.toString(), name: group.name })),
          projects: projects.map((project) => ({
            id: project._id.toString(),
            projectId: project.projectId,
            name: project.name,
            permissions: entries
              .filter((entry) => entry.resourceId.toString() === project._id.toString())
              .reduce((bits, entry) => bits | entry.permBits, 0),
            direct: entries.some(
              (entry) =>
                entry.resourceId.toString() === project._id.toString() &&
                entry.principalType === PrincipalType.USER,
            ),
          })),
          availableProjects: allProjects
            .filter((project) => project.tenantId === user.tenantId)
            .map((project) => ({
              id: project._id.toString(),
              projectId: project.projectId,
              name: project.name,
            })),
          audits,
        };
      });
      return detail
        ? res.status(200).json(detail)
        : res.status(404).json({ error: 'User not found' });
    } catch (error) {
      logger.error('[adminUsers] getUser error:', error);
      return res.status(500).json({ error: 'Failed to get user' });
    }
  }

  async function removeFromTenantHandler(req: ServerRequest, res: Response) {
    try {
      const { id } = req.params as { id: string };
      if (!isValidObjectIdString(id))
        return res.status(400).json({ error: 'Invalid user ID format' });
      if (actorId(req) === id)
        return res.status(403).json({ error: 'Cannot remove yourself from the organization' });
      const target = await runAsSystem(() => findTarget(id));
      if (!target) return res.status(404).json({ error: 'User not found' });
      if (!target.tenantId)
        return res.status(400).json({ error: 'User is not in an organization' });
      if (
        target.role === SystemRoles.ADMIN &&
        (await countUsers({ role: SystemRoles.ADMIN })) <= 1
      ) {
        return res.status(400).json({ error: 'Cannot remove the last admin from an organization' });
      }
      const updated = await runAsSystem(async () => {
        await Promise.all([
          deps.deleteAllUserSessions(id),
          deps.removeUserFromAllGroups(id),
          deps.deleteAclEntries({ principalType: PrincipalType.USER, principalId: target._id }),
        ]);
        let result = await deps.removeUserFromTenant(id);
        if (result && target.role === SystemRoles.ADMIN) {
          result = await updateUser(id, { role: SystemRoles.USER });
        }
        if (result)
          await recordChange(
            req,
            target,
            'user.organization_removed',
            { tenantId: target.tenantId },
            {},
          );
        return result;
      });
      return res.status(200).json({ user: updated });
    } catch (error) {
      logger.error('[adminUsers] removeFromTenant error:', error);
      return res.status(500).json({ error: 'Failed to remove user from organization' });
    }
  }

  async function setProjectAccessHandler(req: ServerRequest, res: Response) {
    try {
      const { id, projectId } = req.params as { id: string; projectId: string };
      if (!isValidObjectIdString(id))
        return res.status(400).json({ error: 'Invalid user ID format' });
      const target = await runAsSystem(() => findTarget(id));
      if (!target) return res.status(404).json({ error: 'User not found' });
      const project = await runAsSystem(() => deps.getProjectById(projectId));
      if (!project) return res.status(404).json({ error: 'Project not found' });
      if (target.tenantId !== project.tenantId)
        return res
          .status(400)
          .json({ error: 'User and project must belong to the same organization' });
      await runAsSystem(async () => {
        const directEntries = await deps.findEntriesByPrincipal(
          PrincipalType.USER,
          id,
          ResourceType.PROJECT,
        );
        const existingBits = directEntries.find(
          (entry) => entry.resourceId.toString() === project._id.toString(),
        )?.permBits;
        await deps.grantPermission(
          PrincipalType.USER,
          id,
          ResourceType.PROJECT,
          project._id,
          (existingBits ?? 0) | PermissionBits.VIEW,
          actorId(req),
        );
        await recordChange(req, target, 'user.project_access_granted', undefined, undefined, {
          projectId,
        });
      });
      return res.status(200).json({ message: 'Project access granted' });
    } catch (error) {
      logger.error('[adminUsers] setProjectAccess error:', error);
      return res.status(500).json({ error: 'Failed to grant project access' });
    }
  }

  async function removeProjectAccessHandler(req: ServerRequest, res: Response) {
    try {
      const { id, projectId } = req.params as { id: string; projectId: string };
      if (!isValidObjectIdString(id))
        return res.status(400).json({ error: 'Invalid user ID format' });
      const target = await runAsSystem(() => findTarget(id));
      if (!target) return res.status(404).json({ error: 'User not found' });
      const project = await runAsSystem(() => deps.getProjectById(projectId));
      if (!project) return res.status(404).json({ error: 'Project not found' });
      await runAsSystem(async () => {
        await deps.revokePermission(PrincipalType.USER, id, ResourceType.PROJECT, project._id);
        await recordChange(req, target, 'user.project_access_revoked', undefined, undefined, {
          projectId,
        });
      });
      return res.status(200).json({ message: 'Direct project access revoked' });
    } catch (error) {
      logger.error('[adminUsers] removeProjectAccess error:', error);
      return res.status(500).json({ error: 'Failed to revoke project access' });
    }
  }

  return {
    listUsers: listUsersHandler,
    searchUsers: searchUsersHandler,
    getUser: getUserHandler,
    updateUser: updateUserHandler,
    removeFromTenant: removeFromTenantHandler,
    setProjectAccess: setProjectAccessHandler,
    removeProjectAccess: removeProjectAccessHandler,
    deleteUser: deleteUserHandler,
  };
}
