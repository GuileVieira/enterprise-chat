import { useState, useMemo, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Folder, FolderPlus, ChevronDown, MoreHorizontal, MessageSquare, ChevronRight, Plus } from 'lucide-react';
import { useProjectsQuery, useConversationsInfiniteQuery } from '~/data-provider';
import { useLocalize, useNewConvo } from '~/hooks';
import { cn } from '~/utils';

function ProjectListItem({
  projectId,
  name,
}: {
  projectId: string;
  name: string;
}) {
  const navigate = useNavigate();
  const { conversationId } = useParams();
  const [isExpanded, setIsExpanded] = useState(false);
  const { newConversation } = useNewConvo();

  const { data, isLoading } = useConversationsInfiniteQuery(
    { projectId },
    { enabled: isExpanded, staleTime: 30000 },
  );

  const conversations = useMemo(() => {
    return data ? data.pages.flatMap((page) => page.conversations) : [];
  }, [data]);

  const handleNewChat = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      newConversation({
        template: {
          projectId,
        },
      });
    },
    [newConversation, projectId],
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
            <ChevronDown className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
          ) : (
            <ChevronRight className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
          )}
        </div>
        <Folder className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
        <span className="truncate text-left flex-1">{name}</span>
      </button>

      {isExpanded && (
        <div className="ml-6 flex max-h-[40vh] flex-col gap-0.5 overflow-y-auto border-l border-border-light pl-2 custom-scrollbar">
          {/* New Chat in Project */}
          <button
            type="button"
            onClick={handleNewChat}
            className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-text-primary transition-colors hover:bg-surface-hover"
          >
            <Plus className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
            <span className="font-medium">New Chat</span>
          </button>

          {isLoading && (
            <div className="px-2 py-1 text-xs text-text-tertiary">Loading...</div>
          )}
          {!isLoading && conversations.length === 0 && (
            <div className="px-2 py-1 text-xs text-text-tertiary italic">No conversations</div>
          )}
          {conversations.map((convo) => (
            <button
              key={convo.conversationId}
              type="button"
              onClick={() => navigate(`/c/${convo.conversationId}`)}
              className={cn(
                'flex w-full items-center gap-2 rounded-lg px-2 py-1 text-xs transition-colors',
                conversationId === convo.conversationId
                  ? 'bg-surface-active-alt text-text-primary font-medium'
                  : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary',
              )}
            >
              <MessageSquare className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
              <span className="truncate text-left">{convo.title || 'Untitled'}</span>
            </button>
          ))}
          <button
            type="button"
            onClick={() => navigate(`/projects/${projectId}`)}
            className="mt-1 px-2 py-1 text-left text-[10px] uppercase tracking-wider text-text-tertiary hover:text-text-primary"
          >
            View Project Details
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
        <ChevronDown
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
            <div className="w-4 h-4" /> {/* Spacer for alignment */}
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
              <div className="w-4 h-4" /> {/* Spacer for alignment */}
              <MoreHorizontal className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
              <span>{localize('com_ui_more_projects')}</span>
            </button>
          )}
        </>
      )}
    </div>
  );
}
