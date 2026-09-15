import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import Fork from '../Fork';

const mockMutate = jest.fn();
let mockIsLoading = false;
jest.mock('~/data-provider', () => ({
  useDuplicateConversationMutation: () => ({ mutate: mockMutate, isLoading: mockIsLoading }),
}));
jest.mock('~/hooks', () => ({
  useLocalize: () => (key: string) => key,
  useNavigateToConvo: () => ({ navigateToConvo: jest.fn() }),
}));
jest.mock('@librechat/client', () => ({ useToastContext: () => ({ showToast: jest.fn() }) }));

describe('Fork duplicate action', () => {
  beforeEach(() => {
    mockIsLoading = false;
    mockMutate.mockClear();
  });
  it('duplicates its conversation when supported', () => {
    render(<Fork messageId="message-1" conversationId="conversation-1" forkingSupported />);
    fireEvent.click(screen.getByRole('button', { name: 'com_ui_duplicate' }));
    expect(mockMutate).toHaveBeenCalledWith({ conversationId: 'conversation-1' });
  });
  it('disables duplicate while loading', () => {
    mockIsLoading = true;
    render(<Fork messageId="message-1" conversationId="conversation-1" forkingSupported />);
    expect(screen.getByRole('button', { name: 'com_ui_duplicate' })).toBeDisabled();
  });
  it('does not render when forking is unavailable', () => {
    render(<Fork messageId="message-1" conversationId="conversation-1" forkingSupported={false} />);
    expect(screen.queryByRole('button')).toBeNull();
  });
});
