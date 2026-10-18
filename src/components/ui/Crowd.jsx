import { Icon } from './Icon.jsx';
import { crowdText, typicalCrowd } from '../../lib/crowd.js';

/**
 * "Usually Moderate at this hour". A plain grey chip with a clock, so it never looks like a live status.
 * Renders nothing when the data has no value for this hour.
 * @param {{ puja: { id: string } }} props
 */
export function TypicalCrowd({ puja }) {
  const level = typicalCrowd(puja);
  if (!level) return null;
  return (
    <span className="tag crowd-chip" title="A guide based on the hour, not live data">
      <Icon name="clock" size={14} />
      {crowdText(level)}
    </span>
  );
}

/**
 * Small dot for list rows. Three shades of the same neutral, not green, amber and red, so it reads as
 * "usual" rather than "right now". The words are in the label for screen readers.
 * @param {{ puja: { id: string } }} props
 */
export function CrowdDot({ puja }) {
  const level = typicalCrowd(puja);
  if (!level) return null;
  return <span className={`crowd-dot ${level.toLowerCase()}`} role="img" aria-label={crowdText(level)} title={crowdText(level)} />;
}
