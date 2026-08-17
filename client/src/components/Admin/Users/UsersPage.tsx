import React, { useState } from 'react';
import {
  Plus,
  Trash as Trash2,
  SpinnerGap as Loader2,
  MagnifyingGlass as Search,
  Shield,
  Users,
} from '@phosphor-icons/react';
import { useNavigate } from 'react-router-dom';
import { useLocalize } from '~/hooks';
import { useAuthContext } from '~/hooks/AuthContext';
import {
  useListAdminUsers,
  useSearchAdminUsers,
  useDeleteAdminUserMutation,
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
import CreateUserModal from './CreateUserModal';

interface PendingUser {
  _id: string;
  name?: string;
  username: string;
  email: string;
}

const UsersPage: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<PendingUser | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const navigate = useNavigate();
  const localize = useLocalize();
  const { user: currentUser } = useAuthContext();
  const deleteUser = useDeleteAdminUserMutation();

  const { data: listData, isLoading: listLoading } = useListAdminUsers(1, 50);
  const { data: searchData, isLoading: searchLoading } = useSearchAdminUsers(searchQuery, {
    enabled: searchQuery.length > 2,
  });

  const isSearching = searchQuery.length > 2;
  const users = isSearching ? (searchData?.users ?? []) : (listData?.users ?? []);
  const isLoading = isSearching ? searchLoading : listLoading;

  const filteredUsers = isSearching
    ? users
    : users.filter(
        (user) =>
          (user.name ?? '').toLowerCase().includes(searchQuery.toLowerCase()) ||
          user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
          user.username.toLowerCase().includes(searchQuery.toLowerCase()),
      );

  const handleDelete = async () => {
    if (pendingDelete == null || pendingDelete._id === currentUser?.id) {
      return;
    }
    setDeleteError('');
    try {
      await deleteUser.mutateAsync(pendingDelete._id);
      setPendingDelete(null);
    } catch (error) {
      const requestError = error as {
        message?: string;
        response?: { data?: { error?: string; message?: string } };
      };
      setDeleteError(
        requestError.response?.data?.error ??
          requestError.response?.data?.message ??
          requestError.message ??
          localize('com_admin_delete_user_error'),
      );
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <AdminPageHeader
          title={localize('com_admin_users')}
          description={localize('com_admin_users_page_description')}
        />
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="flex items-center gap-2 rounded-lg bg-surface-tertiary px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-surface-active-alt"
        >
          <Plus className="h-4 w-4" />
          {localize('com_admin_create_user')}
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary" />
        <input
          type="text"
          aria-label={localize('com_admin_search_users')}
          placeholder={localize('com_admin_search_users_placeholder')}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="focus:ring-ring-primary/20 w-full rounded-lg border border-border-light bg-surface-secondary py-3 pl-10 pr-4 text-sm text-text-primary shadow-sm shadow-black/5 placeholder:text-text-tertiary focus:border-border-xheavy focus:outline-none focus:ring-2"
        />
      </div>

      {isLoading && (
        <AdminPanel className="p-4">
          <AdminSkeleton rows={6} />
        </AdminPanel>
      )}

      {!isLoading && filteredUsers.length > 0 && (
        <AdminPanel>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead>
                <tr className="bg-surface-primary/40 border-b border-border-light">
                  <th className="px-6 py-3 font-medium text-text-secondary">
                    {localize('com_admin_name')}
                  </th>
                  <th className="px-6 py-3 font-medium text-text-secondary">
                    {localize('com_admin_email')}
                  </th>
                  <th className="px-6 py-3 font-medium text-text-secondary">
                    {localize('com_admin_username')}
                  </th>
                  <th className="px-6 py-3 font-medium text-text-secondary">
                    {localize('com_admin_tenant')}
                  </th>
                  <th className="px-6 py-3 font-medium text-text-secondary">
                    {localize('com_admin_role')}
                  </th>
                  <th className="px-6 py-3 font-medium text-text-secondary">
                    {localize('com_admin_actions')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <tr
                    key={user._id ?? user.id}
                    className="border-b border-border-light transition-colors hover:bg-surface-tertiary"
                  >
                    <td className="px-6 py-4 font-medium text-text-primary">
                      {user.name ?? user.username}
                    </td>
                    <td className="px-6 py-4 text-text-secondary">{user.email}</td>
                    <td className="px-6 py-4 text-text-secondary">{user.username}</td>
                    <td className="px-6 py-4 text-text-secondary">
                      {user.tenantId ? (
                        <span className="inline-flex items-center rounded-full bg-surface-tertiary px-2 py-0.5 text-xs">
                          {user.tenantId}
                        </span>
                      ) : (
                        <span className="text-xs text-text-tertiary">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <AdminBadge tone={user.role === 'ADMIN' ? 'success' : 'neutral'}>
                        {user.role === 'ADMIN' && <Shield className="h-3 w-3" />}
                        {user.role}
                      </AdminBadge>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1">
                        <AdminIconButton
                          onClick={() => navigate('/admin/roles')}
                          label={localize('com_admin_manage_role')}
                        >
                          <Shield className="h-4 w-4" />
                        </AdminIconButton>
                        {user._id !== currentUser?.id && (
                          <AdminIconButton
                            onClick={() => {
                              setDeleteError('');
                              setPendingDelete(user);
                            }}
                            disabled={deleteUser.isLoading}
                            label={localize('com_admin_delete_user')}
                            tone="danger"
                          >
                            {deleteUser.isLoading && pendingDelete?._id === user._id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </AdminIconButton>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </AdminPanel>
      )}

      {!isLoading && filteredUsers.length === 0 && (
        <AdminEmptyState
          icon={<Users className="h-6 w-6" />}
          title={localize('com_admin_no_users_found')}
          description={localize('com_admin_no_users_found_description')}
        />
      )}

      <CreateUserModal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} />
      {deleteError && (
        <p role="alert" className="text-sm text-red-600">
          {deleteError}
        </p>
      )}
      <AdminConfirmDialog
        isOpen={pendingDelete != null}
        title={localize('com_admin_delete_user')}
        description={localize('com_admin_delete_user_confirm', {
          0: pendingDelete?.name ?? pendingDelete?.email ?? '',
        })}
        confirmLabel={localize('com_ui_delete')}
        cancelLabel={localize('com_ui_cancel')}
        isLoading={deleteUser.isLoading}
        onCancel={() => setPendingDelete(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
};

export default UsersPage;
