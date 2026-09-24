import React, { useMemo } from 'react';
import { useRecoilValue } from 'recoil';
import { Button, OGDialog, OGDialogTemplate } from '@librechat/client';
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
        title={localize(
          source === 'pasteImage' ? 'com_ui_paste_image_title' : 'com_ui_upload_type',
        )}
        className="w-[calc(100vw-2rem)] max-w-[36rem] gap-3 p-5 sm:p-6"
        headerClassName="text-left"
        mainClassName="py-0"
        footerClassName="flex-row justify-end pt-1"
        showCancelButton={false}
        buttons={
          <Button type="button" variant="ghost" size="sm" onClick={closeModal}>
            {localize('com_ui_cancel')}
          </Button>
        }
        main={
          <div className="flex flex-col gap-2">
            {visibleOptions.map((value) => {
              const { label, icon } = getOptionMeta(value);
              let optionLabel = label;
              let optionDescription: string | undefined;
              if (source === 'pasteImage') {
                if (value === EToolResources.file_search) {
                  const toProject = Boolean(conversation?.projectId && projectPermissions.canEdit);
                  optionLabel = localize(
                    toProject ? 'com_ui_paste_image_index_project' : 'com_ui_paste_image_index',
                  );
                  optionDescription = localize(
                    toProject
                      ? 'com_ui_paste_image_index_project_description'
                      : 'com_ui_paste_image_index_description',
                  );
                } else {
                  optionLabel = localize('com_ui_paste_image_visual');
                  optionDescription = localize('com_ui_paste_image_visual_description');
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
                  className="flex w-full items-start gap-3 rounded-xl border border-border-light bg-surface-secondary p-3 text-left transition-colors hover:bg-surface-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-text-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-dialog active:bg-surface-active-alt"
                >
                  <span
                    className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-surface-tertiary text-text-secondary"
                    aria-hidden="true"
                  >
                    {icon}
                  </span>
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-sm font-semibold leading-5 text-text-primary">
                      {optionLabel}
                    </span>
                    {optionDescription && (
                      <span className="text-xs leading-4 text-text-secondary">
                        {optionDescription}
                      </span>
                    )}
                  </span>
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
