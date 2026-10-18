import { DEFAULT_PATTERN, OVERRIDES, SLOTS } from '../data/crowd.js';

/**
 * Which time slot a moment falls in, on the clock in Kolkata.
 * @param {Date} [now]
 */
export function slotFor(now = new Date()) {
  const hour = Number(new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' }).format(now)) % 24;
  return SLOTS.find((slot) => hour >= slot.from && hour < slot.to) ?? null;
}

/**
 * The usual crowd for a puja right now, or null when the data has nothing for this hour
 * (the crowd chip is then hidden, never shown empty).
 * @param {{ id: string }} puja
 * @param {Date} [now]
 * @returns {'Low' | 'Moderate' | 'High' | null}
 */
export function typicalCrowd(puja, now = new Date()) {
  const slot = slotFor(now);
  if (!slot) return null;
  const level = OVERRIDES[puja.id]?.[slot.id] ?? /** @type {Record<string, string>} */ (DEFAULT_PATTERN)[slot.id];
  return level === 'Low' || level === 'Moderate' || level === 'High' ? level : null;
}

/** Wording for the typical crowd. It always says "usually" so nobody reads it as live. */
export const crowdText = (/** @type {string} */ level) => `Usually ${level} at this hour`;

/** Shown on the Less crowded chip and in the Filters panel. */
export const CROWD_NOTE = 'Based on typical crowd at this hour, not live data.';
