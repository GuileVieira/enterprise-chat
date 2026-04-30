import React, { useState } from 'react';
import { X, Loader2, Wrench } from 'lucide-react';
import {
  useCreateAdminFunctionMutation,
  useListAdminSecrets,
} from '~/data-provider/admin';

interface CreateFunctionModalProps {
  isOpen: boolean;
  onClose: () => void;
  tenantId: string;
}

const METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
const AUTH_TYPES = ['none', 'bearer', 'basic', 'api_key', 'custom'];

const CreateFunctionModal: React.FC<CreateFunctionModalProps> = ({
  isOpen,
  onClose,
  tenantId,
}) => {
  const [id, setId] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [details, setDetails] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [method, setMethod] = useState('GET');
  const [path, setPath] = useState('');
  const [authType, setAuthType] = useState('none');
  const [secretName, setSecretName] = useState('');
  const [headerName, setHeaderName] = useState('');
  const [inputSchema, setInputSchema] = useState('{}');
  const [postProcess, setPostProcess] = useState('');

  const createFn = useCreateAdminFunctionMutation();
  const { data: secretsData } = useListAdminSecrets(tenantId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id.trim() || !name.trim() || !baseUrl.trim() || !path.trim()) return;

    let parsedSchema: Record<string, unknown> = {};
    try {
      parsedSchema = JSON.parse(inputSchema);
    } catch {
      alert('Invalid JSON in Input Schema');
      return;
    }

    const payload: any = {
      id: id.trim(),
      tenantId,
      name: name.trim(),
      description: description.trim(),
      ...(details.trim() ? { details: details.trim() } : {}),
      config: {
        baseUrl: baseUrl.trim(),
        method,
        path: path.trim(),
      },
      inputSchema: parsedSchema,
      isActive: true,
    };

    if (authType !== 'none') {
      payload.config.auth = {
        type: authType,
        ...(secretName.trim() ? { secretName: secretName.trim() } : {}),
        ...(headerName.trim() ? { headerName: headerName.trim() } : {}),
      };
    }

    if (postProcess.trim()) {
      payload.postProcess = postProcess.trim();
    }

    try {
      await createFn.mutateAsync(payload);
      resetForm();
      onClose();
    } catch {
      // error handled by mutation
    }
  };

  const resetForm = () => {
    setId('');
    setName('');
    setDescription('');
    setDetails('');
    setBaseUrl('');
    setMethod('GET');
    setPath('');
    setAuthType('none');
    setSecretName('');
    setHeaderName('');
    setInputSchema('{}');
    setPostProcess('');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 py-6">
      <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-border-medium bg-surface-dialog shadow-2xl shadow-black/25">
        <div className="border-b border-border-light bg-surface-secondary px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex size-10 items-center justify-center rounded-xl bg-surface-tertiary text-text-primary">
                <Wrench className="size-5" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-text-primary">Create Function</h2>
                <p className="mt-1 max-w-[54ch] text-sm leading-6 text-text-secondary">
                  Define a tenant-scoped tool that agents can call at runtime.
                </p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="text-text-secondary transition-colors hover:text-text-primary"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="max-h-[75vh] space-y-5 overflow-y-auto px-6 py-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-text-secondary">ID *</label>
              <input
                type="text"
                value={id}
                onChange={(e) => setId(e.target.value)}
                placeholder="meta-ads-report"
                className="mt-1 w-full rounded-lg border border-border-light bg-surface-primary px-3 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary focus:border-border-xheavy focus:outline-none"
                required
              />
              <p className="mt-1 text-xs text-text-tertiary">Unique slug per tenant</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary">Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Meta Ads Report"
                className="mt-1 w-full rounded-lg border border-border-light bg-surface-primary px-3 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary focus:border-border-xheavy focus:outline-none"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary">Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does this tool do? Be specific so the LLM knows when to use it."
              className="mt-1 w-full rounded-lg border border-border-light bg-surface-primary px-3 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary focus:border-border-xheavy focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary">Details</label>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows={4}
              placeholder="Describe what the tool sends and receives, dynamic body behavior, edge cases, etc. This text is appended to the description shown to the LLM."
              className="mt-1 w-full rounded-lg border border-border-light bg-surface-primary px-3 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary focus:border-border-xheavy focus:outline-none"
            />
            <p className="mt-1 text-xs text-text-tertiary">Shown to the LLM alongside the description</p>
          </div>

          <div className="rounded-xl border border-border-light bg-surface-secondary p-4">
            <h3 className="text-sm font-semibold text-text-primary">HTTP Config</h3>
            <div className="mt-3 grid gap-4 sm:grid-cols-4">
              <div className="sm:col-span-1">
                <label className="block text-sm font-medium text-text-secondary">Method</label>
                <select
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border-light bg-surface-primary px-3 py-2.5 text-sm text-text-primary focus:border-border-xheavy focus:outline-none"
                >
                  {METHODS.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-3">
                <label className="block text-sm font-medium text-text-secondary">Base URL *</label>
                <input
                  type="text"
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  placeholder="https://graph.facebook.com/v18.0"
                  className="mt-1 w-full rounded-lg border border-border-light bg-surface-primary px-3 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary focus:border-border-xheavy focus:outline-none"
                  required
                />
              </div>
            </div>
            <div className="mt-3">
              <label className="block text-sm font-medium text-text-secondary">Path *</label>
              <input
                type="text"
                value={path}
                onChange={(e) => setPath(e.target.value)}
                placeholder="/act_{adAccountId}/campaigns"
                className="mt-1 w-full rounded-lg border border-border-light bg-surface-primary px-3 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary focus:border-border-xheavy focus:outline-none"
                required
              />
              <p className="mt-1 text-xs text-text-tertiary">Use {'{paramName}'} for path parameters</p>
            </div>
          </div>

          <div className="rounded-xl border border-border-light bg-surface-secondary p-4">
            <h3 className="text-sm font-semibold text-text-primary">Authentication</h3>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-text-secondary">Auth Type</label>
                <select
                  value={authType}
                  onChange={(e) => setAuthType(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border-light bg-surface-primary px-3 py-2.5 text-sm text-text-primary focus:border-border-xheavy focus:outline-none"
                >
                  {AUTH_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              {authType !== 'none' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-text-secondary">Secret</label>
                    <select
                      value={secretName}
                      onChange={(e) => setSecretName(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-border-light bg-surface-primary px-3 py-2.5 text-sm text-text-primary focus:border-border-xheavy focus:outline-none"
                    >
                      <option value="">Select a secret…</option>
                      {secretsData?.secrets.map((s) => (
                        <option key={s.name} value={s.name}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-secondary">Header Name</label>
                    <input
                      type="text"
                      value={headerName}
                      onChange={(e) => setHeaderName(e.target.value)}
                      placeholder={authType === 'bearer' || authType === 'basic' ? 'Authorization' : 'X-Api-Key'}
                      className="mt-1 w-full rounded-lg border border-border-light bg-surface-primary px-3 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary focus:border-border-xheavy focus:outline-none"
                    />
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-text-secondary">Input Schema (JSON)</label>
              <textarea
                value={inputSchema}
                onChange={(e) => setInputSchema(e.target.value)}
                rows={4}
                className="mt-1 w-full rounded-lg border border-border-light bg-surface-primary px-3 py-2.5 text-sm text-text-primary font-mono focus:border-border-xheavy focus:outline-none"
              />
              <p className="mt-1 text-xs text-text-tertiary">JSON schema for LLM parameters</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary">Post Process (JS)</label>
              <textarea
                value={postProcess}
                onChange={(e) => setPostProcess(e.target.value)}
                placeholder="(data) => data.campaigns"
                rows={4}
                className="mt-1 w-full rounded-lg border border-border-light bg-surface-primary px-3 py-2.5 text-sm text-text-primary font-mono focus:border-border-xheavy focus:outline-none"
              />
              <p className="mt-1 text-xs text-text-tertiary">Optional JS function body</p>
            </div>
          </div>

          <div className="flex flex-col-reverse gap-2 border-t border-border-light pt-5 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={handleClose}
              className="rounded-lg border border-border-medium px-4 py-2 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-tertiary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createFn.isLoading}
              className="flex items-center gap-2 rounded-lg bg-surface-tertiary px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-surface-active-alt disabled:opacity-50"
            >
              {createFn.isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              Create Function
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateFunctionModal;
