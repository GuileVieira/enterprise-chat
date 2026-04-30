import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Building2,
  Users,
  ArrowLeft,
  Loader2,
  MessageSquare,
  Bot,
  Wrench,
  Key,
  Plus,
} from 'lucide-react';
import { useGetAdminTenantUsers, useGetAdminTenantStats } from '~/data-provider/admin';
import CreateUserModal from '../Users/CreateUserModal';

const TenantDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'users' | 'stats'>('users');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const { data: usersData, isLoading: usersLoading } = useGetAdminTenantUsers(id ?? '', 1, 50);
  const { data: statsData, isLoading: statsLoading } = useGetAdminTenantStats(id ?? '');

  const users = usersData?.users ?? [];
  const stats = statsData?.stats;
  const tenantId = id ?? '';

  const isLoading = usersLoading || statsLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-text-secondary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/admin/tenants')}
            className="text-text-secondary transition-colors hover:text-text-primary"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-text-primary">{tenantId}</h1>
            <p className="mt-1 text-sm text-text-secondary">Tenant Overview</p>
          </div>
        </div>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="flex items-center gap-2 rounded-lg bg-surface-tertiary px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-surface-active-alt"
        >
          <Plus className="h-4 w-4" />
          Add User
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <div className="rounded-xl border border-border-medium bg-surface-secondary p-4">
          <div className="flex items-center gap-2 text-text-secondary">
            <Users className="h-4 w-4" />
            <span className="text-xs font-medium uppercase">Users</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-text-primary">{stats?.users ?? 0}</p>
        </div>
        <div className="rounded-xl border border-border-medium bg-surface-secondary p-4">
          <div className="flex items-center gap-2 text-text-secondary">
            <MessageSquare className="h-4 w-4" />
            <span className="text-xs font-medium uppercase">Conversations</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-text-primary">{stats?.conversations ?? 0}</p>
        </div>
        <div className="rounded-xl border border-border-medium bg-surface-secondary p-4">
          <div className="flex items-center gap-2 text-text-secondary">
            <Bot className="h-4 w-4" />
            <span className="text-xs font-medium uppercase">Agents</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-text-primary">{stats?.agents ?? 0}</p>
        </div>
        <div className="rounded-xl border border-border-medium bg-surface-secondary p-4">
          <div className="flex items-center gap-2 text-text-secondary">
            <Wrench className="h-4 w-4" />
            <span className="text-xs font-medium uppercase">Functions</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-text-primary">{stats?.functions ?? 0}</p>
        </div>
        <div className="rounded-xl border border-border-medium bg-surface-secondary p-4">
          <div className="flex items-center gap-2 text-text-secondary">
            <Key className="h-4 w-4" />
            <span className="text-xs font-medium uppercase">Secrets</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-text-primary">{stats?.secrets ?? 0}</p>
        </div>
      </div>

      <div className="flex gap-4 border-b border-border-medium">
        <button
          onClick={() => setActiveTab('users')}
          className={`pb-2 text-sm font-medium transition-colors ${
            activeTab === 'users'
              ? 'border-b-2 border-text-primary text-text-primary'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          Users ({users.length})
        </button>
        <button
          onClick={() => setActiveTab('stats')}
          className={`pb-2 text-sm font-medium transition-colors ${
            activeTab === 'stats'
              ? 'border-b-2 border-text-primary text-text-primary'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          Stats
        </button>
      </div>

      {activeTab === 'users' && (
        <div className="rounded-xl border border-border-medium bg-surface-secondary">
          {users.length === 0 ? (
            <div className="py-8 text-center">
              <Users className="mx-auto h-10 w-10 text-text-secondary" />
              <p className="mt-2 text-sm text-text-secondary">No users in this tenant.</p>
            </div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border-medium">
                  <th className="px-6 py-3 font-medium text-text-secondary">Name</th>
                  <th className="px-6 py-3 font-medium text-text-secondary">Email</th>
                  <th className="px-6 py-3 font-medium text-text-secondary">Username</th>
                  <th className="px-6 py-3 font-medium text-text-secondary">Role</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr
                    key={user._id}
                    className="border-b border-border-medium transition-colors hover:bg-surface-tertiary"
                  >
                    <td className="px-6 py-4 font-medium text-text-primary">
                      {user.name ?? user.username}
                    </td>
                    <td className="px-6 py-4 text-text-secondary">{user.email}</td>
                    <td className="px-6 py-4 text-text-secondary">{user.username}</td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center rounded-full bg-surface-tertiary px-2.5 py-0.5 text-xs font-medium">
                        {user.role}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {activeTab === 'stats' && (
        <div className="rounded-xl border border-border-medium bg-surface-secondary p-6">
          <p className="text-sm text-text-secondary">
            Detailed stats per entity type will be available in a future update.
          </p>
        </div>
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
