import { openVisitDb } from './visits.js';

const COOKIE = 'pl';
const YEAR = 365 * 24 * 60 * 60;
const cookieOf = (/** @type {string | undefined} */ header, /** @type {string} */ name) =>
  new RegExp(`(?:^|;\\s*)${name}=([^;]+)`).exec(header || '')?.[1];
/** `?m=meetup-1`: which meetup the love is for. Anything that is not a short plain id is ignored. */
const meetupId = (/** @type {string | undefined} */ url) => {
  try {
    const id = new URL(url || '/', 'http://x').searchParams.get('m')?.toLowerCase() ?? 'meetup';
    return /^[a-z0-9_-]{1,30}$/.test(id) ? id : null;
  } catch {
    return null;
  }
};

/**
 * The "love" counter for a meetup. One small counter per meetup in the same database as the visit counter; no accounts.
 *
 * - GET  returns `{ count, loved }`.
 * - POST adds one love, once per device. The device is remembered with a plain one-year cookie (one cookie per meetup),
 *   so tapping again, or from another tab, does not add more. A love cannot be taken back.
 * Someone who clears their cookies could love again: this is a friendly counter, not a vote.
 *
 * @param {object} [options]
 * @param {Record<string, string | undefined>} [options.env]
 * @param {string} [options.dbPath]
 */
export function createLoveHandler({ env = process.env, dbPath } = {}) {
  /** @type {Promise<import('@libsql/client').Client> | null} */
  let clientPromise = null;
  const getClient = () => {
    clientPromise ??= openVisitDb(env, dbPath).then(async (client) => {
      await client.execute('CREATE TABLE IF NOT EXISTS meetup_loves (id TEXT PRIMARY KEY, total INTEGER NOT NULL)');
      return client;
    });
    clientPromise.catch(() => {
      clientPromise = null;
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

  return async function loves(req, res) {
    try {
      const id = meetupId(req.url);
      if (!id) return send(res, 400, { error: 'bad_meetup' });
      if (req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'POST') {
        return send(res, 405, { error: 'method_not_allowed' }, { Allow: 'GET, POST' });
      }
      const client = await getClient();
      const name = `${COOKIE}_${id}`;
      const already = cookieOf(req.headers.cookie, name) === '1';
      if (req.method === 'POST' && !already) {
        const result = await client.execute({
          sql: 'INSERT INTO meetup_loves (id, total) VALUES (?, 1) ON CONFLICT(id) DO UPDATE SET total = total + 1 RETURNING total',
          args: [id],
        });
        const secure = req.headers['x-forwarded-proto'] === 'https' ? '; Secure' : '';
        return send(
          res,
          200,
          { count: Number(result.rows[0].total), loved: true, counted: true },
          { 'Set-Cookie': `${name}=1; Path=/; Max-Age=${YEAR}; HttpOnly; SameSite=Lax${secure}` },
        );
      }
      const row = (await client.execute({ sql: 'SELECT total FROM meetup_loves WHERE id = ?', args: [id] })).rows[0];
      return send(res, 200, { count: row ? Number(row.total) : 0, loved: already, counted: false });
    } catch {
      return send(res, 503, { error: 'counter_unavailable' });
    }
  };
}
