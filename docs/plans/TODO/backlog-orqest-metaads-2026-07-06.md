# Backlog Orqest Meta Ads - Regras, Publicacao, Tokens, Relatorios E Criativos

> Foco exclusivo: Orqest. Itens de CRM citados na conversa ficam fora deste backlog.

## Resumo

O Orqest foi tratado na reuniao como ferramenta de automacao e analise de midia paga. O backlog abaixo organiza o que falta para fechar a etapa atual: regras por campanha com janela propria, ativar/desativar grupos, correcao do fluxo de orcamento, rascunho/publicacao estilo Meta Ads, token por cliente, relatorios Meta/Facebook/Instagram e etapa futura de criativos.

Prioridade operacional:

1. Provar por que a regra nao aplicou em producao.
2. Corrigir lacunas de regra/orcamento/publicacao.
3. Migrar clientes para token proprio quando fizer sentido.
4. Evoluir relatorios.
5. Planejar criativos.

## Estado Atual Conhecido

- Regras, grupos e overrides ja existem no produto.
- Grupos e overrides ja suportam `enabled`.
- Grupos e overrides ja suportam `analysisPreset`, mas falta validar producao e janelas curtas como 6h/24h.
- Orcamento manual existe, mas houve relato de tentativa de aumento de 20% que parecia nao aplicar.
- Draft de configuracao existe e sobrevive a reload, mas a experiencia de descartar/publicar ainda precisa ficar mais parecida com Meta Ads.
- Token por projeto existe no codigo, com fallback para token global do tenant.
- O modo automatico so aplica mudancas se a automacao estiver configurada para aplicar, nao apenas recomendar.

## Epic 1 - Regras E Automacao

**Goal:** fechar a confiabilidade das regras automaticas sem reescrever o motor atual.

**Arquitetura:** a automacao continua sendo apenas o timer. A decisao por campanha/ad set deve sair de `getEffectiveRuleContext()` e `getEffectiveRules()`, respeitando `enabled`, regras globais, grupos e overrides. Como o codigo ja busca insights por `analysisPreset`, a mudanca principal e validar producao e adicionar janelas curtas sem criar outro fluxo paralelo.

**Arquivos provaveis:**

- Backend regra/periodo: `api/server/services/MetaAds/budget.js`
- Backend normalizacao API: `api/server/routes/projectMetaAds.js`
- Schemas/tipos: `packages/data-provider/src/schemas.ts`, `packages/data-schemas/src/schema/project.ts`, `packages/data-schemas/src/types/project.ts`
- UI regras: `client/src/components/Project/metaAds/ruleGroupDialog.tsx`
- UI automacao global: `client/src/components/Project/metaAds/settingsDrawer.tsx`
- Textos: `client/src/locales/pt-BR/translation.json`, `client/src/locales/en/translation.json`
- Testes: `api/server/services/MetaAds/budget.spec.js`, `api/server/routes/projectMetaAds.spec.js`, `client/src/components/Project/__tests__/ProjectMetaAdsPanel.spec.tsx`

### PR 1.1 - Auditar regra atual antes de mexer

**Depende de:** nenhum.

**Objetivo:** descobrir por que a regra do cliente gastou R$1, tinha cooldown de 1h, mas nao alterou nada.

**Tarefas:**

- Identificar projeto, tenant e conta de anuncio do cliente afetado.
- Verificar no banco a configuracao real de `metaAds`:
  - `metaAds.enabled`;
  - `metaAds.automationMode`;
  - `metaAds.scheduleIntervalMinutes`;
  - `metaAds.automationAnalysisPreset`;
  - `metaAds.lastRunAt`;
  - `metaAds.rules`;
  - `metaAds.ruleGroups`;
  - `metaAds.ruleOverrides`;
  - `metaAds.budgetLevel`;
  - fonte do token, sem expor o valor.
- Verificar se o cron/job Meta Ads esta rodando em producao e se atualiza `lastRunAt`.
- Verificar logs `[MetaAdsBudgetCron]`, `[MetaAdsBudget]`, recomendacoes criadas e acoes aplicadas.
- Conferir se a regra gerou `hold`, `blocked`, `pending`, `applied` ou nenhuma recomendacao.
- Conferir se houve bloqueio por:
  - `automationMode` em `recommend`;
  - cooldown;
  - gasto insuficiente;
  - limite mensal;
  - regra sem match de campanha/ad set;
  - token/permissao Meta;
  - erro Graph API;
  - cron sem agendamento externo.
- Nao alterar codigo neste PR, salvo teste/diagnostico se necessario.

**Aceite:**

- Relatorio curto com causa provada ou causa mais provavel para "gastou R$1 e nao mexeu".
- Evidencia com projeto, horario da ultima execucao, status da recomendacao e motivo.
- Se a causa for `automationMode: recommend`, deixar explicito que o sistema recomendou/segurou e nao aplicou por configuracao.

### PR 1.2 - Grupo de regras: ativar/desativar sem deletar

**Depende de:** PR 1.1.

**Objetivo:** permitir que usuario mantenha grupo configurado, mas inativo.

**Tarefas:**

- Confirmar se o toggle atual aparece na lista de regras e no fluxo de edicao/criacao.
- Se o toggle existir mas estiver pouco claro, melhorar apenas label/estado visual.
- Se faltar no drawer de criacao/edicao, adicionar controle `enabled` no mesmo componente existente.
- Garantir que grupo inativo nao participe de `findRuleGroup()` nem de `getEffectiveRuleContext()`.
- Garantir que override inativo continue fora da precedencia.
- Manter delete apenas para remocao intencional.

**Aceite:**

- Usuario consegue desativar grupo sem apagar campanhas, regra, janela ou parametros.
- Grupo inativo fica visivel como inativo.
- Reativar o grupo restaura comportamento sem recriar.
- Teste frontend cobre desativar e reativar grupo.
- Teste backend cobre grupo `enabled: false` ignorado.

### PR 1.3 - Janela de analise por regra/campanha

**Depende de:** PR 1.1.

**Objetivo:** automacao continua sendo timer; cada regra decide seu recorte de dados.

**Tarefas:**

- Validar fluxo atual de `analysisPreset` em:
  - regra global;
  - grupo de regra;
  - override de campanha;
  - override de conjunto.
- Garantir precedencia:
  - override de ad set > override de campanha > grupo > global.
- Garantir que `getEffectiveRuleContext()` retorna `analysisPreset`, `ruleSourceType`, `ruleId`, `ruleName` e `ruleScope` corretos.
- Garantir que o backend busca insights separados quando entidades usam janelas diferentes e filtra cada linha pela janela efetiva da entidade.
- Garantir que UI mostra a janela aplicada na regra/grupo/override.
- Evitar nova abstracao; reaproveitar `analysisBundles` e os mapas por `${analysisPreset}:${entityId}`.

**Aceite:**

- Conta com 5 campanhas pode ter 3 campanhas usando janela global e 2 campanhas usando janela propria.
- Execucao a cada 30 minutos respeita o recorte de cada regra.
- Teste falha se override de ad set perder precedencia para campanha/grupo.
- Teste falha se insight de uma janela for usado por entidade configurada para outra janela.

### PR 1.4 - Adicionar janelas curtas

**Depende de:** PR 1.3.

**Objetivo:** suportar regras agressivas com ultimas 6h e 24h.

**Tarefas:**

- Adicionar presets:
  - `last_6h`;
  - `last_24h`.
- Atualizar `ANALYSIS_PRESETS` em `api/server/services/MetaAds/budget.js`.
- Atualizar `ANALYSIS_PRESETS` usado por `api/server/routes/projectMetaAds.js`.
- Atualizar Zod, Mongoose e tipos para aceitar `last_6h` e `last_24h`.
- Atualizar selects em `settingsDrawer.tsx` e `ruleGroupDialog.tsx`.
- Atualizar labels em PT-BR e EN:
  - `com_ui_project_meta_ads_analysis_last_6h`;
  - `com_ui_project_meta_ads_analysis_last_24h`.
- Para `last_6h` e `last_24h`, resolver periodo com `since`/`until` e deixar `datePreset` vazio/indefinido para o Graph usar `time_range`.
- Incluir o recorte no cache key existente; nao criar cache novo.
- Garantir fallback antigo: presets nao reconhecidos continuam caindo para `last_2d` ou sendo descartados na normalizacao.

**Aceite:**

- Regra agressiva pode analisar ultimas 6h.
- Regra agressiva pode analisar ultimas 24h.
- Regras antigas continuam usando presets atuais.
- Normalizadores preservam `last_6h` e `last_24h`.
- Graph recebe `time_range` para janelas curtas, nao `date_preset=last_6h`.

### PR 1.5 - Smoke e-commerce agressivo

**Depende de:** PR 1.4.

**Objetivo:** validar caso citado por Marcelo.

**Cenario:**

- Cliente com 5 campanhas.
- 3 campanhas usam janela global.
- 2 campanhas usam regras agressivas.
- 1 campanha usa janela "hoje" ou "ultimas 6h".
- Min spend R$1.
- Cooldown 1h.

**Tarefas:**

- Criar fixture/teste com campanhas e ad sets suficientes para simular grupos e overrides.
- Configurar regra global com janela geral.
- Configurar duas campanhas/ad sets com `analysisPreset` proprio.
- Simular insights por janelas diferentes.
- Rodar analise com `applyAuto` desligado para validar decisao e motivo sem chamar Meta.
- Rodar cenario com `automationMode: auto_limited` em teste unitario isolado quando precisar validar aplicacao.

**Aceite:**

- Analise gera aumentar, reduzir, pausar ou explica bloqueio.
- Motivo fica visivel para debug.
- Teste falha se regra usa janela errada.
- Teste falha se min spend R$1 for ignorado.
- Teste falha se cooldown 1h bloquear indevidamente uma regra elegivel.

**Comandos de verificacao da Epic 1:**

```bash
cd api && npm run test:ci -- MetaAds/budget.spec.js --runInBand
cd api && npm run test:ci -- projectMetaAds.spec.js --runInBand
cd client && npm run test:ci -- ProjectMetaAdsPanel.spec.tsx --runInBand --silent
npm run build:data-provider
```

## Epic 2 - Bug De Orcamento

### PR 2.1 - Reproduzir aumento/reducao de orcamento

**Depende de:** nenhum.

**Objetivo:** identificar por que +20% parecia nao aplicar.

**Tarefas:**

- Testar ajuste manual em campanha e conjunto.
- Conferir payload enviado.
- Conferir response da API local.
- Conferir erro da Meta, se houver.
- Conferir toast/feedback visual.
- Conferir se limite de regra bloqueou a mudanca.
- Conferir se historico foi registrado.

**Aceite:**

- Causa definida com evidencia.
- Sem chute baseado apenas na UI.

### PR 2.2 - Corrigir fluxo manual de orcamento

**Depende de:** PR 2.1.

**Objetivo:** garantir que ajuste manual aplica ou mostra erro claro.

**Tarefas:**

- Corrigir somente o ponto identificado:
  - payload;
  - validacao;
  - parse de decimal;
  - limite minimo/maximo;
  - estado UI;
  - toast;
  - chamada Graph.
- Garantir que erro Meta apareca de forma legivel.
- Garantir que sucesso refaz query/status.

**Aceite:**

- Aumento manual de 20% aplica na Meta quando valido.
- Reducao manual aplica quando valido.
- Historico registra alteracao.
- Erro bloqueante explica o motivo.

### PR 2.3 - Teste de regressao do orcamento

**Depende de:** PR 2.2.

**Tarefas:**

- Cobrir decimal com virgula brasileira.
- Cobrir campanha e ad set.
- Cobrir limite minimo/maximo.
- Cobrir erro Meta.
- Cobrir sucesso com refetch.

**Aceite:**

- Teste falha se o botao "Salvar orcamento" nao enviar/aplicar.

## Epic 3 - Rascunho E Publicacao

### PR 3.1 - Inventario de alteracoes pendentes

**Depende de:** nenhum.

**Objetivo:** mostrar o que sera publicado antes de publicar.

**Tarefas:**

- Gerar diff entre configuracao salva e draft local.
- Agrupar por:
  - automacao;
  - regras globais;
  - grupos;
  - overrides;
  - orcamento mensal;
  - credenciais.
- Mostrar resumo no indicador de draft.
- Evitar expor token ou valor sensivel.

**Aceite:**

- Usuario passa o mouse/clica e entende o que esta pendente.
- Token nunca aparece no resumo.

### PR 3.2 - Publicar alteracoes

**Depende de:** PR 3.1.

**Objetivo:** deixar claro que alteracao local so vale depois de publicar.

**Tarefas:**

- Manter alteracoes em draft ate usuario publicar.
- Persistir draft apos reload.
- Mostrar botao "Publicar alteracoes" quando houver draft.
- Ao publicar, limpar draft apenas se API salvar com sucesso.
- Em erro, manter draft.

**Aceite:**

- Reload nao perde alteracao pendente.
- Publicar salva e limpa indicador.
- Erro de publicacao preserva draft.

### PR 3.3 - Descartar com modal

**Depende de:** PR 3.1.

**Objetivo:** evitar descarte acidental.

**Tarefas:**

- Trocar confirm simples por modal.
- Modal mostra lista de alteracoes que serao descartadas.
- Acoes:
  - cancelar;
  - descartar.
- Ao descartar, restaurar configuracao salva.

**Aceite:**

- Descarte exige segunda confirmacao visual.
- Usuario consegue cancelar sem perder alteracoes.

### PR 3.4 - Estados visuais do draft

**Depende de:** PR 3.2.

**Objetivo:** tornar rascunho obvio.

**Tarefas:**

- Indicador/botao pulsando quando houver draft.
- Estados:
  - sem alteracao;
  - alteracoes pendentes;
  - publicando;
  - publicado;
  - erro.
- Texto localizavel.

**Aceite:**

- Usuario entende se esta em rascunho ou publicado.

## Epic 4 - Token Por Cliente

### PR 4.1 - Token de projeto para 5A Inox

**Depende de:** nenhum.

**Objetivo:** usar token da 5A Inox no projeto, nao token geral.

**Tarefas:**

- Configurar token como segredo de projeto.
- Confirmar credential status mascarado.
- Confirmar Graph API com conta `act_*` da 5A.
- Confirmar fallback global nao esta sendo usado quando token de projeto existe.

**Aceite:**

- Orqest usa token proprio da 5A Inox.
- UI mostra token de projeto configurado sem expor valor.

### PR 4.2 - UX de credenciais por cliente

**Depende de:** PR 4.1.

**Objetivo:** deixar claro qual token esta em uso.

**Tarefas:**

- Separar visualmente:
  - token do projeto;
  - token global do tenant.
- Mostrar fonte atual:
  - projeto;
  - global;
  - ausente.
- Botao para voltar ao token global quando houver token de projeto.
- Mensagem de permissao para usuario sem acesso.

**Aceite:**

- Usuario sabe se o projeto usa token proprio ou geral.

### PR 4.3 - Auditoria multi-cliente

**Depende de:** PR 4.2.

**Objetivo:** controlar clientes individualmente.

**Tarefas:**

- Criar visao ou script de auditoria listando:
  - projeto;
  - conta de anuncio;
  - fonte da credencial;
  - status do token;
  - ultima execucao.
- Identificar clientes ainda dependentes de token geral.

**Aceite:**

- Da para planejar migracao cliente por cliente.

## Epic 5 - Relatorios Meta/Facebook/Instagram

### PR 5.1 - Validar permissoes Graph necessarias

**Depende de:** PR 4.1.

**Objetivo:** garantir que token por cliente suporta relatorios.

**Tarefas:**

- Confirmar permissoes para:
  - Ads;
  - Business assets;
  - Instagram/Facebook quando aplicavel;
  - leitura de campanhas, conjuntos, anuncios e criativos.
- Documentar permissoes minimas.

**Aceite:**

- Checklist de permissoes por cliente/token.

### PR 5.2 - Coleta de relatorios

**Depende de:** PR 5.1.

**Objetivo:** coletar dados suficientes para relatorio interno do Orqest.

**Tarefas:**

- Confirmar coleta de:
  - campanhas;
  - conjuntos;
  - anuncios;
  - criativos;
  - gasto;
  - resultados;
  - CPA;
  - ROAS;
  - status;
  - periodo.
- Expandir Graph fetch apenas onde houver lacuna real.
- Reusar cache e snapshot existentes.

**Aceite:**

- Relatorio nao depende de token generico.
- Dados principais batem com Meta Ads dentro da janela escolhida.

### PR 5.3 - Dashboard de relatorios

**Depende de:** PR 5.2.

**Objetivo:** permitir analise sem abrir Meta Ads.

**Tarefas:**

- Visao por periodo.
- Filtros por campanha/conjunto/anuncio.
- Cards:
  - gasto;
  - resultado;
  - custo por resultado;
  - ROAS;
  - CTR;
  - CPA.
- Tabela por campanha e conjunto.

**Aceite:**

- Marcelo consegue analisar performance basica no Orqest.

## Epic 6 - Criativos

### PR 6.1 - Diagnostico de criativos

**Depende de:** PR 5.2.

**Objetivo:** apontar criativos que precisam acao.

**Tarefas:**

- Identificar criativos com:
  - custo alto;
  - sem resultado;
  - frequencia alta;
  - CTR baixo;
  - fadiga;
  - pouca entrega.
- Mostrar motivo visivel.

**Aceite:**

- Lista prioriza criativos para pausar, escalar ou refazer.

### PR 6.2 - Relatorio de criativos

**Depende de:** PR 6.1.

**Objetivo:** consolidar leitura de criativos.

**Tarefas:**

- Tabela por campanha, conjunto e anuncio.
- Preview do criativo quando disponivel.
- Link para Ads Manager.
- Ordenacao por pior custo/resultado e melhor resultado.

**Aceite:**

- Gestor identifica criativo vencedor e criativo problema.

### PR 6.3 - PRD de criacao de imagens

**Depende de:** PR 6.2.

**Objetivo:** preparar etapa de geracao de criativos.

**Tarefas:**

- Definir fluxo de brief.
- Definir inputs obrigatorios.
- Definir onde imagem gerada sera salva.
- Definir aprovacao/publicacao manual.
- Nao criar gerador antes de fechar requisitos com Marcelo.

**Aceite:**

- PRD curto aprovado antes de implementar criacao de imagem.

## Epic 7 - Operacao E ClickUp

### PR 7.1 - Checklist de homologacao Orqest

**Depende de:** Epics 1 a 5.

**Tarefas:**

- Validar:
  - regra com gasto R$1;
  - cooldown 1h;
  - janela hoje;
  - janela 6h;
  - janela 24h;
  - janela 7d;
  - aumento de orcamento +20%;
  - reducao de orcamento;
  - pausar criativo;
  - publicar draft;
  - descartar draft;
  - token 5A Inox;
  - fallback token global.

**Aceite:**

- Checklist executavel antes da reuniao com Marcelo.

### PR 7.2 - Backlog no ClickUp

**Depende de:** este MD.

**Tarefas:**

- Criar Epic por secao.
- Criar tarefa por PR.
- Adicionar dependencias.
- Adicionar aceite.
- Marcar prioridade:
  - P0: PR 1.1, PR 2.1, PR 4.1;
  - P1: PR 1.2 a 1.5, Epic 3;
  - P2: Epics 5 e 6.

**Aceite:**

- Marcelo consegue acompanhar status sem depender de memoria verbal.

## Ordem Recomendada

1. PR 1.1 - Auditar regra atual.
2. PR 2.1 - Reproduzir bug de orcamento.
3. PR 4.1 - Configurar token 5A Inox.
4. PR 1.2 - Toggle de grupo.
5. PR 1.3 - Janela por regra.
6. PR 1.4 - Janelas 6h/24h.
7. PR 2.2 - Corrigir orcamento.
8. Epic 3 - Rascunho/publicacao.
9. Epic 5 - Relatorios.
10. Epic 6 - Criativos.

## Comandos De Verificacao

```bash
cd api && npm run test:ci -- MetaAds/budget.spec.js projectMetaAds.spec.js --runInBand
cd client && npm run test:ci -- ProjectMetaAdsPanel.spec.tsx --runInBand --silent
npm run build:data-provider
```

## Assumptions

- Este backlog nao inclui CRM.
- Nao reimplementar comportamento que ja existe; auditar primeiro.
- Token nunca deve aparecer em UI, log ou resumo de draft.
- Preferir ajustes pequenos por PR.
- Build completo so quando mudanca exigir; checks focados primeiro.

## Status

- Epic 1 planejada: feito.
