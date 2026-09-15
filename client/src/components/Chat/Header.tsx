import { memo, useId, useMemo, useState, useCallback } from 'react';
import * as Ariakit from '@ariakit/react';
import { useParams } from 'react-router-dom';
import { DropdownPopup } from '@librechat/client';
import { useRecoilValue, useSetRecoilState } from 'recoil';
import { CaretDown, Check, Folder } from '@phosphor-icons/react';
import {
  Constants,
  getConfigDefaults,
  PermissionTypes,
  Permissions,
} from 'librechat-data-provider';
import type { TConversation } from 'librechat-data-provider';
import {
  useGetProjectFiles,
  useGetStartupConfig,
  useMoveConversationToProjectMutation,
  useProjectByIdQuery,
  useProjectsQuery,
} from '~/data-provider';
import { HeaderMenu, NewChat, OpenSidebar, PresetsMenu } from './Menus';
import { TemporaryChat, TemporaryChatIndicator } from './TemporaryChat';
import ModelSelector from './Menus/Endpoints/ModelSelector';
import { TraceButton, useTraceControl } from './Trace';
import ExportAndShareMenu from './ExportAndShareMenu';
import SubagentThreadLink from './SubagentThreadLink';
import { useHasAccess, useLocalize } from '~/hooks';
import BookmarkMenu from './Menus/BookmarkMenu';
import AddMultiConvo from './AddMultiConvo';
import { cn } from '~/utils';
import store from '~/store';

const defaultInterface = getConfigDefaults().interface;

export function shouldUpdateExistingConversationProject(
  conversation?: Pick<TConversation, 'conversationId'> | null,
) {
  const conversationId = conversation?.conversationId;
  return !!conversationId && conversationId !== Constants.NEW_CONVO && conversationId !== 'search';
}

function ProjectSelectorBadges({ conversation }: { conversation?: TConversation | null }) {
  const localize = useLocalize();
  const menuId = useId();
  const moveConversationToProject = useMoveConversationToProjectMutation();
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
  const isExistingConversation = shouldUpdateExistingConversationProject(conversation);

  const handleProjectChange = useCallback(
    (nextProjectId: string | null) => {
      const nextProject = projects.find((candidate) => candidate.projectId === nextProjectId);

      setIsMenuOpen(false);

      if ((nextProjectId ?? '') === projectId) {
        return;
      }

      setSelectedProjectId(nextProjectId);

      if (isExistingConversation) {
        moveConversationToProject.mutate(
          {
            conversationId: conversation?.conversationId ?? '',
            projectId: nextProjectId,
          },
          {
            onSuccess: (updatedConversation) => {
              setConversation((currentConversation) =>
                currentConversation?.conversationId === conversation?.conversationId
                  ? updatedConversation
                  : currentConversation,
              );
            },
            onError: () => {
              setSelectedProjectId((currentProjectId) =>
                currentProjectId === nextProjectId ? projectId || null : currentProjectId,
              );
            },
          },
        );
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
      conversation,
      setConversation,
      setSelectedProjectId,
      isExistingConversation,
      moveConversationToProject,
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
                'shadow-[0_0_0_3px_rgb(var(--ring-primary) / 0.18)] border-ring-primary bg-surface-hover',
            )}
          >
            <Folder className="h-4 w-4 shrink-0 text-text-secondary" aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate text-left">{projectLabel}</span>
            <CaretDown
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

function Header({
  parentConversationId,
  readOnly = false,
}: {
  parentConversationId?: string;
  readOnly?: boolean;
}) {
  const { data: startupConfig } = useGetStartupConfig();
  const navVisible = useRecoilValue(store.sidebarExpanded);
  const isSubmitting = useRecoilValue(store.isSubmittingFamily(0));
  const conversation = useRecoilValue(store.conversationByIndex(0));
  const { conversationId: routeConversationId } = useParams();
  const isNewChat = routeConversationId == null || routeConversationId === Constants.NEW_CONVO;

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
  const trace = useTraceControl({
    conversationId: isNewChat ? null : routeConversationId,
    traceViewer: interfaceConfig.traceViewer,
    isSubmitting,
    enabled: parentConversationId == null,
  });
  const hiddenBehindNav = navVisible === true && 'max-md:hidden';

  return (
    <div className="absolute top-0 z-10 flex h-[52px] w-full items-center gap-2 bg-gradient-to-b from-presentation via-presentation/70 to-transparent p-2 font-semibold text-text-primary md:from-presentation/80 md:via-presentation/50 2xl:from-presentation/0 2xl:via-transparent">
      <div className="flex flex-shrink-0 items-center md:hidden">
        <OpenSidebar testId="header-open-sidebar-button" />
      </div>

      <div
        className={cn(
          'flex min-w-0 flex-1 items-center gap-2 md:pl-3 md:transition-all md:duration-200 md:ease-in-out',
          hiddenBehindNav,
        )}
      >
        {parentConversationId != null && (
          <SubagentThreadLink threadId={parentConversationId} labelClassName="hidden lg:inline" />
        )}
        {!readOnly && <ModelSelector startupConfig={startupConfig} />}
        {!readOnly && <ProjectSelectorBadges conversation={conversation} />}
        {!readOnly && interfaceConfig.presets === true && interfaceConfig.modelSelect === true && (
          <PresetsMenu />
        )}
        {hasAccessToBookmarks === true && (
          <div className="hidden items-center md:flex">
            <BookmarkMenu />
          </div>
        )}
        {hasAccessToMultiConvo === true && (
          <div className="hidden items-center md:flex">
            <AddMultiConvo />
          </div>
        )}
      </div>

      <div className={cn('flex flex-shrink-0 items-center gap-2', hiddenBehindNav)}>
        {hasAccessToTemporaryChat === true && <TemporaryChatIndicator />}
        {!isNewChat && <NewChat className="md:hidden" />}
        <HeaderMenu startupConfig={startupConfig} trace={trace} className="md:hidden" />
        <div className="hidden items-center gap-2 md:flex">
          {trace.show && <TraceButton onClick={trace.open} />}
          <ExportAndShareMenu isSharedButtonEnabled={startupConfig?.sharedLinksEnabled ?? false} />
          {hasAccessToTemporaryChat === true && <TemporaryChat />}
        </div>
      </div>
    </div>
  );
}

const MemoizedHeader = memo(Header);
MemoizedHeader.displayName = 'Header';

export default MemoizedHeader;
