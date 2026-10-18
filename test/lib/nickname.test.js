import assert from 'node:assert/strict';
import test from 'node:test';
import { checkNickname } from '../../server/lib/nickname.js';

test('empty nickname is allowed and becomes null', () => {
  for (const input of [undefined, null, '', '   ']) assert.deepEqual(checkNickname(input), { ok: true, value: null });
});

test('valid nicknames are trimmed and whitespace-collapsed', () => {
  assert.deepEqual(checkNickname('  Rina   Das '), { ok: true, value: 'Rina Das' });
  assert.deepEqual(checkNickname('অনিন্দ্য'), { ok: true, value: 'অনিন্দ্য' });
});

test('length and character rules', () => {
  for (const bad of ['x', 'a'.repeat(21), '<b>hi</b>', 'a@b!!', 42]) assert.equal(checkNickname(bad).ok, false, String(bad));
});

test('abuse is caught through repeats and look-alike characters', () => {
  for (const bad of ['fuuuck', 'Mad4rch0d', 'f.u.c.k']) assert.equal(checkNickname(bad).ok, false, bad);
});

test('strict short-word policy: short words are blocked only as whole words', () => {
  assert.equal(checkNickname('Bal').ok, false);
  assert.equal(checkNickname('Rina Bal').ok, false);
  assert.equal(checkNickname('Balaji').ok, true);
});
