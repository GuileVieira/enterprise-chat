# Backlog — Projects Feature

> Organização de conversas em containers persistentes com instruções customizadas, memórias, prompts/skills e arquivos compartilhados. Paridade com ChatGPT/Claude Projects.

---

## Convenções

- **Backend logic novo** vai em `packages/api/` ou `packages/data-schemas/src/methods/`. Wrappers de rotas em `api/server/routes/` são finos.
- **Não usar `any`** em TypeScript.
- **Não usar `Model.bulkWrite()`** — usar `tenantSafeBulkWrite()`.
- **Não usar `Model.collection.*`**.
- **Frontend**: strings via `useLocalize()`, editar apenas `client/src/locales/en/translation.json`.
- **React Query v4**: keys em `packages/data-provider/src/keys.ts`, endpoints em `api-endpoints.ts`, data-service em `data-service.ts`.
- **Commits** após cada story finalizada (regra `bmad-dev-story`).
- **Build order** para PRs cross-package: `data-provider` → `data-schemas` → `packages/api` → `client`.

---

## Dependências Globais

```
Epic 1 (Foundation)
  ├── Epic 2 (System Prompt)
  ├── Epic 3 (Memories & Prompts)
  ├── Epic 4 (Files)
  ├── Epic 5 (Sharing)
  ├── Epic 6 (Frontend UI)
  └── Epic 7 (Conversation Integration)
       └── Epic 8 (Search)
            └── Epic 9 (Testing)
```

---

## Epic 1: Foundation — Schema, Métodos e Rotas Base ✅

**Objetivo**: Project existe como entidade persistida. Conversas podem ter `projectId`. API expõe CRUD de projects e filtro de conversas por project.

**Status**: Completo — 4 commits. Build passando. 1367 tests (`data-schemas`) + 985 tests (`data-provider`) + 13 route tests (`api`).

---

### Story 1.1: Project Schema & Model ✅

**Critérios de Aceitação**:
- Schema `project` criado com todos os campos necessários.
- Schema exportado e registrado nos índices de models.
- `projectId` adicionado ao schema `conversation`.

**Arquivos modificados**:
- `packages/data-schemas/src/schema/project.ts` — Schema `IProject` com todos os campos
- `packages/data-schemas/src/schema/convo.ts` — `projectId` adicionado
- `packages/data-schemas/src/types/project.ts` — Interface `IProject`
- `packages/data-schemas/src/schema/index.ts` — Export
- `packages/data-schemas/src/models/index.ts` — Registro do model
- `packages/data-schemas/src/types/convo.ts` — `projectId?: string` em `IConversation`

**Nota**: Bug pré-existente em `tenantFunctionSchema` (`default: undefined` em schema nested) foi corrigido — bloqueava todos os testes de DB methods.

---

### Story 1.2: API Routes — Projects ✅

**Critérios de Aceitação**:
- Rotas REST para CRUD de projects.
- Rota de conversas atualizada para aceitar `projectId` query param.

**Arquivos modificados**:
- `api/server/routes/projects.js` — Router Express com 6 rotas (`GET /`, `POST /`, `GET /:projectId`, `PUT /:projectId`, `DELETE /:projectId`, `PUT /:projectId/archive`)
- `api/server/routes/index.js` — Registro da rota
- `api/server/routes/convos.js` — `projectId` query param e persistência em update/archive

---

### Story 1.3: Data Provider — Types, Endpoints, Hooks ✅

**Critérios de Aceitação**:
- Tipos Zod e TS para Project no `data-provider`.
- Endpoints definidos.
- Hooks de React Query para listar, criar, editar, deletar projects.

**Arquivos modificados**:
- `packages/data-provider/src/schemas.ts` — `projectSchema`, `createProjectRequestSchema`, `updateProjectRequestSchema`, `TProject`
- `packages/data-provider/src/types/queries.ts` — `ProjectListParams`, `ProjectListResponse`
- `packages/data-provider/src/api-endpoints.ts` — `/api/projects` endpoints
- `packages/data-provider/src/keys.ts` — `QueryKeys.projects`, `QueryKeys.project`
- `packages/data-provider/src/data-service.ts` — Project service methods
- `client/src/data-provider/queries.ts` — `useProjectsQuery`, `useProjectByIdQuery`, `useConversationsInfiniteQuery` com `projectId`
- `client/src/data-provider/mutations.ts` — `useCreateProjectMutation`, `useUpdateProjectMutation`, `useDeleteProjectMutation`, `useArchiveProjectMutation`

---

## Epic 2: System Prompt Injection ✅

**Objetivo**: Instruções do projeto (`project.instructions`) são injetadas como system prompt em toda conversa dentro do projeto. Merge com instruções existentes da conversa/preset.

**Dependência**: Epic 1 concluído.

**Status**: Completo — 1 commit. 3 caminhos de injeção implementados. Token counting ajustado. Build e lint passando.

---

### Story 2.1: Shared Util — `loadProjectInstructions` ✅

**Arquivos**:
- `packages/api/src/utils/projectContext.ts` — `loadProjectInstructions(getProjectById, userId, projectId)` → `string | null`
- `packages/api/src/utils/index.ts` — Export

---

### Story 2.2: Agents + Regular Endpoints ✅

**Implementação**: Regular endpoints convergem com Agents neste fork (ephemeral agents). Injeção feita diretamente em `primaryAgent.instructions` antes de `initializeAgent()`.

**Arquivos**:
- `api/server/services/Endpoints/agents/initialize.js` — Após resolver `conversationId`, busca `conversation.projectId` → `db.getProjectById()` → prepend em `primaryAgent.instructions`

---

### Story 2.3: Assistants v1 + v2 ✅

**Implementação**: `createRunBody.js` modificado para aceitar `projectInstructions`. Controllers carregam instructions antes de chamar `createRunBody`. Token counting ajustado para incluir `projectInstructions`.

**Arquivos**:
- `api/server/services/createRunBody.js` — Aceita `projectInstructions?: string`; prepend em `systemInstructions` antes de `promptPrefix`
- `api/server/controllers/assistants/chatV1.js` — Carrega `projectInstructions` via `getConvo` + `getProjectById`; passa para `createRunBody`; inclui em `countTokens()`
- `api/server/controllers/assistants/chatV2.js` — Mesmo padrão de v1

**Risco mitigado**: Token count em `checkBalanceBeforeRun` agora inclui `projectInstructions` para não subestimar custo.

---

## Epic 3: Project Memories & Prompts ✅

**Objetivo**: Projetos têm memórias próprias + referenciam memórias do usuário. Projetos têm prompt snippets rápidos + referenciam Prompt Groups existentes.

**Dependência**: Epic 1 concluído.

**Status**: 100% completo — 5 stories, 5 commits.

---

### Story 3.1: Project Memories — Backend ✅

**Arquivos**:
- `packages/api/src/utils/projectContext.ts` — `loadProjectMemories()` formata `project.memories` + resolve `memoryKeys` via getter
- `packages/api/src/utils/projectContext.spec.ts` — 8 unit tests

---

### Story 3.2: Inject Project Memories nos 3 caminhos ✅

**Arquivos**:
- `api/server/services/Endpoints/agents/initialize.js` — Prepend instructions + memories em ordem correta
- `api/server/services/createRunBody.js` — Aceita `projectMemories`; posiciona após instructions e antes de prefix
- `api/server/controllers/assistants/chatV1.js` / `chatV2.js` — Carregam memories, passam para `createRunBody`, incluem em `countTokens`
- `api/server/services/Endpoints/agents/initialize.spec.js` — 3 novos tests (embedded, merged, user refs)
- `api/server/services/createRunBody.spec.js` — 3 novos tests (ordering)

---

### Story 3.3: Persistência de promptSnippets ✅

**Verificação**: Schema Zod (`packages/data-provider/src/schemas.ts`) e métodos DB (`packages/data-schemas/src/methods/project.ts`) já suportam `promptSnippets` e `promptGroupIds`. Nenhuma alteração necessária.

---

### Story 3.4: Prompt Snippets — Frontend Chips ✅

**Arquivos**:
- `client/src/components/Chat/Input/ProjectPromptSnippets.tsx` — Chips horizontais acima do textarea
- `client/src/components/Chat/Input/ChatForm.tsx` — Integração condicional via `useProjectByIdQuery`

---

### Story 3.5: Prompt Groups Tab no Project Detail ✅

**Arquivos**:
- `client/src/routes/index.tsx` — Rota `/projects/:projectId`
- `client/src/components/Project/ProjectDetailPage.tsx` — Página com tabs (Conversations, Prompts, Memories, Settings)
- `client/src/components/Project/ProjectPromptGroups.tsx` — Lista de Prompt Groups associados com cards
- `client/src/locales/en/translation.json` — Strings i18n
|---|---|
| `client/src/components/Project/ProjectPromptEditor.tsx` | Criar editor de snippets e selector de Prompt Groups |
| `client/src/components/Chat/Input/ChatForm.tsx` | Se conversa tem `projectId`, renderizar botões de quick-prompt com snippets do project |

---

## Epic 4: Project Files ✅

**Objetivo**: Arquivos podem ser anexados ao projeto e são implicitamente disponíveis em todas as conversas do projeto.

**Dependência**: Epic 1 concluído.

**Status**: 100% completo — 2 stories, 2 commits.

---

### Story 4.1: File Schema & Upload ✅

**Arquivos**:
- `packages/data-schemas/src/schema/file.ts` — `projectId` field (indexed)
- `packages/data-schemas/src/types/file.ts` — `projectId?: string`
- `packages/data-schemas/src/methods/file.ts` — `getFilesByProjectId()`
- `packages/data-schemas/src/methods/project.ts` — `addProjectFileId()` / `removeProjectFileId()` (atomic $addToSet/$pull)
- `api/server/routes/files/files.js` — `GET /files?projectId=` + `POST /files` accepts `projectId`
- `api/server/services/Files/process.js` — `maybeLinkFileToProject()` helper; passes `projectId` to `db.createFile()` in all upload flows
- Data Provider — `projectFiles` endpoint, `QueryKeys.projectFiles`, `getProjectFiles()`, `useGetProjectFiles()`
- `client/src/components/Project/ProjectDetailPage.tsx` — Files tab
- `client/src/locales/en/translation.json` — i18n strings

---

### Story 4.2: Inject Project Files into Conversation ✅

**Arquivos**:
- `packages/api/src/utils/projectContext.ts` — `loadProjectFileIds()` with optional DB validation callback
- `api/server/services/Endpoints/agents/initialize.js` — Merges project files into `requestFiles` before `initializeAgent`
- `api/server/controllers/assistants/chatV1.js` — Loads `projectFileIds` in project context block, merges into `attachedFileIds`
- `api/server/controllers/assistants/chatV2.js` — Same pattern as v1

---

## Epic 5: Sharing & Permissions ✅

**Objetivo**: Projetos podem ser privados, públicos (dentro do tenant) ou compartilhados com usuários/grupos específicos via ACL (mesmo padrão de Agents).

**Dependência**: Epic 1 concluído.

**Status**: 100% completo — 2 stories, 2 commits.

---

### Story 5.1: ACL Resource Type ✅

**Arquivos**:
- `packages/data-provider/src/accessPermissions.ts` — `PROJECT` em `ResourceType`; `PROJECT_VIEWER/EDITOR/OWNER` em `AccessRoleIds`; cases em `accessRoleToPermBits`
- `packages/data-provider/src/permissions.ts` — `PermissionTypes.PROJECTS`; `projectPermissionsSchema` (USE, CREATE, SHARE, SHARE_PUBLIC)
- `packages/data-schemas/src/methods/accessRole.ts` — `PROJECT_*` roles em `seedDefaultRoles()`
- `packages/data-provider/src/roles.ts` — `projects` permissions em ADMIN e USER role defaults
- `client/src/hooks/Sharing/useCanSharePublic.ts` — Map `ResourceType.PROJECT` → `PermissionTypes.PROJECTS`

---

### Story 5.2: Permission Middleware & Frontend ✅

**Arquivos**:
- `packages/data-schemas/src/methods/project.ts` — `findProjectById()` para ACL idResolver
- `api/server/middleware/accessResources/canAccessProject.js` — Wrapper `canAccessProjectResource` (pattern: `canAccessAgentResource`)
- `api/server/routes/projects.js` — ACL middlewares em todas as rotas; `GET /` retorna own + shared via `findAccessibleResources`; `POST /` cria ACL owner; `DELETE /` limpa ACL entries
- `api/server/routes/accessPermissions.js` — Branch `PROJECT` em `checkResourcePermissionAccess`
- `client/src/hooks/useProjectPermissions.ts` — Hook `useProjectPermissions(projectId)` retorna `{ canView, canEdit, canDelete, canShare }`
- `client/src/components/Project/ProjectDetailPage.tsx` — Badges de editor/owner baseados em permissões

---

## Epic 6: Frontend — Project Management UI

**Objetivo**: Páginas/modais para criar, editar, visualizar e gerenciar projects. Aba separada para detalhes do projeto.

**Dependência**: Epic 1 e Epic 5 (parcial).

---

### Story 6.1: Navigation & Project List

**Critérios de Aceitação**:
- Link "Projects" no side nav.
- Página/lista de projects do usuário.
- Botão "New Project".

**PR 6.1.1 — Navigation & Routing**

| Arquivo | Ação |
|---|---|
| `client/src/hooks/Nav/useSideNavLinks.ts` | Adicionar link "Projects" com ícone |
| `client/src/routes/` (ou equivalente) | Adicionar rota `/projects` e `/projects/:projectId` |
| `client/src/components/Project/ProjectsList.tsx` | Criar lista de projects com nome, descrição, ícone, contador de conversas |
| `client/src/components/Project/NewProjectButton.tsx` | Botão flutuante ou header para criar project |

---

### Story 6.2: Project Detail Page

**Critérios de Aceitação**:
- Página `/projects/:projectId` com visão geral.
- Tabs/seções: Conversas, Memórias, Prompts, Arquivos, Configurações.

**PR 6.2.1 — Project Detail Layout**

| Arquivo | Ação |
|---|---|
| `client/src/components/Project/ProjectDetail.tsx` | Layout com header (nome, ícone, descrição) e tabs |
| `client/src/components/Project/ProjectConversationsTab.tsx` | Lista de conversas do project (reutilizar `Conversations` ou `useConversationsInfiniteQuery` com `projectId`) |
| `client/src/components/Project/ProjectSettingsTab.tsx` | Form para editar nome, descrição, endpoint, model, instruções |

**PR 6.2.2 — Project Editors**

| Arquivo | Ação |
|---|---|
| `client/src/components/Project/ProjectMemoryEditor.tsx` | Editor de memórias do project |
| `client/src/components/Project/ProjectPromptEditor.tsx` | Editor de snippets e selector de Prompt Groups |
| `client/src/components/Project/ProjectFileManager.tsx` | Upload e lista de arquivos do project |

---

### Story 6.3: Create/Edit Project Modal

**Critérios de Aceitação**:
- Modal ou página para criar novo project.
- Campos: nome, descrição, instruções, endpoint/model default.

**PR 6.3.1 — Create Project**

| Arquivo | Ação |
|---|---|
| `client/src/components/Project/CreateProjectModal.tsx` | Modal com formulário usando `useCreateProjectMutation` |
| `client/src/components/Project/EditProjectModal.tsx` | Modal reutilizável para edição usando `useUpdateProjectMutation` |

---

## Epic 7: Frontend — Conversation Integration

**Objetivo**: Conversas dentro de um project herdam config e exibem contexto do project. Sidebar filtra por project.

**Dependência**: Epic 1 e Epic 6.

---

### Story 7.1: Conversation Filtering by Project

**Critérios de Aceitação**:
- Sidebar mostra conversas filtradas pelo project selecionado.
- Indicador visual de que uma conversa pertence a um project.

**PR 7.1.1 — Sidebar Project Filter**

| Arquivo | Ação |
|---|---|
| `client/src/components/UnifiedSidebar/ConversationsSection.tsx` | Adicionar `ProjectSelector` dropdown acima da search bar. Passar `projectId` para `useConversationsInfiniteQuery` |
| `client/src/components/Conversations/Convo.tsx` | Se `conversation.projectId`, mostrar badge ou ícone pequeno indicando project |
| `client/src/components/Nav/Bookmarks/BookmarkNav.tsx` | Ajustar layout se necessário para acomodar ProjectSelector |

---

### Story 7.2: New Conversation in Project

**Critérios de Aceitação**:
- Quando dentro de um project, "New Chat" cria conversa com `projectId` e herda endpoint/model/instruções.

**PR 7.2.1 — New Conversation Logic**

| Arquivo | Ação |
|---|---|
| `client/src/hooks/useNewConvo.ts` | `newConversation` aceita `projectId?`. Se presente, busca project e merge `endpoint`, `model`, `instructions` no `defaultConvo` |
| `client/src/utils/buildDefaultConvo.ts` | Aceitar `project` parameter e aplicar defaults do project antes de localStorage |
| `client/src/components/Nav/NewChat.tsx` | Se um project está selecionado no contexto global, passar `projectId` para `newConversation` |

---

### Story 7.3: Move Conversation to Project

**Critérios de Aceitação**:
- Ação no menu de contexto da conversa para mover para outro project.

**PR 7.3.1 — Move Action**

| Arquivo | Ação |
|---|---|
| `client/src/components/Conversations/ConvoOptions.tsx` | Adicionar item "Move to Project" que abre selector de projects |
| `client/src/data-provider/mutations.ts` | Mutation `useMoveConversationToProjectMutation` que chama `updateConversation` com novo `projectId` |

---

## Epic 8: Search & Indexing

**Objetivo**: MeiliSearch indexa `projectId` nas conversas. Busca pode ser filtrada por project.

**Dependência**: Epic 1 concluído.

---

### Story 8.1: MeiliSearch Integration

**Critérios de Aceitação**:
- `projectId` é filterable no MeiliSearch.
- Conversas existentes são re-indexadas (via migration ou startup sync).

**PR 8.1.1 — Meili Config & Sync**

| Arquivo | Ação |
|---|---|
| `packages/data-schemas/src/models/plugins/mongoMeili.ts` | Adicionar `projectId` em `filterableAttributes` (linha ~623) |
| `packages/data-schemas/src/migrations/projectIndexes.ts` | Criar migration que: (1) cria índice `projectId` em `conversations`, (2) dispara `syncWithMeili` para re-indexar |
| `packages/data-schemas/src/migrations/index.ts` (se existir) | Registrar nova migration |

---

## Epic 9: Testing & QA

**Objetivo**: Testes cobrem CRUD de projects, injeção de instruções, filtro de conversas, e UI.

**Dependência**: Todos os epics anteriores.

---

### Story 9.1: Backend Tests

**PR 9.1.1 — Project Methods Unit Tests**

| Arquivo | Ação |
|---|---|
| `packages/data-schemas/src/methods/project.spec.ts` | Testes para `createProject`, `getProjects`, `updateProject`, `deleteProject` usando `mongodb-memory-server` |

**PR 9.1.2 — API Route Tests**

| Arquivo | Ação |
|---|---|
| `api/server/routes/__tests__/projects.spec.js` | Testes para rotas de project: CRUD, autenticação, filtro por `projectId` em `/api/convos` |

**PR 9.1.3 — System Prompt Injection Tests**

| Arquivo | Ação |
|---|---|
| `packages/api/src/utils/llm.spec.ts` | Testar merge de `projectInstructions` com `promptPrefix` |
| `api/server/controllers/assistants/chatV1.spec.js` (se existir) | Testar que `additional_instructions` inclui project |

---

### Story 9.2: Frontend Tests

**PR 9.2.1 — Component Tests**

| Arquivo | Ação |
|---|---|
| `client/src/components/Project/ProjectsList.spec.tsx` | Testar renderização de lista, empty state, click em project |
| `client/src/components/Project/ProjectDetail.spec.tsx` | Testar tabs, renderização de dados |
| `client/src/components/Project/CreateProjectModal.spec.tsx` | Testar criação com formulário válido/inválido |

---

### Story 9.3: i18n & E2E

**PR 9.3.1 — i18n**

| Arquivo | Ação |
|---|---|
| `client/src/locales/en/translation.json` | Adicionar todas as chaves: `com_ui_projects`, `com_ui_new_project`, `com_ui_project_instructions`, `com_ui_project_memories`, `com_ui_project_prompts`, `com_ui_project_files`, `com_ui_move_to_project`, etc. |

**PR 9.3.2 — E2E Tests**

| Arquivo | Ação |
|---|---|
| `e2e/projects.spec.ts` | Teste E2E: criar project, nova conversa no project, verificar instruções injetadas, mover conversa |

---

## Estimativa Resumida

| Epic | Estimativa | Risco Principal |
|---|---|---|
| 1. Foundation | 3-4 dias | — |
| 2. System Prompt | 4-6 dias | Regressão em endpoints existentes |
| 3. Memories & Prompts | 3-4 dias | Merge de contexto pode exceder token limit |
| 4. Files | 2-3 dias | Ciclo de vida de files ao deletar project |
| 5. Sharing | 3-4 dias | ACL queries podem ser lentas |
| 6. Frontend UI | 4-5 dias | Design de tabs e layout |
| 7. Conversation Integration | 3-4 dias | `useNewConvo` hook é complexo |
| 8. Search | 1-2 dias | Re-indexação em deploy |
| 9. Testing | 3-4 dias | — |
| **Total** | **~26-36 dias úteis** (~5-7 semanas) | |

---

## Ordem de Implementação Recomendada

1. **Epic 1** inteiro (Foundation)
2. **Epic 6** parcial — apenas lista e criação de project (para ter UI mínima)
3. **Epic 7** parcial — filtro de conversas por project
4. **Epic 2** — System prompt injection
5. **Epic 3** — Memories & Prompts
6. **Epic 4** — Files
7. **Epic 5** — Sharing
8. **Epic 6** completo — Detail page, tabs, editores
9. **Epic 8** — Search
10. **Epic 9** — Testing

> **Nota**: Após cada story/PR, rodar `npm run lint:fix && npm run format` e `npm run build` antes de commit.
