/* eslint-disable no-nested-ternary */
import { useId, useState } from 'react';
import { DownloadSimple, UploadSimple } from '@phosphor-icons/react';
import { Button, Input, OGDialog, OGDialogTemplate, useToastContext } from '@librechat/client';
import type {
  SharedMemoryImportPreview,
  SharedMemoryImportRequest,
  SharedMemoryImportResult,
} from '~/data-provider/SharedMemories/types';
import {
  useSharedMemoryExportMutation,
  useSharedMemoryImportMutation,
  useSharedMemoryImportPreviewMutation,
} from '~/data-provider';
import { useLocalize } from '~/hooks';

type Destination = SharedMemoryImportRequest['destination'];
type ExportSelection = 'selected' | 'filtered' | 'accessible';
const importStatusKeys = {
  new: 'com_ui_memory_import_new',
  identical: 'com_ui_memory_import_identical',
  conflict: 'com_ui_memory_import_conflict',
  invalid: 'com_ui_memory_import_invalid',
  created: 'com_ui_memory_import_created',
  updated: 'com_ui_memory_import_updated',
  skipped: 'com_ui_memory_import_skipped',
  failed: 'com_ui_memory_import_failed',
} as const;

function downloadMemoryFile(content: string, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
export default function SharedMemoryPortability({
  projectId,
  agentId,
  scope = projectId ? 'project' : 'personal',
  ids,
  search,
  canCreateLibrary = false,
  canEditProject = Boolean(projectId),
  filteredCount,
  accessibleCount,
}: {
  projectId?: string;
  agentId?: string;
  scope?: 'library' | 'project' | 'personal';
  ids?: string[];
  search?: string;
  canCreateLibrary?: boolean;
  canEditProject?: boolean;
  filteredCount?: number;
  accessibleCount?: number;
}) {
  const localize = useLocalize();
  const { showToast } = useToastContext();
  const destinationGroupId = useId();
  const destinations = [
    ...(projectId && canEditProject
      ? [
          {
            destination: { type: 'project' as const, projectId },
            label: 'com_ui_memory_destination_project' as const,
            description: 'com_ui_memory_destination_project_description' as const,
          },
        ]
      : []),
    ...(canCreateLibrary
      ? [
          {
            destination: { type: 'library' as const },
            label: 'com_ui_shared_memory_library' as const,
            description: 'com_ui_memory_destination_library_description' as const,
          },
        ]
      : []),
    {
      destination: { type: 'personal' as const, ...(agentId ? { agentId } : {}) },
      label: agentId
        ? ('com_ui_memory_destination_agent' as const)
        : ('com_ui_memory_destination_personal' as const),
      description: agentId
        ? ('com_ui_memory_destination_agent_description' as const)
        : ('com_ui_memory_destination_personal_description' as const),
    },
  ];
  const defaultDestination: Destination =
    projectId && canEditProject
      ? { type: 'project', projectId }
      : scope === 'library' && canCreateLibrary
        ? { type: 'library' }
        : { type: 'personal', ...(agentId ? { agentId } : {}) };
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState('');
  const [format, setFormat] = useState<'json' | 'csv'>('json');
  const [preview, setPreview] = useState<SharedMemoryImportPreview | null>(null);
  const [destination, setDestination] = useState<Destination>(defaultDestination);
  const [decisions, setDecisions] = useState<NonNullable<SharedMemoryImportRequest['decisions']>>(
    {},
  );
  const [result, setResult] = useState<SharedMemoryImportResult | null>(null);
  const [operationId, setOperationId] = useState(() => crypto.randomUUID());
  const [exportSelection, setExportSelection] = useState<ExportSelection>(
    ids?.length ? 'selected' : search?.trim() ? 'filtered' : 'accessible',
  );
  const previewMutation = useSharedMemoryImportPreviewMutation();
  const importMutation = useSharedMemoryImportMutation();
  const exportMutation = useSharedMemoryExportMutation();
  const reset = () => {
    setPreview(null);
    setResult(null);
    setDecisions({});
    setOperationId(crypto.randomUUID());
  };
  const request = (): SharedMemoryImportRequest => ({
    operationId,
    destination,
    format,
    content,
    decisions,
    selectedRefs: preview?.items
      .filter((item) => item.status !== 'invalid')
      .map((item) => item.ref),
  });
  const exportFile = (nextFormat: 'json' | 'csv') =>
    exportMutation.mutate(
      {
        format: nextFormat,
        scope,
        ...(scope === 'project' && projectId ? { projectId } : {}),
        ...(scope === 'personal' && agentId ? { agentId } : {}),
        ...(exportSelection === 'selected' && ids?.length ? { ids } : {}),
        ...(exportSelection === 'filtered' && search?.trim() ? { search: search.trim() } : {}),
      },
      {
        onSuccess: (result) => {
          const body = typeof result === 'string' ? result : JSON.stringify(result, null, 2);
          downloadMemoryFile(
            body,
            `orqest-memories.${nextFormat}`,
            nextFormat === 'json' ? 'application/json' : 'text/csv;charset=utf-8',
          );
        },
        onError: () => showToast({ message: localize('com_ui_error'), status: 'error' }),
      },
    );
  return (
    <div className="flex w-full min-w-0 flex-wrap gap-2">
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => {
          reset();
          setDestination(defaultDestination);
          setOpen(true);
        }}
        disabled={exportMutation.isLoading}
      >
        <UploadSimple className="mr-1 size-4" />
        {localize('com_ui_import_memories')}
      </Button>
      {(ids?.length || search?.trim() || accessibleCount != null) && (
        <select
          className="rounded border border-border-light bg-surface-primary px-2 text-sm"
          aria-label={localize('com_ui_memory_export_scope')}
          value={exportSelection}
          onChange={(event) => setExportSelection(event.target.value as ExportSelection)}
        >
          {ids?.length ? (
            <option value="selected">
              {localize('com_ui_memory_export_selected', { count: ids.length })}
            </option>
          ) : null}
          <option value="filtered">
            {localize('com_ui_memory_export_filtered', { count: filteredCount ?? 0 })}
          </option>
          <option value="accessible">
            {localize('com_ui_memory_export_accessible', { count: accessibleCount ?? 0 })}
          </option>
        </select>
      )}
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => exportFile('json')}
        disabled={exportMutation.isLoading}
      >
        <DownloadSimple className="mr-1 size-4" />
        JSON
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => exportFile('csv')}
        disabled={exportMutation.isLoading}
      >
        CSV
      </Button>
      <OGDialog open={open} onOpenChange={setOpen}>
        <OGDialogTemplate
          title={localize('com_ui_import_memories')}
          className="flex max-h-[85dvh] max-w-xl flex-col overflow-hidden"
          headerClassName="shrink-0"
          mainClassName="min-h-0 overflow-y-auto"
          footerClassName="shrink-0"
          main={
            <div className="space-y-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  downloadMemoryFile(
                    'key,value\n',
                    'orqest-memories-template.csv',
                    'text/csv;charset=utf-8',
                  )
                }
              >
                {localize('com_ui_memory_csv_template')}
              </Button>
              <Input
                type="file"
                accept=".json,.csv"
                aria-label={localize('com_ui_import_memories')}
                disabled={previewMutation.isLoading || importMutation.isLoading}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  setFormat(file.name.toLowerCase().endsWith('.csv') ? 'csv' : 'json');
                  reset();
                  setContent('');
                  file
                    .text()
                    .then(setContent)
                    .catch(() => showToast({ message: localize('com_ui_error'), status: 'error' }));
                }}
              />
              <fieldset className="space-y-2">
                <legend className="mb-2 text-sm font-medium">
                  {localize('com_ui_memory_import_destination')}
                </legend>
                {destinations.map((option) => (
                  <label
                    key={option.destination.type}
                    className="flex cursor-pointer items-start gap-3 rounded border border-border-light bg-surface-primary p-3"
                  >
                    <input
                      type="radio"
                      name={destinationGroupId}
                      className="mt-1 shrink-0"
                      value={option.destination.type}
                      checked={destination.type === option.destination.type}
                      disabled={previewMutation.isLoading || importMutation.isLoading}
                      aria-label={localize(option.label)}
                      aria-describedby={`${destinationGroupId}-${option.destination.type}`}
                      onChange={() => {
                        reset();
                        setDestination(option.destination);
                      }}
                    />
                    <span className="min-w-0 text-sm">
                      <span className="block font-medium">{localize(option.label)}</span>
                      <span
                        id={`${destinationGroupId}-${option.destination.type}`}
                        className="mt-1 block text-text-secondary"
                      >
                        {localize(option.description)}
                      </span>
                    </span>
                  </label>
                ))}
              </fieldset>
              {preview?.items.map((item) => (
                <div key={item.ref} className="rounded border border-border-light p-2 text-sm">
                  <b>{item.key}</b> — {localize(importStatusKeys[item.status])}
                  <p className="mt-1 whitespace-pre-wrap text-text-secondary">{item.value}</p>
                  {item.existing && (
                    <p className="mt-1 whitespace-pre-wrap text-text-secondary">
                      {item.existing.value}
                    </p>
                  )}
                  {item.error && `: ${item.error}`}
                  {item.status === 'conflict' && (
                    <>
                      <select
                        value={decisions[item.ref]?.action ?? 'skip'}
                        aria-label={item.key}
                        onChange={(event) =>
                          setDecisions({
                            ...decisions,
                            [item.ref]: {
                              action: event.target.value as 'skip' | 'replace' | 'copy',
                              expectedVersion: item.existing?.version,
                              expectedUpdatedAt: item.existing?.updatedAt,
                              copyKey: decisions[item.ref]?.copyKey,
                            },
                          })
                        }
                      >
                        <option value="skip">{localize('com_ui_skip')}</option>
                        <option value="replace">{localize('com_ui_replace')}</option>
                        <option value="copy">{localize('com_ui_create_independent_copy')}</option>
                      </select>
                      {decisions[item.ref]?.action === 'copy' && (
                        <Input
                          value={decisions[item.ref]?.copyKey ?? ''}
                          placeholder={localize('com_ui_project_memory_key_placeholder')}
                          aria-label={localize('com_ui_project_memory_key')}
                          onChange={(event) =>
                            setDecisions({
                              ...decisions,
                              [item.ref]: {
                                ...decisions[item.ref],
                                action: 'copy',
                                copyKey: event.target.value,
                              },
                            })
                          }
                        />
                      )}
                    </>
                  )}
                </div>
              ))}
              {result && (
                <div className="rounded border border-border-light p-2 text-sm">
                  <p role="status">{localize('com_ui_memory_import_totals', result.totals)}</p>
                  {result.items.map((item) => (
                    <p
                      key={item.ref}
                    >{`${item.ref}: ${localize(importStatusKeys[item.status])}${item.error ? ` — ${item.error}` : ''}`}</p>
                  ))}
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      downloadMemoryFile(
                        JSON.stringify(result, null, 2),
                        `orqest-memory-import-${result.operationId}.json`,
                        'application/json',
                      );
                    }}
                  >
                    {localize('com_ui_download')}
                  </Button>
                </div>
              )}
              {(previewMutation.isLoading || importMutation.isLoading) && (
                <p role="status" className="text-sm text-text-secondary">
                  {localize('com_ui_memory_import_progress', {
                    count: preview?.items.length ?? 0,
                  })}
                </p>
              )}
            </div>
          }
          selection={
            <Button
              type="button"
              disabled={!content || previewMutation.isLoading || importMutation.isLoading}
              onClick={() => {
                if (result?.totals.failed) {
                  importMutation.mutate(
                    {
                      ...request(),
                      selectedRefs: result.items
                        .filter((item) => item.status === 'failed')
                        .map((item) => item.ref),
                    },
                    {
                      onSuccess: (data) => setResult(data as SharedMemoryImportResult),
                      onError: () =>
                        showToast({ message: localize('com_ui_error'), status: 'error' }),
                    },
                  );
                  return;
                }
                if (!preview)
                  previewMutation.mutate(request(), {
                    onSuccess: (data) => {
                      const next = data as SharedMemoryImportPreview;
                      setPreview(next);
                      setDecisions(
                        Object.fromEntries(
                          next.items
                            .filter((item) => item.status === 'conflict')
                            .map((item) => [
                              item.ref,
                              {
                                action: 'skip' as const,
                                expectedVersion: item.existing?.version,
                                expectedUpdatedAt: item.existing?.updatedAt,
                              },
                            ]),
                        ),
                      );
                    },
                    onError: () =>
                      showToast({ message: localize('com_ui_error'), status: 'error' }),
                  });
                else
                  importMutation.mutate(request(), {
                    onSuccess: (data) => {
                      setResult(data as SharedMemoryImportResult);
                      const imported = data as SharedMemoryImportResult;
                      showToast({
                        message: localize('com_ui_memory_import_totals', imported.totals),
                        status: imported.totals.failed ? 'warning' : 'success',
                      });
                    },
                    onError: () =>
                      showToast({ message: localize('com_ui_error'), status: 'error' }),
                  });
              }}
            >
              {result?.totals.failed
                ? localize('com_ui_retry')
                : preview
                  ? localize('com_ui_import')
                  : localize('com_ui_preview')}
            </Button>
          }
        />
      </OGDialog>
    </div>
  );
}
