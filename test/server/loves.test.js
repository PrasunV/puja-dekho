import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createLoveHandler } from '../../server/loves.js';

function browser(handler) {
  let cookie = '';
  return async (method, url = '/') => {
    const res = {
      headers: {},
      setHeader(name, value) {
        this.headers[name.toLowerCase()] = value;
      },
      end(body) {
        this.body = JSON.parse(body);
      },
    };
    await handler({ method, url, headers: { cookie } }, res);
    if (res.headers['set-cookie']) cookie += `${cookie ? '; ' : ''}${res.headers['set-cookie'].split(';')[0]}`;
    return res;
  };
}

test('loves: one love per device, shared across devices, cannot be taken back', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pujadekho-loves-'));
  const handler = createLoveHandler({ env: {}, dbPath: path.join(dir, 'l.db') });
  const a = browser(handler);
  const b = browser(handler);
  assert.deepEqual((await a('GET')).body, { count: 0, loved: false, counted: false });
  assert.deepEqual((await a('POST')).body, { count: 1, loved: true, counted: true });
  assert.deepEqual((await a('POST')).body, { count: 1, loved: true, counted: false }, 'same device again');
  assert.deepEqual((await b('POST')).body, { count: 2, loved: true, counted: true }, 'a second device');
  assert.equal((await a('GET')).body.loved, true);
  assert.equal((await a('DELETE')).headers['allow'], 'GET, POST');
  assert.equal((await a('GET')).headers['cache-control'], 'no-store');
});

test('loves: each meetup has its own count and bad ids are refused', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pujadekho-loves-'));
  const a = browser(createLoveHandler({ env: {}, dbPath: path.join(dir, 'l.db') }));
  assert.equal((await a('POST', '/?m=meetup-1')).body.count, 1);
  assert.equal((await a('POST', '/?m=meetup-2')).body.count, 1);
  assert.equal((await a('GET', '/?m=meetup-1')).body.count, 1);
  assert.equal((await a('POST', "/?m=a'b;drop")).body.error, 'bad_meetup');
});

test('loves: a missing database answers 503, never crashes', async () => {
  const res = await browser(createLoveHandler({ env: { VERCEL: '1' } }))('POST');
  assert.equal(res.body.error, 'counter_unavailable');
});
