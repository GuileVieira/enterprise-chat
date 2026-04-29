import { Schema } from 'mongoose';
import type { ITenantSecret } from '~/types';

const tenantSecretSchema = new Schema<ITenantSecret>(
  {
    tenantId: {
      type: String,
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
    },
    value: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ['bearer', 'basic', 'api_key', 'custom'],
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

tenantSecretSchema.index({ tenantId: 1, name: 1 }, { unique: true });

export default tenantSecretSchema;
