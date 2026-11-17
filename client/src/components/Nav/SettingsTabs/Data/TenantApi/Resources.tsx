import React, { useId, useState } from 'react';
import { Checkbox, Input } from '@librechat/client';
import type { TApiKeyResources, TTenantApiCatalog } from 'librechat-data-provider';
import { useLocalize } from '~/hooks';

interface ResourceGroupProps {
  title: string;
  items: { id: string; name: string }[];
  selected?: string[];
  disabled?: boolean;
  onChange: (ids: string[] | undefined) => void;
}
function ResourceGroup({ title, items, selected, disabled, onChange }: ResourceGroupProps) {
  const localize = useLocalize();
  const id = useId();
  const [search, setSearch] = useState('');
  const query = search.trim().toLocaleLowerCase();
  let allState: boolean | 'indeterminate' = false;
  if (selected === undefined) allState = true;
  else if (selected.length > 0) allState = 'indeterminate';
  const visible = items.filter((item) =>
    `${item.name} ${item.id}`.toLocaleLowerCase().includes(query),
  );
  const count =
    selected === undefined
      ? items.length
      : items.filter((item) => selected.includes(item.id)).length;
  return (
    <fieldset
      disabled={disabled}
      className="min-w-0 rounded-xl border border-border-light bg-surface-primary p-3"
    >
      <legend className="px-1 text-sm font-semibold">{title}</legend>
      <div className="mb-3 flex items-center justify-between gap-2">
        <label className="flex cursor-pointer items-center gap-2 text-sm" htmlFor={`${id}-all`}>
          <Checkbox
            id={`${id}-all`}
            aria-label={`${localize('com_ui_tenant_api_select_all')}: ${title}`}
            checked={allState}
            disabled={disabled}
            onCheckedChange={() => onChange(selected === undefined ? [] : undefined)}
          />
          {localize('com_ui_tenant_api_select_all')}
        </label>
        <span className="shrink-0 text-xs text-text-secondary" aria-live="polite">
          {count}/{items.length}
        </span>
      </div>
      <Input
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        aria-label={`${localize('com_ui_search')}: ${title}`}
        placeholder={localize('com_ui_search')}
        className="mb-2 bg-surface-secondary"
        disabled={disabled}
      />
      <ul className="max-h-52 space-y-1 overflow-y-auto overscroll-contain">
        {visible.map((item) => (
          <li key={item.id}>
            <label className="flex cursor-pointer items-start gap-2 rounded-md p-2 hover:bg-surface-hover">
              <Checkbox
                aria-label={`${title}: ${item.name}`}
                className="mt-0.5"
                disabled={disabled}
                checked={selected === undefined || selected.includes(item.id)}
                onCheckedChange={(checked) => {
                  const current = selected ?? items.map((resource) => resource.id);
                  onChange(
                    checked === true
                      ? [...new Set([...current, item.id])]
                      : current.filter((value) => value !== item.id),
                  );
                }}
              />
              <span className="min-w-0 text-sm">
                <span className="block break-words">{item.name}</span>
                <code className="block break-all text-xs text-text-secondary">{item.id}</code>
              </span>
            </label>
          </li>
        ))}
      </ul>
      {!visible.length && (
        <p className="p-2 text-sm text-text-secondary">
          {localize(
            items.length ? 'com_ui_tenant_api_no_results' : 'com_ui_tenant_api_no_resources',
          )}
        </p>
      )}
    </fieldset>
  );
}

export default function Resources({
  catalog,
  value,
  onChange,
  disabled,
}: {
  catalog: TTenantApiCatalog;
  value: TApiKeyResources;
  onChange: (value: TApiKeyResources) => void;
  disabled?: boolean;
}) {
  const localize = useLocalize();
  const update = (kind: 'agentIds' | 'projectIds', ids?: string[]) => {
    const next = { ...value };
    if (ids === undefined) delete next[kind];
    else next[kind] = ids;
    onChange(next);
  };
  return (
    <div className="space-y-3">
      <p className="text-sm text-text-secondary">{localize('com_ui_tenant_api_access_hint')}</p>
      <div className="grid min-w-0 gap-3 sm:grid-cols-2">
        <ResourceGroup
          title={localize('com_ui_tenant_api_agents')}
          items={catalog.agents}
          selected={value.agentIds}
          disabled={disabled}
          onChange={(ids) => update('agentIds', ids)}
        />
        <ResourceGroup
          title={localize('com_ui_tenant_api_projects')}
          items={catalog.projects.map((project) => ({ id: project.projectId, name: project.name }))}
          selected={value.projectIds}
          disabled={disabled}
          onChange={(ids) => update('projectIds', ids)}
        />
      </div>
    </div>
  );
}
