# Workflows Visuais em Orqest

## Resumo

Criar `Workflow` como feature first-class, sem transformar `Skill`/`PromptGroup` em engine.

Workflow sera um grafo visual simples capaz de chamar:

- `skill`
- `agent`
- `workflow`

V1 deve ser conservador: editor visual DAG, sem loops, sem tools diretas, sem scheduler, sem marketplace, sem webhook e sem execucao paralela avancada.

Skills e agentes existentes devem continuar intactos. O objetivo e adicionar uma camada nova de orquestracao, nao mudar o comportamento atual.

## Decisao de Arquitetura

Nao implementar Workflow como "skill especial".

Separacao correta:

- `Skill` / `PromptGroup`: capacidade atomica baseada em prompt.
- `Agent`: ator com tools, memoria, configuracao e handoffs.
- `Workflow`: grafo/orquestrador que referencia skills, agents e outros workflows.

O Workflow pode ter texto orientando "quando chamar o que", mas essa descricao deve ser metadata planner-facing. A definicao executavel precisa ser estruturada para permitir validacao, permissao, logs e debug.

## Modelo de Dados

Adicionar entidade `Workflow`, separada de `PromptGroup`.

Campos base:

```ts
type Workflow = {
  _id: string;
  name: string;
  description?: string;
  category?: string;
  status: 'draft' | 'published' | 'archived';
  version: number;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  inputSchema?: WorkflowSchema;
  outputSchema?: WorkflowSchema;
  author: string;
  authorName: string;
  tenantId?: string;
  createdAt?: Date;
  updatedAt?: Date;
};
```

Nodes suportados no V1:

```ts
type WorkflowNode =
  | {
      id: string;
      type: 'skill';
      refId: string;
      label: string;
      when?: string;
      position?: { x: number; y: number };
    }
  | {
      id: string;
      type: 'agent';
      refId: string;
      label: string;
      when?: string;
      position?: { x: number; y: number };
    }
  | {
      id: string;
      type: 'workflow';
      refId: string;
      label: string;
      when?: string;
      position?: { x: number; y: number };
    };
```

Edges:

```ts
type WorkflowEdge = {
  id: string;
  source: string;
  target: string;
  label?: string;
};
```

Criar `WorkflowVersion` para publicar snapshots imutaveis:

```ts
type WorkflowVersion = {
  _id: string;
  workflowId: string;
  version: number;
  name: string;
  description?: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  inputSchema?: WorkflowSchema;
  outputSchema?: WorkflowSchema;
  author: string;
  tenantId?: string;
  createdAt?: Date;
};
```

Runs sempre executam uma versao publicada. Nunca executar draft mutavel.

## Logs e Auditoria

Logs bem feitos entram desde o inicio.

Criar `WorkflowRun`:

```ts
type WorkflowRun = {
  _id: string;
  workflowId: string;
  workflowVersionId: string;
  version: number;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  userId: string;
  tenantId?: string;
  inputSummary?: string;
  outputSummary?: string;
  error?: WorkflowRunError;
  startedAt?: Date;
  completedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
};
```

Criar `WorkflowStepRun`:

```ts
type WorkflowStepRun = {
  _id: string;
  workflowRunId: string;
  workflowId: string;
  workflowVersionId: string;
  nodeId: string;
  nodeType: 'skill' | 'agent' | 'workflow';
  refId: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'skipped';
  inputSummary?: string;
  outputSummary?: string;
  error?: WorkflowRunError;
  tokenCount?: number;
  cost?: number;
  startedAt?: Date;
  completedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
};
```

Erro estruturado:

```ts
type WorkflowRunError = {
  code: string;
  message: string;
  retryable?: boolean;
  details?: string;
};
```

Logs estruturados de aplicacao devem sempre incluir, quando existir:

- `workflowId`
- `workflowVersionId`
- `workflowRunId`
- `stepRunId`
- `nodeId`
- `nodeType`
- `refId`
- `userId`
- `tenantId`
- `status`

Eventos obrigatorios:

- draft criado
- draft editado
- publish iniciado
- publish concluido
- publish falhou
- run iniciado
- run concluido
- run falhou
- run cancelado
- step iniciado
- step concluido
- step falhou
- step pulado
- permissao negada
- ref inexistente
- ciclo detectado
- depth maximo excedido

Nao salvar conteudo sensivel completo por padrao. Salvar resumo/truncado e referencias. O sistema deve permitir responder: "por que esse agente/skill/workflow foi chamado?"

## Backend

Adicionar CRUD/list/detail/publish para Workflow.

Endpoints esperados:

```txt
GET    /api/workflows
POST   /api/workflows
GET    /api/workflows/:id
PATCH  /api/workflows/:id
DELETE /api/workflows/:id
POST   /api/workflows/:id/publish
GET    /api/workflows/:id/versions
GET    /api/workflows/runs/:runId
```

Se o padrao local exigir outro prefixo, seguir o padrao existente do app.

Nova logica backend deve ficar em TypeScript dentro de `packages/api` quando possivel. `api/` deve receber apenas wrappers finos, seguindo as regras do repo.

Criar `CallableResolver` para resolver references de nodes:

```ts
type CallableRef =
  | { type: 'skill'; refId: string }
  | { type: 'agent'; refId: string }
  | { type: 'workflow'; refId: string };

type ResolvedCallable = {
  type: CallableRef['type'];
  refId: string;
  name: string;
  description?: string;
  version?: number;
};
```

Responsabilidades do resolver:

- confirmar que `refId` existe;
- confirmar tenant correto;
- confirmar permissao `VIEW`;
- bloquear workflow draft em runtime;
- retornar dados suficientes para validacao/execucao.

## Validacao

Publicacao deve validar:

- workflow tem nome;
- nodes existem;
- edges apontam para nodes existentes;
- refs existem;
- usuario tem `VIEW` em cada skill/agent/workflow referenciado;
- sem ciclos no DAG;
- sem self-reference direta ou indireta;
- depth maximo para workflow chamando workflow;
- limite maximo de nodes;
- limite maximo de edges;
- tenant isolation;
- versao publicada imutavel.

Runtime deve revalidar permissao antes de executar, porque acesso pode mudar depois do publish.

Defaults recomendados para V1:

- max nodes: 50
- max edges: 75
- max workflow nesting depth: 3
- loops: bloqueados
- parallel advanced: bloqueado
- tools diretas: bloqueadas

## Editor Visual

Usar React Flow para o canvas visual.

Layout V1:

- toolbar com adicionar `Skill`, `Agent`, `Workflow`;
- canvas com nodes conectaveis;
- painel lateral para editar node selecionado;
- botao `Validar`;
- botao `Publicar`;
- botao `Testar` apenas quando executor minimo existir.

Painel lateral por node:

- label;
- tipo;
- referencia (`skill`, `agent` ou `workflow`);
- campo `when`;
- preview basico da referencia selecionada.

UX de validacao:

- mostrar erro por node/edge;
- destacar node invalido no canvas;
- impedir publish com erro;
- nao usar erro generico quando existe erro acionavel.

Todos textos user-facing devem usar `useLocalize()`. Editar somente `client/src/locales/en/translation.json` para novas keys.

## Executor V1

Executor minimo deve vir depois do schema/API/editor base.

Escopo V1:

- executar DAG simples;
- executar nodes em ordem topologica;
- registrar `WorkflowRun`;
- registrar `WorkflowStepRun`;
- falhar de forma controlada se node falhar;
- nao tentar retry automatico no primeiro corte;
- nao executar node oculto ou sem permissao.

Skill node:

- resolver `PromptGroup`;
- usar production prompt;
- registrar input/output resumido.

Agent node:

- resolver agente;
- usar fluxo existente de agent quando possivel;
- nao misturar workflow graph com handoff graph interno do agente.

Workflow node:

- resolver workflow publicado;
- executar versao publicada;
- respeitar depth maximo.

## Permissoes

Workflow deve ter permissao propria se o sistema atual exigir recurso separado:

- `VIEW`
- `USE`
- `EDIT`
- `DELETE`
- `SHARE`

Se adicionar novo tipo de permissao, lembrar regra do repo:

- adicionar no Zod schema em `packages/data-provider/src/permissions.ts`;
- adicionar no Mongoose schema em `packages/data-schemas/src/schema/role.ts`;
- rebuild de `packages/data-schemas`;
- restart backend para `initializeRoles()` atualizar roles existentes.

Permissao por node:

- salvar draft pode permitir refs visiveis no momento;
- publish valida todas refs;
- runtime revalida;
- refs sem permissao devem bloquear execucao com erro auditavel.

## Compatibilidade

Nao alterar comportamento atual de Skills.

Nao alterar comportamento atual de Agents.

Nao mover dados existentes de `PromptGroup`.

Nao reutilizar `PromptGroup` para armazenar Workflow.

`PromptGroup` vira apenas callable leaf node via adapter.

Handoffs nativos de agente continuam separados do workflow graph.

Feature deve poder ficar atras de flag/config ate estabilizar.

Sem migracao obrigatoria para dados existentes.

## Rollout

Fase 1:

- schemas/types;
- CRUD/list/detail;
- publish com validacao;
- feature flag;
- testes de schema/validacao/permissao.

Fase 2:

- editor visual com React Flow;
- salvar draft;
- validar/publicar;
- UI de erros.

Fase 3:

- executor DAG minimo;
- `WorkflowRun`;
- `WorkflowStepRun`;
- tela simples de run/debug.

Fase 4:

- melhorias: conditions, approvals, retry, scheduler, webhook, marketplace/templates.

## Testes

Schema/model:

- criar workflow draft;
- editar workflow draft;
- publicar versao imutavel;
- arquivar workflow;
- rejeitar ciclo;
- rejeitar self-reference;
- rejeitar ref inexistente;
- rejeitar falta de permissao;
- respeitar tenant.

Resolver:

- resolver skill por `PromptGroup`;
- resolver agent;
- resolver workflow publicado;
- bloquear workflow draft em runtime;
- bloquear ref sem permissao;
- bloquear tenant errado.

Executor:

- criar `WorkflowRun`;
- criar `WorkflowStepRun`;
- executar nodes em ordem;
- falhar controlado quando node falha;
- registrar erro estruturado;
- respeitar depth maximo.

Frontend:

- renderizar canvas vazio;
- adicionar node skill;
- adicionar node agent;
- adicionar node workflow;
- conectar nodes;
- remover node;
- editar painel lateral;
- salvar draft;
- mostrar erros de validacao;
- impedir publish invalido.

Regressao:

- prompt groups/skills continuam listando;
- prompt groups/skills continuam editando;
- seletor de agents continua igual;
- handoffs nativos de agent continuam funcionando;
- chats sem workflow continuam iguais.

## Fora do Escopo V1

- tools diretas;
- loops;
- scheduler;
- webhook;
- marketplace;
- human approval;
- retry automatico avancado;
- execucao paralela avancada;
- billing por workflow;
- analytics avancado.

## Acceptance Criteria

V1 esta pronto quando:

- usuario consegue criar workflow draft visual;
- usuario consegue adicionar skill/agent/workflow nodes;
- usuario consegue conectar nodes;
- backend valida workflow antes de publicar;
- workflow publicado vira versao imutavel;
- logs registram publish/run/step com IDs correlacionaveis;
- skills existentes nao mudam;
- agents existentes nao mudam;
- testes cobrem validacao, permissao, tenant e regressao.
