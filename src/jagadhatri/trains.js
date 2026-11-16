/**
 * Eastern Railway's EMU special trains for Jagadhatri Puja, Howrah division. They run from the night of 14/15 Nov 2026
 * to the night of 20/21 Nov 2026 and stop at all stations on the way. The notice gives times only at the end stations
 * (Howrah, Bandel, Barddhaman). Times at Bhadreswar, Mankundu and Chandannagar are not in it, so none are shown here.
 * Times are 24-hour, India time, as printed in the notice.
 */

/** @typedef {{ no: string, from: string, to: string, via?: string, dep: string, arr: string }} Special */

/** After the last special arrives (Howrah, 05:10 on 21 Nov) the specials are over: the screens and the planner go back to normal. */
export const SPECIALS_END = '2026-11-21T06:00:00+05:30';
/** The last special leaves Bandel for Howrah at 04:00. Planning treats 4:00 AM as the last train while the specials run. */
export const LAST_SPECIAL_MIN = 28 * 60;

/** @param {number} now */
export const specialsActive = (now) => now < Date.parse(SPECIALS_END);

/** @type {readonly Special[]} */
export const HOWRAH_BANDEL = Object.freeze([
  { no: '03085', from: 'Howrah', to: 'Bandel', dep: '17:20', arr: '18:25' },
  { no: '03087', from: 'Howrah', to: 'Bandel', dep: '20:00', arr: '21:05' },
  { no: '03089', from: 'Howrah', to: 'Bandel', dep: '20:35', arr: '21:40' },
  { no: '03093', from: 'Howrah', to: 'Bandel', dep: '23:30', arr: '00:30' },
  { no: '03095', from: 'Howrah', to: 'Bandel', dep: '00:30', arr: '01:35' },
  { no: '03097', from: 'Howrah', to: 'Bandel', dep: '00:50', arr: '02:00' },
  { no: '03101', from: 'Howrah', to: 'Bandel', dep: '02:35', arr: '03:45' },
  { no: '03103', from: 'Howrah', to: 'Bandel', dep: '03:45', arr: '04:55' },
]);

/** @type {readonly Special[]} */
export const BANDEL_HOWRAH = Object.freeze([
  { no: '03086', from: 'Bandel', to: 'Howrah', dep: '18:35', arr: '19:40' },
  { no: '03090', from: 'Bandel', to: 'Howrah', dep: '21:20', arr: '22:30' },
  { no: '03092', from: 'Bandel', to: 'Howrah', dep: '21:55', arr: '23:00' },
  { no: '03094', from: 'Bandel', to: 'Howrah', dep: '23:00', arr: '00:10' },
  { no: '03100', from: 'Bandel', to: 'Howrah', dep: '01:00', arr: '02:05' },
  { no: '03102', from: 'Bandel', to: 'Howrah', dep: '02:00', arr: '03:05' },
  { no: '03104', from: 'Bandel', to: 'Howrah', dep: '02:30', arr: '03:35' },
  { no: '03106', from: 'Bandel', to: 'Howrah', dep: '04:00', arr: '05:10' },
]);

/** @type {readonly Special[]} */
export const BARDDHAMAN = Object.freeze([
  { no: '03099', from: 'Howrah', to: 'Barddhaman', via: 'Bandel', dep: '01:15', arr: '03:50' },
  { no: '03098', from: 'Barddhaman', to: 'Howrah', dep: '22:30', arr: '01:00' },
]);

/** "17:20" → "5:20 PM", "00:30" → "12:30 AM": the same 12-hour style as the rest of the app. */
export function clock12(/** @type {string} */ hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}
