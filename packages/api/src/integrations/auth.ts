import type { RequestHandler } from 'express';
import type { AgentManagementAuthDeps } from '../middleware/management';
import type { ApiKeyAuthDependencies, ApiKeyAuthRequest } from '../apiKeys/middleware';
import type { IntegrationRequest } from './contracts';
import { createAgentManagementAuth } from '../middleware/management';
import { createRequireApiKeyAuth } from '../apiKeys/middleware';
import { extractBearerToken } from '../auth/oidc';

export type IntegrationAuthDeps = AgentManagementAuthDeps & ApiKeyAuthDependencies;
export function createIntegrationAuth(deps: IntegrationAuthDeps): RequestHandler {
  const apiKey = createRequireApiKeyAuth({ ...deps, allowRestrictedKeys: true });
  const management = createAgentManagementAuth(deps);
  return async (base, res, next) => {
    const req = base as IntegrationRequest & ApiKeyAuthRequest;
    const token = extractBearerToken(req.headers.authorization);
    if (!token) {
      res.status(401).json({ error: { code: 'unauthorized', message: 'Unauthorized' } });
      return;
    }
    const keyMethod = token.startsWith('sk-');
    const requestedTenant = req.headers['x-tenant-id'];
    const authenticated: RequestHandler = async (_request, _response, _next) => {
      try {
        if (
          !req.user?.id ||
          !req.user.tenantId ||
          req.user.disabled === true ||
          (keyMethod && req.tenantApiKey !== true)
        ) {
          res.status(401).json({ error: { code: 'unauthorized', message: 'Unauthorized' } });
          return;
        }
        if (
          (requestedTenant !== undefined && requestedTenant !== req.user.tenantId) ||
          (req.body?.tenantId !== undefined && req.body.tenantId !== req.user.tenantId) ||
          (req.query.tenantId !== undefined && req.query.tenantId !== req.user.tenantId)
        ) {
          res
            .status(403)
            .json({ error: { code: 'tenant_conflict', message: 'Conflicting tenant' } });
          return;
        }
        const config = await deps.getAppConfig({
          tenantId: req.user.tenantId,
          userId: req.user.id,
          role: req.user.role,
          idOnTheSource: req.user.idOnTheSource,
        });
        if (keyMethod && config.endpoints?.agents?.remoteApi?.auth?.apiKey?.enabled === false) {
          res
            .status(403)
            .json({ error: { code: 'api_keys_disabled', message: 'API keys disabled' } });
          return;
        }
        req.config = config;
        req.integrationAuth = {
          method: keyMethod ? 'tenant_api_key' : 'oidc_m2m',
          principalId: req.user.id,
          ...(req.resourceAccess ? { resourceAccess: req.resourceAccess } : {}),
          tenantId: req.user.tenantId,
          ...(keyMethod ? { keyId: req.apiKeyId?.toString() } : {}),
        };
        next();
      } catch {
        res.status(500).json({ error: { code: 'internal_error', message: 'Request failed' } });
      }
    };
    await (keyMethod ? apiKey : management)(req, res, (error) =>
      error ? next(error) : authenticated(req, res, next),
    );
  };
}
