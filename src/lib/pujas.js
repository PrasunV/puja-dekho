/**
 * Closest stations to a puja, from the precomputed `m` list.
 * @param {import('./types.js').PujaData} data
 * @param {import('./types.js').Puja} puja
 * @param {number} [count]
 * @returns {{ station: import('./types.js').Station, distance: number }[]}
 */
export function nearStations(data, puja, count = 2) {
  return puja.m
    .slice(0, count)
    .map(([id, distance]) => ({ station: data.stById.get(id), distance }))
    .filter((entry) => entry.station !== undefined)
    .map((entry) => ({ station: /** @type {import('./types.js').Station} */ (entry.station), distance: entry.distance }));
}

/**
 * Does a puja match a free-text search? Checks name, address, area and alternate names.
 * @param {import('./types.js').Puja} puja
 * @param {string} needle Lowercase search text
 */
export function matchesSearch(puja, needle) {
  if (!needle) return true;
  return (
    puja.n.toLowerCase().includes(needle) ||
    puja.ad.toLowerCase().includes(needle) ||
    puja.ar.toLowerCase().includes(needle) ||
    puja.a.some((alt) => alt.toLowerCase().includes(needle))
  );
}

/**
 * Ranking score for "Top rated": Bayesian rating scaled by how many people rated, plus small
 * boosts for featured and heritage pujas so unrated well-known ones are not buried.
 * @param {import('./types.js').Puja} puja
 * @param {import('./types.js').RatingInfo | undefined} rating
 */
export function popularity(puja, rating) {
  return (rating ? rating.avg * Math.log(1 + rating.n) : 0) + (puja.f ? 1.5 : 0) + (puja.h ? 0.4 : 0);
}

/** Queue levels used until the server sends its own. */
export const DEFAULT_QUEUE_LEVELS = Object.freeze([
  { n: 0, label: 'No queue' },
  { n: 1, label: 'Short, under 15 min' },
  { n: 2, label: 'Medium, 15 to 45 min' },
  { n: 3, label: 'Long, 45 min or more' },
]);

/** Road report kinds: `[label, glyph]`. */
export const CLOSURE_KINDS = Object.freeze({
  closed: ['Road closed', '✕'],
  oneway: ['One-way', '→'],
  barricade: ['Barricade / crowd control', '▮'],
  diverted: ['Traffic diverted', '↪'],
});

/** Same rule the server applies; checked here first for instant feedback. */
export const NICKNAME_PATTERN = /^[\p{L}\p{M}\p{N} ._-]{2,20}$/u;

/**
 * "just now" / "12 min ago".
 * @param {number} minutes
 */
export const formatAge = (minutes) => (minutes < 2 ? 'just now' : `${minutes} min ago`);
