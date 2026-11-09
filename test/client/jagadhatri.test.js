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
