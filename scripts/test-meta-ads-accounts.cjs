#!/usr/bin/env node

const path = require('path');

require('dotenv').config();
require('module-alias')({ base: path.resolve(__dirname, '../api') });

const mongoose = require('mongoose');
const { createModels, decryptV2 } = require('@librechat/data-schemas');
const { connectDb } = require('../api/db/connect');
const { metaGet, getMetaGraphVersion } = require('../api/server/services/MetaAds/graph');

const DEFAULT_TENANT_ID = 'orqest-admin';
const DEFAULT_SECRET_NAME = 'meta_graph_access_token';
const DEFAULT_GRAPH_VERSION = 'v23.0';

const DEFAULT_ACCOUNTS = [
  '366797432228611',
  '580311113124550',
  '404460055040170',
  '624599234599813',
  '1607483863559580',
  '6673653049350470',
  '701886512311813',
  '742339606542978',
  '1281663956035345',
  '519166594051579',
  '677525848140266',
  '1551537072382672',
  '1588165962181481',
  '595181125027646',
  '1183819112886440',
  '2527820347606069',
  '2581389325550861',
  '868700055815209',
  '1211279190850009',
  '705844890438028',
  '3784022511689658',
  '234487331758770',
  '3447610788614362',
  '980844996142509',
  '1029306747708972',
  '636166869171759',
  '462692149651461',
  '1218225539860699',
  '404075176116302',
  '100000000000000000',
  '2882991895175256',
  '3786118188270126',
  '1440726803161549',
  '964401624746507',
  '867763733634017',
  '593574944507100',
  '422967304515115',
  '3925780721068571',
];

function parseArgs(argv) {
  const options = {
    tenantId: DEFAULT_TENANT_ID,
    secretName: DEFAULT_SECRET_NAME,
    graphVersion: process.env.META_GRAPH_API_VERSION || DEFAULT_GRAPH_VERSION,
    accounts: [],
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--tenant') {
      options.tenantId = argv[++i];
      continue;
    }
    if (arg === '--secret') {
      options.secretName = argv[++i];
      continue;
    }
    if (arg === '--project') {
      options.projectId = argv[++i];
      options.secretName = `meta_graph_access_token_project_${options.projectId}`;
      continue;
    }
    if (arg === '--version') {
      options.graphVersion = argv[++i];
      continue;
    }
    if (arg === '--account') {
      options.accounts.push(argv[++i]);
      continue;
    }
    if (arg === '--accounts') {
      options.accounts.push(...String(argv[++i] || '').split(','));
      continue;
    }
    if (arg === '--help' || arg === '-h') {
      options.help = true;
      continue;
    }
    options.accounts.push(arg);
  }

  options.accounts = options.accounts
    .map((account) =>
      String(account || '')
        .replace(/^act_/i, '')
        .replace(/\D/g, ''),
    )
    .filter(Boolean);

  if (options.accounts.length === 0) {
    options.accounts = DEFAULT_ACCOUNTS;
  }

  return options;
}

function printHelp() {
  console.log(`Usage:
  node scripts/test-meta-ads-accounts.cjs [--tenant orqest-admin] [--secret meta_graph_access_token] [--version v23.0]
  node scripts/test-meta-ads-accounts.cjs --project ffaf10ac-4fdb-4670-a3db-ad2b78dd1320
  node scripts/test-meta-ads-accounts.cjs --account 964401624746507 --account 404460055040170
  node scripts/test-meta-ads-accounts.cjs --accounts 964401624746507,404460055040170

Uses the saved tenant secret by default. Does not print the token.`);
}

function formatError(error) {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/\s+/g, ' ').trim();
}

function isTokenValidationError(message) {
  return /access token|oauth|session has expired/i.test(message);
}

async function testAccount({ accountId, token, graphVersion }) {
  const adAccountId = `act_${accountId}`;
  const summary = {
    accountId,
    name: '',
    status: '',
    adsets: '',
    ok: false,
    error: '',
  };

  try {
    const account = await metaGet({
      path: encodeURIComponent(adAccountId),
      token,
      graphVersion,
      resourceLabel: 'ad account',
      params: {
        fields: 'id,name,account_status',
      },
    });
    summary.name = account?.name || '';
    summary.status = String(account?.account_status ?? '');
  } catch (error) {
    summary.error = formatError(error);
    return summary;
  }

  try {
    const adsets = await metaGet({
      path: `${encodeURIComponent(adAccountId)}/adsets`,
      token,
      graphVersion,
      resourceLabel: 'ad sets',
      params: {
        fields: 'id,name,effective_status',
        limit: 5,
      },
    });
    summary.adsets = String(Array.isArray(adsets?.data) ? adsets.data.length : 0);
    summary.ok = true;
    return summary;
  } catch (error) {
    summary.error = formatError(error);
    return summary;
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  const graphVersion = getMetaGraphVersion(options.graphVersion);
  createModels(mongoose);
  await connectDb();
  const TenantSecret = mongoose.models.TenantSecret;
  let secret = await TenantSecret.findOne({
    tenantId: options.tenantId,
    name: options.secretName,
  }).lean();

  if (!secret && options.secretName === DEFAULT_SECRET_NAME) {
    const projectSecrets = await TenantSecret.find({
      tenantId: options.tenantId,
      name: /^meta_graph_access_token_project_/,
    })
      .sort({ updatedAt: -1 })
      .limit(5)
      .lean();
    if (projectSecrets.length === 1) {
      secret = projectSecrets[0];
      options.secretName = secret.name;
    } else if (projectSecrets.length > 1) {
      throw new Error(
        `Secret ${DEFAULT_SECRET_NAME} not found for tenant ${options.tenantId}. Multiple project tokens exist: ${projectSecrets
          .map((item) => item.name)
          .join(', ')}. Use --project <projectId> or --secret <name>.`,
      );
    }
  }

  if (!secret?.value) {
    throw new Error(
      `Secret ${options.secretName} not found for tenant ${options.tenantId}. Save token first.`,
    );
  }
  const token = await decryptV2(secret.value);

  console.log(
    `Testing ${options.accounts.length} Meta ad account(s). tenant=${options.tenantId} secret=${options.secretName} graph=${graphVersion}`,
  );
  console.log('Token loaded: yes (hidden)');

  const results = [];
  for (const accountId of options.accounts) {
    const result = await testAccount({ accountId, token, graphVersion });
    results.push(result);
    const marker = result.ok ? 'OK' : 'FAIL';
    const detail = result.ok
      ? `${result.name || '-'} status=${result.status || '-'} adsets=${result.adsets}`
      : result.error;
    console.log(`${marker}\t${accountId}\t${detail}`);
    if (!result.ok && isTokenValidationError(result.error)) {
      console.log('Aborting: saved token is invalid/expired, so every account will fail.');
      break;
    }
  }

  const ok = results.filter((result) => result.ok);
  const failed = results.filter((result) => !result.ok);
  console.log(`\nSummary: ok=${ok.length} failed=${failed.length}`);
  if (ok.length > 0) {
    console.log(`Working accounts: ${ok.map((result) => result.accountId).join(', ')}`);
  }
}

main()
  .catch((error) => {
    console.error(formatError(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.connection.close().catch(() => undefined);
  });
