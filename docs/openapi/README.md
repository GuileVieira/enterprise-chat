# Orqest para consumo por terminal

Revisão do código no commit `3896374d1`. O objetivo é permitir que um cliente de terminal
recupere instruções, prompts, skills, projetos e chunks relevantes de documentos, e use ferramentas
sem precisar delegar o raciocínio à LLM configurada no Orqest.

| Artefato                                                                             | Estado                                                                                          |
| ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| [orqest-current.openapi.yaml](orqest-current.openapi.yaml)                           | Rotas existentes no código, com seus três tipos de autenticação. Não comprova deploy.           |
| [orqest-integration.proposed.openapi.yaml](orqest-integration.proposed.openapi.yaml) | Contrato proposto para acesso externo uniforme. Nenhum endpoint deste arquivo foi implementado. |

OpenAPI descreve contratos. Salvar/importar os arquivos no Swagger não publica endpoints,
não transforma uma sessão em credencial de máquina e não dá permissão sobre recursos.
Não há Swagger UI ou rota para servir estes contratos no servidor atual.

## Escopo corrigido: busca de chunks

O cliente de terminal precisa consultar a tool **`file_search`**, não baixar documentos completos.
O fluxo desejado é: recuperar instruções/prompts/skills e schemas do agente, escolher o projeto,
consultar documentos por linguagem natural e receber os chunks relevantes com suas fontes.
Corpo/frontmatter das skills continuam sendo instruções exportáveis; isso é separado dos documentos
indexados para busca. Downloads completos e binários saíram da proposta. As rotas legadas de download
permanecem no inventário atual apenas para descrever o que o servidor já possui.

## O que já existe

| Necessidade                              | Rota atual                                                                                                    | Autenticação e limite relevante                                                                                                |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Instruções e configuração do agente      | `GET /api/agents/v1/agents/{id}`                                                                              | OIDC de gestão; AGENTS USE e AGENT EDIT ou capacidade administrativa. Retorna `instructions`, referências de tools e skills.   |
| Descobrir agentes administráveis         | `GET /api/agents/v1/agents`                                                                                   | Mesmo OIDC/ACL; paginação `limit`/`cursor`, próximo cursor em `after`.                                                         |
| Resumo de projetos e agentes executáveis | `GET /api/agents/v1/catalog`, `GET /api/agents/v1/projects`                                                   | Chave de execução **tenant**. Não retorna contexto completo.                                                                   |
| Corpo e frontmatter de uma skill         | `GET /api/agents/v1/skills/{id}`                                                                              | OIDC de gestão, SKILLS USE e SKILL VIEW. A lista `/skills` retorna resumo, sem corpo.                                          |
| Arquivos da skill                        | `GET /api/agents/v1/skills/{id}/files`, `GET .../files/{relativePath}`                                        | Mesmo OIDC; leitura textual em JSON. Binários/arquivos grandes podem não ter `content`. Sem modo raw.                          |
| Arquivos do agente                       | `GET /api/agents/v1/agents/{id}/files`                                                                        | OIDC de gestão; metadados e `purposes`. Não há download de bytes nesta superfície.                                             |
| Instruções e referências do projeto      | `GET /api/projects/{projectId}`                                                                               | Sessão JWT e PROJECT VIEW; retorna documento atual, não uma projeção externa dedicada.                                         |
| Prompts reutilizáveis                    | `GET /api/prompts/groups`, `/groups/{groupId}`, `GET /api/prompts?groupId=...`, `GET /api/prompts/{promptId}` | Sessão JWT, permissões do recurso/herança do projeto e filtros de conteúdo.                                                    |
| Arquivos do projeto                      | `GET /api/files?projectId=...`                                                                                | Sessão JWT e acesso ao projeto. Lista por `file.projectId` e `project.fileIds`.                                                |
| Original do arquivo                      | `GET /api/files/download/{userId}/{file_id}`                                                                  | Sessão JWT e `fileAccess`; pode fazer streaming. Storage sem suporte retorna 501.                                              |
| Texto extraído do arquivo                | `GET /api/files/{file_id}/preview`                                                                            | Sessão JWT e `fileAccess`; estado pending/ready/failed, texto quando disponível. Não é o original.                             |
| URL temporária do arquivo                | `GET /api/files/download-url/{userId}/{file_id}`                                                              | Sessão JWT e `fileAccess`; depende do storage. Não substituir autenticação por URL permanente.                                 |
| Tools internas                           | `GET /api/agents/tools`                                                                                       | Sessão JWT; metadados do manifest. **Não** é `/api/agents/v1/tools`.                                                           |
| Funções do tenant                        | `GET /api/agents/tools/tenant-functions`                                                                      | Sessão JWT; inclui `inputSchema`, omite configuração de credenciais.                                                           |
| Tools MCP externas                       | `GET /api/mcp/tools`                                                                                          | Sessão JWT/MCP USE; metadados de servidores e ferramentas. Orqest atua como cliente MCP.                                       |
| Chamada direta de tool                   | `POST /api/agents/tools/{toolId}/call`                                                                        | Sessão JWT; hoje só `execute_code`, com `messageId` válido e permissão RUN_CODE. Não executa Meta Ads ou toda tool arbitrária. |
| Memórias pessoais                        | `GET /api/memories`                                                                                           | Sessão JWT, READ e regras de partição de agente.                                                                               |
| Biblioteca compartilhada                 | `GET /api/shared-memories`                                                                                    | Sessão JWT e SHARED_MEMORIES READ. `projectId` marca vínculos; não restringe a resposta às memórias vinculadas.                |
| Conversas/mensagens próprias             | `GET /api/convos`, `/api/convos/{id}`, `/api/messages/{conversationId}`                                       | Sessão JWT e propriedade da conversa. PROJECT VIEW não dá acesso a conversas de terceiros.                                     |

### As credenciais não são intercambiáveis

1. **Gestão externa:** `endpoints.agents.managementApi.auth`, OIDC issuer/audience e vínculo
   `clientId → userId/tenantId`. Não aceita sessão do navegador nem chave de execução como fallback.
2. **Execução de agentes:** `requireRemoteAgentAuth`, chave de execução ou OIDC conforme configuração.
   O catálogo `/catalog` e `/projects` exige especificamente `req.tenantApiKey` no handler atual.
3. **Interface:** `requireJwtAuth`, sessão autenticada e contexto do usuário/tenant. Não presumir que
   a chave de execução funcione em `/api/projects`, `/api/prompts`, `/api/files` ou `/api/memories`.

A presença de um agente no catálogo de execução não autoriza exportar seu prompt: a API de
configuração exige EDIT/capacidade administrativa. A proposta preserva essa restrição.

### Tenant, ID da chave e token

Cada tenant tem `tenantId`; pode ter várias chaves, com `id`, `keyPrefix` e token secreto `key`.
O ID serve para identificar/revogar a chave; não autentica sozinho. O token completo é devolvido
na criação, enquanto a listagem `GET /api/tenant-api-keys` devolve apenas metadados.

A chave tenant atual é criada para um usuário OWNER daquele tenant; validação exige que esse
principal continue ativo, no mesmo tenant e com papel OWNER. Não há scopes finos por ferramenta,
projeto ou operação em cada chave tenant neste modelo. A ACL ainda é calculada para o principal,
mas isso representa o poder do OWNER vinculado. Para restringir integração por usuário, o vínculo
OIDC de gestão permite escolher um principal apropriado; scopes por chave seriam trabalho adicional.

Na proposta, `/identity` mostra `tenantId`, `principalId`, `keyId` e método de autenticação.
`tenantId` é derivado no servidor; o cliente não pode mudar de tenant enviando outro ID no payload.

## Prompts e skills do agente

Há conteúdos diferentes que o cliente precisa distinguir:

- `agent.instructions`: instruções base do agente, exportáveis hoje pela API de gestão autorizada.
- `project.instructions`: instruções do projeto; `promptSnippets` contém trechos inline.
- `project.promptGroupIds`: referências a grupos reutilizáveis. Ler o grupo, seu `productionPrompt` populado e/ou versões autorizadas para obter o texto;
  `productionId` sozinho é apenas referência à versão de produção.
- `agent.skills`: IDs selecionados; buscar a skill para obter `body`, `frontmatter` e seus arquivos.
- `skills_enabled`, `skills_scope`, skills alwaysApply/deployment e ativação no turno afetam o
  contexto efetivo. Não tratar a lista de IDs como a composição completa das skills do runtime.
- Instruções MCP, memórias e contexto de arquivos são resolvidos durante execução. O prompt final
  varia com o turno. Não há endpoint atual de exportação desse contexto composto.

Não há `promptGroupIds` no contrato de configuração do agente revisado. Um texto copiado de um
prompt para `instructions` não preserva automaticamente referência, grupo e versão de origem.
Prompts de edges/subagentes também são configuração do agente, não uma biblioteca implícita.

O contrato proposto oferece `GET /api/integrations/v1/agents/{id}/context?projectId=...` para
retornar essas origens separadas, incluindo skills completas, schemas de tools e inventário dos arquivos pesquisáveis.
`instructionSections` identifica a origem de cada trecho; não promete reproduzir todo o
estado dinâmico e histórico de uma conversa sem uma sessão de execução.

## Recuperação de chunks com a tool existente

A implementação `api/app/clients/tools/util/fileSearch.js` já fornece:

1. `primeFiles`: prepara documentos do agente/projeto e aplica o filtro de acesso.
2. `createFileSearchTool`: aceita `{ "query": "pergunta em linguagem natural" }`.
3. Consulta o RAG interno em `/query`, com JWT curto gerado no servidor para o usuário.
4. Solicita `k=5` por arquivo, ordena por distância e mantém até 10 fontes globais.
5. Retorna conteúdo formatado e `artifact.file_search.sources` estruturado.

Cada fonte contém `fileId`, `fileName`, `content` (o chunk), `relevance`, `pages` e
`pageRelevance`. Páginas são 1-based quando disponíveis; podem estar ausentes/representadas por
array vazio. A relevância atual é `1 - distância`, não probabilidade. Não há `chunkId` estável ou
API de recuperar um chunk por ID nesse contrato; não inventar esses campos.

A tool já tenta o contexto do projeto, depois agente/ownership conforme a origem do arquivo.
`primeFiles` marca arquivos legados do projeto com o ID do projeto ativo quando o servidor fornece
`projectFileIds` autorizados. Esse caminho é diferente do middleware de download de bytes.
A lacuna de download legado descoberta antes não prova falha da recuperação por chunks e não é
pré-requisito para este escopo.

O gateway externo deve resolver o projeto e seus arquivos **no servidor**, após ACL e tenant.
`filterFilesByAgentAccess` confia nos IDs de projeto previamente autorizados pelo chamador interno;
não aceitar `projectFileIds`, `file_ids` ou `entity_id` arbitrários do terminal. Exigir FILE_SEARCH USE,
acesso ao agente e PROJECT VIEW quando o projeto participar da busca. FILE_CITATIONS controla
as instruções/âncoras visuais; as fontes estruturadas precisam manter referências autorizadas.

Arquivo listado ou `embedded=true` não garante índice disponível no RAG. Distinguir consulta sem
resultados, arquivo não indexado, RAG indisponível e falha parcial. A tool atual devolve mensagens
textuais em alguns desses casos; o adaptador externo deve dar estado explícito sem inferir sucesso
só porque recebeu texto. Não iniciar uma conversa com a LLM do agente para obter chunks; a consulta
continua dependendo do serviço de RAG/embeddings.

### Chamada de terminal proposta

A chamada usa o gateway de tools já descrito no contrato; não precisa de outro endpoint de download.
A rota abaixo **ainda não foi implementada**. `ORQEST_CURL_CONFIG` deve ser um arquivo local restrito
com o header Bearer da chave tenant ou da identidade OIDC autorizada.

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

Trecho da resposta proposta, preservando o artifact da tool:

```json
{
  "artifact": {
    "file_search": {
      "sources": [
        {
          "type": "file",
          "fileId": "file-1",
          "fileName": "contrato.pdf",
          "content": "Cancelamentos devem ser solicitados com 30 dias de antecedência.",
          "relevance": 0.87,
          "pages": [3],
          "pageRelevance": { "3": 0.87 }
        }
      ],
      "fileCitations": true
    }
  }
}
```

O OpenAPI inclui esse exemplo, o schema público de `query` e o formato do artifact. A chamada REST
atual `POST /api/agents/tools/{toolId}/call` continua aceitando apenas `execute_code`; não permite
chamar `file_search` externamente hoje. `RAG_API_URL/query` é serviço interno, não endpoint público
para receber a chave do tenant.

## Camada externa proposta

Base: `/api/integrations/v1`. A proposta aceita a chave de API tenant já existente e, como alternativa,
a identidade OIDC de máquina vinculada a um principal do tenant. Não adiciona um quarto mecanismo
de credenciais nem afrouxa ACLs de recursos. Essa aceitação unificada é nova e não muda a política
OIDC exclusiva das rotas atuais de gestão. A configuração efetiva ainda precisa ser validada na instalação.

| Superfície proposta                                                                  | Responsabilidade                                                                  |
| ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------- |
| `/identity`                                                                          | Confirmar tenant/principal e ID da chave, sem devolver o token.                   |
| `/agents`, `/agents/{id}`, `/agents/{id}/context`                                    | Instruções, prompts autorizados, skills e contexto para o cliente externo.        |
| `/agents/{id}/tools`                                                                 | Schemas das ferramentas autorizadas, incluindo `file_search`.                     |
| `POST /tools/{toolName}/call`                                                        | Executar tools sem iniciar LLM do agente; `file_search` recupera chunks e fontes. |
| `/projects`, `/projects/{projectId}`                                                 | Instruções e referências do projeto.                                              |
| `/projects/{projectId}/files`, `/agents/{id}/files`                                  | Descobrir documentos e escopo de busca; sem conteúdo integral ou URL.             |
| `/skills`, `/skills/{id}`, `/skills/{id}/files`, `/skills/{id}/files/{relativePath}` | Body, frontmatter e referências textuais das skills.                              |
| `/projects/{projectId}/prompts`, `/prompts/{id}`                                     | Snippets e grupos/versões autorizados.                                            |
| `/projects/{projectId}/memories`, `/memories`                                        | Memórias resolvidas, respeitando partições/consumidores.                          |
| `/conversations`, `/conversations/{id}/messages`                                     | Histórico do próprio principal, sem compartilhamento implícito por projeto.       |

O backend deve reutilizar `Projects/access`, `Projects/context`, `agents/reads`, `agents/files`,
`skills/management`, os projetores/inspeções de conteúdo e a tool `file_search` existente. A camada nova
não deve devolver documentos MongoDB brutos ou executar consultas/paths arbitrários enviados pelo cliente.

A API atual de gestão inclui `model_parameters` (mapa livre) e outras configurações do agente.
A projeção proposta para consumo externo omite `model_parameters`, `tool_options`, identidade Git
e configuração de ambientes. Não presumir que um mapa arbitrário de configuração está livre de
segredos só porque o agente é legível. Instruções, tools/skills selecionadas e referências de
arquivos são retornadas com projeção explícita e políticas de conteúdo existentes.

O catálogo de tools deve resolver builtins, MCP, actions e tenant functions no principal atual;
`tools: ["nome"]` e o manifest visual não bastam para obter schemas efetivos. O gateway deve
validar argumentos, role grants, vínculos de agente/projeto e limites na mesma execução. Um
`project_id` dentro dos argumentos não pode trocar o projeto autorizado no envelope externo.

Tools de aprovação, perguntas ao usuário, subagentes, sessões de código e background têm lifecycle.
A primeira implementação deve devolver `callable=false`/`runtime_required` para capacidades ainda
não suportadas, em vez de chamar `_call()` indiscriminadamente ou contornar aprovações. Escritas
precisam de idempotência e informação de falha parcial; uma repetição após timeout não pode recriar
campanhas silenciosamente. Credenciais das tools permanecem no servidor.

## Entrega de implementação e aceitação

1. Publicar contrato e endpoint de documentação com URLs/configuração reais da instalação.
2. Expor leituras com credencial de máquina vinculada ao tenant: agentes/instruções, skills/corpo/arquivos, projetos, prompts e memórias.
3. Expor `file_search`: preparar documentos autorizados, consultar RAG e preservar chunks/fontes no artifact.
4. Montar exportação de contexto com fontes/versionamento, sem executar LLM.
5. Habilitar outras tools por capacidades efetivamente suportadas, preservando aprovação, sessões e limites.
6. Acrescentar adaptador MCP usando os mesmos serviços, se desejado; não é requisito para `curl`.

Critérios mínimos para declarar o fluxo de terminal pronto:

- Credencial inválida, principal desativado, tenant diferente e ACL revogada são negados também na
  leitura/busca/chamada posterior à descoberta; não basta filtrar apenas a listagem.
- VIEW para executar agente não expõe instructions que atualmente exigem EDIT.
- Exportar um agente/projeto recupera instruções, snippets/prompts autorizados, skills e seus
  arquivos sem perder a origem. Skills desligadas/fora do escopo não são injetadas por acidente.
- Busca de documentos próprios, do agente e do projeto, inclusive vínculos legados autorizados,
  retorna somente chunks dentro do escopo, nunca documentos/IDs de outro tenant ou projeto.
- Resposta preserva texto do chunk, arquivo, página quando houver e relevância real. Ausência de
  página não vira página inventada; não adicionar IDs/offsets que a tool atual não produz.
- Busca vazia, ausência de arquivos, falta de índice, falha de autenticação do RAG, timeout e falha
  parcial têm respostas distinguíveis. Credencial tenant não é repassada ao serviço RAG.
- Fan-out de arquivos e duração são limitados; argumentos não podem alterar o projeto autorizado,
  forçar entity_id nem aumentar k. Busca não inicia chat com a LLM configurada no agente.
- Histórico permanece restrito ao principal; biblioteca compartilhada é filtrada por vínculo e
  permissão quando consumida como memória de projeto.
- Tools com escrita, contexto de projeto divergente, argumentos inválidos, efeito parcial,
  credencial ausente, timeout e aprovação têm cenários reais de aceite.

## Evidências e verificação

Fontes principais:

- `api/server/routes/agents/index.js`, `agents/management.js`, `agents/skills.js`, `agents/tools.js`.
- `packages/api/src/middleware/management.ts`, `middleware/remoteAgentAuth.ts`, `apiKeys/tenant.ts`.
- `packages/api/src/agents/{management,reads,files,skills}.ts`, `skills/management.ts`.
- `api/server/routes/{projects,prompts,memories,sharedMemories}.js`.
- `api/server/routes/files/{index,files}.js`, `middleware/accessResources/fileAccess.js`.
- `api/server/services/Projects/{access,context}.js`, `api/server/controllers/{tools,mcp,PluginController}.js`.

Schemas de agente/skill foram extraídos dos Zod exportados do pacote compilado; os demais schemas
atuais descrevem campos observados e permitem campos adicionais quando a rota devolve documentos
persistidos. A proposta usa projeções novas e não deve ser confundida com esses documentos atuais.

Validação dos contratos:

```sh
npx --yes --package @apidevtools/swagger-cli swagger-cli validate docs/openapi/orqest-current.openapi.yaml
npx --yes --package @apidevtools/swagger-cli swagger-cli validate docs/openapi/orqest-integration.proposed.openapi.yaml
npm exec --workspace=api -- jest test/openapi.spec.js --runInBand --coverage=false
```

O teste verifica referências, rotas/montagens reais, separação de autenticação e compatibilidade
com schemas Zod atuais. Não substitui teste HTTP autenticado, execução de tools ou recuperação
real de storage. Nenhum deploy, migração ou alteração de dados foi feito nesta revisão.

### Resultado da revisão inicial

- Dois contratos passaram no validador OpenAPI 3.0.3: 30 caminhos existentes; a proposta foi posteriormente ajustada para 20 caminhos com foco em chunks.
- Total: 198 testes focados passaram nas três execuções abaixo, sem contar a reprodução temporária.
- 91 testes de contrato, acesso a arquivos, download e preview passaram no workspace `api`.
- 96 testes de leitura/arquivos de agentes, skills e autenticação de gestão passaram em `packages/api`.
- 11 testes de chaves tenant e autenticação por chave passaram em `packages/api`.
- ESLint e Prettier passaram nos arquivos alterados/verificados; `git diff --check` limpo.
- O mock de `preview.spec.js` foi atualizado para fornecer a função real `runAsSystem`, cuja
  ausência fazia os testes retornarem 500 antes do caminho de preview. Os 15 cenários da suíte
  passaram após esse ajuste de uma linha; não houve alteração de comportamento em produção.
- A lacuna de vínculo legado foi reproduzida com MongoDB de teste, sem alterar dados reais.
- Graphify atualizou o índice AST; reportou 7 fontes com extração parcial e 86 arquivos sem nós.
  O índice não substitui a validação direta das rotas/schemas feita nesta revisão.

Esses resultados provam consistência do contrato com o código e comportamento dos cenários locais
citados. Não provam configuração OIDC da instalação, disponibilidade do storage real, deploy ou
existência das rotas propostas.

### Correção de escopo para chunks

A proposta removeu download/preview integral e download binário de skills. O fluxo de documentos
agora usa `file_search` e seu artifact estruturado. O inventário das 30 rotas atuais foi preservado;
isso não habilita a nova chamada externa. Verificações desta correção são executadas sobre o contrato
e as suítes existentes de `fileSearch`, sem chamadas ao RAG de produção.

Nesta correção, 38 testes de contrato e `fileSearch` passaram; o OpenAPI proposto foi validado
novamente. A busca real depende de índices e credenciais do RAG; não foi testada em produção.
