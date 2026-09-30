// Preview: mongosh Orqest config/migrate-sol-61.mongosh.js
// Apply: APPLY_SOL_61=true mongosh Orqest config/migrate-sol-61.mongosh.js
/* global db, printjson */
const apply = process.env.APPLY_SOL_61 === 'true';
const oldModels = ['openai/gpt-6-sol', 'gpt-6-sol', 'openai/gpt-5.6-sol', 'gpt-5.6-sol'];
const oldSpecs = ['gpt-6-sol', 'gpt-56-sol', 'gpt-56-terra'];
const operations = [
  ['agents', 'provider', 'model', oldModels, 'openai/gpt-6.1-sol'],
  ['agents', 'provider', 'model_parameters.model', oldModels, 'openai/gpt-6.1-sol'],
  ['conversations', 'endpoint', 'model', oldModels, 'openai/gpt-6.1-sol'],
  ['conversations', 'endpoint', 'spec', oldSpecs, 'gpt-6.1-sol'],
  ['presets', 'endpoint', 'model', oldModels, 'openai/gpt-6.1-sol'],
  ['presets', 'endpoint', 'spec', oldSpecs, 'gpt-6.1-sol'],
];

for (const [collection, providerField, field, previous, next] of operations) {
  const filter = { [providerField]: 'OpenRouter', [field]: { $in: previous } };
  const target = db.getCollection(collection);
  const matches = await target
    .aggregate([
      { $match: filter },
      { $group: { _id: { tenantId: '$tenantId', model: `$${field}` }, count: { $sum: 1 } } },
    ])
    .toArray();
  printjson({ apply, collection, field, matches });
  if (apply) {
    printjson(await target.updateMany(filter, { $set: { [field]: next, updatedAt: new Date() } }));
  }
}
