const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { ResourceType, PrincipalType, PrincipalModel } = require('librechat-data-provider');
const { User, Role, Agent, AclEntry } = require('~/db/models');
const { v1 } = require('./v1');
const actions = require('./actions');
let server, user, agent;
let sequence = 0;
beforeAll(async () => {
  server = await MongoMemoryServer.create();
  await mongoose.connect(server.getUri());
});
afterAll(async () => {
  await mongoose.disconnect();
  await server?.stop();
});
beforeEach(async () => {
  const role = `agent-maintainer-${++sequence}`;
  await Role.create({ name: role, permissions: { AGENTS: { USE: true, CREATE: false } } });
  user = await User.create({ email: `${role}@test.dev`, role });
  agent = await Agent.create({
    id: `agent_${sequence}`,
    author: new mongoose.Types.ObjectId(),
    provider: 'openAI',
    model: 'test',
  });
});
// Actual feature and ACL guards; authentication/controller side effects are outside this check.
async function guards(router, method, path) {
  const route = router.stack.find(
    (layer) => layer.route?.path === path && layer.route.methods[method],
  ).route;
  const req = {
    user: { id: user.id, role: user.role },
    params: { id: agent.id, agent_id: agent.id },
    body: {},
    method: method.toUpperCase(),
    originalUrl: `/api/agents${path}`,
  };
  const res = {
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json() {
      return this;
    },
  };
  for (const layer of route.stack.slice(0, -1)) {
    let advanced = false;
    await layer.handle(req, res, () => {
      advanced = true;
    });
    if (!advanced) return res.statusCode;
  }
  return res.statusCode;
}
async function grant(permBits = 15) {
  await AclEntry.create({
    principalType: PrincipalType.USER,
    principalModel: PrincipalModel.USER,
    principalId: user._id,
    resourceType: ResourceType.AGENT,
    resourceId: agent._id,
    permBits,
    grantedBy: user._id,
  });
}
it.each([
  ['patch', '/:id'],
  ['delete', '/:id'],
  ['post', '/:id/revert'],
])('allows maintenance %s %s with ACL but no CREATE', async (method, path) => {
  expect(await guards(v1, method, path)).toBe(403);
  await grant();
  expect(await guards(v1, method, path)).toBe(200);
});
it.each([
  ['post', '/'],
  ['post', '/:id/duplicate'],
])('still rejects creation: %s %s', async (method, path) => {
  await grant();
  expect(await guards(v1, method, path)).toBe(403);
});
it.each([
  ['post', '/:agent_id'],
  ['delete', '/:agent_id/:action_id'],
])('allows action maintenance %s with EDIT', async (method, path) => {
  expect(await guards(actions, method, path)).toBe(403);
  await grant(3);
  expect(await guards(actions, method, path)).toBe(200);
});
