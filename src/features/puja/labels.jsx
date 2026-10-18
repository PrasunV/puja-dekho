import { useApp } from '../../context/AppContext.js';
import { Dot } from '../../components/ui/Dot.jsx';
import { formatAge } from '../../lib/pujas.js';

/**
 * One-line queue summary: dot, wait or level, and who reported when.
 * Shows "A visitor" when the reporter gave no nickname.
 * @param {{ puja: import('../../lib/types.js').Puja }} props
 */
export function CrowdLabel({ puja }) {
  const { live, levels } = useApp();
  const queue = live.pujas[puja.id]?.q;
  if (!queue) return <span className="muted">No queue reports yet</span>;
  const level = levels.find((l) => l.n === queue.level)?.label || '';
  const by = queue.by || 'A visitor';
  return (
    <span className="crowd">
      <Dot tone={`q${queue.level}`} />
      {queue.wait != null ? `~${queue.wait} min wait` : level}
      <span className="muted fw4">{` · ${by} · ${formatAge(queue.ageMin)}${queue.conf === 'low' ? ' · 1 report' : ''}`}</span>
    </span>
  );
}

/**
 * Star score and count, or "Not rated yet".
 * @param {{ puja: import('../../lib/types.js').Puja }} props
 */
export function RatingLabel({ puja }) {
  const { live } = useApp();
  const rating = live.pujas[puja.id]?.r;
  if (!rating) return <span className="muted">Not rated yet</span>;
  return (
    <span>
      <span className="stars">★ {rating.avg.toFixed(1)}</span>
      <span className="muted">{` (${rating.n})`}</span>
    </span>
  );
}
