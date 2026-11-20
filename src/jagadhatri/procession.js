/**
 * Procession guide: the Chandannagar Jagadhatri procession (postponed by rain to Sunday 22 Nov 2026, evening).
 * Pure data and helpers, no React, so they are tested directly (test/client/jagadhatri.test.js).
 *
 * The route line is APPROXIMATE. It was traced from screenshots of the Chandannagar Police procession map and placed
 * with the 68 puja positions, so it can be tens of metres off, and its south end runs past the last screenshot
 * (about 8.1 km traced of the 8.7 km published). Replace ROUTE with the police file when it is available.
 * Route and timings are credited to Chandannagar Police.
 */

/** The procession day (IST), after rain moved it from Thursday 19 Nov. */
export const PROCESSION_DAY = '2026-11-22';
export const PROCESSION_WHEN = 'Sunday 22 Nov, evening';
export const PROCESSION_MOVED = 'Moved from 19 Nov because of rain';
/** Published route length in km (Chandannagar Police). */
export const ROUTE_KM = 8.7;
export const PROCESSION_CREDIT = 'Route and timings: Chandannagar Police';
export const ZONES = Object.freeze(['A', 'B', 'C', 'D']);

/**
 * One continuous line [lat, lng]: south to north along the river-side line (Strand Road), across the north end, then
 * south along the west line. The arrows on the map follow this order.
 * @type {readonly (readonly [number, number])[]}
 */
export const ROUTE = Object.freeze([
  [22.84493, 88.36265],
  [22.84571, 88.36335],
  [22.84667, 88.36421],
  [22.84774, 88.3651],
  [22.8488, 88.36606],
  [22.84993, 88.36683],
  [22.85105, 88.36745],
  [22.85218, 88.36802],
  [22.85331, 88.36878],
  [22.85447, 88.36932],
  [22.85563, 88.36945],
  [22.85679, 88.36966],
  [22.85795, 88.37],
  [22.85911, 88.37039],
  [22.86026, 88.37085],
  [22.86143, 88.37123],
  [22.86258, 88.37149],
  [22.86383, 88.37183],
  [22.86512, 88.3721],
  [22.86635, 88.37244],
  [22.86756, 88.3728],
  [22.86877, 88.37323],
  [22.87, 88.37371],
  [22.87123, 88.37422],
  [22.87242, 88.37463],
  [22.87351, 88.37501],
  [22.87465, 88.3754],
  [22.87587, 88.37563],
  [22.87716, 88.37588],
  [22.87856, 88.37622],
  [22.87856, 88.37365],
  [22.87762, 88.37329],
  [22.87669, 88.37277],
  [22.8757, 88.37208],
  [22.8747, 88.37128],
  [22.8736, 88.37067],
  [22.87244, 88.37021],
  [22.87132, 88.36964],
  [22.87023, 88.36895],
  [22.86913, 88.36841],
  [22.86804, 88.36787],
  [22.86696, 88.3673],
  [22.86587, 88.36679],
  [22.86463, 88.36644],
  [22.86339, 88.36645],
  [22.86211, 88.36682],
  [22.86082, 88.36693],
  [22.85959, 88.36653],
  [22.85838, 88.36606],
  [22.85717, 88.36569],
  [22.85589, 88.36531],
  [22.8546, 88.36487],
  [22.85331, 88.36444],
  [22.85202, 88.36412],
  [22.85089, 88.36371],
  [22.84977, 88.36328],
  [22.84865, 88.36303],
  [22.84746, 88.3627],
  [22.84622, 88.36225],
  [22.84501, 88.36195],
  [22.84461, 88.36192],
]);

/**
 * Suggested places to watch, picked from the route, the ghat and the big pandals. To be verified with the police.
 * @typedef {{ t: string, la: number, lo: number, st: string, d: number, why: string }} Watch
 * @type {readonly Watch[]}
 */
export const WATCH = Object.freeze([
  {
    t: 'Rani Ghat, Strand Road',
    la: 22.859946,
    lo: 88.371396,
    st: 'Rani Ghat',
    d: 67,
    why: 'Closest ghat to the river-side line, 67 m away. Good first stop if you arrive by boat or ghat.',
  },
  {
    t: 'Hatkhola',
    la: 22.852199,
    lo: 88.368358,
    st: 'Rani Ghat',
    d: 916,
    why: 'Zone A pujas No. 2 to 6 pass here, towards the south end.',
  },
  {
    t: 'Bagbazar',
    la: 22.86341,
    lo: 88.367452,
    st: 'Rani Ghat',
    d: 558,
    why: 'Bagbazar Choumatha (No. 43) and Bagbazar Sarbojonin (No. 44), Zone C, on the west line.',
  },
  {
    t: 'Uttaranchal',
    la: 22.876159,
    lo: 88.3721,
    st: 'Chuchura Stn',
    d: 1664,
    why: 'Uttaranchal (No. 55) with Palpara (No. 53) and Bidyalankar (No. 50) close by.',
  },
  {
    t: 'Boro Taldanga',
    la: 22.877782,
    lo: 88.376308,
    st: 'Chuchura Stn',
    d: 1589,
    why: 'Zone D No. 58, a must-visit puja on the river-side line near the north turn.',
  },
  { t: 'Laxmiganj Bazar', la: 22.865737, lo: 88.372279, st: 'Rani Ghat', d: 650, why: 'Zone D No. 65, on the river-side line, mid-route.' },
  {
    t: 'North turn',
    la: 22.877957,
    lo: 88.373459,
    st: 'Chuchura Stn',
    d: 1486,
    why: 'Where the two lines meet at the north end. Pujas slow down to turn.',
  },
]);

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
