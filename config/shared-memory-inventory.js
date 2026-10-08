const mongoose = require('mongoose');
const { createModels, runAsSystem } = require('@librechat/data-schemas');

async function main() {
  const tenantArg = process.argv.find((arg) => arg.startsWith('--tenant='));
  const tenantId = tenantArg?.slice('--tenant='.length);
  if (!tenantId || !process.env.MONGO_URI)
    throw new Error('Use --tenant=<tenantId> and set MONGO_URI.');
  await mongoose.connect(process.env.MONGO_URI, { autoIndex: false, autoCreate: false });
  createModels(mongoose);
  const { MemoryEntry, SharedMemory, Project, User } = mongoose.models;
  const result = await runAsSystem(async () => {
    const [personal, shared, projects, users] = await Promise.all([
      MemoryEntry.aggregate([
        { $match: { tenantId } },
        {
          $group: {
            _id: { key: '$key', userId: '$userId', agentId: '$agentId' },
            count: { $sum: 1 },
          },
        },
      ]),
      SharedMemory.find({ tenantId }).select('_id key status').lean(),
      Project.find({ tenantId })
        .select('projectId name user memories.key memoryKeys sharedMemoryIds')
        .lean(),
      User.find({ tenantId }).select('_id').lean(),
    ]);
    const userIds = new Set(users.map((user) => String(user._id)));
    const sharedById = new Map(shared.map((memory) => [String(memory._id), memory]));
    const personalByKey = new Map();
    const partitions = new Map();
    for (const entry of personal) {
      personalByKey.set(entry._id.key, (personalByKey.get(entry._id.key) || 0) + entry.count);
      const agentId = entry._id.agentId || null;
      partitions.set(agentId, (partitions.get(agentId) || 0) + entry.count);
    }
    return {
      tenantId,
      dryRun: true,
      counts: {
        personal: personal.reduce((sum, entry) => sum + entry.count, 0),
        orphanedPersonal: personal.reduce(
          (sum, entry) => sum + (userIds.has(String(entry._id.userId)) ? 0 : entry.count),
          0,
        ),
        duplicatePersonalIdentities: personal.filter((entry) => entry.count > 1).length,
        projectsWithoutOwner: projects.filter((project) => !userIds.has(String(project.user)))
          .length,
        shared: shared.length,
        projects: projects.length,
        localProjectMemories: projects.reduce(
          (sum, project) => sum + (project.memories?.length || 0),
          0,
        ),
        legacyReferences: projects.reduce(
          (sum, project) => sum + (project.memoryKeys?.length || 0),
          0,
        ),
      },
      partitions: [...partitions].map(([agentId, count]) => ({ agentId, count })),
      projects: projects.map((project) => ({
        projectId: project.projectId,
        name: project.name,
        ownerId: project.user,
        ownerExists: userIds.has(String(project.user)),
        sharedLinks: project.sharedMemoryIds?.length || 0,
        missingSharedLinks: (project.sharedMemoryIds || []).filter(
          (id) => !sharedById.has(String(id)),
        ).length,
        archivedSharedLinks: (project.sharedMemoryIds || []).filter(
          (id) => sharedById.get(String(id))?.status === 'archived',
        ).length,
        legacy: (project.memoryKeys || []).map((key) => ({
          key,
          candidates: personalByKey.get(key) || 0,
          status: { 0: 'missing', 1: 'resolvable' }[personalByKey.get(key) || 0] || 'ambiguous',
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
