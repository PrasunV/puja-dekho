/**
 * Typical crowd: how busy a puja usually is at each time of day. This is a guide, never live data.
 *
 * One city-wide pattern covers all pujas. To correct a well-known puja, add its id to OVERRIDES
 * with only the slots that differ. The values below are PLACEHOLDERS from the PRD: replace them.
 *
 * Levels: 'Low' | 'Moderate' | 'High'.
 */

/** Slots in order. `from` is inclusive and `to` exclusive, in hours of the day on the clock in Kolkata. */
export const SLOTS = Object.freeze([
  { id: 'early-morning', label: 'Early morning', from: 3, to: 6 },
  { id: 'morning', label: 'Morning', from: 6, to: 11 },
  { id: 'afternoon', label: 'Afternoon', from: 11, to: 17 },
  { id: 'early-evening', label: 'Early evening', from: 17, to: 20 },
  { id: 'prime-time', label: 'Prime time', from: 20, to: 24 },
  { id: 'late-night', label: 'Late night', from: 0, to: 3 },
]);

/** The city-wide pattern. */
export const DEFAULT_PATTERN = Object.freeze({
  'early-morning': 'Low',
  morning: 'Low',
  afternoon: 'Low',
  'early-evening': 'Moderate',
  'prime-time': 'High',
  'late-night': 'Moderate',
});

/**
 * Per-puja corrections, by puja id: `{ 'S001': { 'prime-time': 'Moderate' } }`.
 * @type {Record<string, Partial<Record<string, 'Low' | 'Moderate' | 'High'>>>}
 */
export const OVERRIDES = {};
