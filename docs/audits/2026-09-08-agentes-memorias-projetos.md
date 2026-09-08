# Auditoria de bugs — agentes, memórias e projetos

Data: 08/09/2026. Base: `0a7da45ad8b8501434ee7d80317d4ab8263463e6`.

**Estado atual:** oito achados corrigidos localmente; commits e validação no apêndice. As evidências abaixo descrevem a base auditada, e suas linhas podem ter mudado após as correções.

**Resultado da auditoria original: 8 achados — 1 crítico, 2 altos, 5 médios.** Prioridade imediata: fechar vínculos de arquivos sem autorização e entrada irrestrita de campos em projetos.

Escopo: ciclo de vida e permissões de agentes; leitura/extração e CRUD de memórias; CRUD, ACL, arquivos e contexto de projetos; editor de memórias do projeto. Auditoria do código local, sem acesso a produção, chamadas a LLM ou alterações funcionais. Não demonstra ocorrência de incidentes em produção nem ausência de outros bugs.

Criticidade: **crítica/P0** = exposição entre tenants; **alta/P1** = quebra de autorização ou integridade de projetos; **média/P2** = perda de contexto, alterações não persistidas ou bloqueio funcional sob condições específicas. Classificação orienta prioridade; não é pontuação CVSS.

| ID  | Criticidade | Falha                                                                 | Evidência                                                                                  |
| --- | ----------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| A01 | Crítica/P0  | Vínculo de arquivo sem ACL permite retorno de arquivo de outro tenant | Métodos e consulta reproduzidos com MongoDB real temporário; encadeamento HTTP por leitura |
| A02 | Alta/P1     | Criação/edição aceita campos de identidade do projeto                 | Reprodução com métodos atuais e MongoDB temporário                                         |
| A03 | Alta/P1     | Listagem devolve projetos mesmo sem ACL VIEW                          | Método reproduzido; composição da rota confirmada no código                                |
| A04 | Média/P2    | PATCH de memória ignora limite total de tokens                        | Fluxo de rota e persistência inspecionados                                                 |
| A05 | Média/P2    | Falha no agente de extração elimina memórias já carregadas            | Fluxo de execução e consumidor inspecionados                                               |
| A06 | Média/P2    | CREATE de agentes também controla editar, excluir e reverter          | Cadeia de middlewares inspecionada                                                         |
| A07 | Média/P2    | Renomear memória faz criação e exclusão sem atomicidade               | Operações e tratamento de erro inspecionados                                               |
| A08 | Média/P2    | Edição durante salvamento fica marcada como salva sem persistir       | Estado React e mutation inspecionados                                                      |

## A01 — Arquivos externos herdando acesso de um projeto controlado pelo solicitante

**Evidências:** [POST de projetos](../../api/server/routes/projects.js#L148), [validação usada apenas no PUT](../../api/server/routes/projects.js#L50), [persistência dos campos recebidos](../../packages/data-schemas/src/methods/project.ts#L86), [listagem de arquivos](../../api/server/routes/files/files.js#L74), [contexto do projeto](../../api/server/services/Projects/context.js#L137).

**Gatilho:** usuário com PROJECTS USE/CREATE conhece um `file_id` externo e cria projeto com esse ID em `fileIds`. O POST não chama validação de vínculo. O projeto recebe ACL do criador. Ao listar seus arquivos, a rota verifica acesso ao projeto, mas consulta a união de `file.projectId` e `project.fileIds` dentro de `runAsSystem`, sem filtro de tenant ou autorização individual dos IDs vinculados.

**O que pode acontecer:** retorno de nome, caminho e demais metadados do arquivo de outro tenant. Dependendo da estratégia de armazenamento e validade de URLs, pode haver acesso ao conteúdo. O contexto do projeto também resolve esses IDs sem escopo de tenant; o consumo posterior por cada ferramenta tem filtros adicionais, portanto não foi demonstrada leitura do conteúdo por LLM entre tenants.

**Reprodução realizada:** criar arquivo sintético no tenant B; criar projeto no tenant A apontando seu ID; executar os métodos atuais e a consulta usada pela listagem. Resultado: um arquivo retornado com `tenantId = audit-b`. Não foi uma chamada HTTP autenticada completa nem teste de download. A consulta padrão exclui o campo `text`.

**Outro caminho na mesma falha:** PUT aceita chaves pontuadas, como `fileIds.0`, que não passam pelo `Array.isArray(fileIds)` do validador e são repassadas a `$set`. Esse caminho foi identificado no código, não executado no ensaio.

**Como resolver:** validar esquema de entrada estrito no POST/PUT; rejeitar chaves pontuadas e campos inesperados. Autorizar cada vínculo por tenant e FILE VIEW ou PROJECT VIEW no projeto de origem. Reutilizar a validação nos dois verbos. Nas consultas privilegiadas, aplicar tenant explícito e política explícita para arquivos legados sem tenant; não confiar só na lista gravada no projeto. Auditar vínculos existentes antes de remover qualquer referência.

**Aceite:** POST e PUT rejeitam arquivo de outro tenant e arquivo inacessível no mesmo tenant; atualização pontuada é rejeitada; arquivos legitimamente compartilhados continuam acessíveis. Testar também a resolução de contexto do chat e downloads.

## A02 — Campos de identidade controlados pelo corpo da requisição

**Evidências:** [POST sem esquema de entrada](../../api/server/routes/projects.js#L148), [PUT com req.body integral](../../api/server/routes/projects.js#L199), [spread após campos confiáveis](../../packages/data-schemas/src/methods/project.ts#L86), [update irrestrito](../../packages/data-schemas/src/methods/project.ts#L122), [guard de save dependente de strict](../../packages/data-schemas/src/models/plugins/tenantIsolation.ts#L194).

**Gatilho:** enviar `projectId` ou `user` junto dos campos editáveis. Os tipos TS omitem esses campos, mas não validam JSON em runtime. Na criação, `...data` vem depois de `projectId`, `user` e `tenantId`. Na edição, o corpo inteiro vai para `$set`.

**O que pode acontecer:** identidade/autor do documento diverge das ACLs já concedidas. Trocar `projectId` deixa conversas e arquivos ligados ao ID anterior, quebra URLs e contexto. Com `TENANT_ISOLATION_STRICT` desligado, a criação também aceita um `tenantId` diferente do contexto e grava no tenant indicado. Isso permite inserir projeto em outro tenant; não prova por si só acesso posterior a esse projeto.

**Reprodução realizada:** criação com `projectId` e `user` escolhidos preservou ambos; edição alterou ambos; criação com tenant B dentro do contexto A gravou tenant B em modo não estrito. O middleware de update bloqueia alteração cruzada de `tenantId`; essa proteção não deve ser confundida com proteção de `projectId`/`user` ou do POST.

**Como resolver:** esquema runtime com lista explícita de campos editáveis. Fixar identidade e tenant exclusivamente no servidor após validar entrada. Não permitir troca de identidade no update. Adicionar `runValidators: true` como complemento; sozinho não impede mass assignment de campos válidos do schema. Validar divergência de tenant no save independentemente do modo de compatibilidade.

**Aceite:** tentativas de modificar `projectId`, `user`, `tenantId`, `_id` e campos internos retornam erro de entrada; documento, vínculos e ACL permanecem intactos. Testar modos strict e não strict.

## A03 — Listagem de projetos ignora ACL na parcela chamada ownProjects

**Evidências:** [composição da listagem](../../api/server/routes/projects.js#L113), [getProjects sem parâmetro/filtro de usuário](../../packages/data-schemas/src/methods/project.ts#L31), [exportação dos métodos reais](../../api/models/index.js#L6).

**Gatilho:** usuário sem MANAGE_PROJECTS não possui VIEW em determinado projeto do tenant, por revogação ou dados legados. A rota chama `getProjects(req.user.id)` esperando projetos próprios; o método ignora o argumento e executa `Project.find({})`. O middleware restringe tenant, mas não ACL.

**O que pode acontecer:** projeto sem VIEW aparece na resposta completa, incluindo instruções, memórias e IDs vinculados. A união posterior com projetos compartilhados não remove os indevidos. Mesmo com zero ACLs acessíveis, a rota retorna essa lista. Não é necessário conseguir abrir o detalhe para obter esses campos.

**Reprodução realizada:** três projetos do tenant retornaram mesmo passando usuário sem relação com eles. A ausência de ACL na listagem é confirmada pela composição da rota; o ensaio não simulou login. Compartilhamento padrão amplo pode esconder o problema até a revogação.

**Como resolver:** filtrar projetos próprios por `user` explicitamente ou retornar apenas a união autorizada por ACL. Manter exceção MANAGE_PROJECTS, limitada ao tenant. Não alterar o significado de `getProjects()` globalmente sem revisar chamadores.

**Aceite:** após retirar VIEW e grants herdados, listagem não inclui documento nem campos. Proprietário, usuário com VIEW e gestor autorizado continuam vendo os projetos correspondentes.

## A04 — Limite de tokens pode ser ultrapassado editando memórias

**Evidências:** [limite verificado no POST](../../api/server/routes/memories.js#L125), [PATCH sem verificação equivalente](../../api/server/routes/memories.js#L199), [setMemory sem teto](../../packages/data-schemas/src/methods/memory.ts#L63).

**Gatilho:** conta próxima de `memory.tokenLimit` edita memória curta para valor maior, ainda dentro de `charLimit`, ou renomeia aumentando o valor.

**O que pode acontecer:** soma persistida ultrapassa teto configurado, aumentando contexto e custo potencial. O indicador limita a porcentagem a 100%, ocultando a magnitude do excesso. Não implica necessariamente falha do provedor: isso depende da janela de contexto e demais mensagens.

**Como resolver:** validar `totalAtual - tokensDaMemoriaAntiga + tokensNovos` nos dois caminhos do PATCH. Centralizar garantia de orçamento também para escrita automática. Considerar concorrência entre POST/PATCH para o teto ser efetivo, pois leitura seguida de gravação isoladas não o garantem.

**Aceite:** aumentar, renomear e criar perto do teto respeitam o orçamento; reduzir memória continua permitido. Duas escritas simultâneas não ultrapassam o total.

## A05 — Extração indisponível faz chat perder memórias existentes

**Evidências:** [leitura antecipada](../../api/server/controllers/agents/client.js#L560), [retorno vazio ao não carregar agente](../../api/server/controllers/agents/client.js#L608), [initializeAgent fora do catch de loadAgent](../../api/server/controllers/agents/client.js#L624), [segundo retorno vazio](../../api/server/controllers/agents/client.js#L651), [consumidor no chat](../../api/server/controllers/agents/client.js#L415).

**Gatilho:** extração automática habilitada com ID de agente removido/inacessível, ou inicialização indisponível. `sharedMemories` já contém memórias pessoais e de OWNER; mesmo assim, ausência do agente retorna `undefined`.

**O que pode acontecer:** chat responde sem orientações já armazenadas, parecendo “esquecer”. Se `initializeAgent` lançar, a exceção sai de `useMemory` e pode interromper a montagem da resposta. As memórias no banco não são apagadas.

**Como resolver:** separar leitura de memórias da preparação opcional do extrator. Em falha deste, retornar contexto já carregado e registrar erro; não iniciar processamento automático incompleto. Preservar os gates de permissão e opt-out existentes.

**Aceite:** agente de extração inexistente, inicialização nula e erro de inicialização preservam contexto pessoal/OWNER e permitem resposta; processamento automático fica desligado naquele turno.

## A06 — Desligar CREATE impede manutenção de agentes existentes

**Evidências:** [definição de checkAgentCreate](../../api/server/routes/agents/v1.js#L19), [PATCH](../../api/server/routes/agents/v1.js#L120), [DELETE](../../api/server/routes/agents/v1.js#L162), [revert](../../api/server/routes/agents/v1.js#L180).

**Gatilho:** administrador desliga AGENTS CREATE para impedir novas criações; usuário mantém USE e ACL EDIT/DELETE de agente existente.

**O que pode acontecer:** editar configuração, excluir ou reverter passa a retornar 403 antes da ACL específica. Isso impede manutenção de agentes existentes e contraria a regra do projeto: CREATE controla criações futuras. GET e execução não são demonstrados como bloqueados por este achado.

**Como resolver:** manter CREATE em criar/duplicar; usar USE mais ACL EDIT/DELETE nos verbos de manutenção. Revisar controles equivalentes na UI para não manter bloqueio visual após ajuste do backend.

**Aceite:** CREATE=false bloqueia criar/duplicar, mas permite editar/reverter/excluir quando a ACL da operação existe; sem ACL, continua 403.

## A07 — Renomeação de memória pode deixar estado parcial

**Evidências:** [cria nova chave](../../api/server/routes/memories.js#L240), [depois exclui antiga](../../api/server/routes/memories.js#L251), [métodos separados](../../packages/data-schemas/src/methods/memory.ts#L16).

**Gatilho:** falha entre criação e exclusão, ou outra sessão atualiza a memória antiga durante a renomeação.

**O que pode acontecer:** resposta 500 com ambas as chaves presentes; nova tentativa encontra conflito 409. Uma atualização concorrente na chave antiga pode ser apagada pelo delete posterior. Chat pode carregar instruções duplicadas ou contraditórias.

**Como resolver:** renomear e atualizar o mesmo documento com uma operação atômica, filtrada por usuário/tenant e chave atual; preservar unicidade e tratar conflito como 409. Para detectar atualização concorrente, incluir versão/updated_at esperado. Evitar duas escritas quando uma atualização resolve.

**Aceite:** conflito de nome preserva documento original; falhas não deixam duplicata; edição concorrente produz conflito explícito, sem apagar alteração silenciosamente.

## A08 — Editor marca alterações posteriores como salvas

**Evidências:** [estado e handleSave](../../client/src/components/Project/ProjectMemoryEditor.tsx#L15), [onSuccess incondicional](../../client/src/components/Project/ProjectMemoryEditor.tsx#L50), [só botão Salvar desabilitado](../../client/src/components/Project/ProjectMemoryEditor.tsx#L68), [inputs continuam editáveis](../../client/src/components/Project/ProjectMemoryEditor.tsx#L90), [mutation apenas invalida consultas](../../client/src/data-provider/mutations.ts#L1169).

**Gatilho:** usuário salva valor A; antes da resposta, digita B. Requisição contém A. `onSuccess` define `hasChanges=false` mesmo com B no estado local.

**O que pode acontecer:** tela mostra B, indicador de pendência some e Salvar fica desabilitado; recarregar recupera A. Usuário pode perder a alteração acreditando estar persistida. Identificado por fluxo React; não reproduzido em navegador nesta auditoria.

**Como resolver:** solução mínima: desabilitar inputs e adicionar/remover durante mutation. Se edição durante salvamento for necessária, comparar revisão/snapshot enviado com estado atual antes de limpar pendência. Exibir falha de salvamento de forma visível.

**Aceite:** com resposta atrasada, tentativa de editar durante save é bloqueada ou continua marcada como pendente após sucesso; apenas conteúdo efetivamente enviado aparece como salvo.

## Verificação realizada e limites

- Graphify usado para localizar relações; fontes atuais conferidas diretamente. Query resumida não foi tratada como prova de bug.
- Ensaio: `/private/tmp/orqest-audit-20260907.cjs`, executado com `node /private/tmp/orqest-audit-20260907.cjs`. Carrega os arquivos TS atuais de modelos, métodos e contexto de tenant com Jiti; usa Mongoose e MongoMemoryServer reais, sem mocks de DB. Cinco assertions de cenários concluídas, exit code 0.
- Dados exclusivamente sintéticos; Mongo temporário desconectado e parado em `finally`. O script não lê `.env` nem conecta a Mongo de produção.
- Resultado do ensaio: vínculo retorna metadados de tenant B; criação aceita projectId/user; update altera projectId/user; listagem ignora usuário; criação aceita tenantId externo em modo não estrito.
- O script em `/private/tmp` é artefato temporário desta sessão. Evidências, condições e critérios de reprodução duráveis estão descritos acima.
- A04–A08: análise estática dos fluxos indicados. Sem alegação de teste HTTP, navegador ou produção. Sem build completo ou E2E; não houve correção funcional a validar.
- Proteções existentes conferidas: middleware tenant filtra consultas normais e bloqueia update cruzado de tenantId; contexto checa PROJECT VIEW antes de carregar projeto existente; busca de memórias de OWNER filtra tenant; agentes validam referências de edges/subagents e arquivos em seus próprios fluxos. Essas proteções não neutralizam as falhas específicas acima.

## Ordem de correção

1. **A01 + A02:** esquemas estritos, ACL de vínculos e filtros de tenant; depois auditar referências existentes com leitura prévia.
2. **A03:** listagem exclusivamente autorizada.
3. **A05 + A04:** preservar contexto em falhas e impor teto efetivo de memória.
4. **A06 + A07 + A08:** permissões de manutenção, renomeação atômica e estado confiável de salvamento.

Não foram feitos commit, push, deploy ou correções de aplicação nesta auditoria.

## Correções e validação local

| Achado              | Commit      | Correção                                                                                                            |
| ------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------- |
| A01/A02             | `cd0128ce6` | Validar campos de projeto e vínculos; filtrar arquivos por tenant inclusive nas consultas privilegiadas.            |
| A03                 | `89434d53f` | Restringir projetos próprios pelo usuário solicitado, preservando listagem compartilhada via ACL.                   |
| A05                 | `f3b3ed0ef` | Preservar memórias carregadas quando preparação da extração falha.                                                  |
| A04/A07             | `4bda52623` | Validar quota na persistência, serializar escritas por usuário e renomear o mesmo documento com controle de versão. |
| A06                 | `f784a10fa` | Separar CREATE de manutenção; manter USE e ACL da operação nas rotas e controles da interface.                      |
| A08                 | `2c8a35285` | Bloquear editor durante envio; preservar conteúdo e mostrar erro quando falha.                                      |
| Regressão adicional | `f85ba8d04` | Baixar texto indexado do MongoDB antes de exigir estratégia de storage.                                             |

### Testes

Suítes focadas passaram em suas execuções, sem E2E ou acesso à produção:

- data-schemas: projetos e segurança (13 testes); memórias (5).
- API: rotas/contexto de projetos (33); carregamento de memórias (11 selecionados); permissões de agentes com MongoDB e middlewares reais (7); arquivos e ACL (43).
- packages/api: ferramenta e processador de memória (26).
- client: editor de memórias do projeto com resposta atrasada e falha HTTP (2).
- Lint focado sem erros; `files.js` mantém aviso anterior de `EnvVar` não utilizado.
- Artefatos de data-schemas, data-provider e packages/api reconstruídos localmente via configuração Rollup existente. Sem build completo.
- Typecheck final do client falhou em arquivos não alterados; nenhum diagnóstico nos arquivos modificados, incluindo o novo teste do editor.
- Typechecks de data-schemas e packages/api continuam com erros em arquivos não alterados (tipos Mongoose e SDKs). Não representam validação integral aprovada.

O Jest da API exigiu transformação Babel do pacote ESM Mistral, usando configuração temporária que estende `api/jest.config.js`, inclui `@mistralai` nas exceções de `transformIgnorePatterns` e aplica `babel-jest` com `@babel/preset-env` para Node atual. A configuração temporária não altera produção.

### Limites operacionais

- Quota usa `User.memoryWriteLock` sem expiração: evita que um escritor pausado ultrapasse o teto após perder uma lease. Crash pode deixar bloqueadas novas escritas daquele usuário (409); leituras continuam disponíveis. Recuperação administrativa: confirmar que o processo escritor parou, identificar usuário/tenant e token exatos, então remover somente o lock correspondente. Não limpar locks por tempo decorrido com escritores ainda ativos. Nenhum lock de produção foi alterado.
- Arquivos legados sem `tenantId` só entram quando seu proprietário pertence ao tenant do projeto. Referências históricas inconsistentes exigem reconciliação explícita; não foi executada migração de dados existentes. Não existe `ResourceType.FILE` nesta base: vínculo exige propriedade do arquivo ou VIEW no projeto de origem, dentro do tenant.
- Graphify atualizado; sua extração registra arquivos sem nós e quatro arquivos parcialmente interpretados. Fontes e testes prevalecem sobre o grafo. Artefatos gerados ficaram fora dos commits funcionais.
- Commits locais apenas. Sem push, deploy, restart de backend ou confirmação de comportamento em produção.
