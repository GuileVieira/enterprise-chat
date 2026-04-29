import React from 'react';
import { Shield, Users, Check } from 'lucide-react';

// Placeholder data - will be replaced with real API data
const placeholderRoles = [
  {
    name: 'ADMIN',
    description: 'Full system access',
    permissions: ['agents', 'prompts', 'memories', 'file_search', 'web_search'],
  },
  {
    name: 'USER',
    description: 'Standard user access',
    permissions: ['agents', 'prompts', 'memories'],
  },
];

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
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Roles</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Manage roles and their permissions.
        </p>
      </div>

      <div className="space-y-4">
        {placeholderRoles.map((role) => (
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
                <p className="text-sm text-text-secondary">{role.description}</p>
              </div>
            </div>

            <div className="mt-4">
              <h4 className="mb-3 text-sm font-medium text-text-secondary">Permissions</h4>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {allPermissions.map((perm) => {
                  const hasPermission = role.permissions.includes(perm.key);
                  return (
                    <div
                      key={perm.key}
                      className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                        hasPermission
                          ? 'border-border-medium bg-surface-tertiary text-text-primary'
                          : 'border-border-light bg-surface-primary text-text-secondary'
                      }`}
                    >
                      {hasPermission && <Check className="h-3.5 w-3.5 text-green-500" />}
                      <span>{perm.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default RolesPage;
