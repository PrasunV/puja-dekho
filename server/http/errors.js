/** An error that maps directly to an HTTP response. */
export class HttpError extends Error {
  /**
   * @param {number} status HTTP status code
   * @param {string} code   Stable machine-readable code the client can branch on
   * @param {string} message Plain-language text that is safe to show to people
   */
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export const badRequest = (message, code = 'bad_request') => new HttpError(400, code, message);
export const rateLimited = (message, code = 'rate_limited') => new HttpError(429, code, message);
export const notFound = (message = 'Not found.') => new HttpError(404, 'not_found', message);

/**
 * Express error middleware: known errors keep their status, anything else is a 500
 * with a generic message (details go to the server log only).
 * @type {import('express').ErrorRequestHandler}
 */
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.code, message: err.message });
  } else if (err?.type === 'entity.too.large') {
    res.status(413).json({ error: 'too_large', message: 'That request is too large.' });
  } else if (err instanceof SyntaxError) {
    res.status(400).json({ error: 'bad_request', message: 'Bad request body.' });
  } else {
    console.error(err);
    res.status(500).json({ error: 'server_error', message: 'Something went wrong. Try again.' });
  }
}

/**
 * Wrap an async route handler so rejections reach the error middleware.
 * @param {(req: import('express').Request, res: import('express').Response) => Promise<unknown>} handler
 * @returns {import('express').RequestHandler}
 */
export const asyncHandler = (handler) => (req, res, next) => {
  handler(req, res).catch(next);
};
