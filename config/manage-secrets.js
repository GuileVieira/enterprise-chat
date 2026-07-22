const path = require('path');
const mongoose = require('mongoose');
const { tenantStorage } = require('@librechat/data-schemas');
require('module-alias')({ base: path.resolve(__dirname, '..', 'api') });
const { createMethods, createModels } = require('@librechat/data-schemas');
const { askQuestion, silentExit } = require('./helpers');
const connect = require('./connect');

const VALID_TYPES = ['bearer', 'basic', 'api_key', 'custom'];

function showUsage() {
  console.purple('------------------------------------------------');
  console.purple('Manage Tenant Secrets (API keys & credentials)');
  console.purple('------------------------------------------------');
  console.orange('Commands:');
  console.orange('  list    --tenant=<tenantId>');
  console.orange('  create  --tenant=<tenantId> --name=<name> --type=<type> --value=<value>');
  console.orange('  rotate  --tenant=<tenantId> --name=<name> --value=<value>');
  console.orange('  delete  --tenant=<tenantId> --name=<name>');
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

function validateSecretPayload(name, type, value) {
  if (!name || !/^[a-z0-9_-]+$/.test(name)) {
    throw new Error('Invalid or missing "name". Must be a slug (a-z, 0-9, _, -).');
  }
  if (!VALID_TYPES.includes(type)) {
    throw new Error(`Invalid "type". Must be one of: ${VALID_TYPES.join(', ')}`);
  }
  if (!value) {
    throw new Error('Missing "value".');
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
        const secrets = await db.listTenantSecrets(tenantId);
        if (secrets.length === 0) {
          console.orange('No secrets found.');
          return;
        }
        console.green(`Found ${secrets.length} secret(s):`);
        for (const s of secrets) {
          console.white(`  ${s.name} (${s.type})`);
        }
        break;
      }

      case 'create':
      case 'rotate': {
        const name = args.name;
        const type = args.type;
        let value = args.value;

        if (!name) {
          console.red('Error: --name is required.');
          silentExit(1);
        }
        if (!type) {
          console.red('Error: --type is required.');
          silentExit(1);
        }
        if (!value) {
          value = await askQuestion(`Value for ${name}:`);
        }

        validateSecretPayload(name, type, value);

        if (command === 'create') {
          const existing = await db.getTenantSecret(tenantId, name);
          if (existing) {
            console.red(`Secret already exists: ${name}. Use "rotate" to update.`);
            silentExit(1);
          }
        }

        await db.upsertTenantSecret(tenantId, name, value, type);
        console.green(`${command === 'create' ? 'Created' : 'Rotated'} secret: ${name}`);
        break;
      }

      case 'delete': {
        const name = args.name;
        if (!name) {
          console.red('Error: --name is required.');
          silentExit(1);
        }

        const inUse = await db.isSecretInUse(tenantId, name);
        if (inUse) {
          const confirm = await askQuestion(
            `Secret "${name}" is referenced by one or more functions. Delete anyway? (y/N):`,
          );
          if (confirm.trim().toLowerCase() !== 'y') {
            console.orange('Cancelled.');
            silentExit(0);
          }
        }

        const result = await db.deleteTenantSecret(tenantId, name);
        if (!result) {
          console.red(`Secret not found: ${name}`);
          silentExit(1);
        }
        console.green(`Deleted secret: ${name}`);
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
  createModels(mongoose);
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
