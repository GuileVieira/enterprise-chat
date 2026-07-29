export interface ITenantFunction {
  id: string;
  tenantId: string;
  name: string;
  description: string;
  details?: string;
  type: 'http';
  config: {
    baseUrl: string;
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    path: string;
    headers?: Record<string, string>;
    auth?: {
      type: 'bearer' | 'basic' | 'api_key' | 'custom';
      secretName: string;
      headerName?: string;
    };
  };
  inputSchema: Record<string, unknown>;
  postProcess?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
