/**
 * Error from the Puja Dekho API. `message` is safe to show to people.
 */
export class ApiError extends Error {
  /**
   * @param {string} message
   * @param {{ code?: string, status?: number }} [details]
   */
  constructor(message, { code, status } = {}) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

/**
 * Call the JSON API. Paths are relative to `/api` (see docs/API.md).
 * @param {string} path  e.g. `/state`
 * @param {{ method?: string, body?: unknown, signal?: AbortSignal }} [options]
 * @returns {Promise<any>}
 * @throws {ApiError} on a non-2xx response or a network failure
 */
export async function api(path, { method = 'GET', body, signal } = {}) {
  let res;
  try {
    res = await fetch(`/api${path}`, {
      method,
      credentials: 'same-origin',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal,
    });
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === 'AbortError') throw cause;
    throw new ApiError('You look offline. Check your connection and try again.', { code: 'network' });
  }
  /** @type {any} */
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* non-JSON error page */
  }
  if (!res.ok) {
    throw new ApiError(data?.message || 'Something went wrong. Try again.', { code: data?.error, status: res.status });
  }
  return data;
}
