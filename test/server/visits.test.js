import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createVisitHandler } from '../../server/visits.js';

/** Call the handler like a browser would, with its own cookie jar. */
function browser(handler) {
  let cookie = '';
  return async (method) => {
    const res = {
      headers: {},
      setHeader(name, value) {
        this.headers[name.toLowerCase()] = value;
      },
      end(body) {
        this.body = JSON.parse(body);
      },
    };
    await handler({ method, headers: { cookie } }, res);
    // The handler may set several cookies at once (an array): keep them all, newest value per name, like a browser.
    const set = [res.headers['set-cookie'] ?? []].flat();
    if (set.length) {
      const jar = new Map(cookie.split('; ').filter(Boolean).map((c) => c.split('=')));
      for (const line of set) jar.set(line.split(';')[0].split('=')[0], line.split(';')[0].split('=')[1]);
      cookie = [...jar].map(([k, v]) => `${k}=${v}`).join('; ');
    }
    return res;
  };
}

test('visits: one count per device per IST day, shared across devices', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pujadekho-visits-'));
  let clock = Date.parse('2026-10-17T20:00:00+05:30');
  const handler = createVisitHandler({ env: {}, now: () => clock, dbPath: path.join(dir, 'v.db') });
  const a = browser(handler);
  const b = browser(handler);

  assert.equal((await a('GET')).body.count, 0, 'starts at zero');
  assert.deepEqual((await a('POST')).body, { count: 1, counted: true });
  assert.deepEqual((await a('POST')).body, { count: 1, counted: false }, 'same device, same day');
  assert.deepEqual((await b('POST')).body, { count: 2, counted: true }, 'a second device');
  clock = Date.parse('2026-10-17T23:59:00+05:30');
  assert.equal((await a('POST')).body.counted, false, 'still the same IST day');
  clock = Date.parse('2026-10-18T00:01:00+05:30');
  assert.deepEqual((await a('POST')).body, { count: 3, counted: true }, 'next IST day counts again');
  assert.equal((await a('GET')).body.count, 3);
  assert.equal((await a('PUT')).headers['cache-control'], 'no-store');
});

test('visits: a missing database answers 503, never crashes', async () => {
  const handler = createVisitHandler({ env: { VERCEL: '1' } });
  const res = await browser(handler)('POST');
  assert.equal(res.body.error, 'counter_unavailable');
});
