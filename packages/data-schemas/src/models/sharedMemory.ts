import type { Model } from 'mongoose';
import type {
  ISharedMemory,
  ISharedMemoryImportOperation,
  ISharedMemoryLibraryState,
} from '~/types/sharedMemory';
import { applyTenantIsolation } from '~/models/plugins/tenantIsolation';
import sharedMemorySchema, {
  SharedMemoryImportOperationSchema,
  SharedMemoryLibraryStateSchema,
} from '~/schema/sharedMemory';

export function createSharedMemoryModel(mongoose: typeof import('mongoose')): Model<ISharedMemory> {
  applyTenantIsolation(sharedMemorySchema);
  return (
    mongoose.models.SharedMemory ||
    mongoose.model<ISharedMemory>('SharedMemory', sharedMemorySchema)
  );
}

export function createSharedMemoryImportOperationModel(
  mongoose: typeof import('mongoose'),
): Model<ISharedMemoryImportOperation> {
  applyTenantIsolation(SharedMemoryImportOperationSchema);
  return (
    mongoose.models.SharedMemoryImportOperation ||
    mongoose.model<ISharedMemoryImportOperation>(
      'SharedMemoryImportOperation',
      SharedMemoryImportOperationSchema,
    )
  );
}

export function createSharedMemoryLibraryStateModel(
  mongoose: typeof import('mongoose'),
): Model<ISharedMemoryLibraryState> {
  applyTenantIsolation(SharedMemoryLibraryStateSchema);
  return (
    mongoose.models.SharedMemoryLibraryState ||
    mongoose.model<ISharedMemoryLibraryState>(
      'SharedMemoryLibraryState',
      SharedMemoryLibraryStateSchema,
    )
  );
}
