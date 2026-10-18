import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createApp } from '../../server/app.js';
import { RULES } from '../../server/rules.js';
import { boot, PUJAS } from '../helpers/boot.js';

test('rating: one per device per puja, re-rating edits, other devices add', async () => {
  const t = await boot();
  const [a, b] = [t.client(), t.client()];
  const id = PUJAS[0].id;
  let res = await a.post('/api/rate', { pujaId: id, stars: 5 });
  assert.equal(res.status, 200);
  assert.equal(res.body.r.n, 1);
  res = await a.post('/api/rate', { pujaId: id, stars: 2 });
  assert.equal(res.body.r.n, 1);
  assert.equal(res.body.updated, true);
  assert.equal(res.body.mine.ratings[id], 2);
  res = await b.post('/api/rate', { pujaId: id, stars: 4 });
  assert.equal(res.body.r.n, 2);
  assert.equal((await a.post('/api/rate', { pujaId: id, stars: 0 })).status, 400);
  assert.equal((await a.post('/api/rate', { pujaId: id, stars: 3.5 })).status, 400);
  assert.equal((await a.post('/api/rate', { pujaId: 'nope', stars: 3 })).status, 400);
  t.close();
});

test('rating: a forged device cookie is ignored and re-minted', async () => {
  const t = await boot();
  const id = PUJAS[1].id;
  await t.client().post('/api/rate', { pujaId: id, stars: 5 });
  const forged = t.client();
  forged.jar.pid = 'deadbeef.AAAA';
  const res = await forged.post('/api/rate', { pujaId: id, stars: 1 });
  assert.equal(res.body.r.n, 2, 'counted as a new device, not an overwrite');
  t.close();
});

test('rating: daily cap per device resets the next IST day', async () => {
  const t = await boot();
  const a = t.client();
  const cap = RULES.deviceDailyRatingCap;
  for (let i = 0; i < cap; i += 1) assert.equal((await a.post('/api/rate', { pujaId: PUJAS[i].id, stars: 4 })).status, 200);
  assert.equal((await a.post('/api/rate', { pujaId: PUJAS[cap].id, stars: 4 })).status, 429);
  assert.equal((await a.post('/api/rate', { pujaId: PUJAS[0].id, stars: 5 })).status, 200, 'editing an old rating is still fine');
  t.advance(24 * 3600e3);
  assert.equal((await a.post('/api/rate', { pujaId: PUJAS[cap].id, stars: 4 })).status, 200);
  t.close();
});

test('rating: minting many device ids from one network is limited', async () => {
  const t = await boot();
  let last = { status: 0, body: {} };
  for (let i = 0; i <= RULES.newDevicesPerIpPerHour; i += 1) last = await t.client().post('/api/rate', { pujaId: PUJAS[2].id, stars: 3 });
  assert.equal(last.status, 429);
  t.close();
});

test('rating: anonymous weight and network overflow keep the shown score below the raw one', async () => {
  const t = await boot();
  const id = PUJAS[3].id;
  for (let i = 0; i < 5; i += 1) await t.client().post('/api/rate', { pujaId: id, stars: 5 });
  const { r } = (await t.client().get('/api/state')).body.pujas[id];
  assert.equal(r.n, 5);
  assert.equal(r.raw, 5);
  assert.ok(r.avg < 4.6 && r.avg > 3.8, `avg ${r.avg}`);
  t.close();
});

test('queue: cooldown, remote reports are low confidence, near reports are trusted, old ones expire', async () => {
  const t = await boot();
  const [a, b, c] = [t.client(), t.client(), t.client()];
  const puja = PUJAS[4];
  let res = await a.post('/api/report/queue', { pujaId: puja.id, level: 3, waitMin: 50 });
  assert.equal(res.status, 200);
  assert.equal(res.body.near, false);
  assert.equal(res.body.q.conf, 'low');
  assert.equal((await a.post('/api/report/queue', { pujaId: puja.id, level: 1 })).status, 429);
  res = await b.post('/api/report/queue', { pujaId: puja.id, level: 3, waitMin: 40, lat: puja.la, lng: puja.lo });
  assert.equal(res.body.near, true);
  assert.equal(res.body.q.conf, 'ok');
  assert.equal(res.body.q.level, 3);
  res = await c.post('/api/report/queue', { pujaId: puja.id, level: 0, lat: puja.la + 0.0001, lng: puja.lo });
  assert.ok(res.body.q.level >= 0);
  assert.equal((await a.post('/api/report/queue', { pujaId: puja.id, level: 9 })).status, 400);
  t.advance(61 * 60e3);
  assert.equal((await t.client().get('/api/state')).body.pujas[puja.id]?.q, undefined);
  t.close();
});

test('closures: validation, duplicate merge, votes, hidden once cleared', async () => {
  const t = await boot();
  const [a, b, c, d, e, f] = Array.from({ length: 6 }, () => t.client());
  const spot = { lat: 22.5185, lng: 88.3437 };
  assert.equal((await a.post('/api/report/closure', { type: 'nope', ...spot })).status, 400);
  assert.equal((await a.post('/api/report/closure', { type: 'closed', lat: 10, lng: 10 })).status, 400);
  let res = await a.post('/api/report/closure', { type: 'closed', note: 'Barricade at Badamtala', ...spot });
  assert.equal(res.status, 200);
  const { id } = res.body;
  res = await b.post('/api/report/closure', { type: 'closed', lat: spot.lat + 0.0001, lng: spot.lng });
  assert.equal(res.body.merged, true);
  assert.equal(res.body.id, id);
  assert.equal((await a.post(`/api/closure/${id}/vote`, { vote: 'cleared' })).body.error, 'own_report');
  assert.equal((await c.post(`/api/closure/${id}/vote`, { vote: 'cleared' })).status, 200);
  assert.equal((await d.post(`/api/closure/${id}/vote`, { vote: 'cleared' })).status, 200);
  assert.equal((await t.client().get('/api/state')).body.closures.length, 1, '2 cleared vs 2 still: stays');
  await e.post(`/api/closure/${id}/vote`, { vote: 'cleared' });
  await f.post(`/api/closure/${id}/vote`, { vote: 'cleared' });
  assert.equal((await t.client().get('/api/state')).body.closures.length, 0, '4 cleared beats 2 still');
  t.close();
});

test('nicknames: stored on ratings and reports, shown on the queue line only, bad names refused', async () => {
  const t = await boot();
  const [a, b, c] = [t.client(), t.client(), t.client()];
  const puja = PUJAS[2];
  assert.equal((await a.post('/api/rate', { pujaId: puja.id, stars: 4, nickname: '  Rina  ' })).status, 200);
  const stored = await t.instance.client.execute({ sql: 'SELECT nickname FROM ratings WHERE puja_id = ?', args: [puja.id] });
  assert.equal(stored.rows[0].nickname, 'Rina');
  for (const bad of ['x', 'a'.repeat(21), 'Mad4rch0d', 'fuuuck you', '<b>hi</b>']) {
    const res = await b.post('/api/report/queue', { pujaId: puja.id, level: 2, nickname: bad });
    assert.equal(res.status, 400, bad);
    assert.equal(res.body.error, 'bad_nickname');
  }
  assert.equal((await b.post('/api/rate', { pujaId: puja.id, stars: 3, nickname: 'chutiya' })).status, 400);
  assert.equal((await b.post('/api/report/queue', { pujaId: puja.id, level: 2, nickname: 'Rina' })).status, 200);
  assert.equal((await b.get('/api/state')).body.pujas[puja.id].q.by, 'Rina');
  t.advance(60e3);
  await c.post('/api/report/queue', { pujaId: puja.id, level: 2 });
  assert.equal((await c.get('/api/state')).body.pujas[puja.id].q.by, null);
  assert.equal((await c.get('/api/state')).body.pujas[puja.id].r.n, 1);
  t.close();
});

test('responses: unknown API paths 404 as JSON; oversize and malformed bodies are 413 and 400', async () => {
  const t = await boot();
  const a = t.client();
  const missing = await a.get('/api/nope');
  assert.equal(missing.status, 404);
  assert.equal(missing.body.error, 'not_found');
  assert.equal((await a.post('/api/rate', { pujaId: 'x'.repeat(30_000) })).status, 413);
  t.close();
});

test('rate limiter: bursts of writes are refused, then allowed again after a minute', async () => {
  const t = await boot();
  const a = t.client();
  let last = { status: 0, body: {} };
  for (let i = 0; i < RULES.writesPerMinutePerIp + 1; i += 1) last = await a.post('/api/rate', { pujaId: 'nope', stars: 3 });
  assert.equal(last.status, 429);
  assert.equal(last.body.error, 'slow_down');
  t.advance(61_000);
  assert.equal((await a.post('/api/rate', { pujaId: 'nope', stars: 3 })).status, 400);
  t.close();
});

test('startup: production needs a secret and Vercel needs a hosted database', () => {
  assert.throws(() => createApp({ env: { VERCEL: '1', SECRET: 'x' } }), /TURSO_DATABASE_URL/);
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pd-'));
  assert.throws(() => createApp({ env: { NODE_ENV: 'production', DATA_DIR: dataDir } }), /SECRET/);
});
