import React, { useState } from 'react';
import { Eye, Plus, Pencil, Trash2, UserCircle, Users, Loader2 } from 'lucide-react';
import { QueryKeys } from 'librechat-data-provider';
import { useListAdminGroups, useDeleteAdminGroupMutation } from '~/data-provider/admin';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useLocalize } from '~/hooks';
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
import CreateGroupModal from './CreateGroupModal';
import EditGroupModal from './EditGroupModal';

interface EditableGroup {
  _id: string;
  name: string;
  description?: string;
}

const GroupsPage: React.FC = () => {
  const { data, isLoading } = useListAdminGroups(1, 50);
  const deleteGroup = useDeleteAdminGroupMutation();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const localize = useLocalize();

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<EditableGroup | null>(null);
  const [pendingDelete, setPendingDelete] = useState<EditableGroup | null>(null);

  const handleDelete = async () => {
    if (pendingDelete == null) {
      return;
    }
    setDeletingId(pendingDelete._id);
    try {
      await deleteGroup.mutateAsync(pendingDelete._id);
      queryClient.invalidateQueries([QueryKeys.adminGroups]);
      setPendingDelete(null);
    } catch {
      // error handled by mutation
    } finally {
      setDeletingId(null);
    }
  };

  const groups = data?.groups ?? [];

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title={localize('com_admin_groups')}
        description={localize('com_admin_groups_page_description')}
        action={
          <AdminActionButton
            icon={<Plus className="h-4 w-4" />}
            onClick={() => setIsCreateModalOpen(true)}
          >
            {localize('com_admin_create_group')}
          </AdminActionButton>
        }
      />

      {isLoading && (
        <AdminPanel className="p-4">
          <AdminSkeleton rows={6} />
        </AdminPanel>
      )}

      {!isLoading && groups.length > 0 && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {groups.map((group) => (
            <AdminPanel
              key={group._id}
              className="p-5 transition-all duration-200 hover:-translate-y-0.5 hover:bg-surface-tertiary"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-surface-tertiary">
                    <UserCircle className="h-5 w-5 text-text-primary" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="truncate text-base font-semibold text-text-primary">
                      {group.name}
                    </h3>
                    <p className="truncate text-sm text-text-secondary">
                      {group.description ?? localize('com_admin_no_description')}
                    </p>
                  </div>
                </div>
                <div className="ml-2 flex items-center gap-1">
                  <AdminIconButton
                    onClick={() => navigate(`/admin/groups/${group._id}`)}
                    label={localize('com_admin_view_members')}
                  >
                    <Eye className="h-4 w-4" />
                  </AdminIconButton>
                  <AdminIconButton
                    onClick={() => setEditingGroup(group)}
                    label={localize('com_admin_edit_group')}
                  >
                    <Pencil className="h-4 w-4" />
                  </AdminIconButton>
                  <AdminIconButton
                    onClick={() => setPendingDelete(group)}
                    disabled={deletingId === group._id}
                    label={localize('com_admin_delete_group')}
                    tone="danger"
                  >
                    {deletingId === group._id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </AdminIconButton>
                </div>
              </div>

              <div className="mt-5">
                <AdminBadge>
                  <Users className="h-4 w-4" />
                  {localize('com_admin_members_count', { count: (group.memberIds ?? []).length })}
                </AdminBadge>
              </div>
            </AdminPanel>
          ))}
        </div>
      )}

      {!isLoading && groups.length === 0 && (
        <AdminEmptyState
          icon={<UserCircle className="h-6 w-6" />}
          title={localize('com_admin_no_groups_found')}
          description={localize('com_admin_no_groups_found_description')}
          action={
            <AdminActionButton
              icon={<Plus className="h-4 w-4" />}
              onClick={() => setIsCreateModalOpen(true)}
            >
              {localize('com_admin_create_group')}
            </AdminActionButton>
          }
        />
      )}

      <CreateGroupModal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} />
      <EditGroupModal
        isOpen={!!editingGroup}
        onClose={() => setEditingGroup(null)}
        group={editingGroup}
      />
      <AdminConfirmDialog
        isOpen={pendingDelete != null}
        title={localize('com_admin_delete_group')}
        description={localize('com_admin_delete_group_confirm', {
          0: pendingDelete?.name ?? '',
        })}
        confirmLabel={localize('com_ui_delete')}
        cancelLabel={localize('com_ui_cancel')}
        isLoading={deleteGroup.isLoading}
        onCancel={() => setPendingDelete(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
};

export default GroupsPage;
