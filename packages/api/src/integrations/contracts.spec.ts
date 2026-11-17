import type { IntegrationRequest } from './contracts';
import { paginate } from './contracts';
const req = (query: object = {}, id = 'one') =>
  ({
    user: { id: 'user', tenantId: 'tenant' },
    query,
    params: { id },
    route: { path: '/agents/:id/files' },
  }) as unknown as IntegrationRequest;
it('uses one comparison for sorting and seek; binds cursor to tenant, principal and resource scope', () => {
  const rows = ['a', 'Z', '-', 'A', '_', 'z'].map((id) => ({ id }));
  const output: string[] = [];
  let cursor: string | null = null;
  do {
    const page: { items: Array<{ id: string }>; nextCursor: string | null } = paginate(
      req({ limit: 1, ...(cursor ? { cursor } : {}) }),
      rows,
      (row) => row.id,
    );
    output.push(...page.items.map((row) => row.id));
    cursor = page.nextCursor;
  } while (cursor);
  expect(output).toEqual([...rows.map((row) => row.id)].sort());
  const page = paginate(req({ limit: 1 }), rows, (row) => row.id);
  expect(() => paginate(req({ cursor: page.nextCursor }, 'other'), rows, (row) => row.id)).toThrow(
    'Invalid request',
  );
  expect(() => paginate(req({ cursor: 'malformed' }), rows, (row) => row.id)).toThrow(
    'Invalid request',
  );
});
