# Orqest — Agent Guide

> Compact, high-signal facts for OpenCode sessions. If a line isn’t likely to prevent a mistake, it’s not here.

---

## Package Manager & Runtime

- **Use `npm` only.** `packageManager` is pinned to `npm@11.10.0`; `package-lock.json` is the lockfile. Do not use `pnpm` or `yarn`.
- **Node:** `v20.19.0+` or `^22.12.0` or `>= 23.0.0`.

---

## Monorepo Layout

npm workspaces with Turborepo caching.

| Path | Language | Role | Build Tool |
|---|---|---|---|
| `api/` | JS (legacy CJS) | Express backend entrypoint (`api/server/index.js`) | — |
| `packages/api/` | TS (CJS) | New backend code consumed by `api/` | Rollup |
| `packages/data-schemas/` | TS (ESM) | Mongoose models/schemas | Rollup |
| `packages/data-provider/` | TS | Shared types, endpoints, data-service | Rollup |
| `packages/client/` | TS | Shared frontend utilities | Rollup |
| `client/` | TS/React (ESM) | Vite SPA frontend | Vite |

Key dependency graph (build order):
```
data-provider → data-schemas → packages/api
                        ↘ packages/client → client
```

Quirks:
- `packages/data-provider/package.json` name is **`librechat-data-provider`** (unscoped). All other packages use `@librechat/*`.
- Keep changes in `api/` (legacy JS) to a minimum. Write new backend logic in `packages/api/` and call it from thin wrappers in `api/`.

---

## Development Commands

| Command | What it does |
|---|---|
| `npm run smart-reinstall` | Install deps (if lockfile changed) + `turbo` build |
| `npm run reinstall` | Wipe `node_modules` and full reinstall |
| `npm run backend:dev` | Start backend with nodemon (port 3080) |
| `npm run frontend:dev` | Start Vite dev server (port 3090; backend must be running) |
| `npm run build` | Build all packages via Turborepo (parallel, cached) |
| `npm run build:data-provider` | Rebuild `packages/data-provider` (rebuild this when types change) |
| `npm run frontend` | Sequential legacy build (fallback when Turbo misbehaves) |

---

## Environment & Services

- **MongoDB is required.** Copy `.env.example` → `.env`. Minimal locals:
  - `MONGO_URI=mongodb://127.0.0.1:27017/Orqest` (kept for upstream compatibility)
  - `DOMAIN_CLIENT=http://localhost:3080`
  - `DOMAIN_SERVER=http://localhost:3080`
- **Docker Compose** provides MongoDB, Meilisearch, RAG API, and pgvector. Run `docker compose up -d` if you need the full stack.
- **Test env:** copy `api/test/.env.test.example` → `api/test/.env.test`. Backend tests also need an empty `api/data/auth.json` (`mkdir -p api/data && echo '{}' > api/data/auth.json`).

---

## Lint & Format

- **ESLint flat config:** `eslint.config.mjs`. Prettier config: `.prettierrc` (`printWidth: 100`, `singleQuote: true`, `trailingComma: all`).
- Auto-fix before committing: `npm run lint:fix && npm run format`
- Husky pre-commit runs `lint-staged` (prettier --write + eslint --fix + eslint).
- **CI note:** the ESLint workflow only lints changed files under `api/` and `client/`.

---

## Type Safety

- **Never use `any`.** Explicit types for parameters, returns, and variables.
- Limit `unknown` and `Record<string, unknown>`. Prefer explicit interfaces.
- Reuse types from `packages/data-provider` instead of duplicating.
- Run per-package typechecks:
  ```bash
  npx tsc --noEmit -p packages/data-provider/tsconfig.json
  npx tsc --noEmit -p packages/data-schemas/tsconfig.json
  npx tsc --noEmit -p packages/api/tsconfig.json
  npx tsc --noEmit -p packages/client/tsconfig.json
  ```

---

## Testing

- **Framework:** Jest everywhere. Run per workspace.
- Backend unit tests: `cd api && npm run test:ci`
- Package unit tests: `cd packages/<pkg> && npm run test:ci`
- Frontend unit tests: `cd client && npm run test:ci`
- Integration tests in `packages/api`:
  - `npm run test:cache-integration` (runs core, cluster, mcp, stream)
  - `npm run test:s3-integration`
- **E2E:** Playwright configs in `e2e/`. Commands:
  - `npm run e2e` (local)
  - `npm run e2e:ci` (CI)
  - `npm run e2e:a11y`

**Testing philosophy (enforced in this repo):**
- Real logic over mocks. Use `mongodb-memory-server` for DB tests.
- Spies over mocks. Only mock external HTTP APIs or non-deterministic calls.

---

## Style & Conventions

- **File names:** single-word when possible (`service.ts`, `permissions.ts`). Use directories for context (`admin/capabilities.ts` not `adminCapabilities.ts`).
- **Imports — three sections, sorted by line length:**
  1. Package imports (shortest → longest; `react` always first).
  2. `import type { ... }` imports (longest → shortest).
  3. Local imports (longest → shortest).
- Always use standalone `import type { ... }` — never inline `type` in value imports.
- Functional first; early returns; minimal nesting. Limit looping over large arrays (e.g., messages) — consolidate passes.
- Comments: self-documenting code. JSDoc only for complex/non-obvious logic.

### Backend-specific rules
- **Do not use `Model.bulkWrite()`** in production code. Use `tenantSafeBulkWrite()` (Mongoose middleware does not intercept raw `bulkWrite`).
- **Do not use `Model.collection.*`** in production code (bypasses tenant isolation middleware).
- These are enforced by custom ESLint rules in `eslint.config.mjs`.
- **Project ACL is inherited by project files.** File access must allow `FILE VIEW` directly or `PROJECT VIEW` via `file.projectId`; never require users to own a project file when the project is tenant-shared.
- **Project context injection requires `PROJECT VIEW`.** Agents/assistants may load project instructions, memories, and files only after checking effective project permissions.
- **Mutating project contents requires project access.** Upload/link files with `projectId` only after project permission checks; reject attaching foreign file IDs or prompt groups the user cannot view.
- **Project detail and file list must follow project ACL.** `GET /api/projects/:projectId` should rely on project `VIEW` ACL, not global project feature gates after a project is already shared. `GET /api/files?projectId=...` must list files by both `file.projectId` and `project.fileIds` for legacy/linked files.

### Frontend-specific rules
- All user-facing strings must use `useLocalize()`.
- Only edit English keys: `client/src/locales/en/translation.json`.
- React Query v4 for API interactions; invalidate queries on mutations.
- Query/Mutation keys live in `packages/data-provider/src/keys.ts`.
- Endpoints: `packages/data-provider/src/api-endpoints.ts`
- Data service: `packages/data-provider/src/data-service.ts`
- **Preserve `projectId` when switching conversation setup.** Agent/model/assistant/preset/spec/URL-param flows must carry the current `conversation.projectId`; use `prepareNewConvoTemplate()` for new-conversation templates that may be trimmed for param endpoints.
- **Project chat uploads default to project storage.** If `conversation.projectId` exists and the user has `PROJECT EDIT`, uploads should send `projectId` by default; offer a local-only toggle and invalidate `DynamicQueryKeys.projectFiles(projectId)` after upload.
- **Project selector state is not project membership.** `selectedProjectId` filters the sidebar; `conversation.projectId` is the source of truth for chat context, prompt injection, upload target, and ACL inheritance.
- **ChatForm buttons must opt out of submit.** Inside `client/src/components/Chat/Input/ChatForm.tsx`, only `SendButton` should use `type="submit"`; menus, toggles, badges, uploads, prompt snippets, collapse, and action buttons must use `type="button"` to avoid accidental empty submits/regeneration.
- **Admin-disabled speech overrides local preferences.** `speechTab.speechToText=false` and `speechTab.textToSpeech=false` must hide/disable STT/TTS UI even if localStorage has user toggles enabled.

---

## CI / PR Context

- Target branches: `main`, `dev`, `dev-staging`, `release/*`.
- Backend CI pipeline: **Build packages** → typecheck + circular-deps check → unit tests (`api`, `packages/api`, `data-provider`, `data-schemas`).
- Frontend CI pipeline: **Build packages** (`data-provider`, `packages/client`) → client unit tests + Vite build verify.
- ESLint CI runs only on changed `api/**` and `client/**` files.

---

## Important Constraints

- Do not use `pnpm` or `yarn`.
- Do not add "Generated with Claude Code" or "Co-Authored-By" to commits.
- When implementing stories (bmad-dev-story), commit progress after each finished task.
- Verify build artifacts exist (`dist/`) before running tests that consume built packages.
- **New permission types** must be added to **both** the Zod schema (`packages/data-provider/src/permissions.ts`) **and** the Mongoose schema (`packages/data-schemas/src/schema/role.ts`). The `initializeRoles()` startup routine merges Zod defaults into MongoDB, but fields not declared in the Mongoose schema are silently dropped. Always rebuild `packages/data-schemas` after modifying `role.ts` and restart the backend so `initializeRoles` can patch existing roles.
