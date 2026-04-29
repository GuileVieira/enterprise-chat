import React, { useState, useEffect } from 'react';
import { X, Loader2 } from 'lucide-react';
import { useUpdateAdminGroupMutation } from '~/data-provider/admin';

interface EditGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  group: { _id: string; name: string; description?: string } | null;
}

const EditGroupModal: React.FC<EditGroupModalProps> = ({ isOpen, onClose, group }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-xl border border-border-medium bg-surface-secondary p-6 shadow-lg">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-text-primary">Edit Group</h2>
          <button
            onClick={onClose}
            className="text-text-secondary transition-colors hover:text-text-primary"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter group name..."
              className="mt-1 w-full rounded-lg border border-border-medium bg-surface-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:border-border-xheavy focus:outline-none"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary">Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description..."
              className="mt-1 w-full rounded-lg border border-border-medium bg-surface-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:border-border-xheavy focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-border-medium px-4 py-2 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-tertiary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim() || updateGroup.isLoading}
              className="flex items-center gap-2 rounded-lg bg-surface-tertiary px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-surface-active-alt disabled:opacity-50"
            >
              {updateGroup.isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditGroupModal;
