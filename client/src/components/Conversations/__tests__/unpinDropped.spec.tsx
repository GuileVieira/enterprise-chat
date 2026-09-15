import { renderHook } from '@testing-library/react';
import type { ConversationDragItem } from '../dnd';
import { useUnpinDroppedConversation } from '../dnd';

const mockPin = jest.fn();
const mockShowToast = jest.fn();

jest.mock('@librechat/client', () => ({
  useToastContext: () => ({ showToast: mockShowToast }),
}));

jest.mock('~/data-provider', () => ({
  usePinConversationMutation: () => ({ mutate: mockPin }),
}));

jest.mock('~/hooks', () => ({
  useLocalize: () => (key: string) => key,
}));

jest.mock('~/common', () => ({
  NotificationSeverity: { ERROR: 'error' },
}));

const item = (pinned: boolean, conversationId = 'c1'): ConversationDragItem => ({
  conversationId,
  pinned,
});

/* Dropping a chat on the Chats section asks for an ordinary chat, and a pinned
 * one is not that. */
describe('useUnpinDroppedConversation', () => {
  beforeEach(() => {
    mockPin.mockReset();
  });

  it('unpins the dropped conversation', () => {
    const { result } = renderHook(() => useUnpinDroppedConversation());

    result.current(item(true));

    expect(mockPin).toHaveBeenCalledWith(
      { conversationId: 'c1', pinned: false },
      expect.anything(),
    );
  });

  it('leaves a chat that is not pinned alone', () => {
    const { result } = renderHook(() => useUnpinDroppedConversation());

    result.current(item(false));

    expect(mockPin).not.toHaveBeenCalled();
  });

  /* A favorite row's drag item carries no conversation at all. */
  it('ignores a drag item with no conversation', () => {
    const { result } = renderHook(() => useUnpinDroppedConversation());

    result.current(item(true, ''));

    expect(mockPin).not.toHaveBeenCalled();
  });

  it('reports a failed unpin', () => {
    mockPin.mockImplementation((_payload, options) => options.onError());
    const { result } = renderHook(() => useUnpinDroppedConversation());

    result.current(item(true));

    expect(mockShowToast).toHaveBeenCalledWith({
      message: 'com_ui_unpin_error',
      severity: 'error',
      showIcon: true,
    });
  });
});
