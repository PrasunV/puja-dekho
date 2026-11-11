import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { countsByRadius, formatDistance, makeIndex, NO_FILTERS, normalise, passes, search, visibleList } from '../../src/jagadhatri/lib.js';

const data = JSON.parse(fs.readFileSync(new URL('../../public/jagadhatripuja/data/pujas.json', import.meta.url), 'utf8'));
// The app indexes Must visit pujas first, so ties go to the better-known puja.
const index = makeIndex(
  visibleList(data.pujas, NO_FILTERS, null).map((r) => r.puja),
  (p) => ({ main: p.n, extra: [p.t, p.bn || ''] }),
);
const stations = makeIndex(data.stations, (s) => ({ main: s.name }));
const names = (q, idx = /** @type {any} */ (index)) => search(idx, q).map((/** @type {any} */ x) => x.n ?? x.name);

test('jagadhatri data: 207 pujas, 7 entry points, unique ids', () => {
  assert.equal(data.pujas.length, 207);
  assert.equal(data.stations.length, 7);
  assert.equal(new Set(data.pujas.map((p) => p.id)).size, 207);
  assert.equal(data.pujas.filter((p) => p.pop).length, 27);
  assert.equal(data.pujas.filter((p) => p.pr).length, 68);
});

test('jagadhatri search: names, typos and spelling variants', () => {
  assert.ok(names('bagbazar').includes('Bagbazar Sarbojonin'));
  assert.equal(names('bagbazar sarbajanin')[0], 'Bagbazar Sarbojonin', 'sarbajanin matches sarbojonin');
  assert.ok(names('helapukr').includes('Helapukur Dhar'), 'small typo');
  assert.ok(names('mankundu tentultala').length > 0);
  assert.deepEqual(normalise('Chandernagore'), ['chandannagar']);
  assert.deepEqual(normalise('Chinsurah'), ['chuchura']);
  assert.equal(names('chinsurah', stations)[0], 'Chuchura Station');
  assert.equal(names('rani ghaat', stations)[0], 'Rani Ghat');
  assert.equal(names('Chandernagore', stations)[0], 'Chandannagar Station');
  assert.deepEqual(names('zzzzqqq'), []);
});

test('jagadhatri list: must visit first, radius filter nearest first', () => {
  const list = visibleList(data.pujas, NO_FILTERS, null);
  assert.equal(list.length, 207);
  assert.ok(list.slice(0, 27).every((r) => r.puja.pop));
  const rani = data.stations.find((s) => s.id === 'rani-ghat');
  const near = visibleList(data.pujas, NO_FILTERS, { kind: 'station', lat: rani.la, lng: rani.lo, radius: 1000 });
  const ds = near.map((r) => Number(r.d));
  assert.ok(ds.length > 0 && ds.every((d, i) => d <= 1000 && (i === 0 || ds[i - 1] <= d)));
  const counts = countsByRadius(data.pujas, NO_FILTERS, rani.la, rani.lo, [500, 1000]);
  assert.equal(counts[1000], near.length);
  assert.equal(passes(data.pujas[0], { ...NO_FILTERS, type: 'Adi Puja' }), data.pujas[0].c === 'Adi Puja');
});

test('jagadhatri distance format', () => {
  assert.equal(formatDistance(463), '460 m');
  assert.equal(formatDistance(1410), '1.4 km');
  assert.equal(formatDistance(998), '1.0 km');
});

// ---- v0.2 badges ----
import { istDay, progressTo, rankOf, statsOf, unlocked, unlockLine } from '../../src/jagadhatri/ranks.js';

test('only in-person visits count, by IST day', () => {
  const now = Date.UTC(2026, 10, 16, 20, 0); // 17 Nov 01:30 IST
  const v = (puja, mode, day) => ({ puja, mode, at: 0, day });
  const s = statsOf(
    [v('a', 'person', istDay(now)), v('b', 'person', istDay(now)), v('c', 'manual', istDay(now)), v('d', 'person', '2026-11-15')],
    now,
  );
  assert.deepEqual(s, { today: 2, total: 3, best: 2 });
});

test('E-Rank comes with D-Rank; next rank and its line', () => {
  assert.equal(unlocked({ best: 5, total: 5 }, 0), true);
  assert.equal(unlocked({ best: 2, total: 10 }, 0), true);
  assert.equal(unlocked({ best: 4, total: 9 }, 0), false);
  assert.deepEqual(rankOf({ best: 2, total: 12, today: 0 }), { cur: 1, next: 2 });
  assert.equal(unlockLine(progressTo({ best: 2, total: 22, today: 0 }, 2)), 'Complete 3 more pujas to unlock it');
  assert.equal(unlockLine(progressTo({ best: 4, total: 4, today: 4 }, 0)), 'Complete 1 more puja today to unlock it');
});

// ---- v0.2 "Are you visiting?" ----
import { agoText, NO_STAY, nextStay, stayedLongEnough } from '../../src/jagadhatri/visit.js';

test('asks only after 2 minutes within 100 m of the same puja', () => {
  const p = data.pujas[0];
  const at = (dLat, acc = 10) => ({ lat: p.la + dLat, lng: p.lo, accuracy: acc });
  let s = nextStay(NO_STAY, at(0.0003), data.pujas, 0); // ~33 m away
  assert.equal(s.id, p.id);
  s = nextStay(s, at(0.0004), data.pujas, 60_000);
  assert.equal(stayedLongEnough(s, 60_000), false);
  assert.equal(stayedLongEnough(nextStay(s, at(0.0002), data.pujas, 120_000), 120_000), true);
  // An imprecise fix changes nothing; walking away ends the stay.
  assert.equal(nextStay(s, at(0.01, 300), data.pujas, 90_000), s);
  assert.equal(nextStay(s, { lat: 22.0, lng: 88.0, accuracy: 10 }, data.pujas, 90_000).id, null);
});

test('crowd filters and time text', () => {
  const [a, b] = data.pujas;
  const crowd = { [a.id]: { level: 'free' }, [b.id]: { level: 'crowded' } };
  assert.equal(passes(a, { ...NO_FILTERS, freeNow: true, crowd }), true);
  assert.equal(passes(b, { ...NO_FILTERS, freeNow: true, crowd }), false);
  assert.equal(passes(b, { ...NO_FILTERS, hideCrowded: true, crowd }), false);
  assert.equal(passes(data.pujas[3], { ...NO_FILTERS, hideCrowded: true, crowd }), true);
  assert.equal(agoText(0, 12 * 60_000), '12 min ago');
  assert.equal(agoText(0, 20_000), 'just now');
});

// ---- v0.2 badge sharing ----
import { rareLine } from '../../src/jagadhatri/ranks.js';

test('share lines say what earned the badge', () => {
  assert.equal(rareLine(0, 3), '5 pujas in one day');
  assert.equal(rareLine(2, 31), '31 pujas visited');
  assert.equal(rareLine(1, 4), '10 pujas visited');
});

// ---- Traffic notice status ----
import { trafficStatus } from '../../src/jagadhatri/traffic.js';

test('traffic status follows the police hours (India time)', () => {
  const ist = (d, h, m = 0) => Date.UTC(2026, 10, d, h, m) - 330 * 60_000;
  assert.equal(trafficStatus(ist(11, 16)).line, 'Starts Fri 13 Nov, 12:00 PM');
  assert.equal(trafficStatus(ist(13, 12, 30)).line, 'Vehicles stopped now · until 6:00 AM tomorrow');
  assert.equal(trafficStatus(ist(14, 3)).line, 'Vehicles stopped now · until 6:00 AM');
  assert.equal(trafficStatus(ist(14, 10)).line, 'Roads open now · closes at 2:00 PM');
  assert.equal(trafficStatus(ist(19, 8)).line, 'Vehicles stopped now · until immersion ends');
  assert.equal(trafficStatus(ist(21, 1)).state, 'ended');
});
