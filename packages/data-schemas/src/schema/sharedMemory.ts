import { Schema } from 'mongoose';
import type {
  ISharedMemory,
  ISharedMemoryImportOperation,
  ISharedMemoryLibraryState,
} from '~/types/sharedMemory';

const SharedMemorySchema: Schema<ISharedMemory> = new Schema<ISharedMemory>(
  {
    tenantId: { type: String, required: true, index: true },
    key: { type: String, required: true, match: /^[a-z_]+$/ },
    value: { type: String, required: true },
    tokenCount: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ['active', 'archived'], default: 'active', index: true },
    authorId: { type: Schema.Types.ObjectId, required: false, ref: 'User' },
    version: { type: Number, default: 1, min: 1 },
    importOperationId: String,
    importRef: String,
    lastImportOperationId: String,
    lastImportRef: String,
  },
  { timestamps: true },
);

SharedMemorySchema.index(
  { tenantId: 1, key: 1 },
  { unique: true, partialFilterExpression: { status: 'active' } },
);
SharedMemorySchema.index(
  { tenantId: 1, importOperationId: 1, importRef: 1 },
  { unique: true, partialFilterExpression: { importOperationId: { $type: 'string' } } },
);

export default SharedMemorySchema;

export const SharedMemoryImportOperationSchema: Schema<ISharedMemoryImportOperation> =
  new Schema<ISharedMemoryImportOperation>(
    {
      tenantId: { type: String, required: true, index: true },
      operationId: { type: String, required: true },
      actorId: { type: Schema.Types.ObjectId, required: true },
      payloadHash: { type: String, required: true },
      result: Schema.Types.Mixed,
    },
    { timestamps: true },
  );
SharedMemoryImportOperationSchema.index({ tenantId: 1, operationId: 1 }, { unique: true });

export const SharedMemoryLibraryStateSchema: Schema<ISharedMemoryLibraryState> =
  new Schema<ISharedMemoryLibraryState>({
    tenantId: { type: String, required: true, unique: true },
    writeLock: String,
  });
