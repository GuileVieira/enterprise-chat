import { useState, useMemo, useCallback } from 'react';
import { Plus, X, Save } from 'lucide-react';
import { usePromptGroupsInfiniteQuery, useUpdateProjectMutation, useGetPromptGroup } from '~/data-provider';
import { useLocalize } from '~/hooks';
import { cn } from '~/utils';
import type { TProject } from 'librechat-data-provider';

function PromptGroupBadge({ groupId }: { groupId: string }) {
  const groupQuery = useGetPromptGroup(groupId);
  const group = groupQuery.data;

  if (groupQuery.isLoading) {
    return (
      <span className="h-6 w-24 animate-pulse rounded-full bg-surface-tertiary" />
    );
  }

  return (
    <span className="rounded-full bg-surface-tertiary px-3 py-1 text-xs text-text-primary">
      {group?.name ?? groupId}
    </span>
  );
}

interface ProjectPromptManagerProps {
  project: TProject;
}

export default function ProjectPromptManager({ project }: ProjectPromptManagerProps) {
  const localize = useLocalize();
  const updateMutation = useUpdateProjectMutation();
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = usePromptGroupsInfiniteQuery(
    { category: '', pageSize: 20 },
    { enabled: isSelectorOpen },
  );

  const allGroups = useMemo(() => {
    return data ? data.pages.flatMap((page) => page.promptGroups) : [];
  }, [data]);

  const [selectedIds, setSelectedIds] = useState<string[]>(project.promptGroupIds ?? []);
  const hasChanges = useMemo(() => {
    const original = project.promptGroupIds ?? [];
    if (selectedIds.length !== original.length) return true;
    const sortedSelected = [...selectedIds].sort();
    const sortedOriginal = [...original].sort();
    return sortedSelected.some((id, i) => id !== sortedOriginal[i]);
  }, [selectedIds, project.promptGroupIds]);

  const toggleGroup = useCallback((groupId: string) => {
    setSelectedIds((prev) =>
      prev.includes(groupId) ? prev.filter((id) => id !== groupId) : [...prev, groupId],
    );
  }, []);

  const handleSave = useCallback(() => {
    updateMutation.mutate(
      {
        projectId: project.projectId,
        payload: { promptGroupIds: selectedIds },
      },
      {
        onSuccess: () => setIsSelectorOpen(false),
      },
    );
  }, [selectedIds, project.projectId, updateMutation]);

  const associatedGroups = useMemo(() => {
    const ids = new Set(project.promptGroupIds ?? []);
    return allGroups.filter((g) => g._id && ids.has(g._id));
  }, [allGroups, project.promptGroupIds]);

  const availableGroups = useMemo(() => {
    const ids = new Set(selectedIds);
    return allGroups.filter((g) => g._id && !ids.has(g._id));
  }, [allGroups, selectedIds]);

  if (isSelectorOpen) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-text-primary">
            {localize('com_ui_project_select_prompts')}
          </h3>
          <div className="flex items-center gap-2">
            {hasChanges && (
              <span className="text-xs text-text-tertiary">
                {localize('com_ui_unsaved_changes')}
              </span>
            )}
            <button
              type="button"
              onClick={handleSave}
              disabled={updateMutation.isLoading || !hasChanges}
              className="flex items-center gap-1.5 rounded-lg bg-text-primary px-3 py-1.5 text-xs font-medium text-surface-primary transition-colors hover:opacity-90 disabled:opacity-50"
            >
              {updateMutation.isLoading ? (
                <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-surface-primary border-t-transparent" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              {localize('com_ui_save')}
            </button>
            <button
              type="button"
              onClick={() => {
                setIsSelectorOpen(false);
                setSelectedIds(project.promptGroupIds ?? []);
              }}
              className="rounded-lg px-2 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-hover"
            >
              {localize('com_ui_cancel')}
            </button>
          </div>
        </div>

        {/* Associated */}
        {selectedIds.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-text-secondary">
              {localize('com_ui_project_associated_prompts')}
            </p>
            <div className="flex flex-wrap gap-2">
              {associatedGroups.map((group) => (
                <button
                  key={group._id}
                  type="button"
                  onClick={() => group._id && toggleGroup(group._id)}
                  className="flex items-center gap-1 rounded-full bg-surface-tertiary px-3 py-1 text-xs text-text-primary transition-colors hover:bg-red-100 hover:text-red-600"
                >
                  {group.name}
                  <X className="h-3 w-3" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Available */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-text-secondary">
            {localize('com_ui_project_available_prompts')}
          </p>
          {availableGroups.length === 0 ? (
            <p className="text-xs text-text-tertiary">{localize('com_ui_no_prompts_available')}</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {availableGroups.map((group) => (
                <button
                  key={group._id}
                  type="button"
                  onClick={() => group._id && toggleGroup(group._id)}
                  className="rounded-full border border-border-light px-3 py-1 text-xs text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
                >
                  {group.name}
                </button>
              ))}
            </div>
          )}
          {hasNextPage && (
            <button
              type="button"
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
              className="text-xs text-text-tertiary transition-colors hover:text-text-secondary"
            >
              {isFetchingNextPage ? localize('com_ui_loading') : localize('com_ui_load_more')}
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {project.promptGroupIds && project.promptGroupIds.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {project.promptGroupIds.map((id) => (
            <PromptGroupBadge key={id} groupId={id} />
          ))}
        </div>
      ) : (
        <div className="text-text-secondary">{localize('com_ui_project_no_prompt_groups')}</div>
      )}
      <button
        type="button"
        onClick={() => setIsSelectorOpen(true)}
        className="flex items-center gap-1.5 rounded-lg border border-border-light px-3 py-1.5 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
      >
        <Plus className="h-4 w-4" />
        {localize('com_ui_manage_prompts')}
      </button>
    </div>
  );
}
