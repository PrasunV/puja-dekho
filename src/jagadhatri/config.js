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
 * What's new events. `section`: 'highlight' (picked by hand) or 'latest'. `day` is the India date (YYYY-MM-DD) it happens;
 * `endDay` when it runs over several days. `short`: a short date for the card when `when` is long. Optional `start` / `end` (ISO with +05:30) turn on "Live now".
 * Photos: up to any number; cards show 3 and "+N". Each needs `alt` text.
 * @typedef {{ id: string, section: 'highlight' | 'latest', title: string, subtitle?: string, short?: string, day: string, endDay?: string, start?: string,
 *   end?: string, when: string, pujaId?: string, place?: string, by: string, body: string, facts?: string[], link?: string, linkLabel?: string,
 *   photos: { src: string, thumb?: string, alt: string }[] }} JgEvent
 */
const CHOKKHUDAAN =
  'Chokkhudaan is the moment the artist paints the eyes of the Goddess, when the idol is believed to come alive. It happens a few days before the puja.';

/** @type {readonly JgEvent[]} */
export const EVENTS = Object.freeze([
  {
    id: 'inauguration-2026',
    section: 'highlight',
    title: 'Puja Inauguration by Mr. Suvendu Adhikari (C.M)',
    day: '2026-11-13',
    start: '2026-11-13T14:00:00+05:30',
    when: '13 Nov, 2:00 PM',
    place: 'Marie Math, Chandannagar',
    by: 'Chandannagar Municipal Corporation and Chandannagar Subdivision',
    body: 'The formal opening of Chandannagar’s Jagadhatri Puja festival, on Shukla Chaturthi (13 Kartik 1433). Everyone is invited.',
    photos: [
      {
        src: '/jagadhatripuja/events/inauguration-stage.jpg',
        thumb: '/jagadhatripuja/events/inauguration-stage-thumb.jpg',
        alt: 'The stage at Marie Math lit up, with the Jagadhatri Puja 2026 banner in front',
      },
      {
        src: '/jagadhatripuja/events/inauguration-screen.jpg',
        thumb: '/jagadhatripuja/events/inauguration-screen-thumb.jpg',
        alt: 'Big screen showing the Goddess and the words Jagadhatri Puja 2026',
      },
      {
        src: '/jagadhatripuja/events/inauguration-invite.jpg',
        thumb: '/jagadhatripuja/events/inauguration-invite-thumb.jpg',
        alt: 'Invitation to the inauguration from the Chandannagar administration, in Bengali',
      },
    ],
  },
  {
    id: 'gohona-mala-adima',
    section: 'highlight',
    title: 'গহণা ও মালা পরানো · আদিমা',
    day: '2026-11-12',
    when: '১২ই নভেম্বর, ২০২৬ (বৃহস্পতিবার) – তৃতীয়ার দিন',
    short: '12 Nov',
    pujaId: 'adi-maa-chaulpatti',
    by: 'চাউলপট্টি সার্বজনীন',
    body: 'মায়ের এই অপরূপ সাজ দর্শন করতে আপনারা সপরিবারে আসুন, মায়ের আশীর্বাদ গ্রহণ করুন। 🌺',
    photos: [],
  },
  {
    id: 'chokkhudaan-burima',
    section: 'highlight',
    subtitle: 'Anointing the eye',
    title: 'মায়ের চক্ষুদান · বুড়িমা',
    day: '2026-11-12',
    when: '12 Nov',
    pujaId: 'gourhati-tetultala',
    by: 'Tetultala (বুড়িমা)',
    body: CHOKKHUDAAN,
    photos: [],
  },
  {
    id: 'chokkhudaan-ranima',
    section: 'highlight',
    subtitle: 'Anointing the eye',
    title: 'মায়ের চক্ষুদান · রানিমা',
    day: '2026-11-11',
    when: '11 Nov',
    pujaId: 'tematha',
    by: 'Tematha Sarbajanin (রানিমা)',
    body: CHOKKHUDAAN,
    photos: [],
  },
  {
    id: 'chokkhudaan-bagbazar',
    section: 'highlight',
    subtitle: 'Anointing the eye',
    title: 'মায়ের চক্ষুদান · বাগবাজার',
    day: '2026-11-11',
    when: '11 Nov',
    pujaId: 'bagbazar-sarbojonin',
    by: 'Bagbazar Sarbajanin',
    body: CHOKKHUDAAN,
    photos: [],
  },
  {
    id: 'alpona-2026',
    section: 'latest',
    title: "World's largest Alpona competition",
    day: '2026-11-08',
    when: '8 Nov, from 2:00 PM',
    pujaId: 'bagbazar-sarbojonin',
    by: 'Bagbazar Sarbojanin Jagadhatri Puja Committee',
    facts: ['2,000+ participants'],
    body: 'Thousands of people painted alpona together on the streets of Bagbazar ahead of the puja.',
    photos: [],
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
/** Used when the phone is in dark mode. */
export const MAP_STYLE_URL_DARK = 'https://tiles.openfreemap.org/styles/dark';

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

/**
 * Plan my route. Visitors start at a station, a ghat or where they are, and end at a station or ghat.
 * Chuchura is left out on purpose: the plans use the 3 stations and 3 ghats of Chandannagar, Mankundu and Bhadreswar.
 */
export const PLAN_POINTS = Object.freeze([
  'chandannagar-station',
  'mankundu-station',
  'bhadreswar-station',
  'rani-ghat',
  'gondalpara-ghat',
  'telinipara-ghat',
]);
/** Last way home, in minutes after midnight India time: last train 12:00 AM (all 3 stations), last ferry 10:00 PM. */
export const LAST_TRAIN_MIN = 24 * 60;
export const LAST_FERRY_MIN = 22 * 60;
/** Plan lengths on offer, in hours. */
export const PLAN_HOURS = Object.freeze([2, 5]);
/** Time spent at each puja, in minutes (queues at the famous ones), and walking pace through festival crowds. */
export const STAY_MIN = Object.freeze({ must: 15, jubilee: 10, other: 8 });
export const WALK_KMH = 3;
/** Straight lines are shorter than streets: walking distance is about 1.3 times the straight-line distance. */
export const DETOUR = 1.3;

/**
 * Hand-picked routes (drafted from the puja list, approved by Prasun). Replaced by his own routes later.
 * @type {readonly { id: string, title: string, blurb: string, start: string, end: string, stops: readonly string[] }[]}
 */
export const BEST_ROUTES = Object.freeze([
  {
    id: 'jubilee-chandannagar',
    title: 'Jubilee trail, Chandannagar',
    blurb: 'Six Jubilee and Pre-Jubilee pujas, from Laxmigunj Chowmatha in its 124th year to Khalisani Kalpukurdhar in its 60th.',
    start: 'chandannagar-station',
    end: 'rani-ghat',
    stops: [
      'boubazar-sitalatala',
      'boubazar-jagadhatri-puja-committee',
      'khalisani-kalpukurdhar-sarbojonin',
      'fatakgora-sarbojonin',
      'kalupukur-jagadhatri-puja-committee',
      'laxmigunj-chowmatha',
      'urdibazar-sarbojanin',
    ],
  },
  {
    id: 'jubilee-mankundu-bhadreswar',
    title: 'Jubilee trail, Mankundu to Bhadreswar',
    blurb: 'Starts at Mankundu Sporting Club in its 60th year and ends a short walk from Bhadreswar station.',
    start: 'mankundu-station',
    end: 'bhadreswar-station',
    stops: [
      'mankundu-sarbojanin-sporting-club',
      'barasat-banerjee-para-madhyanchal',
      'bhadreswar-krishnapatti-sasthitala-dakshinanchal',
      'bhadreswar-yubak-samiti',
      'haritakitala',
      'lichutala-jagadhatri-temple',
      'bibeknagar-amratala',
    ],
  },
  {
    id: 'jubilee-south-ferry',
    title: 'Jubilee trail, south by ferry',
    blurb: 'Off the ferry at Gondalpara, through Satghata and Lalbagan, to the train at Chandannagar.',
    start: 'gondalpara-ghat',
    end: 'chandannagar-station',
    stops: [
      'satghata-jagadhatri-puja',
      'natun-tilighat-jagadhatri-puja-samity',
      'lalbagan-padripara',
      'fatakgora-sarbojonin',
      'khalisani',
      'khalisani-kalpukurdhar-sarbojonin',
    ],
  },
]);
