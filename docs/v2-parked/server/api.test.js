'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createApp, RULES } = require('../server/app');
const PUJAS = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'public', 'data', 'pujas.json'), 'utf8'));
const OK = PUJAS.filter((p) => p.ck);
const STACKED = PUJAS.find((p) => !p.ck);

const openApps = [];
test.after(() => { for (const f of openApps) { try { f(); } catch (e) { /* already closed */ } } });
async function boot(extra = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pujadekho-'));
  let clock = Date.parse('2026-10-17T20:00:00+05:30');
  const inst = createApp({ DATA_DIR: dir, TEST_AUTH: '1', SECRET: 'test-secret', now: () => clock, ...extra });
  const server = await new Promise((r) => { const s = inst.app.listen(0, () => r(s)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const client = () => {
    const jar = {};
    const call = async (method, url, body) => {
      const res = await fetch(base + url, { method, headers: { 'content-type': 'application/json', cookie: Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ') }, body: body ? JSON.stringify(body) : undefined });
      for (const c of res.headers.getSetCookie()) { const [kv] = c.split(';'); const [k, v] = kv.split(/=(.*)/s); if (v === '' ) delete jar[k]; else jar[k] = v; }
      const ct = res.headers.get('content-type') || '';
      return { status: res.status, body: ct.includes('json') ? await res.json() : Buffer.from(await res.arrayBuffer()), headers: res.headers };
    };
    return { get: (u) => call('GET', u), post: (u, b) => call('POST', u, b || {}), del: (u) => call('DELETE', u), jar };
  };
  const closer = () => { server.closeAllConnections(); server.close(); try { inst.close(); } catch (e) { /* closed */ } };
  openApps.push(closer);
  return { inst, client, advance: (ms) => { clock += ms; }, close: () => { server.closeAllConnections(); server.close(); inst.close(); fs.rmSync(dir, { recursive: true, force: true }); } };
}
const jpeg = () => 'data:image/jpeg;base64,' + Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(4000, 7)]).toString('base64');

test('rating: one per device per puja, re-rating edits, other devices add', async () => {
  const t = await boot(); const a = t.client(), b = t.client(); const id = OK[0].id;
  let r = await a.post('/api/rate', { pujaId: id, stars: 5 });
  assert.equal(r.status, 200); assert.equal(r.body.r.n, 1);
  r = await a.post('/api/rate', { pujaId: id, stars: 2 });
  assert.equal(r.body.r.n, 1); assert.equal(r.body.updated, true); assert.equal(r.body.mine.ratings[id], 2);
  r = await b.post('/api/rate', { pujaId: id, stars: 4 });
  assert.equal(r.body.r.n, 2);
  assert.equal((await a.post('/api/rate', { pujaId: id, stars: 0 })).status, 400);
  assert.equal((await a.post('/api/rate', { pujaId: id, stars: 3.5 })).status, 400);
  assert.equal((await a.post('/api/rate', { pujaId: 'nope', stars: 3 })).status, 400);
  t.close();
});

test('rating: a forged device cookie is ignored and re-minted', async () => {
  const t = await boot(); const a = t.client(); const id = OK[1].id;
  await a.post('/api/rate', { pujaId: id, stars: 5 });
  const forged = t.client(); forged.jar.pid = 'deadbeef.AAAA';
  const r = await forged.post('/api/rate', { pujaId: id, stars: 1 });
  assert.equal(r.body.r.n, 2); // counted as a new device, not an overwrite of someone else
  t.close();
});

test('rating: daily cap per device', async () => {
  const t = await boot(); const a = t.client();
  for (let i = 0; i < RULES.deviceDailyRatingCap; i++) assert.equal((await a.post('/api/rate', { pujaId: OK[i].id, stars: 4 })).status, 200);
  const r = await a.post('/api/rate', { pujaId: OK[RULES.deviceDailyRatingCap].id, stars: 4 });
  assert.equal(r.status, 429);
  assert.equal((await a.post('/api/rate', { pujaId: OK[0].id, stars: 5 })).status, 200); // editing an old one is still fine
  t.advance(24 * 3600e3);
  assert.equal((await a.post('/api/rate', { pujaId: OK[RULES.deviceDailyRatingCap].id, stars: 4 })).status, 200);
  t.close();
});

test('rating: minting many new device ids from one network is limited', async () => {
  const t = await boot(); let last;
  for (let i = 0; i <= RULES.newDevicesPerIpPerHour; i++) last = await t.client().post('/api/rate', { pujaId: OK[2].id, stars: 3 });
  assert.equal(last.status, 429);
  t.close();
});

test('rating: weights. Anonymous ratings count less and the 4th from one network is nearly ignored', async () => {
  const t = await boot(); const id = OK[3].id;
  for (let i = 0; i < 5; i++) await t.client().post('/api/rate', { pujaId: id, stars: 5 });
  const s = (await t.client().get('/api/state')).body.pujas[id].r;
  assert.equal(s.n, 5);
  // 3 at weight 0.4 + 2 at 0.1 = 1.4 total weight; with the prior pulling toward 3.8 the shown score stays below the raw 5.0
  assert.ok(s.avg < 4.6 && s.avg > 3.8, `avg ${s.avg}`);
  assert.equal(s.raw, 5);
  t.close();
});

test('queue reports: cooldown, remote reports are low confidence, near reports are trusted', async () => {
  const t = await boot(); const a = t.client(), b = t.client(), c = t.client(); const p = OK[4];
  let r = await a.post('/api/report/queue', { pujaId: p.id, level: 3, waitMin: 50 });
  assert.equal(r.status, 200); assert.equal(r.body.near, false); assert.equal(r.body.q.conf, 'low');
  assert.equal((await a.post('/api/report/queue', { pujaId: p.id, level: 1 })).status, 429);
  r = await b.post('/api/report/queue', { pujaId: p.id, level: 3, waitMin: 40, lat: p.la, lng: p.lo });
  assert.equal(r.body.near, true); assert.equal(r.body.q.conf, 'ok'); assert.equal(r.body.q.level, 3);
  r = await c.post('/api/report/queue', { pujaId: p.id, level: 0, lat: p.la + 0.0001, lng: p.lo });
  assert.ok(r.body.q.level >= 0);
  assert.equal((await a.post('/api/report/queue', { pujaId: p.id, level: 9 })).status, 400);
  // old reports fall out of the window
  t.advance(61 * 60e3);
  const st = (await t.client().get('/api/state')).body;
  assert.equal(st.pujas[p.id]?.q, undefined);
  t.close();
});

test('closures: validation, merge of duplicates, votes, hiding when cleared', async () => {
  const t = await boot(); const a = t.client(), b = t.client(), c = t.client(), d = t.client();
  const spot = { lat: 22.5185, lng: 88.3437 };
  assert.equal((await a.post('/api/report/closure', { type: 'nope', ...spot })).status, 400);
  assert.equal((await a.post('/api/report/closure', { type: 'closed', lat: 10, lng: 10 })).status, 400);
  let r = await a.post('/api/report/closure', { type: 'closed', note: 'Barricade at Badamtala', ...spot });
  assert.equal(r.status, 200); const id = r.body.id;
  r = await b.post('/api/report/closure', { type: 'closed', lat: spot.lat + 0.0001, lng: spot.lng });
  assert.equal(r.body.merged, true); assert.equal(r.body.id, id);
  assert.equal((await a.post(`/api/closure/${id}/vote`, { vote: 'cleared' })).body.error, 'own_report');
  assert.equal((await c.post(`/api/closure/${id}/vote`, { vote: 'cleared' })).status, 200);
  assert.equal((await d.post(`/api/closure/${id}/vote`, { vote: 'cleared' })).status, 200);
  const st = (await t.client().get('/api/state')).body;
  assert.equal(st.closures.length, 1); // 2 cleared vs 2 still (reporter + merged confirm): stays
  const e = t.client(), f = t.client();
  await e.post(`/api/closure/${id}/vote`, { vote: 'cleared' }); await f.post(`/api/closure/${id}/vote`, { vote: 'cleared' });
  assert.equal((await t.client().get('/api/state')).body.closures.length, 0); // 4 cleared beats 2 still
  t.close();
});

test('sign-in needs the 18+ confirmation; check-in rules; points; photo privacy; delete', async () => {
  const t = await boot(); const u = t.client(), other = t.client(); const p = OK[5];
  assert.equal((await u.post('/api/checkin', { pujaId: p.id })).status, 401);
  assert.equal((await u.post('/api/auth/test', { sub: 'ann', adult: false })).status, 400);
  assert.equal((await u.post('/api/auth/test', { sub: 'ann', adult: true, nickname: 'Ann Hops' })).status, 200);
  let r = await u.post('/api/checkin', { pujaId: p.id, lat: p.la + 0.01, lng: p.lo, photo: jpeg() });
  assert.equal(r.body.error, 'too_far');
  r = await u.post('/api/checkin', { pujaId: p.id, photo: jpeg() }); assert.equal(r.body.error, 'no_location');
  r = await u.post('/api/checkin', { pujaId: p.id, lat: p.la, lng: p.lo }); assert.equal(r.body.error, 'photo_required');
  r = await u.post('/api/checkin', { pujaId: p.id, lat: p.la, lng: p.lo, photo: 'data:image/jpeg;base64,' + Buffer.from('not a jpeg at all'.repeat(300)).toString('base64') });
  assert.equal(r.body.error, 'bad_photo');
  r = await u.post('/api/checkin', { pujaId: p.id, lat: p.la + 0.001, lng: p.lo, photo: jpeg() });
  assert.equal(r.status, 200); assert.equal(r.body.pointsAwarded, 15); assert.ok(r.body.badges.includes('first_darshan'));
  assert.equal((await u.post('/api/checkin', { pujaId: p.id, lat: p.la, lng: p.lo, photo: jpeg() })).status, 409);
  if (STACKED) assert.equal((await u.post('/api/checkin', { pujaId: STACKED.id, lat: STACKED.la, lng: STACKED.lo, photo: jpeg() })).body.error, 'checkin_disabled');
  // photo is private to its owner
  assert.equal((await u.get('/api/photo/' + p.id)).status, 200);
  await other.post('/api/auth/test', { sub: 'bob' });
  assert.equal((await other.get('/api/photo/' + p.id)).status, 404);
  assert.equal((await t.client().get('/api/photo/' + p.id)).status, 401);
  // leaderboard shows nickname and points only
  const lb = (await t.client().get('/api/leaderboard')).body.rows;
  assert.deepEqual(Object.keys(lb[0]).sort(), ['checkins', 'nickname', 'points']);
  assert.equal(lb[0].nickname, 'Ann Hops');
  // delete my data
  assert.equal((await u.del('/api/me')).status, 200);
  assert.equal((await u.get('/api/me')).body.user, null);
  assert.equal((await t.client().get('/api/leaderboard')).body.rows.length, 0);
  t.close();
});

test('points: daily check-in cap, tour bonus once, queue points only when near', async () => {
  const t = await boot(); const u = t.client(); await u.post('/api/auth/test', { sub: 'cap' });
  let total = 0;
  for (let i = 0; i < RULES.dailyCaps.checkin + 2; i++) {
    const p = OK[10 + i];
    const r = await u.post('/api/checkin', { pujaId: p.id, lat: p.la, lng: p.lo, photo: jpeg() });
    assert.equal(r.status, 200); total += r.body.pointsAwarded;
  }
  assert.equal(total, RULES.dailyCaps.checkin * 15); // the 13th and 14th are recorded but earn nothing
  const four = OK.slice(10, 14).map((p) => p.id);
  const a = await u.post('/api/tour/complete', { pujaIds: four }); assert.equal(a.body.pointsAwarded, RULES.points.tour);
  const b = await u.post('/api/tour/complete', { pujaIds: four.slice().reverse() }); assert.equal(b.body.pointsAwarded, 0);
  assert.equal((await u.post('/api/tour/complete', { pujaIds: OK.slice(0, 4).map((p) => p.id) })).body.error, 'incomplete');
  assert.equal((await u.post('/api/tour/complete', { pujaIds: four.slice(0, 2) })).status, 400);
  const p = OK[30]; t.advance(11 * 60e3);
  const near = await u.post('/api/report/queue', { pujaId: p.id, level: 2, lat: p.la, lng: p.lo });
  const far = await u.post('/api/report/queue', { pujaId: OK[31].id, level: 2 });
  assert.equal(near.body.pointsAwarded, RULES.points.queue); assert.equal(far.body.pointsAwarded, 0);
  t.close();
});

test('an anonymous rating moves into the account at sign-in, never counted twice', async () => {
  const t = await boot(); const u = t.client(); const id = OK[40].id;
  await u.post('/api/rate', { pujaId: id, stars: 4 });
  assert.equal((await t.client().get('/api/state')).body.pujas[id].r.n, 1);
  await u.post('/api/auth/test', { sub: 'fold' });
  const st = (await u.get('/api/state')).body;
  assert.equal(st.pujas[id].r.n, 1); assert.equal(st.mine.ratings[id], 4);
  const r = await u.post('/api/rate', { pujaId: id, stars: 5 });
  assert.equal(r.body.r.n, 1); assert.equal(r.body.pointsAwarded, RULES.points.rating);
  t.close();
});

test('production refuses to start with test auth or without a secret', () => {
  assert.throws(() => createApp({ NODE_ENV: 'production', TEST_AUTH: '1', SECRET: 'x', DATA_DIR: fs.mkdtempSync(path.join(os.tmpdir(), 'p-')) }), /TEST_AUTH/);
  assert.throws(() => createApp({ NODE_ENV: 'production', SECRET: '', DATA_DIR: fs.mkdtempSync(path.join(os.tmpdir(), 'p-')) }), /SECRET/);
});

test('nicknames: stored with ratings and reports, shown on queue only, bad names refused', async () => {
  const t = await boot(); const a = t.client(), b = t.client(), c = t.client(); const p = OK[2];
  let r = await a.post('/api/rate', { pujaId: p.id, stars: 4, nickname: '  Rina  ' });
  assert.equal(r.status, 200);
  assert.equal(t.inst.db.prepare('SELECT nickname FROM ratings WHERE puja_id = ?').get(p.id).nickname, 'Rina');
  for (const bad of ['x', 'a'.repeat(21), 'Mad4rch0d', 'fuuuck you', '<b>hi</b>']) {
    r = await b.post('/api/report/queue', { pujaId: p.id, level: 2, nickname: bad });
    assert.equal(r.status, 400, bad); assert.equal(r.body.error, 'bad_nickname');
  }
  assert.equal((await b.post('/api/rate', { pujaId: p.id, stars: 3, nickname: 'chutiya' })).status, 400);
  r = await b.post('/api/report/queue', { pujaId: p.id, level: 2, nickname: 'Rina' });
  assert.equal(r.status, 200);
  assert.equal((await b.get('/api/state')).body.pujas[p.id].q.by, 'Rina');
  t.advance(60e3);
  await c.post('/api/report/queue', { pujaId: p.id, level: 2 });
  assert.equal((await c.get('/api/state')).body.pujas[p.id].q.by, null);
  assert.equal((await c.get('/api/state')).body.pujas[p.id].r.n, 1);
  t.close();
});
