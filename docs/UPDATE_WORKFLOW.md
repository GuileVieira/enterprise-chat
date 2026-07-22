# Orqest — Fluxo de Atualização e Ambiente

> Documento de referência para rodar o projeto localmente e gerenciar atualizações do upstream de forma segura.

---

## Como Rodar o Projeto

Você não é obrigado a usar Docker, mas ele é altamente recomendado porque o projeto precisa de **MongoDB** (obrigatório) e, opcionalmente, Meilisearch, RAG API e pgvector.

### Opção 1: Com Docker (Recomendado)

Sobe MongoDB, Meilisearch, RAG API e pgvector automaticamente:

```bash
# Copie o env e configure o mínimo
cp .env.example .env

# Suba os serviços com Docker Compose
docker compose up -d

# Instale as dependências e faça o build dos pacotes
npm run smart-reinstall

# Rode o backend (porta 3080)
npm run backend:dev

# Em outro terminal, rode o frontend (porta 3090)
npm run frontend:dev
```

Acesse: `http://localhost:3080`

### Opção 2: Sem Docker

Você precisa ter o **MongoDB instalado localmente** (e, opcionalmente, Meilisearch).

```bash
# Copie o env e configure o mínimo
cp .env.example .env
```

Edite o `.env` e garanta as variáveis mínimas:

```bash
MONGO_URI=mongodb://127.0.0.1:27017/Orqest (kept for upstream compatibility)
MEILI_HOST=http://127.0.0.1:7700
DOMAIN_CLIENT=http://localhost:3080
DOMAIN_SERVER=http://localhost:3080
```

```bash
# Instale dependências e build
npm run smart-reinstall

# Rode backend e frontend em terminais separados
npm run backend:dev
npm run frontend:dev
```

### Requisitos

| Requisito | Versão |
|---|---|
| Node.js | `v20.19.0+` ou `^22.12.0` ou `>= 23.0.0` |
| npm | `11.10.0` (fixado no projeto) |
| MongoDB | Obrigatório |
| Meilisearch | Recomendado (busca de conversas) |

> **⚠️ Não use `pnpm` ou `yarn`.** O projeto usa `npm` com workspaces + Turborepo.

### Comandos Úteis

| Comando | O que faz |
|---|---|
| `npm run smart-reinstall` | Instala deps (se lockfile mudou) + build via turbo |
| `npm run reinstall` | Apaga `node_modules` e reinstala tudo |
| `npm run backend:dev` | Backend com nodemon (porta 3080) |
| `npm run frontend:dev` | Vite dev server (porta 3090) |
| `npm run build` | Build de produção de todos os pacotes |
| `npm run build:data-provider` | Rebuild do `packages/data-provider` |
| `npm run lint:fix && npm run format` | Corrige lint e formata código |

### Preparação para Testes

```bash
# Cria o arquivo auth.json vazio exigido pelos testes
mkdir -p api/data && echo '{}' > api/data/auth.json

# Copia o env de teste
cp api/test/.env.test.example api/test/.env.test
```

---

## Estratégia de Branches para Atualização

Esse modelo separa a base upstream, o produto estável e a validação de updates. É mais seguro do que usar uma única branch para tudo.

### Modelo de Branches

| Branch | Papel |
|---|---|
| `main` | Base sincronizada com `Orqest/upstream`. Recebe o código original do projeto (upstream). |
| `wl/main` | White label em produção ou estável. Sua versão customizada e confiável. |
| `integration/upstream-<data>` | Branch temporária para testar e absorver uma nova atualização do upstream. |
| `feature/...` | Mudanças novas do seu produto. |
| `hotfix/...` | Correções urgentes que precisam ir direto para produção. |

### Fluxo de Atualização (Passo a Passo)

Quando sair uma nova versão do upstream (Orqest):

```bash
# 1. Atualize a main com o upstream
git checkout main
git pull upstream main
git push origin main

# 2. Garanta que sua wl/main está atualizada
git checkout wl/main
git pull origin wl/main

# 3. Crie a branch de integração
git checkout -b integration/upstream-$(date +%Y-%m-%d)

# 4. Traga o código novo do upstream para cima da sua base atual
git merge wl/main          # garante que está partindo da sua base
git merge main             # aplica o update do upstream
```

> Resolva conflitos, se houver. Priorize manter suas customizações (`wl/main`) quando o conflito for em código próprio.

```bash
# 5. Roda testes e validações (veja checklist abaixo)
npm run smart-reinstall
npm run lint:fix && npm run format
npm run build

# Suba localmente e teste manualmente:
npm run backend:dev
# npm run frontend:dev (em outro terminal)
```

Se estiver tudo estável:

```bash
# 6. Promove a integração para wl/main
git checkout wl/main
git merge integration/upstream-$(date +%Y-%m-%d)
git push origin wl/main

# 7. Opcional: delete a branch de integração
git branch -d integration/upstream-$(date +%Y-%m-%d)
```

### Ciclo Visual

```
upstream/main ──────────────► main (seu fork)
                                    │
                                    │ (merge)
                                    ▼
wl/main ◄────── integration/upstream-YYYY-MM-DD
   │                      ▲
   │                      │ (criada a partir de wl/main)
   │                      │
   └──────────────────────┘ (após validação, merge de volta)
```

---

## Checklist de Validação Pós-Update

Antes de promover `integration/` para `wl/main`, verifique:

- [ ] Build completo passa sem erros: `npm run build`
- [ ] Typecheck passa em todos os pacotes
- [ ] Lint e formatação estão limpos: `npm run lint:fix && npm run format`
- [ ] Backend sobe sem crash: `npm run backend:dev`
- [ ] Frontend sobe e carrega: `npm run frontend:dev`
- [ ] Login funciona (local + OAuth, se aplicável)
- [ ] Chat básico responde
- [ ] Providers configurados respondem corretamente
- [ ] Busca de conversas funciona (Meilisearch)
- [ ] Upload de arquivos funciona
- [ ] UI não quebrou (verifique suas customizações visuais)
- [ ] Seus patches/features específicos ainda estão presentes

---

## Dicas Importantes

- **Nunca faça merge direto da `main` para `wl/main`** sem passar por uma branch de integração. Isso evita quebrar produção.
- **Mantenha a `main` sempre limpa**: ela deve refletir fielmente o upstream, sem commits próprios.
- **Commits na `wl/main`**: use apenas merge de integrações validadas ou `hotfix/` aprovados.
- **Feature branches**: sempre partam de `wl/main` e façam PR/MR de volta para `wl/main`.
- **Regras do projeto**: consulte `AGENTS.md` para convenções de código, padrões de commit e restrições técnicas.
