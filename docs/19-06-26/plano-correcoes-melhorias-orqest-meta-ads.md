# Plano de Correcoes e Melhorias Orqest Meta Ads

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** corrigir a integridade das metricas Meta Ads no Orqest, destravar credenciais/modal de anuncios e reorganizar a experiencia e-commerce para nova homologacao com dados confiaveis.

**Architecture:** o backend continua sendo a fonte da verdade para normalizacao de metricas Meta Ads. O frontend apenas apresenta, filtra e ordena dados ja consistentes. A implementacao deve ser serial: primeiro conversoes/resultados, depois credenciais e modal, depois UX e-commerce, depois QA operacional.

**Tech Stack:** Node CJS, Express, Mongoose, Meta Graph API, React/Vite TS, React Query v4, Jest.

---

## 1. Contexto e Diagnostico

Arquivos analisados:

- `docs/19-06-26/ata-estrategica-da-reuniao-19-06-2026.md-Marcelo Kuwer-Guilherme Vieira`
- `docs/19-06-26/Marcelo Kuwer-Guilherme Vieira-19-06-2026.csv`

Problemas identificados:

- Painel Orqest exibiu 69 compras em 7 dias enquanto o Meta Ads Manager indicava 23 compras.
- A divergencia veio de fallback indevido: clique no link/engajamento foi tratado como "Resultado" em campanha de vendas.
- Campanha e-commerce com objetivo de compra nao pode usar `link_click`, `post_engagement`, `landing_page_view` ou `video_view` como conversao.
- Modal de anuncios nao abriu durante teste assistido.
- Usuario nao encontrou campo para Token Global; no codigo atual esse fluxo existe, entao o problema provavel e permissao, visibilidade, deploy desatualizado ou UX pouco clara.
- Metricas principais para e-commerce devem ser: ROI/ROAS, Gasto, Resultado, Custo por Resultado.
- Metricas de video/frequencia/cliques devem sair da visao principal de vendas.

Codigo relevante:

- Backend Meta Ads: `api/server/services/MetaAds/budget.js`, `api/server/services/MetaAds/graph.js`, `api/server/routes/projectMetaAds.js`
- Frontend Meta Ads: `client/src/components/Project/ProjectMetaAdsPanel.tsx`, `client/src/components/Project/__tests__/ProjectMetaAdsPanel.spec.tsx`
- Tipos/endpoints: `packages/data-provider/src/types/queries.ts`, `packages/data-provider/src/api-endpoints.ts`, `packages/data-provider/src/data-service.ts`

---

## 2. Principios

- Nao somar eventos heterogeneos no campo "Resultado".
- Se alvo configurado e `purchase`, resultado zero deve aparecer como zero.
- `link_click` e metrica de trafego, nao compra.
- `video_view` e metrica criativa/engajamento, nao metrica principal de e-commerce.
- `resultTypeBreakdown` pode mostrar eventos auxiliares, mas nao pode contaminar cards principais.
- Tokens nunca devem ser persistidos em `metaAds` nem retornados ao frontend.
- Backend deve validar formato basico dos tokens antes de salvar secret.
- Frontend deve usar `useLocalize()` para toda string nova.
- Testes devem ser focados.

---

## 3. Ordem Serial de PRs

### Epic 1 - Integridade Matematica de Resultados

#### PR 1.1 - Blindar `calculateMetrics()` contra fallback de conversao para clique

**Objetivo:** impedir que cliques/engajamento/video preencham "Resultado" quando o resultado alvo e compra, lead ou conversa.

**Arquivos:**

- `api/server/services/MetaAds/budget.js`
- `api/server/services/MetaAds/budget.spec.js`

**Tarefas:**

- [ ] Exportar helper interno para teste, por exemplo `_calculateMetricsForTest`.
- [ ] Criar `canonicalizeMetaActionType(actionType)`.
- [ ] Mapear equivalencias de compra, lead e conversa.
- [ ] Quando `targetResultType` existir, procurar apenas action canonica equivalente.
- [ ] Se action alvo nao existir, retornar `resultCount: 0`, `cpa: null`, `resultType` alvo.
- [ ] Proibir `link_click`, `landing_page_view`, `post_engagement`, `page_engagement`, `video_view` como fallback para `purchase`, `lead` ou conversa.
- [ ] Manter `resultTypeBreakdown` para diagnostico sem afetar `resultCount`.

**Testes:**

- [ ] `purchase=23` e `link_click=38`, alvo `purchase`, retorna 23.
- [ ] so `link_click=38`, alvo `purchase`, retorna 0.
- [ ] `omni_purchase=23`, alvo `purchase`, retorna 23.
- [ ] `leadgen_grouped=6`, alvo `lead`, retorna 6.
- [ ] sem alvo, video nao vira compra.

**Comando:**

```bash
cd api && npm run test:ci -- MetaAds/budget.spec.js
```

#### PR 1.2 - Definir `purchase` automaticamente para e-commerce/vendas

**Objetivo:** evitar dependencia de configuracao manual para campanhas de vendas.

**Arquivos:**

- `api/server/services/MetaAds/budget.js`
- `client/src/components/Project/ProjectMetaAdsPanel.tsx`
- `client/src/components/Project/__tests__/ProjectMetaAdsPanel.spec.tsx`
- `api/server/services/MetaAds/budget.spec.js`

**Tarefas:**

- [ ] Criar `resolveTargetResultType({ rules, accountProfile, campaignObjective })`.
- [ ] Usar `rules.targetResultType` quando existir.
- [ ] Usar `purchase` quando `accountProfile === 'ecommerce'`.
- [ ] Usar `purchase` quando `campaignObjective === 'OUTCOME_SALES'`.
- [ ] Aplicar helper em snapshots, ads e campanhas.
- [ ] UI deve salvar `targetResultType='purchase'` e `primaryMetric='roas'` ao escolher e-commerce.

#### PR 1.3 - Corrigir ROAS/ROI com `action_values`

**Objetivo:** ROI no e-commerce deve refletir receita de compra quando Meta enviar valor de conversao.

**Arquivos:**

- `api/server/services/MetaAds/graph.js`
- `api/server/services/MetaAds/budget.js`
- `api/server/services/MetaAds/graph.spec.js`
- `api/server/services/MetaAds/budget.spec.js`

**Tarefas:**

- [ ] Adicionar `action_values` aos insights de campaign/adset/ad.
- [ ] Agregar `action_values` em leituras chunked.
- [ ] Calcular `purchaseValue` por action value canonica de compra.
- [ ] Usar `purchase_roas` quando valido; senao `purchaseValue / spend`.

### Epic 2 - Credenciais e Token Global

#### PR 2.1 - Tornar Token Global explicito na UI

**Objetivo:** remover ambiguidade de onde colar/salvar Token Global.

**Arquivos:**

- `client/src/components/Project/ProjectMetaAdsPanel.tsx`
- `client/src/components/Project/__tests__/ProjectMetaAdsPanel.spec.tsx`
- `client/src/locales/pt-BR/translation.json`
- `client/src/locales/en/translation.json`

**Tarefas:**

- [ ] Separar visualmente Token Global do tenant e Token Local do projeto.
- [ ] Para ADMIN, mostrar label explicito, input e botao "Salvar token global".
- [ ] Para nao ADMIN, esconder input e mostrar mensagem de permissao.
- [ ] Apos salvar, limpar campo, refetch status e toast.
- [ ] Nunca mostrar token existente.

#### PR 2.2 - Validar token no backend

**Arquivos:**

- `api/server/routes/projectMetaAds.js`
- `api/server/routes/projectMetaAds.spec.js`

**Tarefas:**

- [ ] Reutilizar `looksLikeMetaAccessToken()` em `/tenant-token`.
- [ ] Retornar 400 para token vazio/invalido.
- [ ] Resposta de sucesso nao deve conter token.

### Epic 3 - Modal de Anuncios e Criativos

#### PR 3.1 - Garantir abertura do modal sem popup direto

**Arquivos:**

- `client/src/components/Project/ProjectMetaAdsPanel.tsx`
- `client/src/components/Project/__tests__/ProjectMetaAdsPanel.spec.tsx`

**Tarefas:**

- [ ] Card de anuncio deve chamar somente `setSelectedAdPreview(ad)`.
- [ ] Botao Ads Manager dentro do modal deve chamar `window.open`.
- [ ] Usar `event.stopPropagation()` em botoes internos quando necessario.
- [ ] Modal abre mesmo sem `adsManagerUrl`.

#### PR 3.2 - Melhorar extracao de criativo no backend

**Arquivos:**

- `api/server/services/MetaAds/graph.js`
- `api/server/services/MetaAds/budget.js`
- `api/server/services/MetaAds/budget.spec.js`

**Tarefas:**

- [ ] Preservar thumbnail, imagem, titulo, body, descricao, link e CTA.
- [ ] Suportar `object_story_spec.link_data`, `video_data`, `template_data` e `asset_feed_spec`.
- [ ] Manter anuncios insight-only com metricas e link Ads Manager.

### Epic 4 - UX E-commerce

#### PR 4.1 - Adicionar ROI/ROAS como metrica principal

**Arquivos:**

- `client/src/components/Project/ProjectMetaAdsPanel.tsx`
- `client/src/components/Project/__tests__/ProjectMetaAdsPanel.spec.tsx`
- `client/src/locales/pt-BR/translation.json`
- `client/src/locales/en/translation.json`

**Tarefas:**

- [ ] Adicionar coluna `roas`.
- [ ] Adicionar sort/render/formatter de ROAS.
- [ ] Em e-commerce, cards topo: ROI medio, Gasto, Resultado, Custo por Resultado.
- [ ] Calcular ROI medio ponderado por gasto.

#### PR 4.2 - Reordenar colunas principais para e-commerce

**Tarefas:**

- [ ] Criar helper `isEcommerceContext(settings, objectiveFilter, campaigns)`.
- [ ] Para e-commerce, ordem: ROI, Gasto, Resultado, Custo por Resultado.
- [ ] Remover `frequency` e `video` das views principais de e-commerce.

#### PR 4.3 - Limpar seletor "Resultados Totais"

**Tarefas:**

- [ ] Em e-commerce, priorizar `purchase`.
- [ ] Ocultar `video_view` e agregados do seletor principal.
- [ ] Nao somar metricas mistas sem escolha explicita.

### Epic 5 - Regressao e QA

#### PR 5.1 - Fixture Reuniao 19-06-2026

**Arquivos:**

- Criar `api/server/services/MetaAds/__fixtures__/meeting-2026-06-19.js`
- Modificar `api/server/services/MetaAds/budget.spec.js`

**Tarefas:**

- [ ] Fixture com 23 compras reais e 38 cliques.
- [ ] Testar que Resultado principal e 23, nao 61/69.
- [ ] Campanha sem compra e com clique mostra compra 0.

#### PR 5.2 - Checklist de smoke pre-homologacao

**Arquivo:** `docs/19-06-26/meta-ads-smoke-checklist.md`

**Tarefas:**

- [ ] Login, projeto, credencial, periodo, comparacao gasto/conversao com Ads Manager.
- [ ] Modal criativo, Ads Manager, fullscreen, voltar/fechar.
- [ ] Validar ROI/Gasto/Resultado/Custo e ausencia de clique como venda.

#### PR 5.3 - Script diagnostico local

**Arquivo:** `scripts/meta-ads-compare.cjs`

**Tarefas:**

- [ ] Receber `--project`, `--since`, `--until`.
- [ ] Resolver token via secrets sem imprimir token.
- [ ] Imprimir spend, purchase, link_click, roas, cpa.
- [ ] Destacar linhas com clique e zero compra.

---

## 4. Criterios de Aceite

- Compras no Orqest batem com Ads Manager para mesmo periodo, conta e janela.
- Campanha com clique e zero compra mostra compra zero.
- `Resultado` nunca soma `link_click` com `purchase`.
- `CPA` de compra usa compras.
- `ROI/ROAS` usa `purchase_roas` ou `action_values / spend`.
- Admin consegue colar e salvar Token Global.
- Usuario comum entende que precisa de admin para token global.
- Token local continua funcionando.
- Nenhum token aparece em DOM, API response ou log.
- Clique em anuncio abre modal.
- Botao Ads Manager abre nova aba so dentro do modal.
- Cards/colunas principais e-commerce sao ROI, Gasto, Resultado, Custo por Resultado.

---

## 5. Test Matrix Final

```bash
cd api && npm run test:ci -- MetaAds/budget.spec.js MetaAds/graph.spec.js projectMetaAds.spec.js
cd client && npm run test:ci -- ProjectMetaAdsPanel.spec.tsx
```

Se tocar tipos compartilhados:

```bash
npx tsc --noEmit -p packages/data-provider/tsconfig.json
cd client && npm run typecheck
```

Nao rodar `npm run build` por padrao. Rodar build completo so antes de deploy ou se alteracao em tipos compartilhados quebrar consumo entre workspaces.

---

## 6. Assumptions

- Usar somente `npm`.
- Implementar PRs em sequencia.
- Nao apagar nem reverter arquivos nao rastreados existentes.
- "ROI" na UI representa ROAS.
- "Compra" canonica e `purchase`.
- Evento de clique pode aparecer no breakdown, mas nao pode virar compra.
- Token Global e secret de tenant: `meta_graph_access_token`.
- Token Local e secret por projeto: `meta_graph_access_token_project_<projectId>`.
