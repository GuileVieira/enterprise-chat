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
      <div className="flex flex-col gap-3 rounded-2xl border border-border-light bg-surface-secondary p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-2xl text-sm leading-6 text-text-secondary">
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
              className="focus:ring-ring-primary/20 min-w-0 rounded-lg border border-border-light bg-surface-primary px-3 py-2 text-sm text-text-primary outline-none transition-colors placeholder:text-text-tertiary hover:border-border-medium focus:border-text-primary focus:ring-2"
            />
            <input
              type="text"
              value={mem.value}
              onChange={(e) => handleChange(idx, 'value', e.target.value)}
              placeholder={localize('com_ui_project_memory_value_placeholder')}
              className="focus:ring-ring-primary/20 min-w-0 rounded-lg border border-border-light bg-surface-primary px-3 py-2 text-sm text-text-primary outline-none transition-colors placeholder:text-text-tertiary hover:border-border-medium focus:border-text-primary focus:ring-2"
            />
            <button
              type="button"
              onClick={() => handleRemove(idx)}
              className="rounded-lg p-2 text-text-secondary transition-colors hover:bg-red-100 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-primary dark:hover:bg-red-950"
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
        className="flex h-10 items-center gap-2 rounded-xl border border-border-light bg-surface-secondary px-4 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-primary active:scale-[0.99]"
      >
        <Plus className="h-4 w-4" />
        {localize('com_ui_project_add_memory')}
      </button>
    </div>
  );
}
