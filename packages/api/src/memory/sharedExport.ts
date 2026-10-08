import mongoose from 'mongoose';
import type {
  IMemoryEntryLean,
  IProject,
  IProjectMemory,
  ISharedMemory,
} from '@librechat/data-schemas';
import type { FiltersConfig } from 'librechat-data-provider';
import type { Response } from 'express';
import type { ProjectedStoredMemory } from './protection';
import type { ServerRequest } from '~/types/http';
import { escapeMemoryCsvCell, isScalarString } from './shared';

type SharedMemoryExportScope = 'library' | 'project' | 'personal';

interface SharedMemoryExportQuery {
  scope?: unknown;
  ids?: unknown;
  projectId?: unknown;
  agentId?: unknown;
  search?: unknown;
  status?: unknown;
  format?: unknown;
}

export type SharedMemoryExportRequest = ServerRequest & {
  user: NonNullable<ServerRequest['user']> & { tenantId: string };
  query: SharedMemoryExportQuery;
  params: { projectId?: string };
};

interface ProjectRecord extends Pick<IProject, 'memories'> {
  _id: mongoose.Types.ObjectId;
}

interface PersonalMemoryRecord extends IMemoryEntryLean {
  tenantId: string;
}

interface SharedMemoryRecord extends Pick<ISharedMemory, 'key' | 'value'> {
  _id: mongoose.Types.ObjectId;
  tenantId: string;
}

type ExportMemoryRecord = Pick<IProjectMemory, 'key' | 'value'>;

type ProjectStoredMemories = <T extends ExportMemoryRecord>(
  items: readonly T[],
  filters?: FiltersConfig,
) => ProjectedStoredMemory<T>[];

export interface SharedMemoryExportDependencies {
  projectFor(req: SharedMemoryExportRequest, permission: number): Promise<ProjectRecord | null>;
  hasRolePermissions(
    req: SharedMemoryExportRequest,
    type: string,
    required: readonly string[],
  ): Promise<boolean>;
  projectViewPermission: number;
  memoryPermissionType: string;
  memoryUsePermission: string;
  memoryReadPermission: string;
  projectStoredMemories: ProjectStoredMemories;
}

function isExportScope(value: unknown): value is SharedMemoryExportScope {
  return value === 'library' || value === 'project' || value === 'personal';
}

function isObjectId(value: unknown): value is string {
  return isScalarString(value, 24) && mongoose.isObjectIdOrHexString(value);
}

function invalidFilters(
  scope: SharedMemoryExportScope,
  query: SharedMemoryExportQuery,
  ids: string[],
): boolean {
  return (
    (scope === 'project' && !isScalarString(query.projectId, 256)) ||
    (scope === 'personal' && query.agentId != null && !isScalarString(query.agentId)) ||
    (scope !== 'project' && ids.some((id) => !isObjectId(id)))
  );
}

function searchPattern(value: unknown): string {
  return typeof value === 'string' && value.length <= 256
    ? value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    : '';
}

function csv(items: readonly ExportMemoryRecord[]): string {
  return `key,value\n${items
    .map((item) => `${escapeMemoryCsvCell(item.key)},${escapeMemoryCsvCell(item.value)}`)
    .join('\n')}`;
}

export function createSharedMemoryExportHandler(
  deps: SharedMemoryExportDependencies,
): (req: SharedMemoryExportRequest, res: Response) => Promise<void> {
  return async function sharedMemoryExportHandler(
    req: SharedMemoryExportRequest,
    res: Response,
  ): Promise<void> {
    const scope = req.query.scope;
    if (!isExportScope(scope)) {
      res.status(400).json({ error: 'Invalid export scope.' });
      return;
    }
    if (
      Object.keys(req.query).some(
        (key) =>
          !['scope', 'ids', 'projectId', 'agentId', 'search', 'status', 'format'].includes(key),
      ) ||
      (req.query.ids != null && typeof req.query.ids !== 'string') ||
      (req.query.search != null &&
        (typeof req.query.search !== 'string' || req.query.search.length > 256)) ||
      (req.query.format != null &&
        (typeof req.query.format !== 'string' || !['json', 'csv'].includes(req.query.format))) ||
      (req.query.status != null &&
        (typeof req.query.status !== 'string' ||
          !['active', 'archived'].includes(req.query.status)))
    ) {
      res.status(400).json({ error: 'Invalid export filters.' });
      return;
    }

    const ids = String(req.query.ids || '')
      .split(',')
      .filter(Boolean);
    if (invalidFilters(scope, req.query, ids)) {
      res.status(400).json({ error: 'Invalid export filters.' });
      return;
    }

    const pattern = searchPattern(req.query.search);
    const search = pattern ? { $regex: pattern, $options: 'i' } : undefined;
    let items: ExportMemoryRecord[];

    if (scope === 'personal') {
      const allowed = await deps.hasRolePermissions(req, deps.memoryPermissionType, [
        deps.memoryUsePermission,
        deps.memoryReadPermission,
      ]);
      if (!allowed) {
        res.status(403).json({ error: 'Memory read permission required.' });
        return;
      }
      const filter = {
        tenantId: req.user.tenantId,
        userId: req.user.id,
        agentId: req.query.agentId || null,
        ...(ids.length ? { _id: { $in: ids } } : {}),
        ...(search ? { $or: [{ key: search }, { value: search }] } : {}),
      };
      items = await mongoose.models.MemoryEntry.find(filter)
        .sort({ key: 1 })
        .lean<PersonalMemoryRecord[]>();
    } else if (scope === 'project') {
      req.params.projectId = req.query.projectId as string;
      const project = await deps.projectFor(req, deps.projectViewPermission);
      if (!project) {
        res.status(403).json({ error: 'Project view permission required.' });
        return;
      }
      const searchRegex = pattern ? new RegExp(pattern, 'i') : null;
      items = (project.memories || []).filter(
        (item) =>
          (!ids.length || ids.includes(item.key)) &&
          (!searchRegex || searchRegex.test(item.key) || searchRegex.test(item.value)),
      );
    } else {
      const filter = {
        tenantId: req.user.tenantId,
        status: req.query.status === 'archived' ? 'archived' : 'active',
        ...(ids.length ? { _id: { $in: ids } } : {}),
        ...(search ? { $or: [{ key: search }, { value: search }] } : {}),
      };
      items = await mongoose.models.SharedMemory.find(filter)
        .sort({ key: 1 })
        .lean<SharedMemoryRecord[]>();
    }

    const projected = deps.projectStoredMemories(items, req.config?.filters);
    if (projected.some((item) => item.contentFilterBlocked)) {
      res.status(403).json({ error: 'One or more memories are blocked by content policy.' });
      return;
    }

    if (req.query.format === 'csv') {
      res.type('text/csv; charset=utf-8').send(csv(projected));
      return;
    }
    res.json({
      format: 'orqest-memories',
      version: 1,
      items: projected.map((item, index) => ({
        ref: `m${index + 1}`,
        key: item.key,
        value: item.value,
      })),
    });
  };
}
