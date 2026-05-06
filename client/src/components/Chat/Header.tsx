import { memo, useId, useMemo, useState, useCallback } from 'react';
import { useRecoilValue, useSetRecoilState } from 'recoil';
import * as Ariakit from '@ariakit/react';
import { useQueryClient } from '@tanstack/react-query';
import { DropdownPopup, useMediaQuery } from '@librechat/client';
import {
  Constants,
  QueryKeys,
  getConfigDefaults,
  PermissionTypes,
  Permissions,
} from 'librechat-data-provider';
import type { TConversation } from 'librechat-data-provider';
import { Check, ChevronDown, Folder } from 'lucide-react';
import ModelSelector from './Menus/Endpoints/ModelSelector';
import {
  useGetProjectFiles,
  useGetStartupConfig,
  useProjectByIdQuery,
  useProjectsQuery,
} from '~/data-provider';
import ExportAndShareMenu from './ExportAndShareMenu';
import { OpenSidebar, PresetsMenu } from './Menus';
import BookmarkMenu from './Menus/BookmarkMenu';
import { TemporaryChat } from './TemporaryChat';
import AddMultiConvo from './AddMultiConvo';
import { useHasAccess, useLocalize, useNewConvo } from '~/hooks';
import { clearMessagesCache, cn } from '~/utils';
import store from '~/store';

const defaultInterface = getConfigDefaults().interface;

function ProjectSelectorBadges({ conversation }: { conversation?: TConversation | null }) {
  const localize = useLocalize();
  const menuId = useId();
  const queryClient = useQueryClient();
  const { newConversation } = useNewConvo();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const setConversation = useSetRecoilState(store.conversationByIndex(0));
  const setSelectedProjectId = useSetRecoilState(store.selectedProjectId);
  const projectId = conversation?.projectId ?? '';
  const { data: projects = [], isLoading } = useProjectsQuery();
  const selectedProject = useMemo(
    () => projects.find((project) => project.projectId === projectId),
    [projects, projectId],
  );
  const { data: projectById } = useProjectByIdQuery(projectId, {
    enabled: !!projectId && !selectedProject,
  });
  const project = selectedProject ?? projectById;
  const { data: files = [] } = useGetProjectFiles(projectId ?? undefined, {
    enabled: !!projectId,
  });

  const indexedFiles = files.filter((file) => file.embedded).length;
  const memoryCount = project
    ? (project.memories?.length ?? 0) + (project.memoryKeys?.length ?? 0)
    : 0;
  const isExistingConversation =
    !!conversation?.conversationId &&
    conversation.conversationId !== Constants.NEW_CONVO &&
    conversation.conversationId !== 'search';

  const handleProjectChange = useCallback(
    (nextProjectId: string | null) => {
      const nextProject = projects.find((candidate) => candidate.projectId === nextProjectId);

      setIsMenuOpen(false);

      if ((nextProjectId ?? '') === projectId) {
        return;
      }

      setSelectedProjectId(nextProjectId);

      if (isExistingConversation) {
        clearMessagesCache(queryClient, conversation?.conversationId);
        queryClient.invalidateQueries([QueryKeys.messages]);

        const template: Partial<TConversation> = {
          endpoint: conversation?.endpoint,
          endpointType: conversation?.endpointType,
          model: conversation?.model,
          spec: conversation?.spec,
          agent_id: conversation?.agent_id,
          assistant_id: conversation?.assistant_id,
        };
        if (nextProjectId) {
          template.projectId = nextProjectId;
        }
        if (!template.endpoint && nextProject?.endpoint) {
          template.endpoint = nextProject.endpoint as unknown as typeof template.endpoint;
        }
        if (!template.model && nextProject?.model) {
          template.model = nextProject.model;
        }

        newConversation(Object.keys(template).length > 0 ? { template } : undefined);
        return;
      }

      setConversation((currentConversation) => {
        if (!currentConversation) {
          return currentConversation;
        }

        const nextConversation: TConversation = {
          ...currentConversation,
          projectId: nextProjectId ?? undefined,
        };

        if (currentConversation.conversationId === Constants.NEW_CONVO && nextProject) {
          if (nextProject.endpoint) {
            nextConversation.endpoint =
              nextProject.endpoint as unknown as typeof nextConversation.endpoint;
          }
          if (nextProject.model) {
            nextConversation.model = nextProject.model;
          }
        }

        return nextConversation;
      });
    },
    [
      projects,
      projectId,
      queryClient,
      conversation,
      newConversation,
      setConversation,
      setSelectedProjectId,
      isExistingConversation,
    ],
  );

  const projectLabel = project?.name ?? '(nenhum projeto selecionado)';
  const projectItems = useMemo(() => {
    const items = [
      {
        id: 'no-project',
        label: '(nenhum projeto selecionado)',
        icon: (
          <Check
            className={cn('icon-sm mr-2', !projectId ? 'opacity-100' : 'opacity-0')}
            aria-hidden="true"
          />
        ),
        onClick: () => handleProjectChange(null),
        className: cn(!projectId && 'bg-surface-active-alt'),
      },
    ];

    if (projects.length > 0) {
      items.push({
        id: 'separator',
        label: '',
        separator: true,
      } as unknown as (typeof items)[0]);

      projects.forEach((candidate) => {
        items.push({
          id: candidate.projectId,
          label: candidate.name,
          icon: (
            <Check
              className={cn(
                'icon-sm mr-2',
                projectId === candidate.projectId ? 'opacity-100' : 'opacity-0',
              )}
              aria-hidden="true"
            />
          ),
          onClick: () => handleProjectChange(candidate.projectId),
          className: cn(projectId === candidate.projectId && 'bg-surface-active-alt'),
        });
      });
    }

    return items;
  }, [projects, projectId, handleProjectChange]);

  return (
    <div className="flex w-fit max-w-[min(80vw,48rem)] items-center gap-2">
      <DropdownPopup
        portal={true}
        menuId={menuId}
        focusLoop={true}
        className="z-[125]"
        unmountOnHide={true}
        isOpen={isMenuOpen}
        setIsOpen={setIsMenuOpen}
        items={projectItems}
        trigger={
          <Ariakit.MenuButton
            title={projectLabel}
            disabled={isLoading}
            aria-expanded={isMenuOpen}
            aria-label={localize('com_ui_project_badge')}
            className={cn(
              'group flex h-9 w-56 max-w-[52vw] items-center gap-2 rounded-2xl border px-3 text-xs font-semibold sm:w-64',
              'border-border-light bg-surface-primary-alt text-text-primary shadow-sm transition-all duration-200',
              'hover:border-border-medium hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-primary',
              isMenuOpen &&
                'border-ring-primary bg-surface-hover shadow-[0_0_0_3px_hsl(var(--ring-primary)/0.18)]',
            )}
          >
            <Folder className="h-4 w-4 shrink-0 text-text-secondary" aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate text-left">{projectLabel}</span>
            <ChevronDown
              className={cn(
                'h-4 w-4 shrink-0 text-text-tertiary transition-transform duration-200',
                isMenuOpen && 'rotate-180',
              )}
              aria-hidden="true"
            />
          </Ariakit.MenuButton>
        }
      />
      {projectId && project && (
        <>
          <span className="flex h-9 shrink-0 items-center rounded-xl border border-border-light bg-surface-primary-alt px-3 text-xs font-medium text-text-tertiary">
            {indexedFiles}/{files.length} {localize('com_ui_project_files').toLowerCase()}
          </span>
          <span className="flex h-9 shrink-0 items-center rounded-xl border border-border-light bg-surface-primary-alt px-3 text-xs font-medium text-text-tertiary">
            {memoryCount} {localize('com_ui_project_tab_memories').toLowerCase()}
          </span>
        </>
      )}
    </div>
  );
}

function Header() {
  const { data: startupConfig } = useGetStartupConfig();
  const navVisible = useRecoilValue(store.sidebarExpanded);
  const conversation = useRecoilValue(store.conversationByIndex(0));

  const interfaceConfig = useMemo(
    () => startupConfig?.interface ?? defaultInterface,
    [startupConfig],
  );

  const hasAccessToBookmarks = useHasAccess({
    permissionType: PermissionTypes.BOOKMARKS,
    permission: Permissions.USE,
  });

  const hasAccessToMultiConvo = useHasAccess({
    permissionType: PermissionTypes.MULTI_CONVO,
    permission: Permissions.USE,
  });

  const hasAccessToTemporaryChat = useHasAccess({
    permissionType: PermissionTypes.TEMPORARY_CHAT,
    permission: Permissions.USE,
  });

  const isSmallScreen = useMediaQuery('(max-width: 768px)');

  return (
    <div className="via-presentation/70 md:from-presentation/80 md:via-presentation/50 2xl:from-presentation/0 absolute top-0 z-10 flex h-[52px] w-full items-center justify-between bg-gradient-to-b from-presentation to-transparent p-2 font-semibold text-text-primary 2xl:via-transparent">
      <div className="hide-scrollbar flex w-full items-center justify-between gap-2 overflow-x-auto">
        <div className="mx-1 flex items-center">
          <OpenSidebar className="md:hidden" />
          {!(navVisible && isSmallScreen) && (
            <div
              className={cn(
                'flex items-center gap-2 pl-2',
                !isSmallScreen ? 'transition-all duration-200 ease-in-out' : '',
              )}
            >
              <ModelSelector startupConfig={startupConfig} />
              <ProjectSelectorBadges conversation={conversation} />
              {interfaceConfig.presets === true && interfaceConfig.modelSelect && <PresetsMenu />}
              {hasAccessToBookmarks === true && <BookmarkMenu />}
              {interfaceConfig.multiConvo === true && hasAccessToMultiConvo === true && (
                <AddMultiConvo />
              )}
              {isSmallScreen && (
                <>
                  <ExportAndShareMenu
                    isSharedButtonEnabled={startupConfig?.sharedLinksEnabled ?? false}
                  />
                  {hasAccessToTemporaryChat === true && <TemporaryChat />}
                </>
              )}
            </div>
          )}
        </div>

        {!isSmallScreen && (
          <div className="flex items-center gap-2">
            <ExportAndShareMenu
              isSharedButtonEnabled={startupConfig?.sharedLinksEnabled ?? false}
            />
            {hasAccessToTemporaryChat === true && <TemporaryChat />}
          </div>
        )}
      </div>
      {/* Empty div for spacing */}
      <div />
    </div>
  );
}

const MemoizedHeader = memo(Header);
MemoizedHeader.displayName = 'Header';

export default MemoizedHeader;
