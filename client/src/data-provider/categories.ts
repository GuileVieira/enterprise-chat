import { useMutation, useQueryClient } from '@tanstack/react-query';
import { dataService, QueryKeys } from 'librechat-data-provider';
import type { UseMutationResult } from '@tanstack/react-query';
import type t from 'librechat-data-provider';

export const useCreateCategoryMutation = (options?: {
  onSuccess?: (data: t.TCategory) => void;
  onError?: (error: unknown) => void;
}): UseMutationResult<t.TCategory, unknown, t.TCreateCategoryRequest, unknown> => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (variables: t.TCreateCategoryRequest) => dataService.createCategory(variables),
    onSuccess: (data) => {
      queryClient.invalidateQueries([QueryKeys.categories]);
      options?.onSuccess?.(data);
    },
    onError: (error) => {
      options?.onError?.(error);
    },
  });
};

export const useUpdateCategoryMutation = (options?: {
  onSuccess?: (data: t.TCategory) => void;
  onError?: (error: unknown) => void;
}): UseMutationResult<
  t.TCategory,
  unknown,
  { id: string; payload: t.TUpdateCategoryRequest },
  unknown
> => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (variables: { id: string; payload: t.TUpdateCategoryRequest }) =>
      dataService.updateCategory(variables.id, variables.payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries([QueryKeys.categories]);
      options?.onSuccess?.(data);
    },
    onError: (error) => {
      options?.onError?.(error);
    },
  });
};

export const useDeleteCategoryMutation = (options?: {
  onSuccess?: (data: t.TDeleteCategoryResponse) => void;
  onError?: (error: unknown) => void;
}): UseMutationResult<
  t.TDeleteCategoryResponse,
  unknown,
  { id: string; value?: string },
  unknown
> => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (variables: { id: string; value?: string }) =>
      dataService.deleteCategory(variables.id),
    onSuccess: (data) => {
      queryClient.invalidateQueries([QueryKeys.categories]);
      options?.onSuccess?.(data);
    },
    onError: (error) => {
      options?.onError?.(error);
    },
  });
};
