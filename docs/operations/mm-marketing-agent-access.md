# Liberar exportação e execução dos agentes compartilhados

O script `mm-marketing-agent-access.mongosh.js` usa o banco selecionado na conexão. Selecione o banco de produção correto; neste projeto o nome padrão é `Orqest`.

Primeiro, execute a simulação no terminal, a partir da raiz do repositório, usando a conexão Mongo já configurada em `MONGO_URI`:

```bash
mongosh "$MONGO_URI" --file docs/operations/mm-marketing-agent-access.mongosh.js
```

Confira a lista de agentes e tenants de origem. Para aplicar o mesmo procedimento:

```bash
APPLY=true mongosh "$MONGO_URI" --file docs/operations/mm-marketing-agent-access.mongosh.js
```

O script considera somente ACLs de tenant existentes e não expiradas que concedam `AGENT VIEW` a `mm-marketing`. Para esses agentes, acrescenta `AGENT VIEW+EDIT` e `REMOTE_AGENT VIEW` ao tenant. Não transforma grants públicos, de usuários ou grupos em grants de tenant. Preserva permissões mais fortes e não estende a validade dos grants existentes. Grants remotos novos herdam a expiração do compartilhamento de origem. Não altera papéis.

**`AGENT EDIT` permite que membros do tenant editem o agente original compartilhado. Não é uma permissão exclusiva de download.** Não concede DELETE nem SHARE. O script não modifica credenciais, projetos, skills ou conta Meta Ads. As permissões próprias de cada skill continuam necessárias para exportar seu conteúdo.

Restrições `agentIds` da chave, configuração efetiva `apiKey` e o gate `REMOTE_AGENTS USE` continuam valendo. O OWNER que representa a chave precisa continuar ativo no tenant. O script não executa agentes nem altera anúncios.

`OWNER` é papel de sistema e o runtime consulta sua definição global em determinadas rotas. Alterar um documento `OWNER` artificial do tenant pode não ter efeito. Alterar o OWNER global afetaria outros tenants; este script não faz isso. Confirme `REMOTE_AGENTS USE` com a mesma chave e rota que será usada; um teste de tools na API de integrações não comprova todos os gates da rota chat/completions. Se o gate continuar negando, será necessário configurar a política efetiva da rota, não ampliar ACLs indiscriminadamente.

Execute em uma janela sem alterações de compartilhamento por outros operadores. O script revalida cada grant, registra agentes ignorados por mudanças ou expiração e usa a validade atual da origem. As duas concessões não são uma transação: uma revogação concorrente entre as gravações ainda pode deixar acesso remoto independente. Não execute duas cópias simultaneamente. A expiração é mantida no banco; a aplicação atual pode depender da limpeza TTL do Mongo para remover grants expirados.
