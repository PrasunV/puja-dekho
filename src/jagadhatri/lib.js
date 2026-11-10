/**
 * Pure helpers for the Jagadhatri app: formatting, distance, filters and search. No React, no DOM, so they are tested
 * directly (test/client/jagadhatri.test.js).
 */
import { AGE_GROUPS, PUJA_YEAR } from './config.js';

/**
 * @typedef {object} JgPuja
 * @property {string} id
 * @property {string} n        Name
 * @property {string} [bn]     Bengali name
 * @property {string} t        Town
 * @property {string} c        Category: Adi Puja, Jubilee, Pre-Jubilee, Other
 * @property {string} [j]      Jubilee name
 * @property {number} [y]      Established year
 * @property {number} [cc]     CCJPC number
 * @property {boolean} pop     Must visit (Popular in the sheet)
 * @property {{ z: string, s: number, tr?: number | null }} [pr]  Procession zone and serial number
 * @property {number} la
 * @property {number} lo
 * @property {[string, number]} st  Nearest station or ghat id and straight-line metres
 * @property {string} [ad]     Address
 * @property {string} [ps]     Police station
 * @property {string} [th]     Puja theme
 * @property {string} [ar]     Artist
 *
 * @typedef {object} JgStation
 * @property {string} id
 * @property {string} name
 * @property {'station' | 'ghat'} kind
 * @property {number} la
 * @property {number} lo
 *
 * @typedef {{ type: string | null, mustVisit: boolean, towns: string[], ages: string[], procession: boolean, zones: string[], wish: boolean, notVisited: boolean, mine?: { wish: Set<string>, visited: Set<string> } }} JgFilters
 *   `mine` is the signed-in person's wish list and visited pujas, added by the app for the two "Your pujas" filters.
 * @typedef {{ kind: 'me' | 'station', lat: number, lng: number, radius: number, stationId?: string }} JgCentre
 */

export const NO_FILTERS = Object.freeze(
  /** @type {JgFilters} */ ({
    type: null,
    mustVisit: false,
    towns: [],
    ages: [],
    procession: false,
    zones: [],
    wish: false,
    notVisited: false,
  }),
);

/** Straight-line distance in metres. */
export function haversine(lat1, lng1, lat2, lng2) {
  const r = 6371000;
  const p1 = (lat1 * Math.PI) / 180;
  const p2 = (lat2 * Math.PI) / 180;
  const dp = p2 - p1;
  const dl = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(a));
}

/** Under 1 km in metres rounded to 10; from 1 km in km with one decimal (design 9.3). */
export function formatDistance(m) {
  if (m < 995) return `${Math.max(10, Math.round(m / 10) * 10)} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

/** A radius step: 500 m, 1 km, 2 km, 5 km. */
export function formatRadius(m) {
  return m < 1000 ? `${m} m` : `${m / 1000} km`;
}

/** "1 puja", "2 pujas". */
export const pujas = (n) => `${n.toLocaleString('en-IN')} ${n === 1 ? 'puja' : 'pujas'}`;

/** Age counting the founding year as year 1, as the sheet does (founded 1966 → 61 in 2026). */
export const ageOf = (/** @type {JgPuja} */ p) => (p.y ? PUJA_YEAR - p.y + 1 : null);

/** Age group id for the More sheet. */
export function ageGroup(/** @type {JgPuja} */ p) {
  const age = ageOf(p);
  if (age == null) return 'unknown';
  return AGE_GROUPS.find(([, , min, max]) => age >= min && age <= max)?.[0] ?? 'unknown';
}

/** How many filters inside More are on (for "More · 2"). */
export function moreCount(/** @type {JgFilters} */ f) {
  return f.towns.length + f.ages.length + (f.procession ? 1 : 0) + f.zones.length + (f.wish ? 1 : 0) + (f.notVisited ? 1 : 0);
}

/** Does a puja pass the chips and the More sheet? (The centre and radius are applied separately.) */
export function passes(/** @type {JgPuja} */ p, /** @type {JgFilters} */ f) {
  if (f.mustVisit && !p.pop) return false;
  if (f.type && p.c !== f.type) return false;
  if (f.towns.length && !f.towns.includes(p.t)) return false;
  if (f.ages.length && !f.ages.includes(ageGroup(p))) return false;
  if (f.procession && !p.pr) return false;
  if (f.zones.length && !(p.pr && f.zones.includes(p.pr.z))) return false;
  if (f.wish && !f.mine?.wish.has(p.id)) return false;
  if (f.notVisited && f.mine?.visited.has(p.id)) return false;
  return true;
}

/**
 * The list the sheet shows. With a centre: pujas inside the radius, nearest first, each with its distance.
 * Without: Must visit first, then A to Z.
 * @param {JgPuja[]} all
 * @param {JgFilters} filters
 * @param {JgCentre | null} centre
 * @returns {{ puja: JgPuja, d: number | null }[]}
 */
export function visibleList(all, filters, centre) {
  const rows = all
    .filter((p) => passes(p, filters))
    .map((puja) => ({ puja, d: centre ? haversine(centre.lat, centre.lng, puja.la, puja.lo) : null }));
  if (centre)
    return rows
      .filter((r) => /** @type {number} */ (r.d) <= centre.radius)
      .sort((a, b) => /** @type {number} */ (a.d) - /** @type {number} */ (b.d));
  return rows.sort((a, b) => Number(b.puja.pop) - Number(a.puja.pop) || a.puja.n.localeCompare(b.puja.n));
}

/** How many filtered pujas fall inside each radius step around a point. */
export function countsByRadius(all, filters, lat, lng, steps) {
  const ds = all.filter((p) => passes(p, filters)).map((p) => haversine(lat, lng, p.la, p.lo));
  return Object.fromEntries(steps.map((s) => [s, ds.filter((d) => d <= s).length]));
}

export function directionsUrl(lat, lng) {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=walking`;
}

// ---------- Search ----------

/** Spelling variants (PRD search section). Each list maps to the first word, on both the query and the names. */
const VARIANTS = [
  ['chandannagar', 'chandernagore', 'chandernagor', 'chandernagar', 'chandannagore', 'chandanagar', 'chandannager', 'chondonnagar'],
  ['chuchura', 'chinsurah', 'chinsura', 'chunchura', 'chunchuda'],
  ['bhadreswar', 'bhadreshwar', 'bhadreswer', 'bhadreshwer', 'bhadresar'],
  ['mankundu', 'mankunda', 'mankundo', 'mankundoo'],
  ['telinipara', 'telenipara', 'telinipada'],
  ['gondalpara', 'gondolpara', 'gondalpada'],
  ['ranighat', 'ranighaat'],
  ['sarbojanin', 'sarbojonin', 'sarbajanin', 'sarvajanin', 'sarbojonin', 'sarvojanin', 'sarbajonin', 'sarbojanina'],
  ['jagadhatri', 'jagaddhatri', 'jagatdhatri', 'jagadhathri', 'jagadhatree'],
  ['tetultala', 'tentultala', 'tetultola', 'tentultola'],
];
const VARIANT_OF = new Map(
  /** @type {[string, string][]} */ (VARIANTS.flatMap(([main, ...rest]) => [[main, main], ...rest.map((v) => [v, main])])),
);
/** Word pairs that are written either way. @type {[RegExp, string][]} */
const JOINS = [
  [/\bchandan nagar\b/g, 'chandannagar'],
  [/\bman kundu\b/g, 'mankundu'],
  [/\bteleni para\b/g, 'telinipara'],
  [/\bgondal para\b/g, 'gondalpara'],
  [/\brani ghaa?t\b/g, 'ranighat'],
  [/\bhooghly chinsurah\b/g, 'chuchura'],
];
/** Word endings written two ways: para/pada, tala/tola, ghat/ghaat, danga/dhanga, pukure/pukur. @type {[RegExp, string][]} */
const ENDINGS = [
  [/pada$/, 'para'],
  [/tola$/, 'tala'],
  [/ghaat$/, 'ghat'],
  [/dhanga$/, 'danga'],
  [/pukure$/, 'pukur'],
];

/** Lower case, plain letters, spelling variants folded. Returns words. */
export function normalise(text) {
  let s = String(text || '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9ঀ-৿]+/g, ' ')
    .trim();
  for (const [re, to] of JOINS) s = s.replace(re, to);
  return s
    .split(' ')
    .filter(Boolean)
    .map((w) => {
      let x = VARIANT_OF.get(w) ?? w;
      for (const [re, to] of ENDINGS) x = x.replace(re, to);
      return VARIANT_OF.get(x) ?? x;
    });
}

/** Edit distance with a cap (cheap early exit). */
function within(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return false;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + cost);
      best = Math.min(best, row[j]);
    }
    if (best > max) return false;
    prev.splice(0, prev.length, ...row);
  }
  return prev[b.length] <= max;
}

/** How well one query word matches one name word: 3 exact, 2 prefix, 1 small typo, 0 none. */
function wordScore(q, w) {
  if (w === q) return 3;
  if (w.startsWith(q)) return 2;
  const max = q.length >= 7 ? 2 : q.length >= 4 ? 1 : 0;
  if (max && (within(q, w, max) || (w.length > q.length && within(q, w.slice(0, q.length), max)))) return 1;
  return 0;
}

/**
 * Build a search index once.
 * @template T
 * @param {T[]} items
 * @param {(item: T) => { main: string, extra?: string[] }} text  Main name, plus lower-weight words (town, Bengali name)
 */
export function makeIndex(items, text) {
  return items.map((item) => {
    const t = text(item);
    return {
      item,
      words: normalise(t.main),
      extra: (t.extra || []).flatMap(normalise),
      raw: [t.main, ...(t.extra || [])].join(' ').toLowerCase(),
    };
  });
}

/**
 * Search an index. Every query word must match a word of the name (exactly, by prefix or with a small typo), or the
 * town or Bengali name. Best matches first.
 * @template T
 * @param {ReturnType<typeof makeIndex<T>>} index
 * @param {string} query
 * @param {number} [limit]
 * @returns {T[]}
 */
export function search(index, query, limit = 5) {
  const q = normalise(query);
  if (!q.length) return [];
  const rawQ = query.trim().toLowerCase();
  const scored = [];
  for (const entry of index) {
    let total = 0;
    let ok = true;
    for (const word of q) {
      let best = 0;
      for (const w of entry.words) best = Math.max(best, wordScore(word, w) * 2);
      for (const w of entry.extra) best = Math.max(best, wordScore(word, w));
      if (!best) {
        ok = false;
        break;
      }
      total += best;
    }
    if (!ok && rawQ.length >= 2 && entry.raw.includes(rawQ)) {
      ok = true;
      total = 1;
    }
    if (ok) {
      // A name that starts with the query ranks above one that only contains it.
      if (entry.words[0] && entry.words[0].startsWith(q[0])) total += 1;
      scored.push({ entry, total });
    }
  }
  scored.sort((a, b) => b.total - a.total || a.entry.words.length - b.entry.words.length);
  return scored.slice(0, limit).map((s) => s.entry.item);
}
