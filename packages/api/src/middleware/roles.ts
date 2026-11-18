import { SystemRoles } from 'librechat-data-provider';
import { runAsSystem } from '@librechat/data-schemas';
import type { RequestHandler, Request } from 'express';
import type { IUser } from '@librechat/data-schemas';

const systemRoles = new Set<string>(Object.values(SystemRoles));

/** Apply after MANAGE_ROLES authorization; delegated managers remain tenant-scoped. */
export function scopeRoleMutation(handler: RequestHandler): RequestHandler {
  return async (base, res, next) => {
    const user = (base as Request & { user?: Pick<IUser, 'role'> }).user;
    const roleName = String(base.params.roleName).trim().toUpperCase();
    if (!systemRoles.has(roleName)) return handler(base, res, next);
    if (user?.role !== SystemRoles.ADMIN) {
      res.status(403).json({ message: 'Only ADMIN can update global system roles' });
      return;
    }
    await runAsSystem(async () => handler(base, res, next));
  };
}
