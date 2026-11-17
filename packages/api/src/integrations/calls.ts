import { createHash, randomUUID } from 'crypto';
import type {
  IntegrationCallMethods,
  IntegrationCallState,
  IntegrationEffectState,
} from '@librechat/data-schemas';
import { IntegrationError } from './contracts';

export interface IntegrationToolOutcome {
  status: Exclude<IntegrationCallState, 'in_progress'>;
  effect: IntegrationEffectState;
  data?: unknown;
  error?: { code: string; message: string };
  knownIds?: { [kind: string]: string[] };
}
export interface IntegrationCallResult extends IntegrationToolOutcome {
  callId?: string;
  replayed?: boolean;
  resultExpired?: boolean;
}
function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value) ?? 'null';
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonical).join(',')}]`;
  }
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonical((value as { [key: string]: unknown })[key])}`)
    .join(',')}}`;
}
export function integrationCallDigest(envelope: object): string {
  return createHash('sha256').update(canonical(envelope)).digest('hex');
}

/** A key is never released, even after a crash or expired result. */
export async function executeIntegrationWrite(options: {
  store: IntegrationCallMethods;
  tenantId: string;
  principalId: string;
  key?: string;
  envelope: object;
  execute: (beforeDispatch: () => Promise<void>) => Promise<IntegrationToolOutcome>;
  inspectResult: (value: IntegrationToolOutcome) => Promise<IntegrationToolOutcome>;
}): Promise<
  | IntegrationCallResult
  | { status: 'in_progress'; effect: IntegrationEffectState; callId: string; replayed: true }
> {
  if (!options.key || !/^[\x21-\x7e]{1,200}$/.test(options.key)) {
    throw new IntegrationError(
      400,
      'idempotency_key_required',
      'A valid Idempotency-Key is required',
    );
  }
  const { store, tenantId, principalId, key } = options;
  const scope = { tenantId, principalId, key };
  const digest = integrationCallDigest(options.envelope);
  let reservation;
  try {
    reservation = await store.reserveIntegrationCall({
      ...scope,
      digest,
      id: randomUUID(),
      state: 'in_progress',
      effect: 'not_dispatched',
      leaseUntil: new Date(Date.now() + 60000),
      resultAvailableUntil: new Date(Date.now() + 7 * 86400000),
    });
  } catch {
    throw new IntegrationError(503, 'idempotency_unavailable', 'Durable call storage unavailable');
  }
  const record = reservation.record;
  if (record.digest !== digest) {
    throw new IntegrationError(
      409,
      'idempotency_conflict',
      'Key already used for different arguments',
    );
  }
  if (!reservation.created) {
    if (record.resultJson && record.resultAvailableUntil > new Date()) {
      const replay = await options.inspectResult(
        JSON.parse(record.resultJson) as IntegrationToolOutcome,
      );
      return { ...replay, callId: record.id, replayed: true };
    }
    if (record.state === 'in_progress') {
      return { status: record.state, effect: record.effect, callId: record.id, replayed: true };
    }
    return {
      status: record.state,
      effect: record.effect,
      callId: record.id,
      replayed: true,
      resultExpired: true,
    };
  }
  let dispatched = false;
  let result: IntegrationToolOutcome;
  try {
    result = await options.execute(async () => {
      if (dispatched || !(await store.dispatchIntegrationCall(scope))) {
        throw new Error('Dispatch barrier unavailable');
      }
      dispatched = true;
    });
    if (!dispatched && result.effect !== 'not_dispatched') {
      throw new Error('Missing dispatch marker');
    }
    result = await options.inspectResult(result);
    if (Buffer.byteLength(JSON.stringify(result)) > 1048576) {
      throw new Error('Result exceeds limit');
    }
  } catch {
    result = {
      status: dispatched ? 'ambiguous' : 'failed',
      effect: dispatched ? 'unknown' : 'not_dispatched',
      error: {
        code: dispatched ? 'effect_unknown' : 'dispatch_failed',
        message: dispatched
          ? 'Execution outcome could not be confirmed'
          : 'Execution was not dispatched',
      },
    };
  }
  try {
    await store.finishIntegrationCall(scope, {
      state: result.status,
      effect: result.effect,
      resultJson: JSON.stringify(result),
    });
  } catch {
    // A committed dispatch marker survives even when the final response cannot be saved.
    return {
      status: dispatched ? 'ambiguous' : 'failed',
      effect: dispatched ? 'unknown' : 'not_dispatched',
      callId: record.id,
      knownIds: result.knownIds,
      data: result.data,
      error: {
        code: 'result_persistence_failed',
        message: 'Call result could not be persisted; retry only with the same key',
      },
    };
  }
  return { ...result, callId: record.id, replayed: false };
}
