import type { FilterQuery, Model } from 'mongoose';
import type { ITenantFunction } from '~/types';

export function createTenantFunctionMethods(mongoose: typeof import('mongoose')) {
  /**
   * Creates a new tenant function.
   */
  async function createTenantFunction(data: Omit<ITenantFunction, 'createdAt' | 'updatedAt'>): Promise<ITenantFunction> {
    const TenantFunction = mongoose.models.TenantFunction as Model<ITenantFunction>;
    const doc = new TenantFunction(data);
    return (await doc.save()).toObject() as ITenantFunction;
  }

  /**
   * Retrieves all tenant functions matching the search parameters.
   */
  async function getTenantFunctions(
    searchParams: FilterQuery<ITenantFunction>,
  ): Promise<ITenantFunction[]> {
    const TenantFunction = mongoose.models.TenantFunction as Model<ITenantFunction>;
    return (await TenantFunction.find(searchParams).lean()) as ITenantFunction[];
  }

  /**
   * Retrieves a single tenant function by tenantId and id.
   */
  async function getTenantFunctionById(
    tenantId: string,
    id: string,
  ): Promise<ITenantFunction | null> {
    const TenantFunction = mongoose.models.TenantFunction as Model<ITenantFunction>;
    return (await TenantFunction.findOne({ tenantId, id }).lean()) as ITenantFunction | null;
  }

  /**
   * Updates a tenant function by tenantId and id.
   */
  async function updateTenantFunction(
    tenantId: string,
    id: string,
    updates: Partial<ITenantFunction>,
  ): Promise<ITenantFunction | null> {
    const TenantFunction = mongoose.models.TenantFunction as Model<ITenantFunction>;
    return (await TenantFunction.findOneAndUpdate(
      { tenantId, id },
      updates,
      { new: true },
    ).lean()) as ITenantFunction | null;
  }

  /**
   * Toggles the active state of a tenant function.
   */
  async function toggleTenantFunction(
    tenantId: string,
    id: string,
    isActive: boolean,
  ): Promise<ITenantFunction | null> {
    return updateTenantFunction(tenantId, id, { isActive });
  }

  /**
   * Deletes a tenant function by tenantId and id.
   */
  async function deleteTenantFunction(tenantId: string, id: string): Promise<ITenantFunction | null> {
    const TenantFunction = mongoose.models.TenantFunction as Model<ITenantFunction>;
    return (await TenantFunction.findOneAndDelete({ tenantId, id }).lean()) as ITenantFunction | null;
  }

  return {
    createTenantFunction,
    getTenantFunctions,
    getTenantFunctionById,
    updateTenantFunction,
    toggleTenantFunction,
    deleteTenantFunction,
  };
}

export type TenantFunctionMethods = ReturnType<typeof createTenantFunctionMethods>;
