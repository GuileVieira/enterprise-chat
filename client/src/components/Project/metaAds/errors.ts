import type { RequestError } from './types';

function getStringField(value: unknown, field: string) {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const record = value as Record<string, unknown>;
  return typeof record[field] === 'string' ? record[field] : null;
}

function getNumberField(value: unknown, field: string) {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const record = value as Record<string, unknown>;
  return typeof record[field] === 'number' ? record[field] : null;
}

function formatRequestDetails(details: unknown) {
  const errorData = !details || typeof details !== 'object' ? null : details;
  const errorMessage = getStringField(errorData, 'error_user_msg');
  const errorSubcode = getNumberField(errorData, 'error_subcode');
  const errorCode = getNumberField(errorData, 'code');
  const errorTrace = getStringField(errorData, 'fbtrace_id');
  const parts = [
    errorMessage,
    errorSubcode != null ? `subcode ${errorSubcode}` : null,
    errorCode != null ? `code ${errorCode}` : null,
    errorTrace ? `trace ${errorTrace}` : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(' | ') : null;
}

export function getRequestErrorMessage(error: unknown, fallback: string) {
  const requestError = error as RequestError;
  if (typeof requestError.response?.data?.message === 'string') {
    const detail = formatRequestDetails(requestError.response.data.details);
    return detail
      ? `${requestError.response.data.message} (${detail})`
      : requestError.response.data.message;
  }
  if (typeof requestError.message === 'string') {
    return requestError.message;
  }
  return fallback;
}
