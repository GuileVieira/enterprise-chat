# Guia Rápido de Whitelabel (Tema/Branding)

Este guia mostra como atualizar cores, fontes, espaçamentos, bordas e imagens desta aplicação de forma simples e rápida.

- Framework de UI: Tailwind CSS + variáveis CSS
- Tema: claro/escuro por classe na tag `html` e tema dinâmico opcional via Provider
- Ponto principal: você muda variáveis CSS e os utilitários Tailwind refletem as mudanças automaticamente

---

## 1) Cores

Há duas formas de ajustar as cores: Base (variáveis em CSS) e Dinâmica (aplicadas em runtime via Provider).

### 1.1 Base (CSS)
Edite as variáveis nas seções `html` (modo claro) e `.dark` (modo escuro):
- `client/src/style.css` (seções iniciando em `html { ... }` e `.dark { ... }`)
  - Exemplos de variáveis:
    - `--text-*` (cores de texto)
    - `--surface-*` (fundos/superfícies, botões, diálogos)
    - `--border-*` (bordas)
    - `--brand-purple` (cor de marca)

As classes Tailwind mapeadas usam essas variáveis, por exemplo:
- `bg-surface-primary`, `text-text-primary`, `border-border-light`, `bg-brand-purple`
- Mapeamento em: `client/tailwind.config.cjs` (cores = `var(--...)`)

Dica: Para trocar amplamente a paleta, ajuste primeiro as variáveis em `html` e `.dark` e valide com classes Tailwind usadas na UI.

### 1.2 Dinâmica (Provider)
Se quiser definir um tema em tempo de execução (sem recompilar CSS):
- Provider de tema: `packages/client/src/theme/context/ThemeProvider.tsx`
- Aplicação de variáveis: `packages/client/src/theme/utils/applyTheme.ts`
- Temas base de exemplo: `packages/client/src/theme/themes/default.ts` e `.../dark.ts`
- Uso no app: `client/src/App.jsx` passa `ThemeProvider` (prop opcional `themeRGB`)

Como usar:
1. Crie um objeto `IThemeRGB` com valores RGB em formato "R G B" (ex.: `"33 33 33"`).
2. Passe como `themeRGB` para `<ThemeProvider themeRGB={customTheme} />`.
3. O Provider aplica as variáveis CSS automaticamente.

#### Via variáveis de ambiente (opcional)
- Loader: `client/src/utils/getThemeFromEnv.js` (usa prefixo `REACT_APP_THEME_`)
- Vite por padrão só carrega prefixos definidos em `client/vite.config.ts` (`envPrefix`). Para usar `REACT_APP_THEME_`, faça UMA das opções:
  - Opção A: adicionar `'REACT_APP_THEME_'` em `envPrefix` (arquivo `client/vite.config.ts`).
  - Opção B: renomear as envs para `VITE_THEME_*` e adaptar o loader para ler `import.meta.env` com esse prefixo.

Exemplo `.env.local` (Opção A):
```
REACT_APP_THEME_BRAND_PURPLE=171 104 255
REACT_APP_THEME_TEXT_PRIMARY=33 33 33
REACT_APP_THEME_SURFACE_PRIMARY=255 255 255
REACT_APP_THEME_SURFACE_SUBMIT=4 120 87
```

---

## 2) Espaçamentos

- Usa escala padrão do Tailwind nas classes (`p-*`, `m-*`, `gap-*`, etc.)
- Token específico: largura da página de autenticação
  - `client/tailwind.config.cjs` → `theme.extend.width.authPageWidth`
- Para criar uma escala própria, adicione em `theme.extend.spacing` no `tailwind.config.cjs`.

---

## 3) Formas (bordas/raios)

- Raio global controlado por variável CSS: `--radius`
  - Local: `client/src/style.css` (em `html { ... }`)
- Tailwind usa `--radius` para `rounded-lg|md|sm`
  - Local: `client/tailwind.config.cjs` → `theme.extend.borderRadius`

Altere `--radius` para um efeito global de cantos mais arredondados (e mantenha as classes `rounded-*` nos componentes).

---

## 4) Tipografia

- Família padrão configurada no Tailwind:
  - `client/tailwind.config.cjs` → `theme.fontFamily` (`Inter`, `Roboto Mono`)
- Fontes carregadas em `client/src/style.css` (`@font-face`)

Para trocar a fonte:
1. Adicione/atualize `@font-face` com os arquivos em `client/public/fonts`.
2. Atualize `theme.fontFamily` em `tailwind.config.cjs`.

---

## 5) Imagens/Ícones/PWA

- Logo (telas de autenticação):
  - Referência em `client/src/components/Auth/AuthLayout.tsx` → `src="assets/logo.svg"`
  - Substitua o arquivo em `client/public/assets/logo.svg` (ou ajuste o caminho no componente)

- Favicons e ícones PWA:
  - HTML: `client/index.html` (links para `assets/favicon-*.png`, `apple-touch-icon`)
  - Manifest/Vite PWA: `client/vite.config.ts` → `manifest.icons` e `theme_color`
  - Cor da barra do navegador: meta `theme-color` em `client/index.html`

- Ícones/figuras internos: coloque em `client/public/assets/` e referencie por caminho relativo.

---

## 6) Modo Claro/Escuro

- Persistência e classe na raiz controladas pelo Provider:
  - `packages/client/src/theme/context/ThemeProvider.tsx`
  - Chaves no localStorage: `color-theme`, `theme-colors`, `theme-name`
- Classe `dark` é aplicada em `html` conforme preferência do usuário ou sistema.
- O seletor de tema (UI) está disponível nas configurações.

---

## 7) Diagramas (Mermaid) — opcional

- Paleta customizada em `client/src/utils/mermaid.ts` (objeto `themeVariables`)
- Ajuste aqui se você usa componentes Mermaid e precisa alinhar com a nova paleta.

---

## 8) Cheatsheet de arquivos

- Cores base (CSS): `client/src/style.css`
- Mapeamento Tailwind: `client/tailwind.config.cjs`
- Provider de Tema: `packages/client/src/theme/context/ThemeProvider.tsx`
- Aplicar tema dinâmico: `packages/client/src/theme/utils/applyTheme.ts`
- Temas exemplo: `packages/client/src/theme/themes/default.ts`, `.../dark.ts`
- Loader de env para tema: `client/src/utils/getThemeFromEnv.js`
- Entrada do app (ThemeProvider): `client/src/App.jsx`
- Logo/Assets: `client/public/assets/*`, `client/src/components/Auth/AuthLayout.tsx`
- PWA/Manifest/Meta: `client/vite.config.ts`, `client/index.html`

---

## 9) Receitas rápidas

- Trocar cor primária da marca:
  1. Edite `--brand-purple` em `client/src/style.css` (light e dark)
  2. Use `text-brand-purple`, `bg-brand-purple` onde necessário

- Deixar superfícies mais claras/escuras:
  1. Ajuste `--surface-primary`, `--surface-secondary`, etc., em `style.css`
  2. Verifique componentes com `bg-surface-*` e `border-border-*`

- Aumentar cantos arredondados globalmente:
  1. Edite `--radius` em `client/src/style.css`
  2. Garanta uso consistente de `rounded-lg|md|sm`

- Trocar fonte da interface:
  1. Atualize `@font-face` em `client/src/style.css`
  2. Atualize `theme.fontFamily` em `client/tailwind.config.cjs`

- Substituir logo e favicon:
  1. Troque `client/public/assets/logo.svg`
  2. Atualize favicons em `client/public/assets/`
  3. Ajuste `client/index.html` e `client/vite.config.ts` se mudar nomes

- Aplicar tema via env (sem recompilar cores no CSS):
  1. Configure envs `REACT_APP_THEME_*` (ou `VITE_THEME_*` conforme opção)
  2. Ajuste `envPrefix` no `vite.config.ts` ou o loader `getThemeFromEnv.js`
  3. Reinicie o dev server para refletir as envs

---

## 10) Notas importantes

- Tailwind compila utilitários que referenciam `var(--...)`: mudar a variável muda a cor em toda a UI instantaneamente.
- Para mudanças profundas de escala (spacing/typography), mantenha a consistência dos tokens no `tailwind.config.cjs`.
- Se usar tema dinâmico, os valores devem ser RGB "R G B" (p.ex. `"4 120 87"`), o Provider converte para `rgb(...)` corretamente.
- Em ambientes Vite, por padrão somente prefixos definidos em `envPrefix` são injetados — ajuste isso ao usar envs de tema.

---

Precisa que eu aplique um exemplo de paleta/branding já? Posso atualizar os arquivos para você.

