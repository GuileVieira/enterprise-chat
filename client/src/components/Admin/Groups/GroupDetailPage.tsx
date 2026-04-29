import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Users,
  Loader2,
  Trash2,
  Search,
  ArrowLeft,
  UserPlus,
} from 'lucide-react';
import {
  useGetAdminGroup,
  useGetAdminGroupMembers,
  useAddAdminGroupMemberMutation,
  useRemoveAdminGroupMemberMutation,
  useSearchAdminUsers,
} from '~/data-provider/admin';

const GroupDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string>('');

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

  const handleRemoveMember = async (userId: string) => {
    if (!id || !window.confirm('Remove this member from the group?')) {
      return;
    }
    await removeMember.mutateAsync({ id, userId });
  };

  const isLoading = groupLoading || membersLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-text-secondary" />
      </div>
    );
  }

  if (!group) {
    return (
      <div className="py-12 text-center">
        <p className="text-text-secondary">Group not found.</p>
        <button
          onClick={() => navigate('/admin/groups')}
          className="mt-4 text-sm text-text-secondary hover:text-text-primary"
        >
          Back to Groups
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/admin/groups')}
          className="text-text-secondary transition-colors hover:text-text-primary"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-text-primary">{group.name}</h1>
          <p className="mt-1 text-sm text-text-secondary">
            {group.description ?? 'No description'}
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-border-medium bg-surface-secondary p-6">
        <h2 className="mb-4 text-lg font-semibold text-text-primary">Add Member</h2>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary" />
            <input
              type="text"
              placeholder="Search users by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-border-medium bg-surface-primary py-2.5 pl-10 pr-4 text-sm text-text-primary placeholder:text-text-secondary focus:border-border-xheavy focus:outline-none"
            />
          </div>
          <select
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
            className="rounded-lg border border-border-medium bg-surface-primary px-3 py-2.5 text-sm text-text-primary focus:border-border-xheavy focus:outline-none"
          >
            <option value="">Select user...</option>
            {searchResults.map((user) => (
              <option key={user._id} value={user._id}>
                {user.name ?? user.username} ({user.email})
              </option>
            ))}
          </select>
          <button
            onClick={handleAddMember}
            disabled={!selectedUserId || addMember.isLoading}
            className="flex items-center gap-2 rounded-lg bg-surface-tertiary px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-surface-active-alt disabled:opacity-50"
          >
            {addMember.isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <UserPlus className="h-4 w-4" />
            )}
            Add
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-border-medium bg-surface-secondary">
        <div className="flex items-center justify-between border-b border-border-medium px-6 py-4">
          <h2 className="text-lg font-semibold text-text-primary">Members</h2>
          <span className="text-sm text-text-secondary">{members.length} total</span>
        </div>

        {members.length === 0 ? (
          <div className="py-8 text-center">
            <Users className="mx-auto h-10 w-10 text-text-secondary" />
            <p className="mt-2 text-sm text-text-secondary">No members yet.</p>
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border-medium">
                <th className="px-6 py-3 font-medium text-text-secondary">Name</th>
                <th className="px-6 py-3 font-medium text-text-secondary">Email</th>
                <th className="px-6 py-3 font-medium text-text-secondary">Role</th>
                <th className="px-6 py-3 font-medium text-text-secondary">Actions</th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <tr
                  key={member._id}
                  className="border-b border-border-medium transition-colors hover:bg-surface-tertiary"
                >
                  <td className="px-6 py-4 font-medium text-text-primary">{member.name ?? member.username}</td>
                  <td className="px-6 py-4 text-text-secondary">{member.email}</td>
                  <td className="px-6 py-4 text-text-secondary">
                    <span className="inline-flex items-center rounded-full bg-surface-tertiary px-2.5 py-0.5 text-xs font-medium">
                      {member.role}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => handleRemoveMember(member._id)}
                      disabled={removeMember.isLoading}
                      className="text-text-secondary transition-colors hover:text-red-500 disabled:opacity-50"
                      title="Remove Member"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default GroupDetailPage;
