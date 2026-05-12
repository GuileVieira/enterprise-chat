import { memo, useEffect, useMemo, useState } from 'react';
import { TooltipAnchor } from '@librechat/client';
import { FolderOpen } from '@phosphor-icons/react';
import {
  Constants,
  supportsFiles,
  mergeFileConfig,
  isAgentsEndpoint,
  resolveEndpointType,
  isAssistantsEndpoint,
  getEndpointFileConfig,
} from 'librechat-data-provider';
import type { TConversation } from 'librechat-data-provider';
import type { ExtendedFile, FileSetter } from '~/common';
import { useGetFileConfig, useGetEndpointsQuery, useGetAgentByIdQuery } from '~/data-provider';
import { useProjectPermissions } from '~/hooks/useProjectPermissions';
import { useAgentsMapContext } from '~/Providers';
import { useLocalize } from '~/hooks';
import { cn } from '~/utils';
import AttachFileMenu from './AttachFileMenu';
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
  const localize = useLocalize();
  const conversationId = conversation?.conversationId ?? Constants.NEW_CONVO;
  const { endpoint } = conversation ?? { endpoint: null };
  const projectId = conversation?.projectId;
  const isAgents = useMemo(() => isAgentsEndpoint(endpoint), [endpoint]);
  const isAssistants = useMemo(() => isAssistantsEndpoint(endpoint), [endpoint]);
  const { permissions, isLoading: isProjectPermissionsLoading } = useProjectPermissions(projectId);
  const [saveUploadsToProject, setSaveUploadsToProject] = useState(Boolean(projectId));

  useEffect(() => {
    setSaveUploadsToProject(Boolean(projectId));
  }, [projectId]);

  const agentsMap = useAgentsMapContext();

  const needsAgentFetch = useMemo(() => {
    if (!isAgents || !conversation?.agent_id) {
      return false;
    }
    const agent = agentsMap?.[conversation.agent_id];
    return !agent?.model_parameters;
  }, [isAgents, conversation?.agent_id, agentsMap]);

  const { data: agentData } = useGetAgentByIdQuery(conversation?.agent_id, {
    enabled: needsAgentFetch,
  });

  const useResponsesApi = useMemo(() => {
    if (!isAgents || !conversation?.agent_id || conversation?.useResponsesApi !== undefined) {
      return conversation?.useResponsesApi;
    }
    return (
      agentData?.model_parameters?.useResponsesApi ??
      agentsMap?.[conversation.agent_id]?.model_parameters?.useResponsesApi
    );
  }, [isAgents, conversation?.agent_id, conversation?.useResponsesApi, agentData, agentsMap]);

  const { data: fileConfig = null } = useGetFileConfig({
    select: (data) => mergeFileConfig(data),
  });

  const { data: endpointsConfig } = useGetEndpointsQuery();

  const agentProvider = useMemo(() => {
    if (!isAgents || !conversation?.agent_id) {
      return undefined;
    }
    return agentData?.provider ?? agentsMap?.[conversation.agent_id]?.provider;
  }, [isAgents, conversation?.agent_id, agentData, agentsMap]);

  const endpointType = useMemo(
    () => resolveEndpointType(endpointsConfig, endpoint, agentProvider),
    [endpointsConfig, endpoint, agentProvider],
  );

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
    () => (disableInputs || endpointFileConfig?.disabled) ?? false,
    [disableInputs, endpointFileConfig?.disabled],
  );
  const canSaveUploadsToProject = Boolean(projectId && permissions.canEdit);
  const shouldSaveUploadsToProject = Boolean(saveUploadsToProject && canSaveUploadsToProject);
  const projectUploadToggle = projectId ? (
    <TooltipAnchor
      id="project-upload-target"
      description={
        canSaveUploadsToProject
          ? localize(
              shouldSaveUploadsToProject
                ? 'com_ui_upload_keep_local'
                : 'com_ui_upload_save_to_project',
            )
          : localize('com_ui_upload_project_requires_edit')
      }
      render={
        <button
          type="button"
          aria-label={localize(
            shouldSaveUploadsToProject
              ? 'com_ui_upload_keep_local'
              : 'com_ui_upload_save_to_project',
          )}
          aria-pressed={shouldSaveUploadsToProject}
          disabled={disableInputs || isProjectPermissionsLoading || !canSaveUploadsToProject}
          className={cn(
            'flex size-9 items-center justify-center rounded-full p-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-opacity-50',
            shouldSaveUploadsToProject
              ? 'bg-surface-hover text-text-primary'
              : 'text-text-secondary hover:bg-surface-hover',
            (!canSaveUploadsToProject || isProjectPermissionsLoading) &&
              'cursor-not-allowed opacity-50 hover:bg-transparent',
          )}
          onClick={() => setSaveUploadsToProject((prev) => !prev)}
        >
          <FolderOpen size={22} aria-hidden="true" />
        </button>
      }
    />
  ) : null;

  if (isAssistants && endpointSupportsFiles && !isUploadDisabled) {
    return (
      <div className="flex items-center gap-0.5">
        {projectUploadToggle}
        <AttachFile
          disabled={disableInputs}
          files={files}
          setFiles={setFiles}
          setFilesLoading={setFilesLoading}
          conversation={conversation}
          saveUploadsToProject={shouldSaveUploadsToProject}
        />
      </div>
    );
  } else if ((isAgents || endpointSupportsFiles) && !isUploadDisabled) {
    return (
      <div className="flex items-center gap-0.5">
        {projectUploadToggle}
        <AttachFileMenu
          endpoint={endpoint}
          disabled={disableInputs}
          endpointType={endpointType}
          conversationId={conversationId}
          agentId={conversation?.agent_id}
          endpointFileConfig={endpointFileConfig}
          useResponsesApi={useResponsesApi}
          files={files}
          setFiles={setFiles}
          setFilesLoading={setFilesLoading}
          conversation={conversation}
          saveUploadsToProject={shouldSaveUploadsToProject}
        />
      </div>
    );
  }
  return null;
}

export default memo(AttachFileChat);
