import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import UsersPage from './UsersPage';

const mockDeleteUser = jest.fn();
const mockReassignOwner = jest.fn();
const mockUseImpact = jest.fn();

jest.mock('~/hooks', () => ({ useLocalize: () => (key: string) => key }));
jest.mock('~/hooks/AuthContext', () => ({ useAuthContext: () => ({ user: { id: 'admin-1' } }) }));
jest.mock('~/data-provider/admin', () => ({
  useListAdminUsers: () => ({
    data: {
      users: [
        { _id: 'admin-1', email: 'admin@test.com', username: 'admin', role: 'ADMIN' },
        { _id: 'user-1', email: 'user@test.com', username: 'user', role: 'USER' },
        { _id: 'owner-2', email: 'owner@test.com', username: 'owner', role: 'USER' },
      ],
    },
    isLoading: false,
  }),
  useSearchAdminUsers: () => ({ data: { users: [] }, isLoading: false }),
  useDeleteAdminUserMutation: () => ({ isLoading: false, mutateAsync: mockDeleteUser }),
}));
jest.mock('~/data-provider/SharedMemories', () => ({
  useMemoryDeletionImpactQuery: (...args: unknown[]) => mockUseImpact(...args),
  useReassignProjectMemoryOwnerMutation: () => ({
    isLoading: false,
    mutateAsync: mockReassignOwner,
  }),
}));

jest.mock('./CreateUserModal', () => () => null);
jest.mock('./EditUserModal', () => () => null);

describe('UsersPage deletion', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const openDelete = () => fireEvent.click(screen.getAllByLabelText('com_admin_delete_user')[0]);
  const renderPage = () => render(<UsersPage />, { wrapper: MemoryRouter });

  it('keeps deletion disabled while impact failed', () => {
    mockUseImpact.mockReturnValue({ isLoading: false, isError: true });
    renderPage();
    openDelete();
    expect(screen.getByRole('button', { name: 'com_ui_delete' })).toBeDisabled();
  });

  it('transfers every owner project before deleting user', async () => {
    mockUseImpact.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        personalCount: 1,
        sharedAuthoredCount: 2,
        projectsNeedingOwner: [{ projectId: 'project-1', name: 'Project 1' }],
      },
    });
    mockReassignOwner.mockResolvedValue(undefined);
    mockDeleteUser.mockResolvedValue(undefined);
    renderPage();
    openDelete();
    fireEvent.change(screen.getByLabelText('com_ui_memory_deletion_select_owner'), {
      target: { value: 'owner-2' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'com_ui_delete' }));
    await waitFor(() => expect(mockDeleteUser).toHaveBeenCalledWith('user-1'));
    expect(mockReassignOwner).toHaveBeenCalledWith({ projectId: 'project-1', userId: 'owner-2' });
    expect(mockReassignOwner.mock.invocationCallOrder[0]).toBeLessThan(
      mockDeleteUser.mock.invocationCallOrder[0],
    );
  });

  it('does not delete user when owner transfer fails', async () => {
    mockUseImpact.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        personalCount: 0,
        sharedAuthoredCount: 0,
        projectsNeedingOwner: [{ projectId: 'project-1', name: 'Project 1' }],
      },
    });
    mockReassignOwner.mockRejectedValue(new Error('transfer failed'));
    renderPage();
    openDelete();
    fireEvent.change(screen.getByLabelText('com_ui_memory_deletion_select_owner'), {
      target: { value: 'owner-2' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'com_ui_delete' }));
    await waitFor(() => expect(mockReassignOwner).toHaveBeenCalled());
    expect(mockDeleteUser).not.toHaveBeenCalled();
  });
});
