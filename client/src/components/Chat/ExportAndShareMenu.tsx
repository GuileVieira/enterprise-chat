import { useState, useId, useRef, useEffect } from 'react';
import { useRecoilValue } from 'recoil';
import * as Ariakit from '@ariakit/react';
import { DotsThree, Pen, ShareNetwork as Share2, Upload } from '@phosphor-icons/react';
import type { FormEvent } from 'react';
import {
  Button,
  OGDialog,
  DropdownPopup,
  TooltipAnchor,
  useMediaQuery,
  OGDialogTitle,
  useToastContext,
  OGDialogContent,
} from '@librechat/client';
import type * as t from '~/common';
import ExportModal from '~/components/Nav/ExportConversation/ExportModal';
import { ShareButton } from '~/components/Conversations/ConvoOptions';
import { useLocalize } from '~/hooks';
import { useUpdateConversationMutation } from '~/data-provider';
import store from '~/store';

export default function ExportAndShareMenu({
  isSharedButtonEnabled,
}: {
  isSharedButtonEnabled: boolean;
}) {
  const localize = useLocalize();
  const { showToast } = useToastContext();
  const [showExports, setShowExports] = useState(false);
  const [isPopoverActive, setIsPopoverActive] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);

  const menuId = useId();
  const renameInputRef = useRef<HTMLInputElement>(null);
  const shareButtonRef = useRef<HTMLButtonElement>(null);
  const exportButtonRef = useRef<HTMLButtonElement>(null);
  const isSmallScreen = useMediaQuery('(max-width: 768px)');
  const conversation = useRecoilValue(store.conversationByIndex(0));
  const updateConversation = useUpdateConversationMutation(conversation?.conversationId ?? '');

  const exportable =
    conversation &&
    conversation.conversationId != null &&
    conversation.conversationId !== 'new' &&
    conversation.conversationId !== 'search';

  useEffect(() => {
    if (!showRenameDialog) {
      return;
    }
    requestAnimationFrame(() => {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    });
  }, [showRenameDialog]);

  if (exportable === false) {
    return null;
  }

  const shareHandler = () => {
    setShowShareDialog(true);
  };

  const renameHandler = () => {
    setRenameValue(conversation?.title ?? '');
    setShowRenameDialog(true);
  };

  const exportHandler = () => {
    setShowExports(true);
  };

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
      showToast({
        message: localize('com_ui_rename_failed'),
        status: 'error',
      });
    }
  };

  const dropdownItems: t.MenuItemProps[] = [
    {
      label: localize('com_ui_rename'),
      onClick: renameHandler,
      icon: <Pen className="icon-md mr-2 text-text-secondary" />,
      hideOnClick: false,
    },
    {
      label: localize('com_ui_share'),
      onClick: shareHandler,
      icon: <Share2 className="icon-md mr-2 text-text-secondary" />,
      show: isSharedButtonEnabled,
      /** NOTE: THE FOLLOWING PROPS ARE REQUIRED FOR MENU ITEMS THAT OPEN DIALOGS */
      hideOnClick: false,
      ref: shareButtonRef,
      render: (props) => <button {...props} />,
    },
    {
      label: localize('com_endpoint_export'),
      onClick: exportHandler,
      icon: <Upload className="icon-md mr-2 text-text-secondary" />,
      /** NOTE: THE FOLLOWING PROPS ARE REQUIRED FOR MENU ITEMS THAT OPEN DIALOGS */
      hideOnClick: false,
      ref: exportButtonRef,
      render: (props) => <button {...props} />,
    },
  ];

  return (
    <>
      <DropdownPopup
        portal={true}
        menuId={menuId}
        focusLoop={true}
        unmountOnHide={true}
        isOpen={isPopoverActive}
        setIsOpen={setIsPopoverActive}
        trigger={
          <TooltipAnchor
            description={localize('com_endpoint_export_share')}
            render={
              <Ariakit.MenuButton
                id="export-menu-button"
                aria-label={localize('com_endpoint_export_share')}
                className="inline-flex size-9 flex-shrink-0 items-center justify-center rounded-xl border border-border-light bg-presentation text-text-primary transition-all ease-in-out hover:bg-surface-tertiary disabled:pointer-events-none disabled:opacity-50 radix-state-open:bg-surface-tertiary"
              >
                <DotsThree
                  weight="bold"
                  className="h-5 w-5 text-text-primary"
                  aria-hidden="true"
                  focusable="false"
                />
              </Ariakit.MenuButton>
            }
          />
        }
        items={dropdownItems}
        className={isSmallScreen ? '' : 'absolute right-0 top-0 mt-2'}
      />
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
              className="rounded-lg border border-border-medium bg-surface-primary px-3 py-2 text-sm text-text-primary outline-none focus:ring-2 focus:ring-ring"
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
  );
}
