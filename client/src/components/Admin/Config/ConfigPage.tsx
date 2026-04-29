import React, { useState } from 'react';
import { AlertCircle, Settings, ToggleLeft, ToggleRight, Trash2 } from 'lucide-react';
import { useLocalize } from '~/hooks';
import {
  useListAdminConfigs,
  useGetAdminConfigBase,
  useToggleAdminConfigMutation,
  useDeleteAdminConfigMutation,
} from '~/data-provider/admin';
import {
  AdminBadge,
  AdminPanel,
  AdminSkeleton,
  AdminIconButton,
  AdminEmptyState,
  AdminConfirmDialog,
  AdminPageHeader,
} from '../common';

interface PrincipalLabel {
  type: string;
  id: string;
  userLabel: string;
  roleLabel: string;
  groupLabel: string;
}

interface PendingConfigDelete {
  principalType: string;
  principalId: string;
}

const principalLabel = ({ type, id, userLabel, roleLabel, groupLabel }: PrincipalLabel) => {
  const labels: Record<string, string> = {
    user: userLabel,
    role: roleLabel,
    group: groupLabel,
  };
  return `${labels[type] ?? type}: ${id}`;
};

const formatConfigValue = (value: unknown) => {
  if (value === null || value === undefined) {
    return 'null';
  }

  if (typeof value === 'object') {
    return JSON.stringify(value);
  }

  return String(value);
};

const ConfigPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'base' | 'overrides'>('overrides');
  const [pendingDelete, setPendingDelete] = useState<PendingConfigDelete | null>(null);
  const localize = useLocalize();

  const { data: configsData, isLoading: configsLoading } = useListAdminConfigs();
  const { data: baseData, isLoading: baseLoading } = useGetAdminConfigBase();
  const toggleConfig = useToggleAdminConfigMutation();
  const deleteConfig = useDeleteAdminConfigMutation();

  const configs = configsData?.configs ?? [];
  const baseConfig = baseData?.config ?? {};

  const handleToggle = async (cfg: {
    principalType: string;
    principalId: string;
    isActive: boolean;
  }) => {
    await toggleConfig.mutateAsync({
      principalType: cfg.principalType,
      principalId: cfg.principalId,
      isActive: !cfg.isActive,
    });
  };

  const handleDelete = async () => {
    if (pendingDelete == null) {
      return;
    }
    await deleteConfig.mutateAsync(pendingDelete);
    setPendingDelete(null);
  };

  const baseConfigEntries = Object.entries(baseConfig).filter(
    ([key]) => !key.startsWith('_') && key !== 'endpoints',
  );

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title={localize('com_admin_configuration')}
        description={localize('com_admin_config_page_description')}
      />

      <div className="inline-flex rounded-lg border border-border-light bg-surface-secondary p-1">
        <button
          onClick={() => setActiveTab('overrides')}
          className={`rounded-md px-3 py-2 text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-primary ${
            activeTab === 'overrides'
              ? 'bg-surface-primary text-text-primary shadow-sm shadow-black/5'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          {localize('com_admin_overrides_count', { count: configs.length })}
        </button>
        <button
          onClick={() => setActiveTab('base')}
          className={`rounded-md px-3 py-2 text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-primary ${
            activeTab === 'base'
              ? 'bg-surface-primary text-text-primary shadow-sm shadow-black/5'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          {localize('com_admin_base_config')}
        </button>
      </div>

      {activeTab === 'overrides' && (
        <div className="space-y-4">
          {configsLoading && (
            <AdminPanel className="p-4">
              <AdminSkeleton rows={6} />
            </AdminPanel>
          )}

          {!configsLoading && configs.length === 0 && (
            <AdminEmptyState
              icon={<Settings className="h-6 w-6" />}
              title={localize('com_admin_no_config_overrides_found')}
              description={localize('com_admin_no_config_overrides_description')}
            />
          )}

          {!configsLoading && configs.length > 0 && (
            <AdminPanel>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[860px] text-left text-sm">
                  <thead>
                    <tr className="bg-surface-primary/40 border-b border-border-light">
                      <th className="px-6 py-3 font-medium text-text-secondary">
                        {localize('com_admin_principal')}
                      </th>
                      <th className="px-6 py-3 font-medium text-text-secondary">
                        {localize('com_admin_type')}
                      </th>
                      <th className="px-6 py-3 font-medium text-text-secondary">
                        {localize('com_admin_priority')}
                      </th>
                      <th className="px-6 py-3 font-medium text-text-secondary">
                        {localize('com_admin_overrides')}
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
                    {configs.map((cfg) => {
                      const overrideKeys = Object.keys(cfg.overrides ?? {});
                      return (
                        <tr
                          key={cfg._id}
                          className="border-b border-border-light transition-colors hover:bg-surface-tertiary"
                        >
                          <td className="max-w-xs truncate px-6 py-4 font-medium text-text-primary">
                            {principalLabel({
                              type: cfg.principalType,
                              id: cfg.principalId,
                              userLabel: localize('com_admin_user'),
                              roleLabel: localize('com_admin_role'),
                              groupLabel: localize('com_admin_group'),
                            })}
                          </td>
                          <td className="px-6 py-4 text-text-secondary">
                            <AdminBadge>{cfg.principalType}</AdminBadge>
                          </td>
                          <td className="px-6 py-4 text-text-secondary">{cfg.priority}</td>
                          <td className="px-6 py-4 text-text-secondary">
                            {overrideKeys.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {overrideKeys.slice(0, 3).map((key) => (
                                  <AdminBadge key={key}>{key}</AdminBadge>
                                ))}
                                {overrideKeys.length > 3 && (
                                  <AdminBadge>+{overrideKeys.length - 3}</AdminBadge>
                                )}
                              </div>
                            ) : (
                              <span className="text-xs text-text-secondary">
                                {localize('com_admin_none')}
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <AdminIconButton
                              onClick={() => handleToggle(cfg)}
                              disabled={toggleConfig.isLoading}
                              label={
                                cfg.isActive
                                  ? localize('com_admin_deactivate')
                                  : localize('com_admin_activate')
                              }
                            >
                              {cfg.isActive ? (
                                <ToggleRight className="h-6 w-6 text-green-500" />
                              ) : (
                                <ToggleLeft className="h-6 w-6 text-text-secondary" />
                              )}
                            </AdminIconButton>
                          </td>
                          <td className="px-6 py-4">
                            <AdminIconButton
                              onClick={() =>
                                setPendingDelete({
                                  principalType: cfg.principalType,
                                  principalId: cfg.principalId,
                                })
                              }
                              disabled={deleteConfig.isLoading}
                              label={localize('com_admin_delete_override')}
                              tone="danger"
                            >
                              <Trash2 className="h-4 w-4" />
                            </AdminIconButton>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </AdminPanel>
          )}
        </div>
      )}

      {activeTab === 'base' && (
        <div className="space-y-4">
          {baseLoading && (
            <AdminPanel className="p-4">
              <AdminSkeleton rows={6} />
            </AdminPanel>
          )}

          {!baseLoading && (
            <AdminPanel className="p-5">
              <div className="mb-5 flex items-start gap-2 rounded-lg bg-surface-tertiary p-3">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-text-secondary" />
                <p className="text-sm leading-6 text-text-secondary">
                  {localize('com_admin_base_config_readonly')}{' '}
                  <code className="rounded bg-surface-primary px-1.5 py-0.5 text-xs">
                    {localize('com_admin_config_file_name')}
                  </code>
                </p>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {baseConfigEntries.map(([key, value]) => (
                  <div
                    key={key}
                    className="rounded-lg border border-border-light bg-surface-primary p-4 shadow-sm shadow-black/5"
                  >
                    <h4 className="text-xs font-semibold uppercase tracking-[0.16em] text-text-tertiary">
                      {key}
                    </h4>
                    <div className="mt-2 text-sm text-text-primary">
                      {typeof value === 'boolean' ? (
                        <AdminBadge tone={value ? 'success' : 'danger'}>
                          {value ? localize('com_admin_enabled') : localize('com_admin_disabled')}
                        </AdminBadge>
                      ) : (
                        <span className="line-clamp-3 break-all leading-6 text-text-secondary">
                          {formatConfigValue(value)}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </AdminPanel>
          )}
        </div>
      )}

      <AdminConfirmDialog
        isOpen={pendingDelete != null}
        title={localize('com_admin_delete_override')}
        description={localize('com_admin_delete_override_confirm')}
        confirmLabel={localize('com_ui_delete')}
        cancelLabel={localize('com_ui_cancel')}
        isLoading={deleteConfig.isLoading}
        onCancel={() => setPendingDelete(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
};

export default ConfigPage;
