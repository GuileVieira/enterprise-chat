import type { Schema, Query, Aggregate } from 'mongoose';
import type { TenantDocument, TenantUpdate } from '~/tenant/policy';
import {
  tenantFilter,
  scopeReplacement,
  currentTenantScope,
  resolveTenantScope,
  stampTenantOnDocument,
  sanitizeTenantMutation,
  tenantWritePredicate,
  resetTenantStrictCache,
  warnOnInvalidStrictSetting,
} from '~/tenant/policy';

/**
 * Mongoose binding for the engine-neutral tenant-isolation policy.
 *
 * Every rule enforced here is defined in `~/tenant/policy`; this module only
 * adapts Mongoose's middleware surface to it, so a second storage engine can
 * reuse the same decisions without reimplementing them.
 */

/** Resets the cached strict-mode flag. Exposed for test teardown only. */
export function _resetStrictCache(): void {
  resetTenantStrictCache();
}

warnOnInvalidStrictSetting();

const TENANT_ISOLATION_APPLIED = Symbol.for('librechat:tenantIsolation');

interface TenantWhereDocument {
  $where?: Record<string, unknown>;
}

interface TenantSaveDocument extends TenantWhereDocument {
  get(path: string): unknown;
  set(path: string, value: unknown): void;
  unmarkModified(path: string): void;
}

interface TenantWhereState {
  readonly injectedTenantPredicate: unknown;
  readonly hadTenantId: boolean;
  readonly tenantId: unknown;
}

const tenantWhereStates = new WeakMap<TenantWhereDocument, TenantWhereState>();

interface TenantStampState {
  readonly injectedTenantId: string;
  readonly tenantId: unknown;
}

const tenantStampStates = new WeakMap<TenantSaveDocument, TenantStampState>();

/** Restores the document's own `$where.tenantId` before deriving the next save predicate. */
function restoreTenantWhere(document: TenantWhereDocument): void {
  const state = tenantWhereStates.get(document);
  const where = document.$where;
  tenantWhereStates.delete(document);
  if (!state || !where || where.tenantId !== state.injectedTenantPredicate) {
    return;
  }

  if (state.hadTenantId) {
    where.tenantId = state.tenantId;
    return;
  }

  const { tenantId: _tenantId, ...rest } = where;
  document.$where = Object.keys(rest).length > 0 ? rest : undefined;
}

function applyTenantWhere(document: TenantWhereDocument, tenantPredicate: unknown): void {
  const where = document.$where;
  tenantWhereStates.set(document, {
    injectedTenantPredicate: tenantPredicate,
    hadTenantId: where != null && Object.prototype.hasOwnProperty.call(where, 'tenantId'),
    tenantId: where?.tenantId,
  });
  document.$where = { ...where, tenantId: tenantPredicate };
}

/** Rolls back a plugin-owned tenant stamp when the corresponding save fails. */
function restoreTenantStamp(document: TenantSaveDocument): void {
  const state = tenantStampStates.get(document);
  tenantStampStates.delete(document);
  if (!state || document.get('tenantId') !== state.injectedTenantId) {
    return;
  }
  document.set('tenantId', state.tenantId);
  document.unmarkModified('tenantId');
}

/**
 * Mongoose schema plugin that enforces tenant-level data isolation.
 *
 * - `tenantId` present in async context -> injected into every query filter.
 * - `tenantId` is `SYSTEM_TENANT_ID` -> skips injection (explicit cross-tenant op).
 * - `tenantId` absent + `TENANT_ISOLATION_STRICT=true` -> throws (fail-closed).
 * - `tenantId` absent + strict mode off -> passes through (transitional/pre-tenancy).
 * - Update and replace operations that modify `tenantId` are blocked unless running as system.
 */
export function applyTenantIsolation(
  schema: Schema,
  options: { includeGlobalDocuments?: boolean } = {},
): void {
  const s = schema as Schema & { [key: symbol]: boolean };
  if (s[TENANT_ISOLATION_APPLIED]) {
    return;
  }
  s[TENANT_ISOLATION_APPLIED] = true;

  const readMiddleware = function (this: Query<unknown, unknown>) {
    const scope = resolveTenantScope('Query');
    const filter =
      options.includeGlobalDocuments && scope.kind === 'scoped'
        ? {
            $or: [
              { tenantId: scope.tenantId },
              { tenantId: { $exists: false } },
              { tenantId: null },
            ],
          }
        : tenantFilter(scope);
    if (!filter) {
      return;
    }
    if (options.includeGlobalDocuments && scope.kind === 'scoped') {
      this.setQuery({ $and: [this.getFilter(), filter] });
      return;
    }
    this.where(filter);
  };

  const writeMiddleware = function (this: Query<unknown, unknown>) {
    const filter = tenantFilter(resolveTenantScope('Query'));
    if (filter) {
      this.where(filter);
    }
  };

  const updateGuard = function (this: Query<unknown, unknown>) {
    const scope = currentTenantScope();
    if (scope.kind === 'system') {
      return;
    }

    const result = sanitizeTenantMutation(scope, this.getUpdate() as TenantUpdate | null, 'guard');
    if (result.changed) {
      this.setUpdate(result.update);
    }

    if (result.emptied) {
      this.where({ _id: { $in: [] } });
      this.setOptions({ upsert: false });
    }
  };

  const replaceGuard = function (this: Query<unknown, unknown>) {
    const scope = currentTenantScope();
    if (scope.kind === 'system') {
      return;
    }

    const result = scopeReplacement(scope, this.getUpdate() as TenantDocument | null);
    if (result.changed && result.replacement) {
      this.setUpdate(result.replacement);
    }
  };

  schema.pre('find', readMiddleware);
  schema.pre('findOne', readMiddleware);
  schema.pre('distinct', readMiddleware);
  schema.pre('countDocuments', readMiddleware);
  schema.pre('findOneAndUpdate', writeMiddleware);
  schema.pre('findOneAndDelete', writeMiddleware);
  schema.pre('findOneAndReplace', writeMiddleware);
  schema.pre('updateOne', writeMiddleware);
  schema.pre('updateMany', writeMiddleware);
  schema.pre('deleteOne', writeMiddleware);
  schema.pre('deleteMany', writeMiddleware);
  schema.pre('replaceOne', writeMiddleware);

  schema.pre('findOneAndUpdate', updateGuard);
  schema.pre('updateOne', updateGuard);
  schema.pre('updateMany', updateGuard);

  schema.pre('replaceOne', replaceGuard);
  schema.pre('findOneAndReplace', replaceGuard);

  schema.pre('aggregate', function (this: Aggregate<unknown>) {
    const scope = resolveTenantScope('Aggregate');
    const filter =
      options.includeGlobalDocuments && scope.kind === 'scoped'
        ? {
            $or: [
              { tenantId: scope.tenantId },
              { tenantId: { $exists: false } },
              { tenantId: null },
            ],
          }
        : tenantFilter(scope);
    if (filter) {
      this.pipeline().unshift({ $match: filter });
    }
  });

  schema.pre('save', function () {
    const scope = resolveTenantScope('Save');
    const document = this as unknown as TenantSaveDocument;
    restoreTenantWhere(document);
    const isNew = this.isNew;
    const tenantId = this.get('tenantId');
    const tenantPredicate = isNew
      ? undefined
      : tenantWritePredicate(scope, this.isModified('tenantId'), tenantId);
    let predicate: { tenantId: string | { $in: [string, null, ''] } } | undefined = tenantPredicate;
    if (isNew) {
      predicate = undefined;
    } else if (options.includeGlobalDocuments && scope.kind === 'scoped') {
      predicate = { tenantId: scope.tenantId };
    }
    stampTenantOnDocument(scope, this as unknown as TenantDocument);

    if (isNew) {
      return;
    }

    if (scope.kind === 'scoped' && !tenantId) {
      tenantStampStates.set(document, { injectedTenantId: scope.tenantId, tenantId });
    }

    /**
     * `save()` on a persisted document is filtered on `_id` alone, so the
     * stamped tenant above is never asserted. `$where` is Mongoose's public
     * hook for adding conditions to that query — its own sharding plugin uses
     * it the same way. A mismatch surfaces as `DocumentNotFoundError`.
     */
    if (predicate) {
      applyTenantWhere(document, predicate.tenantId);
    }
  });

  schema.post('save', function () {
    tenantStampStates.delete(this as unknown as TenantSaveDocument);
  });

  schema.post('save', { errorHandler: true }, function (error: Error, _document, next): void {
    restoreTenantStamp(this as unknown as TenantSaveDocument);
    next(error);
  });

  schema.pre('insertMany', function (next, docs) {
    try {
      const scope = resolveTenantScope('insertMany');
      if (Array.isArray(docs)) {
        for (const doc of docs) {
          stampTenantOnDocument(scope, doc as TenantDocument);
        }
      }
    } catch (error) {
      return next(error as Error);
    }
    next();
  });
}
