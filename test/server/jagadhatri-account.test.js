import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createAccountHandler } from '../../server/jagadhatri/account.js';

const CLIENT = 'test-client.apps.googleusercontent.com';
const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'k1', alg: 'RS256', use: 'sig' };
const fakeFetch = async () => ({ ok: true, headers: new Map([['cache-control', 'max-age=3600']]), json: async () => ({ keys: [jwk] }) });

function token(claims, key = privateKey, kid = 'k1') {
  const b = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const head = b({ alg: 'RS256', kid, typ: 'JWT' });
  const body = b({
    iss: 'https://accounts.google.com',
    aud: CLIENT,
    sub: '1234567890',
    name: 'Ananya Das',
    picture: 'https://lh3.googleusercontent.com/a/x',
    email: 'a@example.com',
    exp: Math.floor(Date.now() / 1000) + 600,
    ...claims,
  });
  const sig = crypto.sign('RSA-SHA256', Buffer.from(`${head}.${body}`), key).toString('base64url');
  return `${head}.${body}.${sig}`;
}

function setup() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pd-jg-account-'));
  const handler = createAccountHandler({
    env: { SECRET: 'test-secret' },
    dbPath: path.join(dir, 'a.db'),
    fetchImpl: /** @type {any} */ (fakeFetch),
    clientId: CLIENT,
  });
  let cookie = '';
  const call = (method, body, extraHeaders = {}) =>
    new Promise((resolve) => {
      const headers = {};
      const res = {
        statusCode: 200,
        setHeader: (k, v) => (headers[k.toLowerCase()] = v),
        end: (text) => {
          const set = headers['set-cookie'];
          if (set) cookie = String(set).split(';')[0];
          resolve({ status: res.statusCode, body: JSON.parse(text), headers });
        },
      };
      const req = { method, headers: { cookie, host: 'puja-dekho.vercel.app', ...extraHeaders }, body };
      handler(req, res);
    });
  return { call, getCookie: () => cookie, setCookie: (c) => (cookie = c) };
}

test('account: signed out by default', async () => {
  const { call } = setup();
  assert.deepEqual((await call('GET')).body, { user: null, visited: [], wish: [] });
});

test('account: Google sign-in, wish list, visited, sign out; email is never stored', async () => {
  const { call, getCookie } = setup();
  const signin = await call('POST', { action: 'signin', credential: token({}) });
  assert.equal(signin.status, 200);
  assert.deepEqual(signin.body.user, { name: 'Ananya Das', picture: 'https://lh3.googleusercontent.com/a/x' });
  assert.match(
    String(signin.headers['set-cookie']),
    /^jgs=1234567890\.\d+\.[\w-]+; Path=\/api\/jagadhatri; Max-Age=5184000; HttpOnly; SameSite=Lax/,
  );
  assert.ok(!JSON.stringify(signin.body).includes('a@example.com'));

  const w = await call('POST', { action: 'wish', puja: 'bagbazar-sarbojonin', on: true });
  assert.deepEqual(
    w.body.wish.map((x) => x.puja),
    ['bagbazar-sarbojonin'],
  );
  const v = await call('POST', { action: 'visited', puja: 'helapukur-dhar', on: true });
  assert.equal(v.body.visited[0].mode, 'manual');
  assert.equal((await call('POST', { action: 'wish', puja: 'not-a-puja', on: true })).status, 400);
  assert.equal((await call('POST', { action: 'visited', puja: 'helapukur-dhar', on: false })).body.visited.length, 0);

  const me = await call('GET');
  assert.equal(me.body.wish.length, 1);
  assert.ok(getCookie().startsWith('jgs='));
  await call('POST', { action: 'signout' });
  assert.equal((await call('GET')).body.user, null);
});

test('account: refuses forged, foreign, expired tokens, tampered cookies and cross-site posts', async () => {
  const { call, setCookie } = setup();
  const other = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey;
  assert.equal((await call('POST', { action: 'signin', credential: token({}, other) })).status, 401, 'signed by someone else');
  assert.equal((await call('POST', { action: 'signin', credential: token({ aud: 'another-app' }) })).status, 401, 'another app');
  assert.equal((await call('POST', { action: 'signin', credential: token({ iss: 'evil.com' }) })).status, 401, 'not Google');
  assert.equal((await call('POST', { action: 'signin', credential: token({ exp: 1 }) })).body.error, 'token_expired');
  assert.equal((await call('POST', { action: 'signin', credential: 'garbage' })).status, 401);
  setCookie('jgs=1234567890.99999999999999.forged');
  assert.equal((await call('GET')).body.user, null, 'forged cookie ignored');
  assert.equal((await call('POST', { action: 'wish', puja: 'bagbazar-sarbojonin' })).status, 401);
  assert.equal((await call('POST', { action: 'signin', credential: token({}) }, { origin: 'https://evil.example' })).status, 403);
});

test('account: no SECRET means the service says so instead of signing weak cookies', async () => {
  const handler = createAccountHandler({ env: { VERCEL: '1' } });
  const res = await new Promise((resolve) => {
    const r = { statusCode: 200, setHeader() {}, end: (t) => resolve({ status: r.statusCode, body: JSON.parse(t) }) };
    handler({ method: 'GET', headers: {} }, r);
  });
  assert.equal(res.status, 503);
});
