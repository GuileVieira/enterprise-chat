import React from 'react';
import { RecoilRoot } from 'recoil';
import '@testing-library/jest-dom/extend-expect';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { MutableSnapshot } from 'recoil';
import Convo from '../Convo';

jest.mock('~/hooks', () => ({
  useLocalize: () => (key: string) => key,
  useNavigateToConvo: () => ({ navigateToConvo: jest.fn() }),
  useShiftKey: () => false,
}));

jest.mock('~/data-provider', () => ({
  useUpdateConversationMutation: () => ({
    mutateAsync: jest.fn(),
  }),
  useGetEndpointsQuery: () => ({ data: {} }),
}));

jest.mock('~/utils', () => ({
  cn: (...classes: unknown[]) => classes.filter(Boolean).join(' '),
  logger: { error: jest.fn() },
}));

jest.mock('~/store', () => {
  const { atom, selector } = jest.requireActual('recoil');
  return {
    __esModule: true,
    default: {
      allConversationsSelector: selector({
        key: 'mock-allConversationsSelector',
        get: () => [],
      }),
      conversationByIndex: () => atom({ key: 'mock-conversationByIndex', default: null }),
    },
  };
});

jest.mock('@librechat/client', () => ({
  useToastContext: () => ({ showToast: jest.fn() }),
  useMediaQuery: () => false,
}));

jest.mock('../ConvoOptions', () => ({
  __esModule: true,
  default: () => <div data-testid="convo-options" />,
}));

jest.mock('../ConvoLink', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock('~/components/Endpoints/EndpointIcon', () => ({
  __esModule: true,
  default: () => <div data-testid="endpoint-icon" />,
}));

const createQueryClient = () =>
  new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

function renderConvo(conversation: Record<string, unknown>) {
  const queryClient = createQueryClient();
  return render(
    <RecoilRoot>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <Convo
            conversation={conversation as unknown as Parameters<typeof Convo>[0]['conversation']}
            retainView={jest.fn()}
            toggleNav={jest.fn()}
          />
        </MemoryRouter>
      </QueryClientProvider>
    </RecoilRoot>,
  );
}

describe('Convo project indicator', () => {
  it('shows project folder icon when conversation has projectId', () => {
    renderConvo({
      conversationId: 'c1',
      title: 'Test Conversation',
      projectId: 'p1',
    });

    const projectBadge = screen.getByLabelText('com_ui_project_badge');
    expect(projectBadge).toBeInTheDocument();
  });

  it('does not show project folder icon when conversation has no projectId', () => {
    renderConvo({
      conversationId: 'c1',
      title: 'Test Conversation',
    });

    expect(screen.queryByLabelText('com_ui_project_badge')).not.toBeInTheDocument();
  });
});
