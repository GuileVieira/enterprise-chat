import { GitFork } from '@phosphor-icons/react';
import { useToastContext } from '@librechat/client';
import { useDuplicateConversationMutation } from '~/data-provider';
import { useLocalize, useNavigateToConvo } from '~/hooks';
import { cn } from '~/utils';

export default function Fork({
  conversationId: _convoId,
  forkingSupported = false,
  isLast = false,
}: {
  messageId: string;
  conversationId: string | null;
  forkingSupported?: boolean;
  latestMessageId?: string;
  isLast?: boolean;
}) {
  const localize = useLocalize();
  const { showToast } = useToastContext();
  const { navigateToConvo } = useNavigateToConvo();
  const conversationId = _convoId ?? '';

  const duplicateConvo = useDuplicateConversationMutation({
    onSuccess: (data) => {
      navigateToConvo(data.conversation);
      showToast({
        message: localize('com_ui_duplication_success'),
        status: 'success',
      });
    },
    onMutate: () => {
      showToast({
        message: localize('com_ui_duplication_processing'),
        status: 'info',
      });
    },
    onError: () => {
      showToast({
        message: localize('com_ui_fork_error'),
        status: 'error',
      });
    },
  });

  if (!forkingSupported || !conversationId) {
    return null;
  }

  const buttonStyle = cn(
    'hover-button rounded-lg p-1.5 text-text-secondary-alt',
    'hover:text-text-primary hover:bg-surface-hover',
    'md:group-hover:visible md:group-focus-within:visible md:group-[.final-completion]:visible',
    !isLast && 'md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100',
    'focus-visible:ring-2 focus-visible:ring-black dark:focus-visible:ring-white focus-visible:outline-none',
    duplicateConvo.isLoading && 'cursor-default opacity-70',
  );

  return (
    <button
      className={buttonStyle}
      type="button"
      disabled={duplicateConvo.isLoading}
      title={localize('com_ui_duplicate')}
      aria-label={localize('com_ui_duplicate')}
      onClick={() => duplicateConvo.mutate({ conversationId })}
    >
      <GitFork size={20} aria-hidden="true" />
    </button>
  );
}
