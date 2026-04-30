import { useState, useCallback } from 'react';
import { Plus, Trash2, Save } from 'lucide-react';
import { useUpdateProjectMutation } from '~/data-provider';
import { useLocalize } from '~/hooks';
import type { TProject } from 'librechat-data-provider';

interface ProjectMemoryEditorProps {
  project: TProject;
}

export default function ProjectMemoryEditor({ project }: ProjectMemoryEditorProps) {
  const localize = useLocalize();
  const updateMutation = useUpdateProjectMutation();

  const [memories, setMemories] = useState<{ key: string; value: string }[]>(
    project.memories && project.memories.length > 0
      ? project.memories.map((m) => ({ key: m.key, value: m.value }))
      : [{ key: '', value: '' }],
  );

  const [hasChanges, setHasChanges] = useState(false);

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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-text-secondary">
          Memories are key-value pairs injected into every conversation in this project.
        </p>
        <div className="flex items-center gap-2">
          {hasChanges && (
            <span className="text-xs text-text-tertiary">{localize('com_ui_unsaved_changes')}</span>
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
        </div>
      </div>

      <div className="space-y-2">
        {memories.map((mem, idx) => (
          <div
            key={idx}
            className="flex items-center gap-2 rounded-lg border border-border-light bg-surface-secondary p-2"
          >
            <input
              type="text"
              value={mem.key}
              onChange={(e) => handleChange(idx, 'key', e.target.value)}
              placeholder={localize('com_ui_project_memory_key_placeholder')}
              className="min-w-0 flex-1 rounded-md border border-border-light bg-surface-primary px-2 py-1.5 text-sm text-text-primary outline-none transition-colors focus:border-text-primary"
            />
            <input
              type="text"
              value={mem.value}
              onChange={(e) => handleChange(idx, 'value', e.target.value)}
              placeholder={localize('com_ui_project_memory_value_placeholder')}
              className="min-w-0 flex-[2] rounded-md border border-border-light bg-surface-primary px-2 py-1.5 text-sm text-text-primary outline-none transition-colors focus:border-text-primary"
            />
            <button
              type="button"
              onClick={() => handleRemove(idx)}
              className="rounded-md p-1.5 text-text-secondary transition-colors hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-950"
              title={localize('com_ui_delete')}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={handleAdd}
        className="flex items-center gap-1.5 rounded-lg border border-border-light px-3 py-1.5 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
      >
        <Plus className="h-4 w-4" />
        {localize('com_ui_project_add_memory')}
      </button>
    </div>
  );
}
