export type SharedMemoryStatus = 'active' | 'archived';

export type TSharedMemory = {
  id: string;
  key: string;
  value: string;
  tokenCount: number;
  updatedAt: string;
  version: number;
  status: SharedMemoryStatus;
  authorName?: string;
  linkedToProject?: boolean;
};

export type SharedMemoriesResponse = {
  items: TSharedMemory[];
  total: number;
  page: number;
  limit: number;
};

export type SharedMemoryImportItem = {
  ref: string;
  key: string;
  value: string;
  status: 'new' | 'identical' | 'conflict' | 'invalid';
  existing?: Pick<TSharedMemory, 'id' | 'key' | 'value' | 'version' | 'updatedAt'>;
  error?: string;
};

export type SharedMemoryImportPreview = { items: SharedMemoryImportItem[] };
export type SharedMemoryImportResult = {
  operationId: string;
  items: Array<{
    ref: string;
    status: 'created' | 'updated' | 'skipped' | 'failed';
    memoryId?: string;
    error?: string;
  }>;
  totals: Record<'created' | 'updated' | 'skipped' | 'failed', number>;
};

export type SharedMemoryImportRequest = {
  operationId: string;
  destination:
    | { type: 'library' }
    | { type: 'project'; projectId: string }
    | { type: 'personal'; agentId?: string };
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
};

export type PublishSharedMemoryRequest =
  | { source: { type: 'personal'; memoryId: string; agentId?: string }; replaceWithLink?: false }
  | { source: { type: 'project'; projectId: string; key: string }; replaceWithLink?: boolean };

export type PublishSharedMemoryResult = { sourceReplaced: boolean };

export type LegacyMemoryCandidate = {
  key: string;
  status: 'resolved' | 'ambiguous' | 'inaccessible' | 'missing';
  candidates: Array<{ memoryId: string; authorId: string }>;
};

export type SharedMemoryContextStatus = {
  linked: number;
  available: number;
  archived: number;
  missing: number;
  filtered: number;
  omittedByLimit: number;
};
