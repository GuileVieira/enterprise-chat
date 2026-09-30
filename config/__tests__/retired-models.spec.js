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

test('offers Sonnet 5.5 and Sol 6.1 while resolving retired Sol specs to 6.1', () => {
  const config = yaml.load(fs.readFileSync(path.join(__dirname, '../librechat.prod.yaml'), 'utf8'));
  const openRouter = config.endpoints.custom.find((entry) => entry.name === 'OpenRouter');
  expect(openRouter.models.fetch).toBe(true);
  const models = openRouter.models.default;
  const visible = excludeHiddenModelSpecs(config.modelSpecs).list;
  expect(models).toContain('anthropic/claude-sonnet-5.5');
  expect(models).toContain('openai/gpt-6.1-sol');
  expect(models).not.toContain('openai/gpt-6-sol');
  expect(visible.find((spec) => spec.name === 'claude-sonnet-5.5').preset.model).toBe(
    'anthropic/claude-sonnet-5.5',
  );
  expect(visible.find((spec) => spec.name === 'gpt-6.1-sol').preset.model).toBe(
    'openai/gpt-6.1-sol',
  );
  for (const spec of ['gpt-6-sol', 'gpt-56-sol', 'gpt-56-terra']) {
    expect(visible.map((entry) => entry.name)).not.toContain(spec);
    const { modelSpec } = resolveModelSpecForEndpoint({
      modelSpecs: config.modelSpecs,
      spec,
      endpoint: 'OpenRouter',
    });
    const { parsedBody } = applyModelSpecPreset({
      modelSpec,
      endpoint: 'OpenRouter',
      endpointType: 'custom',
      includePresetDefaults: true,
      parsedBody: { spec, model: 'openai/gpt-6-sol', chatProjectId: 'project-1' },
    });
    expect(parsedBody.model).toBe('openai/gpt-6.1-sol');
    expect(parsedBody.chatProjectId).toBe('project-1');
  }
});
