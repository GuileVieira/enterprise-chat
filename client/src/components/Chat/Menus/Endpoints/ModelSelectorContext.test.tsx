import { render } from '@testing-library/react';
import { PermissionBits } from 'librechat-data-provider';
import { ModelSelectorProvider } from './ModelSelectorContext';

const mockUseListAgentsQuery = jest.fn();

jest.mock('~/hooks', () => ({
  useAgentDefaultPermissionLevel: () =>
    jest.requireActual('librechat-data-provider').PermissionBits.EDIT,
  useSelectorEffects: jest.fn(),
  useKeyDialog: () => ({
    handleOpenKeyDialog: jest.fn(),
    keyDialogOpen: false,
    onOpenChange: jest.fn(),
  }),
  useEndpoints: () => ({
    mappedEndpoints: [],
    endpointRequiresUserKey: () => false,
  }),
  useLocalize: () => (key: string) => key,
}));

jest.mock('~/Providers', () => ({
  useAgentsMapContext: () => ({}),
  useAssistantsMapContext: () => ({}),
  useLiveAnnouncer: () => ({
    announcePolite: jest.fn(),
  }),
}));

jest.mock('~/data-provider', () => ({
  useGetEndpointsQuery: () => ({ data: {} }),
  useListAgentsQuery: (...args: unknown[]) => mockUseListAgentsQuery(...args),
}));

jest.mock('~/hooks/Input/useSelectMention', () => ({
  __esModule: true,
  default: () => ({
    onSelectEndpoint: jest.fn(),
    onSelectSpec: jest.fn(),
  }),
}));

jest.mock('./ModelSelectorChatContext', () => ({
  useModelSelectorChatContext: () => ({
    endpoint: null,
    model: null,
    spec: null,
    agent_id: null,
    assistant_id: null,
    getConversation: jest.fn(),
    newConversation: jest.fn(),
  }),
}));

describe('ModelSelectorProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseListAgentsQuery.mockReturnValue({ data: { data: [] } });
  });

  it('loads selectable agents with VIEW permission even when builder defaults require EDIT', () => {
    render(
      <ModelSelectorProvider startupConfig={undefined}>
        <div />
      </ModelSelectorProvider>,
    );

    expect(mockUseListAgentsQuery).toHaveBeenCalledWith(
      { requiredPermission: PermissionBits.VIEW },
      expect.objectContaining({
        select: expect.any(Function),
      }),
    );
  });
});
