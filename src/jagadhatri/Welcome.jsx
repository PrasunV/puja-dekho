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
  { icon: 'route', title: 'Plan your route', text: 'Pick where you start and end. We fit the pujas into your time.' },
  { icon: 'award', title: 'Tick pujas, earn badges', text: 'Turn your puja hopping into badges worth showing off.' },
  { icon: 'users', title: 'See the crowd live', text: 'Skip the queues. Go where it’s free right now.' },
];

/**
 * The daily card: shown on the first open of each day (India time); About opens it again. Signed-out people get logo,
 * welcome, three feature rows and Start exploring. Signed-in people get a short greeting with Plan my route first.
 * @param {{ open: boolean, name?: string | null, onClose: () => void, onPlan?: () => void }} props
 */
export function Welcome({ open, name, onClose, onPlan }) {
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
            {name ? (
              <>
                <h2 id="jg-welcome-title" className="jg-welcome-title">
                  {`Welcome back, ${name}`}
                </h2>
                <p className="jg-welcome-sub">Plan tonight’s route, or just see what’s near you.</p>
                <button
                  ref={button}
                  type="button"
                  className="btn dark block jg-welcome-go"
                  onClick={() => {
                    onClose();
                    onPlan?.();
                  }}
                >
                  <Icon name="route" size={20} />
                  Plan my route
                </button>
                <button type="button" className="jg-notnow" onClick={onClose}>
                  Start exploring
                </button>
              </>
            ) : (
              <>
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
              </>
            )}
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
