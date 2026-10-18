import assert from 'node:assert/strict';
import test from 'node:test';
import { buildDirectionLinks, nearestToStation, orderStops } from '../../src/lib/tour.js';

/** Pujas on a line along the equator-ish, 0.01 degrees apart, so the best route is obvious. */
const line = Object.fromEntries(['a', 'b', 'c', 'd', 'e'].map((id, i) => [id, { id, la: 22.5, lo: 88.3 + i * 0.01, ck: true }]));
const byId = /** @type {Map<string, any>} */ (new Map(Object.entries(line)));

test('orderStops: returns the shortest open path along a line, from either end', () => {
  const shuffled = ['c', 'a', 'e', 'b', 'd'];
  const order = orderStops(shuffled, null, byId);
  assert.ok(['a,b,c,d,e', 'e,d,c,b,a'].includes(order.join(',')), order.join(','));
});

test('orderStops: respects a fixed start', () => {
  const start = { la: 22.5, lo: 88.3 + 0.041 }; // right next to "e"
  assert.deepEqual(orderStops(['a', 'b', 'c', 'd', 'e'], start, byId), ['e', 'd', 'c', 'b', 'a']);
});

test('orderStops: handles 0, 1 and 2 stops', () => {
  assert.deepEqual(orderStops([], null, byId), []);
  assert.deepEqual(orderStops(['a'], null, byId), ['a']);
  assert.equal(orderStops(['a', 'b'], null, byId).length, 2);
});

test('nearestToStation: nearest first, only exact pins', () => {
  const pujas = /** @type {any[]} */ ([...Object.values(line), { id: 'bad', la: 22.5, lo: 88.3, ck: false }]);
  const station = /** @type {any} */ ({ lat: 22.5, lng: 88.3 + 0.035 });
  assert.deepEqual(nearestToStation(pujas, station, 2), ['d', 'e']);
});

test('buildDirectionLinks: chunks overlap by one point and stay within 10 points per link', () => {
  const stops = Array.from({ length: 20 }, (_, i) => ({ la: 22 + i / 100, lo: 88 }));
  const links = buildDirectionLinks(null, stops);
  assert.equal(links.length, 3); // 20 points -> windows of 10 stepping by 9
  for (const link of links) {
    const waypoints = new URL(link).searchParams.get('waypoints');
    assert.ok((waypoints ? waypoints.split('|').length : 0) <= 8);
  }
  assert.equal(buildDirectionLinks(null, [stops[0]]).length, 0);
});
