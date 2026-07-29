import React, { useState } from 'react';
import {
  ArrowLeft,
  Robot as Bot,
  Key,
  ChatCircle as MessageSquare,
  Plus,
  Users,
  Wrench,
} from '@phosphor-icons/react';
import { useNavigate, useParams } from 'react-router-dom';
import { useGetAdminTenantStats, useGetAdminTenantUsers } from '~/data-provider/admin';
import { useLocalize } from '~/hooks';
import {
  AdminBadge,
  AdminPanel,
  AdminSkeleton,
  AdminDataTable,
  AdminMetricCard,
  AdminEmptyState,
  AdminActionButton,
  AdminPageHeader,
  AdminStatGrid,
} from '../common';
import CreateUserModal from '../Users/CreateUserModal';
import type { AdminUser } from 'librechat-data-provider';

const TenantDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const localize = useLocalize();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const tenantId = id ?? '';
  const {
    data: usersData,
    isLoading: usersLoading,
    isError: usersError,
  } = useGetAdminTenantUsers(tenantId, 1, 50);
  const {
    data: statsData,
    isLoading: statsLoading,
    isError: statsError,
  } = useGetAdminTenantStats(tenantId);

  const users = usersData?.users ?? [];
  const stats = statsData?.stats;
  const isLoading = usersLoading || statsLoading;
  const isError = usersError || statsError;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow={localize('com_admin_tenant')}
        title={tenantId}
        description={localize('com_admin_tenant_detail_description')}
        action={
          <div className="flex gap-2">
            <AdminActionButton
              variant="ghost"
              icon={<ArrowLeft className="size-4" />}
              onClick={() => navigate('/admin/tenants')}
            >
              {localize('com_admin_back_to_tenants')}
            </AdminActionButton>
            <AdminActionButton
              icon={<Plus className="size-4" />}
              onClick={() => setIsCreateModalOpen(true)}
            >
              {localize('com_admin_add_user')}
            </AdminActionButton>
          </div>
        }
      />

      {isLoading && (
        <AdminPanel className="p-4">
          <AdminSkeleton rows={6} />
        </AdminPanel>
      )}

      {isError && (
        <AdminEmptyState
          icon={<Users className="size-6" />}
          title={localize('com_admin_tenant_error_title')}
          description={localize('com_admin_tenant_error_description')}
        />
      )}

      {!isLoading && !isError && (
        <>
          <AdminStatGrid>
            <AdminMetricCard
              title={localize('com_admin_users')}
              value={stats?.users ?? 0}
              icon={Users}
            />
            <AdminMetricCard
              title={localize('com_admin_conversations')}
              value={stats?.conversations ?? 0}
              icon={MessageSquare}
            />
            <AdminMetricCard
              title={localize('com_admin_agents')}
              value={stats?.agents ?? 0}
              icon={Bot}
            />
            <AdminMetricCard
              title={localize('com_admin_functions')}
              value={stats?.functions ?? 0}
              icon={Wrench}
              onClick={() => navigate('/admin/functions')}
            />
            <AdminMetricCard
              title={localize('com_admin_secrets')}
              value={stats?.secrets ?? 0}
              icon={Key}
              onClick={() => navigate('/admin/secrets')}
            />
          </AdminStatGrid>

          {users.length === 0 ? (
            <AdminEmptyState
              icon={<Users className="size-6" />}
              title={localize('com_admin_no_users_found')}
              description={localize('com_admin_no_users_found_description')}
            />
          ) : (
            <AdminDataTable<AdminUser>
              items={users}
              getRowKey={(user) => user._id}
              columns={[
                {
                  key: 'name',
                  header: localize('com_admin_name'),
                  render: (user) => (
                    <span className="font-medium text-text-primary">
                      {user.name ?? user.username}
                    </span>
                  ),
                },
                {
                  key: 'email',
                  header: localize('com_admin_email'),
                  render: (user) => <span className="text-text-secondary">{user.email}</span>,
                },
                {
                  key: 'username',
                  header: localize('com_admin_username'),
                  render: (user) => <span className="text-text-secondary">{user.username}</span>,
                },
                {
                  key: 'role',
                  header: localize('com_admin_role'),
                  render: (user) => (
                    <AdminBadge tone={user.role === 'ADMIN' ? 'accent' : 'neutral'}>
                      {user.role === 'ADMIN' ? localize('com_admin_role_super_admin') : user.role}
                    </AdminBadge>
                  ),
                },
              ]}
            />
          )}
        </>
      )}

      <CreateUserModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        preselectedTenantId={tenantId}
      />
    </div>
  );
};

export default TenantDetailPage;
