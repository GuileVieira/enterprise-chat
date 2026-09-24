import { useCallback } from 'react';
import { useSetRecoilState } from 'recoil';
import {
  Constants,
  EToolResources,
  inferMimeType,
  isAssistantsEndpoint,
} from 'librechat-data-provider';
import type { UploadLifecycleCallbacks } from './useFileHandling';
import { useChatContext } from '~/Providers/ChatContext';
import { useUploadModalContext } from '~/Providers';
import { ephemeralAgentByConvoId } from '~/store';
import useUploadOptions from './useUploadOptions';
import useFileHandling from './useFileHandling';

/**
 * Returns a function that attaches files to a chosen upload destination, enabling the
 * matching ephemeral-agent capability first (file search is left for explicit opt-in to
 * preserve legacy behavior). Shared by the paste, drag, and modal flows. Resolves to
 * whether the files were accepted, so callers can gate success messaging on it.
 */
export default function useFileUploadRouter({
  saveUploadsToProject,
  imageDelivery,
}: { saveUploadsToProject?: boolean; imageDelivery?: 'provider' } = {}) {
  const { openModal, saveUploadsToProject: modalSaveUploadsToProject } = useUploadModalContext();
  const { handleFiles } = useFileHandling({
    saveUploadsToProject: saveUploadsToProject ?? modalSaveUploadsToProject,
    imageDelivery,
  });
  const { conversation, setFilesLoading } = useChatContext();
  const { getOptions, isConfigResolved } = useUploadOptions();
  const setEphemeralAgent = useSetRecoilState(
    ephemeralAgentByConvoId(conversation?.conversationId ?? Constants.NEW_CONVO),
  );

  return useCallback(
    (
      files: File[],
      toolResource?: EToolResources,
      uploadLifecycle?: UploadLifecycleCallbacks,
      destinationChosen = false,
    ) => {
      if (
        !destinationChosen &&
        toolResource == null &&
        isConfigResolved &&
        !isAssistantsEndpoint(conversation?.endpoint) &&
        files.length > 0 &&
        files.every((file) => inferMimeType(file.name, file.type)?.startsWith('image/')) &&
        getOptions(files).some((option) => option == null || option === EToolResources.file_search)
      ) {
        setFilesLoading(false);
        openModal(files, 'pasteImage');
        return Promise.resolve(false);
      }
      if (toolResource && toolResource !== EToolResources.file_search) {
        setEphemeralAgent((prev) => ({
          ...prev,
          [toolResource]: true,
        }));
      }
      return handleFiles(
        files.map((file) => {
          const inferredType = inferMimeType(file.name, file.type);
          return !file.type && inferredType?.startsWith('image/')
            ? new File([file], file.name, { type: inferredType, lastModified: file.lastModified })
            : file;
        }),
        toolResource,
        uploadLifecycle,
      );
    },
    [
      conversation?.endpoint,
      getOptions,
      handleFiles,
      isConfigResolved,
      openModal,
      setEphemeralAgent,
      setFilesLoading,
    ],
  );
}
