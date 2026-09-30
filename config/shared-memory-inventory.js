const mongoose = require('mongoose');
const { createModels, runAsSystem } = require('@librechat/data-schemas');

async function main() {
  const tenantArg = process.argv.find((arg) => arg.startsWith('--tenant='));
  const tenantId = tenantArg?.slice('--tenant='.length);
  if (!tenantId || !process.env.MONGO_URI) throw new Error('Use --tenant=<tenantId> and set MONGO_URI.');
  await mongoose.connect(process.env.MONGO_URI);
  createModels(mongoose);
  const { MemoryEntry, SharedMemory, Project } = mongoose.models;
  const result = await runAsSystem(async () => {
    const [personal, shared, projects] = await Promise.all([
      MemoryEntry.aggregate([{ $match: { tenantId } }, { $group: { _id: '$key', count: { $sum: 1 }, users: { $addToSet: '$userId' } } }]),
      SharedMemory.find({ tenantId }).select('_id key status').lean(),
      Project.find({ tenantId }).select('projectId name user memories memoryKeys sharedMemoryIds').lean(),
    ]);
    const personalByKey = new Map(personal.map((entry) => [entry._id, entry]));
    return {
      tenantId,
      dryRun: true,
      counts: {
        personal: personal.reduce((sum, entry) => sum + entry.count, 0),
        shared: shared.length,
        projects: projects.length,
        localProjectMemories: projects.reduce((sum, project) => sum + (project.memories?.length || 0), 0),
        legacyReferences: projects.reduce((sum, project) => sum + (project.memoryKeys?.length || 0), 0),
      },
      projects: projects.map((project) => ({
        projectId: project.projectId,
        name: project.name,
        ownerId: project.user,
        sharedLinks: project.sharedMemoryIds?.length || 0,
        legacy: (project.memoryKeys || []).map((key) => ({
          key,
          candidates: personalByKey.get(key)?.count || 0,
          status: personalByKey.get(key)?.count === 1 ? 'resolvable' : personalByKey.has(key) ? 'ambiguous' : 'missing',
        })),
      })),
    };
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  await mongoose.disconnect();
}

main().catch(async (error) => {
  process.stderr.write(`${error.message}\n`);
  await mongoose.disconnect();
  process.exitCode = 1;
});
