# Coolify production deploy

Use this for `https://orquest.redbytesolutions.com.br`.

## Resource

- Coolify resource type: Docker Compose.
- Compose file: `docker-compose.prod.yml`.
- Build pack for `api`: Nixpacks.
- App domain target: service `api`, port `3080`.

## Environment

Use `.env.prod.example` as the production template. Paste the values into Coolify environment variables or create a server-side `.env` from it.

Replace all `CHANGE_ME` values before deploy:

```bash
openssl rand -hex 32 # JWT_SECRET
openssl rand -hex 32 # JWT_REFRESH_SECRET
openssl rand -hex 32 # CREDS_KEY
openssl rand -hex 16 # CREDS_IV
openssl rand -hex 32 # MEILI_MASTER_KEY
```

Production service URLs must stay internal:

- `MONGO_URI=mongodb://mongodb:27017/LibreChat`
- `MEILI_HOST=http://meilisearch:7700`
- `RAG_API_URL=http://rag_api:8000`

Do not copy local-only values such as `localhost`, local Meili URLs, or local API keys into production.

## Validate

```bash
docker compose --env-file .env.prod.example -f docker-compose.prod.yml config
```

Optional local smoke test:

```bash
docker compose --env-file .env.prod.example -f docker-compose.prod.yml up --build
curl http://localhost:3080/api/config
```
