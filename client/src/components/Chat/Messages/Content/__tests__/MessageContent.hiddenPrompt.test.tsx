import React from 'react';
import { render, screen } from '@testing-library/react';
import type { TMessage } from 'librechat-data-provider';

jest.mock('recoil', () => ({ atom: (value: unknown) => value, useRecoilValue: () => false }));
jest.mock('~/Providers', () => ({
  useMessageContext: () => ({ isSubmitting: false, isLatestMessage: false }),
}));
jest.mock('~/hooks', () => ({ useLocalize: () => (key: string) => key }));
jest.mock('~/store', () => ({
  __esModule: true,
  default: { enableUserMsgMarkdown: {}, collapseLongUserMessages: {} },
}));
jest.mock('~/hooks/Messages/useSmoothStreaming', () => ({
  __esModule: true,
  default: () => false,
}));
jest.mock('@phosphor-icons/react', () => ({
  Sparkle: () => <span data-testid="hidden-prompt-icon" />,
}));
jest.mock('../Container', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
jest.mock('../MarkdownLite', () => ({
  __esModule: true,
  default: ({ content }: { content: string }) => <>{content}</>,
}));
jest.mock('../Markdown', () => ({
  __esModule: true,
  default: ({ content }: { content: string }) => <>{content}</>,
}));
jest.mock('../Parts/CollapsibleText', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
jest.mock('../EditMessage', () => ({ __esModule: true, default: () => null }));
jest.mock('../Parts/Thinking', () => ({ __esModule: true, default: () => null }));
jest.mock('../Parts/EmptyText', () => ({ __esModule: true, default: () => null }));
jest.mock('~/components/Messages/Content/Error', () => ({ __esModule: true, default: () => null }));
jest.mock('../ToolCallLimitNotice', () => ({ __esModule: true, default: () => null }));

import MessageContent from '../MessageContent';

describe('MessageContent hidden prompt', () => {
  it('shows its badge once and suppresses duplicate raw prompt text', () => {
    const hiddenPromptName = 'Project briefing';
    const message = {
      messageId: 'message-1',
      metadata: { hiddenPrompt: { name: hiddenPromptName } },
    } as unknown as TMessage;

    render(
      <MessageContent
        ask={jest.fn()}
        edit={false}
        error={false}
        unfinished={false}
        isSubmitting={false}
        isLast={false}
        text={hiddenPromptName}
        message={message}
        enterEdit={() => undefined}
        isCreatedByUser={true}
        siblingIdx={0}
        setSiblingIdx={() => undefined}
      />,
    );

    expect(screen.getAllByText(hiddenPromptName)).toHaveLength(1);
    expect(screen.getByTestId('hidden-prompt-icon')).toBeInTheDocument();
  });
});
