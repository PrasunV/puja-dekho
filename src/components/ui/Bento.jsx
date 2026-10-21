import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import { Icon } from './Icon.jsx';

const GROW = { duration: 0.26, ease: /** @type {const} */ ([0.25, 1, 0.5, 1]) };

/**
 * One bento card: a header button (icon, title, chevron), a small visual preview while shut, the content while open.
 * It grows in place like a Google place page. Width is a CSS transition (flex-basis) and the content grows by height,
 * so nothing is ever scaled and no text is stretched mid-move; only the card's position is animated (layout="position").
 * @param {{ id: string, icon: import('./Icon.jsx').IconName, title: string, preview: import('react').ReactNode, open: boolean, onToggle: () => void, full?: boolean, children: import('react').ReactNode }} props
 */
export function BentoCard({ id, icon, title, preview, open, onToggle, full = false, children }) {
  return (
    <motion.div
      id={`card-${id}`}
      layout="position"
      transition={{ layout: GROW }}
      className="bento-card"
      data-open={open}
      data-full={full || undefined}
    >
      <button type="button" className="bento-head" aria-expanded={open} aria-controls={`bento-${id}`} onClick={onToggle}>
        <Icon name={icon} size={22} />
        <span className="bento-title">{title}</span>
        <span className="bento-chev" data-open={open}>
          <Icon name="chevron" size={20} />
        </span>
      </button>
      <AnimatePresence initial={false}>
        {!open && (
          <motion.div
            key="preview"
            className="bento-preview"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.18 }}
          >
            {preview}
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="body"
            id={`bento-${id}`}
            className="bento-clip"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1, transition: { height: GROW, opacity: { duration: 0.2, delay: 0.08 } } }}
            exit={{ height: 0, opacity: 0, transition: { height: GROW, opacity: { duration: 0.12 } } }}
          >
            <div className="bento-body">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/**
 * Which cards of a bento are open, and whether the open ones have pushed the shut ones onto their own rows.
 * @param {Record<string, boolean>} initial
 */
export function useBento(initial) {
  const [open, setOpen] = useState(initial);
  const toggle = (/** @type {string} */ key) => setOpen((o) => ({ ...o, [key]: !o[key] }));
  const stacked = Object.values(open).some(Boolean);
  return { open, toggle, stacked };
}
