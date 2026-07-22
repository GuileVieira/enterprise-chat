import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ProjectConversationsTab from '../ProjectConversationsTab';

const mockNavigate = jest.fn();
const mockNewConversation = jest.fn();
const mockFetchNextPage = jest.fn();

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

jest.mock('~/data-provider', () => ({
  useConversationsInfiniteQuery: jest.fn(),
}));

jest.mock('~/hooks', () => ({
  useLocalize: () => (key) => key,
  useNewConvo: () => ({
    newConversation: mockNewConversation,
  }),
}));

jest.mock('~/utils', () => ({
  cn: (...classes) => classes.filter(Boolean).join(' '),
}));

import { useConversationsInfiniteQuery } from '~/data-provider';

const createQueryClient = () =>
  new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

function renderTab(props = {}) {
  const queryClient = createQueryClient();
  const project = {
    projectId: 'p1',
    name: 'Test Project',
    endpoint: 'openAI',
    model: 'gpt-4',
    ...props.project,
  };
  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <ProjectConversationsTab project={project} />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

describe('ProjectConversationsTab', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders loading state', () => {
    (useConversationsInfiniteQuery as jest.Mock).mockReturnValue({
      data: undefined,
      isFetchingNextPage: false,
      isLoading: true,
    });
    renderTab();
    expect(document.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('renders empty state', () => {
    (useConversationsInfiniteQuery as jest.Mock).mockReturnValue({
      data: { pages: [{ conversations: [], nextCursor: null }] },
      isFetchingNextPage: false,
      isLoading: false,
    });
    renderTab();
    expect(screen.getByText('com_ui_no_conversations_in_project')).toBeInTheDocument();
  });

  it('renders list of conversations', () => {
    (useConversationsInfiniteQuery as jest.Mock).mockReturnValue({
      data: {
        pages: [
          {
            conversations: [
              {
                conversationId: 'c1',
                title: 'Conversation One',
                updatedAt: '2024-01-15T00:00:00Z',
              },
              {
                conversationId: 'c2',
                title: 'Conversation Two',
                updatedAt: '2024-01-16T00:00:00Z',
              },
            ],
            nextCursor: null,
          },
        ],
      },
      isFetchingNextPage: false,
      isLoading: false,
    });
    renderTab();
    expect(screen.getByText('Conversation One')).toBeInTheDocument();
    expect(screen.getByText('Conversation Two')).toBeInTheDocument();
  });

  it('navigates on conversation click', () => {
    (useConversationsInfiniteQuery as jest.Mock).mockReturnValue({
      data: {
        pages: [
          {
            conversations: [{ conversationId: 'c1', title: 'Conversation One' }],
            nextCursor: null,
          },
        ],
      },
      isFetchingNextPage: false,
      isLoading: false,
    });
    renderTab();
    fireEvent.click(screen.getByText('Conversation One'));
    expect(mockNavigate).toHaveBeenCalledWith('/c/c1');
  });

  it('calls newConversation with project defaults on new chat', () => {
    (useConversationsInfiniteQuery as jest.Mock).mockReturnValue({
      data: { pages: [{ conversations: [], nextCursor: null }] },
      isFetchingNextPage: false,
      isLoading: false,
    });
    renderTab();
    fireEvent.click(screen.getByText('com_ui_new_chat_in_project'));
    expect(mockNewConversation).toHaveBeenCalledWith({
      template: {
        projectId: 'p1',
        endpoint: 'openAI',
        model: 'gpt-4',
      },
    });
  });

  it('calls newConversation without endpoint/model when not set', () => {
    (useConversationsInfiniteQuery as jest.Mock).mockReturnValue({
      data: { pages: [{ conversations: [], nextCursor: null }] },
      isFetchingNextPage: false,
      isLoading: false,
    });
    renderTab({ project: { projectId: 'p2', name: 'Minimal Project', endpoint: '', model: '' } });
    fireEvent.click(screen.getByText('com_ui_new_chat_in_project'));
    expect(mockNewConversation).toHaveBeenCalledWith({
      template: {
        projectId: 'p2',
      },
    });
  });

  it('shows load more button when there are more pages', () => {
    (useConversationsInfiniteQuery as jest.Mock).mockReturnValue({
      data: {
        pages: [
          {
            conversations: [{ conversationId: 'c1', title: 'Conversation One' }],
            nextCursor: 'next-cursor',
          },
        ],
      },
      fetchNextPage: mockFetchNextPage,
      isFetchingNextPage: false,
      isLoading: false,
    });
    renderTab();
    fireEvent.click(screen.getByText('com_ui_load_more'));
    expect(mockFetchNextPage).toHaveBeenCalled();
  });

  it('shows loading text when fetching next page', () => {
    (useConversationsInfiniteQuery as jest.Mock).mockReturnValue({
      data: {
        pages: [
          {
            conversations: [{ conversationId: 'c1', title: 'Conversation One' }],
            nextCursor: 'next-cursor',
          },
        ],
      },
      fetchNextPage: mockFetchNextPage,
      isFetchingNextPage: true,
      isLoading: false,
    });
    renderTab();
    expect(screen.getByText('com_ui_loading')).toBeInTheDocument();
  });

  it('does not show load more when there is no next page', () => {
    (useConversationsInfiniteQuery as jest.Mock).mockReturnValue({
      data: {
        pages: [
          {
            conversations: [{ conversationId: 'c1', title: 'Conversation One' }],
            nextCursor: null,
          },
        ],
      },
      isFetchingNextPage: false,
      isLoading: false,
    });
    renderTab();
    expect(screen.queryByText('com_ui_load_more')).not.toBeInTheDocument();
  });
});
