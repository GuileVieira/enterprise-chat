import { memo, useEffect, useMemo, useState } from 'react';
import {
  Constants,
  supportsFiles,
  mergeFileConfig,
  isAgentsEndpoint,
  isEphemeralAgentId,
  isAssistantsEndpoint,
  getEndpointFileConfig,
} from 'librechat-data-provider';
import type { TConversation } from 'librechat-data-provider';
import type { ExtendedFile, FileSetter } from '~/common';
import useAgentUploadTarget from '~/hooks/Agents/useAgentUploadTarget';
import { useProjectPermissions } from '~/hooks/useProjectPermissions';
import { useGetFileConfig } from '~/data-provider';
import { isUnifiedUploadMode } from '~/utils';
import AttachFileMenu from './AttachFileMenu';
import { useFileUploadRouter, useLocalize } from '~/hooks';
import { useUploadModalContext } from '~/Providers';
import AttachFile from './AttachFile';

function AttachFileChat({
  disableInputs,
  conversation,
  files,
  setFiles,
  setFilesLoading,
}: {
  disableInputs: boolean;
  conversation: TConversation | null;
  files: Map<string, ExtendedFile>;
  setFiles: FileSetter;
  setFilesLoading: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const conversationId = conversation?.conversationId ?? Constants.NEW_CONVO;
  const { endpoint } = conversation ?? { endpoint: null };
  const projectId = conversation?.projectId ?? undefined;
  const localize = useLocalize();
  const [keepUploadsLocal, setKeepUploadsLocal] = useState(false);
  const { setSaveUploadsToProject } = useUploadModalContext();
  const isAgents = useMemo(() => isAgentsEndpoint(endpoint), [endpoint]);
  const isAssistants = useMemo(() => isAssistantsEndpoint(endpoint), [endpoint]);
  const { permissions: projectPermissions } = useProjectPermissions(projectId);

  const { agentProvider, endpointType, useResponsesApi, isResolvingAgentProvider } =
    useAgentUploadTarget(conversation);

  /* Success, not merely settled: a failed or paused fetch leaves the built-in defaults in
   * place, where the absent opt-out reads as unified. */
  const { data: fileConfig = null, isSuccess: isFileConfigLoaded } = useGetFileConfig({
    select: (data) => mergeFileConfig(data),
  });

  const fileConfigEndpoint = useMemo(
    () => (isAgents && agentProvider ? agentProvider : endpoint),
    [isAgents, agentProvider, endpoint],
  );
  const endpointFileConfig = useMemo(
    () =>
      getEndpointFileConfig({
        fileConfig,
        endpointType,
        endpoint: fileConfigEndpoint,
      }),
    [fileConfigEndpoint, fileConfig, endpointType],
  );
  const endpointSupportsFiles: boolean = useMemo(
    () => supportsFiles[endpointType ?? endpoint ?? ''] ?? false,
    [endpointType, endpoint],
  );
  const isUploadDisabled = useMemo(
    () =>
      disableInputs ||
      !isFileConfigLoaded ||
      isResolvingAgentProvider ||
      !!endpointFileConfig?.disabled,
    [disableInputs, isFileConfigLoaded, isResolvingAgentProvider, endpointFileConfig?.disabled],
  );
  const isSavedAgent =
    isAgents && conversation?.agent_id != null && !isEphemeralAgentId(conversation.agent_id);
  const isPolicyResolved =
    isFileConfigLoaded && !isResolvingAgentProvider && (!isSavedAgent || agentProvider != null);
  const isUnifiedMode = useMemo(
    () => isUnifiedUploadMode(endpointFileConfig, isPolicyResolved),
    [endpointFileConfig, isPolicyResolved],
  );
  const canSaveUploadsToProject = Boolean(projectId && projectPermissions.canEdit);
  const saveUploadsToProject = canSaveUploadsToProject && !keepUploadsLocal;
  const routeImageFiles = useFileUploadRouter({ saveUploadsToProject });
  useEffect(
    () => setSaveUploadsToProject(saveUploadsToProject),
    [saveUploadsToProject, setSaveUploadsToProject],
  );
  const isHardDisabled = disableInputs || !!endpointFileConfig?.disabled;

  useEffect(() => setKeepUploadsLocal(false), [projectId]);

  const projectStorageToggle = canSaveUploadsToProject ? (
    <button
      type="button"
      aria-label={
        keepUploadsLocal
          ? localize('com_ui_upload_save_to_project')
          : localize('com_ui_upload_keep_local')
      }
      aria-pressed={keepUploadsLocal}
      className="rounded px-2 py-1 text-xs text-text-secondary hover:bg-surface-tertiary"
      onClick={() => setKeepUploadsLocal((value) => !value)}
    >
      {keepUploadsLocal
        ? localize('com_ui_upload_keep_local')
        : localize('com_ui_upload_save_to_project')}
    </button>
  ) : null;

  if (isHardDisabled) return null;

  if (isAssistants && endpointSupportsFiles) {
    return (
      <div className="flex items-center gap-0.5">
        <AttachFile
          disabled={isUploadDisabled}
          files={files}
          setFiles={setFiles}
          setFilesLoading={setFilesLoading}
          conversation={conversation}
          saveUploadsToProject={saveUploadsToProject}
        />
        {projectStorageToggle}
      </div>
    );
  } else if (isAgents || endpointSupportsFiles) {
    return (
      <div className="flex items-center gap-0.5">
        <AttachFileMenu
          endpoint={endpoint}
          disabled={isUploadDisabled}
          endpointType={endpointType}
          conversationId={conversationId}
          agentId={conversation?.agent_id}
          endpointFileConfig={endpointFileConfig}
          isUnifiedMode={isUnifiedMode}
          useResponsesApi={useResponsesApi}
          files={files}
          setFiles={setFiles}
          setFilesLoading={setFilesLoading}
          conversation={conversation}
          saveUploadsToProject={saveUploadsToProject}
          routeImageFiles={routeImageFiles}
        />
        {projectStorageToggle}
      </div>
    );
  }
  return null;
}

export default memo(AttachFileChat);
