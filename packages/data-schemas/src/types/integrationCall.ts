export type IntegrationCallState = 'in_progress' | 'completed' | 'failed' | 'partial' | 'ambiguous';
export type IntegrationEffectState = 'not_dispatched' | 'dispatched' | 'completed' | 'unknown';
export interface IntegrationCallRecord {
  id: string;
  tenantId: string;
  principalId: string;
  key: string;
  digest: string;
  state: IntegrationCallState;
  effect: IntegrationEffectState;
  dispatchedAt?: Date;
  resultJson?: string;
  resultAvailableUntil: Date;
  leaseUntil: Date;
  createdAt?: Date;
  updatedAt?: Date;
}
export interface IntegrationCallScope {
  tenantId: string;
  principalId: string;
  key: string;
}
