import { renderHook, act } from '@testing-library/react';
import { ContentTypes } from 'librechat-data-provider';

import useContentHandler from '~/hooks/SSE/useContentHandler';
import type { EventSubmission, TMessage } from 'librechat-data-provider';

jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({}),
}));

const buildSubmission = (): EventSubmission =>
  ({
    initialResponse: {
      messageId: 'response-1',
      conversationId: 'conversation-1',
      parentMessageId: 'message-1',
      text: '',
      content: [],
    },
  }) as EventSubmission;

describe('useContentHandler', () => {
  it('ignores malformed content events without a type', () => {
    const setMessages = jest.fn();
    const getMessages = jest.fn(() => [] as TMessage[]);

    const { result } = renderHook(() => useContentHandler({ setMessages, getMessages }));

    expect(() => {
      act(() => {
        result.current.contentHandler({
          data: {
            messageId: 'response-1',
            conversationId: 'conversation-1',
            index: 0,
          } as Parameters<typeof result.current.contentHandler>[0]['data'],
          submission: buildSubmission(),
        });
      });
    }).not.toThrow();

    expect(setMessages).not.toHaveBeenCalled();
  });

  it('ignores content events without a matching part payload', () => {
    const setMessages = jest.fn();
    const getMessages = jest.fn(() => [] as TMessage[]);

    const { result } = renderHook(() => useContentHandler({ setMessages, getMessages }));

    act(() => {
      result.current.contentHandler({
        data: {
          type: ContentTypes.TEXT,
          messageId: 'response-1',
          conversationId: 'conversation-1',
          index: 0,
        } as Parameters<typeof result.current.contentHandler>[0]['data'],
        submission: buildSubmission(),
      });
    });

    expect(setMessages).not.toHaveBeenCalled();
  });
});
