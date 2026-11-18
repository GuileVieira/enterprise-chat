# Portabilidade de agentes

## Contrato

O cliente autenticado por sessão usa `/api/agents`. A API de gerenciamento usa `/api/agents/v1/agents` e a autenticação própria dessa rota.

| Operação relativa à base | Resultado                                                                                                         |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| GET /{id}/export         | 200, application/zip, anexo nomeado pelo agente                                                                   |
| POST /import/preview     | Multipart com campo file. 200 com name, skills, tools e warnings. As três listas contêm strings. Nenhuma escrita. |
| POST /import             | Mesmo arquivo multipart. Revalida conteúdo, dependências e permissões. 201 com o novo agente.                     |

O ZIP tem uma pasta raiz derivada do nome. agent.json contém formatVersion igual a 1, os campos portáveis do agente e listas de referências locais a skills e tools. instructions.md preserva o texto. Cada skills/<alias>/ contém SKILL.md e arquivos auxiliares. Cada tools/<alias>.json identifica nome, tipo e descrição opcional. Os campos do agente são name, description, provider, model, skills_enabled e skills_scope. O escopo selected vazio deve continuar vazio. O escopo all depende do catálogo autorizado do destino.

## Segurança e integridade

- Exportar configuração requer a permissão de leitura de configuração completa da gestão. Verificar acesso a cada skill antes de ler o corpo ou o storage. Conceder acesso de execução remota é uma operação independente.
- Serializar somente campos declarados. Excluir identificadores de origem, autoria, grants, credenciais armazenadas, cabeçalhos de autenticação, kwargs e configuração privada de conectores. Texto e anexos fornecidos pelo autor podem conter dados sensíveis e exigem revisão para compartilhamento.
- Validar caminho original e normalizado, raiz única, versão, referências e tipos. Rejeitar traversal, caminhos absolutos, links, colisões, duplicatas e conteúdo fora do formato. Limitar entrada, quantidade de arquivos, bytes por arquivo e bytes efetivamente descompactados.
- Importar sempre como novo agente do usuário e tenant atuais pelo fluxo de criação, incluindo seus grants padrão. Respeitar a política de código de skills e as permissões de criação e acesso. Exibir dependências indisponíveis na prévia. Ativar apenas ferramentas disponíveis e permitidas. Uma definição portátil nunca autoriza execução ou conexão.
- Reutilizar uma skill já pertencente ao autor/tenant de destino somente após conferir VIEW e equivalência do frontmatter efetivo, corpo e todos os anexos. Avisar na prévia. Não alterar nem remover essa skill na compensação. Uma skill de mesmo nome com conteúdo diferente é conflito 409. Agentes com skills homônimas distintas precisam resolver os nomes antes da exportação.
- Ferramentas nativas file_search, web_search e execute_code podem ser vinculadas conforme capability e papel do destino. MCP, actions e funções personalizadas viram referências para reconexão manual; não transportar domínio privado, ID de registro ou ID de função do tenant. Não copiar projetos, arquivos RAG, memórias, parâmetros privados ou subagentes. Modelo e provedor são preservados como referências e precisam existir no destino antes da execução.
- Limites: 20 MiB comprimidos, 50 MiB descompactados, 10 MiB por arquivo e 500 entradas. O codec não aceita entradas explícitas de diretório; o ZIP exportado pelo Orqest usa apenas entradas de arquivo.
- Preservar recursos preexistentes após erros. Compensar escritas próprias incompletas, inclusive arquivos em storage, ou usar uma operação atômica onde houver suporte.

## Entregas e aceitação

1. Codec e testes em packages/api. Verificar ida e volta de instruções Unicode, skill com anexo binário e ferramentas, rejeição de ZIP inválido, escopos e exclusão de campos privados.
2. Backend e contrato OpenAPI. Cobrir os dois mecanismos de autenticação, ACL entre tenants, SKILL VIEW, criação, prévia sem escrita, repetição com novo ID e falha parcial. Testar as rotas pelo roteador real.
3. Interface, data provider e traduções pt-BR/en. Baixar o ZIP, escolher arquivo, ler dependências e avisos, confirmar ou cancelar. Após sucesso atualizar a lista e selecionar o agente criado. Cobrir cancelamento, erro e confirmação em testes focados.
4. Revisão independente. Conferir diferenças entre contratos, rotas e telas, reavaliar validação e permissões e registrar verificações executadas.

## Evidências locais

Planejamento por Astra; implementação dividida entre três Terra (codec, backend/contratos e interface); revisão independente por Sol. A integração final corrigiu os problemas apontados: limites de ZIP, colisões de nomes, frontmatter, conflitos de skills, informações privadas de conectores e projeção da resposta de gerenciamento.

- 76 testes focados de codec, projeção, transferência e import/export de skills passaram.
- 21 testes HTTP/Mongo e gerenciamento passaram; a criação nativa do agente usa spy nessa suíte, sem provar toda a cadeia real do controller.
- 6 testes de interface passaram; typecheck do cliente e build do data-provider passaram.
- Build e typecheck focados de packages/api, ESLint dos arquivos alterados e validação estrutural OpenAPI passaram.
- Sem deploy, alteração de Mongo de produção, navegador/E2E, OIDC real ou execução de agente/conector externo. O script Mongo foi revisado e teve sintaxe conferida, mas não foi executado contra produção.
