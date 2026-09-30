# Shared memory rollout

1. Build in dependency order:

   ```bash
   npm run build:data-provider
   npm run build --workspace=@librechat/data-schemas
   npm run build --workspace=@librechat/api
   ```

2. Inventory each pilot tenant without writes:

   ```bash
   MONGO_URI='mongodb://…' npm run shared-memory:inventory -- --tenant=<tenantId> > shared-memory-inventory.json
   ```

   The inventory is a dry-run report and contains no memory values, so it is not a restorable backup.
   Before migration, create an encrypted MongoDB backup with the platform backup facility or run
   `mongodump --uri="$MONGO_URI" --archive=shared-memory-preflight.archive --gzip` in the protected
   service environment; never put credentials in the command or artifact name. Restrict and verify
   that backup separately. In the project UI, resolve `resolved`/`ambiguous`
   keys only by choosing one of the signed-in user's candidates. `inaccessible` means a matching
   private memory exists but its ID and author are intentionally hidden; that owner must publish it
   or an editor must create an authorized replacement. `missing` has no tenant candidate. The
   inventory script and API never guess an association.

3. Set `SHARED_MEMORY_LIBRARY_TENANTS` to the comma-separated pilot tenant IDs (`*` explicitly enables
   every tenant; empty or absent disables writes). Restart backend so
   role initialization persists `SHARED_MEMORIES` defaults and new Mongoose models/indexes load.

4. Verify locally or in staging: tenant isolation, project VIEW/EDIT, creator deletion guard,
   archive/restore conflicts, project context, import retry, CSV formula neutralization, and quota.
   Check `GET /api/projects/:projectId/shared-memories/context-status` for archived, missing,
   content-filtered, and token-limit omissions. Exercise legacy resolution through
   `POST /api/projects/:projectId/shared-memories/legacy-resolutions`; retries must return the same
   links without creating another library record.

5. Roll back writes by removing the tenant from the allowlist. Read/export/context-status endpoints
   remain available for existing data; stored data and links are preserved. Do
   not deploy an older binary that ignores existing project links; restore from backup only through
   a coordinated data operation.

## Local verification — 2026-09-16

- Built `librechat-data-provider`, `@librechat/data-schemas`, and `@librechat/api` in dependency order.
- Backend route, real ACL, and deletion-continuity suites passed: 3 suites, 46 tests.
- Typed API parser/context suites passed: 2 suites, 29 tests.
- MongoDB durability suite passed: 1 suite, 3 tests, covering tenant key isolation/new IDs,
  retry after a lost response, and survival after author deletion.
- `tsc --noEmit` passed for data-provider and data-schemas. The API typecheck reached only the
  pre-existing `src/skills/import.ts:833` `Array.at`/ES2022 target error; that file was not changed by
  this work. ESLint for the shared-memory API/router/tests and `git diff --check` passed.

This is local source/build/test evidence. No tenant was enabled, no migration was run, no production
data was read or written, and no deployment was performed. Cross-tenant A-to-B staging validation,
backup restore verification, metrics review, and production acceptance remain rollout steps.
