import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { dataService, QueryKeys, MutationKeys } from 'librechat-data-provider';
import {
  Button,
  Input,
  OGDialog,
  OGDialogTitle,
  OGDialogContent,
  useToastContext,
} from '@librechat/client';
import type { TAgentApiKeyListItem } from 'librechat-data-provider';
import { useLocalize } from '~/hooks';

export default function Keys({ tenantId }: { tenantId: string }) {
  const localize = useLocalize();
  const queryClient = useQueryClient();
  const { showToast } = useToastContext();
  const [name, setName] = useState('');
  const [secret, setSecret] = useState('');
  const [revoking, setRevoking] = useState<TAgentApiKeyListItem | null>(null);
  const queryKey = [QueryKeys.tenantApiKeys, tenantId];
  const keys = useQuery({
    queryKey,
    queryFn: () => dataService.getTenantApiKeys(tenantId),
    retry: false,
  });
  const reportError = () =>
    showToast({ status: 'error', message: localize('com_ui_tenant_api_key_error') });
  const create = useMutation({
    mutationKey: [MutationKeys.createTenantApiKey, tenantId],
    mutationFn: async () => {
      const result = await dataService.createTenantApiKey(tenantId, { name: name.trim() });
      // Keep the one-time secret out of the mutation cache and copied API examples.
      setSecret(result.key);
    },
    onSuccess: () => {
      setName('');
      void queryClient.invalidateQueries(queryKey);
    },
    onError: reportError,
  });
  const revoke = useMutation({
    mutationKey: [MutationKeys.deleteTenantApiKey, tenantId],
    mutationFn: (id: string) => dataService.deleteTenantApiKey(tenantId, id),
    onSuccess: () => {
      setRevoking(null);
      void queryClient.invalidateQueries(queryKey);
    },
    onError: reportError,
  });

  async function copySecret() {
    try {
      await navigator.clipboard.writeText(secret);
      showToast({ status: 'success', message: localize('com_ui_api_key_copied') });
    } catch {
      reportError();
    }
  }

  return (
    <section className="space-y-3">
      <p className="text-sm text-text-secondary">{localize('com_ui_tenant_api_principal')}</p>
      <label className="block space-y-1">
        <span>{localize('com_ui_api_key_name')}</span>
        <Input value={name} maxLength={100} onChange={(event) => setName(event.target.value)} />
      </label>
      <Button
        type="button"
        disabled={!name.trim() || create.isLoading || !!secret}
        onClick={() => create.mutate()}
      >
        {localize('com_ui_create_api_key')}
      </Button>
      {secret && (
        <div className="space-y-2 rounded border border-border-light p-3">
          <p>{localize('com_ui_api_key_warning')}</p>
          <Input
            type="password"
            readOnly
            value={secret}
            autoComplete="off"
            aria-label={localize('com_ui_your_api_key')}
          />
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={copySecret}>
              {localize('com_ui_tenant_api_copy_secret')}
            </Button>
            <Button type="button" variant="outline" onClick={() => setSecret('')}>
              {localize('com_ui_done')}
            </Button>
          </div>
        </div>
      )}
      {keys.isLoading && <p role="status">{localize('com_ui_loading')}</p>}
      {keys.isError && <p role="alert">{localize('com_ui_api_keys_load_error')}</p>}
      <ul className="space-y-2">
        {keys.data?.keys.map((key) => (
          <li
            key={key.id}
            className="flex items-center justify-between gap-2 rounded border border-border-light p-3"
          >
            <div className="min-w-0">
              <p className="break-words font-medium">{key.name}</p>
              <code>{key.keyPrefix}…</code>
            </div>
            <Button type="button" variant="outline" onClick={() => setRevoking(key)}>
              {localize('com_ui_tenant_api_revoke')}
            </Button>
          </li>
        ))}
      </ul>
      {!keys.isLoading && !keys.isError && !keys.data?.keys.length && (
        <p>{localize('com_ui_no_api_keys')}</p>
      )}
      <OGDialog
        open={!!revoking}
        onOpenChange={(open) => {
          if (!open) setRevoking(null);
        }}
      >
        <OGDialogContent>
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
