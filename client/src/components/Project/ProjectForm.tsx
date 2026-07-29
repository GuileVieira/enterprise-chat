import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, FloppyDisk, Folder } from '@phosphor-icons/react';
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
  const inputClassName =
    'mt-1.5 w-full rounded-xl border border-border-light bg-surface-primary px-3 py-2.5 text-sm text-text-primary outline-none transition-colors placeholder:text-text-tertiary hover:border-border-medium focus:border-text-primary focus:ring-2 focus:ring-ring-primary/20';
  const labelClassName = 'block text-sm font-medium text-text-secondary';

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
    <div className="mx-auto w-full max-w-3xl px-5 py-8">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="mb-5 flex h-9 items-center gap-2 rounded-lg px-2 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-primary active:scale-[0.99]"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        {localize('com_ui_back')}
      </button>

      <div className="mb-6 rounded-2xl border border-border-light bg-surface-secondary p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border-light bg-surface-primary text-text-secondary">
            <Folder className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold leading-tight text-text-primary">
              {isEditing ? localize('com_ui_edit_project') : localize('com_ui_new_project')}
            </h1>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-text-secondary">
              {localize('com_ui_project_instructions_hint')}
            </p>
          </div>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="rounded-2xl border border-border-light bg-surface-secondary p-5"
      >
        {error && (
          <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
            {error}
          </div>
        )}

        <div className="grid gap-5">
          <div>
            <label className={labelClassName}>{localize('com_ui_project_name')} *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={localize('com_ui_project_name_placeholder')}
              className={inputClassName}
            />
          </div>

          <div>
            <label className={labelClassName}>{localize('com_ui_project_description')}</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={localize('com_ui_project_description_placeholder')}
              rows={3}
              className={`${inputClassName} resize-none leading-6`}
            />
          </div>

          <div>
            <label className={labelClassName}>{localize('com_ui_project_instructions')}</label>
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder={localize('com_ui_project_instructions_placeholder')}
              rows={5}
              className={`${inputClassName} resize-none font-mono leading-6`}
            />
            <p className="mt-1 text-xs text-text-tertiary">
              {localize('com_ui_project_instructions_hint')}
            </p>
          </div>

          {isEditing && (
            <>
              <div>
                <label className={labelClassName}>{localize('com_ui_project_endpoint')}</label>
                <select
                  value={endpoint}
                  onChange={(e) => setEndpoint(e.target.value)}
                  className={inputClassName}
                >
                  <option value="">{localize('com_ui_project_endpoint_placeholder')}</option>
                  {availableEndpoints.map((ep) => (
                    <option key={ep} value={ep}>
                      {ep}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelClassName}>{localize('com_ui_project_model')}</label>
                <input
                  type="text"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder={localize('com_ui_project_model_placeholder')}
                  className={inputClassName}
                />
              </div>
            </>
          )}
        </div>

        <div className="mt-6 flex items-center justify-end gap-3 border-t border-border-light pt-5">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="rounded-xl px-4 py-2 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-primary active:scale-[0.99]"
          >
            {localize('com_ui_cancel')}
          </button>
          <button
            type="submit"
            disabled={isLoading}
            className="flex items-center gap-2 rounded-xl bg-text-primary px-4 py-2 text-sm font-medium text-surface-primary transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-primary active:scale-[0.99] disabled:opacity-50"
          >
            {isLoading ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-surface-primary border-t-transparent" />
            ) : (
              <FloppyDisk className="h-4 w-4" aria-hidden="true" />
            )}
            {isEditing ? localize('com_ui_save') : localize('com_ui_create')}
          </button>
        </div>
      </form>
    </div>
  );
}
