import { RULES, CLOSURE_TYPES as RULES_CLOSURE_TYPES, KOLKATA_BOUNDS as BOUNDS } from '../rules.js';
import { haversineMeters, isFiniteNumber } from '../lib/geo.js';
import { checkNickname } from '../lib/nickname.js';
import { badRequest, notFound, rateLimited } from '../http/errors.js';
import { startOfIstDay } from './context.js';

const DEVICE_LIMIT_MESSAGE = 'Too many new devices from this network. Try again later.';

/**
 * Write operations: ratings, queue reports, road reports and votes.
 * Each method validates input, enforces the abuse rules, writes, and returns the response body.
 * Failures throw {@link import('../http/errors.js').HttpError}.
 *
 * @param {import('./context.js').ServiceContext} ctx
 * @param {{ devices: ReturnType<typeof import('./devices.js').createDeviceService>,
 *           aggregates: ReturnType<typeof import('./aggregates.js').createAggregates> }} deps
 */
export function createReportService(ctx, { devices, aggregates }) {
  const { query, now, cookies, pujas } = ctx;

  const requirePuja = (pujaId) => {
    const puja = pujas.get(pujaId);
    if (!puja) throw badRequest('Unknown puja.');
    return puja;
  };

  const requireNickname = (input) => {
    const result = checkNickname(input);
    if (!result.ok) throw badRequest(result.message, 'bad_nickname');
    return result.value;
  };

  /** The caller's subject key, minting a device when needed. */
  const requireSubject = async (req, res) => {
    const deviceId = await devices.ensure(req, res);
    if (!deviceId) throw rateLimited(DEVICE_LIMIT_MESSAGE);
    return `d:${deviceId}`;
  };

  /** What this device has already done, so the UI can show it. */
  async function mine(req) {
    const deviceId = devices.read(req);
    const ratings = {};
    const votes = {};
    if (deviceId) {
      const subject = `d:${deviceId}`;
      for (const row of await query('SELECT puja_id, stars FROM ratings WHERE subject = ?').all(subject)) ratings[row.puja_id] = row.stars;
      for (const row of await query('SELECT report_id, vote FROM closure_votes WHERE subject = ?').all(subject))
        votes[row.report_id] = row.vote;
    }
    return { ratings, votes };
  }

  async function rate(req, res, body) {
    const puja = requirePuja(body?.pujaId);
    const stars = body.stars;
    if (!Number.isInteger(stars) || stars < 1 || stars > 5) throw badRequest('Choose 1 to 5 stars.');
    const nickname = requireNickname(body.nickname);
    const subject = await requireSubject(req, res);

    const existing = await query('SELECT 1 AS found FROM ratings WHERE puja_id = ? AND subject = ?').get(puja.id, subject);
    if (!existing) {
      const used = (
        await query('SELECT COUNT(*) AS n FROM ratings WHERE subject = ? AND created_at >= ?').get(subject, startOfIstDay(now()))
      ).n;
      if (used >= RULES.deviceDailyRatingCap) throw rateLimited('You have rated a lot of pujas today. Try again tomorrow.');
    }
    const t = now();
    await query(
      `INSERT INTO ratings (puja_id, subject, stars, ip_hash, created_at, updated_at, nickname) VALUES (?,?,?,?,?,?,?)
       ON CONFLICT(puja_id, subject) DO UPDATE SET stars = excluded.stars, updated_at = excluded.updated_at, nickname = excluded.nickname`,
    ).run(puja.id, subject, stars, cookies.hashIp(req), t, t, nickname);
    aggregates.invalidate();
    return { ok: true, updated: Boolean(existing), r: (await aggregates.get()).pujas[puja.id]?.r || null, mine: await mine(req) };
  }

  async function reportQueue(req, res, body) {
    const puja = requirePuja(body?.pujaId);
    const { level, waitMin, lat, lng } = body;
    if (!Number.isInteger(level) || level < 0 || level > 3) throw badRequest('Choose a queue level.');
    if (waitMin != null && (!Number.isInteger(waitMin) || waitMin < 0 || waitMin > 240))
      throw badRequest('Wait time must be 0 to 240 minutes.');
    const nickname = requireNickname(body.nickname);
    const subject = await requireSubject(req, res);
    const t = now();

    const last = await query(
      "SELECT created_at FROM reports WHERE kind = 'queue' AND puja_id = ? AND subject = ? ORDER BY created_at DESC LIMIT 1",
    ).get(puja.id, subject);
    if (last && t - last.created_at < RULES.queueCooldownMin * 60e3) {
      const minutesLeft = Math.ceil(RULES.queueCooldownMin - (t - last.created_at) / 60e3);
      throw rateLimited(`You reported this puja a moment ago. You can update it in ${minutesLeft} min.`, 'cooldown');
    }
    const used = (await query('SELECT COUNT(*) AS n FROM reports WHERE subject = ? AND created_at >= ?').get(subject, startOfIstDay(t))).n;
    if (used >= RULES.deviceDailyReportCap) throw rateLimited('Daily report limit reached.');

    const hasPosition = isFiniteNumber(lat) && isFiniteNumber(lng);
    const near = hasPosition && haversineMeters(lat, lng, puja.la, puja.lo) <= RULES.nearRadiusM ? 1 : 0;
    await query(
      "INSERT INTO reports (kind, puja_id, level, wait_min, lat, lng, subject, near, ip_hash, created_at, nickname) VALUES ('queue',?,?,?,?,?,?,?,?,?,?)",
    ).run(
      puja.id,
      level,
      waitMin ?? null,
      hasPosition ? lat : null,
      hasPosition ? lng : null,
      subject,
      near,
      cookies.hashIp(req),
      t,
      nickname,
    );
    aggregates.invalidate();
    return { ok: true, near: Boolean(near), q: (await aggregates.get()).pujas[puja.id]?.q || null };
  }

  async function reportClosure(req, res, body) {
    const { type, lat, lng } = body ?? {};
    const note = typeof body?.note === 'string' ? body.note.trim().slice(0, 80) : '';
    if (!RULES_CLOSURE_TYPES.includes(type)) throw badRequest('Choose what is happening on the road.');
    if (
      !isFiniteNumber(lat) ||
      !isFiniteNumber(lng) ||
      lat < BOUNDS.minLat ||
      lat > BOUNDS.maxLat ||
      lng < BOUNDS.minLng ||
      lng > BOUNDS.maxLng
    ) {
      throw badRequest('Pick a spot in Kolkata on the map.');
    }
    const subject = await requireSubject(req, res);
    const t = now();

    const last = await query("SELECT created_at FROM reports WHERE kind = 'closure' AND subject = ? ORDER BY created_at DESC LIMIT 1").get(
      subject,
    );
    if (last && t - last.created_at < RULES.closureCooldownMin * 60e3)
      throw rateLimited('Wait a few minutes before reporting another road.', 'cooldown');

    // Same spot, same kind, still active: count as a confirmation rather than a duplicate pin.
    const active = await query("SELECT * FROM reports WHERE kind = 'closure' AND closure_type = ? AND created_at > ?").all(
      type,
      t - RULES.closureWindowMin * 60e3,
    );
    const duplicate = active.find((row) => haversineMeters(lat, lng, row.lat, row.lng) <= RULES.closureDedupeM);
    let id;
    if (duplicate) {
      await query('INSERT OR REPLACE INTO closure_votes (report_id, subject, vote, created_at) VALUES (?,?,?,?)').run(
        duplicate.id,
        subject,
        'still',
        t,
      );
      id = duplicate.id;
    } else {
      const result = await query(
        "INSERT INTO reports (kind, lat, lng, closure_type, note, subject, near, ip_hash, created_at) VALUES ('closure',?,?,?,?,?,1,?,?)",
      ).run(lat, lng, type, note, subject, cookies.hashIp(req), t);
      id = Number(result.lastInsertRowid);
    }
    aggregates.invalidate();
    return { ok: true, id, merged: Boolean(duplicate) };
  }

  async function voteOnClosure(req, res, closureId, vote) {
    if (!['still', 'cleared'].includes(vote)) throw badRequest('Vote must be still or cleared.');
    const report = await query("SELECT * FROM reports WHERE id = ? AND kind = 'closure'").get(closureId);
    if (!report) throw notFound('That report is gone.');
    const subject = await requireSubject(req, res);
    if (report.subject === subject) throw badRequest('You reported this one yourself.', 'own_report');
    await query('INSERT OR REPLACE INTO closure_votes (report_id, subject, vote, created_at) VALUES (?,?,?,?)').run(
      closureId,
      subject,
      vote,
      now(),
    );
    aggregates.invalidate();
    return { ok: true };
  }

  return { mine, rate, reportQueue, reportClosure, voteOnClosure };
}
