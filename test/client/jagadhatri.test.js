import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {
  countsByRadius,
  formatDistance,
  makeIndex,
  NO_FILTERS,
  normalise,
  passes,
  pujasOf,
  search,
  typeNoun,
  visibleList,
} from '../../src/jagadhatri/lib.js';
import { EVENTS } from '../../src/jagadhatri/config.js';
import {
  capacityText,
  IMMERSION_FROM,
  IMMERSION_TO,
  immersionState,
  NO_ENTRY,
  noEntryId,
  PARKING,
  trafficSpots,
} from '../../src/jagadhatri/immersion-traffic.js';
import { AWARDS, awardsOf, placeLabel, WINNERS_EVENT_ID } from '../../src/jagadhatri/winners.js';

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
import { pujaNight as istDay, progressTo, rankOf, statsOf, unlocked, unlockLine } from '../../src/jagadhatri/ranks.js';

test('every visit counts, by puja night', () => {
  const now = Date.UTC(2026, 10, 16, 20, 0); // 17 Nov 01:30 IST
  const v = (puja, mode, day) => ({ puja, mode, at: 0, day });
  const s = statsOf(
    [v('a', 'person', istDay(now)), v('b', 'person', istDay(now)), v('c', 'manual', istDay(now)), v('d', 'person', '2026-11-15')],
    now,
  );
  assert.deepEqual(s, { today: 3, total: 4, best: 3 });
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
import {
  agoText,
  AUTO_HIDE_MS,
  canAsk,
  lateLine,
  lateQueue,
  MAX_LATE,
  noteAnswered,
  noteAsked,
  noteNear,
  QUIET_MS,
  SNOOZE_MS,
  sayNo,
  visitCandidate,
} from '../../src/jagadhatri/visit.js';

/** A tiny localStorage for these tests, since the app's storage keeps things on the phone. */
const mem = new Map();
Object.assign(globalThis, {
  localStorage: {
    getItem: (/** @type {string} */ k) => mem.get(k) ?? null,
    setItem: (/** @type {string} */ k, /** @type {string} */ v) => mem.set(k, v),
  },
});

test('asks about the nearest puja within 150 m, from a fresh and precise fix', () => {
  const p = data.pujas[0];
  const now = Date.parse('2026-11-17T21:00:00+05:30');
  const at = (/** @type {number} */ dLat, acc = 10, age = 1_000) => ({ lat: p.la + dLat, lng: p.lo, accuracy: acc, at: now - age });
  assert.equal(visitCandidate(at(0.0012), data.pujas, now)?.id, p.id); // ~133 m
  assert.equal(visitCandidate(at(0.0016), data.pujas, now)?.id === p.id, false); // ~178 m: not asked about this one
  // An old fix (the camera app paused location), a loose fix and no fix ask nothing.
  assert.equal(visitCandidate(at(0.0003, 10, 60_000), data.pujas, now), null);
  assert.equal(visitCandidate(at(0.0003, 120), data.pujas, now), null);
  assert.equal(visitCandidate(null, data.pujas, now), null);
  assert.equal(visitCandidate({ lat: 22.0, lng: 88.0, accuracy: 10, at: now }, data.pujas, now), null);
});

test('the bar remembers what it asked, so a reload never repeats a question', () => {
  mem.clear();
  const t = Date.parse('2026-11-17T21:00:00+05:30');
  assert.equal(canAsk('a', t), true);
  noteAsked('a', t); // the bar went up
  assert.equal(canAsk('a', t + 5_000), false, 'not again right after, even after a reload');
  assert.equal(canAsk('a', t + SNOOZE_MS - 1), false);
  assert.equal(canAsk('a', t + SNOOZE_MS + 1), true, 'an ignored bar comes back after an hour');
  noteAnswered('a', t + 10_000); // Yes
  assert.equal(canAsk('a', t + 6 * 60 * 60_000), false, 'answered: not again tonight, even after midnight (up to 3 AM)');
  assert.equal(canAsk('b', t + 10_000 + QUIET_MS - 1), false, 'no bar for any puja for 2 minutes after an answer');
  assert.equal(canAsk('b', t + 10_000 + QUIET_MS + 1), true);
  assert.equal(canAsk('a', t + 24 * 60 * 60_000 + 60_000), true, 'the next night starts fresh');
});

test('No means not again today for that puja', () => {
  mem.clear();
  const t = Date.parse('2026-11-17T21:00:00+05:30');
  sayNo('c', t);
  assert.equal(canAsk('c', t + 5 * 60 * 60_000), false, 'still no at 2 AM');
  assert.equal(canAsk('c', t + 20 * 60 * 60_000), true, 'asked again the next night');
  assert.equal(canAsk('d', t + QUIET_MS + 1), true);
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
import { badgeSvg, RANKS, rareLine } from '../../src/jagadhatri/ranks.js';

test('share lines say what earned the badge', () => {
  assert.equal(rareLine(0, 3), '5 pujas in one day');
  assert.equal(rareLine(2, 31), '31 pujas visited');
  assert.equal(rareLine(1, 4), '10 pujas visited');
});

// ---- Visited: check-ins and marks count alike, by puja night ----
import { pujaNight } from '../../src/jagadhatri/ranks.js';
import { applyLocal } from '../../src/jagadhatri/account.js';

test('the puja night runs until 5 AM', () => {
  assert.equal(pujaNight(Date.parse('2026-11-16T23:30:00+05:30')), '2026-11-16');
  assert.equal(pujaNight(Date.parse('2026-11-17T01:10:00+05:30')), '2026-11-16', 'after midnight is still the same night');
  assert.equal(pujaNight(Date.parse('2026-11-17T04:59:00+05:30')), '2026-11-16');
  assert.equal(pujaNight(Date.parse('2026-11-17T05:01:00+05:30')), '2026-11-17');
});

test('a mark counts for badges like a check-in', () => {
  const now = Date.parse('2026-11-16T23:00:00+05:30');
  const v = (puja, mode, at) => ({ puja, mode, at, day: pujaNight(at) });
  const visited = [
    v('a', 'person', now),
    v('b', 'manual', now + 60_000),
    v('c', 'manual', now + 2 * 3600_000), // 1 AM, same night
    v('d', 'person', now - 24 * 3600_000),
  ];
  const s = statsOf(visited, now);
  assert.equal(s.total, 4);
  assert.equal(s.today, 3);
  assert.equal(s.best, 3);
});

test('marking by hand stamps the puja night', () => {
  const at = Date.parse('2026-11-17T01:00:00+05:30');
  const next = applyLocal({ user: null, visited: [], wish: [] }, { action: 'visited', puja: 'x', on: true }, at);
  assert.equal(next.visited[0].mode, 'manual');
  assert.equal(next.visited[0].day, '2026-11-16');
});

test('the Visited filter keeps only visited pujas', () => {
  const [a, b] = data.pujas;
  const mine = { wish: new Set(), visited: new Set([a.id]) };
  assert.equal(passes(a, { ...NO_FILTERS, visitedOnly: true, mine }), true);
  assert.equal(passes(b, { ...NO_FILTERS, visitedOnly: true, mine }), false);
});

test('Have you visited: asks about pujas you were near once you have walked on', () => {
  mem.clear();
  const [a, b] = data.pujas;
  const t = Date.parse('2026-11-17T21:00:00+05:30');
  const fix = (/** @type {{ la: number, lo: number }} */ q, /** @type {number} */ dLat, at = t) => ({
    lat: q.la + dLat,
    lng: q.lo,
    accuracy: 10,
    at,
  });
  assert.equal(AUTO_HIDE_MS, 60_000, 'the live bar fades after a minute');
  noteNear(fix(a, 0.0005), data.pujas, t); // 55 m from a: seen
  const later = t + 10 * 60_000;
  // Still within 200 m: it is the live bar's job, not this one's.
  assert.equal(
    lateQueue(fix(a, 0.001, later), data.pujas, later, new Set(), false).some((x) => x.puja.id === a.id),
    false,
  );
  // Walked on (about 330 m): ask.
  const q = lateQueue(fix(a, 0.003, later), data.pujas, later, new Set(), false);
  assert.equal(q[0].puja.id, a.id);
  assert.equal(q[0].kind, 'seen');
  assert.equal(lateLine(q[0]), 'You were near it at 9:00 PM');
  // Not if already visited / asked this time, said No to, or answered.
  assert.equal(lateQueue(fix(a, 0.003, later), data.pujas, later, new Set([a.id]), false).length, 0);
  sayNo(a.id, later);
  assert.equal(
    lateQueue(fix(a, 0.003, later + QUIET_MS + 1), data.pujas, later + QUIET_MS + 1, new Set(), false).length,
    0,
    'No skips it tonight',
  );
  void b;
});

test('Have you visited: the open-time question adds pujas 150-300 m away, nearest first, at most five', () => {
  mem.clear();
  const base = data.pujas[0];
  const t = Date.parse('2026-11-17T21:00:00+05:30');
  const pos = { lat: base.la, lng: base.lo, accuracy: 10, at: t };
  const open = lateQueue(pos, data.pujas, t, new Set(), true);
  assert.ok(open.length <= MAX_LATE);
  assert.ok(open.every((x) => x.d > 150 && x.d <= 300 && x.kind === 'now'));
  assert.deepEqual(
    open.map((x) => x.d),
    [...open.map((x) => x.d)].sort((x, y) => x - y),
  );
  assert.equal(lateQueue(pos, data.pujas, t, new Set(), false).length, 0, 'the live check alone adds nothing near-now');
  // No fresh, precise fix: silent.
  assert.equal(lateQueue({ ...pos, at: t - 60_000 }, data.pujas, t, new Set(), true).length, 0);
  assert.equal(lateQueue({ ...pos, accuracy: 120 }, data.pujas, t, new Set(), true).length, 0);
  assert.equal(lateQueue(null, data.pujas, t, new Set(), true).length, 0);
  if (open[0]) assert.match(lateLine(open[0]), /^Near you now · \d+ m$/);
  noteAnswered('x', t);
  assert.equal(lateQueue(pos, data.pujas, t + 1_000, new Set(), true).length, 0, '2 quiet minutes after an answer');
});

// ---- The direction triangle on the location pin ----
import { compassFromEvent, pickHeading, smoothAngle, turn } from '../../src/jagadhatri/heading.js';

test('direction: walking first, compass when standing, otherwise none', () => {
  const now = 100_000;
  const gps = (/** @type {number | null} */ heading, /** @type {number | null} */ speed, age = 1_000) => ({
    heading,
    speed,
    at: now - age,
  });
  const compass = (age = 500) => ({ heading: 200, at: now - age });
  assert.equal(pickHeading({ gps: gps(90, 1.4), compass: compass(), now }), 90, 'walking: the way you move wins');
  assert.equal(
    pickHeading({ gps: gps(90, 0.4), compass: compass(), now }),
    200,
    'shuffling in a crowd: GPS heading is noise, use the compass',
  );
  assert.equal(pickHeading({ gps: gps(null, 1.4), compass: compass(), now }), 200, 'no GPS heading: compass');
  assert.equal(pickHeading({ gps: gps(90, 1.4, 8_000), compass: compass(), now }), 200, 'an old GPS heading is ignored');
  assert.equal(pickHeading({ gps: gps(90, 0.2), compass: compass(5_000), now }), null, 'a stopped compass: no triangle');
  assert.equal(pickHeading({ gps: null, compass: null, now }), null);
  assert.equal(pickHeading({ gps: gps(-10, 2), compass: null, now }), 350, 'headings are kept between 0 and 360');
});

test('direction: turns take the short way round and compass events read right', () => {
  assert.equal(turn(359, 1), 2);
  assert.equal(turn(1, 359), -2);
  assert.equal(smoothAngle(null, 90), 90);
  assert.ok(Math.abs(turn(smoothAngle(350, 10), 0)) < 8, 'smoothing across north does not swing round');
  assert.equal(compassFromEvent({ webkitCompassHeading: 123 }), 123, 'iPhone');
  assert.equal(compassFromEvent({ alpha: 90, absolute: true }), 270, 'Android: alpha runs anticlockwise');
  assert.equal(compassFromEvent({ alpha: 90, absolute: false }), null, 'a relative reading is not north');
  assert.equal(compassFromEvent({ alpha: 90, absolute: true }, 90), 0, 'a rotated screen is corrected');
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

test('type filter at a station: the 0-result case from the field, and the numbers behind the empty state', () => {
  const station = (/** @type {string} */ id) => data.stations.find((/** @type {any} */ x) => x.id === id);
  const adi = { ...NO_FILTERS, type: 'Adi Puja' };
  const chan = station('chandannagar-station');
  const centre = (/** @type {any} */ s, /** @type {number} */ radius) => ({
    kind: /** @type {'station'} */ ('station'),
    lat: s.la,
    lng: s.lo,
    radius,
  });
  // Adi Puja is 7 of 207 pujas and none is within 1 km of Chandannagar Station: "0" is correct, so the sheet must say why.
  assert.equal(visibleList(data.pujas, adi, centre(chan, 1000)).length, 0);
  assert.equal(visibleList(data.pujas, NO_FILTERS, centre(chan, 500)).length, 8);
  assert.equal(visibleList(data.pujas, NO_FILTERS, centre(chan, 1000)).length, 20);
  // The empty state: "Show all pujas" has 20 in range, and "Show nearest Adi Pujas" lands on the next distance that has one.
  const counts = countsByRadius(data.pujas, adi, chan.la, chan.lo, [500, 1000, 2000, 5000]);
  assert.deepEqual([counts[500], counts[1000]], [0, 0]);
  assert.ok(counts[2000] > 0);
  const mank = station('mankundu-station');
  assert.equal(visibleList(data.pujas, NO_FILTERS, centre(mank, 500)).length, 3);
  assert.equal(visibleList(data.pujas, adi, centre(mank, 500)).length, 0);
});

test('type names in counts: Adi Puja, Jubilee puja, other pujas', () => {
  assert.equal(pujasOf(4, 'Adi Puja'), '4 Adi Pujas');
  assert.equal(pujasOf(1, 'Adi Puja'), '1 Adi Puja');
  assert.equal(pujasOf(1, 'Jubilee'), '1 Jubilee puja');
  assert.equal(pujasOf(15, 'Pre-Jubilee'), '15 Pre-Jubilee pujas');
  assert.equal(pujasOf(166, 'Other'), '166 other pujas');
  assert.equal(pujasOf(207, null), '207 pujas');
  assert.equal(typeNoun('Adi Puja', 1), 'Adi Puja');
});

test('themes and artists: 46 pujas have them, the "by" name is split off, and the shape is [name, role]', () => {
  const withTheme = data.pujas.filter((/** @type {any} */ p) => p.th);
  assert.equal(withTheme.length, 46);
  assert.equal(data.pujas.filter((/** @type {any} */ p) => p.ar).length, 41);
  assert.ok(
    withTheme.every((/** @type {any} */ p) => !/ by /.test(p.th)),
    'themes carry no "by" name',
  );
  const sil = data.pujas.find((/** @type {any} */ p) => p.id === 'silbagan-sarbojanin-sri-sri-jagadhatri-puja-committee');
  assert.equal(sil.th, 'Ferikatha');
  assert.deepEqual(sil.ar[2], ['Gagan Das', 'Construction'], 'already named in Artists, so not added a second time');
  const satta = data.pujas.find((/** @type {any} */ p) => p.th === 'Satta');
  assert.deepEqual(satta.ar[0], ['Tanmay Sikdar', 'Theme'], 'the person behind the theme comes first');
  for (const p of data.pujas.filter((/** @type {any} */ x) => x.ar)) {
    assert.ok(p.th, `${p.n}: artists with no theme`);
    assert.ok(
      p.ar.every((/** @type {any} */ a) => Array.isArray(a) && a.length >= 1 && a.length <= 2 && a[0]),
      `${p.n}: artist shape`,
    );
  }
  assert.equal(data.pujas.filter((/** @type {any} */ p) => !p.th && !p.ar).length, 161, 'no cards for the rest');
});

// ---- badge art (badge design system) ----
const lum = (/** @type {string} */ h) => {
  const f = (/** @type {number} */ c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const [r, g, b] = [1, 3, 5].map((i) => f(parseInt(h.slice(i, i + 2), 16) / 255));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (/** @type {string} */ a, /** @type {string} */ b) =>
  (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);

test('every rank wears its own coin tier, Platinum skipped', () => {
  assert.deepEqual(
    RANKS.map((r) => r.tier),
    ['bronze', 'silver', 'gold', 'emerald', 'diamond', 'legendary'],
  );
});

test('badge art is plain SVG with literal colours (the share image draws it through an image)', () => {
  RANKS.forEach((_, i) => {
    for (const locked of [false, true]) {
      const svg = badgeSvg(i, { locked, size: 48 });
      assert.match(svg, /^<svg [^>]*viewBox="10 9 80 80"/);
      assert.ok(!svg.includes('var('), 'no CSS variables');
      assert.ok(!svg.includes('<text'), 'no text; the rank letter sits beside the coin');
    }
    assert.notEqual(badgeSvg(i, { locked: true }), badgeSvg(i), 'locked looks different');
  });
  assert.equal(new Set(RANKS.map((_, i) => badgeSvg(i))).size, 6, 'six distinct badges');
});

test('rank accent colours read on the cream celebration ground (4.5:1)', () => {
  RANKS.forEach((r) => assert.ok(contrast(r.c1, '#FFF8F0') >= 4.5, `${r.id} ${r.c1}`));
});

test('About credits the map data to jagadhatri.in', async () => {
  const { ABOUT } = await import('../../src/jagadhatri/config.js');
  assert.equal(ABOUT.mapCredit.name, 'Nirjan Munshi and friends');
  assert.equal(new URL(ABOUT.mapCredit.url).hostname, ABOUT.mapCredit.site);
});

test('ready-made walks: one short name each, no places in it, Express second, the 16 hour trail last', async () => {
  const { BEST_ROUTES } = await import('../../src/jagadhatri/config.js');
  assert.deepEqual(
    BEST_ROUTES.map((r) => r.label),
    ['Top suggestion', 'Express route', 'Jubilee route', 'Ferry route', 'All-night trail'],
  );
  const places = /chandannagar|mankundu|bhadreswar|gondalpara|telinipara|rani|station|ghat/i;
  for (const r of BEST_ROUTES) {
    assert.ok(r.label.split(' ').length <= 3, `${r.label} is 3 words at most`);
    assert.ok(!places.test(r.label), `${r.label} names no place`);
  }
  assert.equal(new Set(BEST_ROUTES.map((r) => r.label)).size, BEST_ROUTES.length, 'names are distinct');
  assert.equal(BEST_ROUTES.at(-1)?.id, 'guide-mankundu-chandannagar');
});

test('every ready-made walk starts and ends at a plan point and carries its card name', async () => {
  const { BEST_ROUTES, PLAN_POINTS } = await import('../../src/jagadhatri/config.js');
  const { bestPlan } = await import('../../src/jagadhatri/plan.js');
  const byId = new Map(data.pujas.map((/** @type {any} */ p) => [p.id, p]));
  const points = new Map(data.stations.map((/** @type {any} */ s) => [s.id, { id: s.id, name: s.name, kind: s.kind, la: s.la, lo: s.lo }]));
  for (const r of BEST_ROUTES) {
    assert.ok(PLAN_POINTS.includes(r.start) && PLAN_POINTS.includes(r.end), `${r.id} uses plan points`);
    const plan = bestPlan(r, byId, points);
    assert.equal(plan?.label, r.label);
    assert.equal(plan?.title, r.title, 'the plan screen keeps the full title');
  }
});

test('Express route: 17 matched pujas in the guide order, from Mankundu Station to Chandannagar Station', async () => {
  const { BEST_ROUTES } = await import('../../src/jagadhatri/config.js');
  const { bestPlan } = await import('../../src/jagadhatri/plan.js');
  const r = BEST_ROUTES.find((x) => x.id === 'express-mankundu-chandannagar');
  assert.ok(r?.stages);
  const ids = r.stages.flatMap((st) => st.stops);
  const byId = new Map(data.pujas.map((/** @type {any} */ p) => [p.id, p]));
  assert.deepEqual(
    ids.filter((id) => !byId.has(id)),
    [],
    'every puja exists',
  );
  assert.equal(new Set(ids).size, ids.length, 'no puja twice');
  assert.equal(r.stages.length, 4);
  const points = new Map(data.stations.map((/** @type {any} */ s) => [s.id, { id: s.id, name: s.name, kind: s.kind, la: s.la, lo: s.lo }]));
  const plan = bestPlan(r, byId, points);
  assert.equal(plan?.stops.length, 17);
  assert.ok(plan && plan.minutes > 6 * 60 && plan.minutes < 9 * 60, 'about 7 to 8 hours');
});

// ---- Eastern Railway specials ----
import { BANDEL_HOWRAH, BARDDHAMAN, clock12, HOWRAH_BANDEL, SPECIALS_END, specialsActive } from '../../src/jagadhatri/trains.js';
import { lastWayHome, minutesLeft } from '../../src/jagadhatri/plan.js';
import { PLAN_HOURS } from '../../src/jagadhatri/config.js';

test('special trains: 8 each way plus the two Barddhaman trains, as in the notice', () => {
  assert.equal(HOWRAH_BANDEL.length, 8);
  assert.equal(BANDEL_HOWRAH.length, 8);
  assert.equal(BARDDHAMAN.length, 2);
  const all = [...HOWRAH_BANDEL, ...BANDEL_HOWRAH, ...BARDDHAMAN];
  assert.equal(new Set(all.map((t) => t.no)).size, 18, 'train numbers are unique');
  for (const t of all) assert.match(`${t.dep} ${t.arr}`, /^\d\d:\d\d \d\d:\d\d$/);
  assert.equal(HOWRAH_BANDEL[0].no, '03085');
  assert.equal(BANDEL_HOWRAH[7].dep, '04:00');
});

test('clock12 writes the 12-hour style used in the app', () => {
  assert.equal(clock12('17:20'), '5:20 PM');
  assert.equal(clock12('00:30'), '12:30 AM');
  assert.equal(clock12('12:05'), '12:05 PM');
  assert.equal(clock12('04:00'), '4:00 AM');
});

test('the specials end after the last one reaches Howrah on 21 Nov, then the old last train comes back', () => {
  assert.equal(specialsActive(Date.parse('2026-11-16T21:00:00+05:30')), true);
  assert.equal(specialsActive(Date.parse(SPECIALS_END) - 1), true);
  assert.equal(specialsActive(Date.parse(SPECIALS_END)), false);
  const station = /** @type {any} */ ({ id: 's', name: 'Chandannagar Station', kind: 'station' });
  const during = Date.parse('2026-11-17T22:00:00+05:30');
  const after = Date.parse('2026-11-22T22:00:00+05:30');
  // 10 PM: 6 h to 4:00 AM during the specials (minus 10 min to spare), 2 h to midnight after them.
  assert.equal(minutesLeft(station, during), 6 * 60 - 10);
  assert.equal(minutesLeft(station, after), 2 * 60 - 10);
  assert.equal(minutesLeft(station, Date.parse('2026-11-17T01:00:00+05:30')), 3 * 60 - 10);
  assert.match(lastWayHome(station, during), /run through the night/);
  assert.equal(lastWayHome(station, after), 'Last train 12:00 AM from Chandannagar Station.');
});

test('ferries still stop at 10 PM during the specials', () => {
  const ghat = /** @type {any} */ ({ id: 'g', name: 'Rani Ghat', kind: 'ghat' });
  const during = Date.parse('2026-11-17T20:00:00+05:30');
  assert.equal(minutesLeft(ghat, during), 2 * 60 - 10);
  assert.equal(lastWayHome(ghat, during), 'Last ferry 10:00 PM from Rani Ghat.');
});

test('Plan my walk offers 2, 3 and 5 hours', () => {
  assert.deepEqual([...PLAN_HOURS], [2, 3, 5]);
});

test('winners: six awards, each linked winner is a real puja, no puja linked twice in one award', () => {
  assert.equal(AWARDS.length, 6);
  const known = new Set(data.pujas.map((/** @type {any} */ p) => p.id));
  for (const a of AWARDS) {
    assert.ok(a.en && a.bn, a.id);
    const ids = a.placings.map((pl) => pl.who.id).filter(Boolean);
    for (const id of ids) assert.ok(known.has(/** @type {string} */ (id)), `${a.id}: ${id}`);
    assert.equal(new Set(ids).size, ids.length, a.id);
    for (const pl of a.placings) assert.ok(pl.who.en && pl.who.bn, `${a.id}: name and Bengali`);
  }
  // Five ranked awards have 1 first and joint 2nd and 3rd; the sixth has three unranked winners.
  for (const a of AWARDS.slice(0, 5))
    assert.deepEqual(
      a.placings.map((pl) => pl.place),
      [1, 2, 2, 3, 3],
      a.id,
    );
  assert.deepEqual(
    AWARDS[5].placings.map((pl) => pl.place),
    [0, 0, 0],
  );
});

test('winners: labels and the award line on a puja', () => {
  assert.equal(placeLabel(AWARDS[0].placings[0]), '1st');
  assert.equal(placeLabel(AWARDS[0].placings[1]), 'Joint 2nd');
  assert.equal(placeLabel(AWARDS[5].placings[0]), 'Winner');
  assert.deepEqual(
    awardsOf('palpara-jagadhatri-puja-committee').map((x) => [x.award.en, x.label]),
    [['Idol’s Face', '1st']],
  );
  assert.deepEqual(
    awardsOf('bagbazar-choumatha').map((x) => x.label),
    ['Joint 2nd'],
  );
  assert.deepEqual(awardsOf('no-such-puja'), []);
});

test('winners: the event is a Highlight on 18 Nov and opens the winners sheet', () => {
  const ev = EVENTS.find((e) => e.id === WINNERS_EVENT_ID);
  assert.ok(ev && ev.winners);
  assert.equal(ev.section, 'highlight');
  assert.equal(ev.day, '2026-11-18');
});

import {
  badgeCentres,
  lightingOf,
  processionPujas,
  procPhase,
  entryLine,
  ROUTE,
  routePoints,
  walkMinutes,
  watchPlan,
  WATCH,
  zoneInfo,
} from '../../src/jagadhatri/procession.js';

test('procession: zones, lorries and lighting match the police list', () => {
  const list = processionPujas(data.pujas);
  const zones = zoneInfo(list);
  assert.equal(list.length, 68);
  assert.deepEqual(
    zones.map((z) => [z.zone, z.n]),
    [
      ['A', 30],
      ['B', 12],
      ['C', 13],
      ['D', 13],
    ],
  );
  assert.equal(
    list.reduce((a, p) => a + (p.pr?.tr || 0), 0),
    245,
  );
  assert.equal(list.filter((p) => lightingOf(p).length).length, 13);
  const serials = list.map((p) => p.pr?.s);
  assert.deepEqual(
    serials,
    [...serials].sort((a, b) => /** @type {number} */ (a) - /** @type {number} */ (b)),
  );
});

test('procession: the route is one closed loop with no long straight jumps', () => {
  const first = ROUTE[0];
  const last = ROUTE[ROUTE.length - 1];
  assert.ok(first && last);
  const m = (/** @type {readonly number[]} */ a, /** @type {readonly number[]} */ b) =>
    Math.hypot(((a[1] ?? 0) - (b[1] ?? 0)) * 102500, ((a[0] ?? 0) - (b[0] ?? 0)) * 111320);
  assert.ok(m(first, last) < 30, 'the line ends where it starts');
  let km = 0;
  let longest = 0;
  for (let i = 1; i < ROUTE.length; i++) {
    const d = m(/** @type {readonly number[]} */ (ROUTE[i - 1]), /** @type {readonly number[]} */ (ROUTE[i]));
    km += d / 1000;
    longest = Math.max(longest, d);
  }
  assert.ok(km > 7.5 && km < 10.5, `length ${km} km`);
  assert.ok(longest < 400, `longest straight piece ${longest} m`);
});

test('procession: route and watch points sit inside Chandannagar', () => {
  assert.ok(ROUTE.length > 20);
  assert.equal(WATCH.length, 9);
  for (const [la, lo] of routePoints().map((p) => [p.la, p.lo])) {
    assert.ok(la > 22.83 && la < 22.9 && lo > 88.34 && lo < 88.4);
  }
  for (const w of WATCH) assert.ok(w.t && w.d > 0 && w.why);
});

test('procession: phase and badge separation', () => {
  assert.equal(procPhase('2026-11-21'), 'before');
  assert.equal(procPhase('2026-11-22'), 'on');
  assert.equal(procPhase('2026-11-23'), 'after');
  const b = badgeCentres(zoneInfo(processionPujas(data.pujas)));
  const dx = (b.C.lo - b.D.lo) * 111320 * Math.cos((22.87 * Math.PI) / 180);
  const dy = (b.C.la - b.D.la) * 111320;
  assert.ok(Math.hypot(dx, dy) >= 255);
});

test('procession: watch plan starts at the nearest point and follows procession order', () => {
  const rani = watchPlan({ la: 22.859946, lo: 88.371396 }, 3);
  assert.deepEqual(
    rani.map((l) => l.index),
    [2, 3, 4],
  );
  assert.ok(rani[0] && rani[0].m > 200 && rani[0].m < 330);
  assert.equal(rani[1]?.m, (WATCH[3]?.s ?? 0) - (WATCH[2]?.s ?? 0));
  // Arriving near the last point leaves fewer spots than asked for.
  const bagbazar = watchPlan({ la: 22.8634, lo: 88.3675 }, 9);
  assert.deepEqual(
    bagbazar.map((l) => l.index),
    [8],
  );
  assert.equal(watchPlan({ la: 22.845, lo: 88.3623 }, 9).length, WATCH.length);
  assert.equal(walkMinutes(1), 1);
  assert.equal(walkMinutes(800), 13);
});

test('procession: the event goes Live now from 6 PM Sunday to 7 AM Monday', () => {
  const ev = EVENTS.find((e) => e.procession);
  assert.ok(ev);
  assert.equal(ev.start, '2026-11-22T18:00:00+05:30');
  assert.equal(ev.end, '2026-11-23T07:00:00+05:30');
  assert.equal(ev.section, 'highlight');
  assert.ok(WATCH.every((w, i) => i === 0 || (w.s ?? 0) > (WATCH[i - 1]?.s ?? 0)));
});

test('procession: Jyoti More is the one best viewing point', () => {
  assert.deepEqual(
    WATCH.filter((w) => w.best).map((w) => w.t),
    ['Jyoti More'],
  );
});

test('procession day traffic: 40 no-entry points, 10 parking places, in order', () => {
  assert.equal(NO_ENTRY.length, 40);
  assert.deepEqual(
    NO_ENTRY.map((n) => n.sl),
    Array.from({ length: 40 }, (_, i) => i + 1),
  );
  assert.equal(PARKING.length, 10);
  assert.equal(new Set(PARKING.map((p) => p.id)).size, 10);
  assert.equal(
    PARKING.reduce((n, p) => n + p.big + p.medium + p.small + p.two, 0),
    2205,
    'total spaces',
  );
});

test('procession day traffic: capacity text leaves out kinds with no space', () => {
  assert.equal(capacityText(/** @type {any} */ (PARKING[0])), '30 big, 50 medium, 60 small, 150 two-wheelers');
  assert.equal(capacityText(/** @type {any} */ (PARKING[9])), '700 two-wheelers');
});

test('procession day traffic: map spots are inside Chandannagar and Bhadreswar, Taldanga I and II share one', () => {
  const spots = trafficSpots();
  assert.ok(spots.length > 0);
  for (const t of spots) assert.ok(t.la > 22.8 && t.la < 22.9 && t.lo > 88.33 && t.lo < 88.4, `${t.id} is off the map`);
  assert.equal(new Set(spots.map((t) => `${t.k}${t.id}`)).size, spots.length);
  const [i, ii] = [NO_ENTRY[36], NO_ENTRY[37]];
  assert.ok(i && ii);
  assert.equal(noEntryId(i), noEntryId(ii));
});

test('procession day traffic: in force on 22 and 23 Nov only', () => {
  assert.equal(immersionState(IMMERSION_FROM - 1), 'before');
  assert.equal(immersionState(IMMERSION_FROM), 'on');
  assert.equal(immersionState(IMMERSION_TO - 1), 'on');
  assert.equal(immersionState(IMMERSION_TO), 'ended');
});

test('Rani Ma lorry update: a poster Highlight on 22 Nov, at 11 AM, ahead of the evening procession', () => {
  const ev = EVENTS.find((e) => e.id === 'ranima-lorry-2026');
  const proc = EVENTS.find((e) => e.id === 'procession-2026');
  assert.ok(ev && proc);
  assert.equal(ev.section, 'highlight');
  assert.equal(ev.poster, true);
  assert.equal(ev.day, '2026-11-22');
  assert.ok(Date.parse(ev.start ?? '') < Date.parse(proc.start ?? ''));
  assert.equal(ev.photos.length, 1);
  for (const f of [ev.photos[0]?.src, ev.photos[0]?.thumb]) {
    assert.ok(f && fs.existsSync(`public${f}`), `${f} is missing`);
  }
});

test('the entry card line follows the clock: before, on, then gone', () => {
  const at = (/** @type {number} */ d, /** @type {number} */ h, /** @type {number} */ m = 0) => Date.UTC(2026, 10, d, h, m) - 330 * 60_000;
  assert.equal(entryLine(at(22, 11, 30)), 'Starting 22nd Nov, 6 PM onwards');
  assert.equal(entryLine(at(22, 17, 59)), 'Starting 22nd Nov, 6 PM onwards');
  assert.equal(entryLine(at(22, 18)), 'Happening now');
  assert.equal(entryLine(at(23, 6, 59)), 'Happening now');
  assert.equal(entryLine(at(23, 7)), '');
});

test('the entry card animation: a square file the 16:9 frame can crop, with a still frame inside it', async () => {
  const { readFileSync } = await import('node:fs');
  const { LED_FILE, STILL_FRAME } = await import('../../src/jagadhatri/led-art.js');
  const anim = JSON.parse(readFileSync(`public${LED_FILE}`, 'utf8'));
  assert.equal(anim.w, 512);
  assert.equal(anim.h, 512);
  assert.equal(anim.fr, 30);
  assert.ok(STILL_FRAME > anim.ip && STILL_FRAME < anim.op, 'the still frame is inside the animation');
  // The art is a wide band in the middle: a 16:9 crop of the square keeps y 112 to 400. Every LED sits inside it
  // (the full-height scan line is meant to run past the edges).
  /** @type {number[]} */
  const ys = [];
  for (const layer of anim.layers.filter((/** @type {{ nm: string }} */ l) => l.nm !== 'sweep')) {
    for (const g of layer.shapes) {
      const dy = g.it.find((/** @type {{ ty: string }} */ i) => i.ty === 'tr')?.p.k[1] ?? 0; // glow groups are placed by their transform
      for (const it of g.it) if ((it.ty === 'rc' || it.ty === 'el') && it.p?.a === 0) ys.push(it.p.k[1] + dy);
    }
  }
  assert.ok(ys.length > 100);
  assert.ok(
    ys.every((y) => y > 112 && y < 400),
    'every LED row is inside the 16:9 crop',
  );
});
