import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createLiveHandler, LIVE_WINDOW_MS, RECENT_MS } from '../../server/live.js';

/** Call the handler like a browser would. */
async function call(handler, method, query = '', userAgent = 'Mozilla/5.0 (iPhone)') {
  const res = {
    headers: {},
    statusCode: 0,
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value;
    },
    end(body) {
      this.body = JSON.parse(body);
    },
  };
  await handler({ method, url: `/${query}`, headers: { 'user-agent': userAgent } }, res);
  return res;
}

const fresh = (clock, extra = {}) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pujadekho-live-'));
  return createLiveHandler({ env: {}, now: () => clock.t, random: () => 1, dbPath: path.join(dir, 'l.db'), ...extra });
};

test('live: counts devices that checked in within the window, once each', async () => {
  const clock = { t: Date.parse('2026-10-19T20:00:00+05:30') };
  const handler = fresh(clock);

  assert.equal((await call(handler, 'GET')).body.count, 0, 'nobody yet');
  assert.equal((await call(handler, 'POST', '?id=device-aaaa1111')).body.count, 1);
  assert.equal((await call(handler, 'POST', '?id=device-aaaa1111')).body.count, 1, 'same device is not counted twice');
  assert.equal((await call(handler, 'POST', '?id=device-bbbb2222')).body.count, 2, 'a second device');
  assert.equal((await call(handler, 'GET')).body.count, 2, 'GET reads without recording anyone');

  clock.t += LIVE_WINDOW_MS - 1_000;
  assert.equal((await call(handler, 'GET')).body.count, 2, 'still here just inside the window');
  assert.equal((await call(handler, 'POST', '?id=device-aaaa1111')).body.count, 2, 'A checks in again');
  clock.t += 5_000; // B is now past the window, A is not
  assert.equal((await call(handler, 'GET')).body.count, 1, 'B has dropped off');
  clock.t += LIVE_WINDOW_MS;
  assert.equal((await call(handler, 'GET')).body.count, 0, 'everyone has dropped off');
});

test('live: crawlers are not counted, bad ids are refused, wrong methods are 405', async () => {
  const clock = { t: Date.parse('2026-10-19T20:00:00+05:30') };
  const handler = fresh(clock);
  assert.equal((await call(handler, 'POST', '?id=device-aaaa1111', 'Googlebot/2.1')).body.count, 0, 'a bot reads but is not counted');
  const noId = await call(handler, 'POST');
  assert.equal(noId.statusCode, 400);
  assert.equal(noId.body.error, 'bad_id');
  assert.equal((await call(handler, 'POST', '?id=short')).statusCode, 400);
  assert.equal((await call(handler, 'POST', '?id=../../etc/passwd')).statusCode, 400);
  const put = await call(handler, 'PUT');
  assert.equal(put.statusCode, 405);
  assert.equal(put.headers.allow, 'GET, POST');
  assert.equal((await call(handler, 'GET')).headers['cache-control'], 'no-store');
});

test('live: old check-ins are tidied away now and then', async () => {
  const clock = { t: Date.parse('2026-10-19T20:00:00+05:30') };
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pujadekho-live-'));
  const dbPath = path.join(dir, 'l.db');
  const quiet = createLiveHandler({ env: {}, now: () => clock.t, random: () => 1, dbPath });
  await call(quiet, 'POST', '?id=device-aaaa1111');
  clock.t += 3 * 60 * 60_000 + 60_000;
  const tidy = createLiveHandler({ env: {}, now: () => clock.t, random: () => 0, dbPath });
  await call(tidy, 'POST', '?id=device-bbbb2222');
  const { createClient } = await import('@libsql/client');
  const rows = (await createClient({ url: `file:${dbPath}` }).execute('SELECT id FROM live_presence')).rows;
  assert.deepEqual(
    rows.map((r) => r.id),
    ['device-bbbb2222'],
  );
});

test('live: a missing database answers 503, never crashes', async () => {
  const handler = createLiveHandler({ env: { VERCEL: '1' } });
  const res = await call(handler, 'POST', '?id=device-aaaa1111');
  assert.equal(res.statusCode, 503);
  assert.equal(res.body.error, 'live_unavailable');
});

test('live: "recent" counts other devices seen in the last 2 hours, never the caller', async () => {
  const clock = { t: Date.parse('2026-10-19T20:00:00+05:30') };
  const handler = fresh(clock);

  const alone = await call(handler, 'POST', '?id=device-aaaa1111');
  assert.deepEqual(alone.body, { count: 1, recent: 0 }, 'a first visitor on a quiet app sees nobody else');
  assert.equal((await call(handler, 'GET')).body.recent, 1, 'a reader with no id counts everyone recent');

  const second = await call(handler, 'POST', '?id=device-bbbb2222');
  assert.deepEqual(second.body, { count: 2, recent: 1 }, 'the second visitor sees the first, not themselves');

  clock.t += 30 * 60_000; // half an hour on: both are gone from "now" but still recent
  assert.deepEqual((await call(handler, 'POST', '?id=device-aaaa1111')).body, { count: 1, recent: 1 });
  clock.t += RECENT_MS - 29 * 60_000; // device B is now older than two hours, A checked in 91 minutes ago
  assert.deepEqual((await call(handler, 'POST', '?id=device-cccc3333')).body, { count: 1, recent: 1 }, 'only A is still recent');
  clock.t += RECENT_MS + 1;
  assert.deepEqual((await call(handler, 'POST', '?id=device-dddd4444')).body, { count: 1, recent: 0 }, 'a long quiet spell resets it');
  assert.equal(
    (await call(handler, 'POST', '?id=device-eeee5555', 'Googlebot/2.1')).body.recent,
    1,
    'a bot reads the same numbers but is not recorded',
  );
});
