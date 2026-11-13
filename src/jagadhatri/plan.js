import { DETOUR, LAST_FERRY_MIN, LAST_TRAIN_MIN, STAY_MIN, WALK_KMH } from './config.js';
import { ageOf, haversine } from './lib.js';

/** @typedef {import('./lib.js').JgPuja} JgPuja */
/** @typedef {{ id: string, name: string, kind: 'station' | 'ghat' | 'me', la: number, lo: number }} PlanPoint */
/**
 * @typedef {object} Plan
 * @property {string} title
 * @property {PlanPoint} start
 * @property {PlanPoint} end
 * @property {JgPuja[]} stops     In walking order
 * @property {number} km          Walking distance (streets, estimated)
 * @property {number} minutes     Walking plus time at each puja
 * @property {number} asked       Minutes asked for (0 for a Best route)
 * @property {boolean} trimmed    Cut short to make the last train or ferry
 * @property {boolean} [late]     Even walking straight there misses the last train or ferry
 * @property {number} [left]      Minutes left before the last way home (Infinity earlier in the day)
 * @property {string} [blurb]
 * @property {string} [bestId]
 * @property {{ title: string, note: string, from: number, count: number }[]} [stages]  Guide stages over `stops`
 * @property {{ title: string, note: string, stops: JgPuja[], after: number }} [detour]  Optional stage, after stage `after`
 */

const isJubilee = (/** @type {JgPuja} */ p) => p.c === 'Jubilee' || p.c === 'Pre-Jubilee';

/** Minutes spent at a puja. */
export const stayAt = (/** @type {JgPuja} */ p) => (p.pop ? STAY_MIN.must : isJubilee(p) ? STAY_MIN.jubilee : STAY_MIN.other);

/** Walking minutes between two points (straight line x detour, at crowd pace). */
const walkMin = (/** @type {{ la: number, lo: number }} */ a, /** @type {{ la: number, lo: number }} */ b) =>
  ((haversine(a.la, a.lo, b.la, b.lo) / 1000) * DETOUR * 60) / WALK_KMH;

/** How much a puja is worth on a plan: Must visit first, then Jubilee and Pre-Jubilee, then Adi Puja, then any other. */
const worth = (/** @type {JgPuja} */ p) => (p.pop ? 5 : 0) + (isJubilee(p) ? 2.5 : 0) + (p.c === 'Adi Puja' ? 1.2 : 0) + 0.5;

/** Total minutes for start → stops → end. */
function total(
  /** @type {PlanPoint} */ start,
  /** @type {JgPuja[]} */ stops,
  /** @type {PlanPoint} */ end,
  /** @type {number | undefined} */ stay = undefined,
) {
  let t = 0;
  let at = /** @type {{ la: number, lo: number }} */ (start);
  for (const p of stops) {
    t += walkMin(at, p) + (stay ?? stayAt(p));
    at = p;
  }
  return t + walkMin(at, end);
}

/** Walking km for start → stops → end. */
function walkKm(/** @type {PlanPoint} */ start, /** @type {JgPuja[]} */ stops, /** @type {PlanPoint} */ end) {
  const pts = [start, ...stops, end];
  let m = 0;
  for (let i = 1; i < pts.length; i++) m += haversine(pts[i - 1].la, pts[i - 1].lo, pts[i].la, pts[i].lo);
  return (m / 1000) * DETOUR;
}

/**
 * The best walk from `start` to `end` that fits in `minutes`: keeps adding the puja worth the most per extra minute,
 * at the place in the order where it costs least. Only pujas within 4 km of the start or end are considered.
 * @param {JgPuja[]} pujas
 * @param {PlanPoint} start
 * @param {PlanPoint} end
 * @param {number} minutes
 * @returns {JgPuja[]}
 */
export function buildRoute(pujas, start, end, minutes) {
  const near = pujas.filter((p) => Math.min(haversine(start.la, start.lo, p.la, p.lo), haversine(end.la, end.lo, p.la, p.lo)) < 4000);
  /** @type {JgPuja[]} */
  let route = [];
  const used = new Set();
  for (;;) {
    const base = total(start, route, end);
    /** @type {{ score: number, next: JgPuja[], id: string } | null} */
    let best = null;
    for (const p of near) {
      if (used.has(p.id)) continue;
      for (let i = 0; i <= route.length; i++) {
        const next = [...route.slice(0, i), p, ...route.slice(i)];
        const t = total(start, next, end);
        if (t > minutes) continue;
        const score = worth(p) / Math.max(t - base, 1);
        if (!best || score > best.score) best = { score, next, id: p.id };
      }
    }
    if (!best) return route;
    route = best.next;
    used.add(best.id);
  }
}

/** Minutes after midnight, India time. */
const istMinutes = (/** @type {number} */ now) => {
  const d = new Date(now + 330 * 60_000);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
};

/**
 * Minutes left before the last train (stations) or ferry (ghats) from `end`, or Infinity in the morning and early
 * afternoon (before 2 PM), when people plan ahead rather than set off.
 * @param {PlanPoint} end
 * @param {number} now
 */
export function minutesLeft(end, now) {
  const m = istMinutes(now);
  if (m < 14 * 60 && m > 4 * 60) return Infinity;
  const last = end.kind === 'ghat' ? LAST_FERRY_MIN : LAST_TRAIN_MIN;
  const left = (m <= 4 * 60 ? last - 24 * 60 : last) - m;
  return Math.max(0, left - 10); // 10 minutes to spare at the platform or the jetty
}

/** "Last train 12:00 AM" / "Last ferry 10:00 PM". */
export const lastWayHome = (/** @type {PlanPoint} */ end) => (end.kind === 'ghat' ? 'Last ferry 10:00 PM' : 'Last train 12:00 AM');

/**
 * A plan for `hours` from start to end, trimmed to make the last train or ferry.
 * @param {JgPuja[]} pujas
 * @param {PlanPoint} start
 * @param {PlanPoint} end
 * @param {number} hours
 * @param {number} now
 * @returns {Plan}
 */
export function makePlan(pujas, start, end, hours, now) {
  const asked = hours * 60;
  const left = minutesLeft(end, now);
  const budget = Math.min(asked, left);
  const stops = budget >= 20 ? buildRoute(pujas, start, end, budget) : [];
  return {
    title: `${start.name} to ${end.name}`,
    start,
    end,
    stops,
    km: walkKm(start, stops, end),
    minutes: total(start, stops, end),
    asked,
    trimmed: left < asked,
    late: walkMin(start, end) > left,
    left,
  };
}

/**
 * A Best route, with its numbers worked out the same way. A staged route keeps its stages (title, walking note and the
 * range of stops); an optional stage is kept aside as `detour`, outside the totals and the map line.
 * @param {(typeof import('./config.js').BEST_ROUTES)[number]} r
 * @param {Map<string, JgPuja>} byId
 * @param {Map<string, PlanPoint>} points
 * @returns {Plan | null}
 */
export function bestPlan(r, byId, points) {
  const start = points.get(r.start);
  const end = points.get(r.end);
  if (!start || !end) return null;
  const pick = (/** @type {readonly string[]} */ ids) => /** @type {JgPuja[]} */ (ids.map((id) => byId.get(id)).filter((p) => !!p));
  /** @type {JgPuja[]} */
  const stops = [];
  /** @type {NonNullable<Plan['stages']>} */
  const stages = [];
  /** @type {Plan['detour']} */
  let detour;
  if (r.stages) {
    for (const st of r.stages) {
      const list = pick(st.stops);
      if (st.optional) {
        detour = { title: st.title, note: st.note, stops: list, after: stages.length };
        continue;
      }
      stages.push({ title: st.title, note: st.note, from: stops.length, count: list.length });
      stops.push(...list);
    }
  } else stops.push(...pick(r.stops ?? []));
  if (stops.length === 0) return null;
  return {
    title: r.title,
    blurb: r.blurb,
    bestId: r.id,
    start,
    end,
    stops,
    stages: stages.length ? stages : undefined,
    detour,
    km: walkKm(start, stops, end),
    minutes: total(start, stops, end, r.stay),
    asked: 0,
    trimmed: false,
  };
}

/** Counts for a plan's stats row: Must visit, Jubilee or Pre-Jubilee, 100+ years, in the procession. */
export function planStats(/** @type {Plan} */ plan) {
  return {
    must: plan.stops.filter((p) => p.pop).length,
    jubilee: plan.stops.filter(isJubilee).length,
    old: plan.stops.filter((p) => (ageOf(p) ?? 0) >= 100).length,
    procession: plan.stops.filter((p) => !!p.pr).length,
  };
}

/** "2 h 10 min", "45 min". */
export function durationText(/** @type {number} */ minutes) {
  const m = Math.round(minutes / 5) * 5;
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (!h) return `${r} min`;
  return r ? `${h} h ${r} min` : `${h} h`;
}

/** The tag for a stop: "Jubilee 60th year", "Pre-Jubilee 124th year", "Adi Puja", or nothing. */
export function stopTag(/** @type {JgPuja} */ p) {
  const age = ageOf(p);
  const nth = (/** @type {number} */ n) => {
    const s = n % 100 >= 11 && n % 100 <= 13 ? 'th' : (['th', 'st', 'nd', 'rd'][n % 10] ?? 'th');
    return `${n}${s}`;
  };
  if (isJubilee(p)) return age ? `${p.c} ${nth(age)} year` : p.c;
  if (p.c === 'Adi Puja') return 'Adi Puja';
  return '';
}

/** Google Maps walking directions to the next stop (from wherever the phone is). */
export const walkUrl = (/** @type {{ la: number, lo: number }} */ to) =>
  `https://www.google.com/maps/dir/?api=1&destination=${to.la},${to.lo}&travelmode=walking`;
