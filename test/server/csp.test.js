import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { SECURITY_HEADERS } from '../../server/http/security.js';

test('vercel.json sends the same security headers as the Express server', () => {
  const config = JSON.parse(fs.readFileSync(new URL('../../vercel.json', import.meta.url), 'utf8'));
  const rule = config.headers.find((entry) => entry.source === '/(.*)');
  const fromVercel = Object.fromEntries(rule.headers.map(({ key, value }) => [key, value]));
  assert.deepEqual(fromVercel, { ...SECURITY_HEADERS });
});
