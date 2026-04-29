import React from 'react';
import { Shield, Check, Loader2 } from 'lucide-react';
import { useListRoles } from '~/data-provider/roles';

const allPermissions = [
  { key: 'agents', label: 'Agents' },
  { key: 'prompts', label: 'Prompts' },
  { key: 'memories', label: 'Memories' },
  { key: 'file_search', label: 'File Search' },
  { key: 'web_search', label: 'Web Search' },
  { key: 'mcp_servers', label: 'MCP Servers' },
  { key: 'marketplace', label: 'Marketplace' },
  { key: 'code_execution', label: 'Code Execution' },
];

const RolesPage: React.FC = () => {
  const { data, isLoading } = useListRoles();
  const roles = data?.roles ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Roles</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Manage roles and their permissions.
        </p>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-text-secondary" />
        </div>
      )}

      {!isLoading && (
        <div className="space-y-4">
          {roles.map((role) => (
            <div
              key={role.name}
              className="rounded-xl border border-border-medium bg-surface-secondary p-6"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-tertiary">
                  <Shield className="h-5 w-5 text-text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-text-primary">{role.name}</h3>
                  <p className="text-sm text-text-secondary">
                    {role.description ?? 'No description'}
                  </p>
                </div>
              </div>

              <div className="mt-4">
                <h4 className="mb-3 text-sm font-medium text-text-secondary">Permissions</h4>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {allPermissions.map((perm) => (
                    <div
                      key={perm.key}
                      className="flex items-center gap-2 rounded-lg border border-border-light bg-surface-primary px-3 py-2 text-sm text-text-secondary"
                    >
                      <Check className="h-3.5 w-3.5 text-green-500" />
                      <span>{perm.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default RolesPage;
