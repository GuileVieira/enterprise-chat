# Graph Report - .  (2026-07-07)

## Corpus Check
- Corpus is ~9,667 words - fits in a single context window. You may not need a graph.

## Summary
- 191 nodes · 264 edges · 19 communities (11 shown, 8 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_components|components]]
- [[_COMMUNITY_page|page]]
- [[_COMMUNITY_tsconfig|tsconfig]]
- [[_COMMUNITY_package|package]]
- [[_COMMUNITY_CMD node|CMD node]]
- [[_COMMUNITY_Container|Container]]
- [[_COMMUNITY_page|page]]
- [[_COMMUNITY_QualificationModal|QualificationModal]]
- [[_COMMUNITY_NODE ENV|NODE ENV]]
- [[_COMMUNITY_devDependencies|devDependencies]]
- [[_COMMUNITY_AgentsBento|AgentsBento]]
- [[_COMMUNITY_layout|layout]]
- [[_COMMUNITY_fix accents|fix accents]]
- [[_COMMUNITY_eslintrc|eslintrc]]
- [[_COMMUNITY_next config|next config]]
- [[_COMMUNITY_next env d|next env d]]
- [[_COMMUNITY_postcss config|postcss config]]
- [[_COMMUNITY_tailwind config|tailwind config]]
- [[_COMMUNITY_sites orqest landing README|sites orqest landing README]]

## God Nodes (most connected - your core abstractions)
1. `compilerOptions` - 15 edges
2. `cn()` - 11 edges
3. `ScrollReveal()` - 9 edges
4. `sites/orqest-landing/docker-compose.yml` - 8 edges
5. `MagneticButton()` - 6 edges
6. `scripts` - 5 edges
7. `OrqestIcon()` - 4 edges
8. `OrqestLogo()` - 4 edges
9. `sites/orqest-landing/.env.example` - 4 edges
10. `NavItem` - 3 edges

## Surprising Connections (you probably didn't know these)
- `Container()` --calls--> `cn()`  [EXTRACTED]
  sites/orqest-landing/src/app/v2/components.tsx → sites/orqest-landing/src/lib/utils.ts
- `HowItWorks()` --calls--> `cn()`  [EXTRACTED]
  sites/orqest-landing/src/components/sections/HowItWorks.tsx → sites/orqest-landing/src/lib/utils.ts
- `MagneticButton()` --calls--> `cn()`  [EXTRACTED]
  sites/orqest-landing/src/components/ui/MagneticButton.tsx → sites/orqest-landing/src/lib/utils.ts
- `sites/orqest-landing/docker-compose.yml` --mentions-env--> `NEXT_PUBLIC_GA4_ID`  [EXTRACTED]
  sites/orqest-landing/docker-compose.yml → sites/orqest-landing/.env.example
- `sites/orqest-landing/docker-compose.yml` --mentions-env--> `NEXT_PUBLIC_META_PIXEL_ID`  [EXTRACTED]
  sites/orqest-landing/docker-compose.yml → sites/orqest-landing/.env.example

## Import Cycles
- None detected.

## Communities (19 total, 8 thin omitted)

### Community 0 - "components"
Cohesion: 0.11
Nodes (21): AgentListProps, AgentsSection(), ButtonLinkProps, ContainerProps, CtaSection(), CtaSectionProps, Header(), HeaderProps (+13 more)

### Community 1 - "page"
Cohesion: 0.15
Nodes (15): FalseHope(), FAQ(), faqs, HowItWorks(), steps, Problem(), Proof(), results (+7 more)

### Community 2 - "tsconfig"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 3 - "package"
Cohesion: 0.11
Nodes (17): dependencies, clsx, framer-motion, geist, next, @radix-ui/react-dialog, react, react-dom (+9 more)

### Community 4 - "CMD node"
Cohesion: 0.12
Nodes (17): CMD ["node",, COPY ., COPY --from=builder, COPY --from=builder, COPY package*.json, ENV HOSTNAME="0.0.0.0", ENV NODE_ENV=production, ENV PORT=3000 (+9 more)

### Community 5 - "Container"
Cohesion: 0.22
Nodes (9): Container(), OrqestIcon(), OrqestLogo(), Footer(), AgentCard(), AgentCardProps, GlassNav(), GlassNavProps (+1 more)

### Community 6 - "page"
Cohesion: 0.21
Nodes (7): metadata, Closing(), ClosingProps, Hero(), HeroProps, MagneticButton(), MagneticButtonProps

### Community 7 - "QualificationModal"
Cohesion: 0.22
Nodes (6): QualificationModal(), QualificationModalProps, QUESTIONS, QuizAnswer, QuizState, useQualification()

### Community 8 - "NODE ENV"
Cohesion: 0.27
Nodes (10): NODE_ENV, sites/orqest-landing/docker-compose.yml, sites/orqest-landing/.env.example, service:orqest-landing, NEXT_PUBLIC_CAL_LINK, NEXT_PUBLIC_GA4_ID, NEXT_PUBLIC_META_PIXEL_ID, WEBHOOK_URL (+2 more)

### Community 9 - "devDependencies"
Cohesion: 0.22
Nodes (9): devDependencies, eslint, eslint-config-next, postcss, tailwindcss, @types/node, @types/react, @types/react-dom (+1 more)

### Community 10 - "AgentsBento"
Cohesion: 0.43
Nodes (6): AgentsBento(), BriefingSimulation, DadosSimulation, PautaSimulation, PlanejamentoSimulation, RoteiroSimulation

## Knowledge Gaps
- **73 isolated node(s):** `extends`, `nextConfig`, `name`, `version`, `private` (+68 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **8 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cn()` connect `Container` to `components`, `page`, `page`?**
  _High betweenness centrality (0.039) - this node is a cross-community bridge._
- **Why does `MagneticButton()` connect `page` to `components`, `Container`?**
  _High betweenness centrality (0.018) - this node is a cross-community bridge._
- **What connects `extends`, `NOTE: This file should not be edited`, `nextConfig` to the rest of the system?**
  _74 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `components` be split into smaller, more focused modules?**
  _Cohesion score 0.11375661375661375 - nodes in this community are weakly interconnected._
- **Should `page` be split into smaller, more focused modules?**
  _Cohesion score 0.14666666666666667 - nodes in this community are weakly interconnected._
- **Should `tsconfig` be split into smaller, more focused modules?**
  _Cohesion score 0.10526315789473684 - nodes in this community are weakly interconnected._
- **Should `package` be split into smaller, more focused modules?**
  _Cohesion score 0.1111111111111111 - nodes in this community are weakly interconnected._