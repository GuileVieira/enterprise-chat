import React from 'react';
import { render, screen } from '@testing-library/react';
import { EModelEndpoint } from 'librechat-data-provider';
import type { TConversation, TMessage } from 'librechat-data-provider';

jest.mock('recoil', () => ({
  useRecoilState: jest.fn(() => [true, jest.fn()]),
}));

jest.mock('~/store', () => ({
  __esModule: true,
  default: {
    textToSpeech: {},
  },
}));

jest.mock('librechat-data-provider/react-query', () => ({
  useGetCustomConfigSpeechQuery: jest.fn(() => ({ data: { speech: { textToSpeech: true } } })),
}));

jest.mock('~/hooks', () => ({
  useGenerationsByLatest: jest.fn(() => ({
    hideEditButton: false,
    regenerateEnabled: true,
    continueSupported: false,
    forkingSupported: true,
    isEditableEndpoint: true,
  })),
  useLocalize: jest.fn(() => (key: string) => key),
}));

jest.mock('~/utils', () => ({
  cn: (...classes: Array<string | false | undefined>) => classes.filter(Boolean).join(' '),
  isSpeechFeatureEnabled: jest.fn(() => true),
}));

jest.mock('../Fork', () => ({
  __esModule: true,
  Fork: () => <button type="button" data-testid="fork-button" />,
  default: () => <button type="button" data-testid="fork-button" />,
}));

jest.mock('../MessageAudio', () => ({
  __esModule: true,
  default: () => <button type="button" data-testid="audio-button" />,
}));

jest.mock('../Feedback', () => ({
  __esModule: true,
  default: () => <div data-testid="feedback-buttons" />,
}));

import HoverButtons from '../HoverButtons';

const conversation = {
  conversationId: 'conv-1',
  endpoint: EModelEndpoint.agents,
  endpointType: EModelEndpoint.agents,
} as TConversation;

const message = {
  messageId: 'msg-1',
  conversationId: 'conv-1',
  parentMessageId: null,
  text: 'Assistant response',
  content: 'Assistant response',
  isCreatedByUser: false,
  finish_reason: 'stop',
} as TMessage;

describe('HoverButtons', () => {
  it('renders local fork in the message toolbar when supported', () => {
    render(
      <HoverButtons
        index={0}
        isEditing={false}
        enterEdit={jest.fn()}
        copyToClipboard={jest.fn()}
        conversation={conversation}
        isSubmitting={false}
        message={message}
        regenerate={jest.fn()}
        handleContinue={jest.fn()}
        latestMessageId="msg-1"
        isLast
        handleFeedback={jest.fn()}
      />,
    );

    expect(screen.queryByTestId('audio-button')).not.toBeInTheDocument();
    expect(screen.getByTestId('fork-button')).toBeInTheDocument();
    expect(screen.getByTitle('com_ui_copy_to_clipboard')).toBeInTheDocument();
    expect(screen.getByTitle('com_ui_edit')).toBeInTheDocument();
    expect(screen.getByTestId('feedback-buttons')).toBeInTheDocument();
    expect(screen.getByTitle('com_ui_regenerate')).toBeInTheDocument();
  });
});
