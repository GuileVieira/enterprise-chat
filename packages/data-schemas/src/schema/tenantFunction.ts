import { Schema } from 'mongoose';
import type { ITenantFunction } from '~/types';

const tenantFunctionSchema = new Schema<ITenantFunction>(
  {
    id: {
      type: String,
      required: true,
    },
    tenantId: {
      type: String,
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    details: {
      type: String,
    },
    type: {
      type: String,
      enum: ['http'],
      default: 'http',
      required: true,
    },
    config: {
      baseUrl: { type: String, required: true },
      method: {
        type: String,
        enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
        required: true,
      },
      path: { type: String, required: true },
      headers: { type: Schema.Types.Mixed, default: undefined },
      auth: {
        type: {
          type: { type: String, enum: ['bearer', 'basic', 'api_key', 'custom'], required: true },
          secretName: { type: String, required: true },
          headerName: { type: String },
        },
        _id: false,
      },
      _id: false,
    },
    inputSchema: {
      type: Schema.Types.Mixed,
      required: true,
    },
    postProcess: {
      type: String,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  },
);

tenantFunctionSchema.index({ tenantId: 1, id: 1 }, { unique: true });
tenantFunctionSchema.index({ tenantId: 1, isActive: 1 });

export default tenantFunctionSchema;
