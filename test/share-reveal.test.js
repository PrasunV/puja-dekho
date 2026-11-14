import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createReveal, REST_MS, TEXT_MS } from '../src/jagadhatri/shareReveal.js';

/** A clock the test moves by hand. */
function clock() {
  let now = 0;
  /** @type {{ at: number, fn: () => void, id: number }[]} */
  let queue = [];
  let n = 0;
  return {
    set: /** @type {typeof setTimeout} */ (
      /** @type {unknown} */ (
        (fn, ms) => {
          const id = ++n;
          queue.push({ at: now + ms, fn, id });
          return id;
        }
      )
    ),
    clear: /** @type {typeof clearTimeout} */ (
      /** @type {unknown} */ (
        (id) => {
          queue = queue.filter((q) => q.id !== id);
        }
      )
    ),
    tick(ms) {
      const end = now + ms;
      for (;;) {
        const next = queue.filter((q) => q.at <= end).sort((a, b) => a.at - b.at)[0];
        if (!next) break;
        queue = queue.filter((q) => q !== next);
        now = next.at;
        next.fn();
      }
      now = end;
    },
  };
}

function setup(reduced = false) {
  const c = clock();
  /** @type {{ shown: boolean, expanded: boolean }} */
  let state = { shown: false, expanded: false };
  const r = createReveal({ onChange: (s) => (state = s), reduced, set: c.set, clear: c.clear });
  return { c, r, get: () => state };
}

test('nothing shows until the app is ready', () => {
  const { r, get } = setup();
  r.setBlocked(false);
  assert.deepEqual(get(), { shown: false, expanded: false });
});

test('on load it shows with its words, then shrinks to the icon after 3 s', () => {
  const { c, r, get } = setup();
  r.setReady(true);
  assert.deepEqual(get(), { shown: true, expanded: true });
  c.tick(TEXT_MS - 1);
  assert.equal(get().expanded, true);
  c.tick(1);
  assert.deepEqual(get(), { shown: true, expanded: false });
});

test('any interaction hides it at once, and ends the words', () => {
  const { r, get } = setup();
  r.setReady(true);
  r.setBlocked(true);
  assert.deepEqual(get(), { shown: false, expanded: false });
});

test('after an interaction it comes back as the icon only', () => {
  const { c, r, get } = setup();
  r.setReady(true);
  c.tick(TEXT_MS);
  r.setBlocked(true);
  r.setBlocked(false);
  assert.deepEqual(get(), { shown: true, expanded: false });
});

test('a rest of 10 s shows the words once, then they shrink', () => {
  const { c, r, get } = setup();
  r.setReady(true);
  c.tick(TEXT_MS);
  r.setBlocked(true);
  r.setBlocked(false);
  c.tick(REST_MS - 1);
  assert.equal(get().expanded, false);
  c.tick(1);
  assert.deepEqual(get(), { shown: true, expanded: true });
  c.tick(TEXT_MS);
  assert.deepEqual(get(), { shown: true, expanded: false });
  c.tick(REST_MS * 3);
  assert.equal(get().expanded, false, 'one reminder per rest, never a loop');
});

test('touching again before 10 s resets the rest', () => {
  const { c, r, get } = setup();
  r.setReady(true);
  c.tick(TEXT_MS);
  r.setBlocked(true);
  r.setBlocked(false);
  c.tick(REST_MS - 1000);
  r.setBlocked(true);
  r.setBlocked(false);
  c.tick(REST_MS - 1);
  assert.equal(get().expanded, false);
  c.tick(1);
  assert.equal(get().expanded, true);
});

test('interrupting the words hides the button and cancels the shrink timer', () => {
  const { c, r, get } = setup();
  r.setReady(true);
  c.tick(TEXT_MS);
  r.setBlocked(true);
  r.setBlocked(false);
  c.tick(REST_MS);
  assert.equal(get().expanded, true);
  r.setBlocked(true);
  c.tick(TEXT_MS * 2);
  assert.deepEqual(get(), { shown: false, expanded: false });
});

test('a modal open on load delays the intro until it closes', () => {
  const { c, r, get } = setup();
  r.setBlocked(true);
  r.setReady(true);
  c.tick(REST_MS * 2);
  assert.deepEqual(get(), { shown: false, expanded: false });
  r.setBlocked(false);
  assert.deepEqual(get(), { shown: true, expanded: true });
});

test('reduced motion never shows the words', () => {
  const { c, r, get } = setup(true);
  r.setReady(true);
  assert.deepEqual(get(), { shown: true, expanded: false });
  r.setBlocked(true);
  r.setBlocked(false);
  c.tick(REST_MS * 2);
  assert.deepEqual(get(), { shown: true, expanded: false });
});
