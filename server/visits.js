import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const COOKIE = 'pv';

/** The calendar day in India, so "once a day" follows the festival, not UTC. */
const istDay = (ms) => new Date(ms + IST_OFFSET_MS).toISOString().slice(0, 10);

/** Opens (and prepares) the database the visit counters live in. Shared with the private stats page. */
export async function openVisitDb(env = process.env, dbPath) {
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
  // Hidden count of visits that came in through a tagged share link (?s=wa). Never shown in the app.
  await client.execute('CREATE TABLE IF NOT EXISTS shared_visits (day TEXT NOT NULL, source TEXT NOT NULL, total INTEGER NOT NULL, PRIMARY KEY (day, source))');
  return client;
}

/** `?s=wa` on the link: a short tag saying where the link was shared. Anything else is ignored. */
const sharedSource = (/** @type {string | undefined} */ url) => {
  try {
    const tag = new URL(url || '/', 'http://x').searchParams.get('s')?.toLowerCase() ?? '';
    return /^[a-z0-9_-]{1,20}$/.test(tag) ? tag : null;
  } catch {
    return null;
  }
};
const cookieOf = (/** @type {string | undefined} */ header, /** @type {string} */ name) =>
  new RegExp(`(?:^|;\\s*)${name}=([^;]+)`).exec(header || '')?.[1];

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

  const open = () => openVisitDb(env, dbPath);
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
      /** @type {string[]} */
      const extraCookies = [];
      if (req.method === 'POST') {
        const today = istDay(now());
        const seen = cookieOf(req.headers.cookie, COOKIE) === today;
        const secure = req.headers['x-forwarded-proto'] === 'https' ? '; Secure' : '';
        const dayCookie = (/** @type {string} */ name) => `${name}=${today}; Path=/; Max-Age=172800; HttpOnly; SameSite=Lax${secure}`;
        // Visits that arrive through a tagged share link are also counted, once per device per day, apart from the total above.
        const tag = sharedSource(req.url);
        if (tag && cookieOf(req.headers.cookie, 'ps') !== today) {
          await client.execute({
            sql: 'INSERT INTO shared_visits (day, source, total) VALUES (?, ?, 1) ON CONFLICT(day, source) DO UPDATE SET total = total + 1',
            args: [today, tag],
          });
          extraCookies.push(dayCookie('ps'));
        }
        if (!seen) {
          const result = await client.execute(
            'INSERT INTO visit_counter (id, total) VALUES (1, 1) ON CONFLICT(id) DO UPDATE SET total = total + 1 RETURNING total',
          );
          return send(res, 200, { count: Number(result.rows[0].total), counted: true }, { 'Set-Cookie': [dayCookie(COOKIE), ...extraCookies] });
        }
      } else if (req.method !== 'GET' && req.method !== 'HEAD') {
        return send(res, 405, { error: 'method_not_allowed' }, { Allow: 'GET, POST' });
      }
      const row = (await client.execute('SELECT total FROM visit_counter WHERE id = 1')).rows[0];
      return send(res, 200, { count: row ? Number(row.total) : 0, counted: false }, extraCookies.length ? { 'Set-Cookie': extraCookies } : {});
    } catch {
      return send(res, 503, { error: 'counter_unavailable' });
    }
  };
}
