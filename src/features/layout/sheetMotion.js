/**
 * The ways the bottom sheet can move once a finger lets go. `ios` is what the app ships with; the others stay so the
 * feel can be compared again on a real phone (see MotionLab.jsx). Pick one without a rebuild:
 *   - add `?motionlab` to the address to get the switcher on screen, or
 *   - add `?sheetMotion=quick-out` (any key below) to just set it.
 *
 * `projectMs` is how far ahead the release speed looks when choosing where the sheet comes to rest; a bigger number
 * makes a short flick travel further (it jumps a state more easily). `flickV` is the release speed (px per ms) above
 * which a flick always moves at least one state.
 *
 * @typedef {{
 *   label: string,
 *   note: string,
 *   kind: 'spring' | 'tween',
 *   spring?: { stiffness: number, damping: number, mass: number },
 *   duration?: number,
 *   ease?: [number, number, number, number],
 *   projectMs: number,
 *   flickV: number,
 * }} SheetMotion
 */

/** @type {Record<string, SheetMotion>} */
export const SHEET_MOTIONS = {
  spring: {
    label: 'Soft spring',
    note: 'Slight overshoot (~3%), settles in about 0.45 s. Carries your finger speed into the settle.',
    kind: 'spring',
    spring: { stiffness: 300, damping: 26, mass: 1 },
    projectMs: 220,
    flickV: 0.5,
  },
  snappy: {
    label: 'Snappy spring',
    note: 'Stiff and critically damped: no overshoot, lands in about 0.3 s. Carries your finger speed.',
    kind: 'spring',
    spring: { stiffness: 520, damping: 46, mass: 1 },
    projectMs: 200,
    flickV: 0.45,
  },
  'quick-out': {
    label: 'Quick ease-out',
    note: 'Starts fast, brakes hard. 240 ms, cubic-bezier(0.25, 1, 0.5, 1) (ease-out-quart). No overshoot.',
    kind: 'tween',
    duration: 0.24,
    ease: [0.25, 1, 0.5, 1],
    projectMs: 200,
    flickV: 0.45,
  },
  decel: {
    label: 'Fast deceleration',
    note: 'Material "emphasized decelerate": jumps almost all the way at once, then eases in. 340 ms.',
    kind: 'tween',
    duration: 0.34,
    ease: [0.05, 0.7, 0.1, 1],
    projectMs: 200,
    flickV: 0.45,
  },
  ios: {
    label: 'iOS-style',
    note: 'Lightly damped spring that keeps your momentum, a hint of give at the end. About 0.4 s.',
    kind: 'spring',
    spring: { stiffness: 400, damping: 34, mass: 1 },
    projectMs: 260,
    flickV: 0.4,
  },
  bouncy: {
    label: 'Bouncy',
    note: 'Playful, clearly visible overshoot (~10%). For comparison, probably too much.',
    kind: 'spring',
    spring: { stiffness: 260, damping: 18, mass: 1 },
    projectMs: 220,
    flickV: 0.5,
  },
};

/** The motion the app ships with (chosen after trying the others on a phone). */
export const DEFAULT_SHEET_MOTION = 'ios';
const STORAGE_KEY = 'pdSheetMotion';

/** Whether the on-screen switcher should show. */
export function motionLabEnabled() {
  if (typeof window === 'undefined') return false;
  const w = /** @type {any} */ (window);
  return Boolean(w.__PD_MOTION_LAB__) || new URLSearchParams(window.location.search).has('motionlab');
}

/** The key in use: set from the switcher, else the address, else remembered on this phone, else the default. */
export function sheetMotionKey() {
  if (typeof window === 'undefined') return DEFAULT_SHEET_MOTION;
  const w = /** @type {any} */ (window);
  let key = w.__PD_SHEET_MOTION__ || new URLSearchParams(window.location.search).get('sheetMotion');
  if (!key) {
    try {
      key = window.localStorage.getItem(STORAGE_KEY);
    } catch {
      /* storage blocked: fine */
    }
  }
  return key && key in SHEET_MOTIONS ? key : DEFAULT_SHEET_MOTION;
}

/** @returns {SheetMotion} */
export const activeSheetMotion = () => SHEET_MOTIONS[sheetMotionKey()];

/** @param {string} key */
export function chooseSheetMotion(key) {
  if (!(key in SHEET_MOTIONS)) return;
  /** @type {any} */ (window).__PD_SHEET_MOTION__ = key;
  try {
    window.localStorage.setItem(STORAGE_KEY, key);
  } catch {
    /* storage blocked: it still applies for this visit */
  }
}

/** The sheet reports what each gesture did here, for the switcher's read-out. Nothing listens unless the lab is on. */
export function reportSheetGesture(/** @type {Record<string, unknown>} */ detail) {
  if (motionLabEnabled()) window.dispatchEvent(new CustomEvent('pd-sheet', { detail }));
}
