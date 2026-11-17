import React, { useId, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
  useToastContext,
} from '@librechat/client';
import { apiBaseUrl, dataService, QueryKeys } from 'librechat-data-provider';
import { useLocalize } from '~/hooks';
import { tenantApiReadCommand, tenantProjectsCsv } from './payload';

export default function Catalog({ tenantId }: { tenantId: string }) {
  const localize = useLocalize();
  const id = useId();
  const { showToast } = useToastContext();
  const [agentId, setAgentId] = useState('');
  const [projectId, setProjectId] = useState('');
  const { data, isLoading, isError } = useQuery({
    queryKey: [QueryKeys.tenantApiCatalog, tenantId],
    queryFn: () => dataService.getTenantApiCatalog(tenantId),
    retry: false,
  });
  const selectedAgent = data?.agents.find((agent) => agent.id === agentId)?.id ?? '';
  const selectedProject = data?.projects.some((project) => project.projectId === projectId)
    ? projectId
    : '';
  const origin = `${window.location.origin}${apiBaseUrl()}/api/integrations/v1`;
  const endpoint = selectedAgent
    ? `${origin}/agents/${encodeURIComponent(selectedAgent)}/context${selectedProject ? `?projectId=${encodeURIComponent(selectedProject)}` : ''}`
    : `${origin}/openapi.json`;
  const command = tenantApiReadCommand(endpoint);
  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      showToast({ message: localize('com_ui_copied'), status: 'success' });
    } catch {
      showToast({ message: localize('com_ui_tenant_api_copy_error'), status: 'error' });
    }
  }
  return (
    <section className="space-y-4 border-t border-border-light pt-5">
      <div className="space-y-1">
        <h3 className="font-semibold">{localize('com_ui_tenant_api_how_to')}</h3>
        <p className="text-sm text-text-secondary">{localize('com_ui_tenant_api_rest_hint')}</p>
      </div>
      <details className="rounded-xl border border-border-light bg-surface-primary p-3">
        <summary className="cursor-pointer text-sm font-medium">
          {localize('com_ui_tenant_api_context_example')}
        </summary>
        <p className="my-3 text-sm text-text-secondary">
          {localize('com_ui_tenant_api_example_hint')}
        </p>
        {isLoading && <p role="status">{localize('com_ui_loading')}</p>}
        {isError && <p role="alert">{localize('com_ui_tenant_api_catalog_error')}</p>}
        {data && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="min-w-0 space-y-1">
              <label className="text-sm" htmlFor={`${id}-agent`}>
                {localize('com_ui_tenant_api_agent')}
              </label>
              <Select
                value={selectedAgent || '__document__'}
                onValueChange={(value) => setAgentId(value === '__document__' ? '' : value)}
              >
                <SelectTrigger
                  id={`${id}-agent`}
                  className="bg-surface-secondary text-text-primary"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__document__">
                    {localize('com_ui_tenant_api_openapi')}
                  </SelectItem>
                  {data.agents.map((agent) => (
                    <SelectItem key={agent.id} value={agent.id}>
                      {agent.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-0 space-y-1">
              <label className="text-sm" htmlFor={`${id}-project`}>
                {localize('com_ui_tenant_api_project')}
              </label>
              <Select
                value={selectedProject || '__none__'}
                onValueChange={(value) => setProjectId(value === '__none__' ? '' : value)}
                disabled={!selectedAgent}
              >
                <SelectTrigger
                  id={`${id}-project`}
                  className="bg-surface-secondary text-text-primary"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">
                    {localize('com_ui_tenant_api_no_project')}
                  </SelectItem>
                  {data.projects.map((project) => (
                    <SelectItem key={project.projectId} value={project.projectId}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
        {selectedAgent && (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-text-secondary">
            <code className="break-all">{selectedAgent}</code>
            <Button type="button" size="sm" variant="outline" onClick={() => copy(selectedAgent)}>
              {localize('com_ui_tenant_api_copy_agent')}
            </Button>
          </div>
        )}
        {data?.projects.length ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="mt-3"
            onClick={() => copy(tenantProjectsCsv(data.projects))}
          >
            {localize('com_ui_tenant_api_copy_projects_csv')}
          </Button>
        ) : null}
      </details>
      <label className="block space-y-2 text-sm">
        <span>{localize('com_ui_tenant_api_request_example')}</span>
        <Textarea
          readOnly
          value={command}
          rows={5}
          spellCheck={false}
          className="min-h-28 resize-y bg-surface-secondary font-mono text-sm leading-6 text-text-primary"
        />
      </label>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-text-secondary">{localize('com_ui_tenant_api_token_hint')}</p>
        <Button type="button" variant="outline" onClick={() => copy(command)}>
          {localize('com_ui_tenant_api_copy_curl')}
        </Button>
      </div>
    </section>
  );
}
