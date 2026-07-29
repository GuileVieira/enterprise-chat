# Coolify Schedules

Schedules required for Orqest production jobs in Coolify.

## Meta Ads budget automation

- **Name:** `meta-ads-budget-cron`
- **Type:** Scheduled Task
- **Service:** API application container
- **Schedule:** `*/30 * * * *`
- **Command:**

```bash
npm run meta-ads:budget-cron
```

Notes:

- If Coolify requires an explicit working directory command, use
  `cd /app && npm run meta-ads:budget-cron` without wrapping it in a dangling
  single quote.
- The task can run every 30 minutes because each project has its own
  `metaAds.scheduleIntervalMinutes`; projects that are not due are skipped.
- Required app env must match the API service, especially:
  - `CONFIG_PATH=/app/config/librechat.prod.yaml`
  - `MONGO_URI=mongodb://mongodb:27017/Orqest`
  - `CONSOLE_JSON=true`
  - `META_ADS_GRAPH_TIMEOUT_MS=30000` (optional; per Meta Graph request)
  - `META_ADS_CRON_PROJECT_TIMEOUT_MS=45000` (optional; per project)
  - `META_ADS_CRON_PROJECT_CONCURRENCY=2` (optional; parallel projects)
  - `META_ADS_CRON_ENTITY_CONCURRENCY=5` (optional; parallel ad set analysis per project)
- Enable the feature in config with `interface.metaAds: true`.
