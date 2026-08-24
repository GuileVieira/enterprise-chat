import { useRef, useCallback, useState } from 'react';
import { FolderOpen, Upload } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { OGDialog, OGDialogContent, Spinner, useToastContext } from '@librechat/client';
import {
  megabyte,
  mergeFileConfig,
  fileConfig as defaultFileConfig,
} from 'librechat-data-provider';
import type { TSkill } from 'librechat-data-provider';
import { useGetFileConfig, useImportSkillMutation } from '~/data-provider';
import type { TranslationKeys } from '~/hooks';
import { useLocalize } from '~/hooks';
import { collectSkillDirectories, createSkillArchive } from '../utils';
import { cn } from '~/utils';

interface UploadSkillDialogProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

interface BatchResult {
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const directoryInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isBatchImporting, setIsBatchImporting] = useState(false);
  const [batchResults, setBatchResults] = useState<BatchResult[]>([]);
  const { data: skillFileConfig = { fileConfig: defaultFileConfig } } = useGetFileConfig({
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
      if (error instanceof Error && !('response' in error)) return error.message;
      const data = (error as { response?: { data?: { error?: string; message?: string } } })
        ?.response?.data;
      return data?.message ?? data?.error ?? localize('com_ui_create_skill_upload_error');
    },
    [localize],
  );

  const importFile = useCallback(
    async (file: File) => {
      if (file.size > skillImportSizeLimit) {
        throw new Error(localize('com_ui_skill_upload_size_error', { 0: displayedSizeLimit }));
      }
      const formData = new FormData();
      formData.append('file', file, file.name);
      return importMutation.mutateAsync(formData);
    },
    [displayedSizeLimit, importMutation, localize, skillImportSizeLimit],
  );

  const handleFile = useCallback(
    async (file: File) => {
      if (isImporting) return;
      try {
        const skill = await importFile(file);
        const summary = getImportSummary(skill);
        showToast({
          status: summary?.filesFailed ? 'warning' : 'success',
          message: summary?.filesFailed
            ? localize('com_ui_skill_import_with_ignored', { 0: summary.filesFailed })
            : localize('com_ui_skill_created'),
        });
        setIsOpen(false);
        navigate(`/skills/${skill._id}`);
      } catch (error) {
        showToast({ status: 'error', message: getErrorMessage(error) });
      }
    },
    [getErrorMessage, importFile, isImporting, localize, navigate, setIsOpen, showToast],
  );

  const handleDirectoryInput = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const directories = collectSkillDirectories(Array.from(event.target.files ?? []));
      event.target.value = '';
      if (directories.length === 0) {
        showToast({ status: 'error', message: localize('com_ui_skill_folder_empty') });
        return;
      }

      setIsBatchImporting(true);
      setBatchResults(directories.map(({ name, path }) => ({ name, path, status: 'pending' })));
      let succeeded = 0;

      for (const directory of directories) {
        try {
          const skill = await importFile(await createSkillArchive(directory));
          const summary = getImportSummary(skill);
          succeeded++;
          setBatchResults((results) =>
            results.map((result) =>
              result.path === directory.path
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
          setBatchResults((results) =>
            results.map((result) =>
              result.path === directory.path
                ? { ...result, status: 'error', error: getErrorMessage(error) }
                : result,
            ),
          );
        }
      }

      setIsBatchImporting(false);
      showToast({
        status: succeeded === directories.length ? 'success' : 'warning',
        message: localize('com_ui_skill_folder_result', { 0: succeeded, 1: directories.length }),
      });
    },
    [getErrorMessage, importFile, localize, showToast],
  );

  const handleFileInput = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) {
        handleFile(file);
      }
      event.target.value = '';
    },
    [handleFile],
  );

  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      setIsDragging(false);
      const file = event.dataTransfer.files?.[0];
      if (file) {
        handleFile(file);
      }
    },
    [handleFile],
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
                  <li key={result.path} className="flex items-start justify-between gap-3">
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
