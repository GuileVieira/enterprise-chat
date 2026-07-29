import { useState, useMemo, useCallback } from 'react';
import { FolderOpen, X } from '@phosphor-icons/react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, Button } from '@librechat/client';
import { useProjectsQuery } from '~/data-provider';
import { useLocalize } from '~/hooks';
import { cn } from '~/utils';

interface MoveToProjectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentProjectId?: string | null;
  onMove: (projectId: string | null) => void;
  isLoading?: boolean;
}

export default function MoveToProjectModal({
  open,
  onOpenChange,
  currentProjectId,
  onMove,
  isLoading = false,
}: MoveToProjectModalProps) {
  const localize = useLocalize();
  const { data: projects, isLoading: isProjectsLoading } = useProjectsQuery();
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    currentProjectId ?? null,
  );

  const filteredProjects = useMemo(() => {
    if (!projects) {
      return [];
    }
    return projects.filter((p) => p.projectId !== currentProjectId);
  }, [projects, currentProjectId]);

  const handleMove = useCallback(() => {
    onMove(selectedProjectId);
  }, [onMove, selectedProjectId]);

  const handleRemoveFromProject = useCallback(() => {
    onMove(null);
  }, [onMove]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{localize('com_ui_move_to_project')}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3 py-2">
          {isProjectsLoading && (
            <div className="flex items-center justify-center py-4">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-border-light border-t-text-primary" />
            </div>
          )}

          {!isProjectsLoading && filteredProjects.length === 0 && (
            <div className="py-4 text-center text-sm text-text-secondary">
              {localize('com_ui_no_other_projects')}
            </div>
          )}

          {!isProjectsLoading &&
            filteredProjects.map((project) => (
              <button
                key={project.projectId}
                type="button"
                onClick={() => setSelectedProjectId(project.projectId)}
                className={cn(
                  'flex items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors',
                  selectedProjectId === project.projectId
                    ? 'bg-surface-active-alt text-text-primary'
                    : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary',
                )}
              >
                <FolderOpen className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
                <span className="truncate">{project.name}</span>
              </button>
            ))}
        </div>

        <div className="flex flex-col gap-2 pt-2">
          {currentProjectId && (
            <Button
              variant="outline"
              className="w-full"
              onClick={handleRemoveFromProject}
              disabled={isLoading}
            >
              <X className="mr-2 h-4 w-4" aria-hidden="true" />
              {localize('com_ui_remove_from_project')}
            </Button>
          )}
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
              {localize('com_ui_cancel')}
            </Button>
            <Button className="flex-1" onClick={handleMove} disabled={isLoading}>
              {isLoading ? localize('com_ui_loading') : localize('com_ui_move')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
