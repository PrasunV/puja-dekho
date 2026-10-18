/**
 * Weighted median of `{ value, weight }` items. Returns null for an empty list.
 * @param {{ value: number, weight: number }[]} items
 * @returns {number | null}
 */
export function weightedMedian(items) {
  if (!items.length) return null;
  const sorted = items.slice().sort((a, b) => a.value - b.value);
  const total = sorted.reduce((sum, item) => sum + item.weight, 0);
  let running = 0;
  for (const item of sorted) {
    running += item.weight;
    if (running >= total / 2) return item.value;
  }
  return sorted[sorted.length - 1].value;
}
