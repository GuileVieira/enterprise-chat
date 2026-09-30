import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
} from '@librechat/client';
import { Permissions, PermissionTypes } from 'librechat-data-provider';
import type { TProject } from 'librechat-data-provider';
import {
  useProjectMemoryDeletionImpactQuery,
  useCreateSharedMemoryMutation,
  useSharedMemoryExportMutation,
} from '~/data-provider/SharedMemories';
import { useHasAccess, useLocalize } from '~/hooks';

export default function ProjectDeleteDialog({
  project,
  isDeleting,
  onClose,
  onDelete,
}: {
  project: TProject | null;
  isDeleting: boolean;
  onClose: () => void;
  onDelete: () => void;
}) {
  const localize = useLocalize();
  const canPublish = useHasAccess({
    permissionType: PermissionTypes.SHARED_MEMORIES,
    permission: Permissions.CREATE,
  });
  const impact = useProjectMemoryDeletionImpactQuery(project?.projectId ?? '', Boolean(project));
  const exportMutation = useSharedMemoryExportMutation();
  const publishMutation = useCreateSharedMemoryMutation();
  const [error, setError] = useState('');

  const exportMemories = () => {
    if (!project) return;
    setError('');
    exportMutation.mutate(
      { scope: 'project', projectId: project.projectId, format: 'json' },
      {
        onSuccess: (result) => {
          const url = URL.createObjectURL(
            new Blob([typeof result === 'string' ? result : JSON.stringify(result, null, 2)], {
              type: 'application/json',
            }),
          );
          const anchor = document.createElement('a');
          anchor.href = url;
          anchor.download = `orqest-project-memories-${project.projectId}.json`;
          anchor.click();
          URL.revokeObjectURL(url);
        },
        onError: () => setError(localize('com_ui_error')),
      },
    );
  };

  const hasLocalMemories = (impact.data?.localMemoryCount ?? 0) > 0;
  const publishMemories = async () => {
    if (!project?.memories?.length) return;
    setError('');
    try {
      await Promise.all(
        project.memories.map((memory) =>
          publishMutation.mutateAsync({ key: memory.key, value: memory.value }),
        ),
      );
    } catch {
      setError(localize('com_ui_error'));
    }
  };
  return (
    <AlertDialog open={Boolean(project)} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{localize('com_ui_delete_project')}</AlertDialogTitle>
          <AlertDialogDescription>
            {impact.isLoading
              ? localize('com_ui_memory_deletion_loading')
              : localize('com_ui_memory_deletion_project_summary', {
                  0: project?.name ?? '',
                  1: impact.data?.localMemoryCount ?? 0,
                  2: impact.data?.sharedLinkCount ?? 0,
                })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {hasLocalMemories && (
          <p className="text-sm text-text-secondary">
            {localize('com_ui_memory_deletion_publish_project_hint')}
          </p>
        )}
        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
        <AlertDialogFooter>
          {hasLocalMemories && (
            <Button
              type="button"
              variant="outline"
              onClick={exportMemories}
              disabled={exportMutation.isLoading}
            >
              {localize('com_ui_memory_deletion_export')}
            </Button>
          )}
          {hasLocalMemories && canPublish && (
            <Button
              type="button"
              variant="outline"
              onClick={() => void publishMemories()}
              disabled={publishMutation.isLoading}
            >
              {localize('com_ui_publish_memory')}
            </Button>
          )}
          <AlertDialogCancel disabled={isDeleting || exportMutation.isLoading}>
            {localize('com_ui_cancel')}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onDelete}
            disabled={
              isDeleting ||
              impact.isLoading ||
              impact.isError ||
              !impact.data ||
              exportMutation.isLoading
            }
          >
            {localize('com_ui_delete')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
