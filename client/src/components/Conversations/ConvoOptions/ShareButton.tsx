import React, { useState, useEffect, useCallback } from 'react';
import { useRecoilValue } from 'recoil';
import { QRCodeSVG } from 'qrcode.react';
import { useQueryClient } from '@tanstack/react-query';
import { QueryKeys, dataService } from 'librechat-data-provider';
import { Copy, ClipboardText as CopyCheck } from '@phosphor-icons/react';
import { useGetSharedLinkQuery } from 'librechat-data-provider/react-query';
import {
  ESide,
  Button,
  Label,
  Switch,
  Spinner,
  OGDialog,
  InfoHoverCard,
  OGDialogTitle,
  OGDialogHeader,
  OGDialogContent,
  OGDialogDescription,
} from '@librechat/client';
import type { ShareLinkSearch } from '~/utils';
import { useGetLatestMessage, useLatestMessageId } from '~/hooks/Messages/useLatestMessage';
import { useCreateTenantSharedLinkMutation, useGetStartupConfig } from '~/data-provider';
import { buildShareLinkUrl, buildTenantShareLinkUrl, cn } from '~/utils';
import SharedLinkCopyButton from './SharedLinkCopyButton';
import { useCopyToClipboard, useLocalize } from '~/hooks';
import SharedLinkButton from './SharedLinkButton';
import store from '~/store';

type ShareTargetErrorCode = 'TARGET_MESSAGE_NOT_FOUND' | 'NO_MESSAGES';

const createShareTargetError = (
  code: ShareTargetErrorCode,
): Error & { code: ShareTargetErrorCode } => Object.assign(new Error(code), { code });

export default function ShareButton({
  conversationId,
  open,
  onOpenChange,
  triggerRef,
  targetMessageId,
  linkSearch,
  children,
}: {
  conversationId: string;
  open: boolean;
  onOpenChange: React.Dispatch<React.SetStateAction<boolean>>;
  triggerRef?: React.RefObject<HTMLButtonElement>;
  targetMessageId?: string;
  linkSearch?: ShareLinkSearch;
  children?: React.ReactNode;
}) {
  const localize = useLocalize();
  const { data: startupConfig } = useGetStartupConfig();
  const canSnapshotFiles = startupConfig?.sharedLinksSnapshotFilesEnabled === true;
  const shareLinkBaseUrl = startupConfig?.shareLinkBaseUrl;
  const queryClient = useQueryClient();
  const [showQR, setShowQR] = useState(true);
  const [sharedLink, setSharedLink] = useState('');
  const [snapshotFiles, setSnapshotFiles] = useState(true);
  const [tenantSharedLink, setTenantSharedLink] = useState('');
  const [isTenantCopying, setIsTenantCopying] = useState(false);
  const copyTenantLink = useCopyToClipboard({ text: tenantSharedLink });
  const shareFilesSwitchRef = React.useRef<HTMLButtonElement>(null);
  const activeConversationId = useRecoilValue(store.conversationIdByIndex(0));
  const activeLatestMessageId = useLatestMessageId(0);
  const getActiveLatestMessage = useGetLatestMessage(0);
  /** `useLatestMessageId` resolves the active pane's branch tail, so it only describes
   * this dialog's conversation when the two match. Sharing another conversation from
   * the list sends no target, which shares it in full instead of a foreign message. */
  const isActiveConversation = activeConversationId === conversationId;
  const latestMessageId = targetMessageId ?? (isActiveConversation ? activeLatestMessageId : null);
  const resolveTargetMessageId = useCallback(async (): Promise<string> => {
    let selectedMessageId =
      targetMessageId ?? getActiveLatestMessage()?.messageId ?? latestMessageId;

    if (!selectedMessageId) {
      await queryClient.fetchQuery(
        [QueryKeys.messages, conversationId],
        () => dataService.getMessagesByConvoId(conversationId),
        { staleTime: 0 },
      );
      selectedMessageId = getActiveLatestMessage()?.messageId ?? null;
    }

    if (!selectedMessageId) {
      throw createShareTargetError('NO_MESSAGES');
    }

    const persistedMessages = await dataService.getMessageById(conversationId, selectedMessageId);
    if (!persistedMessages.some((message) => message.messageId === selectedMessageId)) {
      throw createShareTargetError('TARGET_MESSAGE_NOT_FOUND');
    }

    return selectedMessageId;
  }, [conversationId, getActiveLatestMessage, latestMessageId, queryClient, targetMessageId]);
  const { data: share, isLoading } = useGetSharedLinkQuery(
    conversationId,
    latestMessageId ?? undefined,
  );
  const shareId = share?.shareId ?? '';
  const tenantShareContextRef = React.useRef({ conversationId, targetMessageId: latestMessageId });
  tenantShareContextRef.current = { conversationId, targetMessageId: latestMessageId };
  const tenantShareMutation = useCreateTenantSharedLinkMutation({
    onSuccess: (data, variables) => {
      const current = tenantShareContextRef.current;
      if (
        variables.conversationId !== current.conversationId ||
        (variables.targetMessageId ?? null) !== current.targetMessageId
      ) {
        return;
      }
      setTenantSharedLink(buildTenantShareLinkUrl(data.shareId, linkSearch, shareLinkBaseUrl));
    },
  });

  useEffect(() => {
    setTenantSharedLink('');
    setIsTenantCopying(false);
  }, [conversationId, latestMessageId]);

  // Keyed on the conversation too: this dialog outlives a switch between conversations,
  // so a link built for the previous one must not stay in the copy field.
  useEffect(() => {
    setSharedLink(shareId ? buildShareLinkUrl(shareId, linkSearch, shareLinkBaseUrl) : '');
  }, [conversationId, linkSearch, shareId, shareLinkBaseUrl]);

  // Reflect an existing link's stored "share files" choice so the control isn't
  // misleading, and fall back to the enabled default for a conversation with no link
  // or a legacy link that stored no choice, rather than inheriting the last one.
  useEffect(() => {
    setSnapshotFiles(
      share?.success === true && typeof share.snapshotFiles === 'boolean'
        ? share.snapshotFiles
        : true,
    );
  }, [conversationId, share?.success, share?.snapshotFiles]);

  const button =
    isLoading === true ? null : (
      <SharedLinkButton
        share={share}
        conversationId={conversationId}
        targetMessageId={latestMessageId ?? undefined}
        resolveTargetMessageId={
          targetMessageId != null || isActiveConversation ? resolveTargetMessageId : undefined
        }
        showQR={showQR}
        setShowQR={setShowQR}
        sharedLink={sharedLink}
        setSharedLink={setSharedLink}
        snapshotFiles={canSnapshotFiles ? snapshotFiles : undefined}
        linkSearch={linkSearch}
        shareLinkBaseUrl={shareLinkBaseUrl}
      />
    );

  return (
    <OGDialog open={open} onOpenChange={onOpenChange} triggerRef={triggerRef}>
      {children}
      <OGDialogContent
        className="flex max-h-[90vh] w-11/12 max-w-md flex-col gap-0 overflow-hidden p-0 shadow-2xl"
        onOpenAutoFocus={(event) => {
          if (shareFilesSwitchRef.current) {
            event.preventDefault();
            shareFilesSwitchRef.current.focus();
          }
        }}
      >
        <OGDialogHeader className="shrink-0 px-6 pb-0 pr-14 pt-6 text-left">
          <div className="flex items-center gap-2">
            <OGDialogTitle className="text-xl font-semibold tracking-tight">
              {localize('com_ui_share_link_to_chat')}
            </OGDialogTitle>
            <InfoHoverCard
              icon="info"
              side={ESide.Bottom}
              text={
                share?.success === true
                  ? localize('com_ui_share_update_message')
                  : localize('com_ui_share_create_message')
              }
            />
          </div>
          <OGDialogDescription className="sr-only">
            {share?.success === true
              ? localize('com_ui_share_update_message')
              : localize('com_ui_share_create_message')}
          </OGDialogDescription>
        </OGDialogHeader>

        {isLoading === true ? (
          <div className="flex min-h-72 items-center justify-center px-6 pb-6">
            <Spinner className="size-6" />
          </div>
        ) : (
          <div
            id="share-conversation-dialog"
            className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 pb-6 pt-6"
          >
            {canSnapshotFiles && (
              <div className="flex items-center justify-between gap-4">
                <div className="flex min-w-0 items-center gap-2">
                  <Label
                    id="share-files-label"
                    htmlFor="share-files-switch"
                    className="cursor-pointer text-sm font-medium text-text-primary"
                  >
                    {localize('com_ui_share_files')}
                  </Label>
                  <InfoHoverCard
                    icon="info"
                    side={ESide.Bottom}
                    text={`${localize('com_ui_share_files_description')}${
                      shareId ? ` ${localize('com_ui_share_files_update_note')}` : ''
                    }`}
                  />
                </div>
                <Switch
                  ref={shareFilesSwitchRef}
                  id="share-files-switch"
                  checked={snapshotFiles}
                  onCheckedChange={setSnapshotFiles}
                  aria-labelledby="share-files-label"
                />
              </div>
            )}

            {showQR && shareId && (
              <div className="flex min-h-56 items-center justify-center py-1">
                <div className="rounded-2xl bg-surface-qr p-3 shadow-sm">
                  <QRCodeSVG
                    value={sharedLink}
                    size={200}
                    marginSize={1}
                    title={localize('com_ui_share_qr_code_description')}
                  />
                </div>
              </div>
            )}

            {shareId && <SharedLinkCopyButton sharedLink={sharedLink} />}

            <div className="pt-1">{button}</div>

            <div className="rounded-md border border-border-light p-3">
              <div className="mb-2 text-sm font-medium text-text-primary">
                {localize('com_ui_share_tenant_link')}
              </div>
              <div className="mb-3 text-sm text-text-secondary">
                {localize('com_ui_share_tenant_message')}
              </div>
              {!tenantSharedLink ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={tenantShareMutation.isLoading}
                  onClick={() =>
                    tenantShareMutation.mutate({
                      conversationId,
                      targetMessageId: latestMessageId ?? undefined,
                    })
                  }
                >
                  {tenantShareMutation.isLoading ? (
                    <Spinner className="size-4" />
                  ) : (
                    localize('com_ui_create_tenant_link')
                  )}
                </Button>
              ) : (
                <div className="flex items-center gap-2 rounded-md bg-surface-secondary p-2">
                  <div className="flex-1 break-all text-sm text-text-secondary">
                    {tenantSharedLink}
                  </div>
                  <Button
                    size="sm"
                    type="button"
                    variant="outline"
                    aria-label={localize('com_ui_copy_link')}
                    disabled={isTenantCopying}
                    onClick={() => copyTenantLink(setIsTenantCopying)}
                    className={cn('shrink-0', isTenantCopying && 'cursor-default')}
                  >
                    {isTenantCopying ? (
                      <CopyCheck className="size-4" aria-hidden="true" />
                    ) : (
                      <Copy className="size-4" aria-hidden="true" />
                    )}
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </OGDialogContent>
    </OGDialog>
  );
}
