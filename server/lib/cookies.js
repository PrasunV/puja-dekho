import crypto from 'node:crypto';

/**
 * Cookie helpers bound to one signing secret.
 * @param {string} secret
 */
export function createCookieTools(secret) {
  /** HMAC signature of a string, URL-safe. */
  const sign = (text) => crypto.createHmac('sha256', secret).update(text).digest('base64url');

  /** Constant-time string comparison. */
  const safeEqual = (a, b) => {
    const left = Buffer.from(a);
    const right = Buffer.from(b);
    return left.length === right.length && crypto.timingSafeEqual(left, right);
  };

  /** @param {import('express').Request} req @returns {Record<string, string>} */
  const parse = (req) =>
    Object.fromEntries(
      (req.headers.cookie || '')
        .split(';')
        .map((part) => part.trim().split(/=(.*)/s).slice(0, 2))
        .filter(([name]) => name),
    );

  /**
   * Set a first-party, HttpOnly cookie. `Secure` is added when the request came over HTTPS.
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   * @param {string} name
   * @param {string} value
   * @param {number} maxAgeSec
   */
  const set = (req, res, name, value, maxAgeSec) =>
    res.append('Set-Cookie', `${name}=${value}; Path=/; Max-Age=${maxAgeSec}; HttpOnly; SameSite=Lax${req.secure ? '; Secure' : ''}`);

  /** Hash of the caller's IP, salted with the secret, so raw IPs are never stored. */
  const hashIp = (req) =>
    crypto
      .createHash('sha256')
      .update(String(req.ip) + secret)
      .digest('hex')
      .slice(0, 16);

  return { sign, safeEqual, parse, set, hashIp };
}
