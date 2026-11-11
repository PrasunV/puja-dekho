import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Icon } from '../components/ui/Icon.jsx';

/**
 * The "Are you visiting?" bar under the search bar (design 7.13). Two steps: Yes or No, then the crowd (Free or
 * Crowded, or skip). One question at a time, 48 px buttons.
 * @param {{
 *   step: null | { kind: 'ask' | 'crowd', puja: import('./lib.js').JgPuja },
 *   busy: boolean,
 *   onYes: () => void, onNo: () => void,
 *   onCrowd: (level: 'free' | 'crowded') => void, onSkip: () => void,
 * }} props
 */
export function VisitBar({ step, busy, onYes, onNo, onCrowd, onSkip }) {
  const reduce = useReducedMotion();
  return (
    <AnimatePresence>
      {step && (
        <motion.section
          key={step.puja.id}
          className="jg-visit-bar"
          role="dialog"
          aria-live="polite"
          aria-label={step.kind === 'ask' ? 'Are you visiting this puja?' : 'Crowd report'}
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: -8 }}
          animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {step.kind === 'ask' ? (
            <>
              <p className="jg-visit-q">
                Are you visiting <strong>{step.puja.n}</strong>?
              </p>
              <div className="jg-visit-btns">
                <button type="button" className="btn jg-btn-outline" onClick={onNo} disabled={busy}>
                  No
                </button>
                <button type="button" className="btn dark" onClick={onYes} disabled={busy}>
                  Yes
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="jg-visit-head">
                <p className="jg-visit-q">How is the crowd right now?</p>
                <button type="button" className="jg-icon-btn" aria-label="Skip crowd report" onClick={onSkip}>
                  <Icon name="x" />
                </button>
              </div>
              <div className="jg-visit-btns">
                <button type="button" className="btn jg-crowd-btn free" onClick={() => onCrowd('free')} disabled={busy}>
                  Free
                </button>
                <button type="button" className="btn jg-crowd-btn crowded" onClick={() => onCrowd('crowded')} disabled={busy}>
                  Crowded
                </button>
              </div>
            </>
          )}
        </motion.section>
      )}
    </AnimatePresence>
  );
}
