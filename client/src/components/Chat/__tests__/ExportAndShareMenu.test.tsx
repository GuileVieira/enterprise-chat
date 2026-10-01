import React from 'react';
import { I18nextProvider } from 'react-i18next';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { MenuItemProps } from '~/common';
import '@testing-library/jest-dom';
import ExportAndShareMenu from '../ExportAndShareMenu';
import i18n from '~/locales/i18n';

let mockShareId: string | null = null;
let mockConversation = { conversationId: 'conversation-1', title: 'Project chat', projectId: 'p1' };
const mockDeleteMutate = jest.fn();

jest.mock('recoil', () => ({
  useRecoilValue: () => mockConversation,
}));

jest.mock('librechat-data-provider/react-query', () => ({
  useGetSharedLinkQuery: () => ({ data: { shareId: mockShareId } }),
}));

jest.mock('@ariakit/react', () => ({
  MenuButton: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
}));

jest.mock('@librechat/client', () => ({
  ...jest.requireActual('@librechat/client'),
  DropdownPopup: ({ trigger, items }: { trigger: React.ReactNode; items: MenuItemProps[] }) => (
    <>
      {trigger}
      {items
        .filter((item) => item.show !== false)
        .map((item, index) => (
          <button key={index} onClick={item.onClick}>
            {item.label}
          </button>
        ))}
    </>
  ),
  TooltipAnchor: ({ render }: { render: React.ReactNode }) => render,
  useMediaQuery: () => false,
  useToastContext: () => ({ showToast: jest.fn() }),
}));

jest.mock('~/data-provider', () => ({
  useUpdateConversationMutation: () => ({ mutateAsync: jest.fn(), isLoading: false }),
  useDeleteConversationMutation: () => ({ mutate: mockDeleteMutate, isLoading: false }),
}));

jest.mock('~/hooks', () => ({
  useHasAccess: () => true,
  useLocalize: () => (key: string) => key,
  useNewConvo: () => ({ newConversation: jest.fn() }),
}));

jest.mock('~/components/Nav/ExportConversation/ExportModal', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('~/components/Conversations/ConvoOptions', () => ({
  ShareButton: () => null,
}));

jest.mock('~/store', () => ({
  __esModule: true,
  default: { conversationByIndex: () => ({}) },
}));

describe('ExportAndShareMenu link status', () => {
  beforeEach(() => {
    mockShareId = null;
    mockConversation = { conversationId: 'conversation-1', title: 'Project chat', projectId: 'p1' };
    mockDeleteMutate.mockClear();
  });

  it('shows a blue circular indicator when the conversation has a link', () => {
    mockShareId = 'share-1';

    renderMenu();

    expect(screen.getByTestId('header-shared-link-indicator')).toHaveClass(
      'rounded-full',
      'bg-status-info',
      '-right-0.5',
      '-top-0.5',
      'size-2',
    );
    expect(screen.getByRole('button', { name: 'com_ui_export_share_link_active' })).toHaveAttribute(
      'aria-label',
      'com_ui_export_share_link_active',
    );
  });

  it('uses the default share control when the conversation has no link', () => {
    renderMenu();

    expect(screen.queryByTestId('header-shared-link-indicator')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'com_endpoint_export_share' })).toHaveAttribute(
      'aria-label',
      'com_endpoint_export_share',
    );
  });

  it('deletes the project conversation only after confirming in the existing dialog', () => {
    renderMenu();
    fireEvent.click(screen.getByRole('button', { name: 'com_ui_delete' }));
    expect(mockDeleteMutate).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toHaveTextContent('Project chat');
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'com_ui_delete' }),
    );
    expect(mockDeleteMutate).toHaveBeenCalledWith({
      conversationId: 'conversation-1',
      source: 'button',
      thread_id: undefined,
      endpoint: undefined,
    });
  });

  it('cancels without deleting', () => {
    renderMenu();
    fireEvent.click(screen.getByRole('button', { name: 'com_ui_delete' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(mockDeleteMutate).not.toHaveBeenCalled();
  });

  it.each(['new', 'search'])('does not offer deletion for %s', (conversationId) => {
    mockConversation = { ...mockConversation, conversationId };
    renderMenu();
    expect(screen.queryByRole('button', { name: 'com_ui_delete' })).not.toBeInTheDocument();
  });
});

function renderMenu() {
  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter>
        <QueryClientProvider client={new QueryClient()}>
          <ExportAndShareMenu isSharedButtonEnabled={true} />
        </QueryClientProvider>
      </MemoryRouter>
    </I18nextProvider>,
  );
}
