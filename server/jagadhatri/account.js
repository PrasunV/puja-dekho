/**
 * Jagadhatri Puja accounts: Google sign-in, the wish list and visited pujas. One small standalone handler (plain
 * Node `(req, res)`), so it runs as its own Vercel function at /api/jagadhatri/account and inside the Express server.
 *
 *   GET  → { user, visited, wish }            (user is null when signed out)
 *   POST { action: 'signin', credential }      Google ID token from the Sign in with Google button
 *   POST { action: 'signout' }
 *   POST { action: 'wish', puja, on }          add (on: true) or remove a puja from the wish list
 *   POST { action: 'visited', puja, on }       mark a puja visited by hand, or unmark it
 *
 * What is stored (see /privacy.html): Google account ID, name and profile photo, and the pujas. Never the email.
 * The session is an HttpOnly cookie signed with SECRET; no password, no token in the browser's storage.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import JG_DATA from '../../public/jagadhatripuja/data/pujas.json' with { type: 'json' };

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
/** Public by design: Google Client IDs are not secrets. */
export const GOOGLE_CLIENT_ID = '359272102824-mpgianidjmi0163704u4v0th42oe4bb5.apps.googleusercontent.com';
const GOOGLE_CERTS = 'https://www.googleapis.com/oauth2/v3/certs';
const ISSUERS = new Set(['accounts.google.com', 'https://accounts.google.com']);
const COOKIE = 'jgs';
const COOKIE_PATH = '/api/jagadhatri';
const SESSION_DAYS = 60;
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const MAX_ROWS = 400; // per user per list; there are 207 pujas
const PUJA_IDS = new Set(JG_DATA.pujas.map((p) => p.id));

const istDay = (ms) => new Date(ms + IST_OFFSET_MS).toISOString().slice(0, 10);
const b64url = (buf) => Buffer.from(buf).toString('base64url');
const fromB64url = (s) => Buffer.from(s, 'base64url');

/** Opens the database and creates the Jagadhatri account tables. */
export async function openAccountDb(env = process.env, dbPath) {
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
      'CREATE TABLE IF NOT EXISTS jg_users (id TEXT PRIMARY KEY, name TEXT NOT NULL, picture TEXT, created INTEGER NOT NULL, seen INTEGER NOT NULL)',
      'CREATE TABLE IF NOT EXISTS jg_visited (user TEXT NOT NULL, puja TEXT NOT NULL, mode TEXT NOT NULL, at INTEGER NOT NULL, day TEXT NOT NULL, PRIMARY KEY (user, puja))',
      'CREATE TABLE IF NOT EXISTS jg_wish (user TEXT NOT NULL, puja TEXT NOT NULL, at INTEGER NOT NULL, PRIMARY KEY (user, puja))',
    ],
    'write',
  );
  return client;
}

/** Google's signing keys, cached for as long as Google says (max-age), refetched when a token names an unknown key. */
function googleKeys(fetchImpl, now) {
  let cache = { at: 0, maxAge: 0, keys: /** @type {Record<string, crypto.KeyObject>} */ ({}) };
  return async (kid) => {
    const fresh = now() - cache.at < cache.maxAge;
    if (!fresh || !cache.keys[kid]) {
      const res = await fetchImpl(GOOGLE_CERTS);
      if (!res.ok) throw new Error('google_keys_unavailable');
      const body = await res.json();
      const maxAge = Number(/max-age=(\d+)/.exec(res.headers?.get?.('cache-control') || '')?.[1] || 3600) * 1000;
      /** @type {Record<string, import('node:crypto').KeyObject>} */
      const keys = {};
      for (const jwk of body.keys || []) keys[jwk.kid] = crypto.createPublicKey({ key: jwk, format: 'jwk' });
      cache = { at: now(), maxAge, keys };
    }
    return cache.keys[kid];
  };
}

/**
 * Checks a Google ID token: RS256 signature by Google's current key, issued by Google, for this app, not expired.
 * @returns {Promise<{ sub: string, name: string, picture: string | null }>}
 */
export async function verifyGoogleToken(token, { keyFor, now, clientId = GOOGLE_CLIENT_ID }) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) throw new Error('bad_token');
  const header = JSON.parse(fromB64url(parts[0]).toString('utf8'));
  const claims = JSON.parse(fromB64url(parts[1]).toString('utf8'));
  if (header.alg !== 'RS256' || !header.kid) throw new Error('bad_token');
  const key = await keyFor(header.kid);
  if (!key) throw new Error('bad_token');
  const ok = crypto.verify('RSA-SHA256', Buffer.from(`${parts[0]}.${parts[1]}`), key, fromB64url(parts[2]));
  if (!ok) throw new Error('bad_token');
  if (!ISSUERS.has(claims.iss)) throw new Error('bad_token');
  if (claims.aud !== clientId) throw new Error('bad_token');
  if (typeof claims.exp !== 'number' || claims.exp * 1000 < now() - 60_000) throw new Error('token_expired');
  if (typeof claims.sub !== 'string' || !/^\d{1,40}$/.test(claims.sub)) throw new Error('bad_token');
  const name = String(claims.name || claims.given_name || 'Puja Dekho user').slice(0, 80);
  const picture = typeof claims.picture === 'string' && claims.picture.startsWith('https://') ? claims.picture.slice(0, 400) : null;
  return { sub: claims.sub, name, picture };
}

/** Session cookie: "<google sub>.<expiry ms>.<HMAC>" so it cannot be forged without SECRET. */
function sessionCodec(secret) {
  const sign = (data) => b64url(crypto.createHmac('sha256', secret).update(data).digest());
  return {
    make: (sub, expires) => `${sub}.${expires}.${sign(`${sub}.${expires}`)}`,
    read(value, now) {
      const [sub, exp, sig] = String(value || '').split('.');
      if (!sub || !exp || !sig) return null;
      const want = sign(`${sub}.${exp}`);
      if (want.length !== sig.length || !crypto.timingSafeEqual(Buffer.from(want), Buffer.from(sig))) return null;
      if (Number(exp) < now) return null;
      return sub;
    },
  };
}

const cookieOf = (header, name) => new RegExp(`(?:^|;\\s*)${name}=([^;]+)`).exec(header || '')?.[1];

async function readJson(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') return JSON.parse(req.body || '{}');
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 16_384) throw new Error('too_large');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

/**
 * @param {object} [options]
 * @param {Record<string, string | undefined>} [options.env]
 * @param {() => number} [options.now]
 * @param {string} [options.dbPath]
 * @param {typeof fetch} [options.fetchImpl]  For tests
 * @param {string} [options.clientId]          For tests
 */
export function createAccountHandler({ env = process.env, now = Date.now, dbPath, fetchImpl = fetch, clientId = GOOGLE_CLIENT_ID } = {}) {
  const secret = env.SECRET || (env.VERCEL || env.NODE_ENV === 'production' ? null : 'dev-secret-not-for-production');
  const session = secret ? sessionCodec(secret) : null;
  const keyFor = googleKeys(fetchImpl, now);
  /** @type {Promise<import('@libsql/client').Client> | null} */
  let clientPromise = null;
  const getClient = () => {
    clientPromise ??= openAccountDb(env, dbPath);
    clientPromise.catch(() => {
      clientPromise = null;
    });
    return clientPromise;
  };

  const send = (res, status, body, cookie) => {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    if (cookie) res.setHeader('Set-Cookie', cookie);
    res.end(JSON.stringify(body));
  };
  const cookieFor = (req, value, maxAgeSec) => {
    const secure = req.headers['x-forwarded-proto'] === 'https' || env.VERCEL ? '; Secure' : '';
    return `${COOKIE}=${value}; Path=${COOKIE_PATH}; Max-Age=${maxAgeSec}; HttpOnly; SameSite=Lax${secure}`;
  };

  const snapshot = async (client, userId) => {
    const user = (await client.execute({ sql: 'SELECT id, name, picture FROM jg_users WHERE id = ?', args: [userId] })).rows[0];
    if (!user) return { user: null, visited: [], wish: [] };
    const visited = (
      await client.execute({ sql: 'SELECT puja, mode, at, day FROM jg_visited WHERE user = ? ORDER BY at DESC', args: [userId] })
    ).rows;
    const wish = (await client.execute({ sql: 'SELECT puja, at FROM jg_wish WHERE user = ? ORDER BY at DESC', args: [userId] })).rows;
    return {
      user: { name: String(user.name), picture: user.picture ? String(user.picture) : null },
      visited: visited.map((r) => ({ puja: String(r.puja), mode: String(r.mode), at: Number(r.at), day: String(r.day) })),
      wish: wish.map((r) => ({ puja: String(r.puja), at: Number(r.at) })),
    };
  };

  return async function account(req, res) {
    try {
      if (!session) return send(res, 503, { error: 'not_configured' });
      // Writes only from this site's own pages (SameSite=Lax already keeps the cookie off cross-site posts).
      if (req.method === 'POST') {
        const origin = req.headers.origin;
        const host = req.headers['x-forwarded-host'] || req.headers.host;
        if (origin && host && new URL(origin).host !== host) return send(res, 403, { error: 'bad_origin' });
      }
      const client = await getClient();
      const t = now();
      const userId = session.read(cookieOf(req.headers.cookie, COOKIE), t);

      if (req.method === 'GET' || req.method === 'HEAD') {
        if (!userId) return send(res, 200, { user: null, visited: [], wish: [] });
        return send(res, 200, await snapshot(client, userId));
      }
      if (req.method !== 'POST') return send(res, 405, { error: 'method_not_allowed' });

      let body;
      try {
        body = await readJson(req);
      } catch {
        return send(res, 400, { error: 'bad_request' });
      }
      const action = body?.action;

      if (action === 'signin') {
        let profile;
        try {
          profile = await verifyGoogleToken(body.credential, { keyFor, now, clientId });
        } catch (e) {
          const why = /** @type {Error} */ (e).message;
          return send(res, why === 'google_keys_unavailable' ? 503 : 401, {
            error: why === 'token_expired' ? 'token_expired' : 'sign_in_failed',
          });
        }
        await client.execute({
          sql: 'INSERT INTO jg_users (id, name, picture, created, seen) VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET name = excluded.name, picture = excluded.picture, seen = excluded.seen',
          args: [profile.sub, profile.name, profile.picture, t, t],
        });
        const expires = t + SESSION_DAYS * 86_400_000;
        return send(
          res,
          200,
          await snapshot(client, profile.sub),
          cookieFor(req, session.make(profile.sub, expires), SESSION_DAYS * 86_400),
        );
      }
      if (action === 'signout') return send(res, 200, { user: null, visited: [], wish: [] }, cookieFor(req, '', 0));

      if (!userId) return send(res, 401, { error: 'sign_in_needed' });
      const puja = String(body.puja || '');
      if (!PUJA_IDS.has(puja)) return send(res, 400, { error: 'unknown_puja' });
      const on = body.on !== false;

      if (action === 'wish') {
        if (on) {
          const n = Number((await client.execute({ sql: 'SELECT COUNT(*) AS n FROM jg_wish WHERE user = ?', args: [userId] })).rows[0].n);
          if (n >= MAX_ROWS) return send(res, 409, { error: 'list_full' });
          await client.execute({
            sql: 'INSERT INTO jg_wish (user, puja, at) VALUES (?, ?, ?) ON CONFLICT DO NOTHING',
            args: [userId, puja, t],
          });
        } else {
          await client.execute({ sql: 'DELETE FROM jg_wish WHERE user = ? AND puja = ?', args: [userId, puja] });
        }
        return send(res, 200, await snapshot(client, userId));
      }
      if (action === 'visited') {
        if (on) {
          // A puja already completed in person stays "person"; a hand tick never downgrades it.
          await client.execute({
            sql: "INSERT INTO jg_visited (user, puja, mode, at, day) VALUES (?, ?, 'manual', ?, ?) ON CONFLICT(user, puja) DO NOTHING",
            args: [userId, puja, t, istDay(t)],
          });
        } else {
          await client.execute({ sql: "DELETE FROM jg_visited WHERE user = ? AND puja = ? AND mode = 'manual'", args: [userId, puja] });
        }
        return send(res, 200, await snapshot(client, userId));
      }
      return send(res, 400, { error: 'unknown_action' });
    } catch {
      return send(res, 503, { error: 'account_unavailable' });
    }
  };
}
