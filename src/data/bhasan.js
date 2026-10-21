/**
 * Bhasan (immersion) specials: the ghat card and the Live / Replay row at the top of the list sheet.
 * Everything here is edited by hand. Nothing is fetched, so no API key is needed.
 *
 * HOW TO UPDATE
 *  - Order:              cards show in this list's order, left to right. Put the newest stream first, replays last.
 *  - Stream is live:     set `live: true` on its row (the card then shows a red pulsing LIVE badge).
 *  - Immersion time:     fill `ghat.window` with { start: '17:00', end: '21:00' } (24 h, India time) once it is confirmed.
 *                        While it is `null` the card only says "Bhasan today" and no time is shown anywhere.
 *  - Another replay:     change the `url`, `title` and `thumb` of the replay row.
 *  - Switch it all off:  both sections disappear on their own after `expiresAt` (India time).
 */
export const BHASAN = Object.freeze({
  expiresAt: '2026-10-23T23:59:59+05:30',
  ghat: Object.freeze({
    name: 'Baje Kadomtala Ghat',
    area: 'Strand Rd, B.B.D. Bagh',
    address: '8 Strand Rd, B.B.D. Bagh, Kolkata 700021',
    lat: 22.564652,
    lng: 88.33875,
    placeId: 'ChIJswI8CZ53AjoRtMSihiLpT6c',
    note: 'Known for its evening Ganga Aarti.',
    /** `{ start: 'HH:mm', end: 'HH:mm' }` in India time, or `null` while the immersion time is not confirmed. */
    window: /** @type {{ start: string, end: string } | null} */ (null),
  }),
  videos: Object.freeze([
    Object.freeze({
      type: 'live',
      /** Set to `true` only while the stream is really on. Set it back to `false` when it ends. */
      live: true,
      channel: 'TV9 Bangla',
      title: 'BIG BREAKING | দশমীর বিষাদ, ঘাটে ঘাটে চলছে প্রতিমা নিরঞ্জন | DURGA PUJA 2026 | BIJAYA DASHAMI',
      url: 'https://www.youtube.com/live/04sRqedFlMk',
      thumb: 'https://i.ytimg.com/vi/04sRqedFlMk/hqdefault.jpg',
    }),
    Object.freeze({
      type: 'live',
      live: true,
      channel: 'Zee 24 Ghanta',
      title: 'Durga Puja 2026 | আজ দশমী, বিদায়ের সুরেই ফেরার আশা...| Zee 24 Ghanta Live',
      url: 'https://www.youtube.com/live/UxHc2lGvfiI',
      thumb: 'https://i.ytimg.com/vi/UxHc2lGvfiI/hqdefault.jpg',
    }),
    Object.freeze({
      type: 'replay',
      live: false,
      channel: 'TV9 Bangla',
      title: 'Durga Puja 2026: Mudiali dhak, devi boron | #TV9Cut',
      url: 'https://www.youtube.com/watch?v=MB1a8UAA4bA',
      thumb: 'https://i.ytimg.com/vi/MB1a8UAA4bA/hqdefault.jpg',
    }),
  ]),
});

/** Minutes since midnight in India for `now`, whatever the phone's own time zone is. */
function istMinutes(now) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(now));
  const get = (type) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return get('hour') * 60 + get('minute');
}
const toMinutes = (/** @type {string} */ text) => {
  const [h, m] = text.split(':').map(Number);
  return h * 60 + m;
};
const clock = (/** @type {string} */ text) => {
  const [h, m] = text.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
};

/** True until the end of 23 Oct 2026, India time. */
export const bhasanActive = (now = Date.now(), config = BHASAN) => now <= new Date(config.expiresAt).getTime();

/**
 * The ghat chip. With no confirmed window it only says "Bhasan today"; with one it counts down to the start,
 * goes live-style while it is on, and says it ended once it is over.
 * @returns {{ key: 'today' | 'soon' | 'on' | 'ended', label: string }}
 */
export function ghatStatus(now = Date.now(), window = BHASAN.ghat.window) {
  if (!window) return { key: 'today', label: 'Bhasan today' };
  const minutes = istMinutes(now);
  if (minutes < toMinutes(window.start)) return { key: 'soon', label: `Starts at ${clock(window.start)}` };
  if (minutes < toMinutes(window.end)) return { key: 'on', label: 'Bhasan on now' };
  return { key: 'ended', label: 'Ended for today' };
}

/** Google Maps' own mode picker, aimed at the ghat by its Place ID (no travel mode forced). */
export const ghatDirectionsUrl = (ghat = BHASAN.ghat) =>
  `https://www.google.com/maps/dir/?api=1&destination=${ghat.lat},${ghat.lng}&destination_place_id=${ghat.placeId}`;
