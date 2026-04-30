import { useQuery } from '@tanstack/react-query';
import { ResourceType, PermissionBits } from 'librechat-data-provider';
import { dataService } from 'librechat-data-provider';

export interface ProjectPermissions {
  canView: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canShare: boolean;
}

export function useProjectPermissions(projectId: string | undefined): {
  permissions: ProjectPermissions;
  isLoading: boolean;
} {
  const { data, isLoading } = useQuery(
    ['projectPermissions', projectId],
    async () => {
      if (!projectId) {
        return { permissionBits: 0 };
      }
      return dataService.getEffectivePermissions(ResourceType.PROJECT, projectId);
    },
    {
      enabled: !!projectId,
      refetchOnWindowFocus: false,
    },
  );

  const bits = data?.permissionBits ?? 0;

  return {
    permissions: {
      canView: (bits & PermissionBits.VIEW) === PermissionBits.VIEW,
      canEdit: (bits & PermissionBits.EDIT) === PermissionBits.EDIT,
      canDelete: (bits & PermissionBits.DELETE) === PermissionBits.DELETE,
      canShare: (bits & PermissionBits.SHARE) === PermissionBits.SHARE,
    },
    isLoading,
  };
}
