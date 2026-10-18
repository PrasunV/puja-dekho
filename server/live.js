import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

/** A device counts as "exploring now" if it checked in within this long. The app checks in every 30 seconds. */
export const LIVE_WINDOW_MS = 90_000;
/** Check-ins older than this are deleted, so the table stays tiny. */
const KEEP_MS = 10 * 60_000;
const ID_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;
/** Crawlers and link-preview fetchers are not people. */
const NOT_A_PERSON = /bot|crawl|spider|slurp|preview|facebookexternalhit|lighthouse|pingdom|uptime/i;

/**
 * The "people exploring now" counter. A small standalone handler (plain Node `(req, res)`), so it runs as its own
 * Vercel function at /api/live and also inside the Express server. It needs only the database.
 *
 * - GET  returns `{ count }`: how many devices checked in within the last 90 seconds.
 * - POST `?id=<random device id>` records that this device is here now and returns the same `{ count }`.
 *   The id is a random string kept on the device. It is not tied to a person, and old ones are deleted.
 *
 * @param {object} [options]
 * @param {Record<string, string | undefined>} [options.env]
 * @param {() => number} [options.now]
 * @param {() => number} [options.random]  Used to tidy old rows now and then
 * @param {string} [options.dbPath]  Local database file, used when TURSO_DATABASE_URL is not set
 */
export function createLiveHandler({ env = process.env, now = Date.now, random = Math.random, dbPath } = {}) {
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
    await client.batch(
      [
        'CREATE TABLE IF NOT EXISTS live_presence (id TEXT PRIMARY KEY, seen INTEGER NOT NULL)',
        'CREATE INDEX IF NOT EXISTS live_presence_seen ON live_presence (seen)',
      ],
      'write',
    );
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

  return async function live(req, res) {
    try {
      if (req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'POST') {
        return send(res, 405, { error: 'method_not_allowed' }, { Allow: 'GET, POST' });
      }
      const at = now();
      const cutoff = at - LIVE_WINDOW_MS;
      const count = { sql: 'SELECT COUNT(*) AS n FROM live_presence WHERE seen > ?', args: [cutoff] };
      /** @type {import('@libsql/client').InStatement[]} */
      const statements = [count];

      if (req.method === 'POST') {
        const id = new URL(req.url || '/', 'http://localhost').searchParams.get('id') || '';
        if (!ID_PATTERN.test(id)) return send(res, 400, { error: 'bad_id' });
        if (!NOT_A_PERSON.test(String(req.headers['user-agent'] || ''))) {
          statements.unshift({
            sql: 'INSERT INTO live_presence (id, seen) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET seen = excluded.seen',
            args: [id, at],
          });
          // About one check-in in twenty also tidies up, so most calls stay a single round trip with two statements.
          if (random() < 0.05) statements.push({ sql: 'DELETE FROM live_presence WHERE seen < ?', args: [at - KEEP_MS] });
        }
      }

      const client = await getClient();
      const results = await client.batch(statements, 'write');
      const n = Number(results[statements.indexOf(count)].rows[0].n);
      return send(res, 200, { count: n });
    } catch {
      return send(res, 503, { error: 'live_unavailable' });
    }
  };
}
