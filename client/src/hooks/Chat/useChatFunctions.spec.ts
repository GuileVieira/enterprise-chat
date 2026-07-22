import { renderHook, act } from '@testing-library/react';
import { Constants } from 'librechat-data-provider';
import useChatFunctions from './useChatFunctions';

const mockNavigate = jest.fn();
const mockSetShowStopButton = jest.fn();
const mockResetLatestMultiMessage = jest.fn();
const mockSetFilesToDelete = jest.fn();

jest.mock('react-router-dom', () => ({
  useNavigate: jest.fn(() => mockNavigate),
}));

jest.mock('@tanstack/react-query', () => ({
  useQueryClient: jest.fn(() => ({
    getQueryData: jest.fn(() => undefined),
  })),
}));

jest.mock('recoil', () => ({
  useSetRecoilState: jest.fn((atom) => {
    if (atom === 'showStopButtonByIndex-0') {
      return mockSetShowStopButton;
    }
    return jest.fn();
  }),
  useResetRecoilState: jest.fn(() => mockResetLatestMultiMessage),
  useRecoilValue: jest.fn(() => false),
  useRecoilCallback: jest.fn((callback) =>
    callback({
      snapshot: {
        getLoadable: jest.fn(() => ({ state: 'hasValue', contents: [] })),
      },
      reset: jest.fn(),
    }),
  ),
}));

jest.mock('~/hooks/Files/useSetFilesToDelete', () => ({
  __esModule: true,
  default: jest.fn(() => mockSetFilesToDelete),
}));

jest.mock('~/hooks/Conversations/useGetSender', () => ({
  __esModule: true,
  default: jest.fn(() => jest.fn(() => 'Assistant')),
}));

jest.mock('~/utils', () => ({
  logger: {
    log: jest.fn(),
    dir: jest.fn(),
  },
  createDualMessageContent: jest.fn(() => []),
}));

jest.mock('~/store', () => ({
  __esModule: true,
  default: {
    isTemporary: 'isTemporary',
    isSubmittingFamily: (idx: number) => `isSubmittingFamily-${idx}`,
    showStopButtonByIndex: (idx: number) => `showStopButtonByIndex-${idx}`,
    latestMessageFamily: (idx: number) => `latestMessageFamily-${idx}`,
    pendingManualSkillsByConvoId: (convoId: string) => `pendingManualSkillsByConvoId-${convoId}`,
  },
  useGetEphemeralAgent: jest.fn(() => jest.fn(() => undefined)),
}));

jest.mock('~/data-provider', () => ({
  startupConfigKey: jest.fn(() => ['startupConfig']),
}));

jest.mock('~/hooks/Input/useUserKey', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    getExpiry: jest.fn(() => '2099-01-01T00:00:00.000Z'),
  })),
}));

jest.mock('~/hooks', () => ({
  useAuthContext: jest.fn(() => ({
    user: { id: 'user-1', name: 'Test User' },
  })),
}));

describe('useChatFunctions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const renderUseChatFunctions = (files = new Map()) => {
    const setFiles = jest.fn();
    const setMessages = jest.fn();
    const setSubmission = jest.fn();
    const setLatestMessage = jest.fn();

    const hook = renderHook(() =>
      useChatFunctions({
        files,
        setFiles,
        index: 0,
        setMessages,
        isSubmitting: false,
        latestMessage: null,
        setSubmission,
        setLatestMessage,
        getMessages: () => [],
        conversation: {
          conversationId: 'conv-1',
          endpoint: 'openAI',
          model: 'gpt-4',
        } as never,
      }),
    );

    return { ...hook, setFiles, setMessages, setSubmission, setLatestMessage };
  };

  it('does not submit empty text without files', () => {
    const { result, setSubmission } = renderUseChatFunctions();

    act(() => {
      result.current.ask({ text: '   ' });
    });

    expect(setSubmission).not.toHaveBeenCalled();
  });

  it('submits empty text when files are attached', () => {
    const files = new Map([
      [
        'file-1',
        {
          file_id: 'file-1',
          filepath: '/uploads/file-1.docx',
          type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        },
      ],
    ]);
    const { result, setFiles, setMessages, setSubmission } = renderUseChatFunctions(files);

    act(() => {
      result.current.ask({ text: '   ' });
    });

    expect(setFiles).toHaveBeenCalledWith(new Map());
    expect(setSubmission).toHaveBeenCalledTimes(1);
    expect(setMessages).toHaveBeenCalledTimes(1);
    const submission = setSubmission.mock.calls[0][0];
    expect(submission.userMessage.text).toBe('');
    expect(submission.userMessage.files).toEqual([
      {
        file_id: 'file-1',
        filepath: '/uploads/file-1.docx',
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        height: undefined,
        width: undefined,
      },
    ]);
    expect(submission.userMessage.parentMessageId).toBe(Constants.NO_PARENT);
  });
});
