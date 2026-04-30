# Projects — Visão Geral da Feature

> Organização de conversas em containers persistentes com instruções customizadas, memórias, prompts/skills e arquivos compartilhados. Paridade funcional com ChatGPT/Claude Projects.

---

## O que é

Projects permite que usuários agrupem conversas em containers persistentes chamados **projetos**. Cada projeto carrega:

- **Instruções customizadas** — injetadas automaticamente como system prompt em todas as conversas do projeto
- **Memórias** — pares chave/valor que contextualizam o assistente sobre o domínio do projeto
- **Prompt Snippets** — atalhos rápidos de texto que o usuário pode inserir no chat
- **Prompt Groups** — associação com grupos de prompts existentes no sistema
- **Arquivos** — documentos anexados ao projeto e implicitamente disponíveis em todas as conversas
- **Configuração padrão** — endpoint e modelo pré-definidos para novas conversas no projeto

Conversas podem ser filtradas por projeto, movidas entre projetos, e criadas diretamente dentro de um projeto com todas as configurações herdadas.

---

## Funcionalidades Principais

### 1. CRUD de Projetos
Criar, editar, arquivar e excluir projetos. Cada projeto tem nome, descrição, instruções, endpoint/model default e memórias.

### 2. Injeção de Contexto em Conversas
Toda conversa dentro de um projeto recebe automaticamente:
- As **instruções do projeto** como prefixo do system prompt
- As **memórias do projeto** formatadas como lista markdown
- Os **arquivos do projeto** anexados implicitamente à conversa

Isso funciona em todos os endpoints: Agents, Assistants v1/v2, e endpoints regulares.

### 3. Filtro e Navegação por Projeto
- Sidebar exibe um seletor de projetos para filtrar a lista de conversas
- Página `/projects` mostra todos os projetos em grid
- Página `/projects/:id` exibe detalhes com abas (Conversas, Prompts, Memórias, Arquivos, Configurações)

### 4. Gerenciamento de Conversas
- **Nova conversa no projeto** — herda `endpoint`, `model` e `projectId`
- **Mover conversa para projeto** — ação no menu de contexto da conversa
- **Busca filtrada** — MeiliSearch suporta filtro por `projectId`

### 5. Sharing & Permissões (ACL)
Projetos usam o mesmo sistema de ACL de Agents:
- **Viewer** — pode ver o projeto e suas conversas
- **Editor** — pode editar o projeto
- **Owner** — pode deletar e compartilhar

### 6. Memórias e Prompts
- Editor de memórias com pares chave/valor na aba "Memóries"
- Snippets rápidos exibidos como chips acima do textarea quando a conversa está em um projeto
- Associação com Prompt Groups existentes na aba "Prompts"

---

## Fluxos Principais

### Fluxo 1: Criar Projeto e Iniciar Conversa
1. Usuário clica "New Project" em `/projects`
2. Preenche nome, descrição, instruções e endpoint/model
3. Clica "Create" — é redirecionado para `/projects/:id`
4. Na aba "Conversations", clica "New Chat"
5. Nova conversa herda `projectId`, `endpoint` e `model` do projeto
6. As instruções e memórias do projeto são injetadas automaticamente no system prompt

### Fluxo 2: Mover Conversa Existente para Projeto
1. Usuário abre o menu de contexto de uma conversa na sidebar
2. Seleciona "Move to Project"
3. Escolhe o projeto destino (ou "Remove from Project" para desassociar)
4. A conversa agora herda o contexto do novo projeto nas próximas interações

### Fluxo 3: Compartilhar Projeto
1. Owner do projeto acessa a página de detalhes
2. Usa o sistema de ACL para conceder acesso a usuários ou grupos
3. Usuários com permissão de VIEW veem o projeto em sua lista e podem acessar suas conversas

---

## Glossário

| Termo | Definição |
|-------|-----------|
| **Project** | Container persistente que agrupa conversas, instruções, memórias, prompts e arquivos |
| **Instructions** | System prompt customizado que é injetado em todas as conversas do projeto |
| **Memories** | Pares chave/valor que fornecem contexto persistente ao assistente |
| **Prompt Snippets** | Textos pré-definidos que o usuário pode inserir rapidamente no chat |
| **Prompt Groups** | Coleções de prompts existentes no sistema que podem ser associadas a um projeto |
| **Project Files** | Arquivos anexados ao projeto e implicitamente disponíveis em todas as suas conversas |
| **ACL** | Access Control List — sistema de permissões por recurso (viewer/editor/owner) |

---

## Status da Implementação

| Epic | Funcionalidade | Status |
|------|---------------|--------|
| Epic 1 | Foundation — Schema, Rotas, Data Provider | Completo |
| Epic 2 | System Prompt Injection | Completo |
| Epic 3 | Memories & Prompts | Completo |
| Epic 4 | Project Files | Completo |
| Epic 5 | Sharing & Permissions | Completo |
| Epic 6 | Frontend UI — Lista, Detail, Form | Completo |
| Epic 7 | Conversation Integration — Filtro, New Chat, Move | Completo |
| Epic 8 | Search & Indexing — MeiliSearch `projectId` | Completo |
| Epic 9 | Testing & QA | Completo |

---

## Testes

| Tipo | Quantidade | Status |
|------|-----------|--------|
| Backend — DB Methods | 100% dos métodos de project cobertos | Passando |
| Backend — API Routes | 17 testes (CRUD + ACL + erros) | Passando |
| Backend — Utils | 21 testes (instructions, memories, fileIds) | Passando |
| Frontend — Components | 56 testes em 6 specs | Passando |
| Frontend — Hook | 6 testes (useProjectPermissions) | Passando |
| E2E | 3 specs (page load, create flow, tabs) | Criado |

---

*Gerado em 30/04/2026. Baseado na análise do codebase real.*
