import { memo, useCallback, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useRecoilValue } from 'recoil';
import { PencilSimpleLine, SidebarSimple, SquaresFour as LayoutGrid } from '@phosphor-icons/react';
import { QueryKeys } from 'librechat-data-provider';
import { Skeleton, Button, TooltipAnchor } from '@librechat/client';
import type { NavLink } from '~/common';
import { CLOSE_SIDEBAR_ID } from '~/components/Chat/Menus/OpenSidebar';
import { useActivePanel, resolveActivePanel, DEFAULT_PANEL } from '~/Providers';
import { useLocalize, useNewConvo, useShowMarketplace } from '~/hooks';
import { useProjectByIdQuery } from '~/data-provider';
import { clearMessagesCache, cn } from '~/utils';
import store from '~/store';

const AccountSettings = lazy(() => import('~/components/Nav/AccountSettings'));

const NewChatButton = memo(function NewChatButton({
  setActive,
}: {
  setActive: (id: string) => void;
}) {
  const localize = useLocalize();
  const queryClient = useQueryClient();
  const { newConversation } = useNewConvo();
  const conversation = useRecoilValue(store.conversationByIndex(0));
  const switchToHistory = useRecoilValue(store.newChatSwitchToHistory);
  const selectedProjectId = useRecoilValue(store.selectedProjectId);
  const { data: project } = useProjectByIdQuery(selectedProjectId ?? '', {
    enabled: !!selectedProjectId,
  });

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>) => {
      if (e.button === 0 && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        clearMessagesCache(queryClient, conversation?.conversationId);
        queryClient.invalidateQueries([QueryKeys.messages]);

        const template: Partial<Parameters<typeof newConversation>[0]['template']> = {};
        if (project) {
          template.projectId = project.projectId;
          if (project.endpoint) {
            template.endpoint = project.endpoint as unknown as typeof template.endpoint;
          }
          if (project.model) {
            template.model = project.model;
          }
        }

        newConversation(Object.keys(template).length > 0 ? { template } : undefined);
        if (switchToHistory) {
          setActive(DEFAULT_PANEL);
        }
      }
    },
    [
      queryClient,
      conversation?.conversationId,
      newConversation,
      switchToHistory,
      setActive,
      project,
    ],
  );

  return (
    <TooltipAnchor
      side="right"
      description={localize('com_ui_new_chat')}
      render={
        <a
          href="/c/new"
          data-testid="new-chat-button"
          aria-label={localize('com_ui_new_chat')}
          className="group flex h-9 w-9 items-center justify-center rounded-xl border border-transparent text-text-secondary transition-all duration-200 hover:border-border-light hover:bg-surface-hover hover:text-text-primary active:translate-y-px"
          onClick={handleClick}
        >
          <PencilSimpleLine className="h-5 w-5" />
        </a>
      }
    />
  );
});

const AgentMarketplaceButton = memo(function AgentMarketplaceButton() {
  const navigate = useNavigate();
  const localize = useLocalize();
  const showAgentMarketplace = useShowMarketplace();

  const handleClick = useCallback(() => navigate('/agents'), [navigate]);

  if (!showAgentMarketplace) {
    return null;
  }

  return (
    <TooltipAnchor
      side="right"
      description={localize('com_agents_marketplace')}
      render={
        <Button
          size="icon"
          variant="ghost"
          aria-label={localize('com_agents_marketplace')}
          className="h-9 w-9 rounded-xl border border-transparent text-text-secondary-alt transition-all duration-200 hover:border-border-light hover:bg-surface-hover hover:text-text-primary [&_svg]:stroke-[1.75]"
          onClick={handleClick}
        >
          <LayoutGrid className="h-5 w-5" aria-hidden="true" />
        </Button>
      }
    />
  );
});

const NavIconButton = memo(function NavIconButton({
  link,
  isActive,
  expanded,
  setActive,
  onExpand,
  onCollapse,
}: {
  link: NavLink;
  isActive: boolean;
  expanded: boolean;
  setActive: (id: string) => void;
  onExpand?: () => void;
  onCollapse?: () => void;
}) {
  const localize = useLocalize();

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      if (link.onClick) {
        link.onClick(e);
        return;
      }
      if (isActive && expanded) {
        onCollapse?.();
        return;
      }
      if (!isActive) {
        setActive(link.id);
      }
      if (!expanded) {
        onExpand?.();
      }
    },
    [link, isActive, setActive, expanded, onExpand, onCollapse],
  );

  return (
    <TooltipAnchor
      description={localize(link.title)}
      side="right"
      render={
        <Button
          size="icon"
          variant="ghost"
          aria-label={localize(link.title)}
          aria-pressed={isActive}
          className={cn(
            'h-9 w-9 rounded-xl border border-transparent transition-all duration-200 [&_svg]:stroke-[1.75]',
            isActive
              ? 'border-border-light bg-surface-active-alt text-text-primary shadow-sm shadow-black/10'
              : 'text-text-secondary-alt hover:border-border-light hover:bg-surface-hover hover:text-text-primary',
          )}
          onClick={handleClick}
        >
          <link.icon className="h-5 w-5" aria-hidden="true" />
        </Button>
      }
    />
  );
});

function ExpandedPanel({
  links,
  expanded = true,
  onCollapse,
  onExpand,
}: {
  links: NavLink[];
  expanded?: boolean;
  onCollapse?: () => void;
  onExpand?: () => void;
}) {
  const localize = useLocalize();
  const { active, setActive } = useActivePanel();
  const effectiveActive = resolveActivePanel(active, links);

  const toggleLabel = expanded ? 'com_nav_close_sidebar' : 'com_nav_open_sidebar';
  const toggleClick = expanded ? onCollapse : onExpand;

  return (
    <div className="flex h-full flex-shrink-0 flex-col gap-2 border-r border-border-light bg-surface-primary-alt px-2 py-2">
      <TooltipAnchor
        side="right"
        description={localize(toggleLabel)}
        render={
          <Button
            id={expanded ? CLOSE_SIDEBAR_ID : undefined}
            data-testid={expanded ? 'close-sidebar-button' : 'open-sidebar-button'}
            size="icon"
            variant="ghost"
            aria-label={localize(toggleLabel)}
            aria-expanded={expanded}
            className="h-9 w-9 rounded-xl border border-transparent text-text-secondary-alt hover:border-border-light hover:text-text-primary [&_svg]:stroke-[1.75]"
            onClick={toggleClick}
          >
            <SidebarSimple aria-hidden="true" className="h-5 w-5" />
          </Button>
        }
      />
      <NewChatButton setActive={setActive} />
      <AgentMarketplaceButton />
      <div className="mx-2 border-b border-border-light" />
      <div className="flex flex-col gap-1 overflow-y-auto">
        {links.map((link) => (
          <NavIconButton
            key={link.id}
            link={link}
            isActive={link.id === effectiveActive}
            expanded={expanded ?? true}
            setActive={setActive}
            onExpand={onExpand}
            onCollapse={onCollapse}
          />
        ))}
      </div>

      <div className="mt-auto">
        <Suspense fallback={<Skeleton className="h-9 w-9 rounded-xl" />}>
          <AccountSettings collapsed />
        </Suspense>
      </div>
    </div>
  );
}

export default memo(ExpandedPanel);
