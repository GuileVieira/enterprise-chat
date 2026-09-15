import { useRef, useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FolderOpen, Upload } from 'lucide-react';
import { OGDialog, OGDialogContent, Spinner, useToastContext } from '@librechat/client';
import {
  megabyte,
  mergeFileConfig,
  fileConfig as defaultFileConfig,
} from 'librechat-data-provider';
import type { TSkill } from 'librechat-data-provider';
import type { TranslationKeys } from '~/hooks';
import { useGetFileConfig, useImportSkillMutation } from '~/data-provider';
import { collectSkillDirectories, createSkillImportFile } from '../utils';
import { splitSkillArchive } from '../utils/skillArchive';
import { useLocalize } from '~/hooks';
import { cn } from '~/utils';

interface UploadSkillDialogProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

interface BatchResult {
  id: string;
  name: string;
  path: string;
  status: 'pending' | 'success' | 'warning' | 'error';
  error?: string;
}

const batchStatusKeys: Record<BatchResult['status'], TranslationKeys> = {
  pending: 'com_ui_skill_import_pending',
  success: 'com_ui_skill_import_success',
  warning: 'com_ui_skill_import_warning',
  error: 'com_ui_skill_import_error',
};

interface SkillImportSummary {
  filesFailed: number;
  errors: Array<{ path: string; error?: string }>;
}

interface BatchFile {
  id: string;
  name: string;
  path: string;
  getFiles: () => Promise<File[]>;
}

function getImportSummary(skill: TSkill): SkillImportSummary | undefined {
  return (skill as TSkill & { _importSummary?: SkillImportSummary })._importSummary;
}

function formatMegabytes(bytes: number): string {
  const value = bytes / megabyte;
  return Number.isInteger(value) ? `${value}` : value.toFixed(1);
}

export default function UploadSkillDialog({ isOpen, setIsOpen }: UploadSkillDialogProps) {
  const localize = useLocalize();
  const navigate = useNavigate();
  const { showToast } = useToastContext();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const directoryInputRef = useRef<HTMLInputElement | null>(null);
  const importLockRef = useRef(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isBatchImporting, setIsBatchImporting] = useState(false);
  const [batchResults, setBatchResults] = useState<BatchResult[]>([]);
  const {
    data: skillFileConfig = { configuredSizeLimitMb: undefined, fileConfig: defaultFileConfig },
  } = useGetFileConfig({
    select: (data) => ({
      configuredSizeLimitMb: data?.skills?.fileSizeLimit,
      fileConfig: mergeFileConfig(data),
    }),
  });
  const { configuredSizeLimitMb, fileConfig } = skillFileConfig;
  const skillImportSizeLimit =
    fileConfig.skills?.fileSizeLimit ?? defaultFileConfig.skills?.fileSizeLimit ?? 0;
  const displayedSizeLimit =
    configuredSizeLimitMb !== undefined
      ? `${configuredSizeLimitMb}`
      : formatMegabytes(skillImportSizeLimit);

  const importMutation = useImportSkillMutation();
  const isImporting = importMutation.isLoading || isBatchImporting;

  const getErrorMessage = useCallback(
    (error: unknown) => {
      if (error instanceof Error && !('response' in error)) {
        return error.message === 'com_ui_create_skill_upload_error'
          ? localize('com_ui_create_skill_upload_error')
          : error.message;
      }
      const data = (error as { response?: { data?: { error?: string; message?: string } } })
        ?.response?.data;
      return data?.message ?? data?.error ?? localize('com_ui_create_skill_upload_error');
    },
    [localize],
  );

  const assertFileSize = useCallback(
    (file: File) => {
      if (file.size > skillImportSizeLimit) {
        throw new Error(localize('com_ui_skill_upload_size_error', { 0: displayedSizeLimit }));
      }
    },
    [displayedSizeLimit, localize, skillImportSizeLimit],
  );

  const importFile = useCallback(
    async (file: File) => {
      assertFileSize(file);
      const formData = new FormData();
      formData.append('file', file, file.name);
      return importMutation.mutateAsync(formData);
    },
    [assertFileSize, importMutation],
  );

  const importBatch = useCallback(
    async (files: BatchFile[], navigateAfterSingle = false) => {
      if (isImporting || importLockRef.current) return;
      importLockRef.current = true;
      setIsBatchImporting(true);
      try {
        setBatchResults(files.map(({ id, name, path }) => ({ id, name, path, status: 'pending' })));
        let succeeded = 0;
        let total = files.length;

        for (const item of files) {
          try {
            const preparedFiles = await item.getFiles();
            const preparedItems = preparedFiles.map((file, index) => ({
              id: `${item.id}-${index}`,
              name: file.name,
              path: file.name,
              file,
            }));
            total += preparedItems.length - 1;
            if (preparedItems.length > 1) {
              setBatchResults((results) =>
                results.flatMap((result) =>
                  result.id === item.id
                    ? preparedItems.map(({ id, name, path }) => ({
                        id,
                        name,
                        path,
                        status: 'pending' as const,
                      }))
                    : [result],
                ),
              );
            }
            for (const prepared of preparedItems) {
              try {
                const skill = await importFile(prepared.file);
                const summary = getImportSummary(skill);
                succeeded++;
                if (navigateAfterSingle && files.length === 1 && preparedItems.length === 1) {
                  showToast({
                    status: summary?.filesFailed ? 'warning' : 'success',
                    message: summary?.filesFailed
                      ? localize('com_ui_skill_import_with_ignored', { 0: summary.filesFailed })
                      : localize('com_ui_skill_created'),
                  });
                  setIsOpen(false);
                  navigate(`/skills/${skill._id}`);
                  return;
                }
                setBatchResults((results) =>
                  results.map((result) =>
                    result.id === (preparedItems.length > 1 ? prepared.id : item.id)
                      ? {
                          ...result,
                          status: summary?.filesFailed ? 'warning' : 'success',
                          error: summary?.errors
                            .map(({ path, error }) => `${path}: ${error ?? 'ignored'}`)
                            .join('; '),
                        }
                      : result,
                  ),
                );
              } catch (error) {
                if (navigateAfterSingle && files.length === 1 && preparedItems.length === 1) {
                  showToast({ status: 'error', message: getErrorMessage(error) });
                  return;
                }
                setBatchResults((results) =>
                  results.map((result) =>
                    result.id === (preparedItems.length > 1 ? prepared.id : item.id)
                      ? { ...result, status: 'error', error: getErrorMessage(error) }
                      : result,
                  ),
                );
              }
            }
          } catch (error) {
            if (navigateAfterSingle && files.length === 1) {
              showToast({ status: 'error', message: getErrorMessage(error) });
              return;
            }
            setBatchResults((results) =>
              results.map((result) =>
                result.id === item.id
                  ? { ...result, status: 'error', error: getErrorMessage(error) }
                  : result,
              ),
            );
          }
        }

        showToast({
          status: succeeded === total ? 'success' : 'warning',
          message: localize('com_ui_skill_folder_result', { 0: succeeded, 1: total }),
        });
      } finally {
        importLockRef.current = false;
        setIsBatchImporting(false);
      }
    },
    [getErrorMessage, importFile, isImporting, localize, navigate, setIsOpen, showToast],
  );

  const handleDirectoryInput = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      if (isImporting) return;
      const directories = collectSkillDirectories(Array.from(event.target.files ?? []));
      event.target.value = '';
      if (directories.length === 0) {
        showToast({ status: 'error', message: localize('com_ui_skill_folder_empty') });
        return;
      }

      await importBatch(
        directories.map((directory, index) => ({
          id: `directory-${index}`,
          name: directory.name,
          path: directory.path,
          getFiles: async () => [await createSkillImportFile(directory)],
        })),
      );
    },
    [importBatch, isImporting, localize, showToast],
  );

  const handleFileInput = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files ?? []);
      event.target.value = '';
      if (files.length > 0) {
        await importBatch(
          files.map((file, index) => ({
            id: `file-${index}`,
            name: file.name,
            path: file.name,
            getFiles: async () => {
              assertFileSize(file);
              return splitSkillArchive(file, skillImportSizeLimit);
            },
          })),
          true,
        );
      }
    },
    [assertFileSize, importBatch, skillImportSizeLimit],
  );

  const handleDrop = useCallback(
    async (event: React.DragEvent) => {
      event.preventDefault();
      setIsDragging(false);
      const files = Array.from(event.dataTransfer.files ?? []);
      if (files.length > 0) {
        await importBatch(
          files.map((file, index) => ({
            id: `drop-${index}`,
            name: file.name,
            path: file.name,
            getFiles: async () => {
              assertFileSize(file);
              return splitSkillArchive(file, skillImportSizeLimit);
            },
          })),
          true,
        );
      }
    },
    [assertFileSize, importBatch, skillImportSizeLimit],
  );

  return (
    <OGDialog open={isOpen} onOpenChange={setIsOpen}>
      <OGDialogContent className="w-11/12 max-w-lg overflow-hidden">
        <div className="flex flex-col gap-6 p-1 sm:p-2">
          <h2 className="text-lg font-bold text-text-primary">
            {localize('com_ui_skill_upload_title')}
          </h2>

          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              disabled={isImporting}
              className={cn(
                'flex h-[120px] w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed text-sm text-text-secondary transition-colors',
                isDragging
                  ? 'border-border-heavy bg-surface-hover'
                  : 'border-border-medium hover:bg-surface-hover',
                isImporting && 'cursor-wait opacity-50',
              )}
            >
              {isImporting ? (
                <Spinner className="size-8" />
              ) : (
                <Upload className="size-8 text-text-secondary" aria-hidden="true" />
              )}
              {localize('com_ui_skill_upload_drag')}
            </button>

            <button
              type="button"
              onClick={() => directoryInputRef.current?.click()}
              disabled={isImporting}
              className="flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-border-medium text-sm text-text-primary transition-colors hover:bg-surface-hover disabled:cursor-wait disabled:opacity-50"
            >
              <FolderOpen className="size-4" aria-hidden="true" />
              {localize('com_ui_skill_select_parent_folder')}
            </button>

            {batchResults.length > 0 && (
              <ul className="max-h-32 space-y-1 overflow-y-auto rounded-lg border border-border-light p-2 text-xs">
                {batchResults.map((result) => (
                  <li
                    key={result.id}
                    data-skill-import-result
                    className="flex items-start justify-between gap-3"
                  >
                    <span className="truncate text-text-primary">{result.name}</span>
                    <span
                      className={cn(
                        'shrink-0',
                        result.status === 'success' && 'text-green-500',
                        result.status === 'warning' && 'text-yellow-500',
                        result.status === 'error' && 'text-red-500',
                        result.status === 'pending' && 'text-text-secondary',
                      )}
                      title={result.error}
                    >
                      {localize(batchStatusKeys[result.status])}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            <div className="flex flex-col gap-3 text-xs text-text-secondary">
              <div>
                <p className="font-medium">{localize('com_ui_skill_upload_requirements')}</p>
                <ul className="mt-1 list-inside list-disc">
                  <li>{localize('com_ui_skill_upload_req_md')}</li>
                  <li>{localize('com_ui_skill_upload_req_zip')}</li>
                  <li>{localize('com_ui_skill_upload_req_size', { 0: displayedSizeLimit })}</li>
                </ul>
              </div>
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".zip,.skill,.md"
            multiple
            className="hidden"
            onChange={handleFileInput}
          />
          <input
            ref={(node) => {
              directoryInputRef.current = node;
              node?.setAttribute('webkitdirectory', '');
            }}
            type="file"
            multiple
            className="hidden"
            onChange={handleDirectoryInput}
          />
        </div>
      </OGDialogContent>
    </OGDialog>
  );
}
