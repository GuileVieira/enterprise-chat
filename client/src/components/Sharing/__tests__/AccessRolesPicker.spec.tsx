import React from 'react';
import userEvent from '@testing-library/user-event';
import { OGDialog, OGDialogContent } from '@librechat/client';
import { render, screen, within } from '@testing-library/react';
import { AccessRoleIds, ResourceType } from 'librechat-data-provider';
import AccessRolesPicker from '../AccessRolesPicker';

const onRoleChange = jest.fn();

jest.mock('librechat-data-provider/react-query', () => ({
  useGetAccessRolesQuery: (resourceType: ResourceType) => {
    const { PermissionBits } = jest.requireActual('librechat-data-provider');
    return {
      data: [
        { accessRoleId: `${resourceType}_viewer`, permBits: PermissionBits.VIEW },
        {
          accessRoleId: `${resourceType}_editor`,
          permBits: PermissionBits.VIEW | PermissionBits.EDIT,
        },
      ],
      isLoading: false,
    };
  },
}));

jest.mock('~/hooks', () => ({
  useLocalize: () => (key: string) => key,
}));

describe('AccessRolesPicker', () => {
  beforeEach(() => {
    onRoleChange.mockClear();
  });

  it.each([
    [
      ResourceType.CODE_ENVIRONMENT,
      AccessRoleIds.CODE_ENVIRONMENT_VIEWER,
      AccessRoleIds.CODE_ENVIRONMENT_EDITOR,
      'com_ui_role_viewer_desc',
    ],
    [
      ResourceType.PROJECT,
      AccessRoleIds.PROJECT_VIEWER,
      AccessRoleIds.PROJECT_EDITOR,
      'com_ui_role_viewer_desc',
    ],
    [
      ResourceType.SKILL,
      AccessRoleIds.SKILL_VIEWER,
      AccessRoleIds.SKILL_EDITOR,
      'com_ui_skill_role_viewer_desc',
    ],
  ])('selects the editor role for %s', async (resourceType, viewer, editor, description) => {
    render(
      <AccessRolesPicker
        resourceType={resourceType}
        selectedRoleId={viewer}
        onRoleChange={onRoleChange}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: description }));
    await userEvent.click(screen.getByText('com_ui_role_editor'));
    expect(onRoleChange).toHaveBeenCalledWith(editor);
  });

  it('keeps its menu within the modal focus and pointer scope', async () => {
    render(
      <OGDialog open onOpenChange={jest.fn()}>
        <OGDialogContent>
          <AccessRolesPicker
            selectedRoleId={AccessRoleIds.AGENT_VIEWER}
            onRoleChange={onRoleChange}
          />
        </OGDialogContent>
      </OGDialog>,
    );

    await userEvent.click(screen.getByRole('button', { name: 'com_ui_role_viewer_desc' }));

    const dialog = screen.getByRole('dialog');
    const menu = within(dialog).getByRole('menu');
    await userEvent.click(within(menu).getByText('com_ui_role_editor'));

    expect(onRoleChange).toHaveBeenCalledWith(AccessRoleIds.AGENT_EDITOR);
  });
});
