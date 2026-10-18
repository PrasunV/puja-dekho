import { formatBand } from './geo.js';

const pujas = (/** @type {number} */ n) => `${n} ${n === 1 ? 'puja' : 'pujas'}`;

/**
 * The sheet header at the Browse peek and top of the list. It always says what is applied, so nobody
 * wonders why a list is short (PRD section 5).
 *
 * @param {object} input
 * @param {boolean} input.located  The person's location is known and in Kolkata
 * @param {number} input.count  Pujas that pass the filters (inside the radius when there is one)
 * @param {number} input.radius  Radius in metres
 * @param {number} input.filterCount  Filters switched on, not counting the radius
 * @param {string | null} input.stationName  A chosen metro station
 * @param {string | null} [input.zoneText]  Chosen zone chips, e.g. `North + Central`
 * @param {number} input.defaultRadius
 */
export function headline({ located, count, radius, filterCount, stationName, zoneText, defaultRadius }) {
  if (stationName) return `${pujas(count)} near ${stationName}`;
  if (zoneText)
    return `${pujas(count)} in ${zoneText}${filterCount > 0 ? `, ${filterCount} ${filterCount === 1 ? 'filter' : 'filters'}` : ''}`;
  if (filterCount > 0) return `${pujas(count)}, ${filterCount} ${filterCount === 1 ? 'filter' : 'filters'}`;
  if (!located) return `${pujas(count)} in Kolkata`;
  return radius === defaultRadius ? `${pujas(count)} near you` : `${pujas(count)} within ${formatBand(radius)}`;
}
