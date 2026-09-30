/* eslint-disable no-nested-ternary */
import { useState } from 'react';
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
export default function SharedMemoryPortability({
  projectId,
  scope = projectId ? 'project' : 'personal',
  ids,
  search,
  canCreateLibrary = false,
  canEditProject = Boolean(projectId),
  filteredCount,
  accessibleCount,
}: {
  projectId?: string;
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
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState('');
  const [format, setFormat] = useState<'json' | 'csv'>('json');
  const [preview, setPreview] = useState<SharedMemoryImportPreview | null>(null);
  const [destination, setDestination] = useState<Destination>(
    scope === 'library' && canCreateLibrary
      ? { type: 'library' }
      : scope === 'project' && projectId && canEditProject
        ? { type: 'project', projectId }
        : { type: 'personal' },
  );
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
        ...(exportSelection === 'selected' && ids?.length ? { ids } : {}),
        ...(search?.trim() ? { search: search.trim() } : {}),
      },
      {
        onSuccess: (result) => {
          const body = typeof result === 'string' ? result : JSON.stringify(result, null, 2);
          const url = URL.createObjectURL(
            new Blob([body], {
              type: nextFormat === 'json' ? 'application/json' : 'text/csv;charset=utf-8',
            }),
          );
          const anchor = document.createElement('a');
          anchor.href = url;
          anchor.download = `orqest-memories.${nextFormat}`;
          anchor.click();
          URL.revokeObjectURL(url);
        },
        onError: () => showToast({ message: localize('com_ui_error'), status: 'error' }),
      },
    );
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => {
          reset();
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
          main={
            <div className="space-y-3">
              <Input
                type="file"
                accept=".json,.csv"
                aria-label={localize('com_ui_import_memories')}
                disabled={previewMutation.isLoading || importMutation.isLoading}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  setFormat(file.name.endsWith('.csv') ? 'csv' : 'json');
                  file.text().then((text) => {
                    reset();
                    setFormat(file.name.endsWith('.csv') ? 'csv' : 'json');
                    setContent(text);
                  });
                }}
              />
              <select
                className="w-full rounded border border-border-light bg-surface-primary p-2"
                value={destination.type}
                aria-label={localize('com_ui_import_memories')}
                onChange={(event) => {
                  reset();
                  setDestination(
                    event.target.value === 'project' && projectId
                      ? { type: 'project', projectId }
                      : event.target.value === 'personal'
                        ? { type: 'personal' }
                        : { type: 'library' },
                  );
                }}
              >
                {canCreateLibrary && (
                  <option value="library">{localize('com_ui_shared_memory_library')}</option>
                )}
                {projectId && canEditProject && (
                  <option value="project">{localize('com_ui_project_shared_memories')}</option>
                )}
                <option value="personal">{localize('com_ui_memories_personal')}</option>
              </select>
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
                      const url = URL.createObjectURL(
                        new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' }),
                      );
                      const anchor = document.createElement('a');
                      anchor.href = url;
                      anchor.download = `orqest-memory-import-${result.operationId}.json`;
                      anchor.click();
                      URL.revokeObjectURL(url);
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
          selection={{
            selectText: result?.totals.failed
              ? localize('com_ui_retry')
              : preview
                ? localize('com_ui_import')
                : localize('com_ui_preview'),
            selectHandler: () => {
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
                  onError: () => showToast({ message: localize('com_ui_error'), status: 'error' }),
                });
              else
                importMutation.mutate(request(), {
                  onSuccess: (data) => {
                    setResult(data as SharedMemoryImportResult);
                    showToast({ message: localize('com_ui_saved'), status: 'success' });
                  },
                  onError: () => showToast({ message: localize('com_ui_error'), status: 'error' }),
                });
            },
          }}
        />
      </OGDialog>
    </div>
  );
}
