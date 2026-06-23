import type { RequestError } from './types';

export function getRequestErrorMessage(error: unknown, fallback: string) {
  const requestError = error as RequestError;
  if (typeof requestError.response?.data?.message === 'string') {
    return requestError.response.data.message;
  }
  if (typeof requestError.message === 'string') {
    return requestError.message;
  }
  return fallback;
}
