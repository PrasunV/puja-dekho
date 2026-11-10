/**
 * Security headers. `CONTENT_SECURITY_POLICY` is also written into vercel.json (static
 * files on Vercel never pass through Express); a test keeps the two identical.
 */

export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  // accounts.google.com: the Sign in with Google button (Jagadhatri), which loads a script, a style and a frame.
  "script-src 'self' 'wasm-unsafe-eval' https://accounts.google.com/gsi/client",
  "style-src 'self' 'unsafe-inline' https://accounts.google.com/gsi/style",
  "worker-src 'self' blob:",
  "font-src 'self' data:",
  "img-src 'self' data: blob: https:",
  "connect-src 'self' https://tiles.openfreemap.org https://api.openrouteservice.org https://accounts.google.com/gsi/",
  'frame-src https://accounts.google.com/gsi/',
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

export const SECURITY_HEADERS = Object.freeze({
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'geolocation=(self)',
  'Content-Security-Policy': CONTENT_SECURITY_POLICY,
});

/** @type {import('express').RequestHandler} */
export function securityHeaders(req, res, next) {
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) res.setHeader(name, value);
  next();
}
