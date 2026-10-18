import { haversine } from './geo.js';

/**
 * Order stops for the shortest open walk (exact Held-Karp dynamic programme).
 * Cost is O(2^n * n^2), fine up to `MAX_TOUR_STOPS` (15).
 *
 * @param {string[]} ids         Puja ids to visit
 * @param {import('./types.js').RoutePoint | null} start  Fixed start, or null to let the route begin anywhere
 * @param {Map<string, import('./types.js').Puja>} byId
 * @returns {string[]} the same ids in walking order
 */
export function orderStops(ids, start, byId) {
  const count = ids.length;
  if (count < 2) return ids.slice();
  const points = ids.map((id) => /** @type {import('./types.js').Puja} */ (byId.get(id)));
  const between = (a, b) => haversine(a.la, a.lo, b.la, b.lo);
  const dist = points.map((a) => points.map((b) => between(a, b)));
  const all = (1 << count) - 1;
  // cost[mask * count + last]: shortest path visiting `mask`, ending at `last`
  const cost = new Float64Array((1 << count) * count).fill(Infinity);
  const prev = new Int8Array((1 << count) * count).fill(-1);
  for (let j = 0; j < count; j += 1) cost[(1 << j) * count + j] = start ? haversine(start.la, start.lo, points[j].la, points[j].lo) : 0;
  for (let mask = 1; mask <= all; mask += 1) {
    for (let last = 0; last < count; last += 1) {
      const current = cost[mask * count + last];
      if (current === Infinity || !(mask & (1 << last))) continue;
      for (let next = 0; next < count; next += 1) {
        if (mask & (1 << next)) continue;
        const nextMask = mask | (1 << next);
        const total = current + dist[last][next];
        if (total < cost[nextMask * count + next]) {
          cost[nextMask * count + next] = total;
          prev[nextMask * count + next] = last;
        }
      }
    }
  }
  let end = 0;
  for (let j = 1; j < count; j += 1) if (cost[all * count + j] < cost[all * count + end]) end = j;
  const order = [];
  let mask = all;
  let at = end;
  while (at !== -1) {
    order.push(ids[at]);
    const before = prev[mask * count + at];
    mask &= ~(1 << at);
    at = before;
  }
  return order.reverse();
}

/**
 * The `count` pujas with exact pins closest to a station.
 * @param {import('./types.js').Puja[]} pujas
 * @param {import('./types.js').Station} station
 * @param {number} count
 * @returns {string[]} puja ids, nearest first
 */
export function nearestToStation(pujas, station, count) {
  return pujas
    .filter((puja) => puja.ck)
    .map((puja) => ({ id: puja.id, d: haversine(station.lat, station.lng, puja.la, puja.lo) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, count)
    .map((entry) => entry.id);
}

/** Google Maps allows 10 points (origin, 8 waypoints, destination) per link. */
const POINTS_PER_LINK = 10;

/**
 * Google Maps walking links for a tour, chunked so each link stays within Maps' point limit.
 * Chunks overlap by one point so the walk is continuous.
 *
 * @param {import('./types.js').RoutePoint | null} start
 * @param {import('./types.js').RoutePoint[]} stops
 * @returns {string[]}
 */
export function buildDirectionLinks(start, stops) {
  const points = [...(start ? [start] : []), ...stops];
  const format = (p) => `${p.la},${p.lo}`;
  const links = [];
  for (let i = 0; i < points.length - 1; i += POINTS_PER_LINK - 1) {
    const chunk = points.slice(i, i + POINTS_PER_LINK);
    const waypoints = chunk.length > 2 ? `&waypoints=${chunk.slice(1, -1).map(format).join('%7C')}` : '';
    links.push(
      `https://www.google.com/maps/dir/?api=1&travelmode=walking&origin=${format(chunk[0])}&destination=${format(chunk[chunk.length - 1])}${waypoints}`,
    );
  }
  return links;
}
