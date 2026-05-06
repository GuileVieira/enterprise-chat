import { useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  ChatCircle,
  FileText,
  Folder,
  GearSix,
  PencilSimple,
  Sparkle,
} from '@phosphor-icons/react';
import { useProjectByIdQuery, useGetProjectFiles, useTitleGeneration } from '~/data-provider';
import { useLocalize } from '~/hooks';
import { useProjectPermissions } from '~/hooks/useProjectPermissions';
import { cn } from '~/utils';
import ProjectPromptGroups from './ProjectPromptGroups';
import ProjectPromptManager from './ProjectPromptManager';
import ProjectConversationsTab from './ProjectConversationsTab';
import ProjectMemoryEditor from './ProjectMemoryEditor';
import ProjectFileUploader from './ProjectFileUploader';
import ProjectForm from './ProjectForm';
import ProjectPromptSnippetsManager from './ProjectPromptSnippetsManager';

const tabs = ['conversations', 'prompts', 'memories', 'files', 'settings'] as const;
type Tab = (typeof tabs)[number];

const tabIcons: Record<Tab, typeof ChatCircle> = {
  conversations: ChatCircle,
  prompts: Sparkle,
  memories: FileText,
  files: Folder,
  settings: GearSix,
};

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
      <div className="flex h-full flex-col gap-5 p-6">
        <div className="h-28 animate-pulse rounded-2xl border border-border-light bg-surface-secondary" />
        <div className="h-12 animate-pulse rounded-xl bg-surface-secondary" />
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="h-24 animate-pulse rounded-xl bg-surface-secondary" />
          <div className="h-24 animate-pulse rounded-xl bg-surface-secondary" />
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-sm text-text-secondary">
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

  const indexedFiles = filesQuery.data?.filter((file) => file.embedded).length ?? 0;
  const totalFiles = filesQuery.data?.length ?? 0;
  const memoryCount = (project.memories?.length ?? 0) + (project.memoryKeys?.length ?? 0);

  return (
    <div className="flex h-full flex-col overflow-hidden bg-surface-primary">
      <div className="border-b border-border-light px-5 py-5">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border-light bg-surface-secondary text-text-secondary">
                <Folder className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <h1 className="truncate text-2xl font-semibold leading-tight text-text-primary">
                  {project.name}
                </h1>
                {project.description ? (
                  <p className="mt-1 max-w-2xl text-sm leading-6 text-text-secondary">
                    {project.description}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {permissions.canEdit && (
                <span className="rounded-lg border border-border-light bg-surface-secondary px-2.5 py-1 text-xs font-medium text-text-secondary">
                  {localize('com_ui_role_editor')}
                </span>
              )}
              {permissions.canDelete && (
                <span className="rounded-lg border border-border-light bg-surface-secondary px-2.5 py-1 text-xs font-medium text-text-secondary">
                  {localize('com_ui_role_owner')}
                </span>
              )}
              {permissions.canEdit && (
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="flex h-9 items-center gap-2 rounded-xl border border-border-light bg-surface-secondary px-3 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-primary active:scale-[0.99]"
                  title={localize('com_ui_edit')}
                >
                  <PencilSimple className="h-4 w-4" aria-hidden="true" />
                  {localize('com_ui_edit')}
                </button>
              )}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-border-light bg-surface-secondary px-4 py-3">
              <div className="text-xs font-medium text-text-tertiary">
                {localize('com_ui_project_files')}
              </div>
              <div className="mt-1 font-mono text-lg font-semibold text-text-primary">
                {indexedFiles}/{totalFiles}
              </div>
            </div>
            <div className="rounded-xl border border-border-light bg-surface-secondary px-4 py-3">
              <div className="text-xs font-medium text-text-tertiary">
                {localize('com_ui_project_tab_memories')}
              </div>
              <div className="mt-1 font-mono text-lg font-semibold text-text-primary">
                {memoryCount}
              </div>
            </div>
            <div className="rounded-xl border border-border-light bg-surface-secondary px-4 py-3">
              <div className="text-xs font-medium text-text-tertiary">
                {localize('com_ui_project_model')}
              </div>
              <div className="mt-1 truncate text-sm font-semibold text-text-primary">
                {project.model || '-'}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="border-b border-border-light px-5 py-3">
        <div className="hide-scrollbar mx-auto flex w-full max-w-6xl gap-1 overflow-x-auto rounded-xl bg-surface-secondary p-1">
          {tabs.map((tab) => {
            const Icon = tabIcons[tab];
            return (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={cn(
                  'flex h-9 shrink-0 items-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-primary active:scale-[0.99]',
                  activeTab === tab
                    ? 'bg-surface-primary text-text-primary shadow-sm'
                    : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary',
                )}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {localize(`com_ui_project_tab_${tab}`)}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-auto px-5 py-6">
        <div className="mx-auto w-full max-w-6xl">
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
                        className="rounded-xl border border-border-light bg-surface-secondary p-4"
                      >
                        <div className="text-sm font-medium text-text-primary">{mem.key}</div>
                        <div className="mt-1 text-sm leading-6 text-text-secondary">
                          {mem.value}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-xl border border-dashed border-border-light py-10 text-center text-sm text-text-secondary">
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
                    <div className="h-20 animate-pulse rounded-xl bg-surface-secondary" />
                  ) : filesQuery.data && filesQuery.data.length > 0 ? (
                    filesQuery.data.map((file) => (
                      <div
                        key={file.file_id}
                        className="flex items-center justify-between rounded-xl border border-border-light bg-surface-secondary p-4"
                      >
                        <div className="text-sm text-text-primary">{file.filename}</div>
                        <div className="text-xs text-text-secondary">{file.type}</div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-xl border border-dashed border-border-light py-10 text-center text-sm text-text-secondary">
                      {localize('com_ui_project_no_files')}
                    </div>
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
                <div className="space-y-5">
                  <div className="flex items-center justify-between">
                    <label className="block text-sm font-medium text-text-secondary">
                      {localize('com_ui_project_instructions')}
                    </label>
                    {permissions.canEdit && (
                      <button
                        type="button"
                        onClick={() => setIsEditingSettings(true)}
                        className="flex h-8 items-center gap-1.5 rounded-lg border border-border-light bg-surface-secondary px-2.5 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
                      >
                        <PencilSimple className="h-3.5 w-3.5" aria-hidden="true" />
                        {localize('com_ui_edit')}
                      </button>
                    )}
                  </div>
                  <div className="rounded-xl border border-border-light bg-surface-secondary p-4 text-sm leading-6 text-text-primary">
                    {project.instructions || localize('com_ui_project_no_instructions')}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
