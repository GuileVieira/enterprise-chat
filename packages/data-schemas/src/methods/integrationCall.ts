import type { Model } from 'mongoose';
import type { IntegrationCallRecord, IntegrationCallScope } from '~/types/integrationCall';
import { getTenantId } from '~/config/tenantContext';

export interface IntegrationCallMethods {
  integrationCallStorageReady(): Promise<boolean>;
  reserveIntegrationCall(
    record: IntegrationCallRecord,
  ): Promise<{ created: boolean; record: IntegrationCallRecord }>;
  dispatchIntegrationCall(scope: IntegrationCallScope): Promise<boolean>;
  finishIntegrationCall(
    scope: IntegrationCallScope,
    update: Pick<IntegrationCallRecord, 'state' | 'effect' | 'resultJson'>,
  ): Promise<void>;
}
export function createIntegrationCallMethods(
  mongoose: typeof import('mongoose'),
): IntegrationCallMethods {
  const model = () => mongoose.models.IntegrationCall as Model<IntegrationCallRecord>;
  const scope = (value: IntegrationCallScope): IntegrationCallScope => {
    if (!value.tenantId || getTenantId() !== value.tenantId || !value.principalId || !value.key) {
      throw new Error('Integration call tenant scope unavailable');
    }
    return { tenantId: value.tenantId, principalId: value.principalId, key: value.key };
  };
  async function integrationCallStorageReady(): Promise<boolean> {
    const indexes = await model().listIndexes();
    return indexes.some(
      (index) =>
        index.unique === true &&
        index.key?.tenantId === 1 &&
        index.key?.principalId === 1 &&
        index.key?.key === 1 &&
        Object.keys(index.key).length === 3 &&
        !index.partialFilterExpression &&
        !index.sparse,
    );
  }
  async function reserveIntegrationCall(
    record: IntegrationCallRecord,
  ): Promise<{ created: boolean; record: IntegrationCallRecord }> {
    const filter = scope(record);
    if (!(await integrationCallStorageReady())) {
      throw new Error('Integration call unique index unavailable');
    }
    try {
      const created = await model().create([record], { writeConcern: { w: 'majority', j: true } });
      return { created: true, record: created[0].toObject() };
    } catch (error) {
      if (!(error instanceof Error) || !('code' in error) || error.code !== 11000) {
        throw error;
      }
      const existing = await model().findOne(filter).lean();
      if (!existing) {
        throw new Error('Integration call reservation unavailable');
      }
      if (existing.state === 'in_progress' && existing.leaseUntil <= new Date()) {
        const ambiguous = await model()
          .findOneAndUpdate(
            { ...filter, state: 'in_progress', leaseUntil: { $lte: new Date() } },
            {
              $set: {
                state: 'ambiguous',
                effect: existing.dispatchedAt ? 'unknown' : 'not_dispatched',
              },
            },
            { new: true, writeConcern: { w: 'majority', j: true } },
          )
          .lean();
        return { created: false, record: ambiguous ?? existing };
      }
      return { created: false, record: existing };
    }
  }
  async function dispatchIntegrationCall(value: IntegrationCallScope): Promise<boolean> {
    if (!(await integrationCallStorageReady())) {
      throw new Error('Integration call unique index unavailable');
    }
    const updated = await model()
      .findOneAndUpdate(
        {
          ...scope(value),
          state: 'in_progress',
          effect: 'not_dispatched',
          leaseUntil: { $gt: new Date() },
        },
        { $set: { effect: 'dispatched', dispatchedAt: new Date() } },
        { new: true, writeConcern: { w: 'majority', j: true } },
      )
      .lean();
    return updated !== null;
  }
  async function finishIntegrationCall(
    value: IntegrationCallScope,
    update: Pick<IntegrationCallRecord, 'state' | 'effect' | 'resultJson'>,
  ): Promise<void> {
    const result = await model().updateOne(
      { ...scope(value), state: { $in: ['in_progress', 'ambiguous'] } },
      { $set: update },
      { writeConcern: { w: 'majority', j: true } },
    );
    if (result.matchedCount !== 1) {
      throw new Error('Integration call result could not be persisted');
    }
  }
  return {
    integrationCallStorageReady,
    reserveIntegrationCall,
    dispatchIntegrationCall,
    finishIntegrationCall,
  };
}
