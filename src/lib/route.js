/**
 * Walking route preview from OpenRouteService (free tier). Called only when a route is needed.
 * With no key, or on any failure, the answer is null: the route line is simply not drawn and
 * the Google Maps hand-off keeps working.
 */

import { WALK_DETOUR_FACTOR, WALK_METRES_PER_MIN, formatDistance } from './geo.js';

const ENDPOINT = 'https://api.openrouteservice.org/v2/directions/foot-walking/geojson';

/**
 * @typedef {{ coords: [number, number][], distance: number, duration: number }} Route
 *   `coords` are `[lng, lat]` pairs, `distance` is metres and `duration` is seconds on foot.
 */

/**
 * Pull the line and its totals out of an OpenRouteService GeoJSON answer.
 * @param {any} body
 * @returns {Route | null}
 */
export function parseRoute(body) {
  const feature = body?.features?.[0];
  const coords = feature?.geometry?.coordinates;
  if (!Array.isArray(coords) || coords.length < 2) return null;
  const summary = feature?.properties?.summary;
  return {
    coords: coords.map((pair) => /** @type {[number, number]} */ ([Number(pair[0]), Number(pair[1])])),
    distance: Number(summary?.distance) || 0,
    duration: Number(summary?.duration) || 0,
  };
}

/** The label on the map line, like Google Maps: "1 hr 21 min · 5.8 km". */
export function routeLabel(/** @type {Route} */ route) {
  const minutes = Math.max(1, Math.round(route.duration / 60));
  const time = minutes >= 60 ? `${Math.floor(minutes / 60)} hr ${minutes % 60} min` : `${minutes} min`;
  const km = route.distance / 1000;
  const far = route.distance >= 1000 ? `${km.toFixed(1)} km` : `${Math.round(route.distance / 10) * 10} m`;
  return route.distance ? `${time} · ${far}` : time;
}

/**
 * @param {{ lat: number, lng: number }} from
 * @param {{ lat: number, lng: number }} to
 * @param {{ key: string, signal?: AbortSignal, fetcher?: typeof fetch }} options
 * @returns {Promise<Route | null>}
 */
export async function walkingRoute(from, to, { key, signal, fetcher = fetch }) {
  if (!key) return null;
  try {
    const res = await fetcher(ENDPOINT, {
      method: 'POST',
      signal,
      headers: { Authorization: key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        coordinates: [
          [from.lng, from.lat],
          [to.lng, to.lat],
        ],
      }),
    });
    if (!res.ok) return null;
    return parseRoute(await res.json());
  } catch {
    return null;
  }
}

/**
 * The one answer to "how far, how long" for the open puja. When a route is drawn its road distance and
 * time are used everywhere, so the map label and the puja page can never disagree. Until then (or with no
 * route) it is a straight-line estimate and is shown with a "~".
 * @param {number | null | undefined} straightLineM  Straight-line metres from the person, if known
 * @param {Route | null} route
 * @returns {{ distance: number, duration: number, exact: boolean } | null}
 */
export function tripFor(straightLineM, route) {
  if (route && route.distance > 0) return { distance: route.distance, duration: route.duration, exact: true };
  if (straightLineM == null) return null;
  const distance = straightLineM * WALK_DETOUR_FACTOR;
  return { distance, duration: (distance / WALK_METRES_PER_MIN) * 60, exact: false };
}

/** "1.9 km · 26 min walk", or "~1.9 km · ~26 min walk" for an estimate. */
export function tripText(/** @type {{ distance: number, duration: number, exact: boolean }} */ trip, suffix = ' walk') {
  const tilde = trip.exact ? '' : '~';
  const minutes = Math.max(1, Math.round(trip.duration / 60));
  const time = minutes >= 60 ? `${Math.floor(minutes / 60)} hr ${minutes % 60} min` : `${minutes} min`;
  return `${tilde}${formatDistance(trip.distance)} · ${tilde}${time}${suffix}`;
}
