# Gravações de reunião: recuperação e diagnóstico

A gravação do navegador solicita 48.000 bits/s. O navegador pode ajustar a taxa; o evento de captura registra `audioBitsPerSecond` efetivo. A opção de incluir a chamada mistura microfone e áudio da aba selecionada. É necessário compartilhar áudio no seletor do navegador. Se a seleção não tiver áudio, a captura falha explicitamente e libera os dispositivos. Encerrar o compartilhamento finaliza a gravação.

## Cópia local

Blocos ficam no IndexedDB depois de enviados. Confirmações de envio são salvas para evitar reenviar blocos já recebidos. A cópia é removida quando o servidor informa `completed`, quando o usuário a descarta ou ao completar 24 horas. O limite global de áudio local é 2 GiB; atingir o limite interrompe a captura e preserva os blocos já salvos. Fechar/limpar dados do navegador pode remover a cópia antes desse prazo.

Retomar consulta a reunião antes de enviar blocos. `processing` e `submitting` apenas consultam o estado; `completed` permite limpar o backup. Um 404 preserva o áudio e interrompe tentativas. Um 404 não distingue reunião ausente de reunião fora do escopo autorizado. Erros HTTP definitivos não são repetidos; rede, 408, 429 e 5xx têm até três tentativas por bloco. Após falha, a captura continua salvando localmente, sem criar uma nova sequência de tentativas a cada bloco.

Cópias antigas parcialmente apagadas por versões anteriores não recuperam os blocos ausentes. Confirmações locais não provam persistência dos arquivos do servidor após uma perda de armazenamento.

## Eventos

O backend usa o logger existente, com `project.operation.finished` e `project.operation.error`. Campos incluem `requestId`, escopo autenticado (`tenantId`, `userId`), `projectId`, `meetingId`, `chunkIndex`, `stage`, `statusCode`, `durationMs` e `outcome`. Rejeições de upload usam `reason=upload_not_found` ou `upload_not_active`. HTTP 202 significa aceitação, não transcrição concluída. Polling pode retornar HTTP 200 com transcrição falha: a falha do provedor tem evento de erro próprio.

Stacks, códigos e causas passam pelo serializador seguro existente. Falhas HTTP do provedor preservam `statusCode` e `MEETING_PROVIDER_HTTP_ERROR`. Logs não recebem áudio, transcrição ou corpo das requisições. Sucesso de bloco usa debug para conter volume; rejeições usam warn e falhas de operação usam error. Falha do logger não altera o resultado da operação.

O navegador usa `meeting.browser.operation` pelo logger existente, com timestamp, projeto/reunião, etapa, resultado, bloco/tentativa, tipo seguro do erro, status HTTP e até oito frames com arquivo/linha/coluna. Frames são marcados `generated-only`; URLs, caminhos e mensagens são omitidos. Source maps do mesmo build são necessários para localizar o TS/TSX original. Mensagens, objetos de erro completos, respostas e credenciais não são registrados. Esses identificadores são correlação do navegador, não autorização. O logger segue `VITE_ENABLE_LOGGER` e `VITE_LOGGER_FILTER`: em produção é necessário habilitá-lo no build para obter esses eventos no console. Não há envio novo de telemetria do navegador ao backend.

Para investigar: localizar reunião + janela de tempo; seguir criação, `chunk_upload`, `transcription_submit` e polling. Correlacionar por requestId dentro de cada requisição e meetingId entre etapas. Confirmar commit/runtime do deploy antes de atribuir stacks locais ao código de produção.

## Verificação local e limites

Testes focados cobrem retenção/quota com IndexedDB emulado, preservação após 404, retomada sem reenvio, limpeza após conclusão, mistura e liberação dos dispositivos, privacidade dos logs, isolamento entre tenants e logger indisponível. APIs de mídia são substituídas nos testes: eles não comprovam permissões ou áudio de uma chamada real.

Uma amostra sintética local em Opus gerou 54.482 bytes a 48 kbps versus 158.260 bytes a 128 kbps (66% menor). Whisper local reconheceu fala em ambas com erros diferentes; isso não demonstra equivalência de qualidade. Ainda é necessário validar uma chamada real no navegador escolhido, incluindo duas vozes, pausa, fim do compartilhamento, reconexão e qualidade da transcrição. Coleta/consulta dos logs de produção não foi verificada.
