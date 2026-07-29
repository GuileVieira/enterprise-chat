const mockAsk = jest.fn();
const mockReset = jest.fn();
const mockGetMessages = jest.fn();
const mockSetMessages = jest.fn();
const mockSetActiveHiddenPrompt = jest.fn();
let mockLatestMessage: unknown = null;
let mockActiveHiddenPrompt: unknown = null;
let mockAddedConvo: unknown = null;
let mockFiles: Map<string, unknown> = new Map();

jest.mock('recoil', () => ({
  useRecoilValue: jest.fn((atom) => {
    if (atom === 'latestMessageFamily-0') {
      return mockLatestMessage;
    }
    if (atom === 'activeHiddenPromptByIndex-0') {
      return mockActiveHiddenPrompt;
    }
    return undefined;
  }),
  useSetRecoilState: jest.fn(() => mockSetActiveHiddenPrompt),
}));

jest.mock('~/store', () => ({
  latestMessageFamily: (idx: number) => `latestMessageFamily-${idx}`,
  activeHiddenPromptByIndex: (idx: number) => `activeHiddenPromptByIndex-${idx}`,
}));

jest.mock('~/Providers', () => ({
  useChatContext: jest.fn(() => ({
    ask: mockAsk,
    index: 0,
    files: mockFiles,
    getMessages: mockGetMessages,
    setMessages: mockSetMessages,
  })),
  useChatFormContext: jest.fn(() => ({
    reset: mockReset,
  })),
  useAddedChatContext: jest.fn(() => ({
    conversation: mockAddedConvo,
  })),
}));

jest.mock('~/hooks/AuthContext', () => ({
  useAuthContext: jest.fn(() => ({
    user: { id: 'user-1', name: 'Test User' },
  })),
}));

jest.mock('librechat-data-provider', () => ({
  replaceSpecialVars: jest.fn(({ text }) => text),
}));

import { renderHook, act } from '@testing-library/react';
import useSubmitMessage from './useSubmitMessage';

describe('useSubmitMessage', () => {
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    mockLatestMessage = null;
    mockActiveHiddenPrompt = null;
    mockAddedConvo = null;
    mockFiles = new Map();
    mockGetMessages.mockReturnValue([]);
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('does not submit empty text without a hidden prompt', () => {
    const { result } = renderHook(() => useSubmitMessage());

    act(() => {
      result.current.submitMessage({ text: '   ' });
    });

    expect(mockAsk).not.toHaveBeenCalled();
    expect(mockReset).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith('No message text provided to submitMessage');
  });

  it('submits trimmed text', () => {
    const { result } = renderHook(() => useSubmitMessage());

    act(() => {
      result.current.submitMessage({ text: '  hello  ' });
    });

    expect(mockAsk).toHaveBeenCalledWith(
      { text: 'hello', hiddenPromptContext: null },
      { addedConvo: undefined },
    );
    expect(mockSetActiveHiddenPrompt).toHaveBeenCalledWith(null);
    expect(mockReset).toHaveBeenCalled();
  });

  it('submits empty text when files are attached', () => {
    mockFiles = new Map([['file-1', { file_id: 'file-1' }]]);
    const { result } = renderHook(() => useSubmitMessage());

    act(() => {
      result.current.submitMessage({ text: '   ' });
    });

    expect(mockAsk).toHaveBeenCalledWith(
      { text: '', hiddenPromptContext: null },
      { addedConvo: undefined },
    );
    expect(mockReset).toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('allows empty visible text when a hidden prompt is active', () => {
    mockActiveHiddenPrompt = { name: 'Project DNA', content: 'Use project context' };
    const { result } = renderHook(() => useSubmitMessage());

    act(() => {
      result.current.submitMessage({ text: '' });
    });

    expect(mockAsk).toHaveBeenCalledWith(
      { text: 'Project DNA', hiddenPromptContext: mockActiveHiddenPrompt },
      { addedConvo: undefined },
    );
    expect(mockReset).toHaveBeenCalled();
  });
});
