/** Names for the milestones. Beyond 100 it is just the number of years. */
const MILESTONE_NAMES = Object.freeze({ 25: 'Silver Jubilee', 50: 'Golden Jubilee', 75: 'Diamond Jubilee', 100: 'Centenary' });

/** @param {number} years */
export const milestoneName = (years) => MILESTONE_NAMES[years] ?? `${years} years`;

/** This year in India (the Puja calendar is Indian). */
export const thisYear = () => Number(new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }).slice(0, 4));

/**
 * What a puja's founding year says about it (doc 01).
 * Years = this year minus the since-year. A jubilee year is when that is above 0 and a multiple of 25.
 * The next milestone is the next multiple of 25 after today's count. Null without a usable since-year.
 *
 * @param {number | null | undefined} since
 * @param {number} [year]
 * @returns {{ years: number, jubilee: string | null, next: { name: string, year: number } } | null}
 */
export function heritage(since, year = thisYear()) {
  if (!since) return null;
  const years = year - since;
  if (years <= 0) return null;
  const nextYears = (Math.floor(years / 25) + 1) * 25;
  return {
    years,
    jubilee: years % 25 === 0 ? milestoneName(years) : null,
    next: { name: milestoneName(nextYears), year: since + nextYears },
  };
}
