import assert from 'node:assert/strict';
import test from 'node:test';
import { haversineMeters } from '../../server/lib/geo.js';
import { weightedMedian } from '../../server/lib/stats.js';

test('weightedMedian: empty, single, and weight-dominated cases', () => {
  assert.equal(weightedMedian([]), null);
  assert.equal(weightedMedian([{ value: 2, weight: 1 }]), 2);
  assert.equal(
    weightedMedian([
      { value: 0, weight: 1 },
      { value: 3, weight: 5 },
    ]),
    3,
  );
  assert.equal(
    weightedMedian([
      { value: 1, weight: 1 },
      { value: 2, weight: 1 },
      { value: 3, weight: 1 },
    ]),
    2,
  );
});

test('haversineMeters: zero for the same point and about 111 km per degree of latitude', () => {
  assert.equal(haversineMeters(22.5, 88.3, 22.5, 88.3), 0);
  assert.ok(Math.abs(haversineMeters(22, 88, 23, 88) - 111_195) < 200);
});
