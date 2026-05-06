import React from 'react';
import * as Ariakit from '@ariakit/react';
import { CaretDown as ChevronDown } from '@phosphor-icons/react';
import { DropdownPopup, Skeleton } from '@librechat/client';
import { AccessRoleIds, PermissionBits, ResourceType } from 'librechat-data-provider';
import { useGetAccessRolesQuery } from 'librechat-data-provider/react-query';
import type { AccessRole } from 'librechat-data-provider';
import type * as t from '~/common';
import { cn, getRoleLocalizationKeys } from '~/utils';
import { useLocalize } from '~/hooks';

interface AccessRolesPickerProps {
  id?: string;
  resourceType?: ResourceType;
  selectedRoleId?: AccessRoleIds | string;
  onRoleChange: (roleId: AccessRoleIds) => void;
  className?: string;
}

const resourceRoleIds: Record<
  ResourceType,
  { viewer: AccessRoleIds; editor: AccessRoleIds; owner: AccessRoleIds }
> = {
  [ResourceType.AGENT]: {
    viewer: AccessRoleIds.AGENT_VIEWER,
    editor: AccessRoleIds.AGENT_EDITOR,
    owner: AccessRoleIds.AGENT_OWNER,
  },
  [ResourceType.PROJECT]: {
    viewer: AccessRoleIds.PROJECT_VIEWER,
    editor: AccessRoleIds.PROJECT_EDITOR,
    owner: AccessRoleIds.PROJECT_OWNER,
  },
  [ResourceType.PROMPTGROUP]: {
    viewer: AccessRoleIds.PROMPTGROUP_VIEWER,
    editor: AccessRoleIds.PROMPTGROUP_EDITOR,
    owner: AccessRoleIds.PROMPTGROUP_OWNER,
  },
  [ResourceType.MCPSERVER]: {
    viewer: AccessRoleIds.MCPSERVER_VIEWER,
    editor: AccessRoleIds.MCPSERVER_EDITOR,
    owner: AccessRoleIds.MCPSERVER_OWNER,
  },
  [ResourceType.REMOTE_AGENT]: {
    viewer: AccessRoleIds.REMOTE_AGENT_VIEWER,
    editor: AccessRoleIds.REMOTE_AGENT_EDITOR,
    owner: AccessRoleIds.REMOTE_AGENT_OWNER,
  },
};

const getFallbackRoleId = (
  resourceType: ResourceType,
  roleId?: AccessRoleIds | string,
): AccessRoleIds => {
  const roleIds = resourceRoleIds[resourceType] ?? resourceRoleIds[ResourceType.AGENT];

  if (!roleId) {
    return roleIds.owner;
  }

  const normalizedRoleId = roleId.toLowerCase();

  if (normalizedRoleId.endsWith('_owner') || normalizedRoleId === 'owner') {
    return roleIds.owner;
  }

  if (normalizedRoleId.endsWith('_editor') || normalizedRoleId === 'editor') {
    return roleIds.editor;
  }

  if (normalizedRoleId.endsWith('_viewer') || normalizedRoleId === 'viewer') {
    return roleIds.viewer;
  }

  return roleIds.owner;
};

const getRoleIdFromRole = (resourceType: ResourceType, role: AccessRole): AccessRoleIds => {
  const roleIds = resourceRoleIds[resourceType] ?? resourceRoleIds[ResourceType.AGENT];

  if ((role.permBits & (PermissionBits.DELETE | PermissionBits.SHARE)) > 0) {
    return roleIds.owner;
  }

  if ((role.permBits & PermissionBits.EDIT) > 0) {
    return roleIds.editor;
  }

  if ((role.permBits & PermissionBits.VIEW) > 0) {
    return roleIds.viewer;
  }

  return getFallbackRoleId(resourceType, role.accessRoleId);
};

export default function AccessRolesPicker({
  id,
  resourceType = ResourceType.AGENT,
  selectedRoleId = AccessRoleIds.AGENT_VIEWER,
  onRoleChange,
  className = '',
}: AccessRolesPickerProps) {
  const localize = useLocalize();
  const [isOpen, setIsOpen] = React.useState(false);
  const { data: accessRoles, isLoading: rolesLoading } = useGetAccessRolesQuery(resourceType);

  /** Helper function to get localized role name and description */
  const getLocalizedRoleInfo = (roleId: AccessRoleIds) => {
    const keys = getRoleLocalizationKeys(roleId);
    return {
      name: localize(keys.name),
      description: localize(keys.description),
    };
  };

  const selectedRole = accessRoles?.find((role) => role.accessRoleId === selectedRoleId);
  const fallbackRoleId = getFallbackRoleId(resourceType, selectedRoleId);
  const selectedRoleInfo = selectedRole
    ? getLocalizedRoleInfo(getRoleIdFromRole(resourceType, selectedRole))
    : getLocalizedRoleInfo(fallbackRoleId);

  if (rolesLoading || !accessRoles) {
    return <Skeleton className="h-10 w-24 rounded-lg" />;
  }

  const dropdownItems: t.MenuItemProps[] = accessRoles.map((role: AccessRole) => {
    const roleId = getRoleIdFromRole(resourceType, role);
    const localizedInfo = getLocalizedRoleInfo(roleId);
    return {
      id: role.accessRoleId,
      label: localizedInfo.name,
      onClick: () => {
        onRoleChange(roleId);
        setIsOpen(false);
      },
      render: (props) => (
        <button {...props}>
          <div className="flex flex-col items-start gap-0.5 text-left">
            <span className="font-medium text-text-primary">{localizedInfo.name}</span>
            <span className="text-xs text-text-secondary">{localizedInfo.description}</span>
          </div>
        </button>
      ),
    };
  });

  return (
    <div className={className} id={id}>
      <DropdownPopup
        menuId="access-roles-menu"
        isOpen={isOpen}
        setIsOpen={setIsOpen}
        trigger={
          <Ariakit.MenuButton
            aria-label={selectedRoleInfo?.description || 'Select role'}
            className={cn(
              'flex items-center justify-between gap-2 rounded-xl border border-border-light bg-transparent px-3 py-2 text-sm transition-colors hover:bg-surface-tertiary',
            )}
          >
            <span className="font-medium">
              {selectedRoleInfo?.name || localize('com_ui_select')}
            </span>
            <ChevronDown className="h-4 w-4 text-text-secondary" aria-hidden="true" />
          </Ariakit.MenuButton>
        }
        items={dropdownItems}
        className="w-[280px]"
      />
    </div>
  );
}
