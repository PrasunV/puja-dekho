import { CLOSED_STATIONS, REGULAR_SCHEDULE } from '../data/schedule.js';
import { phaseFor, timingText } from './metro.js';

/** `weekday` (Mon to Fri), `saturday` or `sunday`, by the clock in Kolkata. */
export function dayKind(/** @type {Date} */ now = new Date()) {
  const day = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: 'Asia/Kolkata' }).format(now);
  return day === 'Sun' ? 'sunday' : day === 'Sat' ? 'saturday' : 'weekday';
}

/** "13:00-04:00 next morning (night-long)" reads as "13:00 – 04:00 next morning". */
export const tidyHours = (/** @type {string | null} */ text) =>
  text
    ? text
        .replace(/(\d)-(~?\d)/g, '$1 – $2')
        .replace(/\s*\(night-long\)/, '')
        .replace('~', '')
    : text;

const DAY_LABEL = { weekday: 'Mon to Fri', saturday: 'Saturday', sunday: 'Sunday' };

/** Is this station shut at the moment? */
export const isClosed = (/** @type {string} */ id) => id in CLOSED_STATIONS;

/**
 * What to say about a line today. While today is inside the Puja window the Puja hours lead (they are what
 * runs); otherwise it is the regular hours for the day of the week.
 *
 * @param {import('./types.js').MetroData} metro
 * @param {'blue' | 'green'} line
 * @param {Date} [now]
 */
export function lineToday(metro, line, now = new Date()) {
  const regular = REGULAR_SCHEDULE[line];
  const iso = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  const phase = phaseFor(metro, iso);
  const pujaHours = phase ? tidyHours(timingText(metro, line, phase)) : null;
  const kind = dayKind(now);
  return {
    line,
    name: regular.name,
    freq: regular.freq,
    kind,
    pujaLabel: phase?.label ?? null,
    pujaHours,
    regularHours: regular[kind],
    regularLabel: DAY_LABEL[kind],
    /** The one line for the pinned summary. */
    headline: pujaHours ? `Today (Puja special): ${pujaHours}` : `Today (${DAY_LABEL[kind]}): ${regular[kind]}`,
  };
}

/** Every Puja row for a line, with the one that applies today marked. */
export function pujaRows(/** @type {import('./types.js').MetroData} */ metro, /** @type {'blue' | 'green'} */ line, now = new Date()) {
  const iso = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  const current = phaseFor(metro, iso);
  return metro.phases
    .filter((phase) => phase.id !== 'uncertain')
    .map((phase) => ({
      id: phase.id,
      label: phase.label,
      hours: tidyHours(timingText(metro, line, phase)),
      today: current?.id === phase.id,
    }));
}
