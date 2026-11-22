import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../components/ui/Icon.jsx';
import { useBackClose } from './hooks.js';
import { NoEntryIcon } from './immersion.jsx';
import { entryLine } from './procession.js';

/**
 * What a new visitor can do in the procession guide.
 * @type {{ icon: import('../components/ui/Icon.jsx').IconName, title: string, text: string }[]}
 */
const ROWS = [
  { icon: 'route', title: 'Follow the route', text: 'See the full 8.7 km route on the map.' },
  { icon: 'users', title: 'Find the best place to watch', text: 'Pick where you arrive. We suggest the best spot to stand.' },
  { icon: 'award', title: 'View procession idols in order', text: 'All 68 pujas, one after another, with their lorries.' },
];

/** The grey line. It mounts each time the card opens, so it reads the clock then (About can reopen the card later). */
function EntryLine() {
  const [line] = useState(() => entryLine(Date.now()));
  return line ? <p className="jg-welcome-sub">{line}</p> : null;
}

/**
 * The daily card: shown on the first open of each day (India time); About opens it again. Everyone sees the same
 * headline, one grey line that follows the clock, and exactly two buttons. New visitors also get three feature rows.
 * The top area is the slot for the animation: it ignores touches, and the close button sits above it.
 * @param {{ open: boolean, signedIn?: boolean, onClose: () => void, onProcession: () => void, onTraffic: () => void }} props
 */
export function Welcome({ open, signedIn = false, onClose, onProcession, onTraffic }) {
  const reduce = useReducedMotion();
  const button = useRef(/** @type {HTMLButtonElement | null} */ (null));
  useBackClose(open, onClose);
  useEffect(() => {
    if (!open) return undefined;
    // Focus for keyboards and screen readers, without a ring on touch screens.
    const frame = requestAnimationFrame(() => button.current?.focus(/** @type {any} */ ({ focusVisible: false })));
    const onKey = (/** @type {KeyboardEvent} */ e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="welcome"
          className="jg-scrim strong jg-welcome-scrim"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.section
            className="jg-welcome"
            role="dialog"
            aria-modal="true"
            aria-labelledby="jg-welcome-title"
            initial={reduce ? { opacity: 0 } : { y: 60, opacity: 0 }}
            animate={reduce ? { opacity: 1 } : { y: 0, opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { y: 60, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.25, 1, 0.5, 1] }}
          >
            <div className="jg-welcome-hero">
              <button type="button" className="jg-welcome-x" aria-label="Close" onClick={onClose}>
                <Icon name="x" size={24} />
              </button>
              <div className="jg-welcome-art">
                <img className="jg-welcome-logo" src="/icon.svg" width="88" height="88" alt="" />
              </div>
            </div>
            <div className="jg-welcome-body">
              <h2 id="jg-welcome-title" className="jg-welcome-title">
                Experience the glory of Jagadhatri Puja ’26 Procession
              </h2>
              <EntryLine />
              {!signedIn && (
                <ul className="jg-welcome-rows">
                  {ROWS.map((r) => (
                    <li key={r.icon}>
                      <span className="jg-benefit-ic" aria-hidden="true">
                        <Icon name={r.icon} size={20} />
                      </span>
                      <span className="jg-welcome-text">
                        <b>{r.title}</b>
                        <span>{r.text}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <button
                ref={button}
                type="button"
                className="btn dark block jg-welcome-go"
                onClick={() => {
                  onClose();
                  onProcession();
                }}
              >
                <Icon name="flag" size={20} />
                View procession
              </button>
              <button
                type="button"
                className="btn block jg-btn-outline jg-welcome-second"
                onClick={() => {
                  onClose();
                  onTraffic();
                }}
              >
                <NoEntryIcon width={20} height={20} />
                View traffic and parking
              </button>
            </div>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
