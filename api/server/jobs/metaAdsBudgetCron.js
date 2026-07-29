const path = require('path');
require('module-alias')({ base: path.resolve(__dirname, '../..') });

const mongoose = require('mongoose');
const { logger } = require('@librechat/data-schemas');
const { connectDb } = require('~/db');
const { seedDatabase } = require('~/models');
const { runCron } = require('~/server/services/MetaAds/budget');

async function main() {
  await connectDb();
  await seedDatabase();
  const results = await runCron();
  logger.info('[MetaAdsBudgetCron] Finished', {
    projects: results.length,
    failed: results.filter((result) => result.ok === false).length,
  });
  await mongoose.connection.close();
}

main().catch(async (error) => {
  logger.error('[MetaAdsBudgetCron] Failed', error);
  await mongoose.connection.close().catch(() => undefined);
  process.exit(1);
});
