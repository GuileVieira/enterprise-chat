import { useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChatCircle as MessageSquare, Plus } from '@phosphor-icons/react';
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
      className="flex w-full items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 text-sm text-text-secondary transition-colors hover:border-border-light hover:bg-surface-hover hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-primary active:scale-[0.99]"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border-light bg-surface-primary">
        <MessageSquare className="h-4 w-4" aria-hidden="true" />
      </div>
      <div className="flex min-w-0 flex-col items-start overflow-hidden">
        <span className="truncate font-medium">{title || 'Untitled'}</span>
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
    <div className="flex h-full flex-col gap-4">
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-border-light bg-surface-secondary p-4">
        <div>
          <h2 className="text-base font-semibold text-text-primary">
            {localize('com_ui_project_tab_conversations')}
          </h2>
          <p className="mt-1 text-sm text-text-secondary">
            {conversations.length} {localize('com_ui_project_tab_conversations').toLowerCase()}
          </p>
        </div>
        <button
          type="button"
          onClick={handleNewChat}
          className="flex h-10 shrink-0 items-center gap-2 rounded-xl bg-text-primary px-4 text-sm font-medium text-surface-primary transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-primary active:scale-[0.99]"
        >
          <Plus className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
          <span>{localize('com_ui_new_chat_in_project')}</span>
        </button>
      </div>

      <div className="rounded-2xl border border-border-light bg-surface-secondary p-2">
        {isLoading && (
          <div className="space-y-2 p-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-14 animate-pulse rounded-xl bg-surface-primary" />
            ))}
          </div>
        )}

        {!isLoading && conversations.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border-light py-12 text-center">
            <MessageSquare className="h-8 w-8 text-text-tertiary" aria-hidden="true" />
            <p className="mt-3 text-sm text-text-secondary">
              {localize('com_ui_no_conversations_in_project')}
            </p>
          </div>
        )}

        {!isLoading && conversations.length > 0 && (
          <div className="flex flex-col gap-1">
            {conversations.map((convo) => (
              <ConversationItem
                key={convo.conversationId}
                conversationId={convo.conversationId ?? ''}
                title={convo.title ?? ''}
                updatedAt={convo.updatedAt}
                onClick={() => navigate(`/c/${convo.conversationId}`)}
              />
            ))}
          </div>
        )}

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
