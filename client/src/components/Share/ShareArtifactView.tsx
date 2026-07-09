import { useMemo, useRef } from 'react';
import type { MutableRefObject } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useRecoilValue } from 'recoil';
import { buildTree } from 'librechat-data-provider';
import type { TStartupConfig } from 'librechat-data-provider';
import { Spinner, useMediaQuery } from '@librechat/client';
import {
  useGetSharedMessages,
  useGetTenantSharedMessages,
} from 'librechat-data-provider/react-query';
import type { SandpackPreviewRef } from '@codesandbox/sandpack-react/unstyled';
import { ShareMessagesProvider } from './ShareMessagesProvider';
import { ArtifactPreview } from '~/components/Artifacts/ArtifactPreview';
import type { Artifact } from '~/common';
import { useGetStartupConfig } from '~/data-provider';
import { useLocalize } from '~/hooks';
import MessagesView from './MessagesView';
import { findShareArtifactId } from '~/utils';
import useArtifactProps from '~/hooks/Artifacts/useArtifactProps';
import store from '~/store';

export default function ShareArtifactView({
  shareId,
  isTenantShare = false,
}: {
  shareId: string;
  isTenantShare?: boolean;
}) {
  const localize = useLocalize();
  const [searchParams] = useSearchParams();
  const artifacts = useRecoilValue(store.artifactsState);
  const previewRef = useRef<SandpackPreviewRef>();
  const isSmallScreen = useMediaQuery('(max-width: 1023px)');
  const { data: startupConfig } = useGetStartupConfig();
  const publicShare = useGetSharedMessages(shareId, {
    enabled: !isTenantShare && !!shareId,
  });
  const tenantShare = useGetTenantSharedMessages(shareId, {
    enabled: isTenantShare && !!shareId,
  });
  const { data, isLoading } = isTenantShare ? tenantShare : publicShare;
  const dataTree = data && buildTree({ messages: data.messages });
  const messagesTree = dataTree?.length === 0 ? null : (dataTree ?? null);
  const targetId = findShareArtifactId(
    artifacts,
    searchParams.get('artifact'),
    searchParams.get('artifactHash'),
    searchParams.get('artifactIndex'),
  );
  const artifact = targetId ? artifacts?.[targetId] : undefined;

  const hiddenMessages = data && messagesTree && messagesTree.length !== 0 && (
    <div className="pointer-events-none fixed h-0 w-0 overflow-hidden opacity-0" aria-hidden="true">
      <ShareMessagesProvider messages={data.messages}>
        <MessagesView messagesTree={messagesTree} conversationId="shared-conversation" />
      </ShareMessagesProvider>
    </div>
  );

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (!data || !messagesTree) {
    return (
      <div className="flex h-screen items-center justify-center">
        {localize('com_ui_shared_link_not_found')}
      </div>
    );
  }

  if (!artifact) {
    return (
      <>
        {hiddenMessages}
        <div className="flex h-screen items-center justify-center">
          <Spinner />
        </div>
      </>
    );
  }

  return (
    <>
      {hiddenMessages}
      <StandaloneArtifactPreview
        artifact={artifact}
        startupConfig={startupConfig}
        previewRef={previewRef as MutableRefObject<SandpackPreviewRef>}
        className={isSmallScreen ? 'h-[100svh]' : 'h-screen'}
      />
    </>
  );
}

function StandaloneArtifactPreview({
  artifact,
  startupConfig,
  previewRef,
  className,
}: {
  artifact: Artifact;
  startupConfig?: TStartupConfig;
  previewRef: MutableRefObject<SandpackPreviewRef>;
  className: string;
}) {
  const { files, fileKey, template, sharedProps } = useArtifactProps({ artifact });
  const currentCode = useMemo(() => artifact.content ?? '', [artifact.content]);

  return (
    <main className={`w-screen bg-white ${className}`}>
      <ArtifactPreview
        files={files}
        fileKey={fileKey}
        template={template}
        previewRef={previewRef}
        sharedProps={sharedProps}
        currentCode={currentCode}
        startupConfig={startupConfig}
      />
    </main>
  );
}
