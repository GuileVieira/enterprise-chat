import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import EditUserModal from './EditUserModal';

const mockMutateAsync = jest.fn();

jest.mock('~/hooks', () => ({
  useLocalize: () => (key: string) => {
    const labels: Record<string, string> = {
      com_admin_edit_user: 'Edit name',
      com_admin_name: 'Name',
      com_admin_edit_user_error: 'Update failed',
      com_ui_cancel: 'Cancel',
      com_ui_save: 'Save',
    };
    return labels[key] ?? key;
  },
}));

jest.mock('~/data-provider/admin', () => ({
  useUpdateAdminUserMutation: () => ({
    isLoading: false,
    mutateAsync: mockMutateAsync,
  }),
}));

describe('EditUserModal', () => {
  beforeEach(() => {
    mockMutateAsync.mockReset();
    mockMutateAsync.mockResolvedValue({});
  });

  it('trims and submits the edited name', async () => {
    const onClose = jest.fn();
    render(
      <EditUserModal
        user={{ _id: 'user-1', name: 'Nome Antigo', email: 'user@test.com' }}
        onClose={onClose}
      />,
    );

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: '  Nome Novo  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({ id: 'user-1', name: 'Nome Novo' });
      expect(onClose).toHaveBeenCalled();
    });
  });
});
