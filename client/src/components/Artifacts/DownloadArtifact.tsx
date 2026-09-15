import { Button } from '@librechat/client';
import { CheckCircle as CircleCheckBig, Download } from '@phosphor-icons/react';
import type { Artifact } from '~/common';
import useArtifactDownload from '~/hooks/Artifacts/useArtifactDownload';
import { useLocalize } from '~/hooks';

const DownloadArtifact = ({ artifact }: { artifact: Artifact }) => {
  const localize = useLocalize();
  const { isDownloaded, handleDownload } = useArtifactDownload(artifact);

  return (
    <Button
      size="icon"
      variant="ghost"
      className="h-9 w-9"
      onClick={handleDownload}
      aria-label={localize('com_ui_download_artifact')}
    >
      {isDownloaded ? (
        <CircleCheckBig size={16} aria-hidden="true" />
      ) : (
        <Download size={16} aria-hidden="true" />
      )}
    </Button>
  );
};

export default DownloadArtifact;
