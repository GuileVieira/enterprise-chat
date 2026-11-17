const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const root = path.resolve(__dirname, '..');
const source = path.join(root, 'docs/openapi/orqest-integration.proposed.openapi.yaml');
const target = path.join(root, 'api/server/openapi/integrations.json');
const document = yaml.load(fs.readFileSync(source, 'utf8'));
fs.mkdirSync(path.dirname(target), { recursive: true });
fs.writeFileSync(target, `${JSON.stringify(document, null, 2)}\n`);
