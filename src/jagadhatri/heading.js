/**
 * Which way the person is going, for the arrow on the location pin. Walking direction comes first, because it is the
 * way they are really heading; the phone compass fills in when they stand still. With neither, there is no direction
 * and the pin stays a plain dot, so it never points the wrong way.
 */
/** Below this speed (m/s) the GPS heading is noise, which is common in a packed lane. */
export const WALK_MIN_SPEED = 1;
/** A GPS heading older than this is from where they were. */
export const GPS_HEADING_MAX_AGE_MS = 5_000;
/** A compass reading older than this means the sensor has stopped. */
export const COMPASS_MAX_AGE_MS = 3_000;

/**
 * @param {{
 *   gps: { heading: number | null, speed: number | null, at: number } | null,
 *   compass: { heading: number, at: number } | null,
 *   now: number,
 * }} s
 * @returns {number | null}  degrees clockwise from north, or null when the direction is not known
 */
export function pickHeading({ gps, compass, now }) {
  if (
    gps &&
    gps.heading != null &&
    Number.isFinite(gps.heading) &&
    gps.speed != null &&
    gps.speed >= WALK_MIN_SPEED &&
    now - gps.at <= GPS_HEADING_MAX_AGE_MS
  ) {
    return norm(gps.heading);
  }
  if (compass && Number.isFinite(compass.heading) && now - compass.at <= COMPASS_MAX_AGE_MS) return norm(compass.heading);
  return null;
}

export const norm = (/** @type {number} */ deg) => ((deg % 360) + 360) % 360;

/** The shortest signed turn from one heading to another, in degrees (-180 to 180). */
export const turn = (/** @type {number} */ from, /** @type {number} */ to) => ((((to - from) % 360) + 540) % 360) - 180;

/** Ease towards a new heading along the short way round, so 359° to 1° is a 2° turn, not 358°. */
export function smoothAngle(/** @type {number | null} */ prev, /** @type {number} */ next, alpha = 0.35) {
  if (prev == null) return norm(next);
  return norm(prev + turn(prev, next) * alpha);
}

/**
 * A heading from a device-orientation event, or null. iPhone gives a ready compass heading; Android gives `alpha`
 * (anticlockwise from north) on the absolute event only. `screenAngle` corrects for a rotated screen.
 * @param {{ webkitCompassHeading?: number, alpha?: number | null, absolute?: boolean }} e
 */
export function compassFromEvent(e, screenAngle = 0) {
  if (typeof e.webkitCompassHeading === 'number' && Number.isFinite(e.webkitCompassHeading))
    return norm(e.webkitCompassHeading + screenAngle);
  if (e.absolute && typeof e.alpha === 'number' && Number.isFinite(e.alpha)) return norm(360 - e.alpha + screenAngle);
  return null;
}
