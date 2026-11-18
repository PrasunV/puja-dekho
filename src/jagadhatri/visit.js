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
/** An ignored bar fades out after this long. The puja stays quiet for an hour as a live question, then is asked again as "Have you visited?". */
export const AUTO_HIDE_MS = 60_000;
/** Once someone is this far from a puja they were near, they have left it, so "Have you visited?" may ask. */
export const LEFT_RADIUS_M = 200;
/** When the map opens, pujas this close right now are asked about too. */
export const CATCHUP_RADIUS_M = 300;
/** The open-time question comes 5 s after the map opens, and gives up if there is still no good fix after 20 s. */
export const CATCHUP_AFTER_MS = 5_000;
export const CATCHUP_GIVE_UP_MS = 20_000;
/** One bar pages through at most this many pujas, nearest first. */
export const MAX_LATE = 5;
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
/** @typedef {{ day: string, until: Record<string, number>, quiet: number, done?: string[] }} AskMemory */
function memory(/** @type {number} */ now) {
  const v = /** @type {AskMemory | null} */ (storage.get(ASK_KEY, null));
  return v && v.day === night(now) ? v : { day: night(now), until: {}, quiet: 0, done: [] };
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
  m.done = [...new Set([...(m.done ?? []), id])];
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

// ---- "Have you visited?": the pujas this phone saw you near tonight while the app was open ----
const NEAR_KEY = 'jg_near';
/** @typedef {{ day: string, items: Record<string, { at: number, d: number }> }} NearLog */
function nearLog(/** @type {number} */ now) {
  const v = /** @type {NearLog | null} */ (storage.get(NEAR_KEY, null));
  return v && v.day === night(now) ? v : { day: night(now), items: {} };
}

/**
 * Remember every puja within 150 m of a fresh, precise fix: when first seen and how close. Stays on the phone and
 * clears itself at the end of the puja night. Only writes when something is new.
 * @param {{ lat: number, lng: number, accuracy: number, at: number } | null} pos
 * @param {import('./lib.js').JgPuja[]} pujas
 * @param {number} now
 */
export function noteNear(pos, pujas, now) {
  if (!pos || pos.accuracy > MAX_ACCURACY_M || now - pos.at > FRESH_MS) return;
  const log = nearLog(now);
  let changed = false;
  for (const p of pujas) {
    const d = haversine(pos.lat, pos.lng, p.la, p.lo);
    if (d > HERE_RADIUS_M) continue;
    const seen = log.items[p.id];
    if (!seen) {
      log.items[p.id] = { at: now, d: Math.round(d) };
      changed = true;
    } else if (d < seen.d - 10) {
      seen.d = Math.round(d);
      changed = true;
    }
  }
  if (changed) storage.set(NEAR_KEY, log);
}

/** @typedef {{ puja: import('./lib.js').JgPuja, at: number, d: number, kind: 'seen' | 'now' }} LateItem */
/**
 * The pujas to ask "Have you visited?" about, nearest to where you are now first, at most five. Needs a fresh, precise
 * fix. Pujas you were near and have since left (over 200 m), plus, when the map opens, pujas 150-300 m away right now.
 * Never one you already have, answered, said No to, or were already asked about in this visit.
 * @param {{ lat: number, lng: number, accuracy: number, at: number } | null} pos
 * @param {import('./lib.js').JgPuja[]} pujas
 * @param {number} now
 * @param {Set<string>} skip  ids to leave out (already visited, or already asked this time)
 * @param {boolean} onOpen
 * @returns {LateItem[]}
 */
export function lateQueue(pos, pujas, now, skip, onOpen) {
  if (!pos || pos.accuracy > MAX_ACCURACY_M || now - pos.at > FRESH_MS) return [];
  if (memory(now).quiet > now) return [];
  const answered = new Set(memory(now).done ?? []);
  const no = storage.get(NO_KEY, { day: '', ids: /** @type {string[]} */ ([]) });
  const noToday = new Set(no.day === night(now) ? no.ids : []);
  const ok = (/** @type {string} */ id) => !skip.has(id) && !answered.has(id) && !noToday.has(id);
  const log = nearLog(now);
  /** @type {LateItem[]} */
  const out = [];
  const byId = new Map(pujas.map((p) => [p.id, p]));
  for (const [id, s] of Object.entries(log.items)) {
    const p = byId.get(id);
    if (!p || !ok(id)) continue;
    const d = haversine(pos.lat, pos.lng, p.la, p.lo);
    if (d > LEFT_RADIUS_M) out.push({ puja: p, at: s.at, d, kind: 'seen' });
  }
  if (onOpen) {
    for (const p of pujas) {
      if (!ok(p.id) || out.some((x) => x.puja.id === p.id)) continue;
      const d = haversine(pos.lat, pos.lng, p.la, p.lo);
      if (d > HERE_RADIUS_M && d <= CATCHUP_RADIUS_M) out.push({ puja: p, at: now, d, kind: 'now' });
    }
  }
  return out.sort((a, b) => a.d - b.d).slice(0, MAX_LATE);
}

/** The second line under "Have you visited X?": when you were near it, or how far it is now. */
export function lateLine(/** @type {LateItem} */ it) {
  if (it.kind === 'now') return `Near you now · ${Math.max(10, Math.round(it.d / 10) * 10)} m`;
  const t = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit', hour12: true }).format(it.at);
  return `You were near it at ${t.replace(/\b(am|pm)\b/, (m) => m.toUpperCase())}`;
}
