export function tenantApiPayload(agentId: string, projectId: string, prompt: string): string {
  return JSON.stringify(
    {
      model: agentId,
      ...(projectId ? { projectId } : {}),
      messages: [{ role: 'user', content: prompt }],
      stream: false,
    },
    null,
    2,
  );
}

export function tenantApiCommand(endpoint: string, payload: string): string {
  const quote = (text: string) => `'${text.replaceAll("'", "'\\''")}'`;
  return `curl --fail-with-body ${quote(endpoint)} \\\n  -H "Authorization: Bearer $TENANT_API_KEY" \\\n  -H 'Content-Type: application/json' \\\n  --data-raw ${quote(payload)}`;
}

export function tenantProjectsCsv(projects: { projectId: string; name: string }[]): string {
  const cell = (value: string) => `"${value.replaceAll('"', '""')}"`;
  return [
    'projectId,name',
    ...projects.map(
      ({ projectId, name }) =>
        `${cell(projectId)},${cell(/^[=+@\-\t\r\n]/.test(name) ? "'" + name : name)}`,
    ),
  ].join('\r\n');
}
