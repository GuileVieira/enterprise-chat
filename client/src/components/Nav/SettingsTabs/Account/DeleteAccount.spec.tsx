import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import DeleteAccount from './DeleteAccount';

const mockDeleteUser = jest.fn();

jest.mock('@librechat/client', () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
  Label: ({ children, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) => (
    <label {...props}>{children}</label>
  ),
  OGDialog: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  OGDialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  OGDialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  OGDialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  OGDialogTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Spinner: () => null,
}));
jest.mock('~/hooks', () => ({ useLocalize: () => (key: string) => key }));
jest.mock('~/hooks/AuthContext', () => ({
  useAuthContext: () => ({
    user: { id: 'self-1', email: 'self@test.com', role: 'USER' },
    logout: jest.fn(),
  }),
}));
jest.mock('~/data-provider', () => ({
  useDeleteUserMutation: () => ({ isLoading: false, mutateAsync: mockDeleteUser }),
  useMemoryDeletionImpactQuery: () => ({
    isLoading: false,
    isError: false,
    data: {
      personalCount: 0,
      sharedAuthoredCount: 0,
      projectsNeedingOwner: [{ projectId: 'project-1', name: 'Project 1' }],
      projectOwnerCandidates: [{ userId: 'owner-2', name: 'Owner' }],
    },
  }),
}));

describe('DeleteAccount ownership', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDeleteUser.mockResolvedValue(undefined);
  });

  it('lets a normal user select a server-authorized successor', async () => {
    render(<DeleteAccount />);
    fireEvent.change(screen.getByLabelText('com_nav_delete_account_email_placeholder'), {
      target: { value: 'self@test.com' },
    });
    fireEvent.change(screen.getByLabelText('com_ui_memory_deletion_select_owner'), {
      target: { value: 'owner-2' },
    });
    fireEvent.click(screen.getByText('com_nav_delete_account_button'));
    await waitFor(() => expect(mockDeleteUser).toHaveBeenCalledWith({ projectOwnerId: 'owner-2' }));
  });
});
