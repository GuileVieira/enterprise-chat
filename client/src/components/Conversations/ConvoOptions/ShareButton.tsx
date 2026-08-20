import React, { useState, useEffect } from 'react';
import { useRecoilValue } from 'recoil';
import { QRCodeSVG } from 'qrcode.react';
import { Copy, ClipboardText as CopyCheck } from '@phosphor-icons/react';
import { useGetSharedLinkQuery } from 'librechat-data-provider/react-query';
import { OGDialogTemplate, Button, Spinner, OGDialog } from '@librechat/client';
import type { ShareLinkSearch } from '~/utils';
import { useLocalize, useCopyToClipboard } from '~/hooks';
import SharedLinkButton from './SharedLinkButton';
import { useCreateTenantSharedLinkMutation, useGetStartupConfig } from '~/data-provider';
import { buildShareLinkUrl, buildTenantShareLinkUrl, cn } from '~/utils';
import store from '~/store';

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
  const [showQR, setShowQR] = useState(false);
  const [sharedLink, setSharedLink] = useState('');
  const [tenantSharedLink, setTenantSharedLink] = useState('');
  const [isCopying, setIsCopying] = useState(false);
  const [isTenantCopying, setIsTenantCopying] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const copyLink = useCopyToClipboard({ text: sharedLink });
  const copyTenantLink = useCopyToClipboard({ text: tenantSharedLink });
  const { data: startupConfig } = useGetStartupConfig();
  const shareLinkBaseUrl = startupConfig?.shareLinkBaseUrl;
  const copyLinkAndAnnounce = (setIsCopying: React.Dispatch<React.SetStateAction<boolean>>) => {
    setAnnouncement(localize('com_ui_link_copied'));
    copyLink(setIsCopying);
    setTimeout(() => {
      setAnnouncement('');
    }, 1000);
  };
  const latestMessage = useRecoilValue(store.latestMessageFamily(0));
  const shareTargetMessageId = targetMessageId ?? latestMessage?.messageId;
  const { data: share, isLoading } = useGetSharedLinkQuery(conversationId, shareTargetMessageId);
  const tenantShareMutation = useCreateTenantSharedLinkMutation({
    onSuccess: (data) =>
      setTenantSharedLink(buildTenantShareLinkUrl(data.shareId, linkSearch, shareLinkBaseUrl)),
  });

  useEffect(() => {
    if (share?.shareId) {
      setSharedLink(buildShareLinkUrl(share.shareId, linkSearch, shareLinkBaseUrl));
    }
  }, [linkSearch, share, shareLinkBaseUrl]);

  const button =
    isLoading === true ? null : (
      <SharedLinkButton
        share={share}
        conversationId={conversationId}
        targetMessageId={shareTargetMessageId}
        showQR={showQR}
        setShowQR={setShowQR}
        setSharedLink={setSharedLink}
        linkSearch={linkSearch}
        shareLinkBaseUrl={shareLinkBaseUrl}
      />
    );

  const shareId = share?.shareId ?? '';
  const isArtifactShare = linkSearch?.artifactId != null;
  const createTenantShareLink = () => {
    tenantShareMutation.mutate({ conversationId, targetMessageId: shareTargetMessageId });
  };

  return (
    <OGDialog open={open} onOpenChange={onOpenChange} triggerRef={triggerRef}>
      {children}
      <OGDialogTemplate
        buttons={button}
        showCloseButton={true}
        showCancelButton={false}
        title={localize(isArtifactShare ? 'com_ui_share_artifact' : 'com_ui_share_link_to_chat')}
        className="max-h-[90vh] max-w-[550px] overflow-y-auto"
        main={
          <div id="share-conversation-dialog">
            <div className="h-full py-2 text-text-primary">
              {(() => {
                if (isLoading === true) {
                  return <Spinner className="m-auto h-14 animate-spin" />;
                }

                return share?.success === true
                  ? localize('com_ui_share_update_message')
                  : localize('com_ui_share_create_message');
              })()}
            </div>
            <div className="relative items-center overflow-auto rounded-lg p-2">
              {showQR && (
                <div className="mb-4 flex flex-col items-center">
                  <QRCodeSVG
                    value={sharedLink}
                    size={200}
                    marginSize={2}
                    className="rounded-2xl"
                    title={localize('com_ui_share_qr_code_description')}
                  />
                </div>
              )}

              {shareId && (
                <div>
                  <div className="mb-2 text-sm font-medium text-text-primary">
                    {localize(
                      isArtifactShare ? 'com_ui_share_artifact_link' : 'com_ui_share_chat_link',
                    )}
                  </div>
                  <div className="flex items-center gap-2 rounded-md bg-surface-secondary p-2">
                    <div className="flex-1 break-all text-sm text-text-secondary">{sharedLink}</div>
                    <span className="sr-only" aria-live="polite" aria-atomic="true">
                      {announcement}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      aria-label={localize('com_ui_copy_link')}
                      onClick={() => {
                        if (isCopying) {
                          return;
                        }
                        copyLinkAndAnnounce(setIsCopying);
                      }}
                      className={cn('shrink-0', isCopying ? 'cursor-default' : '')}
                    >
                      {isCopying ? (
                        <CopyCheck className="size-4" aria-hidden="true" />
                      ) : (
                        <Copy className="size-4" aria-hidden="true" />
                      )}
                    </Button>
                  </div>
                </div>
              )}
              <div className="mt-3 rounded-md border border-border-light p-3">
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
                    onClick={createTenantShareLink}
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
                      onClick={() => {
                        if (isTenantCopying) {
                          return;
                        }
                        setAnnouncement(localize('com_ui_link_copied'));
                        copyTenantLink(setIsTenantCopying);
                        setTimeout(() => setAnnouncement(''), 1000);
                      }}
                      className={cn('shrink-0', isTenantCopying ? 'cursor-default' : '')}
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
          </div>
        }
      />
    </OGDialog>
  );
}
