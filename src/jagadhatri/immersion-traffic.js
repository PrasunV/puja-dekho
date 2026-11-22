/**
 * Traffic restrictions for the immersion procession, 22 and 23 Nov 2026, from the Chandannagar Police notice for the
 * Chandannagar PS and Bhadreswar PS area: 40 no-entry points and 10 parking places.
 *
 * The notice has no coordinates. A point with `la`/`lo` is on the map; one without is in the lists only. `near` marks a
 * pin placed at a nearby named spot (a puja or landmark of the same name), not at the exact police barrier, so the
 * sheet says "Approx. location" for it. Add `la` and `lo` to a point and it appears on the map with nothing else to change.
 */

/** India time (UTC+5:30) to a timestamp. */
const ist = (/** @type {number} */ day, /** @type {number} */ h, /** @type {number} */ m = 0) =>
  Date.UTC(2026, 10, day, h, m) - 330 * 60_000;

/** The notice names the two days, with no hours. */
export const IMMERSION_FROM = ist(22, 0);
export const IMMERSION_TO = ist(24, 0);
export const IMMERSION_DATES = '22–23 Nov';
export const IMMERSION_SOURCE = 'Chandannagar and Bhadreswar police, Traffic Restrictions notice';

/**
 * @typedef {{ la: number, lo: number, near?: boolean }} Spot
 * @typedef {{ id: string, name: string, ps: string, big: number, medium: number, small: number, two: number, alt: string | null } & Partial<Spot>} Parking
 * @typedef {{ sl: number, name: string } & Partial<Spot>} NoEntry
 */

/** @type {readonly Parking[]} */
export const PARKING = Object.freeze([
  {
    id: 'park_01',
    name: 'Tarun Sangha Football Ground, Nabagram',
    ps: 'Bhadreswar PS',
    big: 30,
    medium: 50,
    small: 60,
    two: 150,
    alt: 'G.T. Road towards Serampore side before Dalhousie',
    la: 22.861896,
    lo: 88.34265,
  },
  {
    id: 'park_02',
    name: 'KMDA Park',
    ps: 'Bhadreswar PS',
    big: 30,
    medium: 20,
    small: 20,
    two: 0,
    alt: 'G.T. Road towards Chinsurah side before Khadinamore',
  },
  {
    id: 'park_03',
    name: 'Amrakunja Park and Amrapali, Mankundu Station Road',
    ps: 'Bhadreswar PS',
    big: 0,
    medium: 35,
    small: 40,
    two: 100,
    alt: 'Delhi Road',
  },
  {
    id: 'park_04',
    name: 'Dhitara Nibedita Sangha Football Ground, Bhadreswar Station Road',
    ps: 'Bhadreswar PS',
    big: 20,
    medium: 20,
    small: 0,
    two: 0,
    alt: 'Chandannagar Bypass Road',
  },
  {
    id: 'park_05',
    name: 'Ground near Angus Post Office More',
    ps: 'Bhadreswar PS',
    big: 0,
    medium: 20,
    small: 30,
    two: 0,
    alt: null,
    la: 22.812361,
    lo: 88.3521333,
    near: true,
  },
  {
    id: 'park_06',
    name: 'Netaji Stadium, Techno India Ground',
    ps: 'Chinsurah PS',
    big: 50,
    medium: 100,
    small: 150,
    two: 200,
    alt: null,
    la: 22.8818139,
    lo: 88.3796056,
  },
  {
    id: 'park_07',
    name: 'Taldanga More 2, Alap Ground',
    ps: 'Chinsurah PS',
    big: 0,
    medium: 20,
    small: 0,
    two: 0,
    alt: null,
    la: 22.8922009,
    lo: 88.3823198,
    near: true,
  },
  {
    id: 'park_08',
    name: 'Balaka Samity Club Ground, near Taldanga 1 (opposite Rammohan Police Quarter)',
    ps: 'Chinsurah PS',
    big: 0,
    medium: 20,
    small: 40,
    two: 100,
    alt: null,
  },
  {
    id: 'park_09',
    name: 'Kishore Sangha Club, near Mankundu Railway Station',
    ps: 'Bhadreswar PS',
    big: 0,
    medium: 0,
    small: 0,
    two: 200,
    alt: null,
  },
  {
    id: 'park_10',
    name: 'Azad Sangha Club',
    ps: 'Bhadreswar PS',
    big: 0,
    medium: 0,
    small: 0,
    two: 700,
    alt: null,
    la: 22.8400624,
    lo: 88.3565727,
  },
]);

/** @type {readonly NoEntry[]} */
export const NO_ENTRY = Object.freeze([
  { sl: 1, name: 'Angus Post Office Morh', la: 22.812361, lo: 88.3521333 },
  { sl: 2, name: 'Dalhousie Jute Mill', la: 22.8027933, lo: 88.3488258 },
  { sl: 3, name: 'Chandanpara Morh', la: 22.8179513, lo: 88.3464641 },
  { sl: 4, name: 'Ghungir Khal', la: 22.8310547, lo: 88.3570008, near: true },
  { sl: 5, name: 'Chanditala Morh', la: 22.835882, lo: 88.3452565 },
  { sl: 6, name: 'Mankundu Amropali', la: 22.8494603, lo: 88.3429383 },
  { sl: 7, name: 'KMDA Under-Pass' },
  { sl: 8, name: 'Khalisani / KMDA Park Morh', la: 22.8621338, lo: 88.3489854 },
  { sl: 9, name: 'Nabagram Tarun Sangha', la: 22.8618962, lo: 88.3426496 },
  { sl: 10, name: 'Breathwet Level Crossing', la: 22.8169121, lo: 88.3525809, near: true },
  { sl: 11, name: 'Manasatala', la: 22.8223165, lo: 88.3529089, near: true },
  { sl: 12, name: 'Bhadreswar Gate Bazar', la: 22.8342942, lo: 88.3595902 },
  { sl: 13, name: 'Babu Bazar', la: 22.8385212, lo: 88.3606991, near: true },
  { sl: 14, name: 'Bhadreswar Ganj Bazar', la: 22.827442, lo: 88.3404569 },
  { sl: 15, name: 'Shivtala Morh (Bhadreswar tala)' },
  { sl: 16, name: 'Kola bazar Morh', la: 22.8197004, lo: 88.3528738, near: true },
  { sl: 17, name: 'Khalisani Primary School Morh', la: 22.8664839, lo: 88.3510798 },
  { sl: 18, name: 'Kolupukur Dhar', la: 22.8696615, lo: 88.3569512 },
  { sl: 19, name: 'B.Ed. College Morh', la: 22.8662065, lo: 88.3540618 },
  { sl: 20, name: 'Narua Morh', la: 22.8670595, lo: 88.3674129 },
  { sl: 21, name: 'C.C.C. Crossing', la: 22.862254, lo: 88.3681891 },
  { sl: 22, name: 'Mainadanga', la: 22.8490838, lo: 88.3543623 },
  { sl: 23, name: 'Charaktala Tematha', la: 22.8777888, lo: 88.3735302 },
  { sl: 24, name: 'Kantapukur Morh', la: 22.8791555, lo: 88.3645713 },
  { sl: 25, name: 'Shankarbati Morh', la: 22.8782262, lo: 88.3561676 },
  { sl: 26, name: 'Bhagar Morh', la: 22.8713324, lo: 88.3583473 },
  { sl: 27, name: 'Chandannagar New Over Bridge', la: 22.867114, lo: 88.3674381 },
  { sl: 28, name: 'Bosepara Morh', la: 22.8624204, lo: 88.3548955 },
  { sl: 29, name: 'Purosree Morh', la: 22.8588471, lo: 88.3507465 },
  { sl: 30, name: 'Jugipukur Morh', la: 22.8545996, lo: 88.3545921 },
  { sl: 31, name: 'Dasabhujatala', la: 22.842067, lo: 88.3544878 },
  { sl: 32, name: 'Kestopatty Morh' },
  { sl: 33, name: 'Liberty gate Morh', la: 22.8397203, lo: 88.3608117 },
  { sl: 34, name: 'Gondalpara / Near Barasat TOP', la: 22.8402182, lo: 88.3609678 },
  { sl: 35, name: 'Jyotir Morh', la: 22.8451388, lo: 88.3623609 },
  { sl: 36, name: 'Hospital Morh', la: 22.8661837, lo: 88.3690898 },
  { sl: 37, name: 'Taldanga-I', la: 22.8787355, lo: 88.3769801, near: true },
  { sl: 38, name: 'Taldanga Morh-II', la: 22.8787355, lo: 88.3769801, near: true },
  { sl: 39, name: 'Tolafatak Morh-II', la: 22.8840245, lo: 88.3891778 },
  { sl: 40, name: 'Khadina Morh', la: 22.8880498, lo: 88.3801044 },
]);

/** Vehicles the no-entry rule covers, as the notice words them. */
export const NO_ENTRY_VEHICLES = 'All vehicles, including auto, toto, e-rickshaw, engine van, motorcycle, rickshaw and van';

/** "30 big, 50 medium, 60 small, 150 two-wheelers", leaving out the kinds with no space. */
export function capacityText(/** @type {Parking} */ p) {
  return [
    [p.big, 'big'],
    [p.medium, 'medium'],
    [p.small, 'small'],
    [p.two, 'two-wheelers'],
  ]
    .filter(([n]) => Number(n) > 0)
    .map(([n, k]) => `${n} ${k}`)
    .join(', ');
}

/** Total places, all kinds. */
export const parkingTotal = (/** @type {Parking} */ p) => p.big + p.medium + p.small + p.two;

/** Points that have a place on the map: `{ k: 'p' | 'n', id, la, lo, near }`. Taldanga I and II share one spot, so it is drawn once. */
export function trafficSpots() {
  /** @type {{ k: 'p' | 'n', id: string, la: number, lo: number, near: boolean }[]} */
  const out = [];
  const seen = new Set();
  for (const p of PARKING) {
    if (p.la != null && p.lo != null) out.push({ k: 'p', id: p.id, la: p.la, lo: p.lo, near: !!p.near });
  }
  for (const n of NO_ENTRY) {
    if (n.la == null || n.lo == null) continue;
    const key = `${n.la},${n.lo}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ k: 'n', id: `n${n.sl}`, la: n.la, lo: n.lo, near: !!n.near });
  }
  return out;
}

/** Where we are: before the two days, on them, or after. */
export function immersionState(/** @type {number} */ now) {
  if (now < IMMERSION_FROM) return /** @type {const} */ ('before');
  return now < IMMERSION_TO ? /** @type {const} */ ('on') : /** @type {const} */ ('ended');
}

/** The map id of a no-entry point: points that share one spot (Taldanga I and II) share the first one's id. */
export function noEntryId(/** @type {NoEntry} */ n) {
  const first = NO_ENTRY.find((x) => x.la === n.la && x.lo === n.lo) ?? n;
  return `n${first.sl}`;
}

/** The three tabs of the traffic sheet. Overview is both kinds at once; Parking and No entry are one each. */
export const TRAFFIC_TABS = /** @type {const} */ (['Overview', 'Parking', 'No entry']);

/** Which kinds does a tab show on the map? A null tab (filter off) shows neither. */
export function kindsOfTab(/** @type {string | null} */ tab) {
  return { parking: tab === 'Overview' || tab === 'Parking', noEntry: tab === 'Overview' || tab === 'No entry' };
}

/** The tab for a pair of kinds: both is Overview, none is null (filter off). */
export function tabOfKinds(/** @type {boolean} */ parking, /** @type {boolean} */ noEntry) {
  if (parking && noEntry) return /** @type {const} */ ('Overview');
  if (parking) return /** @type {const} */ ('Parking');
  return noEntry ? /** @type {const} */ ('No entry') : null;
}

/** Switch one kind on or off, keeping the other as it is. Returns the new tab, or null when nothing is left on. */
export function toggleKind(/** @type {string | null} */ tab, /** @type {'parking' | 'noEntry'} */ kind) {
  const k = kindsOfTab(tab);
  return tabOfKinds(kind === 'parking' ? !k.parking : k.parking, kind === 'noEntry' ? !k.noEntry : k.noEntry);
}

/** The spots to draw for a tab: parking, no entry, both or none. */
export function spotsOfTab(/** @type {ReturnType<typeof trafficSpots>} */ spots, /** @type {string | null} */ tab) {
  const k = kindsOfTab(tab);
  return spots.filter((t) => (t.k === 'p' ? k.parking : k.noEntry));
}
