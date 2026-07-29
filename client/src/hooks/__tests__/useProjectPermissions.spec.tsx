/**
 * @jest-environment jsdom
 */
import React from 'react';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useProjectPermissions } from '../useProjectPermissions';

jest.mock('librechat-data-provider', () => ({
  ResourceType: { PROJECT: 'project' },
  PermissionBits: { VIEW: 1, EDIT: 2, DELETE: 4, SHARE: 8 },
  dataService: {
    getEffectivePermissions: jest.fn(),
  },
}));

jest.mock('@tanstack/react-query', () => ({
  ...jest.requireActual('@tanstack/react-query'),
  useQuery: jest.fn(),
}));

import { useQuery } from '@tanstack/react-query';

const createQueryClient = () =>
  new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

function wrapper({ children }) {
  const queryClient = createQueryClient();
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe('useProjectPermissions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns all false when projectId is undefined', () => {
    (useQuery as jest.Mock).mockReturnValue({ data: undefined, isLoading: false });
    const { result } = renderHook(() => useProjectPermissions(undefined), { wrapper });
    expect(result.current.permissions.canView).toBe(false);
    expect(result.current.permissions.canEdit).toBe(false);
    expect(result.current.permissions.canDelete).toBe(false);
    expect(result.current.permissions.canShare).toBe(false);
  });

  it('returns all false when permissionBits is 0', () => {
    (useQuery as jest.Mock).mockReturnValue({ data: { permissionBits: 0 }, isLoading: false });
    const { result } = renderHook(() => useProjectPermissions('p1'), { wrapper });
    expect(result.current.permissions.canView).toBe(false);
    expect(result.current.permissions.canEdit).toBe(false);
    expect(result.current.permissions.canDelete).toBe(false);
    expect(result.current.permissions.canShare).toBe(false);
  });

  it('returns canView true when VIEW bit is set', () => {
    (useQuery as jest.Mock).mockReturnValue({ data: { permissionBits: 1 }, isLoading: false });
    const { result } = renderHook(() => useProjectPermissions('p1'), { wrapper });
    expect(result.current.permissions.canView).toBe(true);
    expect(result.current.permissions.canEdit).toBe(false);
    expect(result.current.permissions.canDelete).toBe(false);
    expect(result.current.permissions.canShare).toBe(false);
  });

  it('returns canView and canEdit when VIEW+EDIT bits are set', () => {
    (useQuery as jest.Mock).mockReturnValue({ data: { permissionBits: 3 }, isLoading: false });
    const { result } = renderHook(() => useProjectPermissions('p1'), { wrapper });
    expect(result.current.permissions.canView).toBe(true);
    expect(result.current.permissions.canEdit).toBe(true);
    expect(result.current.permissions.canDelete).toBe(false);
    expect(result.current.permissions.canShare).toBe(false);
  });

  it('returns all true when all bits are set', () => {
    (useQuery as jest.Mock).mockReturnValue({ data: { permissionBits: 15 }, isLoading: false });
    const { result } = renderHook(() => useProjectPermissions('p1'), { wrapper });
    expect(result.current.permissions.canView).toBe(true);
    expect(result.current.permissions.canEdit).toBe(true);
    expect(result.current.permissions.canDelete).toBe(true);
    expect(result.current.permissions.canShare).toBe(true);
  });

  it('passes isLoading through', () => {
    (useQuery as jest.Mock).mockReturnValue({ data: undefined, isLoading: true });
    const { result } = renderHook(() => useProjectPermissions('p1'), { wrapper });
    expect(result.current.isLoading).toBe(true);
  });
});
