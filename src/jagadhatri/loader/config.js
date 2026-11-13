/** All loader timing in one place. Change values here, nowhere else. */

/** A small loader (map, sign-in button, photos) appears only if the wait is longer than this, so fast loads never flash. */
export const SMALL_LOADER_DELAY_MS = 300;
/** Switch to the "slow network" lines. */
export const SLOW_AFTER_MS = 8000;
/** Switch to the failed state with a Try again button. */
export const FAIL_AFTER_MS = 15000;
/** One full loader loop; the line changes once per loop. */
export const LINE_ROTATE_MS = 3560;
export const SLOW_ROTATE_MS = 4000;
