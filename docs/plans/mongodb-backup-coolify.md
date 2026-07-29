# Disaster recovery completo do Orqest

## Objetivo

Se o servidor do Coolify for perdido, provisionar outro servidor, restaurar a cópia
armazenada no RustFS e subir o Orqest com:

- conversas, usuários, projetos e configurações do MongoDB;
- uploads e imagens;
- busca do Meilisearch;
- embeddings RAG do pgvector;
- configuração e segredos necessários para descriptografar credenciais;
- mesma versão do código e das imagens.

O RustFS deve estar em outro servidor ou provedor. RustFS no mesmo host do Coolify não
é disaster recovery.

## Estratégia

Usar snapshot frio dos volumes: parar a stack, copiar todos os volumes com Restic para
o RustFS e iniciar a stack novamente.

Essa é a forma mais simples de obter cópia coerente entre MongoDB, arquivos,
Meilisearch e pgvector. Copiar volumes enquanto bancos estão escrevendo não garante
restauração consistente.

```text
03:00  ativar manutenção
03:01  parar serviços
03:02  Restic copia volumes para RustFS
03:xx  iniciar serviços
03:xx  smoke test
03:xx  remover manutenção
```

## O que precisa ser salvo

### Volumes Docker

Todos os volumes persistentes declarados em `docker-compose.prod.yml`:

| Volume                    | Conteúdo                                                 | Obrigatório |
| ------------------------- | -------------------------------------------------------- | ----------- |
| `orqest_mongodb_prod`     | usuários, conversas, mensagens, projetos e índices Mongo | sim         |
| `orqest_uploads_prod`     | documentos enviados                                      | sim         |
| `orqest_images_prod`      | imagens e avatares                                       | sim         |
| `orqest_pgvector_prod`    | PostgreSQL, embeddings e índices RAG                     | sim         |
| `orqest_meilisearch_prod` | busca textual pronta para uso                            | sim         |
| `orqest_logs_prod`        | logs operacionais                                        | recomendado |

Embora Meilisearch possa ser reconstruído do Mongo, salvar seu volume permite subir a
cópia exata mais rápido. O comando `npm run reset-meili-sync` fica como plano de
correção se o índice restaurado estiver inválido.

### Configuração

Volume sem configuração não sobe produção. Manter no backup:

- `docker-compose.prod.yml`;
- `.env` de produção;
- `config/librechat.prod.yaml`;
- commit Git implantado;
- tags/digests das imagens Docker;
- domínio e configuração relevante do proxy;
- `JWT_SECRET`, `JWT_REFRESH_SECRET`, `CREDS_KEY` e `CREDS_IV`;
- `MEILI_MASTER_KEY`;
- `POSTGRES_DB`, `POSTGRES_USER` e `POSTGRES_PASSWORD`;
- credenciais externas necessárias à aplicação.

`CREDS_KEY` e `CREDS_IV` são críticos: sem os mesmos valores, segredos já armazenados
pelo Orqest podem não ser descriptografados.

Gerar um pacote de configuração criptografado e guardá-lo no RustFS e no cofre de
senhas. Não deixar `.env` aberto no bucket.

## RustFS

Criar bucket privado:

```text
orqest-disaster-recovery
```

Ativar, quando disponível:

- versionamento;
- Object Lock/imutabilidade;
- retenção contra exclusão acidental;
- credencial exclusiva limitada ao bucket;
- alerta de falha, capacidade e expiração.

Variáveis do Restic:

```dotenv
RESTIC_REPOSITORY=s3:https://RUSTFS_ENDPOINT/orqest-disaster-recovery
RESTIC_PASSWORD=SENHA_FORTE_GUARDADA_FORA_DO_SERVIDOR
AWS_ACCESS_KEY_ID=CHAVE_LIMITADA
AWS_SECRET_ACCESS_KEY=SEGREDO_LIMITADO
AWS_DEFAULT_REGION=REGIAO
```

Restic criptografa o conteúdo antes de enviá-lo ao RustFS. Guardar
`RESTIC_PASSWORD` em pelo menos dois locais seguros; sem ela, o backup é inútil.

## Execução diária

O agendamento precisa rodar no host ou numa automação com permissão controlada para
parar/iniciar a stack e montar os volumes. Não expor MongoDB, PostgreSQL ou Docker
Socket à internet.

### 1. Pré-validação

Abortar antes da parada quando:

- RustFS estiver indisponível;
- credenciais Restic/RustFS estiverem ausentes;
- espaço ou quota estiver insuficiente;
- já existir outro backup em execução.

### 2. Parar escrita

1. ativar página de manutenção;
2. aguardar requisições em andamento;
3. parar `api` e jobs;
4. parar `rag_api`;
5. parar `mongodb`, `vectordb` e `meilisearch`;
6. confirmar que nenhum container está usando os volumes.

Não usar `docker compose down -v`: `-v` apaga os volumes.

### 3. Copiar volumes

Montar todos como somente leitura num container Restic:

```yaml
volumes:
  - orqest_mongodb:/source/mongodb:ro
  - orqest_uploads:/source/uploads:ro
  - orqest_images:/source/images:ro
  - orqest_pgvector:/source/pgvector:ro
  - orqest_meilisearch:/source/meilisearch:ro
  - orqest_logs:/source/logs:ro
```

Executar um único snapshot:

```bash
restic backup \
  /source/mongodb \
  /source/uploads \
  /source/images \
  /source/pgvector \
  /source/meilisearch \
  /source/logs \
  --tag orqest \
  --tag full-cold
```

Um snapshot único mantém todos os componentes sob o mesmo identificador e horário.
Falha em qualquer caminho torna a execução inválida.

Salvar também o pacote criptografado de configuração e um manifesto:

```text
timestamp
snapshot Restic
commit Git
digests das imagens
versões Mongo/PostgreSQL/Meilisearch
lista e tamanho dos volumes
resultado das verificações
```

### 4. Reiniciar

1. iniciar `mongodb`, `vectordb` e `meilisearch`;
2. aguardar health checks;
3. iniciar `rag_api`;
4. iniciar `api` e jobs;
5. testar login, conversa, download de arquivo, busca e RAG;
6. remover manutenção.

O script deve tentar reiniciar a stack mesmo quando o upload do backup falhar.

### 5. Validar

Executar:

```bash
restic snapshots --tag full-cold
restic check --read-data-subset=5%
```

Alertar se o último snapshot válido tiver mais de 26 horas.

## Frequência e retenção

Plano inicial:

```text
snapshot frio completo: diário às 03:00
retenção: 7 diários, 4 semanais, 12 mensais
teste de restore: mensal
```

```bash
restic forget \
  --tag full-cold \
  --keep-daily 7 \
  --keep-weekly 4 \
  --keep-monthly 12
```

Executar `restic prune` semanalmente.

Backup diário significa RPO de até 24 horas: se o servidor morrer às 02:59, alterações
desde 03:00 do dia anterior podem ser perdidas. Para reduzir perda:

- executar snapshot frio a cada 6 horas; ou
- adicionar backups lógicos/incrementais entre snapshots; ou
- implementar replica set/WAL/PITR.

Redundância não substitui backup: exclusão acidental e corrupção são replicadas.

## Restore em servidor novo

### 1. Preparar

1. instalar Docker e Coolify;
2. recuperar `RESTIC_PASSWORD` e credenciais RustFS do cofre;
3. recuperar pacote de configuração;
4. usar o mesmo `docker-compose.prod.yml`, commit e imagens;
5. criar volumes vazios com os mesmos nomes.

### 2. Restaurar volumes

Manter toda a stack parada. Restaurar o snapshot selecionado:

```bash
restic restore SNAPSHOT_ID --target /restore
```

Copiar cada diretório restaurado ao volume correspondente, preservando permissões e
proprietários. Não misturar dados restaurados com volume parcialmente inicializado.

### 3. Subir em ordem

1. `mongodb`;
2. `vectordb`;
3. `meilisearch`;
4. `rag_api`;
5. `api`;
6. jobs.

### 4. Validar antes do tráfego

- Mongo iniciou sem recovery error;
- usuários conseguem autenticar;
- contagens de conversas, mensagens, projetos e arquivos são plausíveis;
- arquivos e imagens de amostra abrem;
- busca textual retorna conversa conhecida;
- RAG encontra conteúdo de documento conhecido;
- segredos armazenados continuam descriptografáveis;
- jobs não executaram duplicados durante o restore.

Só depois apontar DNS/proxy ao novo servidor.

## Correção dos índices

### Meilisearch

Se não iniciar ou a busca estiver incorreta:

1. parar API;
2. recriar somente `orqest_meilisearch_prod`;
3. iniciar Meilisearch vazio;
4. executar `npm run reset-meili-sync` no container da API;
5. reiniciar API;
6. aguardar documentos `_meiliIndex: false` chegarem a zero;
7. testar busca.

### MongoDB

Os índices estão no volume. Validar:

```bash
mongosh "mongodb://mongodb:27017/Orqest" \
  --quiet \
  --eval 'db.getCollectionNames().forEach(name => print(name, db.getCollection(name).getIndexes().length))'
```

Não recriar índices cegamente em produção. Comparar com schemas e logs de inicialização.

### pgvector

O volume contém dados e índices. Se PostgreSQL iniciar, mas índice estiver inválido,
identificar o índice afetado e executar `REINDEX` nele. Não apagar o volume: embeddings
são dados, não apenas cache.

## Teste obrigatório

Backup só é comprovado quando restaura.

Todo mês:

1. provisionar stack isolada;
2. restaurar snapshot do RustFS;
3. executar todas as validações;
4. registrar duração real, snapshot, responsável e erros;
5. destruir a stack de teste depois do aceite.

Meta inicial:

| Métrica         | Meta                     |
| --------------- | ------------------------ |
| RPO             | 24 horas                 |
| RTO             | 2 horas                  |
| Janela diária   | medir no primeiro backup |
| Restore testado | mensal                   |

## Critérios de aceite

- [ ] RustFS está fora do servidor do Coolify.
- [ ] Todos os seis volumes entram no mesmo snapshot.
- [ ] Configuração, commit, imagens e segredos estão recuperáveis.
- [ ] Backup diário é automático e monitorado.
- [ ] Stack sempre reinicia após sucesso ou falha do backup.
- [ ] Snapshot tem menos de 26 horas.
- [ ] Retenção e imutabilidade estão ativas.
- [ ] Restore completo passou em servidor isolado.
- [ ] Conversas, arquivos, busca e RAG foram verificados.
- [ ] Duas pessoas autorizadas conseguem acessar senhas e procedimento.
