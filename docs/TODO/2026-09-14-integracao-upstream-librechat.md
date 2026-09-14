# Integração LibreChat → Orqest: esforço, riscos e plano

Data: 14/09/2026. Escopo desta entrega: análise e planejamento. **Nenhum merge upstream foi aplicado, nenhum código funcional foi alterado e nenhum deploy foi realizado nesta análise.**

## 1. Conclusão executiva

A atualização é uma integração grande de plataforma e produto. A simulação identificou **414 arquivos com conflitos**, entre **589 arquivos modificados nos dois lados**. Outros **175 arquivos sobrepostos mesclam automaticamente**, mas ainda podem perder comportamento local. Não existe evidência para prometer ausência de regressão antes de implementar e executar os gates abaixo.

Recomendação: integrar o snapshot upstream completo numa branch isolada, preservando as duas histórias; resolver por contrato funcional, com Sol no backend, Terra no frontend/plataforma e coordenação central de interfaces e Git. Luna pode reorganizar documentação, traduções e inventário, sem decidir regras de autorização. Não usar `Sync fork`, `-X ours`, `-X theirs` ou substituição global de arquivos.

Estimativa preliminar consolidada: **35–55 dias de engenharia, 280–440 horas**, incluindo estabilização e margem para incompatibilidades sem conflito textual. Com dois executores, coordenação/revisão e ambiente disponível: **aproximadamente 5–8 semanas de calendário**. Não é soma de horas de agentes nem compromisso de prazo. A faixa inclui inventário de migrações e desenho dos ensaios; execução de migração de dados, operação de produção e novas funcionalidades ficam fora dela. A previsão de calendário pressupõe dois executores disponíveis em tempo integral, coordenação/revisão diária e ausência de espera por infraestrutura; dependências sequenciais impedem dividir simplesmente os dias por dois. Reestimar após estabilizar dependências e o primeiro fluxo autenticado de agente + projeto.

## 2. Snapshot e isolamento comprovados

| Item | Estado analisado |
|---|---|
| Fork | `GuileVieira/enterprise-chat` |
| Branch original | `chore/upstream-main-integration` |
| HEAD local | `36b1461b6a6bb90edfdc79dd1abd136d70ab87b4` |
| Upstream | `danny-avila/LibreChat`, branch `main` |
| Snapshot upstream | `7fe9a45894f28547b0da498daa02e27355718b02` |
| Ancestral comum | `75d196f31264f729960e1743cc4c61665a9afbc7`, 18/05/2026 |
| Nova branch criada | `integratin/upstream-main-2026-09-14` |
| Worktree isolada | `/Users/guilherme/Projetos/orqest-upstream-2026-09-14` |
| Estado da nova branch | Mesmo HEAD local; nenhum merge aplicado |

O commit `36b1461b6` contém o trabalho anterior de API keys por tenant e catálogo de contexto. Não é integração upstream. O relatório fica na workspace original em `docs/TODO`; a worktree de integração permanece preparada, sem mudanças de código. Arquivos derivados de `graphify-out/` já estavam sujos e foram preservados.

Foi executado `git fetch upstream main` e uma simulação com `git merge-tree --write-tree --name-only HEAD upstream/main`. O exit code 1 indica os conflitos esperados. A árvore sintética `7aa0d542b4830e670bb1163413a2631d976fc186` contém marcadores de conflito; não é resultado compilável, commit de merge nem artefato de release.

## 3. Dimensão medida

| Métrica | Quantidade |
|---|---:|
| Commits exclusivos do fork | 546 |
| Commits exclusivos upstream | 1.348 |
| Caminhos alterados no fork desde a base | 1.579 |
| Caminhos locais sem Graphify | 1.073 |
| Caminhos alterados upstream | 4.370 |
| Caminhos sobrepostos | 589 |
| Caminhos com conflito | 414 |
| Conflitos de conteúdo | 390 |
| Conflitos add/add | 4 |
| Conflitos modify/delete | 20 |
| Sobrepostos sem conflito textual | 175 |
| Arquivos de teste com conflito | 46 |
| Arquivos de locale com conflito | 15 |

Distribuição principal: `client/src` 234; `api/server` 63; `packages/data-schemas` 32; `packages/api` 27; `packages/client` 24; `packages/data-provider` 16. Os 18 restantes abrangem manifests, Docker, configuração, documentação, `api/app` e estratégia de autenticação.

Há 1.026 blocos textuais de conflito na árvore sintética; 147 estão no lockfile. Não equivalem a bugs independentes ou unidades de esforço. Resolver manifests e regenerar o lock com npm é melhor que resolver 147 blocos manualmente.

Evidências completas: [métricas](upstream-2026-09-14-evidencias/metricas.json), [414 caminhos com conflito](upstream-2026-09-14-evidencias/conflitos.txt), [sobreposição](upstream-2026-09-14-evidencias/sobreposicao.txt). Contagens representam diferenças de caminhos, não quantidade de funcionalidades.

## 4. O que o upstream traz

As referências abaixo estão fixadas no snapshot, não na `main` móvel. Fonte primária: [repositório upstream nesse commit](https://github.com/danny-avila/LibreChat/tree/7fe9a45894f28547b0da498daa02e27355718b02).

| Área | Mudança relevante | Implicação local |
|---|---|---|
| API de agentes | M2M auth (`aec212192`), gestão read/create/update/delete (`2fe872d2e`, `2ffa9ec42`, `ab0d74b49`, `5840e2f2a`) | Comparar identidade, escopos, revogação e limites; não substituir chave tenant local só porque existe M2M |
| Execução | Host sem dependência de request (`30124f21b`), memória/accounting (`95e1a5c9f`), cancelamento (`a785a6196`) | Portar contexto e identidade para o novo fluxo compartilhado de execução |
| Arquivos/tools | Gestão de arquivos (`0fa313443`), gates de código/file search (`a3fc3b9db`), recursos negados (`29971f188`) | Preservar ACL herdada de projeto também nas novas superfícies de API |
| Projetos | Private chat projects (`baa23a8e2`) e novo shell (`0b995065b`) | `chatProject` upstream e `Project` Orqest não são contratos equivalentes |
| Build | Migração para tsdown (`6bc75d24c`) em pacotes | Revisar exports CJS/ESM e tipos; build não substitui typecheck |
| UI | Novo Settings registry, Router 7, Vite 8, troca de ícones | Portar extensões para componentes ativos; evitar arquivos órfãos |
| CI/config | Mudanças de jobs, índices e deployment | Seleção automática de testes não garante cobertura das extensões Orqest |

Comparação dos manifests local→upstream: npm 11.10.0→11.13.0; TypeScript 5.0.4→5.9.3 nos pacotes; `@librechat/agents` 3.3.0→3.8.6; Mongoose 8.23.1→8.24.1; Vite 7.3.1→8.2.2. CI upstream usa Node 24; isso não prova que todos os ambientes locais já exigem Node 24. Validar engines efetivos, imagem e dependências nativas antes de mudar o contrato documentado.

## 5. Riscos prioritários e decisões

### P0 — API tenant desaparece da interface

Upstream remove `SettingsTabs/Data/Data.tsx` e `AgentApiKeys.tsx`, ambos modificados localmente. A nova superfície usa `Nav/Settings/registry.tsx` e `SettingsTabs/ApiKeys/ApiKeys.tsx`. Portar a entrada `TenantApi` para o registry com visibilidade owner/superadmin. Chaves de agente por usuário e chaves tenant continuam conceitos distintos; não reutilizar autorização de uma para a outra.

### P0 — projeto diferente recebe contexto ou perde ACL

Ambos disputam `/api/projects` e `conversation.projectId`: Orqest usa projeto com UUID e ACL compartilhável; upstream usa ChatProject privado com ObjectId. Preservar o contrato Orqest nessa rota/campo é a opção de menor risco. Não fundir `chatProject` upstream com `Project` de negócio Orqest por coincidência de nome. Documentar namespaces, IDs e contratos dos dois. O fluxo externo deve resolver agente + projeto Orqest, checar tenant e `PROJECT VIEW`, e só então carregar instruções, memórias e arquivos. Validar esse fluxo no novo host de agentes e nas rotas de chat, Responses e ferramentas.

### P0 — arquivo ou memória cruza fronteira de tenant

Revisar pontos compartilhados de autorização e acesso a dados, inclusive APIs novas de gerenciamento. Preservar arquivo com ACL direta **ou** acesso pelo projeto, e bloquear anexação de IDs estrangeiros. Identidade da chave tenant deve continuar vinculada ao owner válido e ao tenant da credencial, nunca a um header arbitrário.

### P0 — schema de credencial e nova fundação tenant

A versão upstream de AgentApiKey não contém o contrato local `scope: tenant` e os métodos específicos de gestão. Aceitar essa versão integralmente pode fazer a chave tenant aparecer em listas pessoais e perder a fixação do tenant. Ausência no upstream não significa que o Git necessariamente apagará o campo: o risco depende da resolução e do novo chamador. Provar compatibilidade com documentos já persistidos é obrigatório.

Upstream amplia policy, typed criteria, guards de save/distinct e probe do driver. Integrar essa fundação e garantir registro/plugin/contexto para todos os modelos exclusivos Orqest. Testar em `TENANT_ISOLATION_STRICT=true`, incluindo bootstrap de auth em system context limitado e retorno ao contexto do tenant após autenticação/multipart.

### P1 — memória particionada e manutenção de agentes

Upstream acrescenta partições de memória por agentId, enquanto Orqest tem lock, quota, rename atômico e memória do OWNER. Definir quota por usuário versus partição antes de migrar; preservar a política atual até decisão explícita, e fazer REST/inline convergirem na mesma escrita protegida. Não mudar quota silenciosamente por conveniência.

Os handlers upstream de update/delete de agentes exigem CREATE além das verificações de acesso. Reconciliar com a regra local: desligar CREATE bloqueia criação futura, não manutenção autorizada ou uso do que já existe. Testar UPDATE/DELETE autorizado sem CREATE, assim como grants de VIEW no tenant ao criar/duplicar por OWNER.

### P1 — runtime, tipos e dependências circulares

Resolver manifests/exports na ordem dos pacotes; produzir `dist` antes de testes consumidores. Build verde não comprova tipos nem ausência de ciclos. Rodar typechecks explícitos e detector compatível com o novo build, revisar as arestas entre pacotes e impedir importação de legado `api/` por `packages/api`. Não adicionar `any`, `@ts-ignore` ou casts amplos para silenciar erros da integração.

### P1 — merge limpo apaga comportamento

Os 175 caminhos sobrepostos sem conflito e as extensões que permanecem intactas exigem revisão dos chamadores. Arquivos novos de TenantApi podem sobreviver enquanto o componente que os monta foi removido. O mesmo vale para rotas sem mount, permissões sem schema e helpers sem chamadores.

### P1 — configuração/dados

Reconciliar ordem dos middlewares, mounts, YAML, Docker e permissões sem importar segredos ou defaults upstream indiscriminadamente. Inventariar migrations/índices; nenhum script de migração deve rodar em produção como efeito colateral desta integração.

## 6. Matriz de contratos locais obrigatórios

| Contrato | Gate de aceitação |
|---|---|
| Isolamento tenant | Consultas e mutações cross-tenant negadas, inclusive ferramentas e IDs injetados; sem `Model.collection.*`/`bulkWrite` bruto |
| API keys tenant | Hash persistido, segredo só na criação, listagem sem segredo, revogação imediata; owner removido/desativado invalida uso |
| Administração | OWNER gerencia próprio tenant; ADMIN/superadmin somente no escopo autorizado; usuário comum não obtém gestão via API direta |
| Catálogo | Agentes/projetos filtrados por ACL; header tenant não altera tenant da chave |
| Projeto/contexto | `PROJECT VIEW` antes de instruções, memórias, arquivos e diários; projeto inexistente/negado falha sem contexto parcial |
| Arquivos | ACL direta ou herdada; listagem une `file.projectId` e `project.fileIds`; upload/link exige EDIT e valida arquivo/prompt estrangeiro |
| Memórias | Preservar principal, tenant, ACL, locks e accounting; testar leitura e escrita separadamente |
| Compartilhamento OWNER | Agentes e prompts criados/duplicados por owner ganham VIEW no mesmo tenant; desligar CREATE não revoga compartilhamentos existentes |
| Permissões novas | Zod e schema Mongoose atualizados conjuntamente; defaults de inicialização persistem |
| Conversas | Troca de agente/modelo/preset/spec/URL mantém `conversation.projectId`; selector lateral não muda contexto por acidente |
| Upload no chat | Projeto com EDIT é destino padrão; opção local funciona e queries de arquivos são invalidadas |
| Meta Ads | Ausência de flag mantém habilitado; false global/tenant desabilita UI/API/cron; métricas não gastam tokens |
| Chat Meta Ads | Só abre rascunho por ação explícita, preserva projeto/agente configurado, nunca envia automaticamente |
| Diário/segredos | Estado e indexação de diário preservados; token Meta Ads nunca retorna em resposta/config pública |
| UI | Strings localizadas PT-BR/EN; tooltips visíveis para truncados; só SendButton submete ChatForm |
| Speech | Desabilitação administrativa prevalece sobre preferências locais |
| Política do repo | npm only; regras locais AGENTS/CLAUDE preservadas; backend novo em TS, wrappers JS finos |

A biblioteca de prompts não é automaticamente sinônimo de contexto integral do projeto. Separar instruções, memórias embutidas/referenciadas e arquivos RAG no contrato. Não prometer ingestão de todos os prompts ou equivalência das APIs sem um teste por categoria.

## 7. Plano de integração futura — não executado

1. **Baseline e inventário:** fixar SHAs, registrar checks existentes, listar extensões e responsáveis, preparar Mongo/RAG de teste sem dados de produção. Manter alterações novas do fork registradas para reaplicar depois do snapshot.
2. **Fundação:** reconciliar política local, manifests, exports e build. Regenerar lock com npm na worktree isolada, instalar dependências próprias, validar artefatos. Não compartilhar node_modules mutável com a workspace original.
3. **Contratos compartilhados:** tipos e permissões em data-provider, schemas/métodos em data-schemas; definir convivência Project/chatProject e identidade M2M/tenant.
4. **Backend:** Sol integra auth, host de agentes, catálogo, memória, arquivos, ACL e endpoints. Coordenador revisa fronteiras e compatibilidade com os contratos antigos.
5. **Frontend:** Terra porta Settings/TenantApi, projetos, composer, uploads, Meta Ads, navegação e integrações com o shell novo. Revisão cruzada com Sol nos payloads.
6. **Configuração/CI:** reconciliar Docker/YAML/Coolify e pipelines; inventariar migrações. Nenhuma mudança de produção neste estágio.
7. **Validação e estabilização:** gates da seção 9; corrigir regressões, executar CI amplo quando o estado estiver coerente, documentar limitações remanescentes e revisar release.

### Git sem perda de trabalho

Na execução futura, iniciar merge real apenas na worktree isolada com upstream fixado. Um único coordenador controla index, staging e commit. Sol/Terra recebem arquivos disjuntos; alterações em contratos compartilhados passam pelo coordenador.

**Não é possível criar commits normais por família enquanto ainda há conflitos não resolvidos no index do merge.** Usar checkpoints de patches/manifests de arquivos resolvidos durante a resolução; concluir um merge commit somente quando todos estiverem resolvidos e os gates necessários passarem. Depois, fazer commits pequenos de correção. Alternativa: workers preparam commits em worktrees próprias e o coordenador importa caminhos selecionados; não executar cherry-pick no meio de merge não resolvido.

Não fazer rebase dos 546 commits locais nem cherry-pick individual dos 1.348 upstream como estratégia padrão. Não usar force push, stash global ou reset na workspace compartilhada. Os 20 modify/delete precisam de decisão explícita: portar comportamento para substituto, remover somente comportamento obsoleto comprovado ou manter extensão ainda ativa.

## 8. Esforço e divisão de trabalho

| Fase | Dias de engenharia estimados | Responsável principal |
|---|---:|---|
| Baseline, mapa de contratos e fixtures | 1–2 | Coordenador + Sol |
| Fundação tenant, build, manifests e lock | 4–6 | Sol + Terra |
| Auth e credenciais | 4–6 | Sol |
| Runtime e gestão de agentes | 5–8 | Sol |
| Projetos e arquivos | 6–10 | Sol, interfaces com Terra |
| Memórias | 3–5 | Sol |
| Settings, composer, Meta Ads e navegação | 4–6 | Terra |
| Gates integrados e revisão de migrações | 4–6 | Sol + Terra + coordenador |
| Reserva transversal | 4–6 | Coordenador |
| **Total** | **35–55** | Trabalho agregado, não duração de um agente |

A análise Terra estimou 11–18 dias incluindo fundação, parte do backend e testes. A análise especializada Sol estimou 26–42 dias para backend e validação, revelando colisões estruturais que a estimativa de compatibilidade não cobria integralmente. Não somar as duas faixas: há trabalho sobreposto. A faixa consolidada acima usa o detalhamento backend e acrescenta frontend e reserva, sem contar novamente os mesmos gates. É julgamento de planejamento, não benchmark medido.

O prazo pressupõe preservar Project Orqest e adaptar as melhorias upstream compatíveis. Coexistência integral de Project e ChatProject, com nova rota/campo e migração, pode acrescentar **5–8 dias**; é decisão de produto pendente e não deve ser introduzida silenciosamente pelo merge.

Premissas: snapshots fixos, executores familiarizados com o fork, serviços de teste disponíveis, sem redesign ou funcionalidades adicionais. Se aparecer migração incompatível de dados persistidos, fluxo de memória sem equivalência ou necessidade de trocar runtime de produção, reestimar esse bloco antes de avançar.

## 9. Validação necessária para reduzir regressões

Nenhuma suíte foi executada contra um merge real nesta análise: esse merge não existe. Resultados anteriores da feature tenant API não certificam integração futura.

| Gate | Evidência exigida |
|---|---|
| Baseline comparável | Mesmo snapshot/deps/runtime para classificar falhas preexistentes versus novas |
| Build/imports | Artefatos CJS/ESM e exports consumidos por backend/client funcionando |
| Tipos | `tsc --noEmit` por pacote e client; nenhum diagnóstico novo atribuível à integração |
| Ciclos | Detector explícito ou check equivalente do CI adaptado ao tsdown; revisar ciclos novos |
| Qualidade | Diff sem `any` novo, suppressions injustificadas, marcadores de conflito ou bypass de tenant |
| Auth/ACL | Mongo real de teste; matriz owner/member/admin/outro tenant; JWT, chave pessoal, chave tenant e M2M separados |
| Contexto | Agente + projeto contém instruções/memórias/arquivos autorizados; negativos não vazam nada; chamadas LLM externas controladas |
| API compatível | Streaming, cancelamento, erros, uso/accounting, tools, Responses e chat completions |
| UI | Settings tenant, projeto compartilhado, troca de setup, upload, Meta Ads, speech e submit |
| Release candidate | CI amplo e smoke em staging com serviços reais; registrar versões, evidências e falhas |

Preferir testes focados durante cada bloco; rodar build/suíte ampla quando houver estado integrado coerente. Testes DB não devem mockar o isolamento que pretendem comprovar. Verificar memória de escrita e histórico Responses separadamente: no fluxo local anterior, persistência/lookup de responseId e conversationId merecem auditoria específica; não assumir que atualizar upstream corrige o contrato local automaticamente.

Os typechecks locais já tinham falhas em áreas anteriores à análise. Uma baseline com falhas exige comparação explícita; não declarar tudo verde porque não surgiu erro novo. Falhas antigas que bloqueiem comprovar os contratos críticos precisam ser resolvidas ou impedir release.

Para E2E, definir cenários e ambiente na fase de integração, sem executar agora. Não aplicar ao Orqest uma restrição de E2E de outro repositório. Build local, CI, staging e produção são camadas diferentes de evidência.

## 10. Estratégia para economizar tokens

- Coordenador mantém um único inventário: arquivo, contrato afetado, responsável, decisão e check. Agentes não repetem a auditoria inteira.
- Sol recebe somente backend/auth/dados e referências às interfaces acordadas. Terra recebe UI/build/config; arquivos compartilhados ficam com um dono explícito.
- Luna recebe Markdown, chaves de locale e listas de pendências para revisão/reorganização. Não resolve ACL, schema ou autenticação por economia de modelo.
- Usar contextos novos e pacotes curtos por tarefa: SHAs, caminhos, contrato, diff limitado e saída esperada. Não clonar todo histórico da conversa entre agentes.
- Classificar com Git/scripts primeiro: conflito mecânico, remoção com substituto, contrato de segurança e mudança sem conflito. Ler fonte só nos trechos e chamadores relevantes, com Graphify para navegação inicial.
- Lockfile é regenerado; traduções são conciliadas por chave; testes são selecionados por área. Evitar pedir a um modelo que interprete milhares de linhas mecânicas.
- Checkpoints resumem decisão e evidência, não transcrições de terminal. Reusar resultados válidos; repetir somente após alteração que os invalide.
- Encerrar investigação de um bloco quando contrato, implementação candidata e gate estiverem claros. Incerteza de segurança sobe ao coordenador, não vira várias tentativas cegas.

Na execução, usar como ponto de partida pacotes de entrada de até 2.000 tokens de resumo, mais apenas os diffs necessários, e retorno de até 800 tokens por checkpoint. São limites de comunicação, não limites que autorizam omitir contexto crítico. Registrar por tarefa tokens disponíveis na ferramenta, arquivos lidos, tentativas e checks. Após duas tentativas sem nova evidência, devolver o bloqueio ao coordenador; ampliar contexto apenas para a hipótese concreta.

Não há medição confiável de economia percentual ou preço nesta análise. Definir teto de contexto por pacote e acompanhar consumo por fase durante execução; não estimar custo monetário sem modelos, preços e volume observados. Paralelismo reduz calendário, mas duplicação de leitura pode aumentar tokens.

## 11. Rollback e release futura

Preservar SHA/imagem anterior e configuração efetiva. Antes de migrações, verificar compatibilidade reversa de schemas/índices e ensaiar recuperação em ambiente isolado. Reverter código não desfaz transformação destrutiva de dados. Nenhum reset/restore de banco compartilhado está autorizado por este relatório.

Sol inventaria cada migração necessária, compatibilidade e ensaio; o coordenador estima e agenda a execução separadamente antes do release. Abortam o rollout: qualquer vazamento cross-tenant, perda de contexto autorizado, invalidação indevida de credenciais existentes ou erro de persistência incompatível. Coordenador técnico conduz a interrupção; responsável operacional executa rollback conforme plano validado. Se dados já foram transformados sem reversão segura, bloquear novas escritas e seguir recuperação ensaiada, sem restaurar banco automaticamente.

Release só após matriz crítica aprovada, diferenças documentadas e plano concreto de deploy. O upstream deve continuar fixado durante validação; novos commits entram numa atualização posterior ou exigem novo delta e testes afetados.

## 12. Reprodução da medição e próximos passos

Comandos de leitura/simulação que reproduzem a divergência dos snapshots:

```bash
git merge-base 36b1461b6a6bb90edfdc79dd1abd136d70ab87b4 7fe9a45894f28547b0da498daa02e27355718b02
git rev-list --left-right --count 36b1461b6a6bb90edfdc79dd1abd136d70ab87b4...7fe9a45894f28547b0da498daa02e27355718b02
git merge-tree --write-tree --name-only 36b1461b6a6bb90edfdc79dd1abd136d70ab87b4 7fe9a45894f28547b0da498daa02e27355718b02
git worktree list
```

Estado Git registrado: [snapshot de branches/worktrees](upstream-2026-09-14-evidencias/estado-git.txt).

Checklist da entrega atual:

- [x] Snapshot upstream consultado e fixado.
- [x] Branch/worktree isolada criada sem merge.
- [x] Divergência e conflitos medidos; inventário completo anexado.
- [x] Riscos, contratos locais, esforço, responsáveis e gates documentados.
- [x] Estratégia de economia de tokens definida.
- [ ] Implementar integração — fora desta entrega, depende de solicitação posterior.
- [ ] Executar gates sobre código integrado — ainda não existe código integrado.
- [ ] Commit/push da integração e deploy — não realizados nesta análise.

**Próximo passo recomendado:** revisar este plano e, quando for solicitado implementar, começar pela baseline e fundação na branch já criada. Este documento não autoriza nem afirma uma integração sem regressões.
