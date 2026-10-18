import assert from 'node:assert/strict';
import test from 'node:test';
import { DWELL_MINUTES, DWELL_REASK_MS } from '../../src/config.js';
import { NO_DWELL, nextDwell } from '../../src/lib/dwell.js';
import { circleRing, inBounds, formatBand, formatDistance, haversine, walkMinutes } from '../../src/lib/geo.js';
import { storage } from '../../src/lib/storage.js';

test('formatDistance / formatBand / walkMinutes', () => {
  assert.equal(formatDistance(347), '350 m');
  assert.equal(formatDistance(1234), '1.2 km');
  assert.equal(formatBand(0), 'Any distance');
  assert.equal(formatBand(500), '500 m');
  assert.equal(formatBand(2000), '2 km');
  assert.equal(walkMinutes(0), 1);
  assert.equal(walkMinutes(750), 13); // 750 * 1.3 / 75
});

test('haversine agrees with the server implementation', async () => {
  const server = await import('../../server/lib/geo.js');
  assert.equal(haversine(22.5, 88.3, 22.6, 88.4), server.haversineMeters(22.5, 88.3, 22.6, 88.4));
});

test('circleRing: a closed ring whose points are all the radius from the centre', () => {
  const ring = circleRing(22.5186, 88.3467, 120);
  assert.equal(ring.length, 65);
  assert.deepEqual(ring[0], ring[64]);
  for (const [lng, lat] of ring) {
    const metres = haversine(22.5186, 88.3467, lat, lng);
    assert.ok(Math.abs(metres - 120) < 1, `point is ${metres} m away`);
  }
});

test('inBounds: inside, outside and on the edge of [west, south, east, north]', () => {
  const box = /** @type {[number, number, number, number]} */ ([88.3, 22.5, 88.4, 22.6]);
  assert.equal(inBounds(22.55, 88.35, box), true);
  assert.equal(inBounds(22.5, 88.3, box), true);
  assert.equal(inBounds(22.7, 88.35, box), false);
  assert.equal(inBounds(22.55, 88.5, box), false);
});

const puja = /** @type {any} */ ({ id: 'p1', la: 22.5, lo: 88.3 });
const elsewhere = /** @type {any} */ ({ id: 'p2', la: 22.6, lo: 88.4 });
const here = { lat: 22.5, lng: 88.3 };

test('dwell: asks only after the stay is long enough, and not again within the cool-off', () => {
  const minute = 60_000;
  const t0 = 1_800_000_000_000; // a realistic Date.now()
  const pujas = [puja, elsewhere];
  let step = nextDwell(NO_DWELL, here, pujas, t0, {});
  assert.equal(step.ask, null);
  step = nextDwell(step.state, here, pujas, t0 + (DWELL_MINUTES - 1) * minute, {});
  assert.equal(step.ask, null);
  const due = t0 + DWELL_MINUTES * minute;
  step = nextDwell(step.state, here, pujas, due, {});
  assert.equal(step.ask?.id, 'p1');
  assert.equal(nextDwell(step.state, here, pujas, due, { p1: due - 1000 }).ask, null);
  assert.equal(nextDwell(step.state, here, pujas, due, { p1: due - DWELL_REASK_MS - 1 }).ask?.id, 'p1');
});

test('dwell: walking away resets the clock', () => {
  const far = { lat: 22.55, lng: 88.35 };
  const first = nextDwell(NO_DWELL, here, [puja], 1000, {});
  assert.equal(nextDwell(first.state, far, [puja], 2000, {}).state, NO_DWELL);
});

test('storage: namespaced, never throws, handles bad JSON and missing storage', () => {
  const data = new Map();
  globalThis.localStorage = /** @type {any} */ ({
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
  });
  assert.equal(storage.get('nope', 'fallback'), 'fallback');
  storage.set('nick', 'Rina');
  assert.equal(data.get('pd_nick'), '"Rina"');
  data.set('pd_broken', '{not json');
  assert.equal(storage.get('broken', 7), 7);
  globalThis.localStorage = /** @type {any} */ (undefined);
  assert.equal(storage.get('x', 1), 1);
  assert.doesNotThrow(() => storage.set('x', 1));
});
