import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  SpinnerGap as Loader2,
  MagnifyingGlass as Search,
  Trash as Trash2,
  UserPlus,
  Users,
} from '@phosphor-icons/react';
import { useLocalize } from '~/hooks';
import {
  useGetAdminGroup,
  useGetAdminGroupMembers,
  useAddAdminGroupMemberMutation,
  useRemoveAdminGroupMemberMutation,
  useSearchAdminUsers,
} from '~/data-provider/admin';
import {
  AdminBadge,
  AdminPanel,
  AdminSkeleton,
  AdminIconButton,
  AdminEmptyState,
  AdminActionButton,
  AdminConfirmDialog,
  AdminPageHeader,
} from '../common';

interface PendingMemberRemoval {
  _id: string;
  name?: string;
  username?: string;
  email: string;
}

const GroupDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const localize = useLocalize();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [pendingRemoval, setPendingRemoval] = useState<PendingMemberRemoval | null>(null);

  const { data: groupData, isLoading: groupLoading } = useGetAdminGroup(id ?? '');
  const { data: membersData, isLoading: membersLoading } = useGetAdminGroupMembers(id ?? '');
  const { data: searchData } = useSearchAdminUsers(searchQuery, {
    enabled: searchQuery.length > 2,
  });

  const addMember = useAddAdminGroupMemberMutation();
  const removeMember = useRemoveAdminGroupMemberMutation();

  const group = groupData;
  const members = membersData?.members ?? [];
  const searchResults = searchData?.users ?? [];

  const handleAddMember = async () => {
    if (!id || !selectedUserId) {
      return;
    }
    await addMember.mutateAsync({ id, userId: selectedUserId });
    setSelectedUserId('');
    setSearchQuery('');
  };

  const handleRemoveMember = async () => {
    if (!id || pendingRemoval == null) {
      return;
    }
    await removeMember.mutateAsync({ id, userId: pendingRemoval._id });
    setPendingRemoval(null);
  };

  const isLoading = groupLoading || membersLoading;

  if (isLoading) {
    return <AdminSkeleton rows={5} />;
  }

  if (!group) {
    return (
      <AdminEmptyState
        icon={<Users className="h-6 w-6" />}
        title={localize('com_admin_group_not_found')}
        action={
          <AdminActionButton variant="ghost" onClick={() => navigate('/admin/groups')}>
            {localize('com_admin_back_to_groups')}
          </AdminActionButton>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <AdminIconButton
          onClick={() => navigate('/admin/groups')}
          label={localize('com_admin_back_to_groups')}
          className="mt-1"
        >
          <ArrowLeft className="h-5 w-5" />
        </AdminIconButton>
        <div className="flex-1">
          <AdminPageHeader
            title={group.name}
            description={group.description ?? localize('com_admin_no_description')}
          />
        </div>
      </div>

      <AdminPanel className="p-5">
        <h2 className="mb-4 text-lg font-semibold text-text-primary">
          {localize('com_admin_add_member')}
        </h2>
        <div className="grid gap-3 lg:grid-cols-[1fr_minmax(16rem,24rem)_auto]">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary" />
            <input
              type="text"
              aria-label={localize('com_admin_search_users')}
              placeholder={localize('com_admin_search_users_by_name_email')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="focus:ring-ring-primary/20 w-full rounded-lg border border-border-light bg-surface-primary py-2.5 pl-10 pr-4 text-sm text-text-primary placeholder:text-text-tertiary focus:border-border-xheavy focus:outline-none focus:ring-2"
            />
          </div>
          <select
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
            className="focus:ring-ring-primary/20 rounded-lg border border-border-light bg-surface-primary px-3 py-2.5 text-sm text-text-primary focus:border-border-xheavy focus:outline-none focus:ring-2"
          >
            <option value="">{localize('com_admin_select_user')}</option>
            {searchResults.map((user) => (
              <option key={user._id ?? user.id} value={user._id ?? user.id}>
                {user.name ?? user.username} ({user.email})
              </option>
            ))}
          </select>
          <AdminActionButton
            onClick={handleAddMember}
            disabled={!selectedUserId || addMember.isLoading}
            icon={
              addMember.isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <UserPlus className="h-4 w-4" />
              )
            }
          >
            {localize('com_admin_add')}
          </AdminActionButton>
        </div>
      </AdminPanel>

      <AdminPanel>
        <div className="flex items-center justify-between border-b border-border-light px-6 py-4">
          <h2 className="text-lg font-semibold text-text-primary">
            {localize('com_admin_members')}
          </h2>
          <AdminBadge>{localize('com_admin_total_count', { count: members.length })}</AdminBadge>
        </div>

        {members.length === 0 ? (
          <div className="p-6">
            <AdminEmptyState
              icon={<Users className="h-6 w-6" />}
              title={localize('com_admin_no_members_yet')}
              description={localize('com_admin_no_members_yet_description')}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead>
                <tr className="bg-surface-primary/40 border-b border-border-light">
                  <th className="px-6 py-3 font-medium text-text-secondary">
                    {localize('com_admin_name')}
                  </th>
                  <th className="px-6 py-3 font-medium text-text-secondary">
                    {localize('com_admin_email')}
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
                {members.map((member) => (
                  <tr
                    key={member._id}
                    className="border-b border-border-light transition-colors hover:bg-surface-tertiary"
                  >
                    <td className="px-6 py-4 font-medium text-text-primary">
                      {member.name ?? member.username}
                    </td>
                    <td className="px-6 py-4 text-text-secondary">{member.email}</td>
                    <td className="px-6 py-4 text-text-secondary">
                      <AdminBadge>{member.role}</AdminBadge>
                    </td>
                    <td className="px-6 py-4">
                      <AdminIconButton
                        onClick={() => setPendingRemoval(member)}
                        disabled={removeMember.isLoading}
                        label={localize('com_admin_remove_member')}
                        tone="danger"
                      >
                        <Trash2 className="h-4 w-4" />
                      </AdminIconButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AdminPanel>

      <AdminConfirmDialog
        isOpen={pendingRemoval != null}
        title={localize('com_admin_remove_member')}
        description={localize('com_admin_remove_member_confirm', {
          0: pendingRemoval?.name ?? pendingRemoval?.username ?? pendingRemoval?.email ?? '',
        })}
        confirmLabel={localize('com_ui_delete')}
        cancelLabel={localize('com_ui_cancel')}
        isLoading={removeMember.isLoading}
        onCancel={() => setPendingRemoval(null)}
        onConfirm={handleRemoveMember}
      />
    </div>
  );
};

export default GroupDetailPage;
