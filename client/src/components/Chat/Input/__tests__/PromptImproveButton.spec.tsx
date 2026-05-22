import React from 'react';
import userEvent from '@testing-library/user-event';
import { render, screen, waitFor } from '@testing-library/react';

const mockMutateAsync = jest.fn();
const mockShowToast = jest.fn();

jest.mock('~/data-provider', () => ({
  useImprovePromptMutation: () => ({
    mutateAsync: mockMutateAsync,
    isLoading: false,
  }),
}));

jest.mock('~/hooks', () => ({
  useLocalize: () => (key: string) => key,
}));

jest.mock('@librechat/client', () => ({
  Spinner: ({ className }: { className?: string }) => (
    <span className={className} data-testid="prompt-improve-spinner" />
  ),
  TooltipAnchor: ({ description, render }: { description: string; render: React.ReactNode }) => (
    <span data-testid="prompt-improve-tooltip" data-description={description}>
      {render}
    </span>
  ),
  useToastContext: () => ({
    showToast: mockShowToast,
  }),
}));

import PromptImproveButton from '../PromptImproveButton';

describe('PromptImproveButton', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it.each(['', 'one', 'one two'])('is disabled for fewer than three words: "%s"', (text) => {
    render(
      <PromptImproveButton
        text={text}
        disabled={false}
        setText={jest.fn()}
        textAreaRef={{ current: document.createElement('textarea') }}
      />,
    );

    expect(screen.getByRole('button', { name: 'com_ui_improve_prompt' })).toBeDisabled();
  });

  it('calls mutation with current text, replaces textarea, and keeps focus', async () => {
    const user = userEvent.setup();
    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);
    textarea.focus();
    const setText = jest.fn();
    let resolveMutation: (value: { improvedText: string; cached: boolean }) => void = () => {};
    mockMutateAsync.mockReturnValue(
      new Promise((resolve) => {
        resolveMutation = resolve;
      }),
    );

    render(
      <PromptImproveButton
        text="write better prompt"
        disabled={false}
        setText={setText}
        textAreaRef={{ current: textarea }}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'com_ui_improve_prompt' }));

    expect(screen.queryByText('com_ui_improving_prompt')).not.toBeInTheDocument();
    expect(screen.getByTestId('prompt-improve-spinner')).toBeInTheDocument();
    expect(screen.getByTestId('prompt-improve-tooltip')).toHaveAttribute(
      'data-description',
      'com_ui_improving_prompt',
    );
    expect(mockMutateAsync).toHaveBeenCalledWith({ text: 'write better prompt' });
    resolveMutation({ improvedText: 'Improved prompt text', cached: false });
    await waitFor(() => {
      expect(setText).toHaveBeenCalledWith('Improved prompt text');
    });
    expect(mockShowToast).toHaveBeenCalledWith({
      message: 'com_ui_prompt_improved',
      status: 'success',
    });
    expect(document.activeElement).toBe(textarea);
  });

  it('preserves original text when mutation fails', async () => {
    const user = userEvent.setup();
    const setText = jest.fn();
    mockMutateAsync.mockRejectedValue(new Error('network'));

    render(
      <PromptImproveButton
        text="write better prompt"
        disabled={false}
        setText={setText}
        textAreaRef={{ current: document.createElement('textarea') }}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'com_ui_improve_prompt' }));

    expect(setText).not.toHaveBeenCalled();
    expect(mockShowToast).toHaveBeenCalledWith({
      message: 'com_ui_improve_prompt_failed',
      status: 'error',
    });
    expect(screen.queryByText('com_ui_improve_prompt_failed')).not.toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByTestId('prompt-improve-tooltip')).toHaveAttribute(
        'data-description',
        'com_ui_improve_prompt_failed',
      );
    });
  });

  it('stays disabled after improving until three more words are added', async () => {
    const user = userEvent.setup();
    const setText = jest.fn();
    mockMutateAsync.mockResolvedValue({ improvedText: 'Improved prompt text', cached: false });
    const { rerender } = render(
      <PromptImproveButton
        text="write better prompt"
        disabled={false}
        setText={setText}
        textAreaRef={{ current: document.createElement('textarea') }}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'com_ui_improve_prompt' }));
    await waitFor(() => {
      expect(setText).toHaveBeenCalledWith('Improved prompt text');
    });

    rerender(
      <PromptImproveButton
        text="Improved prompt text plus one"
        disabled={false}
        setText={setText}
        textAreaRef={{ current: document.createElement('textarea') }}
      />,
    );

    expect(screen.getByRole('button', { name: 'com_ui_improve_prompt' })).toBeDisabled();
    expect(screen.getByTestId('prompt-improve-tooltip')).toHaveAttribute(
      'data-description',
      'com_ui_improve_prompt_add_words',
    );

    rerender(
      <PromptImproveButton
        text="Improved prompt text plus one two three"
        disabled={false}
        setText={setText}
        textAreaRef={{ current: document.createElement('textarea') }}
      />,
    );

    expect(screen.getByRole('button', { name: 'com_ui_improve_prompt' })).not.toBeDisabled();
  });
});
