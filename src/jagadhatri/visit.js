import { storage } from '../lib/storage.js';
import { haversine } from './lib.js';
import { pujaNight } from './ranks.js';

/**
 * "Are you visiting?" (design 7.13). Visitors are at the puja to take photos and videos and rarely open the map, so the
 * bar can't wait for them to stand still. When the app is on screen and a fresh, accurate fix is within 150 m of a
 * puja, it asks about the nearest one within 2-3 seconds. Everything here runs on the phone; the location is never
 * sent anywhere.
 */
export const HERE_RADIUS_M = 150;
/** A fix less precise than this can't tell which puja you are at, so it never asks. */
export const MAX_ACCURACY_M = 50;
/** A fix older than this is from where you were, not where you are (the browser pauses location in the camera app). */
export const FRESH_MS = 20_000;
/** An ignored bar hides itself after this long and that puja stays quiet for an hour. */
export const AUTO_HIDE_MS = 15_000;
export const SNOOZE_MS = 60 * 60_000;
/** After any answer, no bar for another puja for this long. */
export const QUIET_MS = 2 * 60_000;
const DAY_MS = 24 * 60 * 60_000;
/** "Today" here is the puja night: it runs until 5 AM, so an answer given at 11:50 PM still counts at 12:10 AM. */
const night = pujaNight;

/**
 * The nearest puja within 150 m, or null.
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
 * The puja to ask about right now: the nearest within 150 m, from a fix that is fresh and precise. No fix, an old one or
 * a loose one asks nothing.
 * @param {{ lat: number, lng: number, accuracy: number, at: number } | null} pos
 * @param {import('./lib.js').JgPuja[]} pujas
 * @param {number} now
 */
export function visitCandidate(pos, pujas, now) {
  if (!pos || pos.accuracy > MAX_ACCURACY_M || now - pos.at > FRESH_MS) return null;
  return nearestHere(pos, pujas);
}

// ---- What the phone remembers about asking, for today (so a reload or a closed tab never repeats a question) ----
const ASK_KEY = 'jg_ask';
/** @typedef {{ day: string, until: Record<string, number>, quiet: number }} AskMemory */
function memory(/** @type {number} */ now) {
  const v = /** @type {AskMemory | null} */ (storage.get(ASK_KEY, null));
  return v && v.day === night(now) ? v : { day: night(now), until: {}, quiet: 0 };
}
const save = (/** @type {AskMemory} */ m) => storage.set(ASK_KEY, m);

/** The bar is going up for this puja: it stays quiet for an hour whatever happens next, even if the tab is closed. */
export function noteAsked(/** @type {string} */ id, /** @type {number} */ now) {
  const m = memory(now);
  m.until[id] = now + SNOOZE_MS;
  save(m);
}
/** Yes or No was tapped: not this puja again today, and no bar for any puja for 2 minutes. */
export function noteAnswered(/** @type {string} */ id, /** @type {number} */ now) {
  const m = memory(now);
  m.until[id] = now + DAY_MS;
  m.quiet = now + QUIET_MS;
  save(m);
}

// "No" also means not again today for that puja.
const NO_KEY = 'jg_no';
export function saidNoToday(/** @type {string} */ id, /** @type {number} */ now) {
  const v = storage.get(NO_KEY, { day: '', ids: /** @type {string[]} */ ([]) });
  return v.day === night(now) && v.ids.includes(id);
}
export function sayNo(/** @type {string} */ id, /** @type {number} */ now) {
  const day = night(now);
  const v = storage.get(NO_KEY, { day: '', ids: /** @type {string[]} */ ([]) });
  storage.set(NO_KEY, { day, ids: [...(v.day === day ? v.ids : []), id] });
  noteAnswered(id, now);
}

/** May the bar ask about this puja now? Not if it was answered or asked recently, not during the 2 quiet minutes. */
export function canAsk(/** @type {string} */ id, /** @type {number} */ now) {
  if (saidNoToday(id, now)) return false;
  const m = memory(now);
  return m.quiet <= now && !((m.until[id] ?? 0) > now);
}

/** Minutes since a time, for "12 min ago". */
export function agoText(/** @type {number} */ at, /** @type {number} */ now) {
  const m = Math.max(0, Math.round((now - at) / 60_000));
  return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : '1 hr ago';
}
