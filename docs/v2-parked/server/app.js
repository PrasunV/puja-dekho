'use strict';
// Puja Dekho API. Express + built-in SQLite. No external services except Google sign-in verification.
const express = require('express');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const { checkNickname } = require('./nick');
const PUJAS = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'public', 'data', 'pujas.json'), 'utf8'));
const PUJA_BY_ID = new Map(PUJAS.map((p) => [p.id, p]));

// ---- tunable rules (all in one place) ---------------------------------------------------------
const RULES = {
  checkinRadiusM: 200,          // must be this close to the pin to check in
  nearRadiusM: 500,             // a report from within this distance counts fully
  queueWindowMin: 60,           // queue reports older than this are ignored
  queueCooldownMin: 10,         // one queue report per device per puja per 10 minutes
  queueRemoteWeight: 0.3,       // a report with no/far GPS counts less
  closureWindowMin: 180,
  closureDedupeM: 40,
  closureCooldownMin: 5,
  deviceDailyRatingCap: 40,     // distinct pujas a device may rate per day
  deviceDailyReportCap: 60,
  newDevicesPerIpPerHour: 60,   // limits mass-minting of device ids from one network
  weightVerified: 1.0,          // signed in and checked in at that puja
  weightSignedIn: 0.6,          // signed in, no check-in there
  weightAnonymous: 0.4,         // device cookie only
  weightIpOverflow: 0.1,        // 4th+ rating for one puja from one network
  ipFreeRatingsPerPuja: 3,
  priorWeight: 3,               // Bayesian prior: pulls young scores to the average
  priorMeanFloor: 3.8,
  points: { checkin: 10, photo: 5, rating: 2, queue: 3, closure: 3, vote: 1, tour: 20 },
  dailyCaps: { checkin: 12, queue: 10, closure: 5, vote: 5 },
  tourMinStops: 4,
  photoMaxBytes: 700 * 1024,
};
const LEVELS = [
  { n: 0, label: 'No queue' }, { n: 1, label: 'Short, under 15 min' },
  { n: 2, label: 'Medium, 15 to 45 min' }, { n: 3, label: 'Long, 45 min or more' },
];
const CLOSURE_TYPES = ['closed', 'oneway', 'barricade', 'diverted'];

function haversine(a, b, c, d) {
  const R = 6371000, p = Math.PI / 180;
  const x = Math.sin(((c - a) * p) / 2) ** 2 + Math.cos(a * p) * Math.cos(c * p) * Math.sin(((d - b) * p) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
function weightedMedian(items) { // [{v,w}]
  const s = items.slice().sort((x, y) => x.v - y.v);
  const total = s.reduce((a, b) => a + b.w, 0);
  let acc = 0;
  for (const it of s) { acc += it.w; if (acc >= total / 2) return it.v; }
  return s.length ? s[s.length - 1].v : null;
}

function createApp(opts = {}) {
  const env = { ...process.env, ...opts };
  const dataDir = env.DATA_DIR || path.join(__dirname, '..', 'data');
  fs.mkdirSync(path.join(dataDir, 'photos'), { recursive: true });
  const production = env.NODE_ENV === 'production';
  const testAuth = env.TEST_AUTH === '1';
  if (production && testAuth) throw new Error('TEST_AUTH must not be enabled in production');
  let secret = env.SECRET;
  if (!secret) {
    if (production) throw new Error('SECRET is required in production (a long random string)');
    secret = 'dev-secret-not-for-production';
  }
  const googleClientId = env.GOOGLE_CLIENT_ID || '';
  const now = opts.now || (() => Date.now());
  const istDay = () => new Date(now() + 5.5 * 3600e3).toISOString().slice(0, 10);

  const db = new DatabaseSync(opts.dbPath || path.join(dataDir, 'pujadekho.db'));
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS devices (id TEXT PRIMARY KEY, ip_hash TEXT, created_at INTEGER);
    CREATE TABLE IF NOT EXISTS users (sub TEXT PRIMARY KEY, nickname TEXT NOT NULL, adult_at INTEGER NOT NULL, created_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS ratings (
      puja_id TEXT NOT NULL, subject TEXT NOT NULL, stars INTEGER NOT NULL, ip_hash TEXT,
      created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, PRIMARY KEY (puja_id, subject));
    CREATE TABLE IF NOT EXISTS reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT NOT NULL, puja_id TEXT, level INTEGER, wait_min INTEGER,
      lat REAL, lng REAL, closure_type TEXT, note TEXT, subject TEXT NOT NULL, near INTEGER NOT NULL DEFAULT 0,
      ip_hash TEXT, created_at INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS reports_kind_time ON reports(kind, created_at);
    CREATE TABLE IF NOT EXISTS closure_votes (
      report_id INTEGER NOT NULL, subject TEXT NOT NULL, vote TEXT NOT NULL, created_at INTEGER NOT NULL,
      PRIMARY KEY (report_id, subject));
    CREATE TABLE IF NOT EXISTS checkins (
      user_sub TEXT NOT NULL, puja_id TEXT NOT NULL, photo_path TEXT NOT NULL, lat REAL, lng REAL,
      dist_m INTEGER, created_at INTEGER NOT NULL, PRIMARY KEY (user_sub, puja_id));
    CREATE TABLE IF NOT EXISTS ledger (
      id INTEGER PRIMARY KEY AUTOINCREMENT, user_sub TEXT NOT NULL, reason TEXT NOT NULL, ref TEXT NOT NULL,
      points INTEGER NOT NULL, day TEXT NOT NULL, created_at INTEGER NOT NULL, UNIQUE (user_sub, reason, ref));
  `);
  for (const [t, c] of [['ratings', 'nickname'], ['reports', 'nickname']]) {
    if (!db.prepare(`PRAGMA table_info(${t})`).all().some((x) => x.name === c)) db.exec(`ALTER TABLE ${t} ADD COLUMN ${c} TEXT`);
  }
  const q = (sql) => db.prepare(sql);
  const tx = (fn) => { db.exec('BEGIN'); try { const r = fn(); db.exec('COMMIT'); return r; } catch (e) { db.exec('ROLLBACK'); throw e; } };

  // ---- signing helpers --------------------------------------------------------------------
  const sign = (s) => crypto.createHmac('sha256', secret).update(s).digest('base64url');
  const safeEq = (a, b) => { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && crypto.timingSafeEqual(x, y); };
  const ipHash = (req) => crypto.createHash('sha256').update(String(req.ip) + secret).digest('hex').slice(0, 16);
  const parseCookies = (req) => Object.fromEntries((req.headers.cookie || '').split(';').map((c) => c.trim().split(/=(.*)/s).slice(0, 2)).filter((x) => x[0]));
  const setCookie = (req, res, name, value, maxAgeSec) =>
    res.append('Set-Cookie', `${name}=${value}; Path=/; Max-Age=${maxAgeSec}; HttpOnly; SameSite=Lax${req.secure ? '; Secure' : ''}`);

  function readDevice(req) {
    const c = parseCookies(req).pid;
    if (!c) return null;
    const [id, sig] = c.split('.');
    return id && sig && safeEq(sig, sign('pid:' + id)) ? id : null;
  }
  function readSession(req) {
    const c = parseCookies(req).sid;
    if (!c) return null;
    const [sub, exp, sig] = c.split('.');
    if (!sub || !exp || !sig || !safeEq(sig, sign(`sid:${sub}.${exp}`)) || Number(exp) < now()) return null;
    return q('SELECT * FROM users WHERE sub = ?').get(Buffer.from(sub, 'base64url').toString()) || null;
  }
  function startSession(req, res, sub) {
    const exp = now() + 30 * 86400e3;
    const subB = Buffer.from(sub).toString('base64url');
    setCookie(req, res, 'sid', `${subB}.${exp}.${sign(`sid:${subB}.${exp}`)}`, 30 * 86400);
  }
  // Returns a device id, minting one (rate limited per network) if the cookie is missing.
  function ensureDevice(req, res) {
    let id = readDevice(req);
    if (id) return id;
    const ih = ipHash(req);
    const recent = q('SELECT COUNT(*) AS n FROM devices WHERE ip_hash = ? AND created_at > ?').get(ih, now() - 3600e3).n;
    if (recent >= RULES.newDevicesPerIpPerHour) return null;
    id = crypto.randomBytes(16).toString('hex');
    q('INSERT INTO devices (id, ip_hash, created_at) VALUES (?,?,?)').run(id, ih, now());
    setCookie(req, res, 'pid', `${id}.${sign('pid:' + id)}`, 365 * 86400);
    return id;
  }

  // ---- points -----------------------------------------------------------------------------
  function award(sub, reason, ref, points, capKey) {
    const day = istDay();
    if (capKey) {
      const used = q('SELECT COUNT(*) AS n FROM ledger WHERE user_sub = ? AND day = ? AND reason = ?').get(sub, day, reason).n;
      if (used >= RULES.dailyCaps[capKey]) return 0;
    }
    const r = q('INSERT OR IGNORE INTO ledger (user_sub, reason, ref, points, day, created_at) VALUES (?,?,?,?,?,?)').run(sub, reason, String(ref), points, day, now());
    return r.changes ? points : 0;
  }
  const totalPoints = (sub) => q('SELECT COALESCE(SUM(points),0) AS p FROM ledger WHERE user_sub = ?').get(sub).p;
  const LEVEL_STEPS = [[0, 'Newcomer'], [30, 'Hopper'], [100, 'Regular'], [250, 'Pujo Pro'], [500, 'Pandal Legend']];
  const levelFor = (p) => LEVEL_STEPS.filter(([min]) => p >= min).pop()[1];

  function badgesFor(sub) {
    const cks = q('SELECT puja_id FROM checkins WHERE user_sub = ?').all(sub).map((r) => PUJA_BY_ID.get(r.puja_id)).filter(Boolean);
    const cnt = (reason) => q('SELECT COUNT(*) AS n FROM ledger WHERE user_sub = ? AND reason = ?').get(sub, reason).n;
    const stations = new Set(cks.map((p) => p.m[0][0]));
    const defs = [
      ['first_darshan', 'First darshan', 'Check in at your first puja', cks.length >= 1],
      ['hopper5', 'Pandal hopper', 'Check in at 5 pujas', cks.length >= 5],
      ['hopper15', 'Pujo veteran', 'Check in at 15 pujas', cks.length >= 15],
      ['heritage3', 'Heritage hunter', 'Check in at 3 pujas established before 1950', cks.filter((p) => p.h).length >= 3],
      ['line_wanderer', 'Metro wanderer', 'Check in near 4 different metro stations', stations.size >= 4],
      ['crowd_whisperer', 'Crowd whisperer', 'Report queues 5 times', cnt('queue') >= 5],
      ['route_fixer', 'Route fixer', 'Report 3 road closures or diversions', cnt('closure') >= 3],
      ['tour_finisher', 'Tour finisher', 'Finish a planned tour of 4 or more pujas', cnt('tour') >= 1],
    ];
    return defs.map(([id, name, how, earned]) => ({ id, name, how, earned }));
  }

  // ---- aggregates (cached 10 s) -----------------------------------------------------------
  let cache = { at: 0, data: null };
  function aggregates() {
    if (cache.data && now() - cache.at < 10000) return cache.data;
    const ts = now();
    const out = { pujas: {}, closures: [] };
    const ensure = (id) => (out.pujas[id] ||= {});
    // ratings
    const rows = q('SELECT r.puja_id, r.subject, r.stars, r.ip_hash, r.created_at, (c.puja_id IS NOT NULL) AS verified FROM ratings r LEFT JOIN checkins c ON r.subject = \'u:\' || c.user_sub AND c.puja_id = r.puja_id ORDER BY r.created_at').all();
    const perIp = new Map();
    const byPuja = new Map();
    let allW = 0, allS = 0;
    for (const r of rows) {
      let w = r.subject.startsWith('u:') ? (r.verified ? RULES.weightVerified : RULES.weightSignedIn) : RULES.weightAnonymous;
      const k = r.puja_id + '|' + r.ip_hash;
      const seen = (perIp.get(k) || 0) + 1; perIp.set(k, seen);
      if (seen > RULES.ipFreeRatingsPerPuja) w = Math.min(w, RULES.weightIpOverflow);
      const a = byPuja.get(r.puja_id) || { n: 0, nv: 0, sw: 0, ss: 0, vw: 0, vs: 0 };
      a.n++; a.sw += w; a.ss += w * r.stars;
      if (r.verified) { a.nv++; a.vw += 1; a.vs += r.stars; }
      byPuja.set(r.puja_id, a);
      allW += w; allS += w * r.stars;
    }
    const m = allW >= 20 ? allS / allW : RULES.priorMeanFloor;
    for (const [id, a] of byPuja) {
      const bayes = (RULES.priorWeight * m + a.ss) / (RULES.priorWeight + a.sw);
      ensure(id).r = { avg: Math.round(bayes * 10) / 10, raw: Math.round((a.ss / a.sw) * 10) / 10, n: a.n, nv: a.nv, avgV: a.nv ? Math.round((a.vs / a.nv) * 10) / 10 : null };
    }
    // queue
    const since = ts - RULES.queueWindowMin * 60e3;
    const qs = q('SELECT puja_id, level, wait_min, near, created_at, nickname FROM reports WHERE kind = \'queue\' AND created_at > ?').all(since);
    const qBy = new Map();
    for (const r of qs) { (qBy.get(r.puja_id) || qBy.set(r.puja_id, []).get(r.puja_id)).push(r); }
    for (const [id, list] of qBy) {
      const items = list.map((r) => {
        const ageMin = (ts - r.created_at) / 60e3;
        return { v: r.level, wait: r.wait_min, w: (r.near ? 1 : RULES.queueRemoteWeight) * Math.pow(0.5, ageMin / 20) };
      });
      const wsum = items.reduce((a, b) => a + b.w, 0);
      const waits = items.filter((i) => i.wait != null).map((i) => ({ v: i.wait, w: i.w }));
      ensure(id).q = {
        level: weightedMedian(items.map((i) => ({ v: i.v, w: i.w }))), wait: waits.length ? weightedMedian(waits) : null,
        n: list.length, ageMin: Math.round(Math.min(...list.map((r) => (ts - r.created_at) / 60e3))), conf: wsum >= 1 ? 'ok' : 'low',
        by: list.reduce((a, b) => (b.created_at >= a.created_at ? b : a)).nickname || null,
      };
    }
    // check-in counts
    for (const r of q('SELECT puja_id, COUNT(*) AS n FROM checkins GROUP BY puja_id').all()) ensure(r.puja_id).c = r.n;
    // closures
    const cl = q('SELECT * FROM reports WHERE kind = \'closure\' AND created_at > ? ORDER BY created_at DESC').all(ts - RULES.closureWindowMin * 60e3);
    const votes = q('SELECT report_id, vote, COUNT(*) AS n FROM closure_votes GROUP BY report_id, vote').all();
    for (const r of cl) {
      const still = votes.find((v) => v.report_id === r.id && v.vote === 'still')?.n || 0;
      const cleared = votes.find((v) => v.report_id === r.id && v.vote === 'cleared')?.n || 0;
      const stillTotal = still + 1; // the reporter counts as one "still there"
      if (cleared >= 2 && cleared > stillTotal) continue;
      out.closures.push({ id: r.id, type: r.closure_type, lat: r.lat, lng: r.lng, note: r.note, ageMin: Math.round((ts - r.created_at) / 60e3), still: stillTotal, cleared });
    }
    cache = { at: ts, data: out };
    return out;
  }
  const bust = () => { cache = { at: 0, data: null }; };

  // ---- http -------------------------------------------------------------------------------
  const app = express();
  if (env.TRUST_PROXY) app.set('trust proxy', env.TRUST_PROXY === '1' ? 1 : env.TRUST_PROXY);
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'geolocation=(self), camera=(self)');
    res.setHeader('Content-Security-Policy',
      "default-src 'self'; script-src 'self' https://accounts.google.com/gsi/client; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://accounts.google.com/gsi/style; " +
      "font-src 'self' data:; img-src 'self' data: blob: https:; connect-src 'self' https://accounts.google.com/gsi/; frame-src https://accounts.google.com/gsi/; base-uri 'self'; form-action 'self'");
    next();
  });
  app.use('/api', express.json({ limit: '1.2mb' }));
  // crude per-IP write limiter
  const hits = new Map();
  app.use('/api', (req, res, next) => {
    if (req.method === 'GET') return next();
    const k = ipHash(req), t = now(), arr = (hits.get(k) || []).filter((x) => t - x < 60e3);
    if (arr.length >= 90) return res.status(429).json({ error: 'slow_down', message: 'Too many requests. Wait a minute and try again.' });
    arr.push(t); hits.set(k, arr); next();
  });
  const bad = (res, message, code = 400, error = 'bad_request') => res.status(code).json({ error, message });
  const pujaOr400 = (req, res) => { const p = PUJA_BY_ID.get(req.body?.pujaId); if (!p) { bad(res, 'Unknown puja.'); return null; } return p; };

  app.get('/api/health', (req, res) => res.json({ ok: true, mode: 'server', googleClientId: googleClientId || null, testAuth, rules: { checkinRadiusM: RULES.checkinRadiusM, nearRadiusM: RULES.nearRadiusM }, levels: LEVELS, closureTypes: CLOSURE_TYPES }));

  function mine(req) {
    const dev = readDevice(req), user = readSession(req);
    const ratings = {};
    if (dev) for (const r of q('SELECT puja_id, stars FROM ratings WHERE subject = ?').all('d:' + dev)) ratings[r.puja_id] = r.stars;
    if (user) for (const r of q('SELECT puja_id, stars FROM ratings WHERE subject = ?').all('u:' + user.sub)) ratings[r.puja_id] = r.stars;
    const votes = {};
    const subj = user ? 'u:' + user.sub : dev ? 'd:' + dev : null;
    if (subj) for (const v of q('SELECT report_id, vote FROM closure_votes WHERE subject = ?').all(subj)) votes[v.report_id] = v.vote;
    const checkins = user ? q('SELECT puja_id FROM checkins WHERE user_sub = ?').all(user.sub).map((r) => r.puja_id) : [];
    return { ratings, votes, checkins, user: user ? { nickname: user.nickname, points: totalPoints(user.sub), level: levelFor(totalPoints(user.sub)) } : null };
  }
  app.get('/api/state', (req, res) => { res.setHeader('Cache-Control', 'no-store'); res.json({ ts: now(), ...aggregates(), mine: mine(req) }); });

  app.post('/api/rate', (req, res) => {
    const p = pujaOr400(req, res); if (!p) return;
    const stars = req.body.stars;
    if (!Number.isInteger(stars) || stars < 1 || stars > 5) return bad(res, 'Choose 1 to 5 stars.');
    const nn = checkNickname(req.body.nickname); if (!nn.ok) return bad(res, nn.message, 400, 'bad_nickname');
    const user = readSession(req);
    const dev = user ? readDevice(req) : ensureDevice(req, res);
    if (!user && !dev) return bad(res, 'Too many new devices from this network. Try again later.', 429, 'rate_limited');
    const subject = user ? 'u:' + user.sub : 'd:' + dev;
    const day = istDay();
    const result = tx(() => {
      const existing = q('SELECT 1 FROM ratings WHERE puja_id = ? AND subject = ?').get(p.id, subject);
      if (!existing) {
        const startOfDay = Date.parse(day + 'T00:00:00+05:30');
        const used = q('SELECT COUNT(*) AS n FROM ratings WHERE subject = ? AND created_at >= ?').get(subject, startOfDay).n;
        if (used >= RULES.deviceDailyRatingCap) return { limited: true };
      }
      const t = now(), ih = ipHash(req);
      q(`INSERT INTO ratings (puja_id, subject, stars, ip_hash, created_at, updated_at, nickname) VALUES (?,?,?,?,?,?,?)
         ON CONFLICT(puja_id, subject) DO UPDATE SET stars = excluded.stars, updated_at = excluded.updated_at, nickname = excluded.nickname`).run(p.id, subject, stars, ih, t, t, nn.value);
      // one person, one rating: a signed-in rating replaces this device's earlier anonymous one
      if (user && dev) q('DELETE FROM ratings WHERE puja_id = ? AND subject = ?').run(p.id, 'd:' + dev);
      let pts = 0;
      if (user) pts = award(user.sub, 'rating', p.id, RULES.points.rating);
      return { updated: !!existing, pts };
    });
    if (result.limited) return bad(res, 'You have rated a lot of pujas today. Try again tomorrow.', 429, 'rate_limited');
    bust();
    res.json({ ok: true, updated: result.updated, pointsAwarded: result.pts, r: aggregates().pujas[p.id]?.r || null, mine: mine(req) });
  });

  function nearestPujaDist(p, lat, lng) { return isNum(lat) && isNum(lng) ? haversine(lat, lng, p.la, p.lo) : null; }

  app.post('/api/report/queue', (req, res) => {
    const p = pujaOr400(req, res); if (!p) return;
    const { level, waitMin, lat, lng } = req.body;
    if (!Number.isInteger(level) || level < 0 || level > 3) return bad(res, 'Choose a queue level.');
    if (waitMin != null && (!Number.isInteger(waitMin) || waitMin < 0 || waitMin > 240)) return bad(res, 'Wait time must be 0 to 240 minutes.');
    const nn = checkNickname(req.body.nickname); if (!nn.ok) return bad(res, nn.message, 400, 'bad_nickname');
    const user = readSession(req);
    const dev = user ? readDevice(req) : ensureDevice(req, res);
    const subject = user ? 'u:' + user.sub : dev ? 'd:' + dev : null;
    if (!subject) return bad(res, 'Too many new devices from this network. Try again later.', 429, 'rate_limited');
    const t = now();
    const last = q('SELECT created_at FROM reports WHERE kind = \'queue\' AND puja_id = ? AND subject = ? ORDER BY created_at DESC LIMIT 1').get(p.id, subject);
    if (last && t - last.created_at < RULES.queueCooldownMin * 60e3) return bad(res, `You reported this puja a moment ago. You can update it in ${Math.ceil(RULES.queueCooldownMin - (t - last.created_at) / 60e3)} min.`, 429, 'cooldown');
    const startOfDay = Date.parse(istDay() + 'T00:00:00+05:30');
    if (q('SELECT COUNT(*) AS n FROM reports WHERE subject = ? AND created_at >= ?').get(subject, startOfDay).n >= RULES.deviceDailyReportCap) return bad(res, 'Daily report limit reached.', 429, 'rate_limited');
    const d = nearestPujaDist(p, lat, lng);
    const near = d != null && d <= RULES.nearRadiusM ? 1 : 0;
    q('INSERT INTO reports (kind, puja_id, level, wait_min, lat, lng, subject, near, ip_hash, created_at, nickname) VALUES (\'queue\',?,?,?,?,?,?,?,?,?,?)')
      .run(p.id, level, waitMin ?? null, isNum(lat) ? lat : null, isNum(lng) ? lng : null, subject, near, ipHash(req), t, nn.value);
    const pts = user && near ? award(user.sub, 'queue', p.id + ':' + t, RULES.points.queue, 'queue') : 0;
    bust();
    res.json({ ok: true, near: !!near, pointsAwarded: pts, q: aggregates().pujas[p.id]?.q || null });
  });

  app.post('/api/report/closure', (req, res) => {
    const { type, lat, lng } = req.body;
    const note = typeof req.body.note === 'string' ? req.body.note.trim().slice(0, 80) : '';
    if (!CLOSURE_TYPES.includes(type)) return bad(res, 'Choose what is happening on the road.');
    if (!isNum(lat) || !isNum(lng) || lat < 22.2 || lat > 22.8 || lng < 88.0 || lng > 88.6) return bad(res, 'Pick a spot in Kolkata on the map.');
    const user = readSession(req);
    const dev = user ? readDevice(req) : ensureDevice(req, res);
    const subject = user ? 'u:' + user.sub : dev ? 'd:' + dev : null;
    if (!subject) return bad(res, 'Too many new devices from this network. Try again later.', 429, 'rate_limited');
    const t = now();
    const last = q('SELECT created_at FROM reports WHERE kind = \'closure\' AND subject = ? ORDER BY created_at DESC LIMIT 1').get(subject);
    if (last && t - last.created_at < RULES.closureCooldownMin * 60e3) return bad(res, 'Wait a few minutes before reporting another road.', 429, 'cooldown');
    // same spot, same kind, still active: count as a confirmation rather than a duplicate pin
    const active = q('SELECT * FROM reports WHERE kind = \'closure\' AND closure_type = ? AND created_at > ?').all(type, t - RULES.closureWindowMin * 60e3);
    const dup = active.find((r) => haversine(lat, lng, r.lat, r.lng) <= RULES.closureDedupeM);
    let id, pts = 0;
    if (dup) {
      q('INSERT OR REPLACE INTO closure_votes (report_id, subject, vote, created_at) VALUES (?,?,?,?)').run(dup.id, subject, 'still', t);
      id = dup.id;
    } else {
      id = Number(q('INSERT INTO reports (kind, lat, lng, closure_type, note, subject, near, ip_hash, created_at) VALUES (\'closure\',?,?,?,?,?,1,?,?)').run(lat, lng, type, note, subject, ipHash(req), t).lastInsertRowid);
      if (user) pts = award(user.sub, 'closure', String(id), RULES.points.closure, 'closure');
    }
    bust();
    res.json({ ok: true, id, merged: !!dup, pointsAwarded: pts });
  });

  app.post('/api/closure/:id/vote', (req, res) => {
    const id = Number(req.params.id), vote = req.body?.vote;
    if (!['still', 'cleared'].includes(vote)) return bad(res, 'Vote must be still or cleared.');
    const r = q('SELECT * FROM reports WHERE id = ? AND kind = \'closure\'').get(id);
    if (!r) return bad(res, 'That report is gone.', 404, 'not_found');
    const user = readSession(req);
    const dev = user ? readDevice(req) : ensureDevice(req, res);
    const subject = user ? 'u:' + user.sub : dev ? 'd:' + dev : null;
    if (!subject) return bad(res, 'Too many new devices from this network. Try again later.', 429, 'rate_limited');
    if (r.subject === subject) return bad(res, 'You reported this one yourself.', 400, 'own_report');
    const had = q('SELECT 1 FROM closure_votes WHERE report_id = ? AND subject = ?').get(id, subject);
    q('INSERT OR REPLACE INTO closure_votes (report_id, subject, vote, created_at) VALUES (?,?,?,?)').run(id, subject, vote, now());
    const pts = user && !had ? award(user.sub, 'vote', String(id), RULES.points.vote, 'vote') : 0;
    bust();
    res.json({ ok: true, pointsAwarded: pts });
  });

  // ---- sign-in ----------------------------------------------------------------------------
  const randNick = () => 'Hopper' + (1000 + crypto.randomInt(9000));
  const cleanNick = (s) => (typeof s === 'string' && /^[\p{L}\p{N} ._-]{2,20}$/u.test(s.trim()) ? s.trim() : null);
  let oauthClient = null;
  async function verifyGoogle(credential) {
    if (!googleClientId) throw new Error('Google sign-in is not configured on this server.');
    oauthClient ||= new (require('google-auth-library').OAuth2Client)(googleClientId);
    const ticket = await oauthClient.verifyIdToken({ idToken: credential, audience: googleClientId });
    const pl = ticket.getPayload();
    if (!pl?.sub) throw new Error('No subject in token');
    return pl.sub;
  }
  function loginAs(req, res, sub, adult, nickname) {
    let user = q('SELECT * FROM users WHERE sub = ?').get(sub);
    if (!user) {
      if (adult !== true) return { error: 'You need to confirm you are 18 or older to sign in.' };
      const nick = cleanNick(nickname) || randNick();
      q('INSERT INTO users (sub, nickname, adult_at, created_at) VALUES (?,?,?,?)').run(sub, nick, now(), now());
      user = q('SELECT * FROM users WHERE sub = ?').get(sub);
    }
    startSession(req, res, sub);
    // fold this device's earlier anonymous ratings into the account (one person, one rating per puja)
    const dev = readDevice(req);
    if (dev) {
      for (const r of q('SELECT * FROM ratings WHERE subject = ?').all('d:' + dev)) {
        const has = q('SELECT 1 FROM ratings WHERE puja_id = ? AND subject = ?').get(r.puja_id, 'u:' + sub);
        if (!has) q('UPDATE ratings SET subject = ? WHERE puja_id = ? AND subject = ?').run('u:' + sub, r.puja_id, 'd:' + dev);
        else q('DELETE FROM ratings WHERE puja_id = ? AND subject = ?').run(r.puja_id, 'd:' + dev);
      }
      bust();
    }
    return { user };
  }
  app.post('/api/auth/google', async (req, res) => {
    try {
      if (typeof req.body?.credential !== 'string') return bad(res, 'Missing credential.');
      const sub = await verifyGoogle(req.body.credential);
      const r = loginAs(req, res, sub, req.body.adult, req.body.nickname);
      if (r.error) return bad(res, r.error, 400, 'adult_required');
      res.json({ ok: true });
    } catch (e) { bad(res, 'Google sign-in failed. Try again.', 401, 'auth_failed'); }
  });
  if (testAuth) {
    app.post('/api/auth/test', (req, res) => {
      const sub = 'test:' + String(req.body?.sub || 'tester').slice(0, 40);
      const r = loginAs(req, res, sub, req.body?.adult !== false, req.body?.nickname);
      if (r.error) return bad(res, r.error, 400, 'adult_required');
      res.json({ ok: true, sub });
    });
  }
  app.post('/api/auth/logout', (req, res) => { setCookie(req, res, 'sid', '', 0); res.json({ ok: true }); });

  const needUser = (req, res) => { const u = readSession(req); if (!u) bad(res, 'Sign in with Google to do that.', 401, 'auth_required'); return u; };

  app.get('/api/me', (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const u = readSession(req); if (!u) return res.json({ user: null });
    const pts = totalPoints(u.sub);
    const today = q('SELECT COALESCE(SUM(points),0) AS p FROM ledger WHERE user_sub = ? AND day = ?').get(u.sub, istDay()).p;
    const checkins = q('SELECT puja_id, created_at, dist_m FROM checkins WHERE user_sub = ? ORDER BY created_at DESC').all(u.sub);
    const next = LEVEL_STEPS.find(([min]) => min > pts);
    res.json({ user: { nickname: u.nickname, points: pts, todayPoints: today, level: levelFor(pts), nextLevel: next ? { name: next[1], at: next[0] } : null }, checkins, badges: badgesFor(u.sub) });
  });
  app.post('/api/me/nickname', (req, res) => {
    const u = needUser(req, res); if (!u) return;
    const n = cleanNick(req.body?.nickname);
    if (!n) return bad(res, 'Use 2 to 20 letters, numbers, spaces, dots, dashes or underscores.');
    q('UPDATE users SET nickname = ? WHERE sub = ?').run(n, u.sub); res.json({ ok: true, nickname: n });
  });
  app.delete('/api/me', (req, res) => {
    const u = needUser(req, res); if (!u) return;
    tx(() => {
      for (const t of ['checkins', 'ledger']) q(`DELETE FROM ${t} WHERE user_sub = ?`).run(u.sub);
      q('DELETE FROM ratings WHERE subject = ?').run('u:' + u.sub);
      q('DELETE FROM closure_votes WHERE subject = ?').run('u:' + u.sub);
      q('DELETE FROM users WHERE sub = ?').run(u.sub);
    });
    fs.rmSync(path.join(dataDir, 'photos', crypto.createHash('sha1').update(u.sub).digest('hex')), { recursive: true, force: true });
    setCookie(req, res, 'sid', '', 0); bust();
    res.json({ ok: true });
  });

  // ---- check-ins --------------------------------------------------------------------------
  app.post('/api/checkin', (req, res) => {
    const u = needUser(req, res); if (!u) return;
    const p = pujaOr400(req, res); if (!p) return;
    if (!p.ck) return bad(res, 'This puja\'s map pin is only approximate, so check-ins are off for it.', 400, 'checkin_disabled');
    const { lat, lng, photo } = req.body;
    if (!isNum(lat) || !isNum(lng)) return bad(res, 'Turn on location so we can confirm you are at the puja.', 400, 'no_location');
    const d = Math.round(haversine(lat, lng, p.la, p.lo));
    if (d > RULES.checkinRadiusM) return bad(res, `You are about ${d} m away. Get within ${RULES.checkinRadiusM} m of the pandal to check in.`, 400, 'too_far');
    if (typeof photo !== 'string' || !photo.startsWith('data:image/jpeg;base64,')) return bad(res, 'Add a photo of Maa Durga to check in.', 400, 'photo_required');
    const buf = Buffer.from(photo.slice(23), 'base64');
    if (buf.length < 2000 || buf.length > RULES.photoMaxBytes || buf[0] !== 0xff || buf[1] !== 0xd8 || buf[2] !== 0xff) return bad(res, 'That photo could not be used. Take a new one.', 400, 'bad_photo');
    if (q('SELECT 1 FROM checkins WHERE user_sub = ? AND puja_id = ?').get(u.sub, p.id)) return bad(res, 'You already checked in here.', 409, 'already');
    const dir = path.join(dataDir, 'photos', crypto.createHash('sha1').update(u.sub).digest('hex'));
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, p.id + '.jpg');
    fs.writeFileSync(file, buf);
    const result = tx(() => {
      q('INSERT INTO checkins (user_sub, puja_id, photo_path, lat, lng, dist_m, created_at) VALUES (?,?,?,?,?,?,?)').run(u.sub, p.id, file, lat, lng, d, now());
      const day = istDay();
      const used = q('SELECT COUNT(*) AS n FROM ledger WHERE user_sub = ? AND day = ? AND reason = \'checkin\'').get(u.sub, day).n;
      let pts = 0;
      if (used < RULES.dailyCaps.checkin) {
        pts += award(u.sub, 'checkin', p.id, RULES.points.checkin);
        pts += award(u.sub, 'photo', p.id, RULES.points.photo);
      }
      return pts;
    });
    bust();
    res.json({ ok: true, distanceM: d, pointsAwarded: result, capped: result === 0, total: totalPoints(u.sub), level: levelFor(totalPoints(u.sub)), badges: badgesFor(u.sub).filter((b) => b.earned).map((b) => b.id) });
  });
  app.get('/api/photo/:pujaId', (req, res) => {
    const u = needUser(req, res); if (!u) return;
    const r = q('SELECT photo_path FROM checkins WHERE user_sub = ? AND puja_id = ?').get(u.sub, req.params.pujaId);
    if (!r || !fs.existsSync(r.photo_path)) return bad(res, 'No photo.', 404, 'not_found');
    res.setHeader('Cache-Control', 'private, max-age=3600'); res.type('image/jpeg').sendFile(path.resolve(r.photo_path));
  });
  app.post('/api/tour/complete', (req, res) => {
    const u = needUser(req, res); if (!u) return;
    const ids = Array.isArray(req.body?.pujaIds) ? [...new Set(req.body.pujaIds)] : [];
    if (ids.length < RULES.tourMinStops || ids.length > 15 || !ids.every((i) => PUJA_BY_ID.has(i))) return bad(res, `A tour needs ${RULES.tourMinStops} to 15 pujas.`);
    const have = new Set(q('SELECT puja_id FROM checkins WHERE user_sub = ?').all(u.sub).map((r) => r.puja_id));
    if (!ids.every((i) => have.has(i))) return bad(res, 'Check in at every stop first.', 400, 'incomplete');
    const hash = crypto.createHash('sha1').update(ids.slice().sort().join(',')).digest('hex').slice(0, 12);
    const pts = award(u.sub, 'tour', hash, RULES.points.tour);
    res.json({ ok: true, pointsAwarded: pts, total: totalPoints(u.sub) });
  });
  app.get('/api/leaderboard', (req, res) => {
    const rows = q(`SELECT u.nickname, SUM(l.points) AS points, (SELECT COUNT(*) FROM checkins c WHERE c.user_sub = u.sub) AS checkins
      FROM ledger l JOIN users u ON u.sub = l.user_sub GROUP BY u.sub ORDER BY points DESC, checkins DESC LIMIT 25`).all();
    res.json({ rows });
  });

  app.use('/api', (req, res) => bad(res, 'Not found.', 404, 'not_found'));
  const webRoot = fs.existsSync(path.join(__dirname, '..', 'dist', 'index.html')) ? 'dist' : 'public';
  app.use(express.static(path.join(__dirname, '..', webRoot), { maxAge: '5m', setHeaders: (r, p) => { if (p.endsWith('index.html') || p.endsWith('sw.js')) r.setHeader('Cache-Control', 'no-cache'); } }));
  app.use((err, req, res, next) => { // eslint-disable-line
    if (err.type === 'entity.too.large') return bad(res, 'That upload is too large.', 413, 'too_large');
    if (err instanceof SyntaxError) return bad(res, 'Bad request body.');
    console.error(err); res.status(500).json({ error: 'server_error', message: 'Something went wrong. Try again.' });
  });
  return { app, db, rules: RULES, close: () => db.close() };
}
module.exports = { createApp, RULES, haversine };
