import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Icon } from '../components/ui/Icon.jsx';

/**
 * The "Are you visiting?" bar (design 7.9): a soft grey card floating just above the bottom sheet. Two steps, one
 * question each, with two equal grey buttons so neither answer is nudged:
 *   ask   "Are you visiting [puja]?"   No | Yes        (no close button: No is the way out)
 *   crowd "How is the crowd right now?" ✕   Free | Crowded   (✕ skips)
 * @param {{
 *   step: null | { kind: 'ask' | 'crowd', puja: import('./lib.js').JgPuja },
 *   busy: boolean,
 *   bottom: string,
 *   onYes: () => void, onNo: () => void,
 *   onCrowd: (level: 'free' | 'crowded') => void, onSkip: () => void,
 * }} props
 */
export function VisitBar({ step, busy, bottom, onYes, onNo, onCrowd, onSkip }) {
  const reduce = useReducedMotion();
  return (
    <AnimatePresence>
      {step && (
        <motion.section
          key={step.puja.id}
          className="jg-visit-bar"
          style={{ bottom }}
          role="dialog"
          aria-live="polite"
          aria-label={step.kind === 'ask' ? 'Are you visiting this puja?' : 'Crowd report'}
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12 }}
          animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: 12 }}
          transition={{ duration: 0.2 }}
        >
          {step.kind === 'ask' ? (
            <p className="jg-visit-q">
              Are you visiting <strong>{step.puja.n}</strong>?
            </p>
          ) : (
            <div className="jg-visit-head">
              <p className="jg-visit-q">How is the crowd right now?</p>
              <button type="button" className="jg-visit-x" aria-label="Skip crowd report" onClick={onSkip}>
                <Icon name="x" size={20} />
              </button>
            </div>
          )}
          <div className="jg-visit-btns">
            {step.kind === 'ask' ? (
              <>
                <button type="button" className="jg-visit-btn" onClick={onNo} disabled={busy}>
                  No
                </button>
                <button type="button" className="jg-visit-btn" onClick={onYes} disabled={busy}>
                  Yes
                </button>
              </>
            ) : (
              <>
                <button type="button" className="jg-visit-btn" onClick={() => onCrowd('free')} disabled={busy}>
                  <span className="jg-visit-dot free" aria-hidden="true" />
                  Free
                </button>
                <button type="button" className="jg-visit-btn" onClick={() => onCrowd('crowded')} disabled={busy}>
                  <span className="jg-visit-dot crowded" aria-hidden="true" />
                  Crowded
                </button>
              </>
            )}
          </div>
        </motion.section>
      )}
    </AnimatePresence>
  );
}

/**
 * The first-time question: local or visitor. Same grey bar as "Are you visiting?", floating above the sheet.
 * @param {{ show: boolean, bottom: string, onLocal: () => void, onVisitor: () => void, onSkip: () => void }} props
 */
export function WhoBar({ show, bottom, onLocal, onVisitor, onSkip }) {
  const reduce = useReducedMotion();
  return (
    <AnimatePresence>
      {show && (
        <motion.section
          key="who"
          className="jg-visit-bar jg-who-bar"
          style={{ bottom }}
          role="dialog"
          aria-live="polite"
          aria-label="Do you live in Chandannagar, Mankundu or Bhadreswar?"
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12 }}
          animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: 12 }}
          transition={{ duration: 0.2 }}
        >
          <div className="jg-visit-head">
            <div className="jg-who-q">
              <p className="jg-visit-q">Do you live here?</p>
              <p className="jg-meta">Chandannagar, Mankundu or Bhadreswar</p>
            </div>
            <button type="button" className="jg-visit-x" aria-label="Not now" onClick={onSkip}>
              <Icon name="x" size={20} />
            </button>
          </div>
          <div className="jg-visit-btns">
            <button type="button" className="jg-visit-btn" onClick={onLocal}>
              I live here
            </button>
            <button type="button" className="jg-visit-btn" onClick={onVisitor}>
              I'm visiting
            </button>
          </div>
        </motion.section>
      )}
    </AnimatePresence>
  );
}
