import React from 'react';
import { renderHook } from '@testing-library/react';
import { Permissions, SystemRoles, PermissionTypes, roleDefaults } from 'librechat-data-provider';
import type { TRole, TUser } from 'librechat-data-provider';
import type { TAuthContext } from '~/common';
import { AuthContext } from '~/hooks/AuthContext';
import useHasAccess from './useHasAccess';

function renderUseHasAccess(authContext: Partial<TAuthContext>) {
  const value = {
    user: undefined,
    token: undefined,
    isAuthenticated: false,
    isRoleLoading: false,
    error: undefined,
    login: jest.fn(),
    logout: jest.fn(),
    setError: jest.fn(),
    roles: {},
    ...authContext,
  } as TAuthContext;

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );

  return renderHook(
    () =>
      useHasAccess({
        permissionType: PermissionTypes.PROJECTS,
        permission: Permissions.USE,
      }),
    { wrapper },
  );
}

describe('useHasAccess', () => {
  it('does not grant access when owner role permissions deny it', () => {
    const ownerRole = {
      ...roleDefaults[SystemRoles.OWNER],
      permissions: {
        ...roleDefaults[SystemRoles.OWNER].permissions,
        [PermissionTypes.PROJECTS]: {
          ...roleDefaults[SystemRoles.OWNER].permissions[PermissionTypes.PROJECTS],
          [Permissions.USE]: false,
        },
      },
    } as TRole;

    const { result } = renderUseHasAccess({
      user: { id: '1', role: SystemRoles.OWNER } as TUser,
      isAuthenticated: true,
      roles: { [SystemRoles.OWNER]: ownerRole },
    });

    expect(result.current).toBe(false);
  });

  it('keeps access optimistic while authenticated role permissions load', () => {
    const { result } = renderUseHasAccess({
      user: { id: '1', role: 'STAFF' } as TUser,
      isAuthenticated: true,
      isRoleLoading: true,
      roles: { STAFF: null },
    });

    expect(result.current).toBe(true);
  });

  it('allows custom role access after the role loads', () => {
    const staffRole = {
      name: 'STAFF',
      permissions: {
        [PermissionTypes.PROJECTS]: {
          [Permissions.USE]: true,
        },
      },
    } as TRole;

    const { result } = renderUseHasAccess({
      user: { id: '1', role: 'STAFF' } as TUser,
      isAuthenticated: true,
      roles: { STAFF: staffRole },
    });

    expect(result.current).toBe(true);
  });
});
