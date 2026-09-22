import { Types } from 'mongoose';
import { ResourceType, SystemRoles, PermissionBits } from 'librechat-data-provider';
import type { AllMethods } from '@librechat/data-schemas';
import type { NextFunction, Response } from 'express';
import type { ServerRequest } from '~/types';

export type AgentPermissionsRequest = ServerRequest & {
  params: { resourceType: string; resourceId: string };
};

type Middleware = (req: AgentPermissionsRequest, res: Response, next: NextFunction) => unknown;

export function isAgentPermissionsAdmin(req: AgentPermissionsRequest): boolean {
  return req.params.resourceType === ResourceType.AGENT && req.user?.role === SystemRoles.ADMIN;
}

export function createAgentAdminPermissionAccess({
  getAgent,
  hasGlobalAgentPermission,
  fallback,
}: Pick<AllMethods, 'getAgent' | 'hasGlobalAgentPermission'> & {
  fallback: Middleware;
}): Middleware {
  return async (req, res, next) => {
    if (!isAgentPermissionsAdmin(req)) {
      return fallback(req, res, next);
    }
    const { resourceId } = req.params;
    if (!Types.ObjectId.isValid(resourceId)) {
      return res.status(404).json({ message: 'Resource not found' });
    }
    try {
      const agent = await getAgent(
        {
          _id: resourceId,
          ...(req.user?.tenantId
            ? { tenantId: req.user.tenantId }
            : { tenantId: { $exists: false } }),
        },
        '_id',
      );
      if (!agent && !(await hasGlobalAgentPermission(resourceId, PermissionBits.SHARE))) {
        return res.status(404).json({ message: 'Resource not found' });
      }
    } catch (_error) {
      return res.status(500).json({ message: 'Failed to validate resource access' });
    }
    return next();
  };
}
