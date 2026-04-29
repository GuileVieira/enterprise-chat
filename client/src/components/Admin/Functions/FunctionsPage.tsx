import React, { useMemo, useState } from 'react';
import {
  KeyRound,
  Plus,
  Power,
  Wrench,
  Trash2,
  ChevronDown,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import { useLocalize } from '~/hooks';
import {
  useListAdminFunctions,
  useListAdminTenants,
  useToggleAdminFunctionMutation,
  useDeleteAdminFunctionMutation,
} from '~/data-provider/admin';
import type { TenantFunction } from 'librechat-data-provider';
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
import CreateFunctionModal from './CreateFunctionModal';

interface PendingDelete {
  id: string;
  name: string;
  tenantId: string;
}

const FunctionsPage: React.FC = () => {
  const localize = useLocalize();
  const [tenantId, setTenantId] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);

  const { data, isLoading } = useListAdminFunctions(tenantId);
  const { data: tenantsData } = useListAdminTenants();
  const toggleFn = useToggleAdminFunctionMutation();
  const deleteFn = useDeleteAdminFunctionMutation();

  const functions = data?.functions ?? [];
  const tenants = tenantsData?.tenants ?? [];
  const activeCount = functions.filter((fn) => fn.isActive).length;
  const authCount = functions.filter((fn) => fn.config.auth?.type != null).length;

  const selectedTenantLabel = useMemo(() => {
    if (!tenantId) {
      return localize('com_admin_no_tenant_selected');
    }
    return tenantId;
  }, [tenantId, localize]);

  const handleToggle = async (fn: TenantFunction) => {
    await toggleFn.mutateAsync({ id: fn.id, tenantId: fn.tenantId, isActive: !fn.isActive });
  };

  const handleDelete = async () => {
    if (pendingDelete == null) {
      return;
    }
    await deleteFn.mutateAsync({ id: pendingDelete.id, tenantId: pendingDelete.tenantId });
    setPendingDelete(null);
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title={localize('com_admin_functions')}
        description={localize('com_admin_functions_description')}
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
              onClick={() => setIsCreateModalOpen(true)}
            >
              {localize('com_admin_create_function')}
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
              <Wrench className="h-4 w-4 text-text-tertiary" />
            </div>
            <p className="mt-2 truncate font-mono text-lg font-semibold text-text-primary">
              {selectedTenantLabel}
            </p>
          </AdminPanel>
          <AdminPanel className="p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium text-text-secondary">
                {localize('com_admin_active')}
              </span>
              <Power className="h-4 w-4 text-text-tertiary" />
            </div>
            <p className="mt-2 text-2xl font-semibold tabular-nums text-text-primary">
              {activeCount}/{functions.length}
            </p>
          </AdminPanel>
          <AdminPanel className="p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium text-text-secondary">
                {localize('com_admin_function_auth')}
              </span>
              <KeyRound className="h-4 w-4 text-text-tertiary" />
            </div>
            <p className="mt-2 text-2xl font-semibold tabular-nums text-text-primary">
              {authCount}
            </p>
          </AdminPanel>
        </div>
      )}

      {tenantId && isLoading && (
        <AdminPanel className="p-4">
          <AdminSkeleton rows={6} />
        </AdminPanel>
      )}

      {tenantId && !isLoading && functions.length === 0 && (
        <AdminEmptyState
          icon={<Wrench className="h-6 w-6" />}
          title={localize('com_admin_no_functions_found')}
          description={localize('com_admin_no_functions_found_description')}
        />
      )}

      {tenantId && !isLoading && functions.length > 0 && (
        <AdminPanel>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead>
                <tr className="bg-surface-primary/40 border-b border-border-light">
                  <th className="px-6 py-3 font-medium text-text-secondary">
                    {localize('com_admin_function_id')}
                  </th>
                  <th className="px-6 py-3 font-medium text-text-secondary">
                    {localize('com_admin_name')}
                  </th>
                  <th className="px-6 py-3 font-medium text-text-secondary">
                    {localize('com_admin_function_route')}
                  </th>
                  <th className="px-6 py-3 font-medium text-text-secondary">
                    {localize('com_admin_function_auth')}
                  </th>
                  <th className="px-6 py-3 font-medium text-text-secondary">
                    {localize('com_admin_active')}
                  </th>
                  <th className="px-6 py-3 font-medium text-text-secondary">
                    {localize('com_admin_actions')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {functions.map((fn) => (
                  <tr
                    key={fn.id}
                    className="border-b border-border-light transition-colors hover:bg-surface-tertiary"
                  >
                    <td className="max-w-[14rem] truncate px-6 py-4 font-mono text-xs font-medium text-text-primary">
                      {fn.id}
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-text-primary">{fn.name}</div>
                      <div className="mt-1 max-w-md text-xs leading-5 text-text-tertiary">
                        {fn.description || localize('com_admin_no_description')}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-2">
                        <AdminBadge tone="accent">{fn.config.method}</AdminBadge>
                        <span className="max-w-xs truncate font-mono text-xs text-text-secondary">
                          {fn.config.path}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-text-secondary">
                      {fn.config.auth?.type ? (
                        <AdminBadge>{fn.config.auth.type}</AdminBadge>
                      ) : (
                        <span className="text-xs text-text-tertiary">
                          {localize('com_admin_none')}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <AdminIconButton
                        onClick={() => handleToggle(fn)}
                        disabled={toggleFn.isLoading}
                        label={
                          fn.isActive
                            ? localize('com_admin_deactivate_function')
                            : localize('com_admin_activate_function')
                        }
                      >
                        {fn.isActive ? (
                          <ToggleRight className="h-6 w-6 text-green-500" />
                        ) : (
                          <ToggleLeft className="h-6 w-6 text-text-secondary" />
                        )}
                      </AdminIconButton>
                    </td>
                    <td className="px-6 py-4">
                      <AdminIconButton
                        label={localize('com_admin_delete_function')}
                        tone="danger"
                        onClick={() =>
                          setPendingDelete({
                            id: fn.id,
                            name: fn.name,
                            tenantId: fn.tenantId,
                          })
                        }
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
          icon={<Wrench className="h-6 w-6" />}
          title={localize('com_admin_select_tenant_title')}
          description={localize('com_admin_select_tenant_description')}
        />
      )}

      <CreateFunctionModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        tenantId={tenantId}
      />

      <AdminConfirmDialog
        isOpen={pendingDelete != null}
        title={localize('com_admin_delete_function')}
        description={localize('com_admin_delete_function_confirm', {
          0: pendingDelete?.name ?? '',
        })}
        confirmLabel={localize('com_ui_delete')}
        cancelLabel={localize('com_ui_cancel')}
        isLoading={deleteFn.isLoading}
        onCancel={() => setPendingDelete(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
};

export default FunctionsPage;
