import React from 'react';
import { RecoilRoot } from 'recoil';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import ShareView from './ShareView';

const mockTenantFetch = jest.fn();
const mockPublicFetch = jest.fn();
const mockTenantFork = jest.fn();
const mockPublicFork = jest.fn();

jest.mock('librechat-data-provider/react-query', () => ({
  useGetSharedMessages: (_shareId: string, options: { enabled: boolean }) => {
    mockPublicFetch(options);
    return { data: undefined, isLoading: false, isFetching: false, refetch: jest.fn() };
  },
  useGetTenantSharedMessages: (_shareId: string, options: { enabled: boolean }) => {
    mockTenantFetch(options);
    return {
      data: {
        conversationId: 'source-conversation',
        title: 'Tenant shared conversation',
        messages: [
          {
            messageId: 'message-1',
            conversationId: 'source-conversation',
            parentMessageId: '00000000-0000-0000-0000-000000000000',
            isCreatedByUser: true,
            text: 'Tenant context',
          },
        ],
      },
      isLoading: false,
      isFetching: false,
      refetch: jest.fn(),
    };
  },
}));

jest.mock('~/data-provider', () => ({
  useForkSharedConvoMutation: () => ({ mutate: mockPublicFork, isLoading: false }),
  useForkTenantShareMutation: () => ({ mutate: mockTenantFork, isLoading: false }),
  useGetSharedStartupConfig: () => ({ data: undefined }),
  useGetStartupConfig: () => ({ data: { appTitle: 'Orqest' } }),
}));

jest.mock('~/hooks', () => ({
  useAuthContext: () => ({ isAuthReady: true }),
  useDocumentTitle: jest.fn(),
  useLocalize: () => (key: string) => key,
}));
jest.mock('./ShareMessagesProvider', () => ({
  ShareMessagesProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
jest.mock('./MessagesView', () => () => <div data-testid="tenant-messages" />);
jest.mock('./ShareArtifacts', () => ({
  ShareArtifactsContainer: ({ mainContent }: { mainContent: React.ReactNode }) => (
    <>{mainContent}</>
  ),
}));
jest.mock('../Chat/Surface', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
jest.mock('../Chat/Footer', () => ({ __esModule: true, default: () => null }));
jest.mock('~/components/Chat/Subagents/SharedSubagentActivityDialog', () => () => null);

describe('tenant ShareView', () => {
  it('uses tenant share endpoint and forks the tenant-scoped conversation', () => {
    render(
      <RecoilRoot>
        <MemoryRouter initialEntries={['/share/tenant/share-1']}>
          <Routes>
            <Route path="/share/tenant/:shareId" element={<ShareView isTenantShare />} />
          </Routes>
        </MemoryRouter>
      </RecoilRoot>,
    );

    expect(mockTenantFetch).toHaveBeenLastCalledWith(expect.objectContaining({ enabled: true }));
    expect(mockPublicFetch).toHaveBeenLastCalledWith(expect.objectContaining({ enabled: false }));
    expect(screen.getByTestId('tenant-messages')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'com_ui_fork_to_my_account' }));

    expect(mockTenantFork).toHaveBeenCalledWith({ shareId: 'share-1' });
    expect(mockPublicFork).not.toHaveBeenCalled();
  });
});
