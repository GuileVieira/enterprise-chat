/**
 * @fileoverview Safe function executor for tenant function post-processing.
 * Runs untrusted JS in an isolated context with a timeout.
 */

/**
 * Executes a string of JavaScript code as a function with the given data.
 * Uses new Function in strict mode with a timeout via Promise.race.
 *
 * @param code - JavaScript code that should evaluate to a function
 * @param data - The data to pass to the function
 * @param timeoutMs - Maximum execution time in milliseconds
 * @returns The result of the function execution
 */
export async function runSafeFunction<T, R>(
  code: string,
  data: T,
  timeoutMs = 5000,
): Promise<R> {
  const trimmed = code.trim();
  if (!trimmed) {
    return data as unknown as R;
  }

  // Wrap the code to ensure it returns a callable function
  const wrapped = `
    "use strict";
    return (${trimmed});
  `;

  // eslint-disable-next-line no-new-func
  const fnFactory = new Function(wrapped);
  const userFn = fnFactory() as (data: T) => R;

  if (typeof userFn !== 'function') {
    throw new Error('postProcess code did not evaluate to a function');
  }

  let timeoutId: ReturnType<typeof setTimeout>;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`postProcess timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  const execPromise = Promise.resolve().then(() => userFn(data));

  try {
    return await Promise.race([execPromise, timeoutPromise]);
  } finally {
    clearTimeout(timeoutId);
  }
}
