import { Constants } from 'librechat-data-provider';
import { projectAgentArchive } from './archiveProjection';

it('reserves native tool names even when a connector with the same operation is listed first', () => {
  const bundle = projectAgentArchive(
    {
      name: 'Agent',
      provider: 'openAI',
      model: 'model',
      tools: [
        `web_search${Constants.mcp_delimiter}server`,
        'web_search_action_domain',
        'web_search',
      ],
    },
    [],
  );
  expect(bundle.tools).toContainEqual({ name: 'web_search', kind: 'builtin' });
  expect(new Set(bundle.tools.map((tool) => tool.name)).size).toBe(3);
});

it('preserves portable instructions while excluding connector hosts, source IDs and private kwargs', () => {
  const source = {
    name: 'Agent',
    provider: 'openAI',
    model: 'model',
    instructions: 'Literal prompt',
    tools: [
      'web_search',
      'report_action_private-host',
      `search${Constants.mcp_delimiter}private-server`,
      'tenant-function-secret-id',
    ],
    actions: ['private-registration-id'],
    tool_kwargs: [{ apiKey: 'secret' }],
    author: 'private-author-id',
  };
  const bundle = projectAgentArchive(source, []);
  expect(bundle.instructions).toBe('Literal prompt');
  expect(bundle.tools).toContainEqual({ name: 'web_search', kind: 'builtin' });
  expect(bundle.tools).toContainEqual({ name: 'report', kind: 'action' });
  expect(bundle.tools).toContainEqual({ name: 'search', kind: 'mcp' });
  const serialized = JSON.stringify(bundle);
  for (const hidden of [
    'private-host',
    'private-server',
    'tenant-function-secret-id',
    'private-registration-id',
    'private-author-id',
    'apiKey',
  ]) {
    expect(serialized).not.toContain(hidden);
  }
});
