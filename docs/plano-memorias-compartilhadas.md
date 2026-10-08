# Plano: memórias compartilhadas e portabilidade

Data: 2026-09-15. Status em 2026-10-07: implementação existente, auditoria e correções em execução;
rollout e aceite no ambiente alvo ainda não comprovados.

## Objetivo

Compartilhar memórias entre projetos do mesmo tenant, preservar conhecimento quando seu criador
for excluído e importar/exportar várias memórias, inclusive entre tenants, sem colisões de IDs,
vazamento de permissões ou sobrescrita silenciosa.

## Decisão de produto

Adotar biblioteca da organização com memórias vinculáveis a vários projetos. Manter memórias
pessoais e memórias exclusivas do projeto. Oferecer cópia independente como alternativa ao vínculo.

| Alternativa                          | Vantagem                          | Custo ou limite                               | Decisão                |
| ------------------------------------ | --------------------------------- | --------------------------------------------- | ---------------------- |
| Copiar entre projetos                | Simples; permite adaptações       | Cópias divergem                               | Ação secundária        |
| Referenciar memória de outro projeto | Fonte única                       | Dependência de acesso e existência da origem  | Não usar como base     |
| Biblioteca do tenant                 | Fonte única; independe do criador | Exige clareza sobre edição e audiência        | Base da implantação    |
| Coleções compartilhadas              | Seleção de grandes grupos         | Mais regras; inclusão pode mudar vários chats | Evolução após uso real |

Compartilhar não significa injetar toda a biblioteca no chat. Apenas memórias vinculadas ao projeto
entram nesse contexto, respeitando permissões e limites.

## Estado atual confirmado no código

- `packages/data-schemas/src/schema/memory.ts`: memória pessoal exige `userId`, possui `tenantId`
  e partição opcional `agentId`. A chave não identifica globalmente uma memória.
- `packages/data-schemas/src/schema/project.ts`: projetos armazenam `memories` embutidas e
  `memoryKeys` como referências por texto.
- `packages/api/src/utils/projectContext.ts`: referências por chave são resolvidas nas memórias
  do usuário informado; não garantem conteúdo compartilhado estável.
- `api/server/controllers/UserController.js`: exclusão administrativa e autoexclusão chamam
  `deleteAllUserMemories`; o método em `packages/data-schemas/src/methods/memory.ts` apaga por usuário.
- `api/server/routes/memories.js` e `packages/api/src/memory/`: já existem validação, proteção de
  conteúdo, permissões, controle de versão e operações individuais a reutilizar.
- `client/src/components/SidePanel/Memories/MemoryPanel.tsx` e
  `client/src/components/Project/ProjectMemoryEditor.tsx`: interfaces atuais individuais.

Esta análise é local. Não comprova estado de dados ou implantação em produção.

## Modelo e invariantes

### Propriedade

- Preservar `MemoryEntry` pessoal e suas partições nesta primeira entrega.
- Criar entidade de memória compartilhada pertencente ao tenant, com ID gerado pelo servidor,
  `tenantId`, `key`, `value`, contagem de tokens, autoria opcional, versão, datas e estado de arquivo.
- Autoria não é propriedade nem autorização. Excluir o criador não exclui a entidade compartilhada.
- Adicionar referências por ID ao projeto, com unicidade do vínculo. Manter memórias locais embutidas
  inicialmente; não exigir migração destrutiva para disponibilizar a biblioteca.
- Memórias compartilhadas ativas têm chave única dentro da biblioteca do tenant. Duplicatas legadas
  não são fundidas automaticamente. Memórias pessoais mantêm identidade por usuário e partição.
- Edição exige versão esperada; conflito retorna erro recuperável e opção de recarregar.

### Acesso

- Toda consulta e mutação valida tenant no servidor; IDs conhecidos não conferem acesso.
- Biblioteca é explicitamente visível ao tenant. A publicação deve informar essa audiência.
  Conteúdo restrito permanece pessoal ou em projeto com ACL própria.
- Reutilizar permissões existentes de leitura/criação/edição quando adequadas. Definir permissão
  específica de gestão da biblioteca, inicialmente para OWNER/ADMIN; não converter permissão de
  edição pessoal em edição irrestrita de conhecimento empresarial.
- Vincular exige leitura da memória e `PROJECT EDIT`; consumir exige `PROJECT VIEW` e permissões
  efetivas aplicáveis ao contexto. Desvincular exige `PROJECT EDIT`.
- Editar original exige gestão da biblioteca. Exportar exige leitura de cada item; importar exige
  criação no destino; substituir exige edição do item existente.
- Contagem e nomes de projetos consumidores não podem revelar projetos sem acesso. Mostrar
  detalhes apenas dos projetos autorizados e aviso genérico de outros consumidores quando cabível.
- Novas permissões entram no Zod e no schema Mongoose de roles. Rebuild de data-schemas,
  reinício para `initializeRoles()` e invalidação de cache de usuários/roles fazem parte do rollout.

### Contexto dos chats

- Resolver IDs compartilhados em lote, dentro do tenant e após ACL do projeto.
- Deduplicar por identidade estável, não apenas pelo texto da chave.
- Ao vincular chave já presente no projeto, exigir escolha: manter local ou usar compartilhada.
  Para conflitos legados, memória local prevalece e UI sinaliza conflito; não depender da ordem do prompt.
- Não mudar precedência das memórias pessoais/agente sem teste dos consumidores atuais.
- Aplicar filtros de conteúdo e limites no caminho compartilhado. Mostrar itens não usados por limite
  ou indisponibilidade; não truncar silenciosamente nem contornar configuração administrativa.
- Ferramentas automáticas de memória continuam escrevendo na partição pessoal/agente. Publicação
  ou alteração de memória compartilhada requer ação explícita autorizada.
- Cobrir chat normal, agentes, assistentes e API externa que carregam contexto de projeto.

## UX

### Navegação e ações

- Filtros: **Pessoais**, **Deste projeto**, **Biblioteca da organização**.
- Lista com busca, origem, última alteração, seleção múltipla e quantidade selecionada.
- **Adicionar da biblioteca**: selecionar várias memórias e vincular ao projeto.
- **Publicar na biblioteca**: copiar conteúdo pessoal/local para entidade da organização, explicando
  audiência; oferecer troca da memória local pelo vínculo após publicação bem-sucedida.
- **Editar original**: informar impacto nos projetos consumidores antes de salvar.
- **Criar cópia independente**: copiar para projeto sem sincronização futura.
- **Remover deste projeto**: remover vínculo, preservando original.
- **Arquivar na biblioteca**: explicar impacto, permitir restauração; vínculos ficam identificáveis
  como indisponíveis e voltam a funcionar ao restaurar. Sem descarte definitivo automático na v1.
- Usar componentes existentes, navegação por teclado, foco dos diálogos, feedback inline/toast e
  `useLocalize()`, com PT-BR primeiro e inglês como fallback.

### Exclusão do criador

- Compartilhadas permanecem ativas; exibir “Usuário removido” quando não houver autoria resolvível.
- Projetos e suas memórias locais precisam de responsável administrativo recuperável no mesmo tenant.
  Auditar ACL e todos os caminhos de exclusão antes de prometer continuidade de acesso.
- Antes de excluir usuário, mostrar resumo: compartilhadas preservadas, projetos que precisam de
  responsável e pessoais que serão removidas. Permitir exportação/transferência autorizada das pessoais.
- Nunca publicar pessoais automaticamente. Retenção integral de pessoais após exclusão exige política
  própria de arquivo restrito; não faz parte da publicação automática proposta.
- Excluir projeto remove vínculos, não originais da biblioteca. Oferecer exportação/publicação das
  memórias locais antes da exclusão do projeto.

## Importação e exportação em massa

### Formatos

- JSON versionado: backup portátil com conteúdo e metadados necessários para reimportação.
- CSV UTF-8: edição em planilha, colunas `key` e `value`; modelo para download e erros por linha.
- Markdown e importação de projetos completos ficam fora da primeira entrega.
- Exportar selecionadas, todas filtradas ou todas acessíveis, indicando quantidade e escopo.
  Seleção de todas filtradas deve abranger páginas, não somente itens renderizados.
- JSON usa referências locais ao pacote; não precisa expor IDs reais, tenant, ACL ou dados do criador.
  Metadados opcionais de origem são informativos, nunca autorização.

Exemplo mínimo de contrato proposto:

```json
{
  "format": "orqest-memories",
  "version": 1,
  "items": [{ "ref": "m1", "key": "tom_de_voz", "value": "Direto e acolhedor" }]
}
```

### IDs e tenants

- Importação como novas memórias gera IDs novos no destino, mesmo quando arquivo contém IDs antigos.
- Tenant vem exclusivamente do contexto autenticado; criador passa a ser o importador.
- Permissões, usuários, projetos e agentes da origem nunca são reaplicados automaticamente.
- Usuário escolhe destino: biblioteca, projeto autorizado ou partição pessoal/agente autorizada.
- Mapa `ref do pacote → ID novo` mantém identidade durante o lote. Se futuramente houver exportação
  de relações, todos os vínculos internos deverão usar esse mapa; referências externas ficam pendentes
  de escolha local. Na v1, vincular os itens ao projeto escolhido no destino.
- Atualização de existentes usa correspondência aprovada com IDs locais e versão esperada.
  Coincidência com ID da origem nunca autoriza atualização.

### Fluxo e conflitos

1. Selecionar arquivo e destino; validar formato, versão, tamanho e número de itens no servidor.
2. Mostrar prévia com novas, iguais, conflitantes e inválidas; conteúdo antes/depois quando houver edição.
3. Chave e valor idênticos no mesmo destino: ignorar por padrão. Mesma chave e valor diferente:
   manter existente por padrão; usuário pode substituir ou criar cópia com chave válida e distinta.
4. Detectar duplicatas também dentro do arquivo. Não normalizar conteúdo nem renomear silenciosamente.
5. Confirmar plano; revalidar ACL, versões, filtros e quotas no momento da escrita.
6. Exibir resultado por item e totais; oferecer relatório e repetição somente das falhas.

### Execução e segurança do lote

- Usar lotes limitados e progresso; evitar fila ou infraestrutura nova até volume medido exigir.
  Definir limites de arquivo/itens e tamanho de lote após medir payload, tempo e limites existentes.
- Reutilizar parser CSV instalado se existir; não dividir linhas por vírgulas. Suportar aspas,
  quebras de linha e Unicode. Exportação para planilha precisa neutralizar fórmulas de modo documentado;
  JSON permanece formato de restauração fiel.
- Preview não reserva autorização. Alteração posterior do destino retorna conflito por item.
- Persistir identificador de operação e resultado por item, escopados ao tenant, para que retry após
  timeout não crie outra memória. Distinguir retry da mesma operação de nova importação do arquivo.
- Reimportação independente passa pela prévia novamente; hash/conteúdo ajuda a sugerir iguais,
  nunca a sobrescrever automaticamente.
- Escrita individual é atômica; lote pode terminar parcialmente. UI e relatório devem dizer exatamente
  o que foi aplicado. Não anunciar rollback total sem transação que o garanta.
- Reutilizar controle de quota/concorrência existente onde aplicável e definir equivalente para
  biblioteca; contagem de tokens é recalculada no servidor, nunca confiada ao arquivo.
- Não usar `Model.collection.*` nem `Model.bulkWrite()` direto. Se necessário, `tenantSafeBulkWrite()`.
- Logs registram ator, destino, operação e contagens, sem conteúdo completo das memórias.

## Fases de implementação

Checkboxes de implementação assinalados abaixo correspondem a código e evidência local, descritos
no registro de execução. Tarefas de inventário real, implantação, métricas e expansão permanecem
abertas até a prova no ambiente alvo. Implementação local não fecha implantação.

### 1. Contratos e armazenamento durável

- [x] Inventariar leitores, escritores, exclusões, cache e permissões de memória/projeto/usuário.
- [x] Criar schema, tipos, índices e métodos tenant-safe da biblioteca; adicionar referências ao projeto.
- [x] Implementar autorização, versão, arquivo/restauração e autoria opcional.
- [x] Atualizar permissões nos dois schemas e validar inicialização de roles.
- [x] Provar que exclusão de usuário não remove compartilhadas nem torna projetos irrecuperáveis.

### 2. Vínculos, contexto e UX de compartilhamento

- [x] Implementar listar, publicar, editar, copiar, vincular, desvincular, arquivar e restaurar.
- [x] Integrar contexto em todos os consumidores, com deduplicação, conflitos e limites explícitos.
- [x] Adicionar biblioteca e ações no editor de projeto; invalidar queries após mutações.
- [x] Adicionar resumo de impacto na exclusão de usuário e fluxo para responsável de projetos.

### 3. Portabilidade e seleção múltipla

- [x] Definir DTOs JSON/CSV, limites e validação reutilizável de importação/exportação.
- [x] Implementar preview, confirmação, resultados parciais, versões e idempotência de retries.
- [x] Implementar mapa de referências e IDs novos por tenant de destino.
- [x] Entregar seleção em massa, progresso, resolução de conflitos e relatório de falhas.
- [ ] Validar exportação A → importação B → nova exportação, preservando conteúdo e isolamento.

### 4. Migração e implantação gradual

- [ ] Inventariar por tenant: pessoais/partições, locais, `memoryKeys`, órfãs e chaves repetidas.
- [ ] Criar backup e dry-run sem escrita, com contagens e problemas por projeto.
- [ ] Manter pessoais e locais existentes; publicação para biblioteca é explícita.
- [ ] Não converter `memoryKeys` usando arbitrariamente usuário atual ou criador do projeto.
      Mostrar origem/candidatos a usuário autorizado; ambiguidade requer resolução explícita.
- [ ] Manter leitura legada até referências serem resolvidas; marcar pendências na UI e evitar dupla
      injeção dos itens já convertidos. Migração repetida não duplica memórias nem vínculos.
- [ ] Implantar backend compatível antes da UI; habilitar piloto por tenant com mecanismo existente.
- [ ] Medir falhas, duração dos lotes, conflitos, limites e resultado da exclusão de um usuário de teste.
- [ ] Expandir após aceite; remoção dos campos legados fica para migração separada e verificada.

## Validação e critérios de aceite

| Cenário                                   | Evidência exigida                                                        |
| ----------------------------------------- | ------------------------------------------------------------------------ |
| Memória vinculada a dois projetos         | Editar original atualiza ambos; cópia independente permanece igual       |
| Dois usuários do mesmo projeto            | Recebem mesma memória compartilhada, sem dependência do criador          |
| Excluir criador por admin e autoexclusão  | Memória e vínculos sobrevivem; gestão do projeto continua possível       |
| Remover vínculo / excluir projeto         | Original continua disponível aos demais consumidores                     |
| Arquivar/restaurar                        | Contexto deixa de usar/restaura memória; UI informa estado               |
| Tenant A tentando IDs de B                | Leitura, edição, vínculo, exportação e importação recusam acesso cruzado |
| Importar arquivo de A em B                | IDs novos, conteúdo preservado, autoria local, nenhuma ACL herdada       |
| Retry após resposta perdida               | Uma única criação por item da mesma operação                             |
| Importar novamente / conflito concorrente | Prévia correta; nenhuma sobrescrita silenciosa                           |
| CSV/JSON inválido, grande ou malicioso    | Erro claro; limites e filtros mantidos; sem fórmula executável no CSV    |
| Lote parcialmente aplicado                | Contagens exatas e retry somente das falhas                              |
| Migração com chave ambígua                | Nenhuma associação adivinhada; pendência visível; rerun seguro           |
| Limite de contexto e partições de agente  | Sem bypass de quota, duplicação ou regressão de acesso                   |

Usar Jest focado e MongoMemoryServer para persistência, tenant, concorrência e exclusão; testes de UI
para seleção, conflitos e estados. Reutilizar suites existentes. Rodar typechecks dos workspaces
afetados separadamente; verificar `dist/` antes de testes que dependem de pacotes compilados.
Não rodar build completo por padrão. Revisão visual e teclado dos fluxos completos antes do rollout.
Após alterações de código, executar `graphify update .` e revisar seu diff separadamente.

## Rollback e conclusão

- Desabilitar criação/importação pela mesma habilitação gradual em caso de incidente; preservar dados.
- Manter leitor compatível com memórias compartilhadas já criadas. Voltar a binário antigo que ignora
  vínculos não é rollback seguro do contexto; preferir correção compatível ou restauração coordenada.
- Backup anterior à migração não substitui dados criados depois. Registrar operações e validar
  restauração antes de qualquer reversão destrutiva.
- Considerar implantação concluída apenas após todos os critérios de aceite passarem no ambiente
  alvo. Separar evidência local, commit, deploy, migração e comportamento real.

Este documento entrega o plano. Não autoriza nem comprova execução de migração, deploy ou alteração
de dados de produção.

## Estado local verificado em 2026-09-16

- Biblioteca, vínculos, arquivamento/restauração com versão, publicação explícita e importação/exportação
  foram implementados localmente. A UI oferece biblioteca global, biblioteca do projeto, publicação de
  memória pessoal e publicação de memória local com troca opcional pelo vínculo após sucesso.
- Importação mostra prévia, decisões de conflito, retry com o mesmo `operationId`, estado de processamento
  e relatório JSON baixável. Exportação oferece selecionadas, todas filtradas (consulta server-side além da
  página atual) e todas acessíveis.
- Evidência local UI: specs focadas de `SharedMemoryPortability` e `SharedMemoryLibrary` passaram; typecheck
  do cliente passou. Isto não prova migração remota, deploy, ACL real, entrega de contexto ou produção.
- Validação integrada local: seis suites (`SharedMemoryPortability`, `SharedMemoryLibrary`,
  `ProjectMemoryEditor`, `ProjectsList`, `UsersPage`, `DeleteAccount`) passaram com 29 testes. Não houve
  render manual: as portas locais esperadas 3080/3090 não estavam em uso; havia Vite em 5179 fora desta
  workspace. Os testes de componentes são a evidência visual/teclado disponível nesta execução.
- Verificação final: typecheck do cliente, as seis suites e `git diff --check` passaram; `graphify update .`
  foi executado na raiz. O grafo reportou 86 arquivos sem nós e 7 com sintaxe parcial, portanto não é
  evidência de build ou comportamento em produção.

Resolução legada local: a UI apresenta `resolved`, `ambiguous`, `inaccessible` e `missing`; só candidatos
do próprio usuário podem ser escolhidos e a ação envia a chave e o ID selecionado ao endpoint idempotente.
Também há aviso de compartilhadas arquivadas, ausentes, filtradas ou fora do limite no contexto do projeto.
Isto foi coberto por spec de componente, não por navegador ou ambiente remoto.

Pendências UX/rollout: validação A→B entre tenants, acessibilidade fim a fim e todos os critérios da tabela
acima. Nenhuma migração, habilitação de tenant ou deploy foi executado.

Evidência local backend: builds focados de data-provider, data-schemas e API passaram. As suites de rota,
ACL real e continuidade de exclusão passaram com 46 testes; parser/contexto tipado com 29; persistência
MongoDB com 3. Typecheck passou em data-provider e data-schemas. O typecheck da API contém somente o erro
basal não alterado em `src/skills/import.ts:833` (`Array.at` exige lib ES2022). ESLint focado e
`git diff --check` passaram. Isto não comprova backup/restauração, migração, habilitação gradual, deploy ou
comportamento em produção.

## Execução e auditoria — 2026-10-07

O objetivo completo continua em execução. Esta seção substitui a descrição inicial de
"funcionalidade ainda não implementada", mas não declara implantação concluída.

Correções feitas nesta execução:

- Exportação de selecionadas e todas acessíveis não reaplica busca; somente todas filtradas envia
  `search`. A rota valida tipos/formato/estado e rejeita filtros estruturados em vez de ampliar o
  escopo silenciosamente.
- CSV aceita BOM UTF-8, CRLF e campos com quebras/aspas; exige exatamente `key,value` no cabeçalho.
  Fórmulas com whitespace inicial também são neutralizadas. JSON mantém conteúdo fiel; CSV para
  planilha pode adicionar apóstrofo e não substitui JSON como backup de restauração.
- Importação que substitui memória da biblioteca exige `SHARED_MEMORIES.UPDATE`, além de criação.
  Referências do pacote precisam ser strings válidas. Auditoria do lote inclui `durationMs`.
- Vincular/copiar e consultar consumidores exige leitura da biblioteca. Contexto compartilhado
  falha fechado quando a role não pode ser resolvida.
- Cópia independente para projeto passa por filtro de conteúdo, lock e quota do projeto.
- Mutações invalidam biblioteca, pessoais, projetos, candidatos legados, status de contexto e
  impacto de exclusão. Chaves de queries ficam em `packages/data-provider/src/keys.ts`.
- Importador da biblioteca recebe o projeto atual. Portabilidade pessoal carrega a partição de
  agente selecionada. A UI oferece modelo CSV, totais por status e toast de aviso para lote parcial.
- Edição/arquivamento mostra projetos consumidores autorizados e aviso genérico dos demais. API
  informa apenas quantidade visível, sem nomes ou quantidade exata de projetos inacessíveis.
- Inventário desliga `autoCreate` e `autoIndex`; um teste executa o CLI contra Mongo vazio e prova
  que nenhuma coleção ou índice foi criado.
- Conflito de vínculo oferece manter locais ou usar compartilhadas. A troca exige timestamp da
  prévia, remove locais conflitantes e cria vínculos na mesma atualização; projeto editado após a
  prévia retorna 409 e mantém o conteúdo concorrente. Três testes Mongo e dois de UI cobrem escolhas
  e versão antiga. O editor local acompanha conteúdo atualizado no servidor quando não há rascunho.
- Rotas de memórias compartilhadas recusam usuário sem tenant com 403 antes de consultar/escrever.
  Teste de regressão comprova ausência de escrita. As suites de rota/ACL passaram com 30 testes.
- Smoke real de navegador encontrou que `OGDialogTemplate` fecha a janela nas ações legadas: isso
  encerrava a importação ao clicar em Prévia. Importador agora usa botão próprio, mantendo diálogo
  aberto para prévia, confirmação, resultado e retry. Smoke passou no Chrome com backend real,
  login real em tenant sintético, Mongo descartável, escolha de vínculo pelo teclado, arquivo JSON
  baixado e lido, importação pela UI e atualização da biblioteca. Spec reproduzível:
  `e2e/specs/mock/shared-memories.spec.ts`; captura em
  `e2e/specs/.test-results/shared-memories-resolves-a-cfa7b-nd-imports-library-memories-chrome/shared-memories.png`.
- Contador do projeto inclui vínculos compartilhados. `projectSchema` expõe `sharedMemoryIds` na
  leitura; create/update genéricos continuam omitindo o campo para exigir a rota com ACL própria.
  Verificação do contrato com Zod confirmou leitura e recusa de vínculos em escrita genérica.
  Captura final foi inspecionada: contador 1, original vinculado e memória importada na biblioteca.

Reprodução do smoke isolado (provedores/modelo são fixtures locais; Mongo é descartável):

```bash
E2E_CHROMIUM_CHANNEL=chrome E2E_USE_MEMORY_MONGO=true \
E2E_PASSTHROUGH_ENV=SHARED_MEMORY_LIBRARY_TENANTS SHARED_MEMORY_LIBRARY_TENANTS='*' \
npm exec -- playwright test --config=e2e/playwright.config.mock.ts shared-memories.spec.ts --workers=1 --reporter=line
```

O wildcard acima pertence apenas ao subprocesso do teste descartável. Não configura allowlist de
produção. A execução final passou em 16 segundos. Typecheck do cliente e ESLint passaram; 30 testes
de rota/ACL, 7 da biblioteca, 8 de portabilidade, 6 do editor e 21 da página de projeto passaram nas
execuções focadas. O fixture de login fixa `lang=en`, coerente com seus seletores em inglês.

### Aceite local ampliado

A execução ampliada do mesmo smoke passou em 30,1 segundos e agora prova:

- Publicação pela UI, vínculo por teclado, exportação JSON baixada/lida e importação com prévia,
  resultado e atualização da biblioteca.
- Edição do original refletida em dois projetos vinculados; cópia em outro projeto mantém o
  conteúdo anterior e não recebe vínculo. Arquivo remove a memória do contexto; restauração
  recupera o vínculo; desvincular preserva o original.
- Chat real com provider/modelo de teste recebe canário do projeto vinculado. Controle negativo
  no projeto da cópia não recebe o canário atualizado. O fixture aplica o `systemRunnable` real e
  remove o comando de asserção do texto inspecionado, evitando falso positivo por eco da pergunta.
- Autoexclusão sem responsável retorna 409. Com responsável válido, transfere projetos, preserva
  biblioteca/vínculos/locais, remove pessoais e recusa o token do usuário excluído com 401.
- OWNER sem capacidade administrativa é recusado com 403 ao excluir outro usuário. ADMIN executa
  exclusão com transferência; consulta direta do Mongo verifica usuário removido, memória preservada
  e ACL do responsável com `permBits=15` no tenant correto.
- Resumo anterior à exclusão informa uma pessoal, três compartilhadas preservadas e três projetos
  necessitando responsável no cenário sintético.

Falhas reais corrigidas no ciclo ampliado:

- Consulta de 2FA na autoexclusão omitia `tenantId`; agora inclui o campo. Transferência usava a
  assinatura de `PermissionService` no método de dados; agora usa argumentos posicionais, como a
  criação de projeto, com scope do tenant do projeto mesmo sob exclusão administrativa global.
- Limpeza administrativa chamava `deleteConvos` sem filtro; agora usa filtro vazio e `allowEmpty`
  para limpeza idempotente depois da fase de checkpoints.
- Salvar memórias locais preserva metadados dos itens inalterados, incrementa versões dos editados
  e condiciona escrita ao snapshot lido. Importação com prévia anterior a uma edição normal é recusada.
- Conflito de vínculo também considera `memoryKeys`: escolha explícita mantém a referência legada
  ou a substitui pelo vínculo, sem apagar memória pessoal nem repetir injeção após conversão.
- Edição da biblioteca trata quota, chave repetida e tamanho excessivo como erro controlado. Memória
  arquivada não consome quota ativa até restaurar; restauração já ativa não cobra quota duas vezes.
- Prévia de importação não devolve `existing.value` bloqueado por uma política posterior. Enums
  precisam ser strings; arrays não passam por coerção. CSV com extensão maiúscula é reconhecido.
- Gestor da biblioteca pode editar/arquivar independentemente de `PROJECT EDIT`; leitor pode
  selecionar itens para exportar. Cópia/vínculo/desvínculo continuam exigindo edição do projeto.
- Falha de edição mantém diálogo/rascunho e oferece recarregar original. Conflitos 409 invalidam
  cache para recuperar versão atual. Publicação exige salvar rascunho primeiro; troca da memória
  local só ocorre se conteúdo ainda corresponde ao snapshot publicado, com aviso quando preservado.

`node api/test/tenant-api-context.js` passou com API keys reais, dois usuários autorizados, leitor
real de projeto, três fontes de memória (local, pessoal e compartilhada), arquivos e recusa após
revogação de ACL. O script inicializa roles/índices e usa o verificador real de principal ativo.
As suites de rota/ACL passaram com 40 testes; controlador/exclusão com 49; métodos de projeto e
segurança com 14. Specs de editor, biblioteca e cache e typechecks focados também passaram.
Estas evidências são locais; não comprovam migração ou implantação remota.

Evidência de aceitação local:

| Requisito                                  | Evidência atual                                                                                                                                           | Limite da prova                                                       |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Exportar A, importar B, exportar novamente | `api/server/routes/sharedMemories.test.js`: pacote exportado real, igualdade da nova exportação, IDs distintos, autoria B e retry sem duplicação          | MongoMemoryServer e HTTP de teste; autenticação injetada, não staging |
| Todas filtradas além da página atual       | Mesmo teste: lista de 50, total 73, exportação de 73                                                                                                      | Dados sintéticos locais                                               |
| Isolamento e ACL de projeto                | `sharedMemories.acl.test.js`: grants reais, viewer/editor e tenant estrangeiro; roles inicializadas como no startup                                       | Não comprova configuração de roles em produção                        |
| Parser, conflitos e proteção de CSV        | `packages/api/src/memory/shared.spec.ts`                                                                                                                  | Não comprova abertura em aplicativos de planilha                      |
| Retry e durabilidade                       | Rotas com Mongo + `packages/data-schemas/src/models/sharedMemory.spec.ts`                                                                                 | Não comprova recuperação operacional após crash do processo           |
| Continuidade de projetos na exclusão       | Unitários e smoke com autoexclusão/ADMIN reais, consulta Mongo de ACL e memória preservada                                                                | Ambiente descartável; ainda não é aceite remoto                       |
| Contexto e indisponibilidade               | Chat com controle negativo, API keys de dois usuários, Assistants V1/V2 com captura de instruções no provedor e resposta persistida de agente configurado | Provedores/modelos são fixtures locais; ainda falta aceite remoto     |
| UI e cache                                 | Smoke de biblioteca, publicação pessoal/local, edição, cópia, arquivo/restauração, vínculo, portabilidade e retry parcial com quota real                  | Ambiente isolado; ainda falta aceite remoto                           |
| Inventário sem escrita                     | Teste do CLI em banco vazio com zero coleções após execução                                                                                               | Inventário do tenant piloto ainda não executado                       |

Pendências que impedem declarar o plano concluído:

1. Executar aceite desses mesmos fluxos no ambiente alvo. Chat normal, API keys, dois usuários,
   assistentes V1/V2, agente configurado, propagação entre projetos, cópia independente e
   concorrência de importação/edição/publicação têm evidência local.
2. Validar acessibilidade e configurações reais no piloto. Smoke de importação parcial/retry,
   publicação pessoal/local, biblioteca, vínculo, edição, cópia, arquivo/restauração e exclusões passou.
3. Identificar ambiente e tenant piloto; conferir configuração e permissões reais. Nesta workspace
   não existe `.env`. Nesta auditoria foi iniciado backend com MongoMemoryServer descartável,
   fixtures locais de provedores e login real de usuário OWNER em tenant sintético para o smoke.
   Isso não verifica nem habilita qualquer tenant real. Chromium empacotado estava ausente;
   o smoke usa Chrome instalado (`E2E_CHROMIUM_CHANNEL=chrome`).
4. Inventariar tenant piloto, verificar backup/restauração, habilitar allowlist, reiniciar backend
   compatível antes da UI e executar aceite entre tenants no ambiente alvo.
5. Medir métricas do piloto e expandir somente após aceite. Nenhuma operação remota, migração,
   habilitação de tenant, deploy, commit ou push foi executada nesta auditoria.

Verificações realizadas nesta execução: 25 testes da rota de memórias, ACL real, continuidade de
exclusão e contexto do servidor; 32 testes nas sete suites de UI/cache; 9 testes do parser CSV/JSON,
suite de contexto tipado e 3 de durabilidade MongoDB. Builds focados de data-provider/API,
typechecks de data-provider/data-schemas/API/cliente, ESLint dos arquivos alterados e
`git diff --check` passaram. Os números de suites sobrepostas não devem ser somados como uma
única execução. `graphify update .` foi executado; limitações de extração do grafo não substituem
nenhuma destas verificações.

Última rodada: 40 testes de rota/ACL passaram, typechecks de API/data-schemas/cliente e ESLint focado
passaram. Smoke ampliado passou em 30,1s com publicação pela UI, resumo de impacto, pessoais
removidas, biblioteca/locais/vínculos preservados e ACL no tenant correto após exclusões reais.
Edição mantém rascunho em erro, recarrega original explicitamente e invalida cache em conflito 409.
Publicação concorrente preserva edição local posterior e só troca por vínculo quando o snapshot
ainda corresponde ao conteúdo publicado. `graphify update .` terminou após as mudanças de código.

### Fechamento dos smokes locais de portabilidade e consumidores

- Publicação pessoal pela UI preserva a pessoal e cria entidade da organização. Publicação local
  com escolha de troca remove a local somente após criar o vínculo; conteúdo preservado foi lido
  novamente via API. Resumo de exclusão do cenário passou a informar cinco compartilhadas.
- Lote parcial esgota quota de 10.000 tokens através de escritas reais, verificando contagem
  retornada/persistida pelo backend. Primeiro item é criado; segundo falha por quota. Após arquivar
  memórias que ocupavam espaço, Retry envia só `p2`, mantém `operationId`, termina com dois criados
  e zero falhas; lista final prova uma única memória de cada chave. Erro agora informa limite de
  tokens, em vez de apenas “Write failed”.
- Assistants V1/V2 foram criados e usados por rotas reais. Captura no provedor local de cada
  `POST /threads/:id/runs` contém `ASSISTANT_MEMORY_CANARY` nas instruções, sem depender de eco da
  pergunta. Agente configurado recebeu a mesma memória; mensagem final persistida contém a
  asserção de contexto aprovada pelo modelo de teste.
- Dois smokes de ciclo/retry passaram juntos em 25,3s; smoke de assistentes/agente passou em 18,8s.
  O teste de assistentes consulta a mensagem persistida após admissão, pois a API de agentes retorna
  identificador de geração iniciada, não a resposta final naquele primeiro HTTP.

Faltam identificação do piloto, inventário/dados reais, backup/restauração, deploy/ativação, métricas
e aceite no ambiente alvo. Nenhum resultado local acima habilita automaticamente tenants reais.

### Inventário técnico e preflight

| Caminho                                                                                                                     | Responsabilidade e limite                                                                                     |
| --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `api/server/routes/memories.js`, `packages/api/src/memory/handlers.ts`, `packages/data-schemas/src/methods/memory.ts`       | Pessoais/partições, leitura protegida, escrita individual com versão/quota e exclusão por usuário             |
| `packages/api/src/agents/memory.ts`                                                                                         | Ferramentas set/delete usam userId/agentId pessoais; não publicam na biblioteca automaticamente               |
| `api/server/routes/projects.js`, `packages/data-schemas/src/methods/project.ts`                                             | Locais, referências legadas, ACL e atualização de array com preservação de metadados/versões                  |
| `api/server/routes/sharedMemories.js`, `packages/api/src/memory/shared*.ts`                                                 | Biblioteca, publicação, vínculo, cópia, contexto/status, conflitos, import/export e idempotência              |
| `api/server/services/Projects/context.js`, `packages/api/src/utils/projectContext.ts`                                       | Leitor central após PROJECT VIEW; IDs em lote por tenant, filtros, deduplicação e limite explícito            |
| `Endpoints/agents/initialize.js`, `controllers/agents/{client,openai,responses}.js`, `controllers/assistants/chatV{1,2}.js` | Consumidores do leitor central para chats, agentes e assistentes                                              |
| `api/server/controllers/UserController.js`, `api/server/routes/admin/users.js`                                              | Exclusão/autoexclusão, transferência de responsável/ACL antes da remoção e preservação da biblioteca          |
| `packages/data-schemas/src/methods/user.ts`                                                                                 | Invalida cache de documento autenticado ao atualizar/excluir usuário; token antigo foi recusado no smoke      |
| `client/src/data-provider/SharedMemories/queries.ts`, `packages/data-provider/src/keys.ts`                                  | Invalidação de biblioteca, pessoais, projetos, contexto, candidatos e impacto; conflito 409 força atualização |
| `packages/data-provider/src/permissions.ts`, `packages/data-schemas/src/schema/role.ts`                                     | READ/CREATE/UPDATE declarados nos dois contratos; startup inicializa roles; gestão não deriva de PROJECT EDIT |

Inventário CLI agora distingue partições pessoais/agente, pessoais órfãs, identidades duplicadas,
projetos sem responsável existente, referências legadas ambíguas/ausentes e vínculos compartilhados
ausentes/arquivados. Projeta apenas chaves das memórias locais, nunca seus valores. Teste de Mongo
povoado verifica contagens e ausência de valores secretos; teste de banco vazio comprova zero
coleções/índices criados. O relatório continua sendo diagnóstico, não backup nem autorização para
resolver associações automaticamente. A execução desse preflight no piloto real ainda está aberta.

Última verificação do preflight: testes com Mongo vazio/povoado passaram; rodada completa de
rotas/ACL passou com 41 testes. ESLint, `git diff --check` e atualização AST do Graphify terminaram.

Bloqueio de conclusão: ambiente alvo e tenant piloto não foram identificados após a solicitação
inicial e os turnos de validação local. Não é possível executar inventário/backup/migração,
habilitação, deploy, métricas ou aceite remoto de um tenant não identificado. O objetivo completo
não foi declarado concluído; as alterações continuam sem commit/push/deploy.
