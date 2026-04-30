import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Folder, FolderPlus, ChevronDown, MoreHorizontal } from 'lucide-react';
import { useProjectsQuery } from '~/data-provider';
import { useLocalize } from '~/hooks';
import { cn } from '~/utils';

function ProjectListItem({
  projectId,
  name,
  isActive,
  onClick,
}: {
  projectId: string;
  name: string;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm transition-colors',
        isActive
          ? 'bg-surface-active-alt text-text-primary'
          : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary',
      )}
    >
      <Folder className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
      <span className="truncate">{name}</span>
    </button>
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
            <FolderPlus className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
            <span>{localize('com_ui_new_project')}</span>
          </button>

          {/* Divider */}
          <div className="mx-2 my-1 border-b border-border-light" />

          {/* Project List */}
          <div className="flex flex-col gap-0.5">
            {visibleProjects.map((project) => (
              <ProjectListItem
                key={project.projectId}
                projectId={project.projectId}
                name={project.name}
                isActive={false}
                onClick={() => navigate(`/projects/${project.projectId}`)}
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
              <MoreHorizontal className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
              <span>{localize('com_ui_more_projects')}</span>
            </button>
          )}
        </>
      )}
    </div>
  );
}
