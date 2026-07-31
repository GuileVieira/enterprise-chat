# Plano — busca Tavily e leitura local de URLs

## Decisão

- `tavily_search_results_json` é o único buscador ativo e usa `TAVILY_API_KEY`.
- `fetch_url({ url })` lê diretamente uma URL pública, sem depender da busca.
- `web_search` de agentes salvos é normalizado para Tavily + `fetch_url`.
- DuckDuckGo permanece compatível no código upstream, mas não entra em `includedTools` nem no fluxo padrão.

## Segurança e limites do `fetch_url`

- somente HTTP(S), sem credenciais na URL;
- proteção SSRF no DNS, conexão e em cada redirect;
- até 3 redirects e timeout de 8 segundos por requisição;
- máximo de 500 KiB por resposta e 12 mil caracteres de texto;
- HTML, texto e JSON; scripts e estilos removidos;
- erro estruturado para o agente.

## Configuração

```env
TAVILY_API_KEY=<secret>
```

```yaml
webSearch:
  searchProvider: tavily
  scraperProvider: tavily
  tavilyApiKey: '${TAVILY_API_KEY}'
```

## Aceite

- busca do agente chama Tavily, nunca DuckDuckGo;
- URL explícita chama `fetch_url` antes de responder;
- `fetch_url` funciona mesmo sem chave Tavily;
- URL privada é bloqueada;
- `https://codeburn.app/` retorna conteúdo real pelo registro usado pelo agente.
