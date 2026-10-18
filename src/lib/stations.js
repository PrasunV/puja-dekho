import { NEAR_STATION_M } from '../config.js';
import { isClosed } from './schedule.js';
import { haversine } from './geo.js';

/** The wider search when a station has no pujas within `NEAR_STATION_M`. */
export const FALLBACK_STATION_M = 5000;

/**
 * Pujas within `metres` of a point.
 * @param {{ lat: number, lng: number }} point
 * @param {import('./types.js').Puja[]} pujas
 * @param {number} metres
 */
export const countWithin = (point, pujas, metres) => pujas.filter((p) => haversine(point.lat, point.lng, p.la, p.lo) <= metres).length;

/**
 * What a station can offer, so no screen ever says "no pujas" and stops there:
 *  1. pujas within 1 km, if there are any;
 *  2. else pujas within 5 km;
 *  3. else the nearest other open station that has pujas within 1 km.
 *
 * @param {import('./types.js').Station} station
 * @param {import('./types.js').Station[]} stations
 * @param {import('./types.js').Puja[]} pujas
 * @returns {{ radius: number, count: number, near: number, nearest: { station: import('./types.js').Station, distance: number, count: number } | null }}
 *   `radius` is the distance actually used, `count` the pujas inside it, `near` the count within 1 km.
 */
export function stationOutlook(station, stations, pujas) {
  const near = countWithin(station, pujas, NEAR_STATION_M);
  if (near > 0) return { radius: NEAR_STATION_M, count: near, near, nearest: null };
  const wide = countWithin(station, pujas, FALLBACK_STATION_M);
  if (wide > 0) return { radius: FALLBACK_STATION_M, count: wide, near, nearest: null };
  const candidates = stations
    .filter((other) => other.id !== station.id && other.lines.length && !isClosed(other.id))
    .map((other) => ({
      station: other,
      distance: haversine(station.lat, station.lng, other.lat, other.lng),
      count: countWithin(other, pujas, NEAR_STATION_M),
    }))
    .filter((entry) => entry.count > 0)
    .sort((a, b) => a.distance - b.distance);
  return { radius: NEAR_STATION_M, count: 0, near, nearest: candidates[0] ?? null };
}

/** The sub line under a station row. */
export function outlookText(/** @type {ReturnType<typeof stationOutlook>} */ outlook) {
  const n = outlook.count;
  const km = `${outlook.radius / 1000} km`;
  if (n > 0) return `${n} ${n === 1 ? 'puja' : 'pujas'} within ${km}`;
  return outlook.nearest ? `No pujas within 5 km. Nearest with pujas: ${outlook.nearest.station.name}` : 'No pujas within 5 km';
}
