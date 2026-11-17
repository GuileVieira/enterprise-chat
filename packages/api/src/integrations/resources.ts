import type { IntegrationRequest } from './contracts';
import { notFound } from './contracts';

export function keyResourceIds(
  req: IntegrationRequest,
  kind: 'agentIds' | 'projectIds',
): string[] | undefined {
  return req.resourceAccess?.[kind];
}
export function assertKeyResource(
  req: IntegrationRequest,
  kind: 'agentIds' | 'projectIds',
  id: string,
): void {
  const ids = keyResourceIds(req, kind);
  if (ids && !ids.includes(id)) throw notFound();
}
export function restrictedKey(req: IntegrationRequest): boolean {
  return req.resourceAccess?.agentIds !== undefined || req.resourceAccess?.projectIds !== undefined;
}
export function keyHistoryFilter(req: IntegrationRequest): object {
  if (!restrictedKey(req)) return {};
  const conditions: object[] = [
    {
      $or: [
        { agent_id: { $exists: true, $nin: [null, ''] } },
        { projectId: { $exists: true, $nin: [null, ''] } },
      ],
    },
  ];
  for (const [kind, field] of [
    ['agentIds', 'agent_id'],
    ['projectIds', 'projectId'],
  ] as const) {
    const ids = keyResourceIds(req, kind);
    if (ids)
      conditions.push({ $or: [{ [field]: { $in: ids } }, { [field]: { $in: [null, ''] } }] });
  }
  return { $and: conditions };
}
