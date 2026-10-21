import crypto from 'node:crypto';
import { openVisitDb } from './visits.js';

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const istDay = (ms) => new Date(ms + IST_OFFSET_MS).toISOString().slice(0, 10);
const digest = (text) => crypto.createHash('sha256').update(String(text)).digest();

/**
 * A private page for the owner: how many people opened the site through a tagged share link (`?s=wa`), today and
 * the last 7 days. It is plain text, is not linked from anywhere and is not shown in the app. Open
 * `/api/stats?key=<STATS_KEY>`. Without STATS_KEY set, or with the wrong key, it answers 404 like a page that is not there.
 * @param {{ env?: Record<string, string | undefined>, now?: () => number, dbPath?: string }} [options]
 */
export function createStatsHandler({ env = process.env, now = Date.now, dbPath } = {}) {
  /** @type {Promise<import('@libsql/client').Client> | null} */
  let clientPromise = null;
  const getClient = () => {
    clientPromise ??= openVisitDb(env, dbPath);
    clientPromise.catch(() => {
      clientPromise = null;
    });
    return clientPromise;
  };
  const text = (res, status, body) => {
    res.statusCode = status;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    res.end(body);
  };
  return async function stats(req, res) {
    try {
      const secret = env.STATS_KEY;
      const given = new URL(req.url || '/', 'http://x').searchParams.get('key') ?? req.headers['x-stats-key'] ?? '';
      if (!secret || !crypto.timingSafeEqual(digest(given), digest(secret))) return text(res, 404, 'Not found');
      const client = await getClient();
      const today = istDay(now());
      const from = istDay(now() - 6 * 24 * 60 * 60 * 1000);
      const rows = (await client.execute({ sql: 'SELECT day, source, total FROM shared_visits WHERE day >= ? ORDER BY day DESC, total DESC', args: [from] })).rows;
      const byDay = new Map();
      for (const row of rows) byDay.set(row.day, [...(byDay.get(row.day) ?? []), [String(row.source), Number(row.total)]]);
      const sum = (list = []) => list.reduce((n, [, c]) => n + c, 0);
      const lines = [`Visitors from shared links (India time, one per device per day)`, ``, `Today ${today}: ${sum(byDay.get(today))}`];
      for (const [source, count] of byDay.get(today) ?? []) lines.push(`  ${source}: ${count}`);
      lines.push('', 'Last 7 days');
      for (let i = 0; i < 7; i += 1) {
        const day = istDay(now() - i * 24 * 60 * 60 * 1000);
        lines.push(`  ${day}: ${sum(byDay.get(day))}`);
      }
      return text(res, 200, `${lines.join('\n')}\n`);
    } catch {
      return text(res, 503, 'Unavailable');
    }
  };
}
