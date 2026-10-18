/**
 * Shorten a name to `max` visible characters, ending in an ellipsis when it was cut.
 * Counts whole characters (not UTF-16 units), so Bengali conjuncts and emoji are not split.
 * @param {string} text
 * @param {number} [max]
 */
export function truncateName(text, max = 20) {
  const chars = Array.from(new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text.trim()), (s) => s.segment);
  return chars.length <= max ? chars.join('') : `${chars.slice(0, max).join('').trimEnd()}…`;
}
