/**
 * Procession guide: the Chandannagar Jagadhatri procession (postponed by rain to Sunday 22 Nov 2026, evening).
 * Pure data and helpers, no React, so they are tested directly (test/client/jagadhatri.test.js).
 *
 * The route line is APPROXIMATE (see route-roads.js). Replace it with the police file when it is available.
 * Route and timings are credited to Chandannagar Police.
 */

import { ROUTE_ROADS, ROUTE_SOURCE } from './route-roads.js';

/** The procession day (IST), after rain moved it from Thursday 19 Nov. */
export const PROCESSION_DAY = '2026-11-22';
export const PROCESSION_WHEN = 'Sunday 22 Nov, evening';
export const PROCESSION_MOVED = 'Moved from 19 Nov due to rain';
/** Published route length in km (Chandannagar Police). */
export const ROUTE_KM = 8.7;
export const PROCESSION_CREDIT = 'Route and timings: Chandannagar Police';
export const ZONES = Object.freeze(['A', 'B', 'C', 'D']);

/**
 * One closed line [lat, lng]: from Jyoti More north along the river-side line (Strand Road), across the north end,
 * then south along the west line (GT Road) back to Jyoti More. The arrows on the map follow this order.
 * The points live in route-roads.js, which `npm run route:build` regenerates from the roads.
 * @type {readonly (readonly [number, number])[]}
 */
export const ROUTE = ROUTE_ROADS;
export { ROUTE_SOURCE };

const M_PER_DEG = 111320;
/** Straight-line metres between two points (flat-earth is accurate to a few metres at this scale). */
export const metres = (/** @type {{ la: number, lo: number }} */ a, /** @type {{ la: number, lo: number }} */ b) =>
  Math.hypot((a.lo - b.lo) * M_PER_DEG * Math.cos((22.87 * Math.PI) / 180), (a.la - b.la) * M_PER_DEG);

/** Metres along the closed route from Jyoti More to the point of the route nearest to (la, lo). */
function alongRoute(/** @type {number} */ la, /** @type {number} */ lo) {
  const cos = Math.cos((22.87 * Math.PI) / 180);
  const xy = (/** @type {readonly [number, number]} */ p) => [p[1] * cos * M_PER_DEG, p[0] * M_PER_DEG];
  const [px = 0, py = 0] = xy([la, lo]);
  let run = 0;
  let best = Infinity;
  let at = 0;
  for (let i = 1; i < ROUTE.length; i++) {
    const [ax = 0, ay = 0] = xy(/** @type {[number, number]} */ (ROUTE[i - 1]));
    const [bx = 0, by = 0] = xy(/** @type {[number, number]} */ (ROUTE[i]));
    const len = Math.hypot(bx - ax, by - ay);
    const t = len ? Math.max(0, Math.min(1, ((px - ax) * (bx - ax) + (py - ay) * (by - ay)) / (len * len))) : 0;
    const d = Math.hypot(px - (ax + t * (bx - ax)), py - (ay + t * (by - ay)));
    if (d < best) {
      best = d;
      at = run + t * len;
    }
    run += len;
  }
  return Math.round(at);
}

/**
 * Suggested places to watch, picked from the route, the ghat and the big pandals. To be verified with the police.
 * @typedef {{ t: string, la: number, lo: number, s: number, st: string, d: number, why: string, best?: boolean }} Watch
 * @type {readonly Omit<Watch, 's'>[]}
 */
const WATCH_RAW = [
  {
    t: 'Jyoti More',
    la: 22.845139,
    lo: 88.362361,
    st: 'Gondalpara Ghat',
    d: 1018,
    why: 'Best place to watch. The procession starts and ends here. Tematha (No. 11) is 65 m away.',
    best: true,
  },
  {
    t: 'Kabi Bharatchandra Road',
    la: 22.85398,
    lo: 88.369028,
    st: 'Rani Ghat',
    d: 707,
    why: 'South end of the river-side line. Hatkhola Nonatala (No. 2) is 91 m away.',
  },
  {
    t: 'Strand Road, near Rani Ghat',
    la: 22.85794,
    lo: 88.370073,
    st: 'Rani Ghat',
    d: 261,
    why: 'On the river-side line, close to Rani Ghat. Good first stop if you arrive by boat.',
  },
  {
    t: 'Ganj Choumatha and Rath Stand',
    la: 22.864991,
    lo: 88.372835,
    st: 'Rani Ghat',
    d: 581,
    why: 'Adi Maa, Chaulpatti (No. 64) and Laxmigunj Bazar (No. 65) are within 100 m.',
  },
  {
    t: 'Boro Taldanga',
    la: 22.877782,
    lo: 88.376308,
    st: 'Chuchura Stn',
    d: 1591,
    why: 'Zone D No. 58, a must-visit puja, near the north end of the river-side line.',
  },
  {
    t: 'Bibirhat Tematha',
    la: 22.878091,
    lo: 88.373806,
    st: 'Chuchura Stn',
    d: 1481,
    why: 'North end, where the route turns onto the west line. Bibirhat Charaktala (No. 56) is 82 m away.',
  },
  {
    t: 'Palpara Road',
    la: 22.87372,
    lo: 88.370789,
    st: 'Rani Ghat',
    d: 1535,
    why: 'On the west line. Uttaranchal (No. 55) is a short walk north.',
  },
  {
    t: 'Vidyalankar',
    la: 22.867172,
    lo: 88.367481,
    st: 'Rani Ghat',
    d: 899,
    why: 'Bidyalankar (No. 50), Zone C, is 3 m away.',
  },
  {
    t: 'Bagbazar Choumatha',
    la: 22.863374,
    lo: 88.367455,
    st: 'Rani Ghat',
    d: 556,
    why: 'Bagbazar Choumatha (No. 43), Zone C, on the west line.',
  },
];

/** The watch points, each with `s`: metres along the route from Jyoti More (the start, so 0). */
export const WATCH = Object.freeze(WATCH_RAW.map((w, i) => ({ ...w, s: i === 0 ? 0 : alongRoute(w.la, w.lo) })));

/** Straight-line distance from stations and ghats to the nearest point of the traced route. */
export const REACH = Object.freeze([
  { name: 'Rani Ghat', kind: 'ghat', m: 67 },
  { name: 'Gondalpara Ghat', kind: 'ghat', m: 809 },
  { name: 'Chandannagar Station', kind: 'station', m: 1300 },
  { name: 'Chuchura Station', kind: 'station', m: 1425 },
  { name: 'Mankundu Station', kind: 'station', m: 1565 },
  { name: 'Bhadreswar Station', kind: 'station', m: 2800 },
]);

/**
 * @param {string} dayIst  Today, IST, as YYYY-MM-DD
 * @returns {'before' | 'on' | 'after'}
 */
export function procPhase(dayIst) {
  return dayIst < PROCESSION_DAY ? 'before' : dayIst === PROCESSION_DAY ? 'on' : 'after';
}

const IST_MIN = 330 * 60_000;
/** The procession sets off at 6 PM on the day and is over by 7 AM next morning (India time). */
export const PROCESSION_FROM = Date.UTC(2026, 10, 22, 18, 0) - IST_MIN;
export const PROCESSION_TO = Date.UTC(2026, 10, 23, 7, 0) - IST_MIN;

/**
 * The grey line on the daily card: when it starts, then that it is on, then nothing once it is over.
 * @param {number} now  ms since epoch
 */
export function entryLine(now) {
  if (now < PROCESSION_FROM) return 'Starting 22nd Nov, 6 PM onwards';
  return now < PROCESSION_TO ? 'Happening now' : '';
}

/**
 * The pujas in the procession, in walking order.
 * @param {import('./lib.js').JgPuja[]} pujas
 */
export function processionPujas(pujas) {
  return pujas.filter((p) => p.pr).sort((a, b) => /** @type {any} */ (a.pr).s - /** @type {any} */ (b.pr).s);
}

/**
 * Lighting artists named for a puja (any artist role that mentions lighting), without repeats.
 * @param {import('./lib.js').JgPuja} p
 * @returns {string[]}
 */
export function lightingOf(p) {
  const names = (p.ar || []).filter((a) => /light/i.test(a[1] || '')).map((a) => a[0]);
  return [...new Set(names)];
}

/**
 * @typedef {{ zone: string, n: number, lorries: number, first: number, last: number, la: number, lo: number, rows: import('./lib.js').JgPuja[] }} ZoneInfo
 * Per-zone totals and the middle of the zone's pujas.
 * @param {import('./lib.js').JgPuja[]} procPujas  From processionPujas
 * @returns {ZoneInfo[]}
 */
export function zoneInfo(procPujas) {
  return ZONES.map((zone) => {
    const rows = procPujas.filter((p) => p.pr?.z === zone);
    const n = rows.length;
    return {
      zone,
      n,
      lorries: rows.reduce((a, p) => a + (p.pr?.tr || 0), 0),
      first: n ? /** @type {any} */ (rows[0].pr).s : 0,
      last: n ? /** @type {any} */ (rows[n - 1].pr).s : 0,
      la: n ? rows.reduce((a, p) => a + p.la, 0) / n : 0,
      lo: n ? rows.reduce((a, p) => a + p.lo, 0) / n : 0,
      rows,
    };
  });
}

const M_LAT = 111320;
/**
 * Zone badge positions. Zones C and D sit almost on top of each other, so badges closer than minM metres are pushed
 * apart along the line between them (east and west when they coincide). The numbered pins keep the true positions.
 * @param {ZoneInfo[]} zones
 * @param {number} [minM]
 * @returns {Record<string, { la: number, lo: number }>}
 */
export function badgeCentres(zones, minM = 260) {
  const kLng = M_LAT * Math.cos((22.87 * Math.PI) / 180);
  const pts = zones.map((z) => ({ zone: z.zone, x: z.lo * kLng, y: z.la * M_LAT }));
  for (let pass = 0; pass < 6; pass++) {
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        let dx = pts[j].x - pts[i].x;
        let dy = pts[j].y - pts[i].y;
        let d = Math.hypot(dx, dy);
        if (d >= minM) continue;
        if (d < 1) {
          dx = 1;
          dy = 0;
          d = 1;
        }
        const push = (minM - d) / 2;
        pts[i].x -= (dx / d) * push;
        pts[i].y -= (dy / d) * push;
        pts[j].x += (dx / d) * push;
        pts[j].y += (dy / d) * push;
      }
    }
  }
  return Object.fromEntries(pts.map((p) => [p.zone, { la: p.y / M_LAT, lo: p.x / kLng }]));
}

/** The traced route as plain points, for framing the map. */
export function routePoints() {
  return ROUTE.map(([la, lo]) => ({ la, lo }));
}

/** Walking minutes for a straight-line distance: 30% longer for the bends, at 80 m a minute. */
export const walkMinutes = (/** @type {number} */ m) => Math.max(1, Math.round((m * 1.3) / 80));

/**
 * A watch plan: the watch point nearest to where you arrive, then the ones after it in procession order.
 * The first leg is straight-line metres from the arrival; later legs are metres along the route from the spot before.
 * @param {{ la: number, lo: number }} from
 * @param {number} count how many spots (the list stops at the last point)
 * @returns {{ index: number, m: number, min: number }[]}
 */
export function watchPlan(from, count) {
  let first = 0;
  let nearest = Infinity;
  WATCH.forEach((w, i) => {
    const d = metres(from, w);
    if (d < nearest) {
      nearest = d;
      first = i;
    }
  });
  const legs = [];
  for (let i = first; i < WATCH.length && legs.length < count; i++) {
    const m = legs.length === 0 ? Math.round(nearest) : Math.abs((WATCH[i]?.s ?? 0) - (WATCH[i - 1]?.s ?? 0));
    legs.push({ index: i, m, min: walkMinutes(m) });
  }
  return legs;
}
