import React, { useState } from 'react';
import { ArrowRight, Building2, Plus, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useListAdminTenants } from '~/data-provider/admin';
import { useLocalize } from '~/hooks';
import {
  AdminPanel,
  AdminSkeleton,
  AdminEmptyState,
  AdminActionButton,
  AdminPageHeader,
} from '../common';
import CreateUserModal from '../Users/CreateUserModal';

const TenantsPage: React.FC = () => {
  const localize = useLocalize();
  const navigate = useNavigate();
  const { data, isLoading, isError } = useListAdminTenants();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const tenants = data?.tenants ?? [];

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title={localize('com_admin_tenants')}
        description={localize('com_admin_tenants_page_description')}
        action={
          <AdminActionButton
            icon={<Plus className="size-4" />}
            onClick={() => setIsCreateModalOpen(true)}
          >
            {localize('com_admin_create_user')}
          </AdminActionButton>
        }
      />

      {isLoading && (
        <AdminPanel className="p-4">
          <AdminSkeleton rows={5} />
        </AdminPanel>
      )}

      {isError && (
        <AdminEmptyState
          icon={<Building2 className="size-6" />}
          title={localize('com_admin_tenants_error_title')}
          description={localize('com_admin_tenants_error_description')}
        />
      )}

      {!isLoading && !isError && tenants.length === 0 && (
        <AdminEmptyState
          icon={<Building2 className="size-6" />}
          title={localize('com_admin_no_tenants_found')}
          description={localize('com_admin_no_tenants_found_description')}
        />
      )}

      {!isLoading && !isError && tenants.length > 0 && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {tenants.map((tenant) => (
            <button
              key={tenant.id}
              type="button"
              onClick={() => navigate(`/admin/tenants/${encodeURIComponent(tenant.id)}`)}
              className="flex min-h-32 items-center justify-between rounded-xl border border-border-medium bg-surface-secondary p-5 text-left shadow-sm shadow-black/5 transition-colors hover:bg-surface-tertiary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-primary"
            >
              <div className="flex min-w-0 items-center gap-4">
                <div className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-surface-tertiary">
                  <Building2 className="size-6 text-text-primary" />
                </div>
                <div className="min-w-0">
                  <h2 className="truncate font-mono text-base font-semibold text-text-primary">
                    {tenant.id}
                  </h2>
                  <div className="mt-2 flex items-center gap-1.5 text-sm text-text-secondary">
                    <Users className="size-3.5" />
                    <span>
                      {localize('com_admin_users_count', { 0: tenant.userCount.toString() })}
                    </span>
                  </div>
                </div>
              </div>
              <ArrowRight className="size-5 shrink-0 text-text-secondary" />
            </button>
          ))}
        </div>
      )}

      <CreateUserModal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} />
    </div>
  );
};

export default TenantsPage;
