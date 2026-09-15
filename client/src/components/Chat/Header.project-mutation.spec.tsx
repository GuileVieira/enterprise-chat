import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { RecoilRoot, useRecoilValue, useSetRecoilState } from 'recoil';
import { act, fireEvent, render, screen } from '@testing-library/react';
import type { TConversation } from 'librechat-data-provider';
import Header from './Header';
import store from '~/store';

const mockMutate = jest.fn();
const conversation = (conversationId: string): TConversation => ({
  conversationId,
  endpoint: null,
  title: 'Test conversation',
  createdAt: '2026-09-14T00:00:00Z',
  updatedAt: '2026-09-14T00:00:00Z',
});

jest.mock('@ariakit/react', () => ({
  MenuButton: ({ children, ...props }: React.ComponentProps<'button'>) => (
    <button {...props}>{children}</button>
  ),
}));

jest.mock('@librechat/client', () => ({
  DropdownPopup: ({
    trigger,
    items,
  }: {
    trigger: React.ReactNode;
    items: Array<{ id: string; label: string; onClick?: () => void }>;
  }) => (
    <div>
      {trigger}
      {items.map(
        (item) =>
          item.onClick && (
            <button key={item.id} type="button" onClick={item.onClick}>
              {item.label}
            </button>
          ),
      )}
    </div>
  ),
}));

jest.mock('./Menus', () => ({
  HeaderMenu: () => null,
  NewChat: () => null,
  OpenSidebar: () => null,
  PresetsMenu: () => null,
}));
jest.mock('./Menus/BookmarkMenu', () => () => null);
jest.mock('./Menus/Endpoints/ModelSelector', () => () => null);
jest.mock('./TemporaryChat', () => ({
  TemporaryChat: () => null,
  TemporaryChatIndicator: () => null,
}));
jest.mock('./AddMultiConvo', () => () => null);
jest.mock('./ExportAndShareMenu', () => () => null);
jest.mock('./Trace', () => ({
  TraceButton: () => null,
  useTraceControl: () => ({ show: false, open: jest.fn() }),
}));
jest.mock('./SubagentThreadLink', () => () => null);
jest.mock('~/hooks', () => ({ useHasAccess: () => true, useLocalize: () => (key: string) => key }));
jest.mock('~/data-provider', () => ({
  useGetProjectFiles: () => ({ data: [] }),
  useGetStartupConfig: () => ({ data: { interface: {} } }),
  useMoveConversationToProjectMutation: () => ({ mutate: mockMutate }),
  useProjectByIdQuery: () => ({ data: undefined }),
  useProjectsQuery: () => ({
    data: [{ projectId: 'project-2', name: 'Project two' }],
    isLoading: false,
  }),
}));

function SwitchConversation() {
  const setConversation = useSetRecoilState(store.conversationByIndex(0));
  return (
    <button type="button" onClick={() => setConversation(conversation('conversation-2'))}>
      {conversation('conversation-2').conversationId}
    </button>
  );
}

function ActiveConversation() {
  const conversation = useRecoilValue(store.conversationByIndex(0));
  return <output>{conversation?.conversationId}</output>;
}

describe('Header project mutation', () => {
  it('does not replace a newer active conversation when a project move resolves late', () => {
    render(
      <RecoilRoot
        initializeState={({ set }) =>
          set(store.conversationByIndex(0), conversation('conversation-1'))
        }
      >
        <MemoryRouter>
          <Header />
          <SwitchConversation />
          <ActiveConversation />
        </MemoryRouter>
      </RecoilRoot>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Project two' }));
    fireEvent.click(screen.getByRole('button', { name: 'conversation-2' }));
    const [, options] = mockMutate.mock.calls[0];
    act(() => {
      options.onSuccess({ conversationId: 'conversation-1', projectId: 'project-2' });
    });

    expect(screen.getByRole('status')).toHaveTextContent('conversation-2');
  });
});
