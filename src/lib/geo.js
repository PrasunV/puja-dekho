const EARTH_RADIUS_M = 6_371_000;
/** Real walking routes are longer than the straight line; this is a rough city factor. */
export const WALK_DETOUR_FACTOR = 1.3;
export const WALK_METRES_PER_MIN = 75;

/**
 * Straight-line distance in metres between two coordinates.
 * @param {number} lat1
 * @param {number} lng1
 * @param {number} lat2
 * @param {number} lng2
 */
export function haversine(lat1, lng1, lat2, lng2) {
  const toRad = Math.PI / 180;
  const a =
    Math.sin(((lat2 - lat1) * toRad) / 2) ** 2 +
    Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.sin(((lng2 - lng1) * toRad) / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
}

/**
 * Is a point inside a `[west, south, east, north]` box?
 * @param {number} lat
 * @param {number} lng
 * @param {readonly [number, number, number, number]} bounds
 */
export const inBounds = (lat, lng, bounds) => lng >= bounds[0] && lng <= bounds[2] && lat >= bounds[1] && lat <= bounds[3];

/**
 * A circle of `radiusM` metres around a point as a closed GeoJSON ring (`[lng, lat]` pairs),
 * for drawing the location accuracy area on the map.
 * @param {number} lat
 * @param {number} lng
 * @param {number} radiusM
 * @param {number} [steps]
 * @returns {[number, number][]}
 */
export function circleRing(lat, lng, radiusM, steps = 64) {
  const metresPerDegLat = (Math.PI / 180) * EARTH_RADIUS_M;
  const metresPerDegLng = metresPerDegLat * Math.cos((lat * Math.PI) / 180);
  const ring = Array.from({ length: steps }, (_, i) => {
    const angle = (i / steps) * 2 * Math.PI;
    return /** @type {[number, number]} */ ([
      lng + (Math.cos(angle) * radiusM) / metresPerDegLng,
      lat + (Math.sin(angle) * radiusM) / metresPerDegLat,
    ]);
  });
  ring.push(ring[0]);
  return ring;
}

/**
 * "350 m" or "1.2 km".
 * @param {number} metres
 */
export const formatDistance = (metres) => (metres < 1000 ? `${Math.round(metres / 10) * 10} m` : `${(metres / 1000).toFixed(1)} km`);

/**
 * Walking minutes for a straight-line distance, with the detour factor applied. At least 1.
 * @param {number} straightLineM
 */
export const walkMinutes = (straightLineM) => Math.max(1, Math.round((straightLineM * WALK_DETOUR_FACTOR) / WALK_METRES_PER_MIN));

/**
 * "Within 500 m" style label for a distance band. 0 means no limit.
 * @param {number} metres
 */
export const formatBand = (metres) => (metres === 0 ? 'Any distance' : metres < 1000 ? `${metres} m` : `${metres / 1000} km`);

/**
 * Current position from the browser, as a promise.
 * @param {{ timeout?: number, highAccuracy?: boolean }} [options]
 * @returns {Promise<import('./types.js').Position>}
 */
export function getPosition({ timeout = 8000, highAccuracy = false } = {}) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not available'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy }),
      reject,
      { enableHighAccuracy: highAccuracy, timeout, maximumAge: 15_000 },
    );
  });
}

/**
 * MapLibre zoom is one step below the Leaflet zoom for the same view. The map config and
 * most of our numbers were tuned in Leaflet terms, so convert in one place.
 * @param {number} leafletZoom
 */
export const toMapZoom = (leafletZoom) => leafletZoom - 1;

/** Today's date in India, `YYYY-MM-DD`. Puja schedules are in IST regardless of the viewer's zone. */
export const todayIst = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
