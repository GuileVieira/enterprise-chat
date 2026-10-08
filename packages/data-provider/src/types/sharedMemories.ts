export type SharedMemoryStatus = 'active' | 'archived';
export type SharedMemoryImportItemStatus = 'new' | 'identical' | 'conflict' | 'invalid';
export type SharedMemoryImportResultStatus = 'created' | 'updated' | 'skipped' | 'failed';

export interface TSharedMemory {
  id: string;
  key: string;
  value: string;
  tokenCount: number;
  status: SharedMemoryStatus;
  authorId?: string;
  authorName?: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  linkedToProject?: boolean;
  contentFilterBlocked?: true;
}

export interface SharedMemoriesParams {
  projectId?: string;
  status?: SharedMemoryStatus;
  search?: string;
  page?: number;
  limit?: number;
}

export interface SharedMemoriesResponse {
  items: TSharedMemory[];
  total: number;
  page: number;
  limit: number;
}

export type SharedMemoryImportDestination =
  | { type: 'library' }
  | { type: 'project'; projectId: string }
  | { type: 'personal'; agentId?: string };

export interface SharedMemoryImportRequest {
  operationId: string;
  destination: SharedMemoryImportDestination;
  format: 'json' | 'csv';
  content: string;
  decisions?: Record<
    string,
    {
      action: 'skip' | 'replace' | 'copy';
      expectedVersion?: number;
      expectedUpdatedAt?: string;
      copyKey?: string;
    }
  >;
  selectedRefs?: string[];
}

export interface SharedMemoryImportPreviewItem {
  ref: string;
  key: string;
  value: string;
  status: SharedMemoryImportItemStatus;
  error?: string;
  existing?: Pick<TSharedMemory, 'id' | 'key' | 'value' | 'tokenCount' | 'version' | 'updatedAt'>;
}

export interface SharedMemoryImportPreview {
  items: SharedMemoryImportPreviewItem[];
  totals: Record<SharedMemoryImportItemStatus, number>;
}

export interface SharedMemoryImportResultItem {
  ref: string;
  status: SharedMemoryImportResultStatus;
  memoryId?: string;
  error?: string;
}

export interface SharedMemoryImportResult {
  operationId: string;
  items: SharedMemoryImportResultItem[];
  totals: Record<SharedMemoryImportResultStatus, number>;
}

export interface SharedMemoryExportParams {
  scope: 'library' | 'project' | 'personal';
  format?: 'json' | 'csv';
  projectId?: string;
  agentId?: string;
  ids?: string[];
  search?: string;
  status?: SharedMemoryStatus;
}

export interface MemoryDeletionImpact {
  personalCount: number;
  sharedAuthoredCount: number;
  sharedPreserved: true;
  projectsNeedingOwner: Array<{ projectId: string; name?: string }>;
  projectOwnerCandidates: Array<{ userId: string; name?: string }>;
}

export interface ProjectMemoryDeletionImpact {
  localMemoryCount: number;
  sharedLinkCount: number;
  legacyMemoryKeyCount: number;
}

export interface LegacyMemoryCandidate {
  key: string;
  status: 'resolved' | 'ambiguous' | 'inaccessible' | 'missing';
  candidates: Array<{ memoryId: string; authorId: string }>;
}

export interface LegacyMemoryResolutionRequest {
  resolutions: Array<{ key: string; memoryId: string }>;
}

export interface ProjectSharedMemoryContextStatus {
  linked: number;
  available: number;
  archived: number;
  missing: number;
  filtered: number;
  omittedByLimit: number;
}

export interface SharedMemoryConsumers {
  total: number;
  visible: Array<{ projectId: string; name?: string }>;
  hasOtherConsumers: boolean;
}

export interface SharedMemoryLinkOptions {
  conflictResolution?: 'keep-local' | 'use-shared';
  expectedUpdatedAt?: string;
}

export type PublishSharedMemoryRequest =
  | { source: { type: 'personal'; memoryId: string; agentId?: string }; replaceWithLink?: false }
  | { source: { type: 'project'; projectId: string; key: string }; replaceWithLink?: boolean };

export interface PublishSharedMemoryResult {
  memory: TSharedMemory;
  sourceReplaced: boolean;
}
