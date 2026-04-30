import { useRef, useState } from 'react';
import { Upload, Trash2, FileText } from 'lucide-react';
import {
  Dialog,
  DialogTemplate,
} from '@librechat/client';
import {
  useUploadFileMutation,
  useDeleteFilesMutation,
  useUpdateProjectMutation,
} from '~/data-provider';
import { useLocalize } from '~/hooks';
import type { TFile } from 'librechat-data-provider';

interface ProjectFileUploaderProps {
  projectId: string;
  files: TFile[];
  isLoading: boolean;
  onFilesChange: () => void;
}

export default function ProjectFileUploader({
  projectId,
  files,
  isLoading,
  onFilesChange,
}: ProjectFileUploaderProps) {
  const localize = useLocalize();
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const updateProject = useUpdateProjectMutation();

  const uploadFile = useUploadFileMutation({
    onSuccess: (data) => {
      setUploadError(null);
      const currentFileIds = files.map((f) => f.file_id);
      updateProject.mutate(
        {
          projectId,
          payload: {
            fileIds: [...currentFileIds, data.file_id],
          },
        },
        {
          onSuccess: () => {
            onFilesChange();
          },
        },
      );
    },
    onError: () => {
      setUploadError(localize('com_ui_project_upload_error'));
    },
  });

  const deleteFiles = useDeleteFilesMutation({
    onSuccess: () => {
      onFilesChange();
    },
  });

  const handleFileSelect = (file: File) => {
    setUploadError(null);
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
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };

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
    updateProject.mutate(
      {
        projectId,
        payload: { fileIds: updatedFileIds },
      },
      {
        onSuccess: () => {
          deleteFiles.mutate({
            files: [{ file_id: file.file_id, filepath: file.filepath }],
          });
          setFileToDelete(null);
          setShowDeleteModal(false);
        },
      },
    );
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-4">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors ${
          isDragOver
            ? 'border-text-primary bg-surface-hover'
            : 'border-border-light hover:border-text-primary hover:bg-surface-hover'
        }`}
      >
        <Upload className="mb-2 h-8 w-8 text-text-secondary" aria-hidden="true" />
        <p className="text-sm font-medium text-text-primary">
          {localize('com_ui_project_upload_file')}
        </p>
        <p className="mt-1 text-xs text-text-secondary">{localize('com_ui_drag_drop')}</p>
        <input ref={fileInputRef} type="file" className="hidden" onChange={handleInputChange} />
      </div>

      {uploadError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
          {uploadError}
        </div>
      )}

      {isLoading && (
        <div className="flex items-center justify-center py-4">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-border-light border-t-text-primary" />
        </div>
      )}

      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((file) => (
            <div
              key={file.file_id}
              className="flex items-center justify-between rounded-lg border border-border-light bg-surface-primary p-3 transition-all hover:border-border-medium"
            >
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-tertiary">
                  <FileText className="h-5 w-5 text-text-secondary" />
                </div>
                <div className="overflow-hidden">
                  <p className="truncate text-sm font-medium text-text-primary">{file.filename}</p>
                  <p className="text-xs text-text-secondary">{(file.bytes / 1024).toFixed(1)} KB</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleDelete(file)}
                className="rounded-md p-2 text-text-secondary transition-colors hover:bg-surface-tertiary hover:text-red-500"
                title={localize('com_ui_delete')}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {files.length === 0 && !isLoading && (
        <div className="py-8 text-center text-sm text-text-secondary">
          {localize('com_ui_project_no_files')}
        </div>
      )}

      <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <DialogTemplate
          showCloseButton={false}
          className="max-w-[400px]"
          title={localize('com_ui_project_file_delete_confirm')}
          headerClassName="[&>h2]:break-all [&>p]:break-words"
          description={localize('com_ui_delete_confirm_file_description', {
            filename: fileToDelete?.filename ?? '',
          })}
          selection={{
            selectHandler: confirmDelete,
            selectText: localize('com_ui_delete'),
            selectClasses:
              'bg-red-600 hover:bg-red-700 text-white dark:bg-red-600 dark:hover:bg-red-700',
          }}
        />
      </Dialog>
    </div>
  );
}
