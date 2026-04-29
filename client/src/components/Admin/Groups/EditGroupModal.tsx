import React, { useEffect, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { useLocalize } from '~/hooks';
import { useUpdateAdminGroupMutation } from '~/data-provider/admin';
import { AdminActionButton, AdminIconButton } from '../common';

interface EditableGroup {
  _id: string;
  name: string;
  description?: string;
}

interface EditGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  group: EditableGroup | null;
}

const EditGroupModal: React.FC<EditGroupModalProps> = ({ isOpen, onClose, group }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const localize = useLocalize();
  const updateGroup = useUpdateAdminGroupMutation();

  useEffect(() => {
    if (group) {
      setName(group.name);
      setDescription(group.description ?? '');
    }
  }, [group]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!group || !name.trim()) {
      return;
    }
    try {
      await updateGroup.mutateAsync({
        id: group._id,
        payload: { name: name.trim(), description: description.trim() || undefined },
      });
      onClose();
    } catch {
      // error handled by mutation
    }
  };

  if (!isOpen || !group) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-group-title"
        className="w-full max-w-md rounded-xl border border-border-medium bg-surface-dialog p-6 shadow-xl"
      >
        <div className="flex items-center justify-between">
          <h2 id="edit-group-title" className="text-lg font-semibold text-text-primary">
            {localize('com_admin_edit_group')}
          </h2>
          <AdminIconButton label={localize('com_ui_cancel')} onClick={onClose}>
            <X className="h-5 w-5" />
          </AdminIconButton>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary">
              {localize('com_admin_name')}
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={localize('com_admin_group_name_placeholder')}
              className="focus:ring-ring-primary/20 mt-1 w-full rounded-lg border border-border-light bg-surface-primary px-3 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary focus:border-border-xheavy focus:outline-none focus:ring-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary">
              {localize('com_admin_description')}
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={localize('com_admin_optional_description_placeholder')}
              className="focus:ring-ring-primary/20 mt-1 w-full rounded-lg border border-border-light bg-surface-primary px-3 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary focus:border-border-xheavy focus:outline-none focus:ring-2"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <AdminActionButton variant="ghost" onClick={onClose}>
              {localize('com_ui_cancel')}
            </AdminActionButton>
            <AdminActionButton
              type="submit"
              disabled={!name.trim() || updateGroup.isLoading}
              icon={updateGroup.isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            >
              {localize('com_ui_save')}
            </AdminActionButton>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditGroupModal;
