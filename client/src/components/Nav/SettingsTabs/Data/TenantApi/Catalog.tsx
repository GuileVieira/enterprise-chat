import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button, useToastContext } from '@librechat/client';
import { apiBaseUrl, dataService, QueryKeys } from 'librechat-data-provider';
import { useLocalize } from '~/hooks';
import { tenantApiCommand, tenantApiPayload, tenantProjectsCsv } from './payload';

export default function Catalog({ tenantId }: { tenantId: string }) {
  const localize = useLocalize();
  const { showToast } = useToastContext();
  const [agentId, setAgentId] = useState('');
  const [projectId, setProjectId] = useState('');
  const { data, isLoading, isError } = useQuery({
    queryKey: [QueryKeys.tenantApiCatalog, tenantId],
    queryFn: () => dataService.getTenantApiCatalog(tenantId),
    retry: false,
  });
  const selectedAgent =
    data?.agents.find((agent) => agent.id === agentId)?.id ?? data?.agents[0]?.id ?? '';
  const apiAvailable =
    data?.agents.find((agent) => agent.id === selectedAgent)?.apiAvailable !== false;
  const selectedProject = data?.projects.some((project) => project.projectId === projectId)
    ? projectId
    : '';
  const payload = tenantApiPayload(
    selectedAgent,
    selectedProject,
    localize('com_ui_tenant_api_prompt'),
  );
  const endpoint = `${window.location.origin}${apiBaseUrl()}/api/agents/v1/chat/completions`;

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      showToast({ message: localize('com_ui_copied'), status: 'success' });
    } catch {
      showToast({ message: localize('com_ui_tenant_api_copy_error'), status: 'error' });
    }
  }

  if (isLoading) return <p role="status">{localize('com_ui_loading')}</p>;
  if (isError) return <p role="alert">{localize('com_ui_tenant_api_catalog_error')}</p>;

  return (
    <section className="space-y-3 border-t border-border-light pt-4">
      <h3 className="font-semibold">{localize('com_ui_tenant_api_catalog')}</h3>
      <p className="text-sm text-text-secondary">{localize('com_ui_tenant_api_context')}</p>
      <label className="block space-y-1">
        <span>{localize('com_ui_tenant_api_agent')}</span>
        <select
          className="w-full rounded-lg border border-border-medium bg-background p-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-ring-primary focus:ring-offset-2"
          value={selectedAgent}
          onChange={(event) => setAgentId(event.target.value)}
        >
          {!data?.agents.length && (
            <option value="">{localize('com_ui_tenant_api_no_agents')}</option>
          )}
          {data?.agents.map((agent) => (
            <option key={agent.id} value={agent.id}>
              {agent.name} — {agent.id}
              {agent.apiAvailable === false
                ? ` — ${localize('com_ui_tenant_api_shared_only')}`
                : ''}
            </option>
          ))}
        </select>
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <code className="break-all text-xs">{selectedAgent}</code>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!selectedAgent}
          onClick={() => copy(selectedAgent)}
        >
          {localize('com_ui_tenant_api_copy_agent')}
        </Button>
      </div>
      <label className="block space-y-1">
        <span>{localize('com_ui_tenant_api_project')}</span>
        <select
          className="w-full rounded-lg border border-border-medium bg-background p-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-ring-primary focus:ring-offset-2"
          value={selectedProject}
          onChange={(event) => setProjectId(event.target.value)}
        >
          <option value="">{localize('com_ui_tenant_api_no_project')}</option>
          {data?.projects.map((project) => (
            <option key={project.projectId} value={project.projectId}>
              {project.name}
            </option>
          ))}
        </select>
      </label>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={!data?.projects.length}
        onClick={() => copy(tenantProjectsCsv(data?.projects ?? []))}
      >
        {localize('com_ui_tenant_api_copy_projects_csv')}
      </Button>
      <ul className="max-h-48 space-y-2 overflow-y-auto">
        {data?.projects.map((project) => (
          <li
            key={project.projectId}
            className="flex items-center justify-between gap-2 rounded-lg border border-border-light p-2"
          >
            <div className="min-w-0">
              <p className="break-words">{project.name}</p>
              <code className="break-all text-xs text-text-secondary">{project.projectId}</code>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => copy(project.projectId)}
              aria-label={`${localize('com_ui_tenant_api_copy_id')}: ${project.name}`}
            >
              {localize('com_ui_tenant_api_copy_id')}
            </Button>
          </li>
        ))}
      </ul>
      {!data?.projects.length && <p>{localize('com_ui_tenant_api_no_projects')}</p>}
      <label className="block space-y-1">
        <span>{localize('com_ui_tenant_api_payload')}</span>
        <textarea
          readOnly
          value={payload}
          rows={10}
          className="w-full rounded-lg border border-border-medium bg-background p-2 font-mono text-xs text-text-primary focus:outline-none focus:ring-2 focus:ring-ring-primary focus:ring-offset-2"
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={!selectedAgent || !apiAvailable}
          onClick={() => copy(payload)}
        >
          {localize('com_ui_tenant_api_copy_payload')}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={!selectedAgent || !apiAvailable}
          onClick={() => copy(tenantApiCommand(endpoint, payload))}
        >
          {localize('com_ui_tenant_api_copy_curl')}
        </Button>
      </div>
      <p className="text-xs text-text-secondary">{localize('com_ui_tenant_api_token_hint')}</p>
      <code className="block break-all text-xs">{`GET ${apiBaseUrl()}/api/agents/v1/catalog`}</code>
    </section>
  );
}
