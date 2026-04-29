/**
 * @fileoverview Types for tenant-scoped functions (dynamic tools).
 */

export interface TenantFunctionAuth {
  type: 'bearer' | 'basic' | 'api_key' | 'custom';
  secretName: string;
  headerName?: string;
}

export interface TenantFunctionConfig {
  baseUrl: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  headers?: Record<string, string>;
  auth?: TenantFunctionAuth;
}

export interface TenantFunctionDefinition {
  name: string;
  description: string;
  parameters?: Record<string, unknown>;
}

export interface TenantFunctionInput {
  tenantId: string;
  id: string;
  name: string;
  description: string;
  type: 'http';
  config: TenantFunctionConfig;
  inputSchema: Record<string, unknown>;
  postProcess?: string;
  isActive: boolean;
}
