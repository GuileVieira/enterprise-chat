# Plano: memórias compartilhadas e portabilidade

Data: 2026-09-15. Status: proposta de implantação; funcionalidade ainda não implementada.

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

### 1. Contratos e armazenamento durável

- [ ] Inventariar leitores, escritores, exclusões, cache e permissões de memória/projeto/usuário.
- [ ] Criar schema, tipos, índices e métodos tenant-safe da biblioteca; adicionar referências ao projeto.
- [ ] Implementar autorização, versão, arquivo/restauração e autoria opcional.
- [ ] Atualizar permissões nos dois schemas e validar inicialização de roles.
- [ ] Provar que exclusão de usuário não remove compartilhadas nem torna projetos irrecuperáveis.

### 2. Vínculos, contexto e UX de compartilhamento

- [ ] Implementar listar, publicar, editar, copiar, vincular, desvincular, arquivar e restaurar.
- [ ] Integrar contexto em todos os consumidores, com deduplicação, conflitos e limites explícitos.
- [ ] Adicionar biblioteca e ações no editor de projeto; invalidar queries após mutações.
- [ ] Adicionar resumo de impacto na exclusão de usuário e fluxo para responsável de projetos.

### 3. Portabilidade e seleção múltipla

- [ ] Definir DTOs JSON/CSV, limites e validação reutilizável de importação/exportação.
- [ ] Implementar preview, confirmação, resultados parciais, versões e idempotência de retries.
- [ ] Implementar mapa de referências e IDs novos por tenant de destino.
- [ ] Entregar seleção em massa, progresso, resolução de conflitos e relatório de falhas.
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
