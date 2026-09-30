import { useState, useCallback } from 'react';
import { Plus, FloppyDisk as Save, Trash as Trash2 } from '@phosphor-icons/react';
import { usePublishSharedMemoryMutation, useUpdateProjectMutation } from '~/data-provider';
import { useHasAccess, useLocalize } from '~/hooks';
import type { PublishSharedMemoryResult } from '~/data-provider/SharedMemories/types';
import { Permissions, PermissionTypes } from 'librechat-data-provider';
import type { TProject } from 'librechat-data-provider';
import { Checkbox, OGDialog, OGDialogTemplate } from '@librechat/client';

interface ProjectMemoryEditorProps {
  project: TProject;
}

export default function ProjectMemoryEditor({ project }: ProjectMemoryEditorProps) {
  const localize = useLocalize();
  const updateMutation = useUpdateProjectMutation();
  const publishMutation = usePublishSharedMemoryMutation();
  const canPublish = useHasAccess({
    permissionType: PermissionTypes.SHARED_MEMORIES,
    permission: Permissions.CREATE,
  });

  const [memories, setMemories] = useState<{ key: string; value: string }[]>(
    project.memories && project.memories.length > 0
      ? project.memories.map((m) => ({ key: m.key, value: m.value }))
      : [{ key: '', value: '' }],
  );

  const [hasChanges, setHasChanges] = useState(false);
  const [publishKey, setPublishKey] = useState<string | null>(null);
  const [replaceWithLink, setReplaceWithLink] = useState(false);

  const handleChange = useCallback((index: number, field: 'key' | 'value', value: string) => {
    setMemories((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
    setHasChanges(true);
  }, []);

  const handleAdd = useCallback(() => {
    setMemories((prev) => [...prev, { key: '', value: '' }]);
    setHasChanges(true);
  }, []);

  const handleRemove = useCallback((index: number) => {
    setMemories((prev) => prev.filter((_, i) => i !== index));
    setHasChanges(true);
  }, []);

  const handleSave = useCallback(() => {
    const validMemories = memories.filter((m) => m.key.trim() !== '');
    updateMutation.mutate(
      {
        projectId: project.projectId,
        payload: { memories: validMemories },
      },
      {
        onSuccess: () => setHasChanges(false),
      },
    );
  }, [memories, project.projectId, updateMutation]);

  const publish = () => {
    if (!publishKey) return;
    publishMutation.mutate(
      {
        source: { type: 'project', projectId: project.projectId, key: publishKey },
        replaceWithLink,
      },
      {
        onSuccess: (result) => {
          const published = result as PublishSharedMemoryResult;
          if (published.sourceReplaced)
            setMemories((items) => items.filter((item) => item.key !== publishKey));
          setPublishKey(null);
        },
      },
    );
  };

  return (
    <fieldset disabled={updateMutation.isLoading} className="min-w-0 space-y-4">
      <div className="flex flex-col gap-3 rounded-2xl border border-border-light bg-surface-secondary p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-2xl text-sm leading-6 text-text-secondary">
          {localize('com_ui_project_memories_description')}
        </p>
        <div className="flex items-center gap-2">
          {hasChanges && (
            <span className="text-xs text-text-tertiary">{localize('com_ui_unsaved_changes')}</span>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={updateMutation.isLoading || !hasChanges}
            className="flex h-9 items-center gap-1.5 rounded-xl bg-text-primary px-3 text-xs font-medium text-surface-primary transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-primary active:scale-[0.99] disabled:opacity-50"
          >
            {updateMutation.isLoading ? (
              <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-surface-primary border-t-transparent" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            {localize('com_ui_save')}
          </button>
        </div>
      </div>

      <div className="space-y-2 rounded-2xl border border-border-light bg-surface-secondary p-2">
        {memories.map((mem, idx) => (
          <div
            key={idx}
            className="grid gap-2 rounded-xl border border-transparent bg-surface-secondary p-2 transition-colors hover:border-border-light hover:bg-surface-hover sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto]"
          >
            <input
              type="text"
              value={mem.key}
              onChange={(e) => handleChange(idx, 'key', e.target.value)}
              placeholder={localize('com_ui_project_memory_key_placeholder')}
              className="min-w-0 rounded-lg border border-border-light bg-surface-primary px-3 py-2 text-sm text-text-primary outline-none transition-colors placeholder:text-text-tertiary hover:border-border-medium focus:border-text-primary focus:ring-2 focus:ring-ring-primary/20"
            />
            <input
              type="text"
              value={mem.value}
              onChange={(e) => handleChange(idx, 'value', e.target.value)}
              placeholder={localize('com_ui_project_memory_value_placeholder')}
              className="min-w-0 rounded-lg border border-border-light bg-surface-primary px-3 py-2 text-sm text-text-primary outline-none transition-colors placeholder:text-text-tertiary hover:border-border-medium focus:border-text-primary focus:ring-2 focus:ring-ring-primary/20"
            />
            <button
              type="button"
              onClick={() => handleRemove(idx)}
              className="rounded-lg p-2 text-text-secondary transition-colors hover:bg-red-100 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-primary dark:hover:bg-red-950"
              title={localize('com_ui_delete')}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
            {canPublish && mem.key.trim() && (
              <button
                type="button"
                onClick={() => {
                  setReplaceWithLink(false);
                  setPublishKey(mem.key);
                }}
                className="rounded-lg p-2 text-text-secondary transition-colors hover:bg-surface-hover"
                aria-label={localize('com_ui_publish_memory')}
              >
                {localize('com_ui_publish_memory')}
              </button>
            )}
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={handleAdd}
        className="flex h-10 items-center gap-2 rounded-xl border border-border-light bg-surface-secondary px-4 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-primary active:scale-[0.99]"
      >
        <Plus className="h-4 w-4" />
        {localize('com_ui_project_add_memory')}
      </button>
      {updateMutation.isError && (
        <p role="alert" className="text-sm text-red-600">
          {localize('com_ui_project_memories_save_error')}
        </p>
      )}
      <OGDialog open={publishKey !== null} onOpenChange={(open) => !open && setPublishKey(null)}>
        <OGDialogTemplate
          title={localize('com_ui_publish_memory')}
          main={
            <div className="space-y-3 text-sm text-text-secondary">
              <p>{localize('com_ui_shared_memory_audience')}</p>
              <label className="flex gap-2">
                <Checkbox
                  checked={replaceWithLink}
                  onCheckedChange={(value) => setReplaceWithLink(Boolean(value))}
                  aria-label={localize('com_ui_replace_local_memory_link')}
                />
                {localize('com_ui_replace_local_memory_link')}
              </label>
            </div>
          }
          selection={{ selectText: localize('com_ui_publish_memory'), selectHandler: publish }}
        />
      </OGDialog>
    </fieldset>
  );
}
