import { useMemo, useState } from 'react';
import { ShareNetwork } from '@phosphor-icons/react';
import { Button } from '@librechat/client';
import type { Artifact } from '~/common';
import type { ShareLinkSearch } from '~/utils';
import { useArtifactsContext, useShareContext } from '~/Providers';
import { useGetStartupConfig } from '~/data-provider';
import { useLocalize } from '~/hooks';
import { ShareButton } from '~/components/Conversations/ConvoOptions';

export default function ShareArtifact({ artifact }: { artifact: Artifact }) {
  const localize = useLocalize();
  const { isSharedConvo } = useShareContext();
  const { conversationId } = useArtifactsContext();
  const { data: startupConfig } = useGetStartupConfig();
  const [open, setOpen] = useState(false);

  const linkSearch = useMemo<ShareLinkSearch>(() => {
    return { artifactId: artifact.id };
  }, [artifact.id]);

  if (
    isSharedConvo ||
    !conversationId ||
    !artifact.messageId ||
    startupConfig?.sharedLinksEnabled !== true
  ) {
    return null;
  }

  return (
    <>
      <Button
        size="icon"
        variant="ghost"
        className="h-9 w-9"
        onClick={() => setOpen(true)}
        aria-label={localize('com_ui_share')}
      >
        <ShareNetwork size={16} aria-hidden="true" />
      </Button>
      <ShareButton
        open={open}
        linkSearch={linkSearch}
        onOpenChange={setOpen}
        conversationId={conversationId}
        targetMessageId={artifact.messageId}
      />
    </>
  );
}
