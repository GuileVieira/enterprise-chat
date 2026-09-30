import type { Document, Types } from 'mongoose';

export interface ISharedMemory extends Document {
  tenantId: string;
  key: string;
  value: string;
  tokenCount: number;
  status: 'active' | 'archived';
  authorId?: Types.ObjectId;
  version: number;
  importOperationId?: string;
  importRef?: string;
  lastImportOperationId?: string;
  lastImportRef?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ISharedMemoryImportOperation extends Document {
  tenantId: string;
  operationId: string;
  actorId: Types.ObjectId;
  payloadHash: string;
  result?: unknown;
  createdAt: Date;
  updatedAt: Date;
}

export interface ISharedMemoryLibraryState extends Document {
  tenantId: string;
  writeLock?: string;
}
