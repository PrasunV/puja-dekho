import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const COOKIE = 'pv';

/** The calendar day in India, so "once a day" follows the festival, not UTC. */
const istDay = (ms) => new Date(ms + IST_OFFSET_MS).toISOString().slice(0, 10);

/**
 * The "people viewed" counter. A small standalone handler (plain Node `(req, res)`), so it runs as its own
 * Vercel function at /api/visits and also inside the Express server. It needs only the database, not SECRET.
 *
 * - GET  returns `{ count }`.
 * - POST counts the visit once per device per day (an IST day, tracked with a plain cookie holding the date)
 *   and returns `{ count, counted }`.
 *
 * @param {object} [options]
 * @param {Record<string, string | undefined>} [options.env]
 * @param {() => number} [options.now]
 * @param {string} [options.dbPath]  Local database file, used when TURSO_DATABASE_URL is not set
 */
export function createVisitHandler({ env = process.env, now = Date.now, dbPath } = {}) {
  /** @type {Promise<import('@libsql/client').Client> | null} */
  let clientPromise = null;

  const open = async () => {
    const hosted = env.TURSO_DATABASE_URL;
    if (!hosted && env.VERCEL) throw new Error('TURSO_DATABASE_URL is not set');
    let url = hosted;
    if (!url) {
      const file = dbPath || path.join(env.DATA_DIR || path.join(ROOT, 'data'), 'pujadekho.db');
      fs.mkdirSync(path.dirname(file), { recursive: true });
      url = `file:${file}`;
    }
    // Literal import paths so Vercel's file tracer bundles the right driver build.
    const { createClient } = url.startsWith('file:') ? await import('@libsql/client') : await import('@libsql/client/web');
    const client = createClient({ url, authToken: env.TURSO_AUTH_TOKEN });
    await client.execute('CREATE TABLE IF NOT EXISTS visit_counter (id INTEGER PRIMARY KEY CHECK (id = 1), total INTEGER NOT NULL)');
    return client;
  };
  const getClient = () => {
    clientPromise ??= open();
    clientPromise.catch(() => {
      clientPromise = null; // try again on the next request
    });
    return clientPromise;
  };

  const send = (res, status, body, headers = {}) => {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    for (const [name, value] of Object.entries(headers)) res.setHeader(name, value);
    res.end(JSON.stringify(body));
  };

  return async function visits(req, res) {
    try {
      const client = await getClient();
      if (req.method === 'POST') {
        const today = istDay(now());
        const seen = /(?:^|;\s*)pv=([^;]+)/.exec(req.headers.cookie || '')?.[1] === today;
        if (!seen) {
          const result = await client.execute(
            'INSERT INTO visit_counter (id, total) VALUES (1, 1) ON CONFLICT(id) DO UPDATE SET total = total + 1 RETURNING total',
          );
          const secure = req.headers['x-forwarded-proto'] === 'https' ? '; Secure' : '';
          return send(
            res,
            200,
            { count: Number(result.rows[0].total), counted: true },
            { 'Set-Cookie': `${COOKIE}=${today}; Path=/; Max-Age=172800; HttpOnly; SameSite=Lax${secure}` },
          );
        }
      } else if (req.method !== 'GET' && req.method !== 'HEAD') {
        return send(res, 405, { error: 'method_not_allowed' }, { Allow: 'GET, POST' });
      }
      const row = (await client.execute('SELECT total FROM visit_counter WHERE id = 1')).rows[0];
      return send(res, 200, { count: row ? Number(row.total) : 0, counted: false });
    } catch {
      return send(res, 503, { error: 'counter_unavailable' });
    }
  };
}
