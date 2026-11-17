import type { TApiKeyResources } from 'librechat-data-provider';
import { z } from 'zod';
import { createHash } from 'crypto';
import { isContentFilterError } from '../middleware/contentFilter';
import type { Request, Response, RequestHandler } from 'express';
import type { IUser } from '@librechat/data-schemas';
import type { ServerRequest } from '~/types';

export interface IntegrationIdentity {
  method: 'tenant_api_key' | 'oidc_m2m';
  principalId: string;
  tenantId: string;
  keyId?: string;
  resourceAccess?: TApiKeyResources;
}
export type IntegrationRequest = Request &
  Pick<ServerRequest, 'config'> & {
    user: IUser;
    integrationAuth?: IntegrationIdentity;
    resourceAccess?: TApiKeyResources;
  };
export class IntegrationError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
export const notFound = (): IntegrationError =>
  new IntegrationError(404, 'not_found', 'Resource not found');
export const forbidden = (): IntegrationError =>
  new IntegrationError(403, 'permission_denied', 'Access denied');
export const invalid = (): IntegrationError =>
  new IntegrationError(400, 'invalid_request', 'Invalid request');
export function integrationHandler(
  fn: (req: IntegrationRequest) => Promise<object>,
): RequestHandler {
  return async (req, res: Response) => {
    try {
      res.json(await fn(req as IntegrationRequest));
    } catch (error) {
      let failure = new IntegrationError(500, 'internal_error', 'Request failed');
      if (error instanceof IntegrationError) failure = error;
      else if (isContentFilterError(error))
        failure = new IntegrationError(
          403,
          'content_filtered',
          'Content blocked by current policy',
        );
      res.status(failure.status).json({ error: { code: failure.code, message: failure.message } });
    }
  };
}
const pageSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().min(1).max(2048).optional(),
});
const cursorSchema = z.object({ scope: z.string(), after: z.string().max(512) }).strict();
export function fingerprint(value: object): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}
export function paginationCursor(
  req: IntegrationRequest,
  selection: object = {},
): { limit: number; after?: string; scope: string } {
  const parsed = pageSchema.safeParse(req.query);
  if (!parsed.success) throw invalid();
  const scope = fingerprint({
    tenant: req.user.tenantId,
    principal: req.user.id,
    route: req.route?.path,
    params: req.params,
    selection,
  });
  let after: string | undefined;
  if (parsed.data.cursor) {
    try {
      const cursor = cursorSchema.parse(
        JSON.parse(Buffer.from(parsed.data.cursor, 'base64url').toString()),
      );
      if (cursor.scope !== scope) throw invalid();
      after = cursor.after;
    } catch {
      throw invalid();
    }
  }
  return { limit: parsed.data.limit, after, scope };
}
export function paginate<T>(
  req: IntegrationRequest,
  rows: T[],
  key: (row: T) => string,
  selection: object = {},
): { items: T[]; nextCursor: string | null } {
  const { limit, after, scope } = paginationCursor(req, selection);
  const sorted = [...rows].sort((a, b) => {
    if (key(a) < key(b)) return -1;
    return key(a) > key(b) ? 1 : 0;
  });
  const filtered = after === undefined ? sorted : sorted.filter((row) => key(row) > after);
  const items = filtered.slice(0, limit);
  const nextCursor =
    filtered.length > items.length && items.length
      ? Buffer.from(
          JSON.stringify({
            scope,
            after: key(items[items.length - 1]),
          }),
        ).toString('base64url')
      : null;
  return { items, nextCursor };
}
export function assertQuery(req: IntegrationRequest, allowed: string[] = []): void {
  if (Object.keys(req.query).some((key) => !['limit', 'cursor', ...allowed].includes(key)))
    throw invalid();
}
export function scalar(value: unknown): string | undefined {
  if (value === undefined) return;
  if (typeof value !== 'string' || !value.trim() || value.length > 512) throw invalid();
  return value;
}
