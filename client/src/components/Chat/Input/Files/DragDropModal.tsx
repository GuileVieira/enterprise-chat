import React, { useMemo } from 'react';
import { useRecoilValue } from 'recoil';
import { OGDialog, OGDialogTemplate } from '@librechat/client';
import {
  Constants,
  Providers,
  EToolResources,
  EModelEndpoint,
  isDocumentSupportedProvider,
} from 'librechat-data-provider';
import {
  FileImage as FileImageIcon,
  FileMagnifyingGlass as FileSearch,
  FileText as FileType2Icon,
  ImageSquare as ImageUpIcon,
  TerminalWindow as TerminalSquareIcon,
} from '@phosphor-icons/react';
import {
  useLocalize,
  useUploadOptions,
  useFileUploadRouter,
  useAgentToolPermissions,
} from '~/hooks';
import { useDragDropContext, useUploadModalContext } from '~/Providers';
import { useChatContext } from '~/Providers/ChatContext';
import { useProjectPermissions } from '~/hooks/useProjectPermissions';
import { ephemeralAgentByConvoId } from '~/store';

const DragDropModal = () => {
  const localize = useLocalize();
  const { isVisible, files, source, closeModal } = useUploadModalContext();
  const { conversation } = useChatContext();
  const { permissions: projectPermissions } = useProjectPermissions(
    conversation?.projectId ?? undefined,
  );
  const { conversationId, agentId, endpoint, endpointType, useResponsesApi } = useDragDropContext();
  const ephemeralAgent = useRecoilValue(
    ephemeralAgentByConvoId(conversationId ?? Constants.NEW_CONVO),
  );
  const { provider } = useAgentToolPermissions(agentId, ephemeralAgent);
  const { getOptions } = useUploadOptions();
  const routeFiles = useFileUploadRouter();
  const routeProjectFiles = useFileUploadRouter({ saveUploadsToProject: true });
  const routeVisualImage = useFileUploadRouter({
    saveUploadsToProject: false,
    imageDelivery: 'provider',
  });

  const isProviderDocSupported = useMemo(() => {
    let currentProvider = (provider || endpoint) ?? '';
    if (currentProvider.toLowerCase() === Providers.OPENROUTER) {
      currentProvider = Providers.OPENROUTER;
    }
    const isAzureWithResponsesApi =
      (currentProvider === EModelEndpoint.azureOpenAI ||
        endpointType === EModelEndpoint.azureOpenAI) &&
      useResponsesApi === true;
    return (
      isDocumentSupportedProvider(endpointType) ||
      isDocumentSupportedProvider(currentProvider) ||
      isAzureWithResponsesApi
    );
  }, [provider, endpoint, endpointType, useResponsesApi]);

  const getOptionMeta = (value: EToolResources | undefined) => {
    switch (value) {
      case EToolResources.file_search:
        return {
          label: localize('com_ui_upload_file_search'),
          icon: <FileSearch className="icon-md" />,
        };
      case EToolResources.execute_code:
        return {
          label: localize('com_ui_upload_code_environment'),
          icon: <TerminalSquareIcon className="icon-md" />,
        };
      case EToolResources.context:
        return {
          label: localize('com_ui_upload_ocr_text'),
          icon: <FileType2Icon className="icon-md" />,
        };
      default:
        return isProviderDocSupported
          ? {
              label: localize('com_ui_upload_provider'),
              icon: <FileImageIcon className="icon-md" />,
            }
          : {
              label: localize('com_ui_upload_image_input'),
              icon: <ImageUpIcon className="icon-md" />,
            };
    }
  };

  const options = useMemo(() => getOptions(files), [getOptions, files]);
  const visibleOptions =
    source === 'pasteImage'
      ? options.filter((value) => value == null || value === EToolResources.file_search)
      : options;

  if (!isVisible) {
    return null;
  }

  return (
    <OGDialog open={isVisible} onOpenChange={(open) => !open && closeModal()}>
      <OGDialogTemplate
        title={localize('com_ui_upload_type')}
        className="w-11/12 sm:w-[440px] md:w-[400px] lg:w-[360px]"
        main={
          <div className="flex flex-col gap-2">
            {visibleOptions.map((value) => {
              const { label, icon } = getOptionMeta(value);
              let pasteLabel = label;
              if (source === 'pasteImage') {
                if (value === EToolResources.file_search) {
                  pasteLabel = localize(
                    conversation?.projectId && projectPermissions.canEdit
                      ? 'com_ui_paste_image_index_project'
                      : 'com_ui_paste_image_index',
                  );
                } else {
                  pasteLabel = localize('com_ui_paste_image_visual');
                }
              }
              return (
                <button
                  key={value ?? 'provider'}
                  type="button"
                  onClick={() => {
                    if (source === 'pasteImage') {
                      if (
                        value === EToolResources.file_search &&
                        conversation?.projectId &&
                        projectPermissions.canEdit
                      ) {
                        void routeProjectFiles(files, value, undefined, true);
                      } else if (value === EToolResources.file_search) {
                        void routeFiles(files, value, undefined, true);
                      } else {
                        void routeVisualImage(files, value, undefined, true);
                      }
                    } else {
                      void routeFiles(files, value, undefined, true);
                    }
                    closeModal();
                  }}
                  className="flex items-center gap-2 rounded-lg p-2 hover:bg-surface-active-alt"
                >
                  {icon}
                  <span>{pasteLabel}</span>
                </button>
              );
            })}
          </div>
        }
      />
    </OGDialog>
  );
};

export default DragDropModal;
