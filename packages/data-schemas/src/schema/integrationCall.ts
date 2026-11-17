import { Schema } from 'mongoose';
import type { IntegrationCallRecord } from '~/types/integrationCall';

const integrationCallSchema: Schema<IntegrationCallRecord> = new Schema<IntegrationCallRecord>(
  {
    id: { type: String, required: true, immutable: true },
    tenantId: { type: String, required: true, immutable: true },
    principalId: { type: String, required: true, immutable: true },
    key: { type: String, required: true, immutable: true },
    digest: { type: String, required: true, immutable: true },
    state: {
      type: String,
      required: true,
      enum: ['in_progress', 'completed', 'failed', 'partial', 'ambiguous'],
    },
    effect: {
      type: String,
      required: true,
      enum: ['not_dispatched', 'dispatched', 'completed', 'unknown'],
    },
    dispatchedAt: Date,
    resultJson: String,
    resultAvailableUntil: { type: Date, required: true },
    leaseUntil: { type: Date, required: true },
  },
  { timestamps: true },
);
// Keys remain as permanent tombstones; expiring results must never permit redispatch.
integrationCallSchema.index(
  { tenantId: 1, principalId: 1, key: 1 },
  { unique: true, name: 'integration_idempotency' },
);
export default integrationCallSchema;
