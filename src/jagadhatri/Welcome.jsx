import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../components/ui/Icon.jsx';
import { useBackClose } from './hooks.js';

/**
 * The three things to know, in the order people meet them.
 * @type {{ icon: import('../components/ui/Icon.jsx').IconName, title: string, text: string }[]}
 */
const ROWS = [
  { icon: 'pin', title: 'Find pujas near you', text: 'The closest pandals, one tap away.' },
  { icon: 'award', title: 'Save pujas, earn badges', text: 'Turn your puja hopping into badges worth showing off.' },
  { icon: 'users', title: 'See the crowd live', text: 'Skip the queues. Go where it’s free right now.' },
];

/**
 * The first-visit card (like the Durga Celebfie intro): logo, welcome, three feature rows, Start exploring.
 * Shown once per phone; About opens it again.
 * @param {{ open: boolean, onClose: () => void }} props
 */
export function Welcome({ open, onClose }) {
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
            <img className="jg-welcome-logo" src="/icon.svg" width="56" height="56" alt="Puja Dekho" />
            <h2 id="jg-welcome-title" className="jg-welcome-title">
              Welcome to Jagadhatri Puja Dekho
            </h2>
            <p className="jg-welcome-sub">Your guide to Chandannagar’s nights of lights.</p>
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
            <button ref={button} type="button" className="btn dark block jg-welcome-go" onClick={onClose}>
              Start exploring
            </button>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
