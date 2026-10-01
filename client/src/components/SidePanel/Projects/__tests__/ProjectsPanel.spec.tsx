import React from 'react';
import { I18nextProvider } from 'react-i18next';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RecoilRoot, useRecoilValue } from 'recoil';
import ProjectsPanel from '../ProjectsPanel';
import store from '~/store';
import i18n from '~/locales/i18n';

const mockNavigate = jest.fn();
const mockNavigateToConvo = jest.fn();
const mockNewConversation = jest.fn();
const mockSelectedProjectObserver = jest.fn();
const mockDeleteMutate = jest.fn();

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
  useParams: () => ({ conversationId: 'current-convo' }),
}));

jest.mock('~/data-provider', () => ({
  useProjectsQuery: jest.fn(),
  useProjectByIdQuery: jest.fn(),
  useUpdateConversationMutation: () => ({
    mutateAsync: jest.fn(),
  }),
  useConversationsInfiniteQuery: jest.fn(),
  useDeleteConversationMutation: () => ({ mutate: mockDeleteMutate, isLoading: false }),
}));

jest.mock('~/hooks', () => ({
  useLocalize: () => (key: string) => key,
  useNewConvo: () => ({
    newConversation: mockNewConversation,
  }),
  useNavigateToConvo: () => ({
    navigateToConvo: mockNavigateToConvo,
  }),
}));

jest.mock('~/utils', () => ({
  clearMessagesCache: jest.fn(),
  cn: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' '),
}));

import {
  useProjectsQuery,
  useProjectByIdQuery,
  useConversationsInfiniteQuery,
} from '~/data-provider';

const createQueryClient = () =>
  new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

function SelectedProjectObserver() {
  const selectedProjectId = useRecoilValue(store.selectedProjectId);
  mockSelectedProjectObserver(selectedProjectId);
  return null;
}

function renderPanel() {
  const queryClient = createQueryClient();
  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>
          <RecoilRoot>
            <SelectedProjectObserver />
            <ProjectsPanel />
          </RecoilRoot>
        </QueryClientProvider>
      </MemoryRouter>
    </I18nextProvider>,
  );
}

describe('ProjectsPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useProjectsQuery as jest.Mock).mockReturnValue({
      data: [{ projectId: 'p1', name: 'Project Alpha' }],
    });
    (useProjectByIdQuery as jest.Mock).mockReturnValue({
      data: { projectId: 'p1', name: 'Project Alpha', endpoint: 'openAI', model: 'gpt-4o' },
    });
    (useConversationsInfiniteQuery as jest.Mock).mockReturnValue({
      data: {
        pages: [
          {
            conversations: [{ conversationId: 'c1', title: 'Conversation One' }],
            nextCursor: null,
          },
        ],
      },
      isLoading: false,
    });
  });

  it('selects the project and hydrates the conversation when opening project conversation', () => {
    renderPanel();

    fireEvent.click(screen.getByText('Project Alpha'));
    fireEvent.click(screen.getByText('Conversation One'));

    expect(mockSelectedProjectObserver).toHaveBeenLastCalledWith('p1');
    expect(mockNavigateToConvo).toHaveBeenCalledWith(
      { conversationId: 'c1', title: 'Conversation One', projectId: 'p1' },
      { currentConvoId: 'current-convo' },
    );
    expect(mockNavigate).not.toHaveBeenCalledWith('/c/c1');
  });

  it('shows project details before new project chat inside the expanded folder', () => {
    renderPanel();

    fireEvent.click(screen.getByText('Project Alpha'));

    const detailsButton = screen.getByRole('button', { name: 'com_ui_details' });
    const newChatButton = screen.getByRole('button', { name: 'com_ui_new_chat_in_project' });

    expect(
      detailsButton.compareDocumentPosition(newChatButton) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('confirms deleting the selected project row without opening its chat', () => {
    renderPanel();
    fireEvent.click(screen.getByText('Project Alpha'));
    fireEvent.click(screen.getByRole('button', { name: 'com_ui_delete_conversation_tooltip' }));
    expect(mockNavigateToConvo).not.toHaveBeenCalled();
    expect(mockDeleteMutate).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toHaveTextContent('Conversation One');
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'com_ui_delete' }),
    );
    expect(mockDeleteMutate).toHaveBeenCalledWith({
      conversationId: 'c1',
      source: 'button',
      thread_id: undefined,
      endpoint: undefined,
    });
  });

  it('cancels deleting a project row and restores focus', async () => {
    renderPanel();
    fireEvent.click(screen.getByText('Project Alpha'));
    const trigger = screen.getByRole('button', { name: 'com_ui_delete_conversation_tooltip' });
    fireEvent.click(trigger);
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(mockDeleteMutate).not.toHaveBeenCalled();
    expect(screen.getByText('Conversation One')).toBeInTheDocument();
    await waitFor(() => expect(trigger).toHaveFocus());
  });
});
