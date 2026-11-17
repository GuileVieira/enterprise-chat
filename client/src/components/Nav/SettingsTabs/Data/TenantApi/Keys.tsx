import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Button,
  Input,
  OGDialog,
  OGDialogContent,
  OGDialogTitle,
  useToastContext,
} from '@librechat/client';
import { dataService, QueryKeys, MutationKeys } from 'librechat-data-provider';
import type { TAgentApiKeyListItem, TApiKeyResources } from 'librechat-data-provider';
import { useLocalize } from '~/hooks';
import Resources from './Resources';

export default function Keys({ tenantId }: { tenantId: string }) {
  const localize = useLocalize();
  const queryClient = useQueryClient();
  const { showToast } = useToastContext();
  const [name, setName] = useState('');
  const [secret, setSecret] = useState('');
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<TAgentApiKeyListItem | null>(null);
  const [access, setAccess] = useState<TApiKeyResources>({});
  const [revoking, setRevoking] = useState<TAgentApiKeyListItem | null>(null);
  const queryKey = [QueryKeys.tenantApiKeys, tenantId];
  const keys = useQuery({
    queryKey,
    queryFn: () => dataService.getTenantApiKeys(tenantId),
    retry: false,
  });
  const catalog = useQuery({
    queryKey: [QueryKeys.tenantApiCatalog, tenantId],
    queryFn: () => dataService.getTenantApiCatalog(tenantId),
    retry: false,
  });
  const reportError = () =>
    showToast({ status: 'error', message: localize('com_ui_tenant_api_key_error') });
  const closeEditor = () => {
    setCreating(false);
    setEditing(null);
    setName('');
    setAccess({});
  };
  const refresh = () => {
    void queryClient.invalidateQueries(queryKey);
  };
  const create = useMutation({
    mutationKey: [MutationKeys.createTenantApiKey, tenantId],
    mutationFn: async () => {
      const result = await dataService.createTenantApiKey(tenantId, {
        name: name.trim(),
        resourceAccess: access,
      });
      setSecret(result.key);
    },
    onSuccess: () => {
      closeEditor();
      refresh();
    },
    onError: reportError,
  });
  const update = useMutation({
    mutationKey: [MutationKeys.updateTenantApiKeyResources, tenantId, editing?.id],
    mutationFn: () =>
      editing
        ? dataService.updateTenantApiKeyResources(tenantId, editing.id, access)
        : Promise.reject(new Error('No key selected')),
    onSuccess: () => {
      closeEditor();
      refresh();
      showToast({ status: 'success', message: localize('com_ui_tenant_api_access_saved') });
    },
    onError: reportError,
  });
  const revoke = useMutation({
    mutationKey: [MutationKeys.deleteTenantApiKey, tenantId],
    mutationFn: (id: string) => dataService.deleteTenantApiKey(tenantId, id),
    onSuccess: () => {
      setRevoking(null);
      refresh();
    },
    onError: reportError,
  });
  const saving = create.isLoading || update.isLoading;
  let submitLabel = localize('com_ui_create_api_key');
  if (editing) submitLabel = localize('com_ui_save');
  if (saving) submitLabel = localize('com_ui_saving');
  const summary = (key: TAgentApiKeyListItem) => {
    const agents = key.resourceAccess?.agentIds;
    const projects = key.resourceAccess?.projectIds;
    if (!agents && !projects) return localize('com_ui_tenant_api_all_access');
    return localize('com_ui_tenant_api_access_counts', {
      agents: agents === undefined ? localize('com_ui_tenant_api_all') : String(agents.length),
      projects:
        projects === undefined ? localize('com_ui_tenant_api_all') : String(projects.length),
    });
  };
  async function copySecret() {
    try {
      await navigator.clipboard.writeText(secret);
      showToast({ status: 'success', message: localize('com_ui_api_key_copied') });
    } catch {
      reportError();
    }
  }
  return (
    <section className="space-y-4" aria-label={localize('com_ui_tenant_api_keys')}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-semibold">{localize('com_ui_tenant_api_keys')}</h3>
        <Button
          type="button"
          disabled={saving || !!secret}
          onClick={() => {
            closeEditor();
            setCreating(true);
          }}
        >
          {localize('com_ui_tenant_api_new_key')}
        </Button>
      </div>
      <p className="text-sm text-text-secondary">{localize('com_ui_tenant_api_principal')}</p>
      {keys.isLoading && <p role="status">{localize('com_ui_loading')}</p>}
      {keys.isError && <p role="alert">{localize('com_ui_api_keys_load_error')}</p>}
      <ul className="space-y-2">
        {keys.data?.keys.map((key) => (
          <li
            key={key.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border-light bg-surface-primary p-3"
          >
            <div className="min-w-0">
              <p className="break-words font-medium">{key.name}</p>
              <p className="text-sm text-text-secondary">{summary(key)}</p>
              <code className="text-xs text-text-secondary">{key.keyPrefix}…</code>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={saving}
                onClick={() => {
                  setCreating(false);
                  setEditing(key);
                  setAccess(key.resourceAccess ?? {});
                }}
                aria-label={`${localize('com_ui_tenant_api_edit_access')}: ${key.name}`}
              >
                {localize('com_ui_tenant_api_edit_access')}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={saving}
                onClick={() => setRevoking(key)}
              >
                {localize('com_ui_tenant_api_revoke')}
              </Button>
            </div>
          </li>
        ))}
      </ul>
      {!keys.isLoading && !keys.isError && !keys.data?.keys.length && (
        <p className="text-sm text-text-secondary">{localize('com_ui_no_api_keys')}</p>
      )}
      {(creating || editing) && (
        <div className="space-y-4 rounded-xl border border-border-medium bg-surface-secondary p-4">
          <h4 className="font-semibold">
            {editing
              ? `${localize('com_ui_tenant_api_edit_access')}: ${editing.name}`
              : localize('com_ui_tenant_api_new_key')}
          </h4>
          {creating && (
            <label className="block space-y-1 text-sm">
              <span>{localize('com_ui_api_key_name')}</span>
              <Input
                value={name}
                maxLength={100}
                disabled={saving}
                className="bg-surface-primary"
                onChange={(event) => setName(event.target.value)}
                autoComplete="off"
              />
            </label>
          )}
          {catalog.isLoading && <p role="status">{localize('com_ui_loading')}</p>}
          {catalog.isError && (
            <div role="alert" className="space-y-2 text-sm">
              <p>{localize('com_ui_tenant_api_catalog_error')}</p>
              <Button type="button" variant="outline" onClick={() => void catalog.refetch()}>
                {localize('com_ui_tenant_api_retry')}
              </Button>
            </div>
          )}
          {catalog.data && !catalog.isError && (
            <Resources
              catalog={catalog.data}
              value={access}
              onChange={setAccess}
              disabled={saving}
            />
          )}
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" disabled={saving} onClick={closeEditor}>
              {localize('com_ui_cancel')}
            </Button>
            <Button
              type="button"
              disabled={
                saving ||
                !catalog.data ||
                catalog.isError ||
                (creating && (!name.trim() || !!secret))
              }
              onClick={() => (editing ? update.mutate() : create.mutate())}
            >
              {submitLabel}
            </Button>
          </div>
        </div>
      )}
      {secret && (
        <div
          className="space-y-3 rounded-xl border border-border-medium bg-surface-secondary p-4"
          role="status"
        >
          <p className="text-sm">{localize('com_ui_api_key_warning')}</p>
          <Input
            type="password"
            readOnly
            value={secret}
            autoComplete="off"
            className="bg-surface-primary"
            aria-label={localize('com_ui_your_api_key')}
          />
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={copySecret}>
              {localize('com_ui_tenant_api_copy_secret')}
            </Button>
            <Button type="button" variant="outline" onClick={() => setSecret('')}>
              {localize('com_ui_done')}
            </Button>
          </div>
        </div>
      )}
      <OGDialog
        open={!!revoking}
        onOpenChange={(open) => {
          if (!open) setRevoking(null);
        }}
      >
        <OGDialogContent className="bg-surface-dialog text-text-primary">
          <OGDialogTitle>{localize('com_ui_tenant_api_revoke')}</OGDialogTitle>
          <p>{localize('com_ui_tenant_api_revoke_confirm')}</p>
          <p className="break-words font-medium">{revoking?.name}</p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setRevoking(null)}>
              {localize('com_ui_cancel')}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={revoke.isLoading}
              onClick={() => revoking && revoke.mutate(revoking.id)}
            >
              {localize('com_ui_tenant_api_revoke')}
            </Button>
          </div>
        </OGDialogContent>
      </OGDialog>
    </section>
  );
}
