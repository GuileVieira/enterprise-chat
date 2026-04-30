import { useState } from 'react';
import { Plus, Trash2, Save } from 'lucide-react';
import { useUpdateProjectMutation } from '~/data-provider';
import { useLocalize } from '~/hooks';
import type { TProject } from 'librechat-data-provider';

interface ProjectPromptSnippetsManagerProps {
  project: TProject;
}

export default function ProjectPromptSnippetsManager({ project }: ProjectPromptSnippetsManagerProps) {
  const localize = useLocalize();
  const updateProject = useUpdateProjectMutation();
  const [snippets, setSnippets] = useState(project.promptSnippets ?? []);
  const [newSnippet, setNewSnippet] = useState({ title: '', content: '' });
  const [isAdding, setIsAdding] = useState(false);

  const handleAdd = () => {
    if (!newSnippet.title || !newSnippet.content) {
      return;
    }
    const updated = [...snippets, newSnippet];
    setSnippets(updated);
    setNewSnippet({ title: '', content: '' });
    setIsAdding(false);
    updateProject.mutate({
      projectId: project.projectId,
      payload: { promptSnippets: updated },
    });
  };

  const handleDelete = (index: number) => {
    const updated = snippets.filter((_, i) => i !== index);
    setSnippets(updated);
    updateProject.mutate({
      projectId: project.projectId,
      payload: { promptSnippets: updated },
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-text-primary">
          {localize('com_ui_project_prompt_snippets')}
        </h3>
        {!isAdding && (
          <button
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-1 text-xs text-text-secondary hover:text-text-primary transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            {localize('com_ui_add')}
          </button>
        )}
      </div>

      {isAdding && (
        <div className="space-y-3 rounded-lg border border-border-light bg-surface-secondary p-3">
          <input
            type="text"
            value={newSnippet.title}
            onChange={(e) => setNewSnippet({ ...newSnippet, title: e.target.value })}
            placeholder={localize('com_ui_title')}
            className="w-full rounded-md border border-border-light bg-surface-primary px-3 py-1.5 text-sm outline-none focus:border-text-primary"
          />
          <textarea
            value={newSnippet.content}
            onChange={(e) => setNewSnippet({ ...newSnippet, content: e.target.value })}
            placeholder={localize('com_ui_content')}
            rows={3}
            className="w-full rounded-md border border-border-light bg-surface-primary px-3 py-1.5 text-sm outline-none focus:border-text-primary"
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setIsAdding(false)}
              className="rounded-md px-3 py-1 text-xs text-text-secondary hover:bg-surface-hover transition-colors"
            >
              {localize('com_ui_cancel')}
            </button>
            <button
              onClick={handleAdd}
              className="flex items-center gap-1 rounded-md bg-text-primary px-3 py-1 text-xs text-surface-primary hover:bg-opacity-90 transition-colors"
            >
              <Save className="h-3.5 w-3.5" />
              {localize('com_ui_save')}
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {snippets.map((snippet, idx) => (
          <div
            key={idx}
            className="group flex items-center justify-between rounded-lg border border-border-light bg-surface-secondary p-3 transition-colors hover:bg-surface-hover"
          >
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-text-primary truncate">{snippet.title}</div>
              <div className="text-xs text-text-secondary truncate">{snippet.content}</div>
            </div>
            <button
              onClick={() => handleDelete(idx)}
              className="ml-2 rounded p-1 text-text-secondary opacity-0 transition-opacity hover:bg-surface-tertiary hover:text-red-500 group-hover:opacity-100"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
        {snippets.length === 0 && !isAdding && (
          <div className="text-center py-6 text-sm text-text-secondary border-2 border-dashed border-border-light rounded-lg">
            {localize('com_ui_project_no_prompt_snippets')}
          </div>
        )}
      </div>
    </div>
  );
}
