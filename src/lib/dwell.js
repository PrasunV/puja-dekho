import { DWELL_MINUTES, DWELL_RADIUS_M, DWELL_REASK_MS } from '../config.js';
import { haversine } from './geo.js';

/**
 * @typedef {{ id: string | null, since: number }} DwellState  Which puja the person has been near, and since when
 */

export const NO_DWELL = Object.freeze({ id: null, since: 0 });

/**
 * Decide whether to ask "is it crowded here?". Pure: all inputs are arguments.
 *
 * The person must stay within `DWELL_RADIUS_M` of the same puja for `DWELL_MINUTES`,
 * and is not asked about the same puja again for `DWELL_REASK_MS`.
 *
 * @param {DwellState} state
 * @param {import('./types.js').Position} position
 * @param {import('./types.js').Puja[]} pujas
 * @param {number} now ms
 * @param {Record<string, number>} askedAt Puja id -> when we last asked
 * @returns {{ state: DwellState, ask: import('./types.js').Puja | null }}
 */
export function nextDwell(state, position, pujas, now, askedAt) {
  let nearest = null;
  let nearestDist = Infinity;
  for (const puja of pujas) {
    const d = haversine(position.lat, position.lng, puja.la, puja.lo);
    if (d < nearestDist) {
      nearestDist = d;
      nearest = puja;
    }
  }
  if (!nearest || nearestDist > DWELL_RADIUS_M) return { state: NO_DWELL, ask: null };
  if (state.id !== nearest.id) return { state: { id: nearest.id, since: now }, ask: null };
  const stayedLongEnough = now - state.since >= DWELL_MINUTES * 60_000;
  const notAskedRecently = now - (askedAt[nearest.id] || 0) > DWELL_REASK_MS;
  return { state, ask: stayedLongEnough && notAskedRecently ? nearest : null };
}
