import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save } from 'lucide-react';
import {
  useGetEndpointsQuery,
  useCreateProjectMutation,
  useUpdateProjectMutation,
} from '~/data-provider';
import { useLocalize } from '~/hooks';
import type { TProject } from 'librechat-data-provider';

interface ProjectFormProps {
  project?: TProject;
  onSuccess?: () => void;
}

export default function ProjectForm({ project, onSuccess }: ProjectFormProps) {
  const localize = useLocalize();
  const navigate = useNavigate();
  const isEditing = !!project;

  const [name, setName] = useState(project?.name ?? '');
  const [description, setDescription] = useState(project?.description ?? '');
  const [instructions, setInstructions] = useState(project?.instructions ?? '');
  const [endpoint, setEndpoint] = useState(project?.endpoint ?? '');
  const [model, setModel] = useState(project?.model ?? '');
  const [error, setError] = useState('');

  const { data: endpointsConfig } = useGetEndpointsQuery();
  const createMutation = useCreateProjectMutation();
  const updateMutation = useUpdateProjectMutation();

  const availableEndpoints = useMemo(() => {
    if (!endpointsConfig) {
      return [];
    }
    return Object.entries(endpointsConfig)
      .filter(([key, config]) => config && key !== 'agents')
      .map(([key]) => key);
  }, [endpointsConfig]);

  const isLoading = createMutation.isLoading || updateMutation.isLoading;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError(localize('com_ui_project_name_required'));
      return;
    }

    const payload = {
      name: name.trim(),
      description: description.trim() || undefined,
      instructions: instructions.trim() || undefined,
      endpoint: endpoint || undefined,
      model: model.trim() || undefined,
    };

    try {
      if (isEditing && project) {
        await updateMutation.mutateAsync({ projectId: project.projectId, payload });
        onSuccess?.();
      } else {
        const created = await createMutation.mutateAsync(payload);
        navigate(`/projects/${created.projectId}`);
      }
    } catch (err) {
      setError(localize('com_ui_project_save_error'));
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="mb-4 flex items-center gap-2 text-sm text-text-secondary transition-colors hover:text-text-primary"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        {localize('com_ui_back')}
      </button>

      <h1 className="mb-6 text-2xl font-semibold text-text-primary">
        {isEditing ? localize('com_ui_edit_project') : localize('com_ui_new_project')}
      </h1>

      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
            {error}
          </div>
        )}

        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-text-secondary">
            {localize('com_ui_project_name')} *
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={localize('com_ui_project_name_placeholder')}
            className="mt-1 w-full rounded-lg border border-border-light bg-surface-secondary px-3 py-2 text-sm text-text-primary outline-none transition-colors focus:border-text-primary"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-text-secondary">
            {localize('com_ui_project_description')}
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={localize('com_ui_project_description_placeholder')}
            rows={3}
            className="mt-1 w-full resize-none rounded-lg border border-border-light bg-surface-secondary px-3 py-2 text-sm text-text-primary outline-none transition-colors focus:border-text-primary"
          />
        </div>

        {/* Instructions */}
        <div>
          <label className="block text-sm font-medium text-text-secondary">
            {localize('com_ui_project_instructions')}
          </label>
          <textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder={localize('com_ui_project_instructions_placeholder')}
            rows={5}
            className="mt-1 w-full resize-none rounded-lg border border-border-light bg-surface-secondary px-3 py-2 text-sm text-text-primary outline-none transition-colors focus:border-text-primary"
          />
          <p className="mt-1 text-xs text-text-tertiary">
            {localize('com_ui_project_instructions_hint')}
          </p>
        </div>

        {/* Endpoint */}
        <div>
          <label className="block text-sm font-medium text-text-secondary">
            {localize('com_ui_project_endpoint')}
          </label>
          <select
            value={endpoint}
            onChange={(e) => setEndpoint(e.target.value)}
            className="mt-1 w-full rounded-lg border border-border-light bg-surface-secondary px-3 py-2 text-sm text-text-primary outline-none transition-colors focus:border-text-primary"
          >
            <option value="">{localize('com_ui_project_endpoint_placeholder')}</option>
            {availableEndpoints.map((ep) => (
              <option key={ep} value={ep}>
                {ep}
              </option>
            ))}
          </select>
        </div>

        {/* Model */}
        <div>
          <label className="block text-sm font-medium text-text-secondary">
            {localize('com_ui_project_model')}
          </label>
          <input
            type="text"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder={localize('com_ui_project_model_placeholder')}
            className="mt-1 w-full rounded-lg border border-border-light bg-surface-secondary px-3 py-2 text-sm text-text-primary outline-none transition-colors focus:border-text-primary"
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="rounded-lg px-4 py-2 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
          >
            {localize('com_ui_cancel')}
          </button>
          <button
            type="submit"
            disabled={isLoading}
            className="flex items-center gap-2 rounded-lg bg-text-primary px-4 py-2 text-sm font-medium text-surface-primary transition-colors hover:opacity-90 disabled:opacity-50"
          >
            {isLoading ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-surface-primary border-t-transparent" />
            ) : (
              <Save className="h-4 w-4" aria-hidden="true" />
            )}
            {isEditing ? localize('com_ui_save') : localize('com_ui_create')}
          </button>
        </div>
      </form>
    </div>
  );
}
