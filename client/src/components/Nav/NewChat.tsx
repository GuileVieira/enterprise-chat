import { useRecoilValue } from 'recoil';
import { QueryKeys } from 'librechat-data-provider';
import type { TConversation } from 'librechat-data-provider';
import { useQueryClient } from '@tanstack/react-query';
import { TooltipAnchor, Button, NewChatIcon } from '@librechat/client';
import { useLocalize, useNewConvo } from '~/hooks';
import { useProjectByIdQuery } from '~/data-provider';
import { clearMessagesCache, cn } from '~/utils';
import store from '~/store';

export default function NewChat({ className }: { className?: string }) {
  const localize = useLocalize();
  const queryClient = useQueryClient();
  const { newConversation } = useNewConvo();
  const conversation = useRecoilValue(store.conversationByIndex(0));
  const selectedProjectId = useRecoilValue(store.selectedProjectId);
  const { data: project } = useProjectByIdQuery(selectedProjectId ?? '', {
    enabled: !!selectedProjectId,
  });

  const clickHandler: React.MouseEventHandler<HTMLButtonElement> = (e) => {
    if (e.button === 0 && (e.ctrlKey || e.metaKey)) {
      window.open('/c/new', '_blank');
      return;
    }
    clearMessagesCache(queryClient, conversation?.conversationId);
    queryClient.invalidateQueries([QueryKeys.messages]);

    const template: Partial<TConversation> = {};
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
  };

  return (
    <TooltipAnchor
      description={localize('com_ui_new_chat')}
      render={
        <Button
          size="icon"
          variant="outline"
          data-testid="new-chat-button"
          aria-label={localize('com_ui_new_chat')}
          className={cn(
            'size-9 rounded-xl bg-presentation duration-0 hover:bg-surface-active-alt max-md:hidden',
            className,
          )}
          onClick={clickHandler}
        >
          <NewChatIcon />
        </Button>
      }
    />
  );
}
