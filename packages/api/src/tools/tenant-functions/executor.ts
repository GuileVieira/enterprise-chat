/**
 * @fileoverview Executor for tenant-scoped HTTP functions.
 */

import axios from 'axios';
import type { TenantSecretMethods } from '@librechat/data-schemas';
import { runSafeFunction } from './safe-function';
import type { TenantFunctionInput } from './types';

export interface TenantFunctionExecutorDeps {
  getTenantSecret: TenantSecretMethods['getTenantSecret'];
}

export interface TenantFunctionSuccessResponse {
  ok: true;
  status: number;
  data: unknown;
}

export interface TenantFunctionErrorResponse {
  ok: false;
  status?: number;
  error: {
    message: string;
    data?: unknown;
  };
}

export type TenantFunctionResponse = TenantFunctionSuccessResponse | TenantFunctionErrorResponse;

/**
 * Extracts path parameters from a URL template.
 */
function extractPathParams(path: string): string[] {
  const params: string[] = [];
  const regex = /\{(\w+)\}/g;
  let match;
  while ((match = regex.exec(path)) !== null) {
    params.push(match[1]);
  }
  return params;
}

/**
 * Builds the full URL by substituting path parameters.
 */
function buildUrl(baseUrl: string, path: string, args: Record<string, unknown>): string {
  let url = baseUrl + path;
  const pathParams = extractPathParams(path);

  for (const param of pathParams) {
    const value = args[param];
    if (value === undefined || value === null) {
      throw new Error(`Missing required path parameter: ${param}`);
    }
    url = url.replace(`{${param}}`, encodeURIComponent(String(value)));
  }

  return url;
}

/**
 * Builds request parameters from args, excluding path params.
 */
function buildRequestParams(path: string, args: Record<string, unknown>): Record<string, unknown> {
  const pathParams = new Set(extractPathParams(path));
  const params: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(args)) {
    if (!pathParams.has(key) && value !== undefined && value !== null) {
      params[key] = value;
    }
  }

  return params;
}

/**
 * Builds request headers, injecting auth if configured.
 */
async function buildHeaders(
  config: TenantFunctionInput['config'],
  deps: TenantFunctionExecutorDeps,
  tenantId: string,
): Promise<Record<string, string>> {
  const headers: Record<string, string> = {};

  if (config.headers) {
    Object.assign(headers, config.headers);
  }

  if (config.auth) {
    const secret = await deps.getTenantSecret(tenantId, config.auth.secretName);
    if (!secret) {
      throw new Error('Configured secret not found');
    }

    switch (config.auth.type) {
      case 'bearer':
        headers.Authorization = `Bearer ${secret.value}`;
        break;
      case 'basic': {
        const encoded = Buffer.from(secret.value).toString('base64');
        headers.Authorization = `Basic ${encoded}`;
        break;
      }
      case 'api_key':
        headers[config.auth.headerName || 'X-API-Key'] = secret.value;
        break;
      case 'custom':
        headers[config.auth.headerName || 'Authorization'] = secret.value;
        break;
    }
  }

  return headers;
}

function isBodyMethod(method: TenantFunctionInput['config']['method']): boolean {
  return method === 'POST' || method === 'PUT' || method === 'PATCH';
}

function stringifyResponse(response: TenantFunctionResponse): string {
  return JSON.stringify(response);
}

/**
 * Executes a tenant function.
 */
export async function executeTenantFunctionResult(
  fn: TenantFunctionInput,
  args: Record<string, unknown>,
  deps: TenantFunctionExecutorDeps,
  options: { signal?: AbortSignal; beforeDispatch?: () => Promise<void>; maxBytes?: number } = {},
): Promise<TenantFunctionExecution> {
  let dispatched = false;
  let upstreamCompleted = false;
  const stringifyResponse = (response: TenantFunctionResponse): TenantFunctionExecution => {
    let effect: TenantFunctionExecution['effect'] = 'not_dispatched';
    if (upstreamCompleted) {
      effect = 'completed';
    } else if (dispatched) {
      effect = 'unknown';
    }
    return { response, effect };
  };
  try {
    const url = buildUrl(fn.config.baseUrl, fn.config.path, args);
    const requestParams = buildRequestParams(fn.config.path, args);
    const headers = await buildHeaders(fn.config, deps, fn.tenantId);

    options.signal?.throwIfAborted();
    await options.beforeDispatch?.();
    options.signal?.throwIfAborted();
    dispatched = true;
    const response = await axios({
      method: fn.config.method,
      url,
      headers,
      params: isBodyMethod(fn.config.method) ? undefined : requestParams,
      data: isBodyMethod(fn.config.method) ? requestParams : undefined,
      timeout: 30000,
      maxRedirects: 0,
      signal: options.signal,
      ...(options.maxBytes
        ? { maxContentLength: options.maxBytes, maxBodyLength: options.maxBytes }
        : {}),
      validateStatus: () => true,
    });

    if (response.status >= 400) {
      return stringifyResponse({
        ok: false,
        status: response.status,
        error: {
          message: `HTTP ${response.status}`,
          data: response.data,
        },
      });
    }

    upstreamCompleted = true;
    let result: unknown = response.data;

    if (fn.postProcess) {
      try {
        result = await runSafeFunction<unknown, unknown>(fn.postProcess, result);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'postProcess failed';
        return stringifyResponse({
          ok: false,
          status: response.status,
          error: {
            message,
          },
        });
      }
    }

    return stringifyResponse({
      ok: true,
      status: response.status,
      data: result,
    });
  } catch (error) {
    let message = 'HTTP request failed';
    if (axios.isAxiosError(error)) {
      message = error.message ?? message;
    } else if (error instanceof Error) {
      message = error.message;
    }

    return stringifyResponse({
      ok: false,
      error: {
        message,
      },
    });
  }
}

export interface TenantFunctionExecution {
  response: TenantFunctionResponse;
  effect: 'not_dispatched' | 'completed' | 'unknown';
}

/** Chat compatibility keeps its existing JSON string response. */
export async function executeTenantFunction(
  fn: TenantFunctionInput,
  args: Record<string, unknown>,
  deps: TenantFunctionExecutorDeps,
): Promise<string> {
  return stringifyResponse((await executeTenantFunctionResult(fn, args, deps)).response);
}
