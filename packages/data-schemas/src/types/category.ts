import type { Document } from 'mongoose';

export type ICategory = Document & {
  label: string;
  value: string;
  icon?: string;
  order: number;
  isDefault: boolean;
  tenantId?: string;
  createdAt?: Date;
  updatedAt?: Date;
};
