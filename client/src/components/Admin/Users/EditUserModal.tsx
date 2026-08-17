import React, { useEffect, useState } from 'react';
import { SpinnerGap as Loader2, X } from '@phosphor-icons/react';
import { useLocalize } from '~/hooks';
import { useUpdateAdminUserMutation } from '~/data-provider/admin';
import { AdminActionButton, AdminIconButton } from '../common';

interface EditableUser {
  _id: string;
  name?: string;
  email: string;
}

interface EditUserModalProps {
  user: EditableUser | null;
  onClose: () => void;
}

const EditUserModal: React.FC<EditUserModalProps> = ({ user, onClose }) => {
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const localize = useLocalize();
  const updateUser = useUpdateAdminUserMutation();

  useEffect(() => {
    setName(user?.name ?? '');
    setError('');
  }, [user]);

  if (!user) {
    return null;
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      return;
    }
    setError('');
    try {
      await updateUser.mutateAsync({ id: user._id, name: trimmedName });
      onClose();
    } catch (requestError) {
      const responseError = requestError as {
        message?: string;
        response?: { data?: { error?: string; message?: string } };
      };
      setError(
        responseError.response?.data?.error ??
          responseError.response?.data?.message ??
          responseError.message ??
          localize('com_admin_edit_user_error'),
      );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-user-title"
        className="w-full max-w-md rounded-xl border border-border-medium bg-surface-dialog p-6 shadow-xl"
      >
        <div className="flex items-center justify-between">
          <h2 id="edit-user-title" className="text-lg font-semibold text-text-primary">
            {localize('com_admin_edit_user')}
          </h2>
          <AdminIconButton label={localize('com_ui_cancel')} onClick={onClose}>
            <X className="h-5 w-5" />
          </AdminIconButton>
        </div>

        <p className="mt-1 text-sm text-text-secondary">{user.email}</p>
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label
              htmlFor="admin-user-name"
              className="block text-sm font-medium text-text-secondary"
            >
              {localize('com_admin_name')}
            </label>
            <input
              id="admin-user-name"
              type="text"
              maxLength={200}
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="focus:ring-ring-primary/20 mt-1 w-full rounded-lg border border-border-light bg-surface-primary px-3 py-2.5 text-sm text-text-primary focus:border-border-xheavy focus:outline-none focus:ring-2"
            />
          </div>
          {error && (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <AdminActionButton type="button" variant="ghost" onClick={onClose}>
              {localize('com_ui_cancel')}
            </AdminActionButton>
            <AdminActionButton
              type="submit"
              disabled={!name.trim() || updateUser.isLoading}
              icon={updateUser.isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            >
              {localize('com_ui_save')}
            </AdminActionButton>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditUserModal;
