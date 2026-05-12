import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { SystemRoles } from 'librechat-data-provider';
import CreateUserModal from './CreateUserModal';

const mockMutateAsync = jest.fn();

jest.mock('~/hooks', () => ({
  useLocalize: () => (key: string) => {
    const labels: Record<string, string> = {
      com_admin_create_user: 'Create user',
      com_admin_create_user_description: 'Create user description',
      com_admin_email_required: 'Email',
      com_admin_email_placeholder: 'Email placeholder',
      com_admin_name_required: 'Name',
      com_admin_full_name_placeholder: 'Full name',
      com_admin_username_required: 'Username',
      com_admin_username_placeholder: 'Username placeholder',
      com_admin_tenant: 'Tenant',
      com_admin_select_tenant: 'Select tenant',
      com_admin_create_new_tenant: 'Create new tenant',
      com_admin_role: 'Role',
      com_admin_role_user: 'User',
      com_admin_role_owner: 'Owner',
      com_admin_role_admin: 'Admin',
      com_admin_password: 'Password',
      com_admin_auto_generate_password_placeholder: 'Auto generate',
      com_admin_password_hint: 'Password hint',
      com_ui_cancel: 'Cancel',
      com_ui_create: 'Create',
    };
    return labels[key] ?? key;
  },
}));

jest.mock('~/data-provider/admin', () => ({
  useCreateAdminUserMutation: () => ({
    isLoading: false,
    mutateAsync: mockMutateAsync,
  }),
  useListAdminTenants: () => ({
    data: { tenants: [{ id: 'tenant-a' }] },
  }),
}));

describe('CreateUserModal', () => {
  beforeEach(() => {
    mockMutateAsync.mockReset();
    mockMutateAsync.mockResolvedValue({ password: 'generated-password' });
  });

  it('keeps USER as the default role and allows selecting OWNER', async () => {
    render(<CreateUserModal isOpen onClose={jest.fn()} preselectedTenantId="tenant-a" />);

    const roleSelect = screen.getAllByRole('combobox')[1] as HTMLSelectElement;
    expect(roleSelect.value).toBe(SystemRoles.USER);
    expect(screen.getByRole('option', { name: 'Owner' })).toHaveValue(SystemRoles.OWNER);

    fireEvent.change(roleSelect, { target: { value: SystemRoles.OWNER } });
    fireEvent.change(screen.getByPlaceholderText('Email placeholder'), {
      target: { value: 'owner@test.com' },
    });
    fireEvent.change(screen.getByPlaceholderText('Full name'), { target: { value: 'Owner User' } });
    fireEvent.change(screen.getByPlaceholderText('Username placeholder'), {
      target: { value: 'owner' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          role: SystemRoles.OWNER,
          tenantId: 'tenant-a',
        }),
      );
    });
  });
});
