import { RULES } from '../rules.js';
import { rateLimited } from './errors.js';

/**
 * Sliding-window write limiter, per client and per server instance. Entries for idle
 * clients are pruned so memory stays bounded. (Daily caps and cooldowns that must hold
 * across instances live in the database, see services/.)
 *
 * @param {{ now: () => number, clientKey: (req: import('express').Request) => string }} deps
 * @returns {import('express').RequestHandler}
 */
export function writeRateLimiter({ now, clientKey }) {
  const windowMs = 60_000;
  const limit = RULES.writesPerMinutePerIp;
  /** @type {Map<string, number[]>} */
  const hits = new Map();
  let lastSweep = now();

  const sweep = (t) => {
    lastSweep = t;
    for (const [key, times] of hits) {
      if (!times.length || t - times[times.length - 1] >= windowMs) hits.delete(key);
    }
  };

  return (req, res, next) => {
    if (req.method === 'GET' || req.method === 'HEAD') return next();
    const t = now();
    if (t - lastSweep >= windowMs) sweep(t);
    const key = clientKey(req);
    const recent = (hits.get(key) || []).filter((time) => t - time < windowMs);
    if (recent.length >= limit) {
      return next(rateLimited('Too many requests. Wait a minute and try again.', 'slow_down'));
    }
    recent.push(t);
    hits.set(key, recent);
    return next();
  };
}
