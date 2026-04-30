import { useState, useId, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import * as Ariakit from '@ariakit/react';
import { FolderOpen, FolderPlus, X } from 'lucide-react';
import { DropdownPopup } from '@librechat/client';
import { useProjectsQuery } from '~/data-provider';
import { useLocalize } from '~/hooks';
import { cn } from '~/utils';

interface ProjectSelectorProps {
  selectedProjectId: string | null;
  onSelectProject: (projectId: string | null) => void;
}

export default function ProjectSelector({
  selectedProjectId,
  onSelectProject,
}: ProjectSelectorProps) {
  const localize = useLocalize();
  const navigate = useNavigate();
  const menuId = useId();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { data: projects, isLoading } = useProjectsQuery();

  const selectedProject = useMemo(
    () => projects?.find((p) => p.projectId === selectedProjectId) ?? null,
    [projects, selectedProjectId],
  );

  const label = useMemo(
    () => selectedProject?.name ?? localize('com_ui_all_projects'),
    [selectedProject, localize],
  );

  const handleSelect = useCallback(
    (projectId: string | null) => {
      onSelectProject(projectId);
      setIsMenuOpen(false);
    },
    [onSelectProject],
  );

  const dropdownItems = useMemo(() => {
    const items = [
      {
        id: 'all-projects',
        label: localize('com_ui_all_projects'),
        icon: <FolderOpen className="icon-sm mr-2 text-text-primary" aria-hidden="true" />,
        onClick: () => handleSelect(null),
        className: cn(!selectedProjectId && 'bg-surface-active-alt'),
      },
    ];

    if (projects && projects.length > 0) {
      items.push({
        id: 'separator',
        label: '',
        separator: true,
      } as unknown as (typeof items)[0]);

      projects.forEach((project) => {
        items.push({
          id: project.projectId,
          label: project.name,
          icon: (
            <FolderOpen
              className={cn(
                'icon-sm mr-2',
                selectedProjectId === project.projectId
                  ? 'text-text-primary'
                  : 'text-text-secondary',
              )}
              aria-hidden="true"
            />
          ),
          onClick: () => handleSelect(project.projectId),
          className: cn(selectedProjectId === project.projectId && 'bg-surface-active-alt'),
        });
      });
    }

    items.push({
      id: 'separator-bottom',
      label: '',
      separator: true,
    } as unknown as (typeof items)[0]);

    items.push({
      id: 'new-project',
      label: localize('com_ui_new_project'),
      icon: <FolderPlus className="icon-sm mr-2 text-text-secondary" aria-hidden="true" />,
      onClick: () => {
        navigate('/projects/new');
        setIsMenuOpen(false);
      },
      className: '',
    });

    return items;
  }, [projects, selectedProjectId, localize, handleSelect, navigate]);

  return (
    <div className="flex items-center gap-1">
      <DropdownPopup
        portal={true}
        menuId={menuId}
        focusLoop={true}
        className="z-[125]"
        unmountOnHide={true}
        isOpen={isMenuOpen}
        setIsOpen={setIsMenuOpen}
        trigger={
          <Ariakit.MenuButton
            aria-label={localize('com_ui_filter_by_project')}
            aria-expanded={isMenuOpen}
            disabled={isLoading}
            className={cn(
              'flex h-8 flex-1 items-center gap-1.5 rounded-md border border-border-light px-2 text-sm transition-colors',
              'hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-primary',
              selectedProjectId ? 'bg-surface-active-alt text-text-primary' : 'text-text-secondary',
            )}
          >
            <FolderOpen className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
            <span className="truncate">{label}</span>
          </Ariakit.MenuButton>
        }
        items={dropdownItems}
      />
      {selectedProjectId && (
        <button
          type="button"
          aria-label={localize('com_ui_clear_project_filter')}
          className="flex h-8 w-8 items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
          onClick={() => handleSelect(null)}
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
