# Coolify Schedules

Schedules required for Orqest production jobs in Coolify.

## Meta Ads budget automation

- **Name:** `meta-ads-budget-cron`
- **Type:** Scheduled Task
- **Service:** API application container
- **Schedule:** `*/30 * * * *`
- **Command:**

```bash
/bin/sh -lc 'cd /app && node api/server/jobs/metaAdsBudgetCron.js'
```

Notes:

- The task can run every 30 minutes because each project has its own
  `metaAds.scheduleIntervalMinutes`; projects that are not due are skipped.
- Required app env must match the API service, especially:
  - `CONFIG_PATH=/app/config/librechat.prod.yaml`
  - `MONGO_URI=mongodb://mongodb:27017/Orqest`
  - `CONSOLE_JSON=true`
- Enable the feature in config with `interface.metaAds: true`.

