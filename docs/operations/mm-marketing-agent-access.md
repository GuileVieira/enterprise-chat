# Liberar uso e execução dos agentes compartilhados sem edição

O script `mm-marketing-agent-access.mongosh.js` usa o banco selecionado na conexão. Selecione o banco de produção correto; neste projeto o nome padrão é `Orqest`.

Primeiro, execute a simulação no terminal, a partir da raiz do repositório, usando a conexão Mongo já configurada em `MONGO_URI`:

```bash
mongosh "$MONGO_URI" --file docs/operations/mm-marketing-agent-access.mongosh.js
```

Confira a lista de agentes e tenants de origem. Para aplicar o mesmo procedimento:

```bash
APPLY=true mongosh "$MONGO_URI" --file docs/operations/mm-marketing-agent-access.mongosh.js
```

O script considera somente ACLs de tenant existentes e não expiradas que concedam `AGENT VIEW` a `mm-marketing`. Para esses agentes, mantém `AGENT VIEW`, remove EDIT/DELETE/SHARE do tenant e garante `REMOTE_AGENT VIEW`. Não transforma grants públicos, de usuários ou grupos em grants de tenant e não altera permissões individuais dos autores. Preserva o bit separado de Insights e não estende a validade dos grants existentes. Grants remotos novos herdam a expiração do compartilhamento de origem. Não altera papéis.

**A versão anterior deste script concedia EDIT. Execute esta versão para retirar essa permissão dos compartilhamentos existentes.** O deploy sozinho não modifica as ACLs já gravadas. O script não modifica credenciais, projetos, skills ou conta Meta Ads. A exportação de instruções exige EDIT na implementação atual e fica bloqueada para esses consumidores; o uso do agente e sua API continua autorizado por VIEW, sujeito aos demais gates.

Restrições `agentIds` da chave, configuração efetiva `apiKey` e o gate `REMOTE_AGENTS USE` continuam valendo. O OWNER que representa a chave precisa continuar ativo no tenant. O script não executa agentes nem altera anúncios.

`OWNER` é papel de sistema e o runtime consulta sua definição global em determinadas rotas. Alterar um documento `OWNER` artificial do tenant pode não ter efeito. Alterar o OWNER global afetaria outros tenants; este script não faz isso. Confirme `REMOTE_AGENTS USE` com a mesma chave e rota que será usada; um teste de tools na API de integrações não comprova todos os gates da rota chat/completions. Se o gate continuar negando, será necessário configurar a política efetiva da rota, não ampliar ACLs indiscriminadamente.

Execute em uma janela sem alterações de compartilhamento por outros operadores. O script revalida cada grant, registra agentes ignorados por mudanças ou expiração e usa a validade atual da origem. As duas concessões não são uma transação: uma revogação concorrente entre as gravações ainda pode deixar acesso remoto independente. Não execute duas cópias simultaneamente. A expiração é mantida no banco; a aplicação atual pode depender da limpeza TTL do Mongo para remover grants expirados.
