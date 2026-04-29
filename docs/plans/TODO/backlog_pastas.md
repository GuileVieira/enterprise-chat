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

## Epic 1: Foundation — Schema, Métodos e Rotas Base

**Objetivo**: Project existe como entidade persistida. Conversas podem ter `projectId`. API expõe CRUD de projects e filtro de conversas por project.

---

### Story 1.1: Project Schema & Model

**Critérios de Aceitação**:
- Schema `project` criado com todos os campos necessários.
- Schema exportado e registrado nos índices de models.
- `projectId` adicionado ao schema `conversation`.

**PR 1.1.1 — Schema e Tipos**

| Arquivo | Ação |
|---|---|
| `packages/data-schemas/src/schema/project.ts` | Criar schema `IProject` com: `projectId`, `name`, `description`, `user`, `tenantId`, `endpoint`, `model`, `instructions`, `memories`, `memoryKeys`, `promptSnippets`, `promptGroupIds`, `fileIds`, `isArchived`, `iconURL`, `accessLevel`, timestamps |
| `packages/data-schemas/src/schema/convo.ts` | Adicionar `projectId: { type: String, index: true, meiliIndex: true }` |
| `packages/data-schemas/src/types/project.ts` | Criar interface `IProject` (novo arquivo) |
| `packages/data-schemas/src/schema/index.ts` | Exportar `projectSchema` |
| `packages/data-schemas/src/models/index.ts` | Registrar model `Project` via `createModels` |
| `packages/data-schemas/src/types/convo.ts` | Adicionar `projectId?: string` em `IConversation` |

**PR 1.1.2 — Métodos de DB**

| Arquivo | Ação |
|---|---|
| `packages/data-schemas/src/methods/project.ts` | Criar `createProjectMethods` com: `getProjects`, `getProjectById`, `createProject`, `updateProject`, `deleteProject`, `getProjectsByUser`, `archiveProject` |
| `packages/data-schemas/src/methods/index.ts` | Importar e espalhar `createProjectMethods` no retorno de `createMethods` |
| `packages/data-schemas/src/methods/conversation.ts` | Atualizar `getConvosByCursor` para aceitar `projectId?: string` no options e filtrar `{ projectId }` |
| `packages/data-schemas/src/methods/conversation.ts` | Atualizar `saveConvo` para aceitar e persistir `projectId` |

---

### Story 1.2: API Routes — Projects

**Critérios de Aceitação**:
- Rotas REST para CRUD de projects.
- Rota de conversas atualizada para aceitar `projectId` query param.

**PR 1.2.1 — Rotas de Project**

| Arquivo | Ação |
|---|---|
| `api/server/routes/projects.js` | Criar router Express: `GET /`, `POST /`, `GET /:projectId`, `PUT /:projectId`, `DELETE /:projectId`, `PUT /:projectId/archive`. Usar `requireJwtAuth`. Chamar métodos de `db` (expostos via `~/models`) |
| `api/server/routes/index.js` (ou onde o app registra rotas) | Registrar `app.use('/api/projects', require('./routes/projects'))` |

**PR 1.2.2 — Rotas de Conversa com Project Filter**

| Arquivo | Ação |
|---|---|
| `api/server/routes/convos.js` | Em `router.get('/')`, extrair `req.query.projectId` e passar para `db.getConvosByCursor` |
| `api/server/routes/convos.js` | Em `router.post('/update')` e `router.post('/archive')`, permitir atualização de `projectId` no payload |

---

### Story 1.3: Data Provider — Types, Endpoints, Hooks

**Critérios de Aceitação**:
- Tipos Zod e TS para Project no `data-provider`.
- Endpoints definidos.
- Hooks de React Query para listar, criar, editar, deletar projects.

**PR 1.3.1 — Types e Endpoints**

| Arquivo | Ação |
|---|---|
| `packages/data-provider/src/schemas.ts` | Adicionar `projectSchema`, `createProjectRequestSchema`, `updateProjectRequestSchema` |
| `packages/data-provider/src/types/queries.ts` | Adicionar `projectId?: string` em `ConversationListParams`. Criar `ProjectListParams`, `ProjectListResponse` |
| `packages/data-provider/src/types/index.ts` | Exportar tipos de project |
| `packages/data-provider/src/api-endpoints.ts` | Adicionar `projectsRoot`, `projects()`, `projectById(id)`, `archiveProject(id)` |
| `packages/data-provider/src/keys.ts` | Adicionar `projects = 'projects'`, `project = 'project'` em `QueryKeys` |
| `packages/data-provider/src/data-service.ts` | Adicionar `getProjects()`, `getProjectById(id)`, `createProject(payload)`, `updateProject(id, payload)`, `deleteProject(id)`, `archiveProject(id)` |

**PR 1.3.2 — React Query Hooks**

| Arquivo | Ação |
|---|---|
| `client/src/data-provider/queries.ts` | Adicionar `useProjectsQuery()`, `useProjectByIdQuery(id)` |
| `client/src/data-provider/mutations.ts` | Adicionar `useCreateProjectMutation()`, `useUpdateProjectMutation()`, `useDeleteProjectMutation()`, `useArchiveProjectMutation()` |
| `client/src/data-provider/mutations.ts` | Atualizar `useUpdateConversationMutation` para invalidar `QueryKeys.projects` quando `projectId` muda |

---

## Epic 2: System Prompt Injection

**Objetivo**: Instruções do projeto (`project.instructions`) são injetadas como system prompt em toda conversa dentro do projeto. Merge com instruções existentes da conversa/preset.

**Dependência**: Epic 1 concluído.

---

### Story 2.1: Carregar Project no Início da Conversa

**Critérios de Aceitação**:
- Quando uma conversa tem `projectId`, o backend carrega o project e o disponibiliza no contexto da requisição.

**PR 2.1.1 — Middleware de Project Context**

| Arquivo | Ação |
|---|---|
| `packages/api/src/utils/projectContext.ts` | Criar função `loadProjectContext(userId, projectId)` que busca project e retorna dados normalizados |
| `api/server/middleware/projectContext.js` | Criar middleware `projectContext` que, se `req.body.projectId` ou `req.params.projectId` existir, carrega o project e anexa em `req.project` |

---

### Story 2.2: Regular Endpoints

**Critérios de Aceitação**:
- `project.instructions` é prependado ao `promptPrefix` da conversa para endpoints regulares (OpenAI, Anthropic, Google, etc.).

**PR 2.2.1 — LLM Utils**

| Arquivo | Ação |
|---|---|
| `packages/api/src/utils/llm.ts` | Atualizar `extractLibreChatParams` ou função de build de mensagens para receber `projectInstructions` e prepend no `promptPrefix` |
| `api/server/services/Endpoints/*/build.js` (ou equivalente) | Garantir que `project` está disponível no `req` e passado para utils |

---

### Story 2.3: Assistants (OpenAI / Azure)

**Critérios de Aceitação**:
- `project.instructions` é mergeado em `additional_instructions` do Run.

**PR 2.3.1 — Assistant Controllers**

| Arquivo | Ação |
|---|---|
| `api/server/services/createRunBody.js` | Aceitar `projectInstructions` no payload e concatenar com `additional_instructions` |
| `api/server/controllers/assistants/chatV1.js` | Carregar project se `conversation.projectId` existir, passar `projectInstructions` para `createRunBody` |
| `api/server/controllers/assistants/chatV2.js` | Mesmo que acima |

---

### Story 2.4: Agents

**Critérios de Aceitação**:
- `project.instructions` é mergeado nas instruções do agente.

**PR 2.4.1 — Agent Loaders**

| Arquivo | Ação |
|---|---|
| `packages/api/src/agents/load.ts` | Se `req.body.projectId`, carregar project e merge `project.instructions` em `req.body.promptPrefix` |
| `api/server/controllers/agents/client.js` | Garantir que `projectInstructions` é considerado no `buildMessages` |

---

## Epic 3: Project Memories & Prompts

**Objetivo**: Projetos têm memórias próprias + referenciam memórias do usuário. Projetos têm prompt snippets rápidos + referenciam Prompt Groups existentes.

**Dependência**: Epic 1 concluído.

---

### Story 3.1: Project Memories

**Critérios de Aceitação**:
- Campo `memories` no project (array de key/value).
- Campo `memoryKeys` referencia memórias globais do usuário.
- Ambos são injetados no contexto da conversa como texto adicional nas instruções.

**PR 3.1.1 — Backend Memory Merge**

| Arquivo | Ação |
|---|---|
| `packages/api/src/utils/projectContext.ts` | Expandir para buscar memórias do usuário por `memoryKeys` e concatenar com `project.memories`. Retornar `fullContext: string` |
| `packages/api/src/utils/llm.ts` | Usar `fullContext` do project ao invés de apenas `project.instructions` |

**PR 3.1.2 — Frontend Memory Editor**

| Arquivo | Ação |
|---|---|
| `client/src/components/Project/ProjectMemoryEditor.tsx` | Criar componente para editar `memories` e selecionar `memoryKeys` do usuário |

---

### Story 3.2: Project Prompts

**Critérios de Aceitação**:
- `promptSnippets` (título + conteúdo) no project.
- `promptGroupIds` referencia Prompt Groups existentes.
- Snippets aparecem como quick-actions no chat input quando dentro de um project.

**PR 3.2.1 — Backend**

| Arquivo | Ação |
|---|---|
| `packages/data-schemas/src/methods/project.ts` | Garantir que `promptSnippets` e `promptGroupIds` são persistidos e retornados |

**PR 3.2.2 — Frontend Prompt Snippets**

| Arquivo | Ação |
|---|---|
| `client/src/components/Project/ProjectPromptEditor.tsx` | Criar editor de snippets e selector de Prompt Groups |
| `client/src/components/Chat/Input/ChatForm.tsx` | Se conversa tem `projectId`, renderizar botões de quick-prompt com snippets do project |

---

## Epic 4: Project Files

**Objetivo**: Arquivos podem ser anexados ao projeto e são implicitamente disponíveis em todas as conversas do projeto.

**Dependência**: Epic 1 concluído.

---

### Story 4.1: File Schema & Upload

**Critérios de Aceitação**:
- Files aceitam `projectId` no schema/métodos.
- Upload de arquivo pode ser feito no contexto de um projeto.

**PR 4.1.1 — DB & Upload**

| Arquivo | Ação |
|---|---|
| `packages/data-schemas/src/schema/file.ts` | Adicionar `projectId?: string` (se schema separado existir; se não, verificar onde File é definido) |
| `packages/data-schemas/src/methods/file.ts` | Atualizar `createFile`, `getFiles`, `deleteFile` para suportar `projectId` |
| `api/server/routes/files/files.js` | Aceitar `projectId` no body de upload. Retornar files por projeto |

---

### Story 4.2: Inject Project Files into Conversation

**Critérios de Aceitação**:
- Ao iniciar uma conversa em um projeto, os `fileIds` do projeto são incluídos no contexto.

**PR 4.2.1 — Endpoint Initializers**

| Arquivo | Ação |
|---|---|
| `packages/api/src/utils/projectContext.ts` | Incluir `project.fileIds` no retorno |
| `api/server/controllers/agents/client.js` | Merge `project.fileIds` com `req.body.files` |
| `api/server/controllers/assistants/chatV1.js` | Anexar `project.fileIds` ao thread |
| `packages/api/src/utils/llm.ts` | Incluir files do project como message parts para endpoints regulares |

---

## Epic 5: Sharing & Permissions

**Objetivo**: Projetos podem ser privados, públicos (dentro do tenant) ou compartilhados com usuários/grupos específicos via ACL (mesmo padrão de Agents).

**Dependência**: Epic 1 concluído.

---

### Story 5.1: ACL Resource Type

**Critérios de Aceitação**:
- `PROJECT` adicionado a `ResourceType`.
- Roles de acesso para project criados.

**PR 5.1.1 — Permission Types**

| Arquivo | Ação |
|---|---|
| `packages/data-provider/src/accessPermissions.ts` | Adicionar `PROJECT = 'project'` em `ResourceType` |
| `packages/data-provider/src/accessPermissions.ts` | Adicionar `PROJECT_VIEWER`, `PROJECT_EDITOR`, `PROJECT_OWNER` em `AccessRoleIds` |
| `packages/data-provider/src/accessPermissions.ts` | Atualizar `accessRoleToPermBits` para projects |
| `packages/data-schemas/src/schema/accessRole.ts` | Adicionar `'project'` ao enum de resourceType |

---

### Story 5.2: Permission Middleware & Frontend

**Critérios de Aceitação**:
- Rotas de project verificam permissões.
- Frontend esconde/mostra UI baseado em permissões.

**PR 5.2.1 — Backend Middleware**

| Arquivo | Ação |
|---|---|
| `api/server/routes/projects.js` | Adicionar `generateCheckAccess` middleware nas rotas de mutação (`POST`, `PUT`, `DELETE`) |
| `api/server/routes/projects.js` | Em `GET /`, retornar apenas projects que o usuário tem acesso (próprios + compartilhados via ACL) |

**PR 5.2.2 — Frontend Permissions**

| Arquivo | Ação |
|---|---|
| `client/src/hooks/useProjectPermissions.ts` | Criar hook que retorna `{ canEdit, canDelete, canShare }` baseado no project e ACL |
| `client/src/components/Project/ProjectDetail.tsx` | Usar hook para condicionalmente renderizar botões de editar/deletar/compartilhar |

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
