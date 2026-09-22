const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const {
  applyModelSpecPreset,
  excludeHiddenModelSpecs,
  resolveModelSpecForEndpoint,
} = require('@librechat/api');

test('retired Fable conversations resolve to Opus without offering Fable in the menu', () => {
  const config = yaml.load(fs.readFileSync(path.join(__dirname, '../librechat.prod.yaml'), 'utf8'));
  const endpoint = 'OpenRouter';
  const models = config.endpoints.custom.find((entry) => entry.name === endpoint).models.default;
  expect(models).not.toContain('anthropic/claude-fable-5.1');
  expect(excludeHiddenModelSpecs(config.modelSpecs).list.map((spec) => spec.name)).not.toContain(
    'claude-fable-5',
  );

  const { modelSpec } = resolveModelSpecForEndpoint({
    modelSpecs: config.modelSpecs,
    spec: 'claude-fable-5',
    endpoint,
  });
  expect(modelSpec).toBeDefined();
  const { parsedBody } = applyModelSpecPreset({
    modelSpec,
    endpoint,
    endpointType: 'custom',
    includePresetDefaults: true,
    parsedBody: {
      spec: 'claude-fable-5',
      model: 'anthropic/claude-fable-5.1',
      chatProjectId: 'existing-project',
    },
  });
  expect(parsedBody.model).toBe('anthropic/claude-opus-5.5');
  expect(models).toContain(parsedBody.model);
  expect(parsedBody.chatProjectId).toBe('existing-project');
});
