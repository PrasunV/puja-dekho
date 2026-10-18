import { motion } from 'motion/react';
import { Icon } from './Icon.jsx';

/**
 * Save / unsave toggle.
 * @param {{ on: boolean, onToggle: () => void }} props
 */
export function HeartButton({ on, onToggle }) {
  return (
    <motion.button
      type="button"
      className={`icon-btn${on ? ' on' : ''}`}
      aria-label={on ? 'Remove from saved' : 'Save'}
      aria-pressed={on}
      whileTap={{ scale: 0.8 }}
      animate={on ? { scale: [1, 1.25, 1] } : { scale: 1 }}
      transition={{ duration: 0.25 }}
      onClick={(event) => {
        event.stopPropagation();
        onToggle();
      }}
    >
      <Icon name="heart" fill={on} size={22} />
    </motion.button>
  );
}
