import React, { useMemo, useState } from 'react';
import { SystemRoles } from 'librechat-data-provider';
import {
  Buildings as Building2,
  Check,
  Copy,
  Eye,
  EyeSlash as EyeOff,
  SpinnerGap as Loader2,
  UserPlus,
  X,
} from '@phosphor-icons/react';
import { useLocalize } from '~/hooks';
import { useCreateAdminUserMutation, useListAdminTenants } from '~/data-provider/admin';
import { AdminActionButton, AdminBadge, AdminIconButton } from '../common';

interface CreateUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  preselectedTenantId?: string;
}

const NEW_TENANT_VALUE = '__new__';
const DEFAULT_ROLE = SystemRoles.USER;

const inputClassName =
  'focus:ring-ring-primary/20 mt-1 w-full rounded-lg border border-border-light bg-surface-primary px-3 py-2.5 text-sm text-text-primary shadow-sm shadow-black/5 placeholder:text-text-tertiary focus:border-border-xheavy focus:outline-none focus:ring-2';

const selectClassName =
  'focus:ring-ring-primary/20 mt-1 w-full rounded-lg border border-border-light bg-surface-primary px-3 py-2.5 text-sm text-text-primary shadow-sm shadow-black/5 focus:border-border-xheavy focus:outline-none focus:ring-2';

const CreateUserModal: React.FC<CreateUserModalProps> = ({
  isOpen,
  onClose,
  preselectedTenantId,
}) => {
  const localize = useLocalize();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [tenantId, setTenantId] = useState(preselectedTenantId ?? '');
  const [newTenantName, setNewTenantName] = useState('');
  const [role, setRole] = useState(DEFAULT_ROLE);
  const [createdPassword, setCreatedPassword] = useState<string | null>(null);
  const [copiedPassword, setCopiedPassword] = useState(false);

  const createUser = useCreateAdminUserMutation();
  const { data: tenantsData } = useListAdminTenants();

  const tenants = tenantsData?.tenants ?? [];
  const isNewTenant = tenantId === NEW_TENANT_VALUE;
  const effectiveTenantId = isNewTenant ? newTenantName.trim() : tenantId;
  const isSubmitDisabled =
    createUser.isLoading ||
    !email.trim() ||
    !name.trim() ||
    !username.trim() ||
    !effectiveTenantId ||
    (isNewTenant && !newTenantName.trim());

  const selectedTenantLabel = useMemo(() => {
    if (effectiveTenantId) {
      return effectiveTenantId;
    }
    return 'None (no tenant)';
  }, [effectiveTenantId, localize]);

  const resetForm = () => {
    setEmail('');
    setName('');
    setUsername('');
    setPassword('');
    setTenantId(preselectedTenantId ?? '');
    setNewTenantName('');
    setRole(DEFAULT_ROLE);
    setCopiedPassword(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitDisabled) {
      return;
    }
    try {
      const result = await createUser.mutateAsync({
        email: email.trim(),
        name: name.trim(),
        username: username.trim(),
        password: password.trim() || undefined,
        tenantId: effectiveTenantId || undefined,
        role,
      });
      setCreatedPassword(result.password ?? null);
      resetForm();
    } catch {
      // error handled by mutation
    }
  };

  const handleClose = () => {
    setCreatedPassword(null);
    resetForm();
    onClose();
  };

  const handleCopyPassword = async () => {
    if (!createdPassword) {
      return;
    }
    await navigator.clipboard.writeText(createdPassword);
    setCopiedPassword(true);
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 py-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-user-title"
        className="w-full max-w-2xl overflow-hidden rounded-2xl border border-border-medium bg-surface-dialog shadow-2xl shadow-black/25"
      >
        <div className="border-b border-border-light bg-surface-secondary px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex size-10 items-center justify-center rounded-xl bg-surface-tertiary text-text-primary">
                <UserPlus className="size-5" />
              </div>
              <div>
                <h2 id="create-user-title" className="text-xl font-semibold text-text-primary">
                  {localize('com_admin_create_user')}
                </h2>
                <p className="mt-1 max-w-[54ch] text-sm leading-6 text-text-secondary">
                  {localize('com_admin_create_user_description')}
                </p>
              </div>
            </div>
            <AdminIconButton label={localize('com_ui_cancel')} onClick={handleClose}>
              <X className="size-5" />
            </AdminIconButton>
          </div>
        </div>

        {createdPassword ? (
          <div className="space-y-5 px-6 py-6">
            <div className="rounded-xl border border-green-500/20 bg-green-500/10 p-4">
              <div className="flex items-start gap-3">
                <div className="flex size-9 items-center justify-center rounded-lg bg-green-500/15 text-green-700 dark:text-green-300">
                  <Check className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold text-text-primary">
                    {localize('com_admin_user_created')}
                  </h3>
                  <p className="mt-1 text-sm leading-6 text-text-secondary">
                    {localize('com_admin_user_created_description')}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <AdminBadge>{selectedTenantLabel}</AdminBadge>
                    <AdminBadge>{role}</AdminBadge>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between gap-3">
                <label className="text-sm font-medium text-text-secondary">
                  {localize('com_admin_generated_password')}
                </label>
                <AdminIconButton
                  label={localize('com_admin_copy_generated_password')}
                  onClick={handleCopyPassword}
                >
                  {copiedPassword ? <Check className="size-4" /> : <Copy className="size-4" />}
                </AdminIconButton>
              </div>
              <code className="block overflow-x-auto rounded-lg border border-border-light bg-surface-primary px-3 py-3 font-mono text-sm text-text-primary">
                {createdPassword}
              </code>
            </div>

            <div className="flex justify-end">
              <AdminActionButton onClick={handleClose}>
                {localize('com_admin_done')}
              </AdminActionButton>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5 px-6 py-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="text-sm font-medium text-text-secondary">
                  {localize('com_admin_email_required')}
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={localize('com_admin_email_placeholder')}
                  className={inputClassName}
                  required
                />
              </div>

              <div>
                <label className="text-sm font-medium text-text-secondary">
                  {localize('com_admin_name_required')}
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={localize('com_admin_full_name_placeholder')}
                  className={inputClassName}
                  required
                />
              </div>

              <div>
                <label className="text-sm font-medium text-text-secondary">
                  {localize('com_admin_username_required')}
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={localize('com_admin_username_placeholder')}
                  className={inputClassName}
                  required
                />
              </div>
            </div>

            <div className="rounded-xl border border-border-light bg-surface-secondary p-4">
              <div className="flex items-start gap-3">
                <Building2 className="mt-1 size-4 shrink-0 text-text-secondary" />
                <div className="grid flex-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-sm font-medium text-text-secondary">
                      {localize('com_admin_tenant')}
                    </label>
                    <select
                      value={tenantId}
                      onChange={(e) => {
                        setTenantId(e.target.value);
                        setNewTenantName('');
                      }}
                      className={selectClassName}
                      disabled={preselectedTenantId != null}
                      required
                    >
                      <option value="" disabled>
                        {localize('com_admin_select_tenant')}
                      </option>
                      {tenants.map((tenant) => (
                        <option key={tenant.id} value={tenant.id}>
                          {tenant.id}
                        </option>
                      ))}
                      <option value={NEW_TENANT_VALUE}>
                        {localize('com_admin_create_new_tenant')}
                      </option>
                    </select>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-text-secondary">
                      {localize('com_admin_role')}
                    </label>
                    <select
                      value={role}
                      onChange={(e) => setRole(e.target.value as SystemRoles)}
                      className={selectClassName}
                    >
                      <option value={SystemRoles.USER}>{localize('com_admin_role_user')}</option>
                      <option value={SystemRoles.OWNER}>{localize('com_admin_role_owner')}</option>
                      <option value={SystemRoles.AD_MANAGER}>
                        {localize('com_admin_role_ad_manager')}
                      </option>
                      <option value={SystemRoles.ADMIN}>{localize('com_admin_role_admin')}</option>
                    </select>
                  </div>

                  {isNewTenant && (
                    <div className="sm:col-span-2">
                      <label className="text-sm font-medium text-text-secondary">
                        {localize('com_admin_new_tenant_name')}
                      </label>
                      <input
                        type="text"
                        value={newTenantName}
                        onChange={(e) => setNewTenantName(e.target.value)}
                        placeholder={localize('com_admin_new_tenant_placeholder')}
                        className={inputClassName}
                        required
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-text-secondary">
                {localize('com_admin_password')}
              </label>
              <div className="relative mt-1">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={localize('com_admin_auto_generate_password_placeholder')}
                  className={inputClassName + ' pr-10'}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              <p className="mt-2 text-xs leading-5 text-text-tertiary">
                {localize('com_admin_password_hint')}
              </p>
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-border-light pt-5 sm:flex-row sm:justify-end">
              <AdminActionButton variant="ghost" onClick={handleClose}>
                {localize('com_ui_cancel')}
              </AdminActionButton>
              <AdminActionButton
                type="submit"
                disabled={isSubmitDisabled}
                icon={createUser.isLoading ? <Loader2 className="size-4 animate-spin" /> : null}
              >
                {localize('com_ui_create')}
              </AdminActionButton>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default CreateUserModal;
