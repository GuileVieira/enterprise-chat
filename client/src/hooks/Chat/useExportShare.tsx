import { useEffect, useRef, useState } from 'react';
import { useRecoilValue } from 'recoil';
import { PermissionTypes, Permissions } from 'librechat-data-provider';
import { Pen, ShareNetwork as Share2, Upload } from '@phosphor-icons/react';
import { useGetSharedLinkQuery } from 'librechat-data-provider/react-query';
import {
  Button,
  OGDialog,
  OGDialogContent,
  OGDialogTitle,
  useToastContext,
} from '@librechat/client';
import type { FormEvent, ReactNode } from 'react';
import type * as t from '~/common';
import ExportModal from '~/components/Nav/ExportConversation/ExportModal';
import { ShareButton } from '~/components/Conversations/ConvoOptions';
import { useUpdateConversationMutation } from '~/data-provider';
import { useHasAccess, useLocalize } from '~/hooks';
import store from '~/store';

export type UseExportShareResult = {
  /** New and search conversations have nothing to export or share. */
  show: boolean;
  items: t.MenuItemProps[];
  hasSharedLink: boolean;
  /** Rendered by whichever surface owns the menu; both need the same instance. */
  dialogs: ReactNode;
};

/**
 * Export and share as menu items, so the desktop icon menu and the mobile
 * overflow menu share one set of items and one pair of dialogs.
 */
export default function useExportShare({
  isSharedButtonEnabled,
}: {
  isSharedButtonEnabled: boolean;
}): UseExportShareResult {
  const localize = useLocalize();
  const [showExports, setShowExports] = useState(false);
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const { showToast } = useToastContext();

  const renameInputRef = useRef<HTMLInputElement>(null);
  const shareButtonRef = useRef<HTMLButtonElement>(null);
  const exportButtonRef = useRef<HTMLButtonElement>(null);

  const canCreateSharedLinks = useHasAccess({
    permissionType: PermissionTypes.SHARED_LINKS,
    permission: Permissions.CREATE,
  });
  const conversation = useRecoilValue(store.conversationByIndex(0));
  const updateConversation = useUpdateConversationMutation(conversation?.conversationId ?? '');

  const exportable =
    conversation != null &&
    conversation.conversationId != null &&
    conversation.conversationId !== 'new' &&
    conversation.conversationId !== 'search';

  /** Declared before the `exportable` gate so hook order stays stable. */
  const { data: share } = useGetSharedLinkQuery(conversation?.conversationId ?? '', {
    enabled: exportable && isSharedButtonEnabled,
  });

  useEffect(() => {
    if (!showRenameDialog) {
      return;
    }
    requestAnimationFrame(() => {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    });
  }, [showRenameDialog]);

  const submitRename = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const conversationId = conversation?.conversationId;
    if (!conversationId) {
      return;
    }
    try {
      await updateConversation.mutateAsync({
        conversationId,
        title: renameValue.trim() || localize('com_ui_untitled'),
      });
      setShowRenameDialog(false);
    } catch {
      showToast({ message: localize('com_ui_rename_failed'), status: 'error' });
    }
  };

  const items: t.MenuItemProps[] = [
    {
      label: localize('com_ui_rename'),
      onClick: () => {
        setRenameValue(conversation?.title ?? '');
        setShowRenameDialog(true);
      },
      icon: <Pen className="size-4 text-text-secondary" />,
      hideOnClick: false,
      render: (props) => <button {...props} type="button" />,
    },
    {
      label: localize('com_ui_share'),
      onClick: () => setShowShareDialog(true),
      icon: <Share2 className="size-4 text-text-secondary" />,
      show: isSharedButtonEnabled && canCreateSharedLinks,
      /** NOTE: THE FOLLOWING PROPS ARE REQUIRED FOR MENU ITEMS THAT OPEN DIALOGS */
      hideOnClick: false,
      ref: shareButtonRef,
      render: (props) => <button {...props} data-testid="share-conversation-menu-item" />,
    },
    {
      label: localize('com_endpoint_export'),
      onClick: () => setShowExports(true),
      icon: <Upload className="size-4 text-text-secondary" />,
      /** NOTE: THE FOLLOWING PROPS ARE REQUIRED FOR MENU ITEMS THAT OPEN DIALOGS */
      hideOnClick: false,
      ref: exportButtonRef,
      render: (props) => <button {...props} />,
    },
  ];

  return {
    show: exportable,
    items,
    hasSharedLink: Boolean(share?.shareId),
    dialogs: exportable ? (
      <>
        <ExportModal
          open={showExports}
          onOpenChange={setShowExports}
          conversation={conversation}
          triggerRef={exportButtonRef}
          aria-label={localize('com_ui_export_convo_modal')}
        />
        <OGDialog open={showRenameDialog} onOpenChange={setShowRenameDialog}>
          <OGDialogContent className="w-11/12 max-w-md">
            <OGDialogTitle className="text-base font-medium">
              {localize('com_ui_rename_conversation')}
            </OGDialogTitle>
            <form className="mt-4 flex flex-col gap-4" onSubmit={submitRename}>
              <input
                ref={renameInputRef}
                type="text"
                maxLength={100}
                value={renameValue}
                aria-label={localize('com_ui_new_conversation_title')}
                onChange={(event) => setRenameValue(event.target.value)}
                className="rounded-lg border border-border-medium bg-surface-primary px-3 py-2 text-sm text-text-primary outline-none focus:ring-2 focus:ring-ring-primary"
              />
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setShowRenameDialog(false)}>
                  {localize('com_ui_cancel')}
                </Button>
                <Button type="submit" variant="submit" disabled={updateConversation.isLoading}>
                  {localize('com_ui_save')}
                </Button>
              </div>
            </form>
          </OGDialogContent>
        </OGDialog>
        <ShareButton
          triggerRef={shareButtonRef}
          conversationId={conversation.conversationId ?? ''}
          open={showShareDialog}
          onOpenChange={setShowShareDialog}
        />
      </>
    ) : null,
  };
}
