/**
 * Rank badges, E-Rank to S-Rank (design 9.4). Only pujas completed in person count ("person" visits, from Yes on the
 * "Are you visiting?" bar); a hand tick ("manual") shows in Visited but never counts. A higher rank always includes
 * the ones below it: reaching D-Rank (10 in total) also earns E-Rank.
 * Pure functions, tested in test/client/jagadhatri.test.js.
 */

/** @typedef {{ puja: string, mode: string, at: number, day: string }} Visit */

/**
 * `tier` is the coin the rank wears (badge design system: Bronze to Legendary; Platinum is skipped, it is too close to
 * Silver). `c1` is the rank's accent for text and the burst on the cream celebration ground, the tier's rim darkened
 * to 4.5:1 or better on it.
 */
export const RANKS = Object.freeze([
  { id: 'E', name: 'Lantern Rookie', need: 5, rule: '5 pujas in one day', tier: 'bronze', c1: '#843C0C' },
  { id: 'D', name: 'Pandal Seeker', need: 10, rule: '10 pujas', tier: 'silver', c1: '#5E6573' },
  { id: 'C', name: 'Light Chaser', need: 25, rule: '25 pujas', tier: 'gold', c1: '#8A4F00' },
  { id: 'B', name: 'Night Hunter', need: 50, rule: '50 pujas', tier: 'emerald', c1: '#0C6B45' },
  { id: 'A', name: 'Procession Ranger', need: 75, rule: '75 pujas', tier: 'diamond', c1: '#1F6A8F' },
  { id: 'S', name: 'Monarch of Lights', need: 100, rule: '100 pujas', tier: 'legendary', c1: '#6A3FC4' },
]);

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
export const istDay = (/** @type {number} */ ms) => new Date(ms + IST_OFFSET_MS).toISOString().slice(0, 10);

/**
 * Counts from the visit list.
 * @param {Visit[]} visited
 * @param {number} now
 */
export function statsOf(visited, now) {
  const person = visited.filter((v) => v.mode === 'person');
  const byDay = new Map();
  for (const v of person) byDay.set(v.day, (byDay.get(v.day) || 0) + 1);
  const today = byDay.get(istDay(now)) || 0;
  const best = Math.max(0, ...byDay.values());
  return { today, total: person.length, best };
}

/** @param {{ best: number, total: number }} s @param {number} i */
export function unlocked(s, i) {
  return i === 0 ? s.best >= 5 || s.total >= RANKS[1].need : s.total >= RANKS[i].need;
}

/** Highest rank earned (-1 = none) and the next one to earn (-1 = all earned). */
export function rankOf(/** @type {{ best: number, total: number, today: number }} */ s) {
  let cur = -1;
  let next = -1;
  RANKS.forEach((_, i) => {
    if (unlocked(s, i)) cur = i;
    else if (next < 0) next = i;
  });
  return { cur, next };
}

/** How many more pujas the next rank needs, and how far along the bar is (0–100). */
export function progressTo(/** @type {{ best: number, total: number, today: number }} */ s, /** @type {number} */ i) {
  if (i < 0) return { left: 0, pct: 100, today: false };
  if (i === 0) return { left: Math.max(0, 5 - s.today), pct: (s.today / 5) * 100, today: true };
  return { left: Math.max(0, RANKS[i].need - s.total), pct: (s.total / RANKS[i].need) * 100, today: false };
}

/** "Complete 3 more pujas to unlock it" / "...today to unlock it". */
export function unlockLine(/** @type {{ left: number, today: boolean }} */ p) {
  return `Complete ${p.left} more ${p.left === 1 ? 'puja' : 'pujas'}${p.today ? ' today' : ''} to unlock it`;
}

/**
 * Coin colours from the badge design system: highlight ring, face and rim. Hex values on purpose (one source in code):
 * the share image draws the badge through an image, where CSS variables do not resolve.
 */
const TIERS = Object.freeze({
  bronze: { hi: '#E8A560', face: '#B05F20', rim: '#843C0C' },
  silver: { hi: '#E4E7EC', face: '#A8AFBA', rim: '#838B98' },
  gold: { hi: '#FCCC54', face: '#F3A931', rim: '#E4840C' },
  emerald: { hi: '#54E49C', face: '#45B786', rim: '#0C8454' },
  diamond: { hi: '#9CE4FC', face: '#4CBDE8', rim: '#3C9CCC' },
  legendary: { hi: '#E4CCFC', face: '#B088EF', rim: '#8454E4' },
  locked: { hi: '#E4E6EE', face: '#CBCEDC', rim: '#B4AFC5' },
});
const GLYPH_LOCKED = '#8E92A8';

// The Puja Dekho eye mark (same shapes as src/assets/loader/eye-lineart.svg), filled: the drop with the pupil cut out
// and the bowl. White with a 1.5 px rim-colour edge on earned coins, grey on locked ones.
const EYE_DROP = 'M496 97C420 170 359 245 359 328C359 420 420 490 496 524C572 490 634 420 634 328C634 245 572 170 496 97Z';
const EYE_PUPIL = 'M417 331a80 80 0 1 0 160 0a80 80 0 1 0 -160 0Z';
const EYE_BOWL = 'M189 248A311 311 0 1 0 810 248A311 311 0 0 1 189 248Z';

/**
 * The badge as SVG markup: a round coin (rim, face, highlight ring) with the eye mark. One source for the profile,
 * the celebration and the share image, which draws it on a canvas. The viewBox is cropped to the coin, so it fills
 * its box at every size.
 * @param {number} i
 * @param {{ locked?: boolean, size?: number }} [o]
 */
export function badgeSvg(i, { locked = false, size = 120 } = {}) {
  const t = TIERS[locked ? 'locked' : RANKS[i].tier];
  const eye = locked
    ? `<g transform="translate(50 47) scale(0.05867) translate(-500 -325)" fill="${GLYPH_LOCKED}">`
    : `<g transform="translate(50 47) scale(0.05867) translate(-500 -325)" fill="#FFFFFF" stroke="${t.rim}" stroke-width="26" stroke-linejoin="round" paint-order="stroke">`;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="10 9 80 80" aria-hidden="true">` +
    `<circle cx="50" cy="53" r="36" fill="${t.rim}"/><circle cx="50" cy="47" r="36" fill="${t.face}"/>` +
    `<circle cx="50" cy="47" r="28" fill="none" stroke="${t.hi}" stroke-width="2.6"/>` +
    `${eye}<path d="${EYE_DROP}${EYE_PUPIL}" fill-rule="evenodd"/><path d="${EYE_BOWL}"/></g></svg>`
  );
}

/** What earned the badge, for the celebration, the share card and its text. */
export function rareLine(/** @type {number} */ i, /** @type {number} */ total) {
  return i === 0 ? '5 pujas in one day' : `${Math.max(total, RANKS[i].need).toLocaleString('en-IN')} pujas visited`;
}
