import { logger, redactMessage, getRequestId } from '@librechat/data-schemas';
import type { Request, Response, NextFunction } from 'express';

type ProjectDomain = 'projects' | 'projectMeetings' | 'projectMetaAds';
interface ProjectLogRequest extends Request {
  user?: { id?: string; tenantId?: string };
}
interface DiagnosticError {
  name?: string;
  message?: string;
  stack?: string;
  code?: string | number;
  cause?: unknown;
  details?: string[];
  statusCode?: number;
  response?: { status?: number };
  data?: { code?: number; error_subcode?: number; fbtrace_id?: string };
}

function safeText(value: string, limit: number): string {
  const safe = redactMessage(value)
    .replace(/\bEAA[\w-]{40,}/g, '[REDACTED]')
    .replace(/https?:\/\/[^\s)]+/gi, '[URL]')
    .replace(/[\r\n]/g, '\\n');
  return safe.length > limit ? `${safe.slice(0, limit)} [truncated]` : safe;
}

function errorContext(error: unknown, seen = new Set<object>(), depth = 0): object {
  if (!error || typeof error !== 'object') {
    return { name: 'NonErrorRejection', message: safeText(String(error), 1024) };
  }
  if (seen.has(error) || depth >= 3) {
    return { truncated: true };
  }
  seen.add(error);
  const value = error as DiagnosticError;
  const providerStatus = value.statusCode ?? value.response?.status;
  let code: string | number | undefined;
  if (typeof value.code === 'string') {
    code = safeText(value.code, 100);
  } else if (typeof value.code === 'number' && Number.isFinite(value.code)) {
    code = value.code;
  }
  return {
    name: typeof value.name === 'string' ? safeText(value.name, 100) : 'Error',
    message: typeof value.message === 'string' ? safeText(value.message, 1024) : undefined,
    stack: typeof value.stack === 'string' ? safeText(value.stack, 4096) : undefined,
    code,
    validationFields: Array.isArray(value.details)
      ? value.details
          .filter((field): field is string => typeof field === 'string')
          .slice(0, 20)
          .map((field) => safeText(field, 100))
      : undefined,
    providerStatus:
      typeof providerStatus === 'number' && Number.isFinite(providerStatus)
        ? providerStatus
        : undefined,
    providerCode: Number.isFinite(value.data?.code) ? value.data?.code : undefined,
    providerSubcode: Number.isFinite(value.data?.error_subcode)
      ? value.data?.error_subcode
      : undefined,
    providerTrace:
      typeof value.data?.fbtrace_id === 'string' ? safeText(value.data.fbtrace_id, 200) : undefined,
    cause: value.cause === undefined ? undefined : errorContext(value.cause, seen, depth + 1),
  };
}

function requestContext(req: ProjectLogRequest) {
  return {
    requestId: getRequestId(),
    tenantId: req.user?.tenantId,
    userId: req.user?.id,
    projectId:
      typeof req.params.projectId === 'string' ? safeText(req.params.projectId, 100) : undefined,
    meetingId:
      typeof req.params.meetingId === 'string' ? safeText(req.params.meetingId, 100) : undefined,
    operation: `${req.method} ${typeof req.route?.path === 'string' ? req.route.path : '/'}`,
  };
}

export function logProjectFailure(
  req: ProjectLogRequest,
  message: string,
  error: unknown,
  level: 'error' | 'warn' = 'error',
): void {
  try {
    logger[level](message, {
      ...requestContext(req),
      event_name: 'project.operation.error',
      outcome: level === 'warn' ? 'degraded' : 'failed',
      error: errorContext(error),
    });
  } catch {
    // Diagnostic failures must not interrupt a project operation or its recovery.
  }
}

export function projectRequestLogging(domain: ProjectDomain) {
  return (req: ProjectLogRequest, res: Response, next: NextFunction): void => {
    const startedAt = Date.now();
    let recorded = false;
    const complete = (aborted: boolean) => {
      if (recorded) {
        return;
      }
      recorded = true;
      const statusCode = res.statusCode;
      let outcome = 'succeeded';
      let level: 'error' | 'warn' | 'debug' | 'info' = 'info';
      if (statusCode === 202) {
        outcome = 'accepted';
      }
      if (req.method === 'GET' || req.route?.path === '/:meetingId/chunks/:index') {
        level = 'debug';
      }
      if (statusCode >= 400) {
        level = 'warn';
        outcome = 'failed';
      }
      if (aborted || statusCode >= 500) {
        level = 'error';
      }
      if (aborted) {
        outcome = 'unknown';
      }
      try {
        logger[level](`[${domain}] request finished`, {
          ...requestContext(req),
          event_name: 'project.operation.finished',
          outcome,
          statusCode,
          durationMs: Date.now() - startedAt,
        });
      } catch {
        // A failed telemetry sink must not change the HTTP result.
      }
    };
    res.once('finish', () => complete(false));
    res.once('close', () => complete(!res.writableFinished));
    next();
  };
}
