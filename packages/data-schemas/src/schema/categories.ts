import { Schema } from 'mongoose';
import type { ICategory } from '~/types';

const categoriesSchema = new Schema<ICategory>(
  {
    label: {
      type: String,
      required: true,
      trim: true,
    },
    value: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    icon: {
      type: String,
      trim: true,
    },
    order: {
      type: Number,
      default: 0,
      index: true,
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
    tenantId: {
      type: String,
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

categoriesSchema.index({ label: 1, tenantId: 1 }, { unique: true });
categoriesSchema.index({ value: 1, tenantId: 1 }, { unique: true });
categoriesSchema.index({ order: 1, label: 1 });

export default categoriesSchema;
