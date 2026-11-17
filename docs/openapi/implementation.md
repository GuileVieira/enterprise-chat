# Plano refinado — API externa do Orqest

Plano Astra executado por Sol no worktree após o commit local `1c90fc4fe` (README e dois OpenAPI).
O inventário inicial tomou `3896374d1` como referência; as 20 operações novas estão implementadas
e verificadas localmente. Isso não comprova deploy nem execução contra provedores reais.

## 1. Decisões fixas

Terminal/Codex/Claude Code conduz o raciocínio com seu próprio modelo. Orqest fornece instruções,
prompts, skills, contexto e dados internos autorizados; executa tools no servidor, onde ficam suas
credenciais. Documentos indexados chegam como **chunks de `file_search`**, nunca download integral.
Não implementar isso chamando chat/completions do agente.

Manter as **20 operações** propostas em `/api/integrations/v1`, entregues nesta ordem:

1. Auth, leituras, contexto e busca de chunks, sem persistência nova de chamadas.
2. Catálogo e execução direta de tools compatíveis, preservando controles do runtime.
3. Escritas com estado durável/idempotência; lifecycle interativo somente com suporte real.

O primeiro incremento é utilizável, mas não conclui toda a execução solicitada. Builtins, tenant
functions, actions e MCP permanecem no escopo; schema com `callable=false` não conta como execução.
A contagem anterior (18 existentes, 33 novos, 32 reutilizados, 7 condicionais) misturava fases e
extrações não demonstradas. Substituí-la por responsabilidades e gates, sem uma quota de arquivos.

Arquitetura: `router Express → auth/tenant/config → autorização/projeção TS → métodos existentes`.
Na execução: `catálogo efetivo → validação → adapter compatível → resultado seguro`.
Um router CJS compõe dependências legadas; lógica nova em `packages/api`. Não importar `api/` no
package, criar controllers com `req/res` falsos ou duplicar ACL. Montar handlers existentes quando
servirem exatamente; caso contrário, extrair o menor resolvedor compartilhado. Sem cache novo de
autorização/contexto entre requests, SDK, frontend, servidor MCP ou framework de plugins.

## 2. Auth e autorização

A nova superfície combina **chave tenant** e **OIDC M2M de gestão vinculado**. Isso não altera auth
das rotas antigas. Sessão de navegador, chave individual e OIDC remoto de usuário não são equivalentes.

| Operação                                         | Política preservada                                                                                                                                     |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Agente, contexto, manifest e catálogo exportável | AGENTS USE + AGENT EDIT ou capacidade administrativa existente                                                                                          |
| Skill/arquivos                                   | SKILLS USE + SKILL VIEW; regras existentes de deployment                                                                                                |
| Projeto/documentos                               | PROJECT VIEW, tenant e referências autorizadas                                                                                                          |
| Prompt/grupo                                     | VIEW direto ou herdado do projeto, com filtros atuais                                                                                                   |
| Memórias                                         | READ, partições/consumidores; compartilhadas com permissão e vínculo                                                                                    |
| Histórico                                        | Propriedade do principal autenticado e tenant                                                                                                           |
| Tool call                                        | Política de execução remota, inclusive REMOTE_AGENTS USE e autorização remota do agente; grants/capabilities da tool; PROJECT VIEW/EDIT conforme efeito |

Não substituir autorização de exportação por VIEW de execução, nem supor que EDIT concede execução
remota: os recursos/grants diferem. PROJECT VIEW não compartilha histórico de terceiros.

- Reusar `createRequireApiKeyAuth`, exigir `req.tenantApiKey === true` e respeitar configuração
  efetiva que habilita chaves/REMOTE_AGENTS. Chave pertence a OWNER ativo; revogação, mudança de
  papel/tenant ou desativação invalidam uso. Memórias/histórico pessoais são desse OWNER.
- Reusar `createAgentManagementAuth` para issuer/audience, client binding e subject. Não usar
  `createRemoteAgentAuth` inteiro como substituto: seu OIDC resolve usuários remotos, não M2M.
- Resolver mecanismo uma vez. Credencial autenticada e negada por política não recebe fallback
  para contornar negativa. Restabelecer tenant/request/capability context antes de dados;
  carregar config efetiva, ban/conta ativa e limites. Rejeitar tenant conflitante do cliente.
- Verificar `user.disabled` também no M2M: `isAgentTriggerPrincipalActive` verifica o marcador de
  exclusão em andamento, não substitui essa checagem. Manter ban e configuração do router real.
- `/identity` retorna tenant, principal, método e ID da chave quando houver; nunca token.
  Não inventar scopes finos na chave atual. OIDC depende da configuração existente da instalação.

## 3. Leituras e contexto

Projeções explícitas, jamais Mongo bruto. Omitir `model_parameters`, `tool_options`, auth,
identidade Git, ambientes e storage paths. Projetar também mensagens, referências, frontmatter,
artifacts e erros; aplicar filtros/inspeções existentes. Campos livres podem conter segredos;
filtragem não garante detectar todo segredo escrito manualmente em instruções.

- Agente: instructions são texto base; texto copiado não preserva vínculo implícito com prompt group.
  Projeto: instruções/snippets e grupos resolvidos para produção/versões autorizadas, não só IDs.
- Revalidar referências legadas de arquivos, skills, subagentes e memórias; documento legível não
  autoriza divulgar ID estrangeiro salvo nele. Paginar com ordenação estável/cursor por escopo,
  evitando paginação anterior à ACL que omita acessíveis ou exponha contagens negadas.
- Skills: body/frontmatter, inventário e arquivos textuais autorizados, com leitores/path validation
  existentes. Não executar scripts na leitura. Conteúdo legível não significa skill ativa:
  respeitar `skills_enabled`, all/selected/none, alwaysApply/deployment, `disableModelInvocation`
  e `userInvocable`. `allowedTools` não concede permissão adicional.
- “Skill completa” exige informar referências ausentes. Binários ficam fora; texto grande ou
  indisponível recebe motivo, nunca sucesso completo silencioso. Deployment já limita cache textual
  a 512 KiB. Texto maior só demanda extensão se um caso real exigir; não criar download RAG.
- Frontmatter usa allowlist explícita de campos úteis, inclusive nomes persistidos como
  `argument-hint`; declarar a projeção e as omissões. Não exportar ambientes/hooks arbitrários.
  `SKILL.md` deve reconstruir frontmatter autorizado e body, ou declarar que entrega somente body;
  nunca apresentar body isolado como cópia completa do arquivo original.
- Memórias de projeto incluem somente vínculos/consumidores autorizados. A listagem de biblioteca
  com `projectId` não faz esse filtro. Histórico permanece owner-scoped, paginado e projetado.
- `memoryKey` não identifica memória globalmente: preservar a partição `agentId` e validar
  referências compartilhadas por tenant, consumidor e estado ativo. IDs legados ambíguos ou
  inacessíveis não podem escolher arbitrariamente uma memória com a mesma chave.
- `loadProjectContext` não é exportador pronto: achata memórias, acrescenta diários de tráfego e
  engole falhas em contexto vazio. Reusar regras/resolução, sem exportar diários incidentalmente
  ou tratar falha de ACL/consulta como sucesso vazio.
- Contexto usa os mesmos resolvedores das rotas individuais, com origem/versão e seleção.
  Agente/projeto explicitamente pedido e negado falha; indisponibilidade opcional pode gerar
  warning sem ID/conteúdo inacessível. Limites/truncamento devem ser explícitos.
- `contextFingerprint` identifica projeção segura/versões/schema/seleção, não snapshot transacional
  global, autorização ou prompt final de turno. Sem LLM. Referências de skills podem ser buscadas
  nas rotas próprias, sem embutir todos os arquivos em uma resposta.
- Ordenação e comparação do cursor usam o mesmo comparador determinístico; limites de varredura,
  contexto e resposta são explícitos. Exceder o limite não pode parecer listagem/contexto completo.

Dados internos: recursos acima e resultados autorizados de tools. Sem endpoint genérico de SQL,
Mongo, URL ou arquivo arbitrário. Não criar conversa fictícia para exportar contexto/executar tool.

## 4. `file_search`: primeira execução

Entrada: `POST /tools/file_search/call` com `{ agentId, projectId?, arguments: { query } }`.

1. Validar execução do agente, capability file_search, FILE_SEARCH USE e PROJECT VIEW quando
   aplicável. Recusar agentes efêmeros sem resolução autorizada.
2. Resolver recursos do agente e unir `file.projectId`/`project.fileIds` do projeto no mesmo tenant;
   deduplicar. Não ampliar para todos os arquivos do tenant.
3. A implementação externa usa `readers.files` e o helper existente `filterFilesByAgentAccess`,
   propagando autorização de exportação ou execução remota, antes do núcleo `searchFiles`.
   Arquivo vinculado por `project.fileIds`, sem `file.projectId` persistido, recebe o projeto
   selecionado somente após validar sua associação e PROJECT VIEW, para consultar o índice certo.
   O wrapper legado mantém `primeFiles`; a rota externa evita sua concatenação de `resourceFiles`
   e seus `projectFileIds` confiáveis. Nenhum desses campos pode ser fornecido pelo cliente.
4. Consultar RAG interno com JWT curto do servidor e fallback de entity existente. Recusar
   `entity_id`, `file_ids`, `projectFileIds`, `resourceFiles`, URL ou `k` do cliente. Não repassar
   chave tenant/OIDC ao RAG.
5. Preservar k=5/arquivo, top-10 global, chunks e `artifact.file_search.sources`. Relevância é
   `1 - distância`, não probabilidade. Páginas 1-based quando presentes; sem chunkId/offset inventado.

Extrair núcleo de consulta estruturado em TS; wrapper atual mantém tupla/texto/artifact do chat.
Não analisar frases de erro em inglês. Inspecionar saída e projetar metadata de imagem/fontes.
Essa extração não exige refatorar todo `ToolService`.

Distinguir sem arquivos, vazio, sucesso, parcial, auth RAG, indisponibilidade e timeout/cancelamento.
O `/query` atual não comprova índice ausente por devolver vazio. Só emitir `not_indexed` com
evidência do provedor; caso contrário `index_status_unknown`. `embedded` também não comprova índice.
Não criar uma API de indexação para compensar evidência que o RAG não fornece.
Inventário também não deve converter `embedded=true` em garantia de índice consultável. Fallbacks
mantêm ordem projeto → agente autorizado → proprietário, sem repetir o mesmo corpo de consulta.
Resposta vazia de um fallback não apaga falha operacional dos demais; limite de bytes não vira timeout.

Limitar query, arquivos, concorrência, prazo total e resposta. Reusar limites existentes;
proposta inicial para fixtures: 4.000 caracteres, 50 arquivos, 5 consultas concorrentes, 30 s total,
1 MiB de resposta. Fallbacks compartilham prazo. Excesso de escopo falha explicitamente, não busca
silenciosamente só os primeiros arquivos. Valores são proposta de teste, não limites já existentes.
Na implementação, esses limites são explícitos na superfície externa. O wrapper de chat mantém
compatibilidade de quantidade de arquivos e tamanho de query por opção exclusivamente interna;
o cliente externo não controla essa opção. Concorrência, prazo e orçamento de resposta continuam
limitados. Preservar texto de erro, basename de citações e metadata de imagem do wrapper legado;
a projeção externa não recebe caminhos de storage nem IDs de imagem sem autorização.

## 5. Tools e escritas

Reusar loader/registry/roles, tenant functions, actions e MCP. Descoberta não inicia OAuth/SSE,
sandbox, tool ou LLM. `definitionsOnly` sozinho não garante isso: o loader tem fluxo OAuth e
callbacks. Extrair/acrescentar modo sem transporte de chat somente onde houver acoplamento real.

| Família                                                       | Catálogo/execução                                                                                                          |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Tenant HTTP function                                          | Ativa, mesmo tenant e atribuída ao agente; schema normalizado; executor e segredos existentes                              |
| Builtin                                                       | Registry + grants/capabilities; allowlist de execução verificada                                                           |
| Action                                                        | Schema/domínio/ACL vigentes; auth já disponível e lifecycle suportado                                                      |
| MCP                                                           | Servidor acessível, identidade/alias/schema efetivos; sessão headless suportada; token Orqest não vira credencial upstream |
| Aprovação, pergunta, código com sessão, subagente, background | `callable=false` + motivo até suporte real, antes de efeitos                                                               |

Não chamar `_call()` indiscriminadamente. Schema desconhecido por OAuth indisponível não vira schema
vazio inventado nem bloqueia leitura das instruções. Resolver nomes/aliases pelo mecanismo atual.
Revalidar config/ACL/schema na chamada; catálogo anterior não concede acesso. Validar/inspecionar
argumentos e saída. Injetar/conferir `project_id` por adapter contra envelope autorizado; IDs de
campanha/conta continuam sob validação de domínio da tool, sem regra genérica para todo campo `Id`.
Recusar `conversationId` enquanto nenhum adapter suportar e validar seu lifecycle/ownership.

Seams verificados para os adapters, preservando os caminhos atuais de chat:

- MCP: `getMCPServerTools` lê catálogo em cache vinculado à geração da configuração, sem iniciar
  conexão. Usá-lo depois de resolver servidores acessíveis/config/variáveis do principal. Cache
  ausente ou sessão efêmera indisponível produz motivo explícito, não schema inventado.
- Não usar `getOrFetchMCPServerTools` na descoberta externa: ele pode reconectar e iniciar OAuth.
  O adapter TS reutiliza resolução/ACL de configuração, domínio e identidade do servidor e chama
  o ramo headless explícito de `MCPManager.callTool`; não passa pelo wrapper de chat
  `createMCPTool`. O manager bloqueia lifecycle OAuth/efêmero incompatível e retry após dispatch.
  Não fornecer `thread_id`/`run_id` fictícios. Stubs de indisponibilidade nunca contam como execução.
- MCP aliases preservam resolução direta e nomes legados; remover prefixo só quando a identidade
  registrada (`serverToolName`) comprovar equivalência. Token tenant não vira credencial upstream.
- Actions: reutilizar snapshot inspecionado, validação de domínio/spec e schemas atuais. Modo
  headless usa `RequestBuilder`/`RequestExecutor` com proteção SSRF, prazos e credenciais existentes;
  OAuth exige token armazenado ainda válido. Não iniciar flow/login nem refresh interativo.
  Validar JSON Schema declarado sem o afrouxamento do conversor usado para apresentação à LLM.
- Reutilizar política de aprovação e hooks; match que possa pausar sem lifecycle suportado
  produz `callable=false`. Não desligar aprovação para tornar a tool executável externamente.

O inventário inicial encontrou JSON Schema em `schema-parser.ts` e Zod privado no `ToolService.js`,
sem aplicação de `def.default`. A extração compartilha o parser, com validação estrita externa e
compatibilidade de objetos/arrays livres e tratamento de extras no chat. Required/defaults precisam
de semântica equivalente entre schema anunciado e execução. Testar enums, objetos, arrays,
inteiros, extras/defaults, sem terceiro conversor.
Classificar efeitos por capacidade/operação, nunca só por GET/nome. Efeito desconhecido não recebe
execução automática; tenant function criada precisa dessa avaliação para ser habilitada.
Tenant functions recebem classificação opcional persistida e validada `integrationEffect`
(`read`/`write`); ausência preserva configurações antigas e bloqueia execução externa por efeito
desconhecido. Actions/MCP também precisam de avaliação confiável por operação; HTTP GET, nome da
tool e `readOnlyHint` externo não bastam para conceder execução sem avaliação.
Actions usam `metadata.integrationEffects` avaliada por OWNER/ADMIN; MCP usa avaliação de configuração
do operador, não mapas arbitrários de servidores de usuário. Alterar spec, destino, auth ou código
executável invalida avaliação anterior, salvo reavaliação autorizada na mesma alteração.
Builtins compatíveis usam registry/loader existentes; Meta Ads classifica efeito por ação e valida
PROJECT EDIT antes de reservar escrita. Configuração explícita `metaAds=false` permanece bloqueante.

**Antes de qualquer escrita:** coleção Mongo `IntegrationCall` tenant-safe, compartilhada e durável.
Não é requisito de leitura/RAG. `ToolCall` atual exige conversationId/messageId; não afrouxá-lo.
Redis só substitui Mongo com contrato real de durabilidade/falha; cache local não basta.

- `Idempotency-Key` obrigatória; reserva única tenant/principal/chave e digest canônico do envelope
  e argumentos. Payload diferente → 409. Concorrentes não disparam duas vezes.
- Estados internos: in_progress/completed/failed/partial/ambiguous, dispatch e IDs conhecidos.
  Mesmo POST consulta/reproduz estado após revalidar identidade/ACL/acesso aos resultados.
- Crash/timeout/desconexão/lease vencido não comprovam cancelamento: impedir retry cego e marcar
  ambíguo sem prova de não execução. Falha de pós-processamento/persistência após efeito também
  não é “falhou sem efeito”. Não prometer exactly-once externo.
- Resultado seguro/limitado para replay; logs sem tokens, headers ou payloads integrais. TTL é
  retenção, não autorização para repetir efeito antigo. Janela de replay definida em sete dias;
  expirar essa janela não apaga automaticamente o resultado armazenado nem libera a chave.
- Índice único pronto antes do gate. Script de provisionamento com dry-run somente se necessário;
  execução em produção separada. Falhar fechado se armazenamento não estiver pronto.
- Reserva e marcador de dispatch exigem confirmação durável de Mongo (`majority` + journal).
  Não depender de write concern de conexão que possa ser reduzido. Sem confirmação, não disparar.
- Preservar a reserva/chave como tombstone sem TTL automático que permita repetir efeito antigo.
  Uma única tentativa de dispatch por reserva; lease expirada não libera nova execução. Resultado
  tardio dessa mesma tentativa pode refinar estado ambíguo, mas nunca sobrescrever estado terminal
  de outra tentativa. Testar concorrência entre instâncias e falha de persistência após o efeito.
- Executor tenant já tem timeout 30 s, redirects bloqueados e retorno string JSON. Quando escrita
  exigir, acrescentar resultado interno tipado/signal preservando wrapper e consumidores atuais.
  Um POST idempotente basta para replay; não criar polling/jobs/aprovação fictícia.

## 6. Mapa mínimo de arquivos e das 20 operações

Nomes novos são propostas, não obrigação de criar um arquivo por rota/helper. Dividir quando lógica
justificar; não concentrar tudo num arquivo gigante. Testes cobrem comportamento, não árvore fixa.

| Fase          | Alterações/arquivos                                                                                                                                                                                |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Auth/leituras | Montagens em `api/server/{index.js,routes/index.js}`; export em `packages/api/src/index.ts`; novo `api/server/routes/integrations.js`; módulos TS `integrations/{auth,contracts,reads,context}.ts` |
| Extrações     | `agents/reads.ts`, `skills/management.ts` e resolvedores legados somente se reuso direto não servir                                                                                                |
| Chunks        | `api/app/clients/tools/util/fileSearch.js`; novo `packages/api/src/files/search.ts`; handler em `integrations/tools.ts`; regressões existentes                                                     |
| Outras tools  | `api/server/services/ToolService.js`; executor/parser tenant conforme necessidade comprovada                                                                                                       |
| Escritas      | `integrationCall.ts` em types/schema/models/methods de data-schemas e respectivos registros/exports; `integrations/calls.ts`; provisionamento de índice se necessário                              |
| Contrato      | Dois OpenAPI, README e `api/test/openapi.spec.js` já no worktree; asset runtime quando publicado                                                                                                   |

Sem criação antecipada de wrapper `services/Integrations`, barrel, `access.ts`, módulo por recurso,
gerador OpenAPI, migration script ou YAML novo. Reusar auth, agents/skills, Projects/access,
Files/permissions, PermissionService, regras de prompts/memória, queries owner-scoped e proteção de
tools. Download legado, frontend, entrypoint experimental e configs de produção não têm diff presumido.

| Operações preservadas (base `/api/integrations/v1`)                      | Responsabilidade                   |
| ------------------------------------------------------------------------ | ---------------------------------- |
| 1. `GET /identity`                                                       | Auth                               |
| 2–3. `GET /agents`, `GET /agents/{id}`                                   | Lista/config exportável            |
| 4. `GET /agents/{id}/context`                                            | Composição identificada            |
| 5–6. `GET /agents/{id}/tools`, `POST /tools/{toolName}/call`             | Catálogo e execução por gates      |
| 7–8. `GET /projects`, `GET /projects/{projectId}`                        | Projetos acessíveis                |
| 9–10. `GET /projects/{projectId}/files`, `GET /agents/{id}/files`        | Inventário autorizado              |
| 11–12. `GET /skills`, `GET /skills/{id}`                                 | Resumos/corpo/frontmatter          |
| 13–14. `GET /skills/{id}/files`, `GET /skills/{id}/files/{relativePath}` | Arquivos/texto e indisponibilidade |
| 15–16. `GET /projects/{projectId}/prompts`, `GET /prompts/{id}`          | Snippets/grupos/versão autorizada  |
| 17–18. `GET /projects/{projectId}/memories`, `GET /memories`             | Vínculos/partições autorizados     |
| 19–20. `GET /conversations`, `GET /conversations/{id}/messages`          | Histórico próprio                  |

## 7. Correções incorporadas no contrato

Os YAMLs, README e testes de contrato acompanham a implementação local. Os pontos abaixo orientaram
as correções, verificadas por validação OpenAPI e testes de equivalência:

- `ToolResult` passou a representar partial/ambiguous/em andamento, código de
  falha, estado de efeito e IDs conhecidos. Evitar envelope duplicado `error.error`.
- Busca precisa de estados estruturados e limites; não anunciar índice ausente sem evidência.
  Mapeamento: 400 entrada; 401/403 auth/ACL; 404 inacessível; 409 lifecycle/idempotência; 429 limite;
  502/503 upstream; 504 prazo. Auth RAG não retorna 401 do cliente. Parcial pode ser 200 explícito.
- `Tool.inputSchema` pode estar ausente quando a descoberta está indisponível; não inventar schema.
  `conversationId` não promete lifecycle. Catálogo tem nextCursor sem cursor/limit de entrada:
  resposta inteira limitada com cursor nulo ou paginação real, conforme cardinalidade.
- Fechar projeções de Conversation/Message, conteúdo/artifacts; explicitar completude de skills,
  versões/origens e limites de contexto. Warnings não vazam referências negadas.
- Corrigir descrições de security schemes: união nova só em integrations; gestão antiga continua
  M2M exclusiva. Atual só recebe rotas realmente implementadas, nunca promessa de deploy.

Publicação OpenAPI por HTTP fica fora desta implementação; YAML importável e README são a entrega
do contrato. Se solicitada posteriormente,
empacotar asset no backend; `.dockerignore` exclui `docs`, que contém arquivos privados/áudios.
Nunca desexcluir a pasta inteira. Uma fonte canônica + transformação determinística/teste de
equivalência; escolher inclusão no build antes de criar gerador. Verificar dist/imagem efetiva.
Sem dependência de Swagger UI, Dockerfile novo ou servidor separado.

## 8. Fases, testes e gates

| Fase                       | Aceite e verificação focada                                                                                                                                                                                                                                                                                                                                                        |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A — Auth/leituras/contexto | Supertest + banco/ACL reais: tenants A/B, OWNER/usuário restrito, chave individual/revogada, conta/papel/tenant alterados, OIDC binding/config, VIEW sem EDIT, PROJECT VIEW herdado, cursor/path maliciosos. Recuperar instruções, prompts, skills/referências, projeto, memórias e histórico próprio; sem LLM/segredos; incompletude explícita. Gestão antiga não ganha fallback. |
| B — Chunks                 | HTTP RAG simulado; arquivos próprios/agente/projeto/vínculo legado, IDs estrangeiros, revogação após descoberta, vazio/erros/parcial, prazo/fallback/concorrência, páginas/imagem e filtros. Regressões das duas suítes fileSearch. Scope imutável, top-10 correto, nenhuma inferência falsa sobre índice.                                                                         |
| C — Tools                  | Loader/ACL reais e HTTP externo simulado; tenant function representativa e cada família habilitada. Schema/validação, alias, grant revogado, projeto divergente, credencial ausente/OAuth, saída e runtime-only. Matriz callable por capacidade; schema/stub não comprova execução. Escritas aguardam D.                                                                           |
| D — Escritas               | Mongo real de teste: índice/reserva concorrente, duas instâncias, replay/digest conflitante, crash após dispatch, timeout/pós-processamento, ACL revogada, efeito parcial. Sem retry cego; ambiguidade recuperável pelo mesmo POST. Persistência/índices indisponíveis bloqueiam dispatch.                                                                                         |
| E — Entrega                | Contratos/README/testes e asset se publicado; conferir 20 operações, builds focados quando dist necessário e typechecks dos packages alterados. Novo model exige data-schemas. Atualizar graphify após código. Smoke autorizado: identidade → contexto → query/chunks → tool customizada suportada, sem LLM Orqest.                                                                |

Mocks restritos a HTTP externo/não determinismo; banco/ACL reais quando relevantes. Não executar
build completo de frontend, E2E ou Docker só por documentação. Smoke RAG real, escrita externa,
provisionamento de índices e deploy têm evidências/autorizações separadas; testes locais não os provam.

Não bloqueiam começar A/B: inventário de tools/efeitos da instalação, OIDC configurado, volumes para
calibrar limites, skills com texto grande, janela de retenção, sinais de índice oferecidos pelo RAG
e inclusão do asset OpenAPI. Defaults: chave tenant + M2M configurado, leitura síncrona, allowlist
conservadora, Mongo antes de escrita e lifecycle incompatível explicitamente bloqueado.

## 9. Aceite local da implementação

Astra coordenou/revisou e Sol implementou as fases A–E. Evidência local, sem somar novamente testes
que aparecem em mais de uma rodada:

- **A:** router Express real com Mongo/ACL reais: quatro testes agregados de isolamento, exportação
  versus execução, revogação, contexto e RAG de arquivo legado vinculado ao projeto. Suítes de
  leituras/contratos e regressão de auth/gestão/skills também passaram; esta última teve 83 testes.
- **B:** busca estruturada e seus estados passaram; regressões legadas de fileSearch/preview
  passaram com 40 testes, preservando metadata e entradas aceitas pelo chat.
- **C:** adaptadores efetivos de tenant functions, builtins, Actions e MCP foram exercitados com
  HTTP de teste. A rodada final de Actions passou nove testes, incluindo corpo HTTP real,
  constraints do schema, proteção das credenciais e formas incompatíveis explicitamente bloqueadas.
  Regressões de ToolService/ActionService passaram 196 testes; Meta Ads passou 163.
- **D:** reservas, concorrência, conflito, replay/revogação, prazo/crash e efeitos conhecidos foram
  verificados com Mongo real de teste. Não há retry externo após dispatch nem promessa de exactly-once.
- **E:** os dois YAMLs passaram swagger-cli; contrato passou 14 testes, incluindo 20 operações
  canônicas e equivalência com o inventário atual de 50 operações. Provider passou 202 testes;
  builds focados e typechecks separados de provider, schemas e API passaram. Lint focado passou.
  Graphify foi atualizado após as alterações de código.

Actions respeitam o executor existente: get/post/put/patch/delete, sem corpo em GET. Parâmetros
de PathItem, corpos escalares/arrays e formas mistas cuja serialização não preserva o schema ficam
não chamáveis. Colisões de nomes entre parâmetros/corpo ou entre localizações distintas também;
headers que substituiriam a autenticação configurada são bloqueados antes de dispatch.

Para usar em outro ambiente, publicar o código e configurar auth/ACL/credenciais/capabilities;
avaliar efeitos das tools e garantir a coleção/índice único de IntegrationCall antes de escritas.
MCP requer descoberta em cache e lifecycle headless compatível. Índice ausente, configuração
insuficiente ou lifecycle incompatível bloqueiam a capacidade correspondente explicitamente.

Não foram executados E2E, build de frontend, smoke de produção, chamadas a provedores reais,
provisionamento remoto de índices, commit, push, deploy ou migração de produção. WIP anterior de
testes, graphify e arquivos privados permanece preservado.
