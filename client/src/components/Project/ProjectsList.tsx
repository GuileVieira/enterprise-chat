import { useNavigate } from 'react-router-dom';
import { FolderPlus, Folder, MessageSquare, MoreHorizontal, Trash2, Pencil } from 'lucide-react';
import { useProjectsQuery, useDeleteProjectMutation } from '~/data-provider';
import { useLocalize } from '~/hooks';
import { cn } from '~/utils';
import type { TProject } from 'librechat-data-provider';

function ProjectCard({ project }: { project: TProject }) {
  const navigate = useNavigate();
  const localize = useLocalize();
  const deleteMutation = useDeleteProjectMutation();

  const handleClick = () => {
    navigate(`/projects/${project.projectId}`);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm(localize('com_ui_project_delete_confirm'))) {
      deleteMutation.mutate(project.projectId);
    }
  };

  return (
    <div
      onClick={handleClick}
      className={cn(
        'group relative flex cursor-pointer flex-col gap-2 rounded-xl border border-border-light',
        'bg-surface-secondary p-4 transition-all hover:border-text-primary hover:shadow-sm',
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-tertiary">
            <Folder className="h-5 w-5 text-text-secondary" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-text-primary">{project.name}</h3>
            {project.description ? (
              <p className="mt-0.5 line-clamp-1 text-xs text-text-secondary">
                {project.description}
              </p>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/projects/${project.projectId}`);
            }}
            className="rounded-lg p-1.5 text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
            title={localize('com_ui_edit')}
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={handleDelete}
            className="rounded-lg p-1.5 text-text-secondary transition-colors hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-950"
            title={localize('com_ui_delete')}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="mt-1 flex items-center gap-3 text-xs text-text-tertiary">
        {project.endpoint ? (
          <span className="rounded-md bg-surface-tertiary px-1.5 py-0.5">{project.endpoint}</span>
        ) : null}
        {project.model ? (
          <span className="rounded-md bg-surface-tertiary px-1.5 py-0.5">{project.model}</span>
        ) : null}
      </div>
    </div>
  );
}

export default function ProjectsList() {
  const navigate = useNavigate();
  const localize = useLocalize();
  const { data: projects, isLoading } = useProjectsQuery();

  const activeProjects = projects?.filter((p) => !p.isArchived) ?? [];

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border-light px-6 py-4">
        <h1 className="text-xl font-semibold text-text-primary">{localize('com_ui_projects')}</h1>
        <button
          type="button"
          onClick={() => navigate('/projects/new')}
          className="flex items-center gap-2 rounded-lg bg-text-primary px-4 py-2 text-sm font-medium text-surface-primary transition-colors hover:opacity-90"
        >
          <FolderPlus className="h-4 w-4" />
          {localize('com_ui_new_project')}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-border-light border-t-text-primary" />
          </div>
        ) : activeProjects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Folder className="h-12 w-12 text-text-tertiary" />
            <p className="mt-4 text-sm text-text-secondary">{localize('com_ui_projects_empty')}</p>
            <button
              type="button"
              onClick={() => navigate('/projects/new')}
              className="mt-4 text-sm font-medium text-text-primary underline underline-offset-4 transition-colors hover:opacity-80"
            >
              {localize('com_ui_create_first_project')}
            </button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {activeProjects.map((project) => (
              <ProjectCard key={project.projectId} project={project} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
