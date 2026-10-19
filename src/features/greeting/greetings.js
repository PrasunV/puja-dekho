import { todayIst } from '../../lib/geo.js';
import { storage } from '../../lib/storage.js';

/**
 * Festival greetings that play in the first sheet a person sees. To add one: put the .lottie file in public/anim/
 * exactly as exported and add a row here. `days` are India dates (YYYY-MM-DD) it plays on; `null` means any day.
 * `maxShows` is how many opens a phone sees it for (`null`: every open). `installedToo` lets the installed app
 * (home-screen icon) see it as well as a browser. If two rows match today, the first one wins.
 * @typedef {{ id: string, file: string, label: string, width: number, height: number, days: string[] | null, maxShows: number | null, installedToo: boolean }} Greeting
 */
/** @type {Greeting[]} */
export const GREETINGS = [
  {
    id: 'maha-ashtami',
    file: '/anim/maha-ashtami.lottie',
    label: 'Shubho Maha Ashtami',
    width: 400,
    height: 140,
    // Today only, for everyone: every open, browser or installed app.
    days: ['2026-10-19'],
    maxShows: null,
    installedToo: true,
  },
];

/** What the e2e suite uses, so it does not depend on the date: any day, three opens, browser only. */
const E2E_RULES = { days: null, maxShows: 3, installedToo: false };
/** How long the shimmer box waits for the animation before it gives up and shows the normal icon instead. */
export const LOAD_BUDGET_MS = 8000;

/** The player's engine (WebAssembly). Served from our own files, so it works offline once seen and needs no CDN. */
const WASM_URL = new URL('../../../node_modules/@lottiefiles/dotlottie-web/dist/dotlottie-player.wasm', import.meta.url).href;

const STORE_KEY = 'greeted';

/** @returns {Record<string, number>} */
const shownCounts = () => storage.get(STORE_KEY, {});

/** Called when a greeting has really started playing; failed loads are not counted. */
export function markGreeted(/** @type {string} */ id) {
  const counts = shownCounts();
  storage.set(STORE_KEY, { ...counts, [id]: (counts[id] ?? 0) + 1 });
}

/** Opened from the installed app (home-screen icon) rather than from a link in a browser. */
function isInstalledApp() {
  return Boolean(window.matchMedia?.('(display-mode: standalone)').matches || /** @type {any} */ (navigator).standalone === true);
}

/**
 * Which greeting this open should show, if any. Every open on the days the row names (browser, and the installed app when the row allows it), up to its `maxShows`. `?greeting=<id>`
 * forces one (for checking it; not counted) and `?greeting=off` turns it off. The e2e suite is off unless forced (or
 * it sets `__PD_E2E_GREETING__`).
 * @returns {{ greeting: Greeting, forced: boolean } | null}
 */
function decide() {
  const asked = new URLSearchParams(location.search).get('greeting');
  if (asked === 'off') return null;
  if (asked) {
    const greeting = GREETINGS.find((g) => g.id === asked);
    return greeting ? { greeting, forced: true } : null;
  }
  const w = /** @type {any} */ (window);
  if (w.__PD_E2E__ && !w.__PD_E2E_GREETING__) return null;
  // Tests may pass an object to override the rules (for instance to check "every open").
  const rules = w.__PD_E2E__ ? { ...E2E_RULES, ...(typeof w.__PD_E2E_GREETING__ === 'object' ? w.__PD_E2E_GREETING__ : {}) } : {};
  const installed = isInstalledApp();
  const today = todayIst();
  const greeting = GREETINGS.map((g) => ({ ...g, ...rules })).find(
    (g) =>
      (g.days === null || g.days.includes(today)) &&
      (g.maxShows === null || (shownCounts()[g.id] ?? 0) < g.maxShows) &&
      (!installed || g.installedToo),
  );
  return greeting ? { greeting, forced: false } : null;
}

/** @type {ReturnType<typeof decide> | undefined} */
let decided;
/** Decided once per page load, so the answer cannot change under the screen. */
export function decideGreeting() {
  if (decided === undefined) decided = decide();
  return decided;
}

/** @type {string | null} */
let claimedBy = null;
/**
 * The first sheet to ask gets the greeting for this open; any other sheet gets null and keeps its normal icon.
 * Asking again with the same key gives the same answer.
 */
export function claimGreeting(/** @type {string} */ key) {
  if (claimedBy === null) claimedBy = key;
  return claimedBy === key ? decideGreeting() : null;
}

/** @type {Map<string, Promise<{ DotLottie: any, buffer: ArrayBuffer }>>} */
const loading = new Map();
/**
 * Fetch the player and the animation file together, once; the engine file is fetched too, so the player does not
 * wait for it later. Each is a separate request, so a slow network pays for them in parallel.
 */
export function loadGreeting(/** @type {Greeting} */ greeting) {
  let promise = loading.get(greeting.id);
  if (!promise) {
    promise = Promise.all([
      import('@lottiefiles/dotlottie-web').then((m) => {
        m.DotLottie.setWasmUrl(WASM_URL);
        return m.DotLottie;
      }),
      fetch(greeting.file).then((r) => {
        if (!r.ok) throw new Error(`greeting ${r.status}`);
        return r.arrayBuffer();
      }),
      fetch(WASM_URL).then((r) => {
        if (!r.ok) throw new Error(`engine ${r.status}`);
        return r.arrayBuffer();
      }),
    ]).then(([DotLottie, buffer]) => ({ DotLottie, buffer }));
    promise.catch(() => loading.delete(greeting.id)); // a failed load can be tried again
    loading.set(greeting.id, promise);
  }
  return promise;
}

/** Start fetching as early as possible: at app start, before any sheet exists. */
export function warmGreeting() {
  const d = decideGreeting();
  if (d) loadGreeting(d.greeting).catch(() => {});
}
