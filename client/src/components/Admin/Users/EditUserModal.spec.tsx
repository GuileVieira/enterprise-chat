import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import EditUserModal from './EditUserModal';

const mockMutateAsync = jest.fn();

jest.mock('~/hooks', () => ({ useLocalize: () => (key: string) => key }));
jest.mock('~/hooks/AuthContext', () => ({ useAuthContext: () => ({ user: { id: 'admin-1' } }) }));
jest.mock('~/data-provider/roles', () => ({
  useListRoles: () => ({ data: { roles: [{ name: 'USER' }, { name: 'ADMIN' }] } }),
}));
jest.mock('~/data-provider/admin', () => ({
  useGetAdminUser: () => ({
    isLoading: false,
    data: {
      user: {
        _id: 'user-1',
        name: 'Nome Antigo',
        email: 'user@test.com',
        role: 'USER',
        disabled: false,
      },
      permissions: ['PROJECTS.USE'],
      capabilities: ['READ_USERS'],
      groups: [],
      projects: [],
      availableProjects: [],
      audits: [],
    },
  }),
  useUpdateAdminUserMutation: () => ({ isLoading: false, mutateAsync: mockMutateAsync }),
  useRemoveAdminUserFromTenantMutation: () => ({ isLoading: false, mutateAsync: jest.fn() }),
  useAdminUserProjectMutation: () => ({ isLoading: false, mutateAsync: jest.fn() }),
}));

describe('EditUserModal', () => {
  beforeEach(() => mockMutateAsync.mockResolvedValue({}));

  it('updates trimmed name and role', async () => {
    render(
      <EditUserModal
        user={{ _id: 'user-1', name: 'Nome Antigo', email: 'user@test.com' }}
        onClose={jest.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText('com_admin_name'), {
      target: { value: '  Nome Novo  ' },
    });
    fireEvent.change(screen.getByLabelText('com_admin_role'), { target: { value: 'ADMIN' } });
    fireEvent.click(screen.getByRole('button', { name: 'com_ui_save' }));

    await waitFor(() =>
      expect(mockMutateAsync).toHaveBeenCalledWith({
        id: 'user-1',
        changes: { name: 'Nome Novo', role: 'ADMIN' },
      }),
    );
  });
});
