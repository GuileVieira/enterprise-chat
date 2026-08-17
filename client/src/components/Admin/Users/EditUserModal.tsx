import React, { useEffect, useMemo, useState } from 'react';
import { SpinnerGap as Loader2, X } from '@phosphor-icons/react';
import { useLocalize } from '~/hooks';
import { useAuthContext } from '~/hooks/AuthContext';
import { useListRoles } from '~/data-provider/roles';
import {
  useGetAdminUser,
  useUpdateAdminUserMutation,
  useAdminUserProjectMutation,
  useRemoveAdminUserFromTenantMutation,
} from '~/data-provider/admin';
import { AdminActionButton, AdminBadge, AdminConfirmDialog, AdminIconButton } from '../common';

interface EditableUser {
  _id: string;
  name?: string;
  email: string;
}

interface EditUserModalProps {
  user: EditableUser | null;
  onClose: () => void;
}

const requestMessage = (error: unknown, fallback: string) => {
  const requestError = error as {
    message?: string;
    response?: { data?: { error?: string; message?: string } };
  };
  return (
    requestError.response?.data?.error ??
    requestError.response?.data?.message ??
    requestError.message ??
    fallback
  );
};

const EditUserModal: React.FC<EditUserModalProps> = ({ user, onClose }) => {
  const [name, setName] = useState('');
  const [role, setRole] = useState('USER');
  const [projectId, setProjectId] = useState('');
  const [confirmTenantRemoval, setConfirmTenantRemoval] = useState(false);
  const [error, setError] = useState('');
  const localize = useLocalize();
  const { user: currentUser } = useAuthContext();
  const detail = useGetAdminUser(user?._id ?? '', { enabled: Boolean(user) });
  const roles = useListRoles({ enabled: Boolean(user) });
  const updateUser = useUpdateAdminUserMutation();
  const removeTenant = useRemoveAdminUserFromTenantMutation();
  const grantProject = useAdminUserProjectMutation('grant');
  const revokeProject = useAdminUserProjectMutation('revoke');
  const isSelf = user?._id === currentUser?.id;
  const auditLabel = (action: string) => {
    switch (action) {
      case 'user.created':
        return localize('com_admin_audit_user_created');
      case 'user.updated':
        return localize('com_admin_audit_user_updated');
      case 'user.deleted':
        return localize('com_admin_audit_user_deleted');
      case 'user.organization_removed':
        return localize('com_admin_audit_organization_removed');
      case 'user.project_access_granted':
        return localize('com_admin_audit_project_granted');
      case 'user.project_access_revoked':
        return localize('com_admin_audit_project_revoked');
      default:
        return action;
    }
  };

  useEffect(() => {
    setName(detail.data?.user.name ?? user?.name ?? '');
    setRole(detail.data?.user.role ?? 'USER');
    setError('');
  }, [detail.data?.user.name, detail.data?.user.role, user]);

  const inaccessibleProjects = useMemo(() => {
    const accessible = new Set(detail.data?.projects.map((project) => project.projectId));
    return (
      detail.data?.availableProjects.filter((project) => !accessible.has(project.projectId)) ?? []
    );
  }, [detail.data]);

  if (!user) return null;

  const mutate = async (changes: { name?: string; role?: string; disabled?: boolean }) => {
    setError('');
    try {
      await updateUser.mutateAsync({ id: user._id, changes });
    } catch (requestError) {
      setError(requestMessage(requestError, localize('com_admin_edit_user_error')));
      throw requestError;
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    await mutate({ name: name.trim(), role });
  };

  const handleProject = async (action: 'grant' | 'revoke', selectedProjectId: string) => {
    setError('');
    try {
      const mutation = action === 'grant' ? grantProject : revokeProject;
      await mutation.mutateAsync({ id: user._id, projectId: selectedProjectId });
      setProjectId('');
    } catch (requestError) {
      setError(requestMessage(requestError, localize('com_admin_user_access_error')));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-user-title"
        className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl border border-border-medium bg-surface-dialog p-6 shadow-xl"
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 id="edit-user-title" className="text-lg font-semibold text-text-primary">
              {localize('com_admin_manage_user')}
            </h2>
            <p className="text-sm text-text-secondary">{user.email}</p>
          </div>
          <AdminIconButton label={localize('com_ui_cancel')} onClick={onClose}>
            <X className="h-5 w-5" />
          </AdminIconButton>
        </div>

        {detail.isLoading ? (
          <div className="flex justify-center p-10">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <div className="mt-6 space-y-6">
            <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-medium text-text-secondary">
                {localize('com_admin_name')}
                <input
                  type="text"
                  maxLength={200}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-border-light bg-surface-primary px-3 py-2.5 text-text-primary"
                />
              </label>
              <label className="text-sm font-medium text-text-secondary">
                {localize('com_admin_role')}
                <select
                  value={role}
                  disabled={isSelf}
                  onChange={(event) => setRole(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-border-light bg-surface-primary px-3 py-2.5 text-text-primary"
                >
                  {roles.data?.roles.map((item) => (
                    <option key={item.name}>{item.name}</option>
                  ))}
                </select>
              </label>
              <div className="flex flex-wrap gap-2 sm:col-span-2">
                <AdminActionButton type="submit" disabled={!name.trim() || updateUser.isLoading}>
                  {localize('com_ui_save')}
                </AdminActionButton>
                <AdminActionButton
                  type="button"
                  variant="ghost"
                  disabled={isSelf || updateUser.isLoading}
                  onClick={() => void mutate({ disabled: !detail.data?.user.disabled })}
                >
                  {detail.data?.user.disabled
                    ? localize('com_admin_activate_user')
                    : localize('com_admin_deactivate_user')}
                </AdminActionButton>
                {detail.data?.user.tenantId && !isSelf && (
                  <AdminActionButton
                    type="button"
                    variant="ghost"
                    onClick={() => setConfirmTenantRemoval(true)}
                  >
                    {localize('com_admin_remove_from_organization')}
                  </AdminActionButton>
                )}
              </div>
            </form>

            <section>
              <h3 className="font-medium text-text-primary">{localize('com_admin_permissions')}</h3>
              <div className="mt-2 flex flex-wrap gap-2">
                {[...(detail.data?.permissions ?? []), ...(detail.data?.capabilities ?? [])]
                  .length ? (
                  [...(detail.data?.permissions ?? []), ...(detail.data?.capabilities ?? [])].map(
                    (permission) => <AdminBadge key={permission}>{permission}</AdminBadge>,
                  )
                ) : (
                  <span className="text-sm text-text-tertiary">{localize('com_admin_none')}</span>
                )}
              </div>
              {!!detail.data?.groups.length && (
                <p className="mt-2 text-sm text-text-secondary">
                  {localize('com_admin_groups')}:{' '}
                  {detail.data.groups.map((group) => group.name).join(', ')}
                </p>
              )}
            </section>

            <section>
              <h3 className="font-medium text-text-primary">
                {localize('com_admin_user_projects')}
              </h3>
              <div className="mt-2 space-y-2">
                {detail.data?.projects.map((project) => (
                  <div
                    key={project.projectId}
                    className="flex items-center justify-between rounded-lg border border-border-light p-3 text-sm"
                  >
                    <span>
                      {project.name ?? project.projectId}{' '}
                      {project.direct ? '' : `(${localize('com_admin_inherited')})`}
                    </span>
                    {project.direct && (
                      <AdminActionButton
                        type="button"
                        variant="ghost"
                        onClick={() => void handleProject('revoke', project.projectId)}
                      >
                        {localize('com_admin_revoke_access')}
                      </AdminActionButton>
                    )}
                  </div>
                ))}
                {!detail.data?.projects.length && (
                  <p className="text-sm text-text-tertiary">
                    {localize('com_admin_no_project_access')}
                  </p>
                )}
              </div>
              {!!inaccessibleProjects.length && (
                <div className="mt-3 flex gap-2">
                  <select
                    value={projectId}
                    onChange={(event) => setProjectId(event.target.value)}
                    className="min-w-0 flex-1 rounded-lg border border-border-light bg-surface-primary px-3 py-2 text-sm"
                  >
                    <option value="">{localize('com_admin_select_project')}</option>
                    {inaccessibleProjects.map((project) => (
                      <option key={project.projectId} value={project.projectId}>
                        {project.name ?? project.projectId}
                      </option>
                    ))}
                  </select>
                  <AdminActionButton
                    type="button"
                    disabled={!projectId || grantProject.isLoading}
                    onClick={() => void handleProject('grant', projectId)}
                  >
                    {localize('com_admin_grant_access')}
                  </AdminActionButton>
                </div>
              )}
            </section>

            <section>
              <h3 className="font-medium text-text-primary">
                {localize('com_admin_audit_history')}
              </h3>
              <div className="mt-2 max-h-48 space-y-2 overflow-y-auto">
                {detail.data?.audits.map((audit) => (
                  <div
                    key={audit._id}
                    className="rounded-lg border border-border-light p-3 text-sm"
                  >
                    <span className="font-medium">{auditLabel(audit.action)}</span>
                    <span className="ml-2 text-text-tertiary">
                      {new Date(audit.createdAt).toLocaleString()}
                    </span>
                    <p className="mt-1 break-all text-xs text-text-tertiary">
                      {localize('com_admin_audit_actor')}: {audit.actorId}
                    </p>
                    {(audit.before || audit.after || audit.metadata) && (
                      <p className="mt-1 break-words text-xs text-text-secondary">
                        {JSON.stringify({
                          ...(audit.before && { before: audit.before }),
                          ...(audit.after && { after: audit.after }),
                          ...(audit.metadata && { metadata: audit.metadata }),
                        })}
                      </p>
                    )}
                  </div>
                ))}
                {!detail.data?.audits.length && (
                  <p className="text-sm text-text-tertiary">
                    {localize('com_admin_no_audit_history')}
                  </p>
                )}
              </div>
            </section>
          </div>
        )}

        {error && (
          <p role="alert" className="mt-4 text-sm text-red-600">
            {error}
          </p>
        )}
      </div>
      <AdminConfirmDialog
        isOpen={confirmTenantRemoval}
        title={localize('com_admin_remove_from_organization')}
        description={localize('com_admin_remove_from_organization_confirm', {
          0: user.name ?? user.email,
        })}
        confirmLabel={localize('com_admin_remove')}
        cancelLabel={localize('com_ui_cancel')}
        isLoading={removeTenant.isLoading}
        onCancel={() => setConfirmTenantRemoval(false)}
        onConfirm={() =>
          void removeTenant
            .mutateAsync(user._id)
            .then(() => setConfirmTenantRemoval(false))
            .catch((requestError) =>
              setError(requestMessage(requestError, localize('com_admin_user_access_error'))),
            )
        }
      />
    </div>
  );
};

export default EditUserModal;
