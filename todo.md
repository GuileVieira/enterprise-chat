# Orqest - Ideias Internas de Produto

## Direcao

A promessa da Orqest e instalar operacao digital para agencias. Internamente, o produto precisa sair de "chat com agentes" para um sistema onde a agencia consegue executar tarefas operacionais padronizadas com contexto, arquivos, memoria, aprovacoes e outputs reutilizaveis.

## Principios

- Cada agente deve resolver uma tarefa operacional clara.
- Cada fluxo deve gerar uma entrega revisavel, nao apenas uma resposta no chat.
- Cada projeto deve ter memoria, arquivos, skills e padroes compartilhados pela tenant/equipe.
- O usuario nao deve precisar saber prompt engineering.
- O admin deve conseguir instalar, compartilhar e acompanhar agentes por tenant/projeto.

## Prioridade Alta

### 1. Fluxo de Briefing Completo

Criar um fluxo guiado para transformar inputs soltos em briefing estruturado.

Entradas:

- Audio/transcricao de call.
- Anotacoes do account.
- Arquivos do cliente.
- Links de referencia.
- Objetivo da campanha.

Saidas:

- Briefing completo.
- Checklist de informacoes faltantes.
- Perguntas para enviar ao cliente.
- Resumo executivo para criacao.

Tools internas:

- `extract_client_context`
- `detect_missing_briefing_fields`
- `generate_briefing`
- `generate_client_questions`

### 2. Fluxo de Roteiro de Video

Criar fluxo especifico para roteiro.

Entradas:

- Briefing.
- Plataforma: Reels, TikTok, YouTube, Ads.
- Duracao.
- Tom.
- Objetivo: awareness, venda, autoridade, prova social.

Saidas:

- Hook.
- Estrutura por cenas.
- Texto de locucao.
- Direcao visual.
- CTA.
- Variacoes de hook.

Tools internas:

- `generate_video_script`
- `score_hook_strength`
- `generate_hook_variations`
- `adapt_script_to_platform`

### 3. Fluxo de Pautas e Calendario Editorial

Criar agente/fluxo para gerar pautas mensais.

Entradas:

- Cliente/projeto.
- Persona.
- Objetivos do mes.
- Datas importantes.
- Historico de posts.
- Concorrentes/referencias.

Saidas:

- Calendario de pautas.
- Angulos por post.
- Formato sugerido.
- Briefing de cada peca.
- Prioridade.

Tools internas:

- `generate_content_calendar`
- `cluster_content_angles`
- `detect_repeated_topics`
- `score_content_ideas`

### 4. Fluxo de Relatorio e Insights

Criar fluxo para transformar dados em relatorio pronto.

Entradas:

- CSV/export de Ads, Analytics, Instagram, TikTok, LinkedIn.
- Periodo.
- Objetivo da campanha.
- Observacoes do time.

Saidas:

- Resumo executivo.
- Principais ganhos.
- Quedas e alertas.
- Insights.
- Proximas acoes.
- Versao para cliente.

Tools internas:

- `parse_marketing_csv`
- `compare_period_metrics`
- `detect_metric_anomalies`
- `generate_client_report`
- `generate_next_actions`

### 5. Artifacts de Projeto

Criar entidade de "artifact" para outputs finais.

Tipos:

- Briefing.
- Roteiro.
- Calendario.
- Relatorio.
- Pesquisa.
- Checklist.

Recursos:

- Versionamento.
- Status: draft, review, approved, archived.
- Comentarios.
- Export para PDF/Markdown/Google Docs.
- Link com agente, projeto, arquivos e memoria usados.

Motivo:

Sem artifact, o output morre no chat. Com artifact, vira entrega operacional.

## Prioridade Media

### 6. Agent Templates por Operacao

Criar templates internos para instalar agentes rapidamente.

Templates:

- Account Briefing Agent.
- Creative Script Agent.
- Social Calendar Agent.
- Report Analyst Agent.
- Brand Voice Reviewer.
- Competitor Research Agent.
- Repurpose Content Agent.

Cada template deve incluir:

- Prompt base.
- Skills padrao.
- Tools habilitadas.
- Memorias esperadas.
- Formato de output.
- Checklist de qualidade.

### 7. Project Onboarding Wizard

Fluxo para configurar um novo projeto/cliente.

Etapas:

1. Dados do cliente.
2. Tom de voz.
3. Publico.
4. Produtos/servicos.
5. Concorrentes.
6. Arquivos de referencia.
7. Formatos de entrega.
8. Agentes recomendados.

Saida:

- Memoria de projeto.
- Skills de projeto.
- Agentes sugeridos.
- Primeiro fluxo pronto para rodar.

### 8. Admin Agent Installer

Tela/admin flow para o admin criar agente uma vez e compartilhar com tenants especificas.

Recursos:

- Criar agente global.
- Compartilhar com uma ou mais tenants.
- Revogar acesso.
- Ver tenants que usam.
- Duplicar para tenant.
- Atualizar versao do agente global.

Importante:

- Admin sempre ve tudo.
- Tenant so ve o que foi compartilhado ou criado dentro dela.

### 9. Skill Packs por Agencia

Agrupar skills em pacotes.

Exemplos:

- Pack de Briefing.
- Pack de Social Media.
- Pack de Relatorios.
- Pack de Ads.
- Pack de Copy.

Cada pack:

- Skills.
- Exemplos.
- Padroes de output.
- Regras de revisao.
- Prompts auxiliares.

### 10. QA / Checklist Automatico

Antes de entregar artifact, rodar uma validacao.

Checks:

- Tem objetivo claro?
- Tem publico definido?
- Tem CTA?
- Segue tom da marca?
- Falta informacao critica?
- O output esta no formato esperado?
- Ha afirmacoes sem base?

Tools internas:

- `validate_briefing_quality`
- `validate_script_quality`
- `validate_report_quality`
- `validate_brand_voice`

## Prioridade Baixa

### 11. Approval Gates

Fluxos com aprovacao antes de finalizar ou exportar.

Estados:

- generated
- needs_review
- approved
- rejected
- revision_requested

Acoes:

- Aprovar.
- Pedir ajuste.
- Regerar trecho.
- Salvar como template.

### 12. Execution Timeline

Mostrar o que o agente fez.

Eventos:

- Arquivos usados.
- Memorias consultadas.
- Tools chamadas.
- Tempo total.
- Modelo usado.
- Custo estimado.
- Artifact gerado.

Motivo:

Ajuda confianca e debugging.

### 13. Usage Dashboard

Dashboard por tenant/projeto.

Metricas:

- Agentes mais usados.
- Fluxos executados.
- Artifacts gerados.
- Tempo estimado economizado.
- Aprovacoes.
- Rejeicoes.
- Usuarios ativos.

### 14. Feedback Loop

Permitir feedback em cada artifact/run.

Opcoes:

- Bom resultado.
- Precisa de mais contexto.
- Fora do tom.
- Incompleto.
- Muito generico.

Uso:

- Atualizar memoria.
- Sugerir ajuste na skill.
- Marcar agente para revisao.

### 15. Integracoes Futuras

Integracoes mais alinhadas com agencia:

- Google Drive.
- Google Docs.
- Notion.
- Slack.
- ClickUp.
- Asana.
- Trello.
- Meta Ads CSV.
- Google Analytics export.
- Instagram/TikTok analytics export.

## Tools Especificas Sugeridas

### Briefing

- `extract_client_context`
- `detect_missing_briefing_fields`
- `generate_briefing`
- `generate_client_questions`
- `summarize_discovery_call`

### Roteiro

- `generate_video_script`
- `score_hook_strength`
- `generate_hook_variations`
- `adapt_script_to_platform`
- `generate_scene_breakdown`

### Conteudo

- `generate_content_calendar`
- `cluster_content_angles`
- `detect_repeated_topics`
- `score_content_ideas`
- `repurpose_content`

### Relatorios

- `parse_marketing_csv`
- `compare_period_metrics`
- `detect_metric_anomalies`
- `generate_client_report`
- `generate_next_actions`

### Governanca

- `validate_brand_voice`
- `validate_output_schema`
- `validate_briefing_quality`
- `validate_script_quality`
- `validate_report_quality`

## Ordem Recomendada de Execucao

1. Artifact de projeto.
2. Fluxo de briefing completo.
3. Agent templates por operacao.
4. Project onboarding wizard.
5. Fluxo de roteiro.
6. Fluxo de pautas/calendario.
7. Fluxo de relatorio.
8. QA automatico.
9. Admin agent installer.
10. Usage dashboard.

## MVP Interno Recomendado

Implementar primeiro:

1. Um artifact simples.
2. Um fluxo de briefing.
3. Um template de agente de briefing.
4. Memoria/arquivos/skills globais por projeto.
5. Export markdown/pdf.

Motivo:

Briefing e a dor mais clara da landing, tem output facil de avaliar e vira base para roteiro, pauta e planejamento.

