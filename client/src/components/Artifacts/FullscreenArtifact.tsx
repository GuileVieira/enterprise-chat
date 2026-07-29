import { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import copy from 'copy-to-clipboard';
import { Code, Play, X, ArrowClockwise as RefreshCw } from '@phosphor-icons/react';
import { Button, Spinner, Radio } from '@librechat/client';
import type { SandpackPreviewRef } from '@codesandbox/sandpack-react/unstyled';
import type { MutableRefObject } from 'react';
import type { Artifact } from '~/common';
import CopyButton from '~/components/Messages/Content/CopyButton';
import { useCodeState } from '~/Providers/EditorContext';
import useArtifactProps from '~/hooks/Artifacts/useArtifactProps';
import { useGetStartupConfig } from '~/data-provider';
import { ArtifactPreview } from './ArtifactPreview';
import { isCodeOnlyArtifact, isPreviewOnlyArtifact } from '~/utils/artifacts';
import { displayFilename } from '~/components/Chat/Messages/Content/Parts/attachmentTypes';
import { useLocalize } from '~/hooks';
import { cn } from '~/utils';

type ArtifactViewTab = 'code' | 'preview';

export default function FullscreenArtifact({
  open,
  artifact,
  initialTab,
  onClose,
}: {
  open: boolean;
  artifact: Artifact;
  initialTab: ArtifactViewTab;
  onClose: () => void;
}) {
  const localize = useLocalize();
  const { currentCode } = useCodeState();
  const { data: startupConfig } = useGetStartupConfig();
  const previewRef = useRef<SandpackPreviewRef>();
  const [activeTab, setActiveTab] = useState<ArtifactViewTab>(initialTab);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const { files, fileKey, template, sharedProps } = useArtifactProps({ artifact });

  const isPreviewOnly = isPreviewOnlyArtifact(artifact.type);
  const isCodeOnly = isCodeOnlyArtifact(artifact.type);
  let displayedTab: ArtifactViewTab = activeTab;
  if (isPreviewOnly) {
    displayedTab = 'preview';
  } else if (isCodeOnly) {
    displayedTab = 'code';
  }
  const source = currentCode ?? artifact.content ?? '';

  const tabOptions = useMemo(() => {
    const options = [
      {
        value: 'code',
        label: localize('com_ui_code'),
        icon: <Code className="size-4" />,
      },
      {
        value: 'preview',
        label: localize('com_ui_preview'),
        icon: <Play className="size-4" />,
      },
    ];

    if (!isPreviewOnly && !isCodeOnly) {
      return options;
    }

    const constrainedTab = isPreviewOnly ? 'preview' : 'code';
    const filename = displayFilename(artifact.title);
    const tab = options.find((option) => option.value === constrainedTab);
    return tab ? [{ ...tab, label: filename || tab.label }] : options;
  }, [artifact.title, isCodeOnly, isPreviewOnly, localize]);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [artifact.id, initialTab]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose, open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [open]);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    previewRef.current?.getClient()?.dispatch({ type: 'refresh' });
    setTimeout(() => setIsRefreshing(false), 750);
  }, []);

  const handleCopy = useCallback(() => {
    if (!source) {
      return;
    }
    copy(source, { format: 'text/plain' });
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 3000);
  }, [source]);

  if (!open || typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex h-[100dvh] w-screen flex-col bg-surface-primary text-text-primary"
      role="dialog"
      aria-modal="true"
      aria-label={artifact.title || localize('com_ui_fullscreen_artifact')}
    >
      <div className="flex h-[56px] flex-shrink-0 items-center justify-between gap-3 border-b border-border-light bg-surface-primary-alt px-3">
        <div className="hidden min-w-0 flex-1 md:block">
          <div className="truncate text-sm font-medium">{artifact.title}</div>
        </div>

        <div className="ml-auto flex min-w-0 items-center gap-2">
          <Radio
            options={tabOptions}
            value={displayedTab}
            onChange={(value) => setActiveTab(value as ArtifactViewTab)}
            buttonClassName="h-9 px-1.5 gap-1 text-xs sm:px-3 sm:gap-1.5 sm:text-sm"
          />
          {displayedTab === 'preview' && (
            <Button
              size="icon"
              variant="ghost"
              className="h-9 w-9"
              onClick={handleRefresh}
              disabled={isRefreshing}
              aria-label={localize('com_ui_refresh')}
            >
              {isRefreshing ? <Spinner size={16} /> : <RefreshCw size={16} aria-hidden="true" />}
            </Button>
          )}
          <CopyButton isCopied={isCopied} iconOnly onClick={handleCopy} />
          <Button
            size="icon"
            variant="ghost"
            className="h-9 w-9"
            onClick={onClose}
            aria-label={localize('com_ui_close')}
          >
            <X size={16} aria-hidden="true" />
          </Button>
        </div>
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden bg-surface-primary">
        <div
          className={cn(
            'absolute inset-0',
            displayedTab === 'preview' ? 'block overflow-hidden' : 'hidden',
          )}
        >
          <ArtifactPreview
            files={files}
            fileKey={fileKey}
            template={template}
            sharedProps={sharedProps}
            currentCode={source}
            startupConfig={startupConfig}
            previewRef={previewRef as MutableRefObject<SandpackPreviewRef>}
          />
        </div>

        <div
          className={cn(
            'absolute inset-0 overflow-auto bg-surface-primary',
            displayedTab === 'code' ? 'block' : 'hidden',
          )}
        >
          <pre className="min-h-full whitespace-pre-wrap break-words p-6 font-mono text-sm leading-6 text-text-primary">
            {source}
          </pre>
        </div>

        <div
          className={cn(
            'absolute inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm transition-opacity duration-300',
            isRefreshing ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0',
          )}
          aria-hidden={!isRefreshing}
          role="status"
        >
          <Spinner size={24} />
        </div>
      </div>
    </div>,
    document.body,
  );
}
