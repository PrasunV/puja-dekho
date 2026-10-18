/**
 * Nickname rules: 2 to 20 letters, numbers, spaces, dots, dashes or underscores,
 * and no obvious abuse.
 *
 * The block list is deliberately strict. Short words are blocked as a whole word or a
 * whole name, long words anywhere in the name. The known trade-off: a few real names
 * that are also short slurs (for example "Bal", "Randi", "Lund") are refused.
 * To loosen it, delete the word from BLOCKED_WORDS.
 */

/** English plus Romanised Bengali and Hindi. Lowercase, no spaces. */
const BLOCKED_WORDS = [
  'fuck',
  'shit',
  'bitch',
  'asshole',
  'bastard',
  'dick',
  'cock',
  'pussy',
  'cunt',
  'slut',
  'whore',
  'nigger',
  'nigga',
  'faggot',
  'retard',
  'rape',
  'nazi',
  'hitler',
  'madarchod',
  'maderchod',
  'behenchod',
  'bhenchod',
  'bhosdi',
  'bhosda',
  'chutiya',
  'chutiye',
  'gandu',
  'gaandu',
  'harami',
  'haramzada',
  'randi',
  'raand',
  'lund',
  'loda',
  'lauda',
  'chod',
  'magi',
  'khanki',
  'bokachoda',
  'chodna',
  'chudi',
  'banchod',
  'bal',
  'shala',
  'kutta',
  'kuttar',
  'suor',
];

/** Words of at least this length match anywhere in the name; shorter ones only as a whole word. */
const SUBSTRING_MIN_LENGTH = 5;
const ALLOWED_PATTERN = /^[\p{L}\p{M}\p{N} ._-]{2,20}$/u;
const MESSAGE_FORMAT = 'Nicknames use 2 to 20 letters, numbers, spaces, dots, dashes or underscores.';
const MESSAGE_BLOCKED = 'Please pick a different nickname.';

/** Common look-alike characters. */
const LEET = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', '@': 'a', $: 's', '!': 'i' };

const collapseRepeats = (text) => text.replace(/(.)\1+/g, '$1');
const undoLeet = (text) => text.replace(/[013457@$!]/g, (char) => LEET[char] ?? char);

const BLOCKED_COLLAPSED = BLOCKED_WORDS.map(collapseRepeats);

/** Lowercase letters only, look-alikes undone, repeats collapsed: "Fuuuck" becomes "fuck". */
const flatten = (name) => collapseRepeats(undoLeet(name.toLowerCase()).replace(/[^a-z]/g, ''));
const splitWords = (name) =>
  name
    .toLowerCase()
    .split(/[^a-z0-9@$!]+/)
    .filter(Boolean)
    .map((word) => collapseRepeats(undoLeet(word)));

/**
 * @typedef {{ ok: true, value: string | null } | { ok: false, message: string }} NicknameResult
 */

/**
 * Validate a nickname. Empty input is allowed and returns `value: null`.
 * @param {unknown} input
 * @returns {NicknameResult}
 */
export function checkNickname(input) {
  if (input == null || (typeof input === 'string' && input.trim() === '')) return { ok: true, value: null };
  if (typeof input !== 'string') return { ok: false, message: MESSAGE_FORMAT };
  const name = input.trim().replace(/\s+/g, ' ');
  if (!ALLOWED_PATTERN.test(name)) return { ok: false, message: MESSAGE_FORMAT };
  const flat = flatten(name);
  const words = splitWords(name);
  const blocked = BLOCKED_COLLAPSED.some((word) =>
    word.length >= SUBSTRING_MIN_LENGTH ? flat.includes(word) : words.includes(word) || flat === word,
  );
  return blocked ? { ok: false, message: MESSAGE_BLOCKED } : { ok: true, value: name };
}
