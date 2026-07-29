import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
  Spinner,
} from '@librechat/client';
import { Check, FileText, Trash as Trash2, Upload } from '@phosphor-icons/react';
import type { TFile } from 'librechat-data-provider';
import {
  useUploadFileMutation,
  useDeleteFilesMutation,
  useUpdateProjectMutation,
} from '~/data-provider';
import { useLocalize } from '~/hooks';
import ProjectDiaryFiles from './ProjectDiaryFiles';

interface ProjectFileUploaderProps {
  projectId: string;
  files: TFile[];
  isLoading: boolean;
  onFilesChange: () => void;
  canEdit?: boolean;
}

export default function ProjectFileUploader({
  projectId,
  files,
  isLoading,
  onFilesChange,
  canEdit = true,
}: ProjectFileUploaderProps) {
  const localize = useLocalize();
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadingFileName, setUploadingFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const updateProject = useUpdateProjectMutation();
  const filesSignature = useMemo(
    () =>
      files
        .map((file) => `${file.file_id}:${file.embedded ? '1' : '0'}`)
        .sort()
        .join('|'),
    [files],
  );

  useEffect(() => {
    setUploadError((currentError) => (currentError ? null : currentError));
  }, [filesSignature]);

  const uploadFile = useUploadFileMutation({
    onSuccess: () => {
      setUploadError(null);
      setUploadingFileName(null);
      onFilesChange();
    },
    onError: () => {
      setUploadingFileName(null);
      setUploadError(localize('com_ui_project_upload_error'));
    },
  });

  const deleteFiles = useDeleteFilesMutation({
    onSuccess: () => {
      onFilesChange();
    },
  });

  const handleFileSelect = (file: File) => {
    if (uploadingFileName) {
      return;
    }
    setUploadError(null);
    setUploadingFileName(file.name);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('file_id', crypto.randomUUID());
    formData.append('endpoint', 'agents');
    formData.append('endpointType', 'agents');
    formData.append('projectId', projectId);
    formData.append('tool_resource', 'file_search');
    uploadFile.mutate(formData);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (uploadingFileName) {
      return;
    }
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (uploadingFileName) {
      return;
    }
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const isUploading = uploadingFileName !== null;
  const regularFiles = files.filter((file) => !file.metadata?.trafficDiary);

  const [fileToDelete, setFileToDelete] = useState<TFile | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const handleDelete = (file: TFile) => {
    setFileToDelete(file);
    setShowDeleteModal(true);
  };

  const confirmDelete = () => {
    if (!fileToDelete) {
      return;
    }
    const file = fileToDelete;
    const updatedFileIds = files.map((f) => f.file_id).filter((id) => id !== file.file_id);
    deleteFiles.mutate(
      {
        projectId,
        files: [
          {
            file_id: file.file_id,
            embedded: Boolean(file.embedded),
            filepath: file.filepath ?? '',
            source: file.source,
          },
        ],
      },
      {
        onSuccess: () => {
          updateProject.mutate(
            {
              projectId,
              payload: { fileIds: updatedFileIds },
            },
            {
              onSettled: () => {
                setFileToDelete(null);
                setShowDeleteModal(false);
              },
            },
          );
        },
      },
    );
  };

  return (
    <div className="space-y-4">
      <ProjectDiaryFiles projectId={projectId} canEdit={canEdit} />
      {canEdit && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !isUploading && fileInputRef.current?.click()}
          aria-busy={isUploading}
          className={`flex flex-col items-center justify-center rounded-2xl border border-dashed p-10 transition-colors focus-within:ring-2 focus-within:ring-ring-primary ${
            isDragOver
              ? 'border-text-primary bg-surface-hover'
              : 'border-border-light bg-surface-secondary hover:border-border-medium hover:bg-surface-hover'
          } ${isUploading ? 'cursor-wait opacity-70' : 'cursor-pointer active:scale-[0.99]'}`}
        >
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-border-light bg-surface-primary">
            <Upload className="h-6 w-6 text-text-secondary" aria-hidden="true" />
          </div>
          <p className="text-sm font-medium text-text-primary">
            {localize('com_ui_project_upload_file')}
          </p>
          <p className="mt-1 text-xs text-text-secondary">{localize('com_ui_drag_drop')}</p>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            disabled={isUploading}
            onChange={handleInputChange}
          />
        </div>
      )}

      {uploadingFileName && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center gap-3 rounded-xl border border-border-light bg-surface-secondary p-3 text-sm text-text-secondary"
        >
          <Spinner className="size-4 shrink-0" />
          {localize('com_ui_project_uploading', { filename: uploadingFileName })}
        </div>
      )}

      {uploadError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
          {uploadError}
        </div>
      )}

      {isLoading && (
        <div className="space-y-2 rounded-2xl border border-border-light bg-surface-secondary p-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-16 animate-pulse rounded-xl bg-surface-primary" />
          ))}
        </div>
      )}

      {regularFiles.length > 0 && (
        <div className="space-y-2 rounded-2xl border border-border-light bg-surface-secondary p-2">
          {regularFiles.map((file) => (
            <div
              key={file.file_id}
              className="flex items-center justify-between rounded-xl border border-transparent bg-surface-secondary p-3 transition-colors hover:border-border-light hover:bg-surface-hover"
            >
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border-light bg-surface-primary">
                  <FileText className="h-5 w-5 text-text-secondary" />
                </div>
                <div className="overflow-hidden">
                  <p className="truncate text-sm font-medium text-text-primary">{file.filename}</p>
                  <div className="flex items-center gap-2 text-xs text-text-secondary">
                    <span>{(file.bytes / 1024).toFixed(1)} KB</span>
                    {file.embedded ? (
                      <span className="flex items-center gap-0.5 text-green-600 dark:text-green-500">
                        <Check className="h-3 w-3" />
                        {localize('com_ui_indexed')}
                      </span>
                    ) : (
                      <span>{localize('com_ui_project_file_not_indexed')}</span>
                    )}
                  </div>
                </div>
              </div>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => handleDelete(file)}
                  className="rounded-lg p-2 text-text-secondary transition-colors hover:bg-red-100 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-primary dark:hover:bg-red-950"
                  title={localize('com_ui_delete')}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {regularFiles.length === 0 && !isLoading && (
        <div className="rounded-2xl border border-dashed border-border-light bg-surface-secondary py-10 text-center text-sm text-text-secondary">
          {localize('com_ui_project_no_files')}
        </div>
      )}

      <AlertDialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <AlertDialogContent className="flex w-[95vw] max-w-md flex-col gap-0 border-none bg-background p-6 text-foreground shadow-2xl">
          <AlertDialogHeader className="flex flex-col gap-2 text-left">
            <AlertDialogTitle className="whitespace-normal break-words text-xl font-semibold">
              {localize('com_ui_project_file_delete_confirm')}
            </AlertDialogTitle>
            <AlertDialogDescription className="whitespace-normal break-words text-sm text-muted-foreground">
              {localize('com_ui_delete_confirm_file_description', {
                filename: fileToDelete?.filename ?? '',
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-6 flex flex-row items-center justify-end gap-3">
            <AlertDialogCancel className="m-0 bg-secondary text-foreground hover:bg-secondary/80">
              {localize('com_ui_cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="m-0 bg-red-600 text-white hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-700"
            >
              {localize('com_ui_delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
