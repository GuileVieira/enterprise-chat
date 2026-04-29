import React, { useState } from 'react';
import { UserCircle, Users, Loader2, Plus, Trash2 } from 'lucide-react';
import {
  useListAdminGroups,
  useDeleteAdminGroupMutation,
} from '~/data-provider/admin';
import { useQueryClient } from '@tanstack/react-query';
import { QueryKeys } from 'librechat-data-provider';

const GroupsPage: React.FC = () => {
  const { data, isLoading } = useListAdminGroups(1, 50);
  const deleteGroup = useDeleteAdminGroupMutation();
  const queryClient = useQueryClient();

  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this group?')) {
      return;
    }
    setDeletingId(id);
    try {
      await deleteGroup.mutateAsync(id);
      queryClient.invalidateQueries([QueryKeys.adminGroups]);
    } catch {
      // error handled by mutation
    } finally {
      setDeletingId(null);
    }
  };

  const groups = data?.groups ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Groups</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Manage user groups for easier permission management.
          </p>
        </div>
        <button
          className="flex items-center gap-2 rounded-lg bg-surface-tertiary px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-surface-active-alt"
          onClick={() => alert('Create group functionality coming soon')}
        >
          <Plus className="h-4 w-4" />
          Create Group
        </button>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-text-secondary" />
        </div>
      )}

      {!isLoading && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {groups.map((group) => (
            <div
              key={group._id}
              className="rounded-xl border border-border-medium bg-surface-secondary p-6 transition-colors hover:bg-surface-tertiary"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-surface-tertiary">
                    <UserCircle className="h-5 w-5 text-text-primary" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="truncate text-base font-semibold text-text-primary">
                      {group.name}
                    </h3>
                    <p className="truncate text-sm text-text-secondary">
                      {group.description ?? 'No description'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(group._id)}
                  disabled={deletingId === group._id}
                  className="ml-2 text-text-secondary transition-colors hover:text-red-500 disabled:opacity-50"
                  title="Delete Group"
                >
                  {deletingId === group._id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </button>
              </div>

              <div className="mt-4 flex items-center gap-2 text-sm text-text-secondary">
                <Users className="h-4 w-4" />
                <span>{(group.memberIds ?? []).length} members</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {!isLoading && groups.length === 0 && (
        <div className="rounded-xl border border-border-medium bg-surface-secondary py-12 text-center">
          <UserCircle className="mx-auto h-12 w-12 text-text-secondary" />
          <p className="mt-4 text-text-secondary">No groups found.</p>
        </div>
      )}
    </div>
  );
};

export default GroupsPage;
