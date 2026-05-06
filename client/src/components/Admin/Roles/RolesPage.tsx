import React from 'react';
import { Check, Shield } from '@phosphor-icons/react';
import { useLocalize } from '~/hooks';
import { useListRoles } from '~/data-provider/roles';
import type { TranslationKeys } from '~/hooks';
import { AdminBadge, AdminPanel, AdminSkeleton, AdminEmptyState, AdminPageHeader } from '../common';

const allPermissions: Array<{ key: string; labelKey: TranslationKeys }> = [
  { key: 'agents', labelKey: 'com_admin_permission_agents' },
  { key: 'prompts', labelKey: 'com_admin_permission_prompts' },
  { key: 'memories', labelKey: 'com_admin_permission_memories' },
  { key: 'file_search', labelKey: 'com_admin_permission_file_search' },
  { key: 'web_search', labelKey: 'com_admin_permission_web_search' },
  { key: 'mcp_servers', labelKey: 'com_admin_permission_mcp_servers' },
  { key: 'marketplace', labelKey: 'com_admin_permission_marketplace' },
  { key: 'code_execution', labelKey: 'com_admin_permission_code_execution' },
];

const RolesPage: React.FC = () => {
  const { data, isLoading } = useListRoles();
  const localize = useLocalize();
  const roles = data?.roles ?? [];

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title={localize('com_admin_roles')}
        description={localize('com_admin_roles_page_description')}
      />

      {isLoading && (
        <AdminPanel className="p-4">
          <AdminSkeleton rows={4} />
        </AdminPanel>
      )}

      {!isLoading && roles.length > 0 && (
        <div className="space-y-4">
          {roles.map((role) => (
            <AdminPanel key={role.name} className="p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-tertiary">
                    <Shield className="h-5 w-5 text-text-primary" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-text-primary">{role.name}</h3>
                    <p className="text-sm text-text-secondary">
                      {role.description ?? localize('com_admin_no_description')}
                    </p>
                  </div>
                </div>
                <AdminBadge tone="accent">
                  {localize('com_admin_permissions_count', { count: allPermissions.length })}
                </AdminBadge>
              </div>

              <div className="mt-4">
                <h4 className="mb-3 text-sm font-medium text-text-secondary">
                  {localize('com_admin_permissions')}
                </h4>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {allPermissions.map((perm) => (
                    <div
                      key={perm.key}
                      className="flex items-center gap-2 rounded-lg border border-border-light bg-surface-primary px-3 py-2 text-sm text-text-secondary shadow-sm shadow-black/5"
                    >
                      <Check className="h-3.5 w-3.5 text-green-500" />
                      <span>{localize(perm.labelKey)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </AdminPanel>
          ))}
        </div>
      )}

      {!isLoading && roles.length === 0 && (
        <AdminEmptyState
          icon={<Shield className="h-6 w-6" />}
          title={localize('com_admin_no_roles_found')}
          description={localize('com_admin_no_roles_found_description')}
        />
      )}
    </div>
  );
};

export default RolesPage;
