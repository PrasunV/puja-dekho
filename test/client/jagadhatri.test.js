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
import { badgeSvg, RANKS, rareLine } from '../../src/jagadhatri/ranks.js';

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
