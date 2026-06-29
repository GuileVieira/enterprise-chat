import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RecoilRoot, useRecoilValue } from 'recoil';
import ProjectsPanel from '../ProjectsPanel';
import store from '~/store';

const mockNavigate = jest.fn();
const mockNavigateToConvo = jest.fn();
const mockNewConversation = jest.fn();
const mockSelectedProjectObserver = jest.fn();

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
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <RecoilRoot>
          <SelectedProjectObserver />
          <ProjectsPanel />
        </RecoilRoot>
      </QueryClientProvider>
    </MemoryRouter>,
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
});
