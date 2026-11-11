import { storage } from '../lib/storage.js';
import { haversine } from './lib.js';
import { istDay } from './ranks.js';

/**
 * "Are you visiting?" (design 7.13): after 2 minutes within 100 m of the same puja, the app asks. Everything here runs
 * on the phone; the location is never sent anywhere.
 */
export const HERE_RADIUS_M = 100;
export const DWELL_MS = 2 * 60_000;
/** A fix less precise than this can't tell two neighbouring pujas apart, so it never starts or ends a stay. */
export const MAX_ACCURACY_M = 75;

/** @typedef {{ id: string | null, since: number }} Stay */
export const NO_STAY = Object.freeze({ id: null, since: 0 });

/**
 * The nearest puja within 100 m, or null.
 * @param {{ lat: number, lng: number }} pos
 * @param {import('./lib.js').JgPuja[]} pujas
 */
export function nearestHere(pos, pujas) {
  let best = null;
  let bestD = Infinity;
  for (const p of pujas) {
    const d = haversine(pos.lat, pos.lng, p.la, p.lo);
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  return best && bestD <= HERE_RADIUS_M ? best : null;
}

/**
 * The next stay: same puja keeps its start time, a different one starts again, nothing near ends it. An imprecise fix
 * changes nothing.
 * @param {Stay} stay
 * @param {{ lat: number, lng: number, accuracy: number } | null} pos
 * @param {import('./lib.js').JgPuja[]} pujas
 * @param {number} now
 * @returns {Stay}
 */
export function nextStay(stay, pos, pujas, now) {
  if (!pos) return NO_STAY;
  if (pos.accuracy > MAX_ACCURACY_M) return stay;
  const p = nearestHere(pos, pujas);
  if (!p) return NO_STAY;
  return stay.id === p.id ? stay : { id: p.id, since: now };
}

export const stayedLongEnough = (/** @type {Stay} */ stay, /** @type {number} */ now) => stay.id != null && now - stay.since >= DWELL_MS;

// "No" means not again today for that puja.
const NO_KEY = 'jg_no';
export function saidNoToday(/** @type {string} */ id, /** @type {number} */ now) {
  const v = storage.get(NO_KEY, { day: '', ids: /** @type {string[]} */ ([]) });
  return v.day === istDay(now) && v.ids.includes(id);
}
export function sayNo(/** @type {string} */ id, /** @type {number} */ now) {
  const day = istDay(now);
  const v = storage.get(NO_KEY, { day: '', ids: /** @type {string[]} */ ([]) });
  storage.set(NO_KEY, { day, ids: [...(v.day === day ? v.ids : []), id] });
}

/** Minutes since a time, for "12 min ago". */
export function agoText(/** @type {number} */ at, /** @type {number} */ now) {
  const m = Math.max(0, Math.round((now - at) / 60_000));
  return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : '1 hr ago';
}
