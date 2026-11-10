/**
 * Rank badges, E-Rank to S-Rank (design 9.4). Only pujas completed in person count ("person" visits, from Yes on the
 * "Are you visiting?" bar); a hand tick ("manual") shows in Visited but never counts. A higher rank always includes
 * the ones below it: reaching D-Rank (10 in total) also earns E-Rank.
 * Pure functions, tested in test/client/jagadhatri.test.js.
 */

/** @typedef {{ puja: string, mode: string, at: number, day: string }} Visit */

export const RANKS = Object.freeze([
  { id: 'E', name: 'Lantern Rookie', need: 5, rule: '5 pujas in one day', c1: '#7A3A00', c2: '#FFF1E0', rays: 4 },
  { id: 'D', name: 'Pandal Seeker', need: 10, rule: '10 pujas', c1: '#B31D24', c2: '#FDE9DC', rays: 6 },
  { id: 'C', name: 'Light Chaser', need: 25, rule: '25 pujas', c1: '#0B7A75', c2: '#E3F4F2', rays: 8 },
  { id: 'B', name: 'Night Hunter', need: 50, rule: '50 pujas', c1: '#4A0E14', c2: '#F0D3D6', rays: 10 },
  { id: 'A', name: 'Procession Ranger', need: 75, rule: '75 pujas', c1: '#C2410C', c2: '#FFF1E0', rays: 12 },
  { id: 'S', name: 'Monarch of Lights', need: 100, rule: '100 pujas', c1: '#8A5A00', c2: '#FFE7A8', rays: 16 },
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

/** The SVG art for a badge (placeholder until the final art arrives): rays path and colours. */
export function badgeArt(/** @type {number} */ i, /** @type {boolean} */ locked) {
  const r = RANKS[i];
  const parts = [];
  for (let k = 0; k < r.rays; k++) {
    const a = (k / r.rays) * Math.PI * 2 - Math.PI / 2;
    const p = (rad) => `${(60 + rad * Math.cos(a)).toFixed(1)} ${(58 + rad * Math.sin(a)).toFixed(1)}`;
    parts.push(`M${p(47)}L${p(56)}`);
  }
  return {
    rays: parts.join(''),
    c1: locked ? '#9A9A9A' : r.c1,
    c2: locked ? '#EFEFEF' : r.c2,
    flame: locked ? '#C8C8C8' : '#FC8105',
    label: `${r.id}-RANK`,
  };
}
