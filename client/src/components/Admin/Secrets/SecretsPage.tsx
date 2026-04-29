import React, { useState } from 'react';
import { Key, Loader2, Trash2, Plus } from 'lucide-react';
import {
  useListAdminSecrets,
  useListAdminTenants,
  useCreateAdminSecretMutation,
  useDeleteAdminSecretMutation,
} from '~/data-provider/admin';
import {
  AdminPageHeader,
  AdminPanel,
  AdminSkeleton,
  AdminEmptyState,
  AdminBadge,
  AdminIconButton,
  AdminActionButton,
} from '../common';

const SecretsPage: React.FC = () => {
  const [tenantId, setTenantId] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [secretName, setSecretName] = useState('');
  const [secretValue, setSecretValue] = useState('');
  const [secretType, setSecretType] = useState('bearer');

  const { data, isLoading } = useListAdminSecrets(tenantId);
  const { data: tenantsData } = useListAdminTenants();
  const createSecret = useCreateAdminSecretMutation();
  const deleteSecret = useDeleteAdminSecretMutation();

  const secrets = data?.secrets ?? [];
  const tenants = tenantsData?.tenants ?? [];

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId || !secretName.trim() || !secretValue.trim()) return;
    await createSecret.mutateAsync({
      tenantId,
      name: secretName.trim(),
      value: secretValue.trim(),
      type: secretType,
    });
    setSecretName('');
    setSecretValue('');
    setIsModalOpen(false);
  };

  const handleDelete = async (name: string) => {
    if (!tenantId || !window.confirm(`Delete secret "${name}"?`)) return;
    await deleteSecret.mutateAsync({ name, tenantId });
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Secrets"
        description="Manage encrypted secrets for tenant function authentication."
        action={
          <div className="flex items-center gap-3">
            <select
              value={tenantId}
              onChange={(e) => setTenantId(e.target.value)}
              className="rounded-lg border border-border-light bg-surface-secondary px-3 py-2 text-sm text-text-primary focus:border-border-xheavy focus:outline-none"
            >
              <option value="">Select tenant...</option>
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>{t.id}</option>
              ))}
            </select>
            <AdminActionButton
              icon={<Plus className="h-4 w-4" />}
              disabled={!tenantId}
              onClick={() => setIsModalOpen(true)}
            >
              Create Secret
            </AdminActionButton>
          </div>
        }
      />

      {tenantId && isLoading && (
        <AdminPanel className="p-4">
          <AdminSkeleton rows={6} />
        </AdminPanel>
      )}

      {tenantId && !isLoading && secrets.length === 0 && (
        <AdminEmptyState
          icon={<Key className="h-6 w-6" />}
          title="No secrets found"
          description="This tenant has no secrets yet."
        />
      )}

      {tenantId && !isLoading && secrets.length > 0 && (
        <AdminPanel>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[500px] text-left text-sm">
              <thead>
                <tr className="bg-surface-primary/40 border-b border-border-light">
                  <th className="px-6 py-3 font-medium text-text-secondary">Name</th>
                  <th className="px-6 py-3 font-medium text-text-secondary">Type</th>
                  <th className="px-6 py-3 font-medium text-text-secondary">Actions</th>
                </tr>
              </thead>
              <tbody>
                {secrets.map((secret) => (
                  <tr
                    key={secret.name}
                    className="border-b border-border-light transition-colors hover:bg-surface-tertiary"
                  >
                    <td className="px-6 py-4 font-medium text-text-primary">{secret.name}</td>
                    <td className="px-6 py-4">
                      <AdminBadge tone="accent" className="uppercase">{secret.type}</AdminBadge>
                    </td>
                    <td className="px-6 py-4">
                      <AdminIconButton
                        label="Delete secret"
                        tone="danger"
                        onClick={() => handleDelete(secret.name)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </AdminIconButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </AdminPanel>
      )}

      {!tenantId && (
        <AdminEmptyState
          icon={<Key className="h-6 w-6" />}
          title="Select a tenant"
          description="Choose a tenant from the dropdown above to view its secrets."
        />
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-md rounded-xl border border-border-medium bg-surface-dialog p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-text-primary">Create Secret</h2>
              <AdminIconButton label="Close" onClick={() => setIsModalOpen(false)}>
                <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </AdminIconButton>
            </div>
            <form onSubmit={handleCreate} className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary">Name</label>
                <input
                  type="text"
                  value={secretName}
                  onChange={(e) => setSecretName(e.target.value)}
                  placeholder="e.g., meta-ads-token"
                  className="mt-1 w-full rounded-lg border border-border-light bg-surface-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:border-border-xheavy focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary">Type</label>
                <select
                  value={secretType}
                  onChange={(e) => setSecretType(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border-light bg-surface-primary px-3 py-2 text-sm text-text-primary focus:border-border-xheavy focus:outline-none"
                >
                  <option value="bearer">Bearer</option>
                  <option value="basic">Basic</option>
                  <option value="api_key">API Key</option>
                  <option value="custom">Custom</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary">Value</label>
                <input
                  type="text"
                  value={secretValue}
                  onChange={(e) => setSecretValue(e.target.value)}
                  placeholder="Secret value"
                  className="mt-1 w-full rounded-lg border border-border-light bg-surface-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:border-border-xheavy focus:outline-none"
                  required
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <AdminActionButton variant="ghost" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </AdminActionButton>
                <AdminActionButton
                  type="submit"
                  disabled={createSecret.isLoading}
                >
                  {createSecret.isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                  Create
                </AdminActionButton>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SecretsPage;
