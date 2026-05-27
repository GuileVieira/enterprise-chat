import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useSetRecoilState } from 'recoil';
import {
  CaretDown,
  CaretRight,
  ChatCircle,
  DotsThree,
  Folder,
  FolderPlus,
  Plus,
} from '@phosphor-icons/react';
import { QueryKeys } from 'librechat-data-provider';
import type { TConversation } from 'librechat-data-provider';
import {
  useProjectsQuery,
  useProjectByIdQuery,
  useUpdateConversationMutation,
  useConversationsInfiniteQuery,
} from '~/data-provider';
import { useLocalize, useNewConvo } from '~/hooks';
import { clearMessagesCache, cn } from '~/utils';
import store from '~/store';

function ProjectListItem({ projectId, name }: { projectId: string; name: string }) {
  const navigate = useNavigate();
  const localize = useLocalize();
  const queryClient = useQueryClient();
  const { conversationId } = useParams();
  const renameInputRef = useRef<HTMLInputElement>(null);
  const [titleInput, setTitleInput] = useState('');
  const [renamingConvoId, setRenamingConvoId] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const { newConversation } = useNewConvo();
  const updateConvoMutation = useUpdateConversationMutation(conversationId ?? '');
  const setSelectedProjectId = useSetRecoilState(store.selectedProjectId);
  const { data: project } = useProjectByIdQuery(projectId, {
    enabled: isExpanded,
  });

  const { data, isLoading } = useConversationsInfiniteQuery(
    { projectId },
    { enabled: isExpanded, staleTime: 30000 },
  );

  const conversations = useMemo(() => {
    return data ? data.pages.flatMap((page) => page.conversations) : [];
  }, [data]);

  useEffect(() => {
    if (!renamingConvoId) {
      return;
    }
    requestAnimationFrame(() => {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    });
  }, [renamingConvoId]);

  const handleNewChat = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setSelectedProjectId(projectId);
      clearMessagesCache(queryClient, conversationId);
      queryClient.invalidateQueries([QueryKeys.messages]);

      const template: Partial<TConversation> = {
        projectId,
      };
      if (project?.endpoint) {
        template.endpoint = project.endpoint as unknown as typeof template.endpoint;
      }
      if (project?.model) {
        template.model = project.model;
      }

      newConversation({
        template,
      });
    },
    [conversationId, newConversation, project, projectId, queryClient, setSelectedProjectId],
  );

  const startRename = useCallback((convo: TConversation) => {
    setRenamingConvoId(convo.conversationId ?? null);
    setTitleInput(convo.title ?? '');
  }, []);

  const cancelRename = useCallback(() => {
    setRenamingConvoId(null);
    setTitleInput('');
  }, []);

  const submitRename = useCallback(
    async (convo: TConversation) => {
      const nextTitle = titleInput.trim();
      const targetConvoId = convo.conversationId;
      if (!targetConvoId || !nextTitle || nextTitle === convo.title) {
        cancelRename();
        return;
      }

      await updateConvoMutation.mutateAsync({
        conversationId: targetConvoId,
        title: nextTitle,
      });
      cancelRename();
    },
    [cancelRename, titleInput, updateConvoMutation],
  );

  return (
    <div className="flex flex-col gap-0.5">
      <button
        type="button"
        onClick={() => setIsExpanded((v) => !v)}
        className={cn(
          'flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors',
          'text-text-secondary hover:bg-surface-hover hover:text-text-primary',
        )}
      >
        <div className="flex h-4 w-4 items-center justify-center">
          {isExpanded ? (
            <CaretDown className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
          ) : (
            <CaretRight className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
          )}
        </div>
        <Folder className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
        <span className="flex-1 truncate text-left">{name}</span>
      </button>

      {isExpanded && (
        <div className="custom-scrollbar ml-6 flex max-h-[40vh] flex-col gap-0.5 overflow-y-auto border-l border-border-light pl-2">
          {/* New Chat in Project */}
          <button
            type="button"
            onClick={handleNewChat}
            className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-text-primary transition-colors hover:bg-surface-hover"
          >
            <Plus className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
            <span className="font-medium">{localize('com_ui_new_chat_in_project')}</span>
          </button>

          {isLoading && <div className="px-2 py-1 text-xs text-text-tertiary">Loading...</div>}
          {!isLoading && conversations.length === 0 && (
            <div className="px-2 py-1 text-xs italic text-text-tertiary">
              {localize('com_ui_no_conversations_in_project')}
            </div>
          )}
          {conversations.map((convo) => {
            const isActive = conversationId === convo.conversationId;
            const isRenaming = renamingConvoId === convo.conversationId;

            return (
              <div
                key={convo.conversationId}
                className={cn(
                  'flex w-full items-center gap-2 rounded-lg px-2 py-1 text-xs transition-colors',
                  isActive
                    ? 'bg-surface-active-alt font-medium text-text-primary'
                    : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary',
                )}
              >
                <ChatCircle className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
                {isRenaming ? (
                  <form
                    className="min-w-0 flex-1"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void submitRename(convo);
                    }}
                  >
                    <input
                      ref={renameInputRef}
                      className="w-full rounded bg-transparent px-1 py-0.5 text-xs outline-none ring-1 ring-border-medium focus:ring-ring"
                      value={titleInput}
                      maxLength={100}
                      aria-label={localize('com_ui_new_conversation_title')}
                      onChange={(event) => setTitleInput(event.target.value)}
                      onBlur={() => void submitRename(convo)}
                      onKeyDown={(event) => {
                        if (event.key === 'Escape') {
                          event.preventDefault();
                          cancelRename();
                        }
                      }}
                    />
                  </form>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      if (isActive) {
                        startRename(convo);
                        return;
                      }
                      navigate(`/c/${convo.conversationId}`);
                    }}
                    className={cn('min-w-0 flex-1 truncate text-left', isActive && 'cursor-text')}
                  >
                    {convo.title || 'Untitled'}
                  </button>
                )}
              </div>
            );
          })}
          <button
            type="button"
            onClick={() => navigate(`/projects/${projectId}`)}
            className="mt-1 px-2 py-1 text-left text-[10px] uppercase tracking-wider text-text-tertiary hover:text-text-primary"
          >
            {localize('com_ui_details')}
          </button>
        </div>
      )}
    </div>
  );
}

export default function ProjectsPanel() {
  const localize = useLocalize();
  const navigate = useNavigate();
  const { data: projects = [] } = useProjectsQuery();
  const [expanded, setExpanded] = useState(true);
  const [showAll, setShowAll] = useState(false);

  const visibleProjects = showAll ? projects : projects.slice(0, 8);
  const hasMore = projects.length > 8;

  return (
    <div className="flex h-full flex-col gap-1 px-2 py-2">
      {/* Header */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-sm font-semibold text-text-primary transition-colors hover:bg-surface-hover"
      >
        <span>{localize('com_ui_projects')}</span>
        <CaretDown
          className={cn('h-4 w-4 transition-transform', expanded ? 'rotate-0' : '-rotate-90')}
          aria-hidden="true"
        />
      </button>

      {expanded && (
        <>
          {/* New Project */}
          <button
            type="button"
            onClick={() => navigate('/projects/new')}
            className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
          >
            <div className="h-4 w-4" /> {/* Spacer for alignment */}
            <FolderPlus className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
            <span>{localize('com_ui_new_project')}</span>
          </button>

          {/* Divider */}
          <div className="mx-2 my-1 border-b border-border-light" />

          {/* Project List */}
          <div className="flex flex-col gap-1">
            {visibleProjects.map((project) => (
              <ProjectListItem
                key={project.projectId}
                projectId={project.projectId}
                name={project.name}
              />
            ))}
          </div>

          {/* More */}
          {hasMore && !showAll && (
            <button
              type="button"
              onClick={() => setShowAll(true)}
              className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
            >
              <div className="h-4 w-4" /> {/* Spacer for alignment */}
              <DotsThree className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
              <span>{localize('com_ui_more_projects')}</span>
            </button>
          )}
        </>
      )}
    </div>
  );
}
