import { isAxiosError } from 'axios';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { dataService, QueryKeys, DynamicQueryKeys } from 'librechat-data-provider';
import type { SharedMemoryLinkOptions } from 'librechat-data-provider';
import type {
  PublishSharedMemoryRequest,
  PublishSharedMemoryResult,
  LegacyMemoryCandidate,
  SharedMemoryContextStatus,
  SharedMemoriesResponse,
  SharedMemoryImportRequest,
} from './types';

type SharedMemoryService = typeof dataService & {
  getSharedMemories: (params: {
    projectId?: string;
    status?: string;
    search?: string;
  }) => Promise<unknown>;
  createSharedMemory: (payload: { key: string; value: string }) => Promise<unknown>;
  updateSharedMemory: (
    id: string,
    payload: { key: string; value: string; expectedUpdatedAt: string },
  ) => Promise<unknown>;
  archiveSharedMemory: (id: string, expectedUpdatedAt: string) => Promise<unknown>;
  restoreSharedMemory: (id: string, expectedUpdatedAt: string) => Promise<unknown>;
  linkProjectSharedMemories: (
    projectId: string,
    memoryIds: string[],
    options?: SharedMemoryLinkOptions,
  ) => Promise<{ memoryIds: string[] }>;
  unlinkProjectSharedMemory: (projectId: string, memoryId: string) => Promise<void>;
  copySharedMemoryToProject: (
    id: string,
    payload: { projectId: string; key?: string },
  ) => Promise<void>;
  previewSharedMemoryImport: (payload: SharedMemoryImportRequest) => Promise<unknown>;
  importSharedMemories: (payload: SharedMemoryImportRequest) => Promise<unknown>;
  exportSharedMemories: (payload: {
    scope: 'library' | 'project' | 'personal';
    projectId?: string;
    ids?: string[];
    agentId?: string;
    format?: 'json' | 'csv';
    search?: string;
    status?: 'active' | 'archived';
  }) => Promise<unknown>;
  getMemoryDeletionImpact: (userId?: string) => Promise<unknown>;
  getProjectMemoryDeletionImpact: (projectId: string) => Promise<unknown>;
  reassignProjectMemoryOwner: (projectId: string, userId: string) => Promise<void>;
  publishSharedMemory: (payload: PublishSharedMemoryRequest) => Promise<PublishSharedMemoryResult>;
  getProjectLegacyMemoryCandidates: (
    projectId: string,
  ) => Promise<{ items: LegacyMemoryCandidate[] }>;
  getProjectSharedMemoryContextStatus: (projectId: string) => Promise<SharedMemoryContextStatus>;
  resolveProjectLegacyMemories: (
    projectId: string,
    payload: { resolutions: Array<{ key: string; memoryId: string }> },
  ) => Promise<unknown>;
};

const service = dataService as SharedMemoryService;
const key = (projectId?: string, status?: 'active' | 'archived', search?: string) =>
  DynamicQueryKeys.sharedMemories({ projectId, status, search });

export const useSharedMemoriesQuery = (
  projectId?: string,
  status: 'active' | 'archived' = 'active',
  search?: string,
) =>
  useQuery<SharedMemoriesResponse>(
    key(projectId, status, search),
    () =>
      service.getSharedMemories({ projectId, status, search }) as Promise<SharedMemoriesResponse>,
    { staleTime: 10_000 },
  );

const useSharedMemoryMutation = <TVariables>(fn: (variables: TVariables) => Promise<unknown>) => {
  const queryClient = useQueryClient();
  const invalidate = () =>
    Promise.all(
      [
        QueryKeys.sharedMemories,
        QueryKeys.projectLegacyMemoryCandidates,
        QueryKeys.sharedMemoryContextStatus,
        QueryKeys.sharedMemoryConsumers,
        QueryKeys.memoryDeletionImpact,
        QueryKeys.projectMemoryDeletionImpact,
        QueryKeys.project,
        QueryKeys.projects,
        QueryKeys.memories,
      ].map((queryKey) => queryClient.invalidateQueries([queryKey])),
    );
  return useMutation(fn, {
    onSuccess: invalidate,
    onError: (error) =>
      isAxiosError(error) && error.response?.status === 409 ? invalidate() : undefined,
  });
};

export const useCreateSharedMemoryMutation = () =>
  useSharedMemoryMutation((payload: { key: string; value: string }) =>
    service.createSharedMemory(payload),
  );
export const usePublishSharedMemoryMutation = () =>
  useSharedMemoryMutation((payload: PublishSharedMemoryRequest) =>
    service.publishSharedMemory(payload),
  );
export const useProjectLegacyMemoryCandidatesQuery = (projectId?: string) =>
  useQuery(
    [QueryKeys.projectLegacyMemoryCandidates, projectId],
    () => service.getProjectLegacyMemoryCandidates(projectId ?? ''),
    { enabled: Boolean(projectId) },
  );
export const useSharedMemoryContextStatusQuery = (projectId?: string) =>
  useQuery(
    [QueryKeys.sharedMemoryContextStatus, projectId],
    () => service.getProjectSharedMemoryContextStatus(projectId ?? ''),
    { enabled: Boolean(projectId) },
  );
export const useSharedMemoryConsumersQuery = (memoryId?: string | null) =>
  useQuery(
    [QueryKeys.sharedMemoryConsumers, memoryId],
    () => dataService.getSharedMemoryConsumers(memoryId ?? ''),
    { enabled: Boolean(memoryId) },
  );
export const useResolveProjectLegacyMemoriesMutation = () =>
  useSharedMemoryMutation(
    (payload: { projectId: string; resolutions: Array<{ key: string; memoryId: string }> }) =>
      service.resolveProjectLegacyMemories(payload.projectId, { resolutions: payload.resolutions }),
  );
export const useUpdateSharedMemoryMutation = () =>
  useSharedMemoryMutation(
    (payload: { id: string; key: string; value: string; expectedUpdatedAt: string }) =>
      service.updateSharedMemory(payload.id, payload),
  );
export const useArchiveSharedMemoryMutation = () =>
  useSharedMemoryMutation((payload: { id: string; expectedUpdatedAt: string }) =>
    service.archiveSharedMemory(payload.id, payload.expectedUpdatedAt),
  );
export const useRestoreSharedMemoryMutation = () =>
  useSharedMemoryMutation((payload: { id: string; expectedUpdatedAt: string }) =>
    service.restoreSharedMemory(payload.id, payload.expectedUpdatedAt),
  );
export const useLinkSharedMemoriesMutation = () =>
  useSharedMemoryMutation(
    (payload: { projectId: string; memoryIds: string[] } & SharedMemoryLinkOptions) =>
      service.linkProjectSharedMemories(payload.projectId, payload.memoryIds, {
        conflictResolution: payload.conflictResolution,
        expectedUpdatedAt: payload.expectedUpdatedAt,
      }),
  );
export const useUnlinkSharedMemoryMutation = () =>
  useSharedMemoryMutation((payload: { projectId: string; memoryId: string }) =>
    service.unlinkProjectSharedMemory(payload.projectId, payload.memoryId),
  );
export const useCopySharedMemoryMutation = () =>
  useSharedMemoryMutation((payload: { id: string; projectId: string; key?: string }) =>
    service.copySharedMemoryToProject(payload.id, payload),
  );
export const useSharedMemoryImportPreviewMutation = () =>
  useMutation((payload: SharedMemoryImportRequest) => service.previewSharedMemoryImport(payload));
export const useSharedMemoryImportMutation = () =>
  useSharedMemoryMutation((payload: SharedMemoryImportRequest) =>
    service.importSharedMemories(payload),
  );
export const useSharedMemoryExportMutation = () =>
  useMutation(
    (payload: {
      scope: 'library' | 'project' | 'personal';
      projectId?: string;
      ids?: string[];
      agentId?: string;
      format?: 'json' | 'csv';
      search?: string;
      status?: 'active' | 'archived';
    }) => service.exportSharedMemories(payload),
  );
export const useMemoryDeletionImpactQuery = (enabled: boolean, userId?: string) =>
  useQuery(
    [QueryKeys.memoryDeletionImpact, userId],
    () =>
      service.getMemoryDeletionImpact(userId) as Promise<{
        personalCount: number;
        sharedAuthoredCount: number;
        projectsNeedingOwner: Array<{ projectId: string; name?: string }>;
        projectOwnerCandidates: Array<{ userId: string; name?: string }>;
      }>,
    { enabled },
  );

export const useProjectMemoryDeletionImpactQuery = (projectId: string, enabled: boolean) =>
  useQuery(
    [QueryKeys.projectMemoryDeletionImpact, projectId],
    () =>
      service.getProjectMemoryDeletionImpact(projectId) as Promise<{
        localMemoryCount: number;
        sharedLinkCount: number;
        legacyMemoryKeyCount: number;
      }>,
    { enabled },
  );

export const useReassignProjectMemoryOwnerMutation = () =>
  useSharedMemoryMutation(({ projectId, userId }: { projectId: string; userId: string }) =>
    service.reassignProjectMemoryOwner(projectId, userId),
  );
