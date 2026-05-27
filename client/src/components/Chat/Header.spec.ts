import { shouldUpdateExistingConversationProject } from './Header';

describe('shouldUpdateExistingConversationProject', () => {
  it('updates an existing conversation project instead of starting a new conversation', () => {
    expect(shouldUpdateExistingConversationProject({ conversationId: 'conversation-1' })).toBe(
      true,
    );
  });

  it('does not update project association for new or search conversations', () => {
    expect(shouldUpdateExistingConversationProject({ conversationId: 'new' })).toBe(false);
    expect(shouldUpdateExistingConversationProject({ conversationId: 'search' })).toBe(false);
  });
});
