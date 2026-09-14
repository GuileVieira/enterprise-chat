import { execFileSync } from 'node:child_process';
import { tenantApiCommand, tenantApiPayload, tenantProjectsCsv } from './payload';

it('copies agent + project context with no credential in the payload or example', () => {
  const payload = tenantApiPayload('agent-1', 'project-1', 'Use project context');
  expect(JSON.parse(payload)).toEqual({
    model: 'agent-1',
    projectId: 'project-1',
    messages: [{ role: 'user', content: 'Use project context' }],
    stream: false,
  });
  const command = tenantApiCommand('https://orqest.test/api/agents/v1/chat/completions', payload);
  expect(command).toContain('Authorization: Bearer $TENANT_API_KEY');
  expect(command).toContain('--data-raw');
  expect(command).not.toMatch(/sk-[a-zA-Z0-9]+/);
  expect(command).not.toContain('\n+');
});

it('omits projectId for agent-only calls and shell-quotes untrusted text', () => {
  const payload = tenantApiPayload('agent-1', '', "Don't run $(whoami) or `id`");
  expect(JSON.parse(payload)).not.toHaveProperty('projectId');
  const command = tenantApiCommand('https://orqest.test', payload);
  expect(command).toContain("Don'\\''t");
  expect(command).toContain('$(whoami)');
});

it('runs the copied shell command with the environment placeholder and preserves payload text', () => {
  const payload = tenantApiPayload(
    'agent-1',
    'project-1',
    "Don't expand $(printf injected) or `printf injected`",
  );
  const command = tenantApiCommand('https://orqest.test', payload);
  const output = execFileSync(
    '/bin/sh',
    ['-c', `TENANT_API_KEY='test-only-credential'\ncurl() { printf '%s\\n' "$@"; }\n${command}`],
    {
      encoding: 'utf8',
    },
  );
  expect(output).toContain('Authorization: Bearer test-only-credential');
  expect(output).toContain(payload);
});

it('exports every project with CSV escaping and neutralizes spreadsheet formulas', () => {
  expect(
    tenantProjectsCsv([
      { projectId: 'one', name: 'A, "B"\nC' },
      { projectId: 'two', name: '=1+1' },
    ]),
  ).toBe('projectId,name\r\n"one","A, ""B""\nC"\r\n"two","\'=1+1"');
  expect(tenantProjectsCsv([])).toBe('projectId,name');
});
