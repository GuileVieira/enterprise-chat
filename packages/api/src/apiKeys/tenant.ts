import { Types } from 'mongoose';
import { tenantStorage, SYSTEM_TENANT_ID, logger } from '@librechat/data-schemas';
import { ResourceType, PermissionBits, SystemRoles } from 'librechat-data-provider';
import type { Request, Response, NextFunction } from 'express';
import type { AllMethods, IUser } from '@librechat/data-schemas';
import type { TTenantApiCatalog } from 'librechat-data-provider';
import type { GetRemoteAgentPermissionsDeps } from './service';
import { getRemoteAgentPermissions } from './service';

type Dependencies = Pick<
  AllMethods,
  | 'findUsers'
  | 'getProjects'
  | 'getProjectById'
  | 'getAgents'
  | 'createAgentApiKey'
  | 'listTenantApiKeys'
  | 'deleteTenantApiKey'
> &
  GetRemoteAgentPermissionsDeps;

type TenantRequest = Request<{ id?: string }, object, { name?: string; projectId?: string }> & {
  user?: IUser;
  tenantApiKey?: boolean;
};

export function resolveTenantKeyManagement(
  user: Pick<IUser, 'role' | 'tenantId'> | undefined,
  requestedTenant: Request['query']['tenantId'],
): string | undefined {
  if (!user || (user.role !== SystemRoles.OWNER && user.role !== SystemRoles.ADMIN)) return;
  if (requestedTenant != null && typeof requestedTenant !== 'string') return;
  const tenantId = requestedTenant ?? user.tenantId;
  if (!tenantId || tenantId === SYSTEM_TENANT_ID || tenantId === 'default') return;
  if (user.role !== SystemRoles.ADMIN && tenantId !== user.tenantId) return;
  return tenantId;
}

export function createTenantApiHandlers(deps: Dependencies) {
  async function owner(tenantId: string): Promise<IUser | undefined> {
    const users = await deps.findUsers(
      { tenantId, role: SystemRoles.OWNER, disabled: { $ne: true } },
      null,
      { limit: 1, sort: { createdAt: 1, _id: 1 } },
    );
    return users[0];
  }

  async function catalog(user: IUser, tenantId: string): Promise<TTenantApiCatalog> {
    const userId = String(user._id);
    const [agents, projects] = await Promise.all([
      deps.getAgents({ tenantId }),
      deps.getProjects(),
    ]);
    const result: TTenantApiCatalog = { tenantId, ownerId: userId, agents: [], projects: [] };
    for (const agent of agents) {
      if (agent.tenantId !== tenantId) continue;
      const permissions = await getRemoteAgentPermissions(deps, userId, user.role, agent._id);
      if (!(permissions & PermissionBits.VIEW)) continue;
      result.agents.push({
        id: agent.id,
        name: agent.name ?? agent.id,
        description: agent.description,
        provider: agent.provider,
      });
    }
    for (const project of projects) {
      if (project.tenantId !== tenantId) continue;
      const permissions = await deps.getEffectivePermissions({
        userId,
        role: user.role,
        resourceType: ResourceType.PROJECT,
        resourceId: project._id,
      });
      if (!(permissions & PermissionBits.VIEW)) continue;
      result.projects.push({
        projectId: project.projectId,
        name: project.name,
        description: project.description,
      });
    }
    return result;
  }

  async function manage(req: TenantRequest, res: Response) {
    res.setHeader('Cache-Control', 'no-store');
    const tenantId = resolveTenantKeyManagement(req.user, req.query.tenantId);
    if (!tenantId) return res.status(403).json({ error: 'tenant_api_forbidden' });
    return tenantStorage.run({ tenantId, userId: String(req.user?._id) }, async () => {
      try {
        if (req.method === 'DELETE') {
          if (!req.params.id || !Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ error: 'invalid_key_id' });
          }
          const deleted = await deps.deleteTenantApiKey(tenantId, req.params.id);
          return res.status(deleted ? 204 : 404).end();
        }
        if (req.method === 'GET' && !req.path.endsWith('/catalog')) {
          return res.json({ keys: await deps.listTenantApiKeys(tenantId) });
        }
        const principal = await owner(tenantId);
        if (!principal) return res.status(409).json({ error: 'tenant_api_owner_required' });
        if (req.method === 'GET') return res.json(await catalog(principal, tenantId));
        const name = req.body.name;
        if (typeof name !== 'string' || !name.trim() || name.trim().length > 100) {
          return res.status(400).json({ error: 'invalid_key_name' });
        }
        const key = await deps.createAgentApiKey({
          userId: principal._id,
          tenantId,
          scope: 'tenant',
          name: name.trim(),
        });
        return res.status(201).json(key);
      } catch (error) {
        logger.error('[Tenant API] Management failed', error);
        return res.status(500).json({ error: 'tenant_api_failed' });
      }
    });
  }

  async function remoteCatalog(req: TenantRequest, res: Response) {
    res.setHeader('Cache-Control', 'no-store');
    if (!req.tenantApiKey || !req.user?.tenantId) {
      return res.status(403).json({ error: 'tenant_api_key_required' });
    }
    try {
      const result = await catalog(req.user, req.user.tenantId);
      if (req.path.endsWith('/projects')) return res.json({ data: result.projects });
      if (req.path.endsWith('/models')) {
        return res.json({
          object: 'list',
          data: result.agents.map((agent) => ({
            ...agent,
            object: 'model',
            owned_by: result.tenantId,
          })),
        });
      }
      return res.json(result);
    } catch (error) {
      logger.error('[Tenant API] Catalog failed', error);
      return res.status(500).json({ error: 'tenant_api_failed' });
    }
  }

  async function requireProjectAccess(req: TenantRequest, res: Response, next: NextFunction) {
    if (!req.tenantApiKey || req.body.projectId == null) return next();
    if (typeof req.body.projectId !== 'string' || !req.body.projectId.trim()) {
      return res.status(400).json({ error: 'invalid_project_id' });
    }
    try {
      const project = await deps.getProjectById(req.body.projectId);
      if (!project || !req.user?.tenantId || project.tenantId !== req.user.tenantId) {
        return res.status(404).json({ error: 'project_not_found' });
      }
      const permission = await deps.getEffectivePermissions({
        userId: String(req.user._id),
        role: req.user.role,
        resourceType: ResourceType.PROJECT,
        resourceId: project._id,
      });
      if (!(permission & PermissionBits.VIEW))
        return res.status(403).json({ error: 'project_access_denied' });
      return next();
    } catch (error) {
      return next(error);
    }
  }

  return { manage, remoteCatalog, requireProjectAccess };
}
