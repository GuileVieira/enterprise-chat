import React, { useState } from 'react';
import { Settings, Loader2, ToggleLeft, ToggleRight, Trash2, AlertCircle } from 'lucide-react';
import {
  useListAdminConfigs,
  useGetAdminConfigBase,
  useToggleAdminConfigMutation,
  useDeleteAdminConfigMutation,
} from '~/data-provider/admin';

const principalLabel = (type: string, id: string) => {
  const labels: Record<string, string> = {
    user: 'User',
    group: 'Group',
    role: 'Role',
  };
  return `${labels[type] ?? type}: ${id}`;
};

const ConfigPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'base' | 'overrides'>('overrides');

  const { data: configsData, isLoading: configsLoading } = useListAdminConfigs();
  const { data: baseData, isLoading: baseLoading } = useGetAdminConfigBase();
  const toggleConfig = useToggleAdminConfigMutation();
  const deleteConfig = useDeleteAdminConfigMutation();

  const configs = configsData?.configs ?? [];
  const baseConfig = baseData?.config ?? {};

  const handleToggle = async (cfg: { principalType: string; principalId: string; isActive: boolean }) => {
    await toggleConfig.mutateAsync({
      principalType: cfg.principalType,
      principalId: cfg.principalId,
      isActive: !cfg.isActive,
    });
  };

  const handleDelete = async (principalType: string, principalId: string) => {
    if (!window.confirm('Are you sure you want to delete this config override?')) {
      return;
    }
    await deleteConfig.mutateAsync({ principalType, principalId });
  };

  const baseConfigEntries = Object.entries(baseConfig).filter(
    ([key]) => !key.startsWith('_') && key !== 'endpoints',
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Configuration</h1>
        <p className="mt-1 text-sm text-text-secondary">
          View base configuration and manage active overrides.
        </p>
      </div>

      <div className="flex gap-4 border-b border-border-medium">
        <button
          onClick={() => setActiveTab('overrides')}
          className={`pb-2 text-sm font-medium transition-colors ${
            activeTab === 'overrides'
              ? 'border-b-2 border-text-primary text-text-primary'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          Overrides ({configs.length})
        </button>
        <button
          onClick={() => setActiveTab('base')}
          className={`pb-2 text-sm font-medium transition-colors ${
            activeTab === 'base'
              ? 'border-b-2 border-text-primary text-text-primary'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          Base Config
        </button>
      </div>

      {activeTab === 'overrides' && (
        <div className="space-y-4">
          {configsLoading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-text-secondary" />
            </div>
          )}

          {!configsLoading && configs.length === 0 && (
            <div className="rounded-xl border border-border-medium bg-surface-secondary py-12 text-center">
              <Settings className="mx-auto h-12 w-12 text-text-secondary" />
              <p className="mt-4 text-text-secondary">No config overrides found.</p>
              <p className="mt-1 text-xs text-text-secondary">
                Overrides are managed via the API or CLI.
              </p>
            </div>
          )}

          {!configsLoading && configs.length > 0 && (
            <div className="rounded-xl border border-border-medium bg-surface-secondary">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border-medium">
                    <th className="px-6 py-3 font-medium text-text-secondary">Principal</th>
                    <th className="px-6 py-3 font-medium text-text-secondary">Type</th>
                    <th className="px-6 py-3 font-medium text-text-secondary">Priority</th>
                    <th className="px-6 py-3 font-medium text-text-secondary">Overrides</th>
                    <th className="px-6 py-3 font-medium text-text-secondary">Active</th>
                    <th className="px-6 py-3 font-medium text-text-secondary">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {configs.map((cfg) => {
                    const overrideKeys = Object.keys(cfg.overrides ?? {});
                    return (
                      <tr
                        key={cfg._id}
                        className="border-b border-border-medium transition-colors hover:bg-surface-tertiary"
                      >
                        <td className="px-6 py-4 font-medium text-text-primary">
                          {principalLabel(cfg.principalType, cfg.principalId)}
                        </td>
                        <td className="px-6 py-4 text-text-secondary">
                          <span className="inline-flex items-center rounded-full bg-surface-tertiary px-2.5 py-0.5 text-xs font-medium capitalize">
                            {cfg.principalType}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-text-secondary">{cfg.priority}</td>
                        <td className="px-6 py-4 text-text-secondary">
                          {overrideKeys.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {overrideKeys.slice(0, 3).map((k) => (
                                <span
                                  key={k}
                                  className="rounded bg-surface-tertiary px-1.5 py-0.5 text-xs"
                                >
                                  {k}
                                </span>
                              ))}
                              {overrideKeys.length > 3 && (
                                <span className="text-xs text-text-secondary">
                                  +{overrideKeys.length - 3}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-text-secondary">None</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <button
                            onClick={() => handleToggle(cfg)}
                            disabled={toggleConfig.isLoading}
                            className="text-text-secondary transition-colors hover:text-text-primary disabled:opacity-50"
                            title={cfg.isActive ? 'Deactivate' : 'Activate'}
                          >
                            {cfg.isActive ? (
                              <ToggleRight className="h-6 w-6 text-green-500" />
                            ) : (
                              <ToggleLeft className="h-6 w-6 text-text-secondary" />
                            )}
                          </button>
                        </td>
                        <td className="px-6 py-4">
                          <button
                            onClick={() => handleDelete(cfg.principalType, cfg.principalId)}
                            disabled={deleteConfig.isLoading}
                            className="text-text-secondary transition-colors hover:text-red-500 disabled:opacity-50"
                            title="Delete Override"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'base' && (
        <div className="space-y-4">
          {baseLoading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-text-secondary" />
            </div>
          )}

          {!baseLoading && (
            <div className="rounded-xl border border-border-medium bg-surface-secondary p-6">
              <div className="mb-4 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-text-secondary" />
                <p className="text-sm text-text-secondary">
                  Base config is read-only. Edit <code className="rounded bg-surface-tertiary px-1 text-xs">librechat.yaml</code> to change values.
                </p>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {baseConfigEntries.map(([key, value]) => (
                  <div
                    key={key}
                    className="rounded-lg border border-border-light bg-surface-primary p-4"
                  >
                    <h4 className="text-xs font-medium uppercase tracking-wide text-text-secondary">
                      {key}
                    </h4>
                    <div className="mt-1 text-sm text-text-primary">
                      {value === null || value === undefined ? (
                        <span className="italic text-text-secondary">null</span>
                      ) : typeof value === 'boolean' ? (
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            value ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {value ? 'Enabled' : 'Disabled'}
                        </span>
                      ) : typeof value === 'object' ? (
                        <span className="text-xs text-text-secondary">{JSON.stringify(value).slice(0, 40)}...</span>
                      ) : (
                        <span>{String(value)}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ConfigPage;
