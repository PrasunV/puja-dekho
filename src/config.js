/**
 * Build-time app settings. Nothing here is secret: it ships to every browser.
 */

export const APP_NAME = 'Puja Dekho';

/**
 * Base map style. OpenFreeMap is free, needs no key, has no usage limits and allows
 * commercial use. Other styles on the same host: `liberty` (more detail), `bright`.
 */
export const MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/positron';

/** Initial map view: `[lat, lng]` and a Leaflet-scale zoom (see `toMapZoom` in lib/geo.js). */
export const MAP_CENTER = /** @type {const} */ ([22.5185, 88.35]);
export const MAP_ZOOM = 13;

/** Beyond this distance from Kolkata (25 km) a person is a visitor: their location is not used for distances or for moving the map. */
export const FAR_FROM_KOLKATA_M = 25_000;

/** The location button never leaves the map zoomed out further than this (Leaflet scale, about street level). */
export const RECENTER_MIN_ZOOM = 16;
/** The map counts as centred on the person when their dot is within this many pixels of the middle of the visible map. */
export const CENTRED_TOLERANCE_PX = 40;

/** "You're near [puja]" card (PRD section 3). Evaluated only while the app is open. */
export const NEAR_ACCURACY_M = 50; // the GPS reading must be at least this good
export const NEAR_RADIUS_M = 100; // stay within this distance of a puja...
export const NEAR_DWELL_MS = 60_000; // ...for this long
export const NEAR_CLEAR_M = 150; // the card clears beyond this distance

/** Radius steps in the radius chip and Filters panel, in metres. The first is the default. */
export const RADIUS_STEPS = Object.freeze([500, 1000, 5000, 10000, 20000]);

/** A station counts as "near" a puja within this straight-line distance. */
export const NEAR_STATION_M = 1000;

/** Where the Report issue button goes. VITE_REPORT_FORM_URL overrides it at build time. */
export const REPORT_FORM_URL = import.meta.env?.VITE_REPORT_FORM_URL || 'https://forms.gle/4dGHo5hw3wwCnc8Y9';

/** Report issue hint: after this long in the app a small tooltip names the button, then fades after the second delay. */
export const REPORT_HINT_AFTER_MS = 60_000;
export const REPORT_HINT_SHOW_MS = 1_800;

/** The version shown under the app name in the top bar: always whatever package.json says, so bumping it there is the only step. */
export { version as APP_VERSION } from '../package.json';

/** The maker's profile, linked from the credit line in the top bar. */
export const MAKER = Object.freeze({ name: 'Prasun', url: 'https://www.linkedin.com/in/prasun-mondal-b25320214/' });

/** Free walking-route service (OpenRouteService). No key means no route line; Get directions still works. */
export const ORS_KEY = import.meta.env?.VITE_ORS_KEY || '';

/**
 * Parked for v2 (not used by the MVP screens, kept so the code under docs and the old modules still compile).
 */
export const DWELL_MINUTES = 15;
export const DWELL_RADIUS_M = 80;
export const DWELL_REASK_MS = 3600_000;
export const POLL_SECONDS = 30;
export const MAX_TOUR_STOPS = 15;

/** Page size for the puja list. */
export const PAGE_SIZE = 40;

export const ROADS_NOTE_URL =
  'https://www.nativeplanet.com/travel-guide/kolkata-durga-puja-2026-traffic-restrictions-idol-transport-routes-metro-guide-011-24773.html';

/** "Pujas in this area": how far from the middle of the visible map a puja still counts (the 3 to 4 km the brief asked for). */
export const AREA_RADIUS_M = 3500;
