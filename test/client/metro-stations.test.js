import assert from 'node:assert/strict';
import test from 'node:test';
import { dayKind, isClosed, lineToday, pujaRows } from '../../src/lib/schedule.js';
import { outlookText, stationOutlook } from '../../src/lib/stations.js';

const st = (/** @type {string} */ id, /** @type {number} */ lat, /** @type {number} */ lng, lines = ['blue']) =>
  /** @type {any} */ ({ id, name: id, lat, lng, lines });
const pj = (/** @type {string} */ id, /** @type {number} */ la, /** @type {number} */ lo) => /** @type {any} */ ({ id, la, lo, n: id });
const deg = (/** @type {number} */ metres) => metres / 111_000; // metres north

const A = st('a', 22.5, 88.35);
const FAR = st('far', 22.7, 88.35);
const NEARBY = st('nearby', 22.5 + deg(3000), 88.35);
const CLOSED = st('kavi-subhas', 22.5 + deg(2000), 88.35);

test('outlook: pujas within 1 km win', () => {
  const o = stationOutlook(A, [A], [pj('p', 22.5 + deg(500), 88.35)]);
  assert.deepEqual([o.radius, o.count, o.nearest], [1000, 1, null]);
  assert.equal(outlookText(o), '1 puja within 1 km');
});

test('outlook: none within 1 km falls back to the 5 km count', () => {
  const pujas = [pj('p', 22.5 + deg(3000), 88.35), pj('q', 22.5 + deg(4000), 88.35), pj('r', 22.5 + deg(9000), 88.35)];
  const o = stationOutlook(A, [A], pujas);
  assert.deepEqual([o.radius, o.count, o.near], [5000, 2, 0]);
  assert.equal(outlookText(o), '2 pujas within 5 km');
});

test('outlook: none within 5 km points to the nearest open station that has pujas, never a closed one', () => {
  const pujas = [pj('p', FAR.lat, FAR.lng), pj('c', CLOSED.lat, CLOSED.lng), pj('n', NEARBY.lat, NEARBY.lng)];
  const o = stationOutlook(FAR, [FAR, A, NEARBY, CLOSED], pujas);
  assert.equal(o.count, 1); // its own puja is within 1 km
  const closedFar = st('kavi-subhas', 22.5 + deg(6000), 88.35);
  const openFar = st('open-far', 22.5 + deg(8000), 88.35);
  const lonely = stationOutlook(A, [A, closedFar, openFar], [pj('c', closedFar.lat, closedFar.lng), pj('o', openFar.lat, openFar.lng)]);
  assert.equal(lonely.count, 0);
  assert.equal(lonely.nearest?.station.id, 'open-far'); // the closer station is closed, so it is skipped
  assert.match(outlookText(lonely), /^No pujas within 5 km\. Nearest with pujas: /);
});

test('outlook: no station anywhere has pujas', () => {
  const o = stationOutlook(A, [A], []);
  assert.equal(o.nearest, null);
  assert.equal(outlookText(o), 'No pujas within 5 km');
});

test('closed stations are known', () => {
  assert.equal(isClosed('kavi-subhas'), true);
  assert.equal(isClosed('kalighat'), false);
});

const metro = /** @type {any} */ ({
  phases: [
    { id: 'ps', label: 'Panchami / Shashthi', from: '2026-10-15', to: '2026-10-16' },
    { id: 'sn', label: 'Saptami to Navami', from: '2026-10-18', to: '2026-10-20' },
  ],
  timings: {
    'Blue (x)': { Panchami_Shashthi: '06:00-23:00', Saptami_to_Navami: '13:00-04:00 next morning', Dashami: '13:00-22:30' },
    'Green (x)': { Panchami_Shashthi: '06:00-23:00', Saptami_to_Navami: '13:30-03:59' },
  },
});
const at = (/** @type {string} */ iso) => new Date(`${iso}+05:30`);

test('dayKind uses the Kolkata clock', () => {
  assert.equal(dayKind(at('2026-10-18T10:00:00')), 'sunday');
  assert.equal(dayKind(at('2026-10-17T10:00:00')), 'saturday');
  assert.equal(dayKind(at('2026-10-14T10:00:00')), 'weekday');
  assert.equal(dayKind(new Date('2026-10-17T20:00:00Z')), 'sunday'); // 01:30 IST on the 18th
});

test('lineToday: Puja hours lead inside the Puja window, regular hours outside', () => {
  const puja = lineToday(metro, 'blue', at('2026-10-18T10:00:00'));
  assert.equal(puja.headline, 'Today (Puja special): 13:00 – 04:00 next morning');
  assert.equal(puja.regularHours, '09:00 – 22:30');
  const plain = lineToday(metro, 'green', at('2026-10-12T10:00:00'));
  assert.equal(plain.headline, 'Today (Mon to Fri): 06:00 – 22:30');
  assert.equal(plain.pujaHours, null);
});

test('pujaRows marks the row that applies today', () => {
  const rows = pujaRows(metro, 'blue', at('2026-10-18T10:00:00'));
  assert.deepEqual(
    rows.map((r) => r.today),
    [false, true],
  );
});
