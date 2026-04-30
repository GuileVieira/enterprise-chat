import { useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageSquare, Plus } from 'lucide-react';
import type { TConversation, TProject } from 'librechat-data-provider';
import { useConversationsInfiniteQuery } from '~/data-provider';
import { useLocalize, useNewConvo } from '~/hooks';
import { cn } from '~/utils';

function ConversationItem({
  conversationId: _conversationId,
  title,
  updatedAt,
  onClick,
}: {
  conversationId: string;
  title: string;
  updatedAt?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-sm text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
    >
      <MessageSquare className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
      <div className="flex flex-col items-start overflow-hidden">
        <span className="truncate">{title || 'Untitled'}</span>
        {updatedAt && (
          <span className="text-xs text-text-tertiary">
            {new Date(updatedAt).toLocaleDateString()}
          </span>
        )}
      </div>
    </button>
  );
}

export default function ProjectConversationsTab({ project }: { project: TProject }) {
  const localize = useLocalize();
  const navigate = useNavigate();
  const { newConversation } = useNewConvo();

  const { data, fetchNextPage, isFetchingNextPage, isLoading } = useConversationsInfiniteQuery(
    { projectId: project.projectId },
    { staleTime: 30000 },
  );

  const conversations = useMemo(() => {
    return data ? data.pages.flatMap((page) => page.conversations) : [];
  }, [data]);

  const hasNextPage = useMemo(() => {
    if (data?.pages && data.pages.length > 0) {
      const lastPage = data.pages[data.pages.length - 1];
      return lastPage.nextCursor !== null;
    }
    return false;
  }, [data?.pages]);

  const loadMore = useCallback(() => {
    if (!isFetchingNextPage && hasNextPage) {
      fetchNextPage();
    }
  }, [isFetchingNextPage, hasNextPage, fetchNextPage]);

  const handleNewChat = useCallback(() => {
    const template: Partial<TConversation> = {
      projectId: project.projectId,
    };
    if (project.endpoint) {
      template.endpoint = project.endpoint as unknown as typeof template.endpoint;
    }
    if (project.model) {
      template.model = project.model;
    }
    newConversation({ template });
  }, [newConversation, project]);

  return (
    <div className="flex h-full flex-col gap-3">
      {/* New Chat Button */}
      <button
        type="button"
        onClick={handleNewChat}
        className="flex w-full items-center gap-2.5 rounded-lg border border-border-light bg-surface-secondary px-3 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-surface-hover"
      >
        <Plus className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
        <span>{localize('com_ui_new_chat_in_project')}</span>
      </button>

      {/* Conversation List */}
      <div className="flex flex-col gap-0.5">
        {isLoading && (
          <div className="flex items-center justify-center py-4">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-border-light border-t-text-primary" />
          </div>
        )}

        {!isLoading && conversations.length === 0 && (
          <div className="py-4 text-center text-sm text-text-secondary">
            {localize('com_ui_no_conversations_in_project')}
          </div>
        )}

        {conversations.map((convo) => (
          <ConversationItem
            key={convo.conversationId}
            conversationId={convo.conversationId ?? ''}
            title={convo.title ?? ''}
            updatedAt={convo.updatedAt}
            onClick={() => navigate(`/c/${convo.conversationId}`)}
          />
        ))}

        {hasNextPage && (
          <button
            type="button"
            onClick={loadMore}
            disabled={isFetchingNextPage}
            className={cn(
              'w-full rounded-lg py-2 text-sm text-text-secondary transition-colors',
              isFetchingNextPage
                ? 'cursor-not-allowed opacity-50'
                : 'hover:bg-surface-hover hover:text-text-primary',
            )}
          >
            {isFetchingNextPage ? localize('com_ui_loading') : localize('com_ui_load_more')}
          </button>
        )}
      </div>
    </div>
  );
}
