const { MeiliSearch } = require('meilisearch');
const { logger } = require('@librechat/data-schemas');
const { batchResetMeiliFlags } = require('./utils');

/**
 * Idempotent setup script to ensure projectId is a filterable attribute
 * in the MeiliSearch convos index. Resets sync flags if settings change.
 *
 * Can be run manually via:
 *   node api/db/meiliProjectSetup.js
 */
async function setupProjectIdFilterable() {
  if (!process.env.MEILI_HOST || !process.env.MEILI_MASTER_KEY) {
    logger.error('[meiliProjectSetup] Meilisearch configuration is missing.');
    process.exit(1);
  }

  const client = new MeiliSearch({
    host: process.env.MEILI_HOST,
    apiKey: process.env.MEILI_MASTER_KEY,
  });

  try {
    const { status } = await client.health();
    if (status !== 'available') {
      throw new Error('Meilisearch not available');
    }

    const convosIndex = client.index('convos');
    const settings = await convosIndex.getSettings();
    const requiredFilters = ['user', 'projectId'];
    const missing = requiredFilters.filter(
      (attr) => !settings.filterableAttributes || !settings.filterableAttributes.includes(attr),
    );

    if (missing.length === 0) {
      logger.info('[meiliProjectSetup] convos index already has projectId as filterable.');
      return;
    }

    logger.info(
      `[meiliProjectSetup] Updating convos index filterableAttributes to [${requiredFilters.join(', ')}]...`,
    );
    await convosIndex.updateSettings({
      filterableAttributes: requiredFilters,
    });
    logger.info('[meiliProjectSetup] Settings updated. Re-sync will be triggered on next startup.');

    // Optionally reset flags immediately if mongoose models are available
    try {
      const mongoose = require('mongoose');
      const Conversation = mongoose.models.Conversation;
      if (Conversation && Conversation.collection) {
        await batchResetMeiliFlags(Conversation.collection);
        logger.info('[meiliProjectSetup] Sync flags reset for Conversation collection.');
      }
    } catch (resetError) {
      logger.warn(
        '[meiliProjectSetup] Could not reset sync flags (models may not be loaded):',
        resetError.message,
      );
    }
  } catch (error) {
    logger.error('[meiliProjectSetup] Error:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  setupProjectIdFilterable().then(() => process.exit(0));
}

module.exports = { setupProjectIdFilterable };
