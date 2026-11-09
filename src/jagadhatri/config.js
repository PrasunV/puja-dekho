/**
 * Jagadhatri Puja settings and copy. Nothing here is secret: it ships to every browser.
 * Content you are likely to change (popular order, What's new, About) is at the top.
 */

/** Base path of the Jagadhatri app on the Puja Dekho site. */
export const BASE = '/jagadhatripuja';
export const DATA_URL = `${BASE}/data/pujas.json`;
export const SITE_URL = 'https://puja-dekho.vercel.app/jagadhatripuja';

/**
 * The 5 popular pujas shown in search before typing, in this order (puja ids from the sheet).
 * PLACEHOLDER until Prasun sends the order. Any id not found is skipped.
 */
export const POPULAR_ORDER = Object.freeze([
  'bagbazar-sarbojonin',
  'helapukur-dhar',
  'boro-taldanga',
  'gourhati-tetultala',
  'palpara-jagadhatri-puja-committee',
]);

/**
 * What's new items, newest first. `past` items show as held, with their date.
 * `facebook` and `photos` are left empty until the link and pictures arrive; empty means the button or photos hide.
 */
export const WHATS_NEW = Object.freeze([
  {
    id: 'alpona-2026',
    title: "World's largest Alpona competition",
    by: 'Bagbazar Sarbojanin Jagadhatri Puja Committee',
    pujaId: 'bagbazar-sarbojonin',
    when: 'Held on 8 Nov, from 2:00 pm',
    past: true,
    participants: '2,000+ participants',
    body: 'Thousands of people painted alpona together on the streets of Bagbazar ahead of the puja.',
    facebook: '',
    photos: /** @type {{ src: string, alt: string }[]} */ ([]),
  },
]);

/** About sheet copy (F12, F13). */
export const ABOUT = Object.freeze({
  story:
    'Puja Dekho started in October 2026, on Durga Puja Ashtami, and 302 people used it. Now it is here for Jagadhatri Puja in Chandannagar, Mankundu and Bhadreswar.',
  maker: 'Prasun',
  makerUrl: 'https://www.linkedin.com/in/prasun-mondal-b25320214/',
  disclaimer: 'Not an official committee app',
  durgaUrl: '/',
});

/** Map: the middle of the three towns, and how far the map may be panned. MapLibre zoom levels. */
export const MAP_CENTER = /** @type {[number, number]} */ ([22.858, 88.362]); // [lat, lng]
export const MAP_ZOOM = 13;
export const MAP_BOUNDS = /** @type {[[number, number], [number, number]]} */ ([
  [88.25, 22.76],
  [88.47, 22.95],
]); // [[west, south], [east, north]]
export const MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/positron';

/** Near me radius steps, in metres. The first is the default. */
export const RADIUS_STEPS = Object.freeze([500, 1000, 2000, 5000]);
/** A picked station or ghat shows the pujas within this distance by default. */
export const STATION_RADIUS_M = 1000;
/** Farther than this from every puja, Near me says "Near me works once you are in town". */
export const FAR_FROM_TOWN_M = 5000;
/** The point "You are 38 km from Chandannagar" measures to (Chandannagar Strand). */
export const TOWN_POINT = Object.freeze({ lat: 22.8616, lng: 88.3718, name: 'Chandannagar' });
/** A location less accurate than this (metres) is called approximate. */
export const APPROX_ACCURACY_M = 150;

/** Puja type options (the sheet's Category, shown as it is). */
export const CATEGORIES = Object.freeze(['Adi Puja', 'Jubilee', 'Pre-Jubilee', 'Other']);
export const TOWNS = Object.freeze(['Chandannagar', 'Mankundu', 'Bhadreswar']);
export const ZONES = Object.freeze(['A', 'B', 'C', 'D']);
/**
 * Age groups in the More sheet: [id, label, min years, max years]. Age counts the founding year as year 1.
 * @type {ReadonlyArray<[string, string, number, number]>}
 */
export const AGE_GROUPS = Object.freeze([
  ['100', '100+ years', 100, Infinity],
  ['50', '50 to 99 years', 50, 99],
  ['25', '25 to 49 years', 25, 49],
  ['0', 'Under 25 years', 0, 24],
  ['unknown', 'Year not known', -1, -1],
]);
export const PUJA_YEAR = 2026;
