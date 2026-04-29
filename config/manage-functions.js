const path = require('path');
const mongoose = require('mongoose');
const { tenantStorage } = require('@librechat/data-schemas');
require('module-alias')({ base: path.resolve(__dirname, '..', 'api') });
const { createMethods } = require('@librechat/data-schemas');
const { askQuestion, silentExit } = require('./helpers');
const connect = require('./connect');

const VALID_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
const VALID_AUTH_TYPES = ['bearer', 'basic', 'api_key', 'custom'];

function showUsage() {
  console.purple('------------------------------------------------');
  console.purple('Manage Tenant Functions (dynamic agent tools)');
  console.purple('------------------------------------------------');
  console.orange('Commands:');
  console.orange('  list    --tenant=<tenantId>');
  console.orange('  create  --tenant=<tenantId> --file=<path>');
  console.orange('  update  --tenant=<tenantId> --id=<funcId> --file=<path>');
  console.orange('  toggle  --tenant=<tenantId> --id=<funcId> --active=true|false');
  console.orange('  delete  --tenant=<tenantId> --id=<funcId>');
  console.orange('  show    --tenant=<tenantId> --id=<funcId>');
  console.purple('------------------------------------------------');
}

function parseArgs(argv) {
  const args = { positional: [] };
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const [key, value] = arg.slice(2).split('=');
      args[key] = value !== undefined ? value : true;
    } else {
      args.positional.push(arg);
    }
  }
  args.command = args.positional[0];
  return args;
}

async function readJsonFile(filePath) {
  const fs = require('fs');
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`File not found: ${resolved}`);
  }
  const content = fs.readFileSync(resolved, 'utf-8');
  return JSON.parse(content);
}

function validateFunctionPayload(payload) {
  if (!payload.id || !/^[a-z0-9_-]+$/.test(payload.id)) {
    throw new Error('Invalid or missing "id". Must be a slug (a-z, 0-9, _, -).');
  }
  if (!payload.name) {
    throw new Error('Missing "name".');
  }
  if (!payload.description) {
    throw new Error('Missing "description".');
  }
  if (!payload.config) {
    throw new Error('Missing "config".');
  }
  if (!payload.config.baseUrl) {
    throw new Error('Missing "config.baseUrl".');
  }
  if (!VALID_METHODS.includes(payload.config.method)) {
    throw new Error(`Invalid "config.method". Must be one of: ${VALID_METHODS.join(', ')}`);
  }
  if (!payload.config.path) {
    throw new Error('Missing "config.path".');
  }
  if (payload.config.auth) {
    if (!VALID_AUTH_TYPES.includes(payload.config.auth.type)) {
      throw new Error(`Invalid auth type. Must be one of: ${VALID_AUTH_TYPES.join(', ')}`);
    }
    if (!payload.config.auth.secretName) {
      throw new Error('Missing "config.auth.secretName".');
    }
  }
  if (!payload.inputSchema || typeof payload.inputSchema !== 'object') {
    throw new Error('Missing or invalid "inputSchema" (must be an object).');
  }
  if (payload.postProcess) {
    try {
      // eslint-disable-next-line no-new-func
      new Function(`return (${payload.postProcess})`)();
    } catch {
      throw new Error('Invalid "postProcess" code (must be a valid JavaScript function).');
    }
  }
}

async function runCommand(command, args, db) {
  const tenantId = args.tenant;
  if (!tenantId) {
    console.red('Error: --tenant is required.');
    silentExit(1);
  }

  return tenantStorage.run({ tenantId }, async () => {
    switch (command) {
      case 'list': {
        const functions = await db.getTenantFunctions({ tenantId });
        if (functions.length === 0) {
          console.orange('No tenant functions found.');
          return;
        }
        console.green(`Found ${functions.length} tenant function(s):`);
        for (const fn of functions) {
          const status = fn.isActive ? '\x1b[32mactive\x1b[0m' : '\x1b[31minactive\x1b[0m';
          console.white(`  [${status}] ${fn.id}: ${fn.name} (${fn.config.method} ${fn.config.path})`);
        }
        break;
      }

      case 'show': {
        const id = args.id;
        if (!id) {
          console.red('Error: --id is required.');
          silentExit(1);
        }
        const fn = await db.getTenantFunctionById(tenantId, id);
        if (!fn) {
          console.red(`Function not found: ${id}`);
          silentExit(1);
        }
        console.green(`Function: ${fn.id}`);
        console.white(JSON.stringify(fn, null, 2));
        break;
      }

      case 'create': {
        const filePath = args.file;
        if (!filePath) {
          console.red('Error: --file is required.');
          silentExit(1);
        }
        const payload = await readJsonFile(filePath);
        validateFunctionPayload(payload);
        payload.tenantId = tenantId;
        payload.type = 'http';
        payload.isActive = payload.isActive !== false;

        const existing = await db.getTenantFunctionById(tenantId, payload.id);
        if (existing) {
          console.red(`Function already exists: ${payload.id}`);
          silentExit(1);
        }

        await db.createTenantFunction(payload);
        console.green(`Created function: ${payload.id}`);
        break;
      }

      case 'update': {
        const id = args.id;
        const filePath = args.file;
        if (!id || !filePath) {
          console.red('Error: --id and --file are required.');
          silentExit(1);
        }
        const payload = await readJsonFile(filePath);
        const existing = await db.getTenantFunctionById(tenantId, id);
        if (!existing) {
          console.red(`Function not found: ${id}`);
          silentExit(1);
        }
        delete payload.id;
        delete payload.tenantId;
        await db.updateTenantFunction(tenantId, id, payload);
        console.green(`Updated function: ${id}`);
        break;
      }

      case 'toggle': {
        const id = args.id;
        const active = args.active;
        if (!id || !active) {
          console.red('Error: --id and --active are required.');
          silentExit(1);
        }
        const isActive = active === 'true';
        const result = await db.toggleTenantFunction(tenantId, id, isActive);
        if (!result) {
          console.red(`Function not found: ${id}`);
          silentExit(1);
        }
        console.green(`Toggled function ${id} to ${isActive ? 'active' : 'inactive'}`);
        break;
      }

      case 'delete': {
        const id = args.id;
        if (!id) {
          console.red('Error: --id is required.');
          silentExit(1);
        }
        const result = await db.deleteTenantFunction(tenantId, id);
        if (!result) {
          console.red(`Function not found: ${id}`);
          silentExit(1);
        }
        console.green(`Deleted function: ${id}`);
        break;
      }

      default:
        console.red(`Unknown command: ${command}`);
        showUsage();
        silentExit(1);
    }
  });
}

(async () => {
  await connect();
  const db = createMethods(mongoose);
  const args = parseArgs(process.argv);

  if (!args.command) {
    showUsage();
    silentExit(1);
  }

  try {
    await runCommand(args.command, args, db);
    silentExit(0);
  } catch (error) {
    console.red('Error: ' + error.message);
    silentExit(1);
  }
})();

process.on('uncaughtException', (err) => {
  console.error('There was an uncaught error:');
  console.error(err);
  process.exit(1);
});
