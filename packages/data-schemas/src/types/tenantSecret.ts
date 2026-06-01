export interface ITenantSecret {
  tenantId: string;
  name: string;
  value: string;
  type: 'bearer' | 'basic' | 'api_key' | 'custom' | 'meta_access_token';
  createdAt: Date;
  updatedAt: Date;
}
