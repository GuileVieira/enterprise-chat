import { useNavigate } from 'react-router-dom';
import { FolderPlus, Folder, Trash2, Pencil } from 'lucide-react';
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'Enter' && e.key !== ' ') {
      return;
    }
    e.preventDefault();
    handleClick();
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm(localize('com_ui_project_delete_confirm'))) {
      deleteMutation.mutate(project.projectId);
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={cn(
        'group relative flex min-h-36 cursor-pointer flex-col justify-between gap-4 rounded-2xl border border-border-light',
        'bg-surface-secondary p-4 transition-all hover:border-border-medium hover:bg-surface-hover',
        'focus-within:ring-2 focus-within:ring-ring-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-ring-primary active:scale-[0.99]',
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border-light bg-surface-primary">
            <Folder className="h-5 w-5 text-text-secondary" />
          </div>
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold text-text-primary">{project.name}</h3>
            {project.description ? (
              <p className="mt-1 line-clamp-2 text-sm leading-5 text-text-secondary">
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
            className="rounded-lg p-1.5 text-text-secondary transition-colors hover:bg-surface-primary hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-primary"
            title={localize('com_ui_edit')}
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={handleDelete}
            className="rounded-lg p-1.5 text-text-secondary transition-colors hover:bg-red-100 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-primary dark:hover:bg-red-950"
            title={localize('com_ui_delete')}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="flex min-h-6 items-center gap-2 text-xs text-text-tertiary">
        {project.endpoint ? (
          <span className="rounded-lg border border-border-light bg-surface-primary px-2 py-1">
            {project.endpoint}
          </span>
        ) : null}
        {project.model ? (
          <span className="rounded-lg border border-border-light bg-surface-primary px-2 py-1">
            {project.model}
          </span>
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
    <div className="flex h-full flex-col bg-surface-primary">
      <div className="border-b border-border-light px-5 py-5">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold leading-tight text-text-primary">
              {localize('com_ui_projects')}
            </h1>
            <p className="mt-1 text-sm text-text-secondary">
              {activeProjects.length} {localize('com_ui_projects').toLowerCase()}
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/projects/new')}
            className="flex h-10 items-center gap-2 rounded-xl bg-text-primary px-4 text-sm font-medium text-surface-primary transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-primary active:scale-[0.99]"
          >
            <FolderPlus className="h-4 w-4" />
            {localize('com_ui_new_project')}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-5 py-6">
        <div className="mx-auto w-full max-w-6xl">
          {isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <div
                  key={index}
                  className="h-36 animate-pulse rounded-2xl border border-border-light bg-surface-secondary"
                />
              ))}
            </div>
          ) : activeProjects.length === 0 ? (
            <div className="flex min-h-80 flex-col items-center justify-center rounded-2xl border border-dashed border-border-light bg-surface-secondary px-6 py-16 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-border-light bg-surface-primary">
                <Folder className="h-7 w-7 text-text-tertiary" />
              </div>
              <p className="mt-4 max-w-md text-sm leading-6 text-text-secondary">
                {localize('com_ui_projects_empty')}
              </p>
              <button
                type="button"
                onClick={() => navigate('/projects/new')}
                className="mt-5 rounded-xl bg-text-primary px-4 py-2 text-sm font-medium text-surface-primary transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-primary active:scale-[0.99]"
              >
                {localize('com_ui_create_first_project')}
              </button>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {activeProjects.map((project) => (
                <ProjectCard key={project.projectId} project={project} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
