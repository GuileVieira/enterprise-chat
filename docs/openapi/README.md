# Orqest para consumo por terminal

As **20 operações de `/api/integrations/v1` estão implementadas no worktree**. Os testes locais
usam MongoDB e HTTP de teste; isso **não comprova deploy**, configuração OIDC da instalação,
índices RAG de produção ou efeitos externos reais. O terminal conduz o raciocínio; estas rotas
fornecem instruções/contexto e executam ferramentas compatíveis sem iniciar a LLM do agente.
O mesmo YAML também documenta a rota existente `POST /api/agents/v1/chat/completions`, que executa
o agente com a LLM configurada no Orqest e consome tokens.

| Arquivo                                                                              | Conteúdo                                                                                                                                                                                 |
| ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [orqest-current.openapi.yaml](orqest-current.openapi.yaml)                           | Inventário legado mais as 20 integrações implementadas no código local. Componentes novos têm prefixo `Integration`; schemas legados permanecem separados.                               |
| [orqest-integration.proposed.openapi.yaml](orqest-integration.proposed.openapi.yaml) | Contrato canônico das 20 integrações implementadas. O nome histórico `.proposed` foi preservado para manter links; `x-orqest-status: implemented-source-only` identifica o estado atual. |
| [implementation.md](implementation.md)                                               | Plano refinado, decisões de segurança, fases e evidências de implementação.                                                                                                              |

O contrato também está disponível por **GET `/api/integrations/v1/openapi.json`**, com a mesma
credencial Bearer das integrações. São 20 operações de integração, a rota de documentação e a execução de agente já existente.
Consumo externo é REST/HTTP; não foi criado servidor MCP. Adapters MCP servem somente para tools
internas já configuradas. Os YAMLs continuam importáveis; não foi adicionada Swagger UI.

O JSON servido acompanha a imagem Docker, sem depender de `docs/`. Após editar o contrato canônico,
regenere o asset com `node config/generate-integration-openapi.js`; os testes conferem equivalência.
Salvar ou importar o contrato não publica endpoints. O inventário legado mantém as políticas de
cada rota; a autenticação combinada abaixo vale somente para `/api/integrations/v1`.

## Autenticação e principal

Aceita uma das credenciais existentes no header `Authorization: Bearer …`:

- **Chave tenant:** pertence a OWNER ativo, no mesmo tenant e com papel OWNER. Chave individual,
  revogada, expirada ou de usuário desativado não autentica esta superfície. A configuração efetiva
  precisa permitir API keys. `/identity` e `/openapi.json` não exigem execução remota; leituras
  seguem as permissões e ACLs de cada recurso. Executar tools exige `REMOTE_AGENTS USE`.
- **OIDC M2M de gestão:** configuração existente `endpoints.agents.managementApi.auth`, com
  issuer/audience, client binding e subject esperados. Usa o principal configurado naquele tenant.
  Não corresponde ao OIDC remoto de usuário nem a sessão do navegador.

O mecanismo é escolhido uma vez; negativa de política não tenta outra credencial. Conflitos de tenant
em header, query ou body são rejeitados. `GET /identity` devolve `tenantId`, `principalId`, `method`
e `keyId` quando aplicável; nunca o token. A seleção de recursos é persistida em `resourceAccess` por chave: `agentIds` e `projectIds`.
Categoria omitida permite todos os recursos autorizados, inclusive novos; `[]` não permite nenhum.
As escolhas nunca ampliam ACL/capabilities do OWNER e são revalidadas em cada request.

Em **Configurações → Dados e Privacidade → API do tenant**, “Nova chave” inicia com todos
selecionados. “Editar acesso” altera uma chave existente sem trocar seu segredo. Gestão usa sessão
JWT (`POST /api/tenant-api-keys` e `PATCH /api/tenant-api-keys/{id}`), exclusivamente OWNER do tenant
ou ADMIN. A seleção inclui agentes compartilhados explicitamente com o tenant, mesmo quando pertencem
ao tenant do superadmin. Recursos de outro tenant sem ACL permanecem inacessíveis.

Chaves com seleção personalizada funcionam em `/api/integrations/v1`; os endpoints antigos de
execução não aceitam essas chaves, para impedir contorno das restrições. Contexto e dados derivados
seguem os agentes/projetos selecionados; histórico precisa ter vínculo autorizado. Memórias pessoais
sem agente explícito ficam indisponíveis para chaves restritas. Chaves antigas sem seleção mantêm
seu comportamento anterior. `GET /identity` informa o acesso persistido.

Listar agentes exige `AGENTS USE` e `AGENT VIEW` ou gestão no próprio tenant. Compartilhados
com VIEW aparecem com `exportable=false` e sem instruções. Exportar instruções/contexto continua
exigindo `AGENT EDIT` ou gestão no próprio tenant.
Para agentes globais ou de outro tenant, exige EDIT explícito: administrar o tenant não libera
suas instruções. Compartilhamento VIEW permite a seleção sem conceder exportação ou execução remota.
Executar tools exige a autorização remota do agente e os grants/capabilities da ferramenta.
EDIT não concede execução remota; permissão remota não concede exportação. Um catálogo exportável
pode indicar `callable=false, reason=remote_access_denied`.

As rotas antigas de gestão `/api/agents/v1/agents` e `/api/agents/v1/skills` continuam M2M exclusivas.
Rotas de navegador `/api/projects`, `/api/prompts`, `/api/files`, `/api/memories` etc. mantêm JWT de sessão.

## As 20 operações

Base comum: `/api/integrations/v1`.

| Operação                                                          | Resultado                                                                      |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `GET /identity`                                                   | Identidade/principal sem token.                                                |
| `GET /agents`, `GET /agents/{id}`                                 | Projeção exportável com instruções base, modelo e versão.                      |
| `GET /agents/{id}/context`                                        | Composição segura por seleção, origem, completude e fingerprint.               |
| `GET /agents/{id}/tools`                                          | Catálogo efetivo: schema quando conhecido, família, efeito, callable e motivo. |
| `POST /tools/{toolName}/call`                                     | Execução direta por adapter; RAG retorna chunks/fontes.                        |
| `GET /projects`, `GET /projects/{projectId}`                      | Projeções com `PROJECT VIEW`.                                                  |
| `GET /projects/{projectId}/files`, `GET /agents/{id}/files`       | Inventário autorizado; inclui vínculos legados do projeto.                     |
| `GET /skills`, `GET /skills/{id}`                                 | Resumos; depois corpo, frontmatter aprovado e referências verificadas.         |
| `GET /skills/{id}/files`, `GET /skills/{id}/files/{relativePath}` | Inventário e texto limitado de arquivos da skill.                              |
| `GET /projects/{projectId}/prompts`, `GET /prompts/{id}`          | Snippets e texto da versão de produção ou versão autorizada.                   |
| `GET /projects/{projectId}/memories`, `GET /memories`             | Memórias próprias/partições e vínculos autorizados.                            |
| `GET /conversations`, `GET /conversations/{id}/messages`          | Histórico do principal; projeto compartilhado não compartilha conversas.       |

Listagens usam `limit` de 1 a 100, padrão 20, e `cursor`; a resposta contém `items` e `nextCursor`.
O cursor é vinculado a tenant, principal, rota, recurso e seleção; ACL é revalidada em cada request.
Histórico/mensagens e memórias pessoais usam seek no Mongo. Agentes/projetos filtram IDs autorizados
antes do limite de escopo de 2.000 registros; excesso retorna erro explícito. Catálogo de tools é
inteiro, limitado a 200 entradas, com `{tools, nextCursor:null}`. Requests têm limite de 120/min por
principal/tenant, usando o store de limites já configurado.

As projeções omitem Mongo bruto, parâmetros livres de modelo, `tool_options`, identidade Git,
ambientes, storage paths e credenciais. Filtros de conteúdo atuais são reaplicados. Texto escrito
manualmente em instruções ou respostas externas pode conter segredos que nenhum filtro detecta.
Mensagens exportam somente texto explícito; partes omitidas são contabilizadas em `omittedParts`.
Artifacts, tool calls e conteúdo multimodal livre não são repassados pelo histórico.

## Contexto, prompts, skills e memórias

`GET /agents/{id}/context?projectId=…&include=instructions,skills,project,prompts,memories,files`
usa os mesmos resolvedores das rotas individuais. `include` é opcional; padrão todas essas seções.
O catálogo de tools e os textos dos arquivos das skills são recuperados nas rotas próprias.

`agent.instructions` é texto base. Texto copiado de um prompt não preserva vínculo implícito com
grupo/versão. Prompts do projeto resolvem snippets e produção autorizada; versões também podem ser
pedidas por ID. Referências inacessíveis não são divulgadas em warnings.

`contextFingerprint` identifica a projeção segura, versões presentes e seleção; não representa um
snapshot transacional global, autorização futura ou prompt final de um turno. Projeto/agente
explicitamente pedido e negado falha. Seção opcional negada pode gerar warning genérico e
`complete=false`; falha real de consulta/storage não vira contexto vazio bem-sucedido. O contexto
é limitado a 1 MiB e falha explicitamente ao exceder, sem truncamento silencioso.

Skills respeitam `SKILLS USE`, VIEW/deployment/capacidade de gestão existente. A seleção de contexto
respeita capability de skills, `skills_enabled`, all/selected/none, ativação do usuário,
`alwaysApply`, `disableModelInvocation` e `userInvocable`. `allowedTools` não concede grants; apenas
skills alwaysApply efetivamente ativas podem acrescentar nomes ao catálogo, sempre sob autorização
normal da tool. A API não executa scripts durante leitura.

`frontmatterProjection=approved_instruction_fields` deixa explícito que metadata, hooks e ambientes
não são exportados. `SKILL.md` retorna `representation=body_only`, com frontmatter aprovado separado;
não promete o arquivo original integral. O detalhe verifica inventário esperado e links Markdown/
paths seguros de frontmatter, informa `missingReferences`, `missingCount`, `referenceCoverage` e
`completeProjection=body_inventory_and_file_references`. Isso não afirma que todos os conteúdos
referenciados foram carregados. Binários, texto acima de 512 KiB e storage sem leitor têm
`complete=false` e motivo. Erros de leitura falham; nenhuma indisponibilidade vira texto completo.

Memórias pessoais pertencem ao principal autenticado e à partição autorizada. Memórias do projeto
incluem somente inline, keys próprias daquela partição e IDs ativos explicitamente vinculados da
biblioteca do mesmo tenant, sob READ. Não incluem diários de tráfego incidentalmente. Memória
precisa estar habilitada; contexto pessoal acima de 1.000 registros falha explicitamente.

## Busca de chunks com `file_search`

`ORQEST_CURL_CONFIG` deve apontar para arquivo local restrito contendo o header Bearer autorizado.
O exemplo pressupõe que o código tenha sido publicado e configurado naquela instalação.

```bash
curl --fail --config "$ORQEST_CURL_CONFIG" \
  "$ORQEST_BASE_URL/api/integrations/v1/tools/file_search/call" \
  -H 'Content-Type: application/json' \
  --data '{
    "agentId": "agent-1",
    "projectId": "project-1",
    "arguments": {"query": "Qual a política de cancelamento prevista no contrato?"}
  }'
```

O servidor resolve agente/projeto/arquivos e ACL, incluindo `file.projectId` e `project.fileIds`
legados. Arquivo legado comprovadamente vinculado recebe o contexto do projeto no servidor.
A busca não amplia o escopo para todos os arquivos do tenant. Recusa `file_ids`, `entity_id`, `k`,
URLs de RAG, recursos internos e outros campos extras enviados pelo cliente. O RAG recebe JWT curto
do servidor, nunca a chave tenant/OIDC original.

Limites: query de 4.000 caracteres, 50 arquivos, 5 consultas concorrentes, prazo total de 30 s e
1 MiB de resposta. Mantém `k=5` por arquivo e top-10 global. Retorna `data.status` como success,
empty, no_files, partial ou failed, além de `artifact.file_search.sources`. Cada fonte contém
`fileId`, `fileName`, `content`, `relevance`, `pages` e `pageRelevance`; páginas são 1-based quando
presentes. Relevância é `1 - distância`, não probabilidade. Não existe chunkId/offset inventado.
Metadata de imagem é limitada e referências são revalidadas.

`embedded` e resposta vazia não comprovam índice disponível/ausente. `index_status_unknown` é
explícito. Auth RAG inválida não vira 401 do cliente; falhas do provedor/prazo têm códigos próprios.
Não há download integral RAG, SQL/Mongo arbitrário ou conversa fictícia criada para esta execução.

## Adapters e efeitos duráveis

- **Tenant HTTP functions:** ativas, mesmo tenant, atribuídas ao agente, schema validado e executor/
  segredos existentes. Precisam de `integrationEffect=read|write` avaliado no caminho administrativo;
  mudança de configuração executável invalida avaliação omitida. Método GET/POST não classifica efeito.
- **Builtins:** allowlist de implementações verificadas, incluindo calculator, consultas compatíveis
  e operações conhecidas de Meta Ads. Operações que vinculam projeto validam envelope e VIEW/EDIT
  conforme efeito. Tools dependentes de sessão, aprovação, código, subagente ou background ficam
  não chamáveis até existir suporte real.
- **Actions:** operação/schema/domínio/ACL atuais, SSRF, redirects bloqueados, prazo/signal e limites
  de resposta. `metadata.integrationEffects[operationId]` exige avaliação por ADMIN/OWNER; alteração
  de spec/domínio/auth invalida avaliação omitida. Aceita credencial existente; OAuth exige token
  já disponível e não expirado, sem iniciar login/refresh na descoberta. `x-openai-isConsequential`
  exige lifecycle de aprovação e fica não chamável nesta superfície. Verbos suportados: GET, POST, PUT, PATCH e DELETE. Parâmetros no PathItem, body em GET, bodies escalares/arrays, composição complexa misturada com parâmetros externos ao body e nomes sobrepostos no mapa plano ficam não chamáveis. Headers declarados que poderiam substituir autenticação do servidor são bloqueados, inclusive variantes de caixa e headers customizados.
- **MCP:** descoberta usa schemas efetivos em cache e permissões/aliases atuais. Não inicia OAuth,
  SSE ou transporte para descobrir. Execução exige servidor, credencial e lifecycle headless
  compatíveis e `integrationEffects` administrativo por operação. Configuração do usuário não pode
  autorizar efeitos. Token Orqest nunca vira credencial upstream.

Cada chamada revalida configuração, ACL, schema, grants e política de aprovação; catálogo anterior
não concede acesso. Schemas indisponíveis não viram `{}` inventado. `conversationId` é rejeitado.

Escritas exigem `Idempotency-Key` e coleção tenant-safe `IntegrationCall`, índice único pronto e
reserva/dispatch com write concern durável. Mesma chave/tenant/principal e mesmo digest reproduzem
estado após nova autorização; payload diferente retorna 409. Concorrentes não disparam duas vezes.
Estados: in_progress, completed, failed, partial, ambiguous, com efeito e IDs conhecidos quando
existentes. Crash, timeout, desconexão ou falha após dispatch não comprovam cancelamento. Não trocar
chave para repetir resultado ambíguo. Replay seguro é retido por 7 dias; tombstone da chave permanece
para impedir redespacho após expiração. Não há promessa de exactly-once externo.

Índice/armazenamento indisponível bloqueia escrita antes do efeito. Build/teste local não provisiona
índice em produção. Provisionamento, escrita real externa, publicação e smoke de produção precisam
de evidências e autorização próprias.

## Verificação local

```sh
npm exec --workspace=@librechat/api -- jest src/integrations --runInBand --coverage=false
npm exec --workspace=api -- jest server/routes/integrations.spec.js test/openapi.spec.js --runInBand --coverage=false
```

As suítes novas usam Mongo/ACL reais e HTTP de teste para auth, isolamento, exportação versus execução,
referências legadas, cursor, conteúdo, RAG, functions, Actions, builtins, idempotência e ambiguidade.
O teste OpenAPI confere rotas/montagens, 20 operações, referências, separação de auth e projeções.
Typechecks e builds focados dos packages alterados são verificações separadas. Nenhum E2E,
frontend, Docker, deploy, migração ou escrita de produção é comprovado por estas instruções.

## Executar um agente com um pedido

A rota já existe; não é necessário gerar o texto com um modelo externo ao Orqest:

```bash
curl -X POST 'https://orqest.redbytesolutions.com.br/api/agents/v1/chat/completions' \
  -H "Authorization: Bearer $TENANT_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"model":"agent_qPUED49hR-2e9CLncyY8A","messages":[{"role":"user","content":"Analise as campanhas e sugira os próximos passos."}],"stream":false}'
```

A resposta fica em `choices[0].message.content`. Para contexto de projeto, acrescente `projectId`;
o runtime exige PROJECT VIEW. Envie o histórico em `messages` para os próximos pedidos.
Execução exige `REMOTE_AGENTS USE` e autorização `REMOTE_AGENT VIEW` ou propriedade do agente.
Compartilhamento AGENT VIEW sozinho não concede exportação nem execução remota. Chaves com
seleção personalizada de agentes/projetos continuam recusadas pelo runtime completo; as restrições
não são ignoradas. O runtime pode executar as tools configuradas, inclusive com efeitos externos.
