import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { QueryKeys, dataService } from 'librechat-data-provider';
import type {
  QueryObserverResult,
  UseMutationResult,
  UseQueryOptions,
} from '@tanstack/react-query';
import type * as t from 'librechat-data-provider';

/* Admin Users */
export const useListAdminUsers = (
  page: number = 1,
  limit: number = 50,
  config?: UseQueryOptions<t.ListUsersResponse>,
): QueryObserverResult<t.ListUsersResponse> => {
  return useQuery<t.ListUsersResponse>(
    [QueryKeys.adminUsers, page, limit],
    () => dataService.listAdminUsers(page, limit),
    {
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      retry: false,
      ...config,
    },
  );
};

export const useSearchAdminUsers = (
  query: string,
  config?: UseQueryOptions<t.ListUsersResponse>,
): QueryObserverResult<t.ListUsersResponse> => {
  return useQuery<t.ListUsersResponse>(
    [QueryKeys.adminUsersSearch, query],
    () => dataService.searchAdminUsers(query),
    {
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      retry: false,
      enabled: query.length > 0,
      ...config,
    },
  );
};

/* Admin Groups */
export const useListAdminGroups = (
  page: number = 1,
  limit: number = 50,
  config?: UseQueryOptions<t.ListGroupsResponse>,
): QueryObserverResult<t.ListGroupsResponse> => {
  return useQuery<t.ListGroupsResponse>(
    [QueryKeys.adminGroups, page, limit],
    () => dataService.listAdminGroups(page, limit),
    {
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      retry: false,
      ...config,
    },
  );
};

export const useGetAdminGroup = (
  id: string,
  config?: UseQueryOptions<t.GroupResponse>,
): QueryObserverResult<t.GroupResponse> => {
  return useQuery<t.GroupResponse>(
    [QueryKeys.adminGroup, id],
    () => dataService.getAdminGroup(id),
    {
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      retry: false,
      enabled: !!id,
      ...config,
    },
  );
};

export const useCreateAdminGroupMutation = (
  options?: t.CreateGroupOptions,
): UseMutationResult<t.GroupResponse, t.TError | undefined, t.CreateGroupPayload, unknown> => {
  const queryClient = useQueryClient();
  const { onMutate, onSuccess, onError } = options ?? {};
  return useMutation((payload) => dataService.createAdminGroup(payload), {
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries([QueryKeys.adminGroups]);
      if (onSuccess) {
        onSuccess(data, variables, context);
      }
    },
    onError: (...args) => {
      const error = args[0];
      if (error != null) {
        console.error('Failed to create group:', error);
      }
      if (onError) {
        onError(...args);
      }
    },
    onMutate,
  });
};

export const useUpdateAdminGroupMutation = (
  options?: t.UpdateGroupOptions,
): UseMutationResult<t.GroupResponse, t.TError | undefined, t.UpdateGroupVars, unknown> => {
  const queryClient = useQueryClient();
  const { onMutate, onSuccess, onError } = options ?? {};
  return useMutation((variables) => dataService.updateAdminGroup(variables.id, variables.payload), {
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries([QueryKeys.adminGroup, variables.id]);
      queryClient.invalidateQueries([QueryKeys.adminGroups]);
      if (onSuccess) {
        onSuccess(data, variables, context);
      }
    },
    onError: (...args) => {
      const error = args[0];
      if (error != null) {
        console.error('Failed to update group:', error);
      }
      if (onError) {
        onError(...args);
      }
    },
    onMutate,
  });
};

export const useDeleteAdminGroupMutation = (
  options?: t.DeleteGroupOptions,
): UseMutationResult<unknown, t.TError | undefined, string, unknown> => {
  const queryClient = useQueryClient();
  const { onMutate, onSuccess, onError } = options ?? {};
  return useMutation((id) => dataService.deleteAdminGroup(id), {
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries([QueryKeys.adminGroups]);
      if (onSuccess) {
        onSuccess(data, variables, context);
      }
    },
    onError: (...args) => {
      const error = args[0];
      if (error != null) {
        console.error('Failed to delete group:', error);
      }
      if (onError) {
        onError(...args);
      }
    },
    onMutate,
  });
};

export const useGetAdminGroupMembers = (
  id: string,
  config?: UseQueryOptions<t.GroupMembersResponse>,
): QueryObserverResult<t.GroupMembersResponse> => {
  return useQuery<t.GroupMembersResponse>(
    [QueryKeys.adminGroupMembers, id],
    () => dataService.getAdminGroupMembers(id),
    {
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      retry: false,
      enabled: !!id,
      ...config,
    },
  );
};

export const useAddAdminGroupMemberMutation = (
  options?: t.AddGroupMemberOptions,
): UseMutationResult<unknown, t.TError | undefined, t.AddGroupMemberVars, unknown> => {
  const queryClient = useQueryClient();
  const { onMutate, onSuccess, onError } = options ?? {};
  return useMutation(
    (variables) => dataService.addAdminGroupMember(variables.id, variables.userId),
    {
      onSuccess: (data, variables, context) => {
        queryClient.invalidateQueries([QueryKeys.adminGroupMembers, variables.id]);
        if (onSuccess) {
          onSuccess(data, variables, context);
        }
      },
      onError: (...args) => {
        const error = args[0];
        if (error != null) {
          console.error('Failed to add group member:', error);
        }
        if (onError) {
          onError(...args);
        }
      },
      onMutate,
    },
  );
};

export const useRemoveAdminGroupMemberMutation = (
  options?: t.RemoveGroupMemberOptions,
): UseMutationResult<unknown, t.TError | undefined, t.RemoveGroupMemberVars, unknown> => {
  const queryClient = useQueryClient();
  const { onMutate, onSuccess, onError } = options ?? {};
  return useMutation(
    (variables) => dataService.removeAdminGroupMember(variables.id, variables.userId),
    {
      onSuccess: (data, variables, context) => {
        queryClient.invalidateQueries([QueryKeys.adminGroupMembers, variables.id]);
        if (onSuccess) {
          onSuccess(data, variables, context);
        }
      },
      onError: (...args) => {
        const error = args[0];
        if (error != null) {
          console.error('Failed to remove group member:', error);
        }
        if (onError) {
          onError(...args);
        }
      },
      onMutate,
    },
  );
};

/* Admin Config */
export const useListAdminConfigs = (
  config?: UseQueryOptions<t.AdminConfigListResponse>,
): QueryObserverResult<t.AdminConfigListResponse> => {
  return useQuery<t.AdminConfigListResponse>(
    [QueryKeys.adminConfigs],
    () => dataService.listAdminConfigs(),
    {
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      retry: false,
      ...config,
    },
  );
};

export const useGetAdminConfigBase = (
  config?: UseQueryOptions<{ config: Record<string, unknown> }>,
): QueryObserverResult<{ config: Record<string, unknown> }> => {
  return useQuery<{ config: Record<string, unknown> }>(
    [QueryKeys.adminConfigBase],
    () => dataService.getAdminConfigBase(),
    {
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      retry: false,
      ...config,
    },
  );
};

export const useToggleAdminConfigMutation = (
  options?: t.MutationOptions<
    t.AdminConfigResponse,
    { principalType: string; principalId: string; isActive: boolean }
  >,
): UseMutationResult<
  t.AdminConfigResponse,
  t.TError | undefined,
  { principalType: string; principalId: string; isActive: boolean },
  unknown
> => {
  const queryClient = useQueryClient();
  const { onMutate, onSuccess, onError } = options ?? {};
  return useMutation(
    (variables) =>
      dataService.toggleAdminConfig(variables.principalType, variables.principalId, {
        isActive: variables.isActive,
      }),
    {
      onSuccess: (data, variables, context) => {
        queryClient.invalidateQueries([QueryKeys.adminConfigs]);
        if (onSuccess) {
          onSuccess(data, variables, context);
        }
      },
      onError: (...args) => {
        const error = args[0];
        if (error != null) {
          console.error('Failed to toggle config:', error);
        }
        if (onError) {
          onError(...args);
        }
      },
      onMutate,
    },
  );
};

export const useDeleteAdminConfigMutation = (
  options?: t.MutationOptions<unknown, { principalType: string; principalId: string }>,
): UseMutationResult<
  unknown,
  t.TError | undefined,
  { principalType: string; principalId: string },
  unknown
> => {
  const queryClient = useQueryClient();
  const { onMutate, onSuccess, onError } = options ?? {};
  return useMutation(
    (variables) => dataService.deleteAdminConfig(variables.principalType, variables.principalId),
    {
      onSuccess: (data, variables, context) => {
        queryClient.invalidateQueries([QueryKeys.adminConfigs]);
        if (onSuccess) {
          onSuccess(data, variables, context);
        }
      },
      onError: (...args) => {
        const error = args[0];
        if (error != null) {
          console.error('Failed to delete config:', error);
        }
        if (onError) {
          onError(...args);
        }
      },
      onMutate,
    },
  );
};

/* Admin Users - Create */
export const useCreateAdminUserMutation = (
  options?: t.MutationOptions<
    { message: string; password?: string },
    {
      email: string;
      name: string;
      username: string;
      password?: string;
      tenantId?: string;
      role?: string;
    }
  >,
): UseMutationResult<
  { message: string; password?: string },
  t.TError | undefined,
  {
    email: string;
    name: string;
    username: string;
    password?: string;
    tenantId?: string;
    role?: string;
  },
  unknown
> => {
  const queryClient = useQueryClient();
  const { onMutate, onSuccess, onError } = options ?? {};
  return useMutation((payload) => dataService.createAdminUser(payload), {
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries([QueryKeys.adminUsers]);
      if (onSuccess) {
        onSuccess(data, variables, context);
      }
    },
    onError: (...args) => {
      const error = args[0];
      if (error != null) {
        console.error('Failed to create user:', error);
      }
      if (onError) {
        onError(...args);
      }
    },
    onMutate,
  });
};

/* Admin Functions */
export const useListAdminFunctions = (
  tenantId: string,
  config?: UseQueryOptions<q.TenantFunctionListResponse>,
): QueryObserverResult<q.TenantFunctionListResponse> => {
  return useQuery<q.TenantFunctionListResponse>(
    [QueryKeys.adminFunctions, tenantId],
    () => dataService.listAdminFunctions(tenantId),
    {
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      retry: false,
      enabled: !!tenantId,
      ...config,
    },
  );
};

export const useCreateAdminFunctionMutation = (
  options?: t.MutationOptions<
    q.TenantFunctionResponse,
    Omit<q.TenantFunction, '_id' | 'createdAt' | 'updatedAt'>
  >,
): UseMutationResult<
  q.TenantFunctionResponse,
  t.TError | undefined,
  Omit<q.TenantFunction, '_id' | 'createdAt' | 'updatedAt'>,
  unknown
> => {
  const queryClient = useQueryClient();
  const { onMutate, onSuccess, onError } = options ?? {};
  return useMutation((payload) => dataService.createAdminFunction(payload), {
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries([QueryKeys.adminFunctions, variables.tenantId]);
      if (onSuccess) {
        onSuccess(data, variables, context);
      }
    },
    onError: (...args) => {
      const error = args[0];
      if (error != null) {
        console.error('Failed to create function:', error);
      }
      if (onError) {
        onError(...args);
      }
    },
    onMutate,
  });
};

export const useToggleAdminFunctionMutation = (
  options?: t.MutationOptions<
    q.TenantFunctionResponse,
    { id: string; tenantId: string; isActive: boolean }
  >,
): UseMutationResult<
  q.TenantFunctionResponse,
  t.TError | undefined,
  { id: string; tenantId: string; isActive: boolean },
  unknown
> => {
  const queryClient = useQueryClient();
  const { onMutate, onSuccess, onError } = options ?? {};
  return useMutation(
    (variables) =>
      dataService.toggleAdminFunction(variables.id, variables.tenantId, variables.isActive),
    {
      onSuccess: (data, variables, context) => {
        queryClient.invalidateQueries([QueryKeys.adminFunctions, variables.tenantId]);
        if (onSuccess) {
          onSuccess(data, variables, context);
        }
      },
      onError: (...args) => {
        const error = args[0];
        if (error != null) {
          console.error('Failed to toggle function:', error);
        }
        if (onError) {
          onError(...args);
        }
      },
      onMutate,
    },
  );
};

export const useDeleteAdminFunctionMutation = (
  options?: t.MutationOptions<unknown, { id: string; tenantId: string }>,
): UseMutationResult<unknown, t.TError | undefined, { id: string; tenantId: string }, unknown> => {
  const queryClient = useQueryClient();
  const { onMutate, onSuccess, onError } = options ?? {};
  return useMutation(
    (variables) => dataService.deleteAdminFunction(variables.id, variables.tenantId),
    {
      onSuccess: (data, variables, context) => {
        queryClient.invalidateQueries([QueryKeys.adminFunctions, variables.tenantId]);
        if (onSuccess) {
          onSuccess(data, variables, context);
        }
      },
      onError: (...args) => {
        const error = args[0];
        if (error != null) {
          console.error('Failed to delete function:', error);
        }
        if (onError) {
          onError(...args);
        }
      },
      onMutate,
    },
  );
};

/* Admin Secrets */
export const useListAdminSecrets = (
  tenantId: string,
  config?: UseQueryOptions<q.TenantSecretListResponse>,
): QueryObserverResult<q.TenantSecretListResponse> => {
  return useQuery<q.TenantSecretListResponse>(
    [QueryKeys.adminSecrets, tenantId],
    () => dataService.listAdminSecrets(tenantId),
    {
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      retry: false,
      enabled: !!tenantId,
      ...config,
    },
  );
};

export const useCreateAdminSecretMutation = (
  options?: t.MutationOptions<
    q.TenantSecretResponse,
    { tenantId: string; name: string; value: string; type: string }
  >,
): UseMutationResult<
  q.TenantSecretResponse,
  t.TError | undefined,
  { tenantId: string; name: string; value: string; type: string },
  unknown
> => {
  const queryClient = useQueryClient();
  const { onMutate, onSuccess, onError } = options ?? {};
  return useMutation((payload) => dataService.createAdminSecret(payload), {
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries([QueryKeys.adminSecrets, variables.tenantId]);
      if (onSuccess) {
        onSuccess(data, variables, context);
      }
    },
    onError: (...args) => {
      const error = args[0];
      if (error != null) {
        console.error('Failed to create secret:', error);
      }
      if (onError) {
        onError(...args);
      }
    },
    onMutate,
  });
};

export const useDeleteAdminSecretMutation = (
  options?: t.MutationOptions<unknown, { name: string; tenantId: string }>,
): UseMutationResult<
  unknown,
  t.TError | undefined,
  { name: string; tenantId: string },
  unknown
> => {
  const queryClient = useQueryClient();
  const { onMutate, onSuccess, onError } = options ?? {};
  return useMutation(
    (variables) => dataService.deleteAdminSecret(variables.name, variables.tenantId),
    {
      onSuccess: (data, variables, context) => {
        queryClient.invalidateQueries([QueryKeys.adminSecrets, variables.tenantId]);
        if (onSuccess) {
          onSuccess(data, variables, context);
        }
      },
      onError: (...args) => {
        const error = args[0];
        if (error != null) {
          console.error('Failed to delete secret:', error);
        }
        if (onError) {
          onError(...args);
        }
      },
      onMutate,
    },
  );
};

/* Admin Tenants */
export const useListAdminTenants = (
  config?: UseQueryOptions<t.ListTenantsResponse>,
): QueryObserverResult<t.ListTenantsResponse> => {
  return useQuery<t.ListTenantsResponse>(
    [QueryKeys.adminTenants],
    () => dataService.listAdminTenants(),
    {
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      retry: false,
      ...config,
    },
  );
};

export const useGetAdminTenantUsers = (
  tenantId: string,
  page: number = 1,
  limit: number = 50,
  config?: UseQueryOptions<t.ListUsersResponse>,
): QueryObserverResult<t.ListUsersResponse> => {
  return useQuery<t.ListUsersResponse>(
    [QueryKeys.adminTenantUsers, tenantId, page, limit],
    () => dataService.getAdminTenantUsers(tenantId, page, limit),
    {
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      retry: false,
      enabled: !!tenantId,
      ...config,
    },
  );
};

export const useGetAdminTenantStats = (
  tenantId: string,
  config?: UseQueryOptions<t.TenantStatsResponse>,
): QueryObserverResult<t.TenantStatsResponse> => {
  return useQuery<t.TenantStatsResponse>(
    [QueryKeys.adminTenantStats, tenantId],
    () => dataService.getAdminTenantStats(tenantId),
    {
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      retry: false,
      enabled: !!tenantId,
      ...config,
    },
  );
};
