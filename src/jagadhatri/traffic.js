/**
 * Traffic and road closures for Jagadhatri Puja 2026, from the Chandannagar Police Commissionerate's Traffic Regulation
 * notice. Both lists (goods vehicles, and all vehicles) share one schedule. The live status is worked out on the phone
 * from these published hours, never from live police data.
 */

/** India time (UTC+5:30) to a timestamp. */
const ist = (/** @type {number} */ day, /** @type {number} */ h, /** @type {number} */ m = 0) =>
  Date.UTC(2026, 10, day, h, m) - 330 * 60_000;

/**
 * When vehicles are stopped. The last window has no published end: "till completion of immersion on 20.11.2026",
 * so it is treated as the end of 20 Nov and shown as "until immersion ends".
 * @type {readonly { from: number, to: number, openEnd?: boolean }[]}
 */
export const WINDOWS = Object.freeze([
  { from: ist(13, 12), to: ist(14, 6) },
  { from: ist(14, 14), to: ist(15, 6) },
  { from: ist(15, 14), to: ist(16, 6) },
  { from: ist(16, 14), to: ist(17, 6) },
  { from: ist(17, 14), to: ist(18, 6) },
  { from: ist(18, 14), to: ist(19, 6) },
  { from: ist(19, 7), to: ist(21, 0), openEnd: true },
]);

/** @typedef {{ at: string, road: string, toward: string, via?: string }} Point */

/** Goods vehicles are stopped at these points (10). */
export const GOODS_POINTS = /** @type {readonly Point[]} */ (
  Object.freeze([
    { at: 'Bally Khal', road: 'GT Road', toward: 'Bag Khal', via: 'GT Road' },
    { at: 'Dirghangi Morh', road: 'Delhi Road', toward: 'Baidyabati Morh on GT Road', via: 'Baidyabati–Tarakeswar Road' },
    { at: 'Baidyabati Morh', road: 'GT Road', toward: 'Chandannagar', via: 'GT Road' },
    { at: 'Jora Aswatthatala', road: 'GT Road', toward: 'Chandannagar', via: 'GT Road' },
    { at: 'Bighati Morh', road: 'Delhi Road', toward: 'Ghungir Khal and Bhadreswar', via: 'Bhadreswar Railway Station Road' },
    { at: 'Gorji Morh', road: 'Delhi Road', toward: 'Bhadreswar', via: 'Mankundu Railway Station Road' },
    { at: 'Sweatpur Morh', road: 'Delhi Road', toward: 'Chandannagar', via: 'Chandannagar Station Road' },
    { at: 'Dalhousie Jute Mill', road: 'GT Road', toward: 'Chandannagar', via: 'GT Road' },
    { at: 'Bandel Gate / Katwa Gate', road: 'GT Road', toward: 'Khadina Morh', via: 'GT Road' },
    { at: 'Simlapole Bridge', road: 'Chinsurah–Dhaniakhali Road', toward: 'Khadina Morh' },
  ])
);

/**
 * All vehicles (including auto, toto, e-rickshaw, engine van, motorcycle, rickshaw and van) are stopped at these points.
 * TODO: only the first 4 are readable in the screenshot; the rest of the notice is needed before launch.
 */
export const ALL_POINTS = /** @type {readonly Point[]} */ (
  Object.freeze([
    { at: 'Angus Post Office Morh', road: 'GT Road', toward: 'Taldanga-II', via: 'GT Road' },
    { at: 'Dalhousie Jute Mill', road: 'GT Road', toward: 'Chandannagar', via: 'GT Road' },
    { at: 'Chandanpara Morh', road: 'RBS Road', toward: 'Chanditala Morh', via: 'RBS Road' },
    { at: 'Ghungir Khal', road: 'Bhadreswar Railway Station Road', toward: 'Bhadreswar Railway Station' },
  ])
);
/** False until the whole all-vehicles list is in: the app then says the list is incomplete. */
export const ALL_POINTS_COMPLETE = false;

export const SOURCE = 'Chandannagar Police Commissionerate, Traffic Regulation notice';
export const NOTICE_IMAGE = '/jagadhatripuja/traffic-notice.jpg';

const TIME = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit', hour12: true });
const DAY = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'short', day: 'numeric', month: 'short' });
const dayKey = (/** @type {number} */ ms) => new Date(ms + 330 * 60_000).toISOString().slice(0, 10);

/** "2:00 PM", "6:00 AM". */
export const timeText = (/** @type {number} */ ms) => TIME.format(ms).replace(/\s?(am|pm)$/i, (x) => ` ${x.trim().toUpperCase()}`);
/** "Fri, 13 Nov" → "Fri 13 Nov". */
export const dayText = (/** @type {number} */ ms) => DAY.format(ms).replace(',', '');

/**
 * Where we are in the schedule.
 *   before: not started yet   on: vehicles stopped now   off: roads open between windows   ended
 * @param {number} now
 * @returns {{ state: 'before' | 'on' | 'off' | 'ended', line: string, index: number }}
 */
export function trafficStatus(now) {
  const first = WINDOWS[0];
  const last = WINDOWS[WINDOWS.length - 1];
  if (now >= last.to) return { state: 'ended', line: 'Restrictions have ended', index: -1 };
  const i = WINDOWS.findIndex((w) => now >= w.from && now < w.to);
  if (i >= 0) {
    const w = WINDOWS[i];
    const until = w.openEnd ? 'until immersion ends' : `until ${timeText(w.to)}${dayKey(w.to) === dayKey(now) ? '' : ' tomorrow'}`;
    return { state: 'on', line: `Vehicles stopped now · ${until}`, index: i };
  }
  if (now < first.from) {
    const soon =
      dayKey(first.from) === dayKey(now) ? `today at ${timeText(first.from)}` : `${dayText(first.from)}, ${timeText(first.from)}`;
    return { state: 'before', line: `Starts ${soon}`, index: 0 };
  }
  const next = WINDOWS.findIndex((w) => w.from > now);
  const n = WINDOWS[next];
  const when = dayKey(n.from) === dayKey(now) ? timeText(n.from) : `${timeText(n.from)} tomorrow`;
  return { state: 'off', line: `Roads open now · closes at ${when}`, index: next };
}

/** One row per window: "Fri 13 Nov", "12:00 PM to 6:00 AM" (or "7:00 AM until immersion ends"). */
export function windowRows() {
  return WINDOWS.map((w) => ({
    day: dayText(w.from),
    hours: w.openEnd ? `${timeText(w.from)} until immersion ends` : `${timeText(w.from)} to ${timeText(w.to)}`,
  }));
}
