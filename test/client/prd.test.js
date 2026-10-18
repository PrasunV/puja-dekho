import assert from 'node:assert/strict';
import test from 'node:test';
import { slotFor, typicalCrowd, crowdText } from '../../src/lib/crowd.js';
import { NO_NEAR, nextNear, skipNear, dismissNear } from '../../src/lib/near.js';
import { parseRoute, routeLabel, walkingRoute } from '../../src/lib/route.js';
import { headline } from '../../src/lib/headline.js';

const at = (/** @type {string} */ hhmm) => new Date(`2026-10-18T${hhmm}:00+05:30`);

test('crowd: slot follows the Kolkata clock and wording says "usually"', () => {
  assert.ok(slotFor(at('20:30')));
  const level = typicalCrowd({ id: 'x' }, at('20:30'));
  assert.ok(level === null || ['Low', 'Moderate', 'High'].includes(level));
  if (level) assert.match(crowdText(level), /^Usually /);
});

const puja = (/** @type {string} */ id, /** @type {number} */ la, /** @type {number} */ lo) => /** @type {any} */ ({ id, la, lo, n: id });
const A = puja('a', 22.5, 88.35);
const here = (/** @type {number} */ acc, dLat = 0) => ({ lat: 22.5 + dLat, lng: 88.35, acc });

test('near: needs 60 s inside 100 m with 50 m accuracy', () => {
  let s = nextNear(NO_NEAR, here(20), [A], 0);
  assert.equal(s.active, null);
  s = nextNear(s, here(20), [A], 59_000);
  assert.equal(s.active, null);
  s = nextNear(s, here(20), [A], 60_000);
  assert.equal(s.active, 'a');
});

test('near: poor accuracy offers nothing and resets the clock', () => {
  let s = nextNear(NO_NEAR, here(20), [A], 0);
  s = nextNear(s, here(80), [A], 30_000);
  s = nextNear(s, here(20), [A], 70_000);
  assert.equal(s.active, null);
});

test('near: stays until 150 m, dismissed pujas do not return', () => {
  let s = nextNear(NO_NEAR, here(20), [A], 0);
  s = nextNear(s, here(20), [A], 60_000);
  s = nextNear(s, here(20, 0.0012), [A], 61_000); // about 133 m: still active
  assert.equal(s.active, 'a');
  s = nextNear(s, here(20, 0.002), [A], 62_000); // about 222 m: cleared
  assert.equal(s.active, null);
  let t = nextNear(NO_NEAR, here(20), [A], 0);
  t = nextNear(t, here(20), [A], 60_000);
  t = dismissNear(t);
  t = nextNear(t, here(20), [A], 120_000);
  assert.equal(t.active, null);
});

test('near: "Not this one?" moves to the next puja', () => {
  const B = puja('b', 22.50005, 88.35);
  let s = nextNear(NO_NEAR, here(20), [A, B], 0);
  s = nextNear(s, here(20), [A, B], 60_000);
  assert.equal(s.active, 'a');
  s = nextNear(skipNear(s), here(20), [A, B], 61_000);
  assert.equal(s.active, 'b');
});

test('route: parses ORS GeoJSON, rejects junk, and fails soft', async () => {
  const body = {
    features: [
      {
        properties: { summary: { distance: 5800, duration: 4860 } },
        geometry: {
          coordinates: [
            [88.1, 22.1],
            [88.2, 22.2],
          ],
        },
      },
    ],
  };
  assert.deepEqual(parseRoute(body)?.coords, [
    [88.1, 22.1],
    [88.2, 22.2],
  ]);
  assert.equal(parseRoute(body)?.distance, 5800);
  assert.equal(parseRoute({}), null);
  assert.equal(await walkingRoute(A, A, { key: '' }), null);
  const bad = /** @type {any} */ (async () => ({ ok: false }));
  assert.equal(await walkingRoute(A, A, { key: 'k', fetcher: bad }), null);
  const boom = /** @type {any} */ (
    async () => {
      throw new Error('offline');
    }
  );
  assert.equal(await walkingRoute(A, A, { key: 'k', fetcher: boom }), null);
  const ok = /** @type {any} */ (async () => ({ ok: true, json: async () => body }));
  assert.equal((await walkingRoute(A, A, { key: 'k', fetcher: ok }))?.coords.length, 2);
});

test('headline: says what is applied', () => {
  const base = { located: true, count: 12, radius: 500, filterCount: 0, stationName: null, defaultRadius: 500 };
  assert.equal(headline(base), '12 pujas near you');
  assert.equal(headline({ ...base, radius: 5000 }), '12 pujas within 5 km');
  assert.equal(headline({ ...base, count: 1 }), '1 puja near you');
  assert.equal(headline({ ...base, filterCount: 2 }), '12 pujas, 2 filters');
  assert.equal(headline({ ...base, located: false, count: 271 }), '271 pujas in Kolkata');
  assert.equal(headline({ ...base, stationName: 'Jatin Das Park' }), '12 pujas near Jatin Das Park');
});

test('route label reads like Google Maps', () => {
  const r = (/** @type {number} */ distance, /** @type {number} */ duration) => ({ coords: [], distance, duration });
  assert.equal(routeLabel(r(5800, 4860)), '1 hr 21 min · 5.8 km');
  assert.equal(routeLabel(r(420, 330)), '6 min · 420 m');
  assert.equal(routeLabel(r(0, 20)), '1 min');
});

test('truncateName: 20 characters then an ellipsis, counted by whole characters', async () => {
  const { truncateName } = await import('../../src/lib/truncate.js');
  assert.equal(truncateName('Short Name'), 'Short Name');
  assert.equal(truncateName('12345678901234567890'), '12345678901234567890');
  assert.equal(truncateName('123456789012345678901'), '12345678901234567890…');
  assert.equal(truncateName('Baghajatin Pally Sarbojanin Durgotsav'), 'Baghajatin Pally Sar…');
  // Bengali: 25 characters (with conjuncts) is cut by grapheme, never mid-character
  const bn = 'কলকাতা সার্বজনীন দুর্গোৎসব সমিতি কলকাতা সার্বজনীন';
  const out = truncateName(bn);
  assert.ok(out.endsWith('…'));
  assert.ok(Array.from(new Intl.Segmenter('bn', { granularity: 'grapheme' }).segment(out)).length <= 21);
});

test('zoneName writes chosen zones in plain words', async () => {
  const { zoneName } = await import('../../src/hooks/usePujaFilters.js');
  assert.equal(zoneName(['north']), 'North Kolkata');
  assert.equal(zoneName(['north', 'south']), 'South & North Kolkata');
  assert.equal(zoneName(['east', 'north', 'south']), 'South, North & East Kolkata');
  assert.equal(zoneName(['other']), 'Other areas');
  assert.equal(zoneName(['central', 'other']), 'Central Kolkata, Other areas');
});
