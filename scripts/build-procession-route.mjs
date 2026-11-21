#!/usr/bin/env node
/**
 * Builds the procession route line from the roads: src/jagadhatri/route-roads.js.
 *
 * It routes on foot through the 11 pins of the route list (Jyoti More, Bagbazar, Vidyalankar, Palpara Road,
 * Bibirhat, Taldanga, Rath Stand, Ganj Choumatha, Strand Road, Kabi Bharatchandra Road, Tematha, back to Jyoti More),
 * so the line follows GT Road and Strand Road and closes the loop. The public OpenStreetMap router does the routing,
 * so this needs an internet connection. Run it once:  npm run route:build
 *
 * It checks the result against the line already in route-roads.js and refuses to write a route that wanders.
 * OSRM_BASE=http://localhost:5000/route/v1/foot tests it against another router.
 */
import fs from 'node:fs';

const OUT = new URL('../src/jagadhatri/route-roads.js', import.meta.url);
const PINS = [
  ['Jyoti More', 22.8451388, 88.3623609],
  ['Bagbazar Choumatha', 22.8633736, 88.3674549],
  ['Vidyalankar', 22.867172, 88.3674805],
  ['Palpara Road', 22.8737201, 88.3707885],
  ['Bibirhat Tematha', 22.8780906, 88.3738058],
  ['Boro Taldanga', 22.8777821, 88.3763075],
  ['Rath Stand', 22.865315, 88.3713831],
  ['Ganj Choumatha', 22.8649911, 88.3728348],
  ['Strand Road', 22.8579401, 88.3700725],
  ['Kabi Bharatchandra Road', 22.8539799, 88.3690276],
  ['Tematha', 22.8449032, 88.3629982],
  ['Jyoti More', 22.8451388, 88.3623609],
];
const BASES = process.env.OSRM_BASE
  ? [process.env.OSRM_BASE]
  : [
      'https://routing.openstreetmap.de/routed-foot/route/v1/foot',
      'https://routing.openstreetmap.de/routed-foot/route/v1/driving',
      'https://router.project-osrm.org/route/v1/driving',
    ];
const COS = Math.cos((22.87 * Math.PI) / 180);
const M = 111320;
/** @param {number[]} a @param {number[]} b  [lat, lng] pairs, straight-line metres */
const metres = (a, b) => Math.hypot(((a[1] ?? 0) - (b[1] ?? 0)) * COS * M, ((a[0] ?? 0) - (b[0] ?? 0)) * M);

async function leg(/** @type {string} */ base, /** @type {number[]} */ a, /** @type {number[]} */ b) {
  for (const radius of ['40;40', null]) {
    const q = `overview=full&geometries=geojson&continue_straight=true${radius ? `&radiuses=${radius}` : ''}`;
    const res = await fetch(`${base}/${a[1]},${a[0]};${b[1]},${b[0]}?${q}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = /** @type {any} */ (await res.json());
    if (json.code === 'Ok' && json.routes?.[0])
      return /** @type {number[][]} */ (json.routes[0].geometry.coordinates).map(([lo, la]) => [la, lo]);
    if (json.code !== 'NoSegment') throw new Error(String(json.code));
  }
  throw new Error('no road near the pin');
}

async function route(/** @type {string} */ base) {
  /** @type {number[][]} */
  const line = [];
  for (let i = 1; i < PINS.length; i++) {
    const a = PINS[i - 1];
    const b = PINS[i];
    if (!a || !b) continue;
    const g = await leg(base, [a[1], a[2]], [b[1], b[2]]);
    let len = 0;
    for (let k = 1; k < g.length; k++) len += metres(g[k - 1] ?? [], g[k] ?? []);
    const crow = metres([a[1], a[2]], [b[1], b[2]]);
    console.log(`${a[0]} to ${b[0]}: ${Math.round(len)} m by road, ${Math.round(crow)} m straight`);
    if (crow > 100 && len > crow * 1.8) throw new Error(`${a[0]} to ${b[0]} takes a long detour`);
    line.push(...(line.length ? g.slice(1) : g));
    await new Promise((r) => setTimeout(r, 1100)); // be polite to the public router
  }
  return line;
}

/** The point of the segment a-b nearest to p (all [lat, lng]). */
function nearestOn(/** @type {number[]} */ p, /** @type {number[]} */ a, /** @type {number[]} */ b) {
  const [pla = 0, plo = 0] = p;
  const [ala = 0, alo = 0] = a;
  const [bla = 0, blo = 0] = b;
  const dx = (blo - alo) * COS * M;
  const dy = (bla - ala) * M;
  const len2 = dx * dx + dy * dy;
  const t = len2 ? Math.max(0, Math.min(1, ((plo - alo) * COS * M * dx + (pla - ala) * M * dy) / len2)) : 0;
  return [ala + t * (bla - ala), alo + t * (blo - alo)];
}

/** Douglas-Peucker, tolerance in metres. */
function simplify(/** @type {number[][]} */ pts, /** @type {number} */ tol) {
  const keep = new Array(pts.length).fill(false);
  keep[0] = keep[pts.length - 1] = true;
  /** @type {number[][]} */
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [s = 0, e = 0] = stack.pop() ?? [];
    let worst = 0;
    let at = -1;
    for (let i = s + 1; i < e; i++) {
      const p = pts[i] ?? [];
      const d = metres(p, nearestOn(p, pts[s] ?? [], pts[e] ?? []));
      if (d > worst) {
        worst = d;
        at = i;
      }
    }
    if (at > 0 && worst > tol) {
      keep[at] = true;
      stack.push([s, at], [at, e]);
    }
  }
  return pts.filter((_, i) => keep[i]);
}

/** Largest distance from any point of `a` to the polyline `b`, in metres. */
function farthest(/** @type {number[][]} */ a, /** @type {number[][]} */ b) {
  let worst = 0;
  for (const p of a) {
    let best = Infinity;
    for (let i = 1; i < b.length; i++) best = Math.min(best, metres(p, nearestOn(p, b[i - 1] ?? [], b[i] ?? [])));
    worst = Math.max(worst, best);
  }
  return worst;
}

const { ROUTE_ROADS: traced } = await import(`${OUT.href}?t=${Date.now()}`);
let line = null;
let used = '';
for (const base of BASES) {
  try {
    console.log(`Routing with ${base}`);
    line = await route(base);
    used = base;
    break;
  } catch (e) {
    console.log(`  failed: ${e instanceof Error ? e.message : e}`);
  }
}
if (!line) {
  console.error('Could not get a route from any router. Check your internet connection and run it again.');
  process.exit(1);
}

// The pins run Jyoti More, west line north, river-side south. The app runs the other way round.
line.reverse();
const roads = simplify(line, 1.5).map(([la, lo]) => [Math.round((la ?? 0) * 1e6) / 1e6, Math.round((lo ?? 0) * 1e6) / 1e6]);
let km = 0;
for (let i = 1; i < roads.length; i++) km += metres(roads[i - 1] ?? [], roads[i] ?? []) / 1000;
const away = Math.round(farthest(roads, /** @type {number[][]} */ (traced)));
const back = Math.round(farthest(/** @type {number[][]} */ (traced), roads));
const closed = Math.round(metres(roads[0] ?? [], roads[roads.length - 1] ?? []));
console.log(`${roads.length} points, ${km.toFixed(1)} km (published 8.7 km), closes within ${closed} m`);
console.log(`Farthest from the screenshot trace: ${away} m (new to trace), ${back} m (trace to new)`);
if (km < 7 || km > 11.5 || closed > 30 || away > 200 || back > 200) {
  console.error('This route does not look right (length, loop or distance from the screenshot trace). Nothing was written.');
  process.exit(1);
}

const body = roads.map(([la, lo]) => `  [${la}, ${lo}],`).join('\n');
fs.writeFileSync(
  OUT,
  `/**
 * The procession route line, [lat, lng] in procession order, closed (it ends where it starts, at Jyoti More).
 * GENERATED by scripts/build-procession-route.mjs. Do not edit by hand. To rebuild it, run: npm run route:build
 *
 * source 'traced': hand-traced from the Chandannagar Police map screenshots, smoothed between the traced points
 *   (a spline through them). It can be tens of metres off the road and runs straight where the road bends.
 * source 'roads': routed through the 11 pins of the owner's route list, following the roads (GT Road, Strand Road, ...).
 *   Built ${new Date().toISOString().slice(0, 10)} with ${used.replace(/^https?:\/\//, '').split('/')[0]}.
 */
export const ROUTE_SOURCE = 'roads';

/** @type {readonly (readonly [number, number])[]} */
export const ROUTE_ROADS = Object.freeze([
${body}
]);
`,
);
console.log('Wrote src/jagadhatri/route-roads.js. Now run: npm test, then commit it.');
