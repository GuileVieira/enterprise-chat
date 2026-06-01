import React, { useEffect, useState } from 'react';
import {
  CaretDown as ChevronDown,
  Eye,
  EyeSlash as EyeOff,
  Key,
  Keyhole as KeyRound,
  SpinnerGap as Loader2,
  Plus,
  Trash as Trash2,
  X,
} from '@phosphor-icons/react';
import { useLocalize } from '~/hooks';
import {
  useListAdminSecrets,
  useListAdminTenants,
  useCreateAdminSecretMutation,
  useDeleteAdminSecretMutation,
} from '~/data-provider/admin';
import type { TenantSecret } from 'librechat-data-provider';
import {
  AdminBadge,
  AdminPanel,
  AdminSkeleton,
  AdminIconButton,
  AdminEmptyState,
  AdminActionButton,
  AdminConfirmDialog,
  AdminPageHeader,
} from '../common';

type SecretType = TenantSecret['type'];

interface PendingDelete {
  name: string;
}

const SECRET_TYPES: SecretType[] = ['bearer', 'basic', 'api_key', 'custom', 'meta_access_token'];
const META_ACCESS_TOKEN_SECRET_NAME = 'meta_graph_access_token';
const META_ACCESS_TOKEN_SECRET_TYPE: SecretType = 'meta_access_token';
const SECRET_TYPE_LABELS: Record<SecretType, string> = {
  bearer: 'Bearer',
  basic: 'Basic',
  api_key: 'API Key',
  custom: 'Custom',
  meta_access_token: 'Meta Access Token',
};

const SecretsPage: React.FC = () => {
  const localize = useLocalize();
  const [tenantId, setTenantId] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [secretName, setSecretName] = useState('');
  const [secretValue, setSecretValue] = useState('');
  const [secretType, setSecretType] = useState<SecretType>('bearer');
  const [isSecretFormEditable, setIsSecretFormEditable] = useState(false);
  const [showSecretValue, setShowSecretValue] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);

  const { data, isLoading } = useListAdminSecrets(tenantId);
  const { data: tenantsData } = useListAdminTenants();
  const createSecret = useCreateAdminSecretMutation();
  const deleteSecret = useDeleteAdminSecretMutation();

  const secrets = data?.secrets ?? [];
  const tenants = tenantsData?.tenants ?? [];

  const typeCount = new Set(secrets.map((secret) => secret.type)).size;
  const isMetaAccessToken = secretType === META_ACCESS_TOKEN_SECRET_TYPE;

  const resetForm = () => {
    setSecretName('');
    setSecretValue('');
    setSecretType('bearer');
    setIsSecretFormEditable(false);
    setShowSecretValue(false);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    resetForm();
  };

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const name = isMetaAccessToken ? META_ACCESS_TOKEN_SECRET_NAME : secretName.trim();
    if (!tenantId || !name || !secretValue.trim()) {
      return;
    }
    await createSecret.mutateAsync({
      tenantId,
      type: secretType,
      name,
      value: secretValue.trim(),
    });
    closeModal();
  };

  const handleSecretTypeChange = (type: SecretType) => {
    setSecretType(type);
    if (type === META_ACCESS_TOKEN_SECRET_TYPE) {
      setSecretName(META_ACCESS_TOKEN_SECRET_NAME);
      setIsSecretFormEditable(true);
    } else if (secretName === META_ACCESS_TOKEN_SECRET_NAME) {
      setSecretName('');
    }
  };

  useEffect(() => {
    if (isMetaAccessToken && secretName !== META_ACCESS_TOKEN_SECRET_NAME) {
      setSecretName(META_ACCESS_TOKEN_SECRET_NAME);
    }
  }, [isMetaAccessToken, secretName]);

  const handleDelete = async () => {
    if (pendingDelete == null || !tenantId) {
      return;
    }
    await deleteSecret.mutateAsync({ name: pendingDelete.name, tenantId });
    setPendingDelete(null);
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title={localize('com_admin_secrets')}
        description={localize('com_admin_secrets_description')}
        action={
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative w-full sm:w-72">
              <select
                value={tenantId}
                onChange={(e) => setTenantId(e.target.value)}
                aria-label={localize('com_admin_select_tenant')}
                className="focus:ring-ring-primary/20 h-10 w-full appearance-none rounded-lg border border-border-light bg-surface-secondary py-0 pl-3 pr-10 text-sm font-medium text-text-primary shadow-sm shadow-black/5 outline-none transition-colors hover:bg-surface-tertiary focus:border-border-xheavy focus:ring-2"
              >
                <option value="">{localize('com_admin_select_tenant')}</option>
                {tenants.map((tenant) => (
                  <option key={tenant.id} value={tenant.id}>
                    {tenant.id}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
            </div>
            <AdminActionButton
              icon={<Plus className="h-4 w-4" />}
              disabled={!tenantId}
              onClick={() => setIsModalOpen(true)}
            >
              {localize('com_admin_create_secret')}
            </AdminActionButton>
          </div>
        }
      />

      {tenantId && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <AdminPanel className="p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium text-text-secondary">
                {localize('com_admin_tenant')}
              </span>
              <Key className="h-4 w-4 text-text-tertiary" />
            </div>
            <p className="mt-2 truncate font-mono text-lg font-semibold text-text-primary">
              {tenantId}
            </p>
          </AdminPanel>
          <AdminPanel className="p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium text-text-secondary">
                {localize('com_admin_secrets')}
              </span>
              <KeyRound className="h-4 w-4 text-text-tertiary" />
            </div>
            <p className="mt-2 text-2xl font-semibold tabular-nums text-text-primary">
              {secrets.length}
            </p>
          </AdminPanel>
          <AdminPanel className="p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium text-text-secondary">
                {localize('com_admin_secret_types')}
              </span>
              <KeyRound className="h-4 w-4 text-text-tertiary" />
            </div>
            <p className="mt-2 text-2xl font-semibold tabular-nums text-text-primary">
              {typeCount}
            </p>
          </AdminPanel>
        </div>
      )}

      {tenantId && isLoading && (
        <AdminPanel className="p-4">
          <AdminSkeleton rows={6} />
        </AdminPanel>
      )}

      {tenantId && !isLoading && secrets.length === 0 && (
        <AdminEmptyState
          icon={<Key className="h-6 w-6" />}
          title={localize('com_admin_no_secrets_found')}
          description={localize('com_admin_no_secrets_found_description')}
        />
      )}

      {tenantId && !isLoading && secrets.length > 0 && (
        <AdminPanel>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="bg-surface-primary/40 border-b border-border-light">
                  <th className="px-6 py-3 font-medium text-text-secondary">
                    {localize('com_admin_name')}
                  </th>
                  <th className="px-6 py-3 font-medium text-text-secondary">
                    {localize('com_admin_type')}
                  </th>
                  <th className="px-6 py-3 font-medium text-text-secondary">
                    {localize('com_admin_actions')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {secrets.map((secret) => (
                  <tr
                    key={secret.name}
                    className="border-b border-border-light transition-colors hover:bg-surface-tertiary"
                  >
                    <td className="px-6 py-4">
                      <div className="font-mono text-sm font-semibold text-text-primary">
                        {secret.name}
                      </div>
                      <div className="mt-1 text-xs text-text-tertiary">
                        {localize('com_admin_secret_value_hidden')}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <AdminBadge tone="accent" className="uppercase">
                        {SECRET_TYPE_LABELS[secret.type]}
                      </AdminBadge>
                    </td>
                    <td className="px-6 py-4">
                      <AdminIconButton
                        label={localize('com_admin_delete_secret')}
                        tone="danger"
                        onClick={() => setPendingDelete({ name: secret.name })}
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
          title={localize('com_admin_select_tenant_title')}
          description={localize('com_admin_select_tenant_secrets_description')}
        />
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-create-secret-title"
            className="w-full max-w-lg rounded-xl border border-border-medium bg-surface-dialog p-5 shadow-xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2
                  id="admin-create-secret-title"
                  className="text-lg font-semibold text-text-primary"
                >
                  {localize('com_admin_create_secret')}
                </h2>
                <p className="mt-1 text-sm leading-6 text-text-secondary">
                  {localize('com_admin_create_secret_description')}
                </p>
              </div>
              <AdminIconButton label={localize('com_ui_close')} onClick={closeModal}>
                <X className="h-4 w-4" />
              </AdminIconButton>
            </div>
            <form autoComplete="off" onSubmit={handleCreate} className="mt-5 space-y-4">
              <div aria-hidden="true" className="hidden">
                <input tabIndex={-1} type="text" name="username" autoComplete="username" />
                <input
                  tabIndex={-1}
                  type="password"
                  name="password"
                  autoComplete="current-password"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary">
                  {localize('com_admin_name')}
                </label>
                <input
                  required
                  id="tenant-secret-name"
                  name="tenant-secret-name"
                  type="text"
                  autoCapitalize="off"
                  autoCorrect="off"
                  autoComplete="off"
                  data-1p-ignore="true"
                  data-lpignore="true"
                  readOnly={!isSecretFormEditable}
                  disabled={isMetaAccessToken}
                  spellCheck={false}
                  value={secretName}
                  onFocus={() => setIsSecretFormEditable(true)}
                  onChange={(e) => setSecretName(e.target.value)}
                  placeholder={localize('com_admin_secret_name_placeholder')}
                  className="focus:ring-ring-primary/20 mt-1 h-10 w-full rounded-lg border border-border-light bg-surface-primary px-3 text-sm text-text-primary placeholder:text-text-tertiary focus:border-border-xheavy focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-70"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary">
                  {localize('com_admin_type')}
                </label>
                <div className="relative mt-1">
                  <select
                    value={secretType}
                    onChange={(e) => handleSecretTypeChange(e.target.value as SecretType)}
                    className="focus:ring-ring-primary/20 h-10 w-full appearance-none rounded-lg border border-border-light bg-surface-primary py-0 pl-3 pr-10 text-sm text-text-primary outline-none transition-colors hover:bg-surface-secondary focus:border-border-xheavy focus:ring-2"
                  >
                    {SECRET_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {SECRET_TYPE_LABELS[type]}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary">
                  {localize('com_admin_secret_value')}
                </label>
                <div className="relative mt-1">
                  <input
                    required
                    id="tenant-secret-value"
                    name="tenant-secret-value"
                    type={showSecretValue ? 'text' : 'password'}
                    autoCapitalize="off"
                    autoCorrect="off"
                    autoComplete="new-password"
                    data-1p-ignore="true"
                    data-lpignore="true"
                    readOnly={!isSecretFormEditable}
                    spellCheck={false}
                    value={secretValue}
                    onFocus={() => setIsSecretFormEditable(true)}
                    onChange={(e) => setSecretValue(e.target.value)}
                    placeholder={localize('com_admin_secret_value_placeholder')}
                    className="focus:ring-ring-primary/20 h-10 w-full rounded-lg border border-border-light bg-surface-primary px-3 pr-10 text-sm text-text-primary placeholder:text-text-tertiary focus:border-border-xheavy focus:outline-none focus:ring-2"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSecretValue((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary"
                    tabIndex={-1}
                    aria-label={localize(
                      showSecretValue ? 'com_ui_hide_password' : 'com_ui_show_password',
                    )}
                  >
                    {showSecretValue ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <AdminActionButton variant="ghost" onClick={closeModal}>
                  {localize('com_ui_cancel')}
                </AdminActionButton>
                <AdminActionButton type="submit" disabled={createSecret.isLoading}>
                  {createSecret.isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                  {localize('com_admin_create_secret')}
                </AdminActionButton>
              </div>
            </form>
          </div>
        </div>
      )}

      <AdminConfirmDialog
        isOpen={pendingDelete != null}
        title={localize('com_admin_delete_secret')}
        description={localize('com_admin_delete_secret_confirm', {
          0: pendingDelete?.name ?? '',
        })}
        confirmLabel={localize('com_ui_delete')}
        cancelLabel={localize('com_ui_cancel')}
        isLoading={deleteSecret.isLoading}
        onCancel={() => setPendingDelete(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
};

export default SecretsPage;
