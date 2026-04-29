export interface ITenantSecret {
  tenantId: string;
  name: string;
  value: string;
  type: 'bearer' | 'basic' | 'api_key' | 'custom';
  createdAt: Date;
  updatedAt: Date;
}
