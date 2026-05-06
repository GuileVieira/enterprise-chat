const accessPermissions = require('./accessPermissions');
const assistants = require('./assistants');
const categories = require('./categories');
const adminAuth = require('./admin/auth');
const adminConfig = require('./admin/config');
const adminGrants = require('./admin/grants');
const adminGroups = require('./admin/groups');
const adminOverview = require('./admin/overview');
const adminRoles = require('./admin/roles');
const adminTenants = require('./admin/tenants');
const adminUsers = require('./admin/users');
const adminFunctions = require('./admin/functions');
const adminSecrets = require('./admin/secrets');
const endpoints = require('./endpoints');
const staticRoute = require('./static');
const messages = require('./messages');
const memories = require('./memories');
const presets = require('./presets');
const projects = require('./projects');
const prompts = require('./prompts');
const balance = require('./balance');
const actions = require('./actions');
const apiKeys = require('./apiKeys');
const banner = require('./banner');
const search = require('./search');
const models = require('./models');
const convos = require('./convos');
const config = require('./config');
const agents = require('./agents');
const roles = require('./roles');
const oauth = require('./oauth');
const files = require('./files');
const share = require('./share');
const tags = require('./tags');
const auth = require('./auth');
const keys = require('./keys');
const user = require('./user');
const mcp = require('./mcp');

module.exports = {
  mcp,
  auth,
  adminAuth,
  adminConfig,
  adminGrants,
  adminGroups,
  adminOverview,
  adminRoles,
  adminTenants,
  adminUsers,
  adminFunctions,
  adminSecrets,
  keys,
  apiKeys,
  user,
  tags,
  roles,
  oauth,
  files,
  share,
  banner,
  agents,
  convos,
  search,
  config,
  models,
  projects,
  prompts,
  actions,
  presets,
  balance,
  messages,
  memories,
  endpoints,
  assistants,
  categories,
  staticRoute,
  accessPermissions,
};
