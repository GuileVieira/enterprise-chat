import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Pencil } from 'lucide-react';
import { useProjectByIdQuery, useGetProjectFiles, useTitleGeneration } from '~/data-provider';
import { useLocalize } from '~/hooks';
import { useProjectPermissions } from '~/hooks/useProjectPermissions';
import ProjectPromptGroups from './ProjectPromptGroups';
import ProjectPromptManager from './ProjectPromptManager';
import ProjectConversationsTab from './ProjectConversationsTab';
import ProjectMemoryEditor from './ProjectMemoryEditor';
import ProjectFileUploader from './ProjectFileUploader';
import ProjectForm from './ProjectForm';
import ProjectPromptSnippetsManager from './ProjectPromptSnippetsManager';

const tabs = ['conversations', 'prompts', 'memories', 'files', 'settings'] as const;
type Tab = (typeof tabs)[number];

export default function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const localize = useLocalize();
  const [activeTab, setActiveTab] = useState<Tab>('conversations');
  const [isEditing, setIsEditing] = useState(false);
  const [isEditingSettings, setIsEditingSettings] = useState(false);
  useTitleGeneration(true);
  const projectQuery = useProjectByIdQuery(projectId ?? '');
  const filesQuery = useGetProjectFiles(projectId ?? '');
  const { permissions } = useProjectPermissions(projectId ?? '');

  const project = projectQuery.data;

  if (projectQuery.isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-border-light border-t-text-primary" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex h-full items-center justify-center text-text-secondary">
        {localize('com_ui_project_not_found')}
      </div>
    );
  }

  if (isEditing) {
    return (
      <div className="flex h-full flex-col overflow-auto">
        <ProjectForm project={project} onSuccess={() => setIsEditing(false)} />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border-light px-6 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-text-primary">{project.name}</h1>
          <div className="flex items-center gap-2">
            {permissions.canEdit && (
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
                title={localize('com_ui_edit')}
              >
                <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                {localize('com_ui_edit')}
              </button>
            )}
            {permissions.canEdit && (
              <span className="rounded-full bg-surface-tertiary px-2 py-0.5 text-xs text-text-secondary">
                {localize('com_ui_role_editor')}
              </span>
            )}
            {permissions.canDelete && (
              <span className="rounded-full bg-surface-tertiary px-2 py-0.5 text-xs text-text-secondary">
                {localize('com_ui_role_owner')}
              </span>
            )}
          </div>
        </div>
        {project.description ? (
          <p className="mt-1 text-sm text-text-secondary">{project.description}</p>
        ) : null}
      </div>

      <div className="flex border-b border-border-light">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab
                ? 'border-b-2 border-text-primary text-text-primary'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            {localize(`com_ui_project_tab_${tab}`)}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto p-6">
        {activeTab === 'conversations' && <ProjectConversationsTab project={project} />}
        {activeTab === 'prompts' && (
          <div className="flex flex-col gap-8">
            <ProjectPromptSnippetsManager project={project} />
            <div className="border-t border-border-light pt-8">
              <h3 className="mb-4 text-sm font-medium text-text-primary">
                {localize('com_ui_project_prompt_groups')}
              </h3>
              {permissions.canEdit || permissions.canDelete ? (
                <ProjectPromptManager project={project} />
              ) : (
                <ProjectPromptGroups promptGroupIds={project.promptGroupIds ?? []} />
              )}
            </div>
          </div>
        )}
        {activeTab === 'memories' && (
          <>
            {permissions.canEdit ? (
              <ProjectMemoryEditor project={project} />
            ) : (
              <div className="space-y-3">
                {project.memories && project.memories.length > 0 ? (
                  project.memories.map((mem, idx) => (
                    <div
                      key={idx}
                      className="rounded-lg border border-border-light bg-surface-secondary p-3"
                    >
                      <div className="text-sm font-medium text-text-primary">{mem.key}</div>
                      <div className="mt-1 text-sm text-text-secondary">{mem.value}</div>
                    </div>
                  ))
                ) : (
                  <div className="text-text-secondary">
                    {localize('com_ui_project_no_memories')}
                  </div>
                )}
              </div>
            )}
          </>
        )}
        {activeTab === 'files' && (
          <>
            {permissions.canEdit ? (
              <ProjectFileUploader
                projectId={project.projectId}
                files={filesQuery.data ?? []}
                isLoading={filesQuery.isLoading}
                onFilesChange={() => filesQuery.refetch()}
              />
            ) : (
              <div className="space-y-3">
                {filesQuery.isLoading ? (
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-border-light border-t-text-primary" />
                ) : filesQuery.data && filesQuery.data.length > 0 ? (
                  filesQuery.data.map((file) => (
                    <div
                      key={file.file_id}
                      className="flex items-center justify-between rounded-lg border border-border-light bg-surface-secondary p-3"
                    >
                      <div className="text-sm text-text-primary">{file.filename}</div>
                      <div className="text-xs text-text-secondary">{file.type}</div>
                    </div>
                  ))
                ) : (
                  <div className="text-text-secondary">{localize('com_ui_project_no_files')}</div>
                )}
              </div>
            )}
          </>
        )}
        {activeTab === 'settings' && (
          <>
            {isEditingSettings ? (
              <ProjectForm project={project} onSuccess={() => setIsEditingSettings(false)} />
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-medium text-text-secondary">
                    {localize('com_ui_project_instructions')}
                  </label>
                  {permissions.canEdit && (
                    <button
                      type="button"
                      onClick={() => setIsEditingSettings(true)}
                      className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
                    >
                      <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                      {localize('com_ui_edit')}
                    </button>
                  )}
                </div>
                <div className="mt-1 rounded-lg border border-border-light bg-surface-secondary p-3 text-sm text-text-primary">
                  {project.instructions || localize('com_ui_project_no_instructions')}
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary">
                    {localize('com_ui_project_model')}
                  </label>
                  <div className="mt-1 text-sm text-text-primary">{project.model || '-'}</div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
