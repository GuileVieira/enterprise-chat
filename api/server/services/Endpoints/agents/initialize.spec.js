const mongoose = require('mongoose');
const {
  ResourceType,
  PermissionBits,
  PrincipalType,
  PrincipalModel,
} = require('librechat-data-provider');
const { MongoMemoryServer } = require('mongodb-memory-server');

const mockInitializeAgent = jest.fn();
const mockValidateAgentModel = jest.fn();

jest.mock('@librechat/agents', () => ({
  ...jest.requireActual('@librechat/agents'),
  createContentAggregator: jest.fn(() => ({
    contentParts: [],
    aggregateContent: jest.fn(),
  })),
}));

jest.mock('@librechat/api', () => ({
  ...jest.requireActual('@librechat/api'),
  initializeAgent: (...args) => mockInitializeAgent(...args),
  validateAgentModel: (...args) => mockValidateAgentModel(...args),
  GenerationJobManager: { setCollectedUsage: jest.fn() },
  getCustomEndpointConfig: jest.fn(),
  createSequentialChainEdges: jest.fn(),
}));

jest.mock('~/server/controllers/agents/callbacks', () => ({
  createToolEndCallback: jest.fn(() => jest.fn()),
  getDefaultHandlers: jest.fn(() => ({})),
}));

jest.mock('~/server/services/ToolService', () => ({
  loadAgentTools: jest.fn(),
  loadToolsForExecution: jest.fn(),
}));

jest.mock('~/server/controllers/ModelController', () => ({
  getModelsConfig: jest.fn().mockResolvedValue({}),
}));

let agentClientArgs;
jest.mock('~/server/controllers/agents/client', () => {
  return jest.fn().mockImplementation((args) => {
    agentClientArgs = args;
    return {};
  });
});

jest.mock('./addedConvo', () => ({
  processAddedConvo: jest.fn().mockResolvedValue({ userMCPAuthMap: undefined }),
}));

jest.mock('~/cache', () => ({
  logViolation: jest.fn(),
}));

const { initializeClient } = require('./initialize');
const { User, AclEntry } = require('~/db/models');
const { createAgent } = require('~/models');

const mockGetConvo = jest.fn();
const mockGetProjectById = jest.fn();
const mockGetAllUserMemories = jest.fn();

jest.mock('~/models', () => ({
  ...jest.requireActual('~/models'),
  getConvo: (...args) => mockGetConvo(...args),
  getProjectById: (...args) => mockGetProjectById(...args),
  getAllUserMemories: (...args) => mockGetAllUserMemories(...args),
}));

const PRIMARY_ID = 'agent_primary';
const TARGET_ID = 'agent_target';
const AUTHORIZED_ID = 'agent_authorized';

describe('initializeClient — processAgent ACL gate', () => {
  let mongoServer;
  let testUser;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    await mongoose.connection.dropDatabase();
    jest.clearAllMocks();
    agentClientArgs = undefined;

    testUser = await User.create({
      email: 'test@example.com',
      name: 'Test User',
      username: 'testuser',
      role: 'USER',
    });

    mockValidateAgentModel.mockResolvedValue({ isValid: true });
  });

  const makeReq = () => ({
    user: { id: testUser._id.toString(), role: 'USER' },
    body: { conversationId: 'conv_1', files: [] },
    config: { endpoints: {} },
    _resumableStreamId: null,
  });

  const makeEndpointOption = () => ({
    agent: Promise.resolve({
      id: PRIMARY_ID,
      name: 'Primary',
      provider: 'openai',
      model: 'gpt-4',
      tools: [],
    }),
    model_parameters: { model: 'gpt-4' },
    endpoint: 'agents',
  });

  const makePrimaryConfig = (edges) => ({
    id: PRIMARY_ID,
    endpoint: 'agents',
    edges,
    toolDefinitions: [],
    toolRegistry: new Map(),
    userMCPAuthMap: null,
    tool_resources: {},
    resendFiles: true,
    maxContextTokens: 4096,
  });

  it('should skip handoff agent and filter its edge when user lacks VIEW access', async () => {
    await createAgent({
      id: TARGET_ID,
      name: 'Target Agent',
      provider: 'openai',
      model: 'gpt-4',
      author: new mongoose.Types.ObjectId(),
      tools: [],
    });

    const edges = [{ from: PRIMARY_ID, to: TARGET_ID, edgeType: 'handoff' }];
    mockInitializeAgent.mockResolvedValue(makePrimaryConfig(edges));

    await initializeClient({
      req: makeReq(),
      res: {},
      signal: new AbortController().signal,
      endpointOption: makeEndpointOption(),
    });

    expect(mockInitializeAgent).toHaveBeenCalledTimes(1);
    expect(agentClientArgs.agent.edges).toEqual([]);
  });

  it('should initialize handoff agent and keep its edge when user has VIEW access', async () => {
    const authorizedAgent = await createAgent({
      id: AUTHORIZED_ID,
      name: 'Authorized Agent',
      provider: 'openai',
      model: 'gpt-4',
      author: new mongoose.Types.ObjectId(),
      tools: [],
    });

    await AclEntry.create({
      principalType: PrincipalType.USER,
      principalId: testUser._id,
      principalModel: PrincipalModel.USER,
      resourceType: ResourceType.AGENT,
      resourceId: authorizedAgent._id,
      permBits: PermissionBits.VIEW,
      grantedBy: testUser._id,
    });

    const edges = [{ from: PRIMARY_ID, to: AUTHORIZED_ID, edgeType: 'handoff' }];
    const handoffConfig = {
      id: AUTHORIZED_ID,
      edges: [],
      toolDefinitions: [],
      toolRegistry: new Map(),
      userMCPAuthMap: null,
      tool_resources: {},
    };

    let callCount = 0;
    mockInitializeAgent.mockImplementation(() => {
      callCount++;
      return callCount === 1
        ? Promise.resolve(makePrimaryConfig(edges))
        : Promise.resolve(handoffConfig);
    });

    await initializeClient({
      req: makeReq(),
      res: {},
      signal: new AbortController().signal,
      endpointOption: makeEndpointOption(),
    });

    expect(mockInitializeAgent).toHaveBeenCalledTimes(2);
    expect(agentClientArgs.agent.edges).toHaveLength(1);
    expect(agentClientArgs.agent.edges[0].to).toBe(AUTHORIZED_ID);
  });

  it('should prepend project instructions to primaryAgent.instructions when conversation has projectId', async () => {
    mockGetConvo.mockResolvedValue({ projectId: 'proj-123' });
    mockGetProjectById.mockResolvedValue({ instructions: 'Project context: be concise.' });

    const endpointOption = makeEndpointOption();
    const primaryAgent = await endpointOption.agent;
    primaryAgent.instructions = 'Agent instructions.';

    mockInitializeAgent.mockResolvedValue(makePrimaryConfig([]));

    await initializeClient({
      req: makeReq(),
      res: {},
      signal: new AbortController().signal,
      endpointOption,
    });

    expect(mockGetConvo).toHaveBeenCalledWith(testUser._id.toString(), 'conv_1');
    expect(mockGetProjectById).toHaveBeenCalledWith('proj-123');
    expect(agentClientArgs.projectId).toBe('proj-123');

    const agentPassedToInitializeAgent = mockInitializeAgent.mock.calls[0][0].agent;
    expect(agentPassedToInitializeAgent.instructions).toBe(
      'Project context: be concise.\n\nAgent instructions.',
    );
  });

  it('should not modify instructions when conversation has no projectId', async () => {
    mockGetConvo.mockResolvedValue({});

    const endpointOption = makeEndpointOption();
    const primaryAgent = await endpointOption.agent;
    primaryAgent.instructions = 'Agent instructions.';

    mockInitializeAgent.mockResolvedValue(makePrimaryConfig([]));

    await initializeClient({
      req: makeReq(),
      res: {},
      signal: new AbortController().signal,
      endpointOption,
    });

    expect(mockGetProjectById).not.toHaveBeenCalled();

    const agentPassedToInitializeAgent = mockInitializeAgent.mock.calls[0][0].agent;
    expect(agentPassedToInitializeAgent.instructions).toBe('Agent instructions.');
  });

  it('should not modify instructions when project has no instructions', async () => {
    mockGetConvo.mockResolvedValue({ projectId: 'proj-123' });
    mockGetProjectById.mockResolvedValue({ instructions: '' });

    const endpointOption = makeEndpointOption();
    const primaryAgent = await endpointOption.agent;
    primaryAgent.instructions = 'Agent instructions.';

    mockInitializeAgent.mockResolvedValue(makePrimaryConfig([]));

    await initializeClient({
      req: makeReq(),
      res: {},
      signal: new AbortController().signal,
      endpointOption,
    });

    const agentPassedToInitializeAgent = mockInitializeAgent.mock.calls[0][0].agent;
    expect(agentPassedToInitializeAgent.instructions).toBe('Agent instructions.');
  });

  it('should not load project context from request projectId without project VIEW access', async () => {
    const privateProjectId = new mongoose.Types.ObjectId();
    mockGetProjectById.mockResolvedValue({
      _id: privateProjectId,
      instructions: 'Private project context.',
    });

    const endpointOption = makeEndpointOption();
    const primaryAgent = await endpointOption.agent;
    primaryAgent.instructions = 'Agent instructions.';

    const req = makeReq();
    req.body = { conversationId: 'new', projectId: 'private-project', files: [] };

    mockInitializeAgent.mockResolvedValue(makePrimaryConfig([]));

    await initializeClient({
      req,
      res: {},
      signal: new AbortController().signal,
      endpointOption,
    });

    expect(mockGetConvo).not.toHaveBeenCalled();
    expect(mockGetProjectById).toHaveBeenCalledWith('private-project');
    expect(agentClientArgs.projectId).toBeUndefined();

    const agentPassedToInitializeAgent = mockInitializeAgent.mock.calls[0][0].agent;
    expect(agentPassedToInitializeAgent.instructions).toBe('Agent instructions.');
  });

  it('should handle getConvo error gracefully without breaking', async () => {
    mockGetConvo.mockRejectedValue(new Error('DB error'));

    const endpointOption = makeEndpointOption();
    const primaryAgent = await endpointOption.agent;
    primaryAgent.instructions = 'Agent instructions.';

    mockInitializeAgent.mockResolvedValue(makePrimaryConfig([]));

    await initializeClient({
      req: makeReq(),
      res: {},
      signal: new AbortController().signal,
      endpointOption,
    });

    const agentPassedToInitializeAgent = mockInitializeAgent.mock.calls[0][0].agent;
    expect(agentPassedToInitializeAgent.instructions).toBe('Agent instructions.');
  });

  it('should prepend project memories to primaryAgent.instructions', async () => {
    mockGetConvo.mockResolvedValue({ projectId: 'proj-123' });
    mockGetProjectById.mockResolvedValue({
      instructions: '',
      memories: [{ key: 'tone', value: 'friendly' }],
    });
    mockGetAllUserMemories.mockResolvedValue([]);

    const endpointOption = makeEndpointOption();
    const primaryAgent = await endpointOption.agent;
    primaryAgent.instructions = 'Agent instructions.';

    mockInitializeAgent.mockResolvedValue(makePrimaryConfig([]));

    await initializeClient({
      req: makeReq(),
      res: {},
      signal: new AbortController().signal,
      endpointOption,
    });

    const agentPassedToInitializeAgent = mockInitializeAgent.mock.calls[0][0].agent;
    expect(agentPassedToInitializeAgent.instructions).toBe(
      '## Project Memories\n\n- tone: friendly\n\nAgent instructions.',
    );
  });

  it('should merge project instructions and memories in correct order', async () => {
    mockGetConvo.mockResolvedValue({ projectId: 'proj-123' });
    mockGetProjectById.mockResolvedValue({
      instructions: 'Project context.',
      memories: [{ key: 'lang', value: 'pt' }],
    });
    mockGetAllUserMemories.mockResolvedValue([]);

    const endpointOption = makeEndpointOption();
    const primaryAgent = await endpointOption.agent;
    primaryAgent.instructions = 'Agent instructions.';

    mockInitializeAgent.mockResolvedValue(makePrimaryConfig([]));

    await initializeClient({
      req: makeReq(),
      res: {},
      signal: new AbortController().signal,
      endpointOption,
    });

    const agentPassedToInitializeAgent = mockInitializeAgent.mock.calls[0][0].agent;
    expect(agentPassedToInitializeAgent.instructions).toBe(
      'Project context.\n\n## Project Memories\n\n- lang: pt\n\nAgent instructions.',
    );
  });

  it('should include user memories referenced by memoryKeys', async () => {
    mockGetConvo.mockResolvedValue({ projectId: 'proj-123' });
    mockGetProjectById.mockResolvedValue({
      instructions: '',
      memories: [],
      memoryKeys: ['pref_1', 'pref_2'],
    });
    mockGetAllUserMemories.mockResolvedValue([
      { key: 'pref_1', value: 'Value A' },
      { key: 'pref_2', value: 'Value B' },
      { key: 'other', value: 'Other' },
    ]);

    const endpointOption = makeEndpointOption();
    const primaryAgent = await endpointOption.agent;
    primaryAgent.instructions = 'Agent instructions.';

    mockInitializeAgent.mockResolvedValue(makePrimaryConfig([]));

    await initializeClient({
      req: makeReq(),
      res: {},
      signal: new AbortController().signal,
      endpointOption,
    });

    const agentPassedToInitializeAgent = mockInitializeAgent.mock.calls[0][0].agent;
    expect(agentPassedToInitializeAgent.instructions).toBe(
      '## Project Memories\n\n- pref_1: Value A\n- pref_2: Value B\n\nAgent instructions.',
    );
  });
});
