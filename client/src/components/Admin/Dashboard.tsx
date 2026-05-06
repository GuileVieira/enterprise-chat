import React from 'react';
import {
  Key,
  Shield,
  Users,
  Wrench,
  Settings,
  Building2,
  UserCircle,
  AlertCircle,
  LayoutDashboard,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useGetAdminOverview } from '~/data-provider/admin';
import { useLocalize } from '~/hooks';
import {
  AdminBadge,
  AdminPanel,
  AdminSkeleton,
  AdminDataTable,
  AdminMetricCard,
  AdminPageHeader,
  AdminStatGrid,
  AdminEmptyState,
  AdminSectionHeader,
} from './common';
import type { AdminUser, TenantItem } from 'librechat-data-provider';

const numberFormat = new Intl.NumberFormat();

const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const localize = useLocalize();
  const { data, isLoading, isError } = useGetAdminOverview();

  const metrics = [
    {
      key: 'users',
      title: localize('com_admin_users'),
      value: data?.usersTotal ?? 0,
      icon: Users,
      description: localize('com_admin_users_description'),
      path: '/admin/users',
    },
    {
      key: 'tenants',
      title: localize('com_admin_tenants'),
      value: data?.tenantsTotal ?? 0,
      icon: Building2,
      description: localize('com_admin_tenants_description'),
      path: '/admin/tenants',
    },
    {
      key: 'roles',
      title: localize('com_admin_roles'),
      value: data?.rolesTotal ?? 0,
      icon: Shield,
      description: localize('com_admin_roles_description'),
      path: '/admin/roles',
    },
    {
      key: 'groups',
      title: localize('com_admin_groups'),
      value: data?.groupsTotal ?? 0,
      icon: UserCircle,
      description: localize('com_admin_groups_description'),
      path: '/admin/groups',
    },
    {
      key: 'functions',
      title: localize('com_admin_functions'),
      value: `${data?.activeFunctionsTotal ?? 0}/${data?.functionsTotal ?? 0}`,
      icon: Wrench,
      description: localize('com_admin_functions_description'),
      path: '/admin/functions',
    },
    {
      key: 'secrets',
      title: localize('com_admin_secrets'),
      value: data?.secretsTotal ?? 0,
      icon: Key,
      description: localize('com_admin_secrets_description'),
      path: '/admin/secrets',
    },
    {
      key: 'config',
      title: localize('com_admin_config'),
      value: `${data?.activeConfigOverridesTotal ?? 0}/${data?.configOverridesTotal ?? 0}`,
      icon: Settings,
      description: localize('com_admin_config_description'),
      path: '/admin/config',
    },
    {
      key: 'admins',
      title: localize('com_admin_super_admins'),
      value: data?.adminsTotal ?? 0,
      icon: Shield,
      description: localize('com_admin_super_admins_description'),
      path: '/admin/users',
    },
  ];

  return (
    <div className="space-y-8">
      <AdminPageHeader
        eyebrow={localize('com_admin_super_admin')}
        title={localize('com_admin_dashboard_title')}
        description={localize('com_admin_dashboard_description')}
      />

      {isLoading && <AdminSkeleton rows={6} />}

      {isError && (
        <AdminEmptyState
          icon={<AlertCircle className="size-6" />}
          title={localize('com_admin_overview_error_title')}
          description={localize('com_admin_overview_error_description')}
        />
      )}

      {!isLoading && !isError && (
        <>
          <AdminStatGrid>
            {metrics.map((metric) => (
              <AdminMetricCard
                key={metric.key}
                title={metric.title}
                value={
                  typeof metric.value === 'number' ? numberFormat.format(metric.value) : metric.value
                }
                icon={metric.icon}
                description={metric.description}
                onClick={() => navigate(metric.path)}
              />
            ))}
          </AdminStatGrid>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_22rem]">
            <div className="space-y-4">
              <AdminSectionHeader
                title={localize('com_admin_recent_users')}
                description={localize('com_admin_recent_users_description')}
              />
              {data?.recentUsers.length ? (
                <AdminDataTable<AdminUser>
                  items={data.recentUsers}
                  getRowKey={(user) => user._id}
                  columns={[
                    {
                      key: 'user',
                      header: localize('com_admin_user'),
                      render: (user) => (
                        <div>
                          <p className="font-medium text-text-primary">
                            {user.name || user.username || user.email}
                          </p>
                          <p className="mt-1 text-xs text-text-tertiary">{user.email}</p>
                        </div>
                      ),
                    },
                    {
                      key: 'tenant',
                      header: localize('com_admin_tenant'),
                      render: (user) => (
                        <span className="font-mono text-xs text-text-secondary">
                          {user.tenantId ?? localize('com_admin_default_tenant')}
                        </span>
                      ),
                    },
                    {
                      key: 'role',
                      header: localize('com_admin_role'),
                      render: (user) => (
                        <AdminBadge tone={user.role === 'ADMIN' ? 'accent' : 'neutral'}>
                          {user.role === 'ADMIN'
                            ? localize('com_admin_role_super_admin')
                            : user.role}
                        </AdminBadge>
                      ),
                    },
                  ]}
                />
              ) : (
                <AdminEmptyState
                  icon={<Users className="size-6" />}
                  title={localize('com_admin_no_users_found')}
                  description={localize('com_admin_no_users_found_description')}
                />
              )}
            </div>

            <div className="space-y-4">
              <AdminSectionHeader
                title={localize('com_admin_top_tenants')}
                description={localize('com_admin_top_tenants_description')}
              />
              <AdminPanel className="divide-y divide-border-light">
                {(data?.topTenants ?? []).map((tenant: TenantItem) => (
                  <button
                    key={tenant.id}
                    type="button"
                    onClick={() => navigate(`/admin/tenants/${encodeURIComponent(tenant.id)}`)}
                    className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-tertiary"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-mono text-sm font-semibold text-text-primary">
                        {tenant.id}
                      </p>
                      <p className="mt-1 text-xs text-text-tertiary">
                        {localize('com_admin_users_count', {
                          0: numberFormat.format(tenant.userCount),
                        })}
                      </p>
                    </div>
                    <Building2 className="size-4 shrink-0 text-text-tertiary" />
                  </button>
                ))}
                {data?.topTenants.length === 0 && (
                  <div className="p-4 text-sm text-text-secondary">
                    {localize('com_admin_no_tenants_found')}
                  </div>
                )}
              </AdminPanel>

              <AdminSectionHeader title={localize('com_admin_quick_actions')} />
              <AdminPanel className="grid grid-cols-1 gap-2 p-3">
                {[
                  { label: localize('com_admin_create_user'), path: '/admin/users' },
                  { label: localize('com_admin_manage_functions'), path: '/admin/functions' },
                  { label: localize('com_admin_manage_secrets'), path: '/admin/secrets' },
                  { label: localize('com_admin_review_config'), path: '/admin/config' },
                ].map((action) => (
                  <button
                    key={action.path}
                    type="button"
                    onClick={() => navigate(action.path)}
                    className="flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-tertiary hover:text-text-primary"
                  >
                    {action.label}
                    <LayoutDashboard className="size-4" />
                  </button>
                ))}
              </AdminPanel>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default AdminDashboard;
