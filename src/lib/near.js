import { NEAR_ACCURACY_M, NEAR_CLEAR_M, NEAR_DWELL_MS, NEAR_RADIUS_M } from '../config.js';
import { haversine } from './geo.js';

/**
 * @typedef {{ since: Record<string, number>, active: string | null, skipped: string[], dismissed: string[] }} NearState
 *   `since`: when each puja was first seen within the radius. `active`: puja currently offered.
 *   `skipped`: pujas the person said are not the one ("Not this one?"). `dismissed`: closed for the session.
 */

export const NO_NEAR = Object.freeze({ since: {}, active: null, skipped: [], dismissed: [] });

/**
 * The "You're near [puja]" rule from the PRD, evaluated only while the app is open. Pure.
 *
 * - Accuracy must be 50 m or better, otherwise nothing is offered and the clock restarts.
 * - The person must stay within 100 m of a puja for 60 seconds.
 * - It clears once they are beyond 150 m (the gap stops it flickering at the edge).
 * - With several pujas in range, the nearest is offered; "Not this one?" moves to the next.
 * - A dismissed puja is not offered again in this session.
 *
 * @param {NearState} state
 * @param {import('./types.js').Position} position
 * @param {import('./types.js').Puja[]} pujas
 * @param {number} now ms
 * @returns {NearState}
 */
export function nextNear(state, position, pujas, now) {
  const accurate = position.acc != null && position.acc <= NEAR_ACCURACY_M;
  if (!accurate) return { ...state, since: {}, active: null };

  const distances = new Map(pujas.map((puja) => [puja.id, haversine(position.lat, position.lng, puja.la, puja.lo)]));
  const since = { ...state.since };
  for (const puja of pujas) {
    const d = distances.get(puja.id) ?? Infinity;
    if (d <= NEAR_RADIUS_M) since[puja.id] ??= now;
    else if (d > NEAR_CLEAR_M) delete since[puja.id];
  }
  // A puja between 100 m and 150 m keeps its timer but cannot start a new one.

  const active =
    state.active && (distances.get(state.active) ?? Infinity) <= NEAR_CLEAR_M && !state.dismissed.includes(state.active)
      ? state.active
      : null;
  if (active) return { ...state, since, active };

  const ready = pujas
    .filter(
      (puja) =>
        (distances.get(puja.id) ?? Infinity) <= NEAR_RADIUS_M &&
        since[puja.id] != null &&
        now - since[puja.id] >= NEAR_DWELL_MS &&
        !state.dismissed.includes(puja.id) &&
        !state.skipped.includes(puja.id),
    )
    .sort((a, b) => (distances.get(a.id) ?? 0) - (distances.get(b.id) ?? 0));
  return { ...state, since, active: ready[0]?.id ?? null };
}

/** "Not this one?": move on to the next puja in range. */
export const skipNear = (/** @type {NearState} */ state) =>
  state.active ? { ...state, skipped: [...state.skipped, state.active], active: null } : state;

/** The person closed the card; it does not return for this puja in the same session. */
export const dismissNear = (/** @type {NearState} */ state) =>
  state.active ? { ...state, dismissed: [...state.dismissed, state.active], active: null } : state;
