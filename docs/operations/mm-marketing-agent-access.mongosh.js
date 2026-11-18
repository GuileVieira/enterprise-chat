// Run in mongosh connected to Orqest. Review the dry run before setting APPLY=true.
// AGENT EDIT permits editing the original agent, not only exporting it.
(() => {
  const tenantId = 'mm-marketing';
  const apply = typeof process !== 'undefined' && process.env.APPLY === 'true';
  const now = new Date();
  const active = { $or: [{ expiredAt: null }, { expiredAt: { $gt: now } }] };
  const principal = { principalType: 'tenant', principalId: tenantId, tenantId };
  const grants = db.aclentries
    .find({
      ...principal,
      ...active,
      resourceType: 'agent',
      permBits: { $bitsAllSet: 1 },
    })
    .toArray();
  const roles = (id, type) =>
    db.accessroles.findOne({
      accessRoleId: id,
      resourceType: type,
      tenantId,
    }) ||
    db.accessroles.findOne({
      accessRoleId: id,
      resourceType: type,
      tenantId: null,
    });
  const editor = roles('agent_editor', 'agent');
  const remoteViewer = roles('remoteAgent_viewer', 'remoteAgent');
  if (!editor || (editor.permBits & 3) !== 3 || !remoteViewer || remoteViewer.permBits !== 1) {
    throw new Error(
      'Expected agent_editor and remoteAgent_viewer roles were not found; no writes.',
    );
  }
  const agents = grants.map((grant) => {
    const id = String(grant.resourceId);
    const ids = /^[a-f\d]{24}$/i.test(id) ? [grant.resourceId, ObjectId(id)] : [grant.resourceId];
    const agent = db.agents.findOne({ _id: { $in: ids } }, { id: 1, name: 1, tenantId: 1 });
    if (!agent) throw new Error(`Agent missing for ACL ${grant._id}; no writes.`);
    return { grant, agent };
  });
  printjson({
    mode: apply ? 'APPLY' : 'DRY_RUN',
    tenantId,
    agents: agents.map(({ agent }) => ({
      id: agent.id,
      name: agent.name,
      sourceTenant: agent.tenantId,
    })),
    grants: ['AGENT VIEW+EDIT for tenant', 'REMOTE_AGENT VIEW for tenant'],
  });
  if (!apply) return;
  for (const { grant, agent } of agents) {
    const currentTime = new Date();
    const activeNow = { $or: [{ expiredAt: null }, { expiredAt: { $gt: currentTime } }] };
    const source = db.aclentries.findOneAndUpdate(
      {
        _id: grant._id,
        ...principal,
        ...activeNow,
        resourceType: 'agent',
        permBits: grant.permBits,
      },
      {
        $bit: { permBits: { or: 3 } },
        $set: {
          ...((grant.permBits & ~3) === 0 ? { roleId: editor._id } : {}),
          updatedAt: currentTime,
        },
      },
      { returnDocument: 'after' },
    );
    if (!source) {
      print(`Skipped changed or expired sharing: ${agent.id}`);
      continue;
    }
    const remote = db.aclentries.findOne({
      ...principal,
      ...activeNow,
      resourceType: 'remoteAgent',
      permBits: { $bitsAllSet: 1 },
      resourceId: { $in: [agent._id, String(agent._id)] },
    });
    if (!remote) {
      db.aclentries.insertOne({
        ...principal,
        resourceType: 'remoteAgent',
        resourceId: agent._id,
        permBits: 1,
        roleId: remoteViewer._id,
        grantedAt: currentTime,
        createdAt: currentTime,
        updatedAt: currentTime,
        ...(source.expiredAt ? { expiredAt: source.expiredAt } : {}),
      });
    }
    print(`Applied: ${agent.id}`);
  }
  print(
    'Applied ACLs only. REMOTE_AGENTS USE, key agentIds restrictions and apiKey config still apply; roles were not changed.',
  );
})();
