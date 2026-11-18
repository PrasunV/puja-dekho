import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Icon } from '../components/ui/Icon.jsx';

/**
 * The "Are you visiting?" bar (design 7.9): a soft grey card floating just above the bottom sheet. Each step asks one
 * question with two equal grey buttons so neither answer is nudged:
 *   ask   "Are you visiting [puja]?"        ✕  No | Yes   (✕ closes it with no answer; it is asked again later)
 *   late  "Have you visited [puja]?"        ✕  No | Yes   a second line says when you were near it, with dots when
 *                                                          there is more than one puja (up to 5)
 *   crowd "How is the crowd right now?"     ✕  Free | Crowded   (✕ skips)
 * @param {{
 *   step: null | { kind: 'ask' | 'crowd', puja: import('./lib.js').JgPuja } | { kind: 'late', puja: import('./lib.js').JgPuja, line: string, i: number, total: number },
 *   busy: boolean,
 *   bottom: string,
 *   onYes: () => void, onNo: () => void, onClose: () => void,
 *   onCrowd: (level: 'free' | 'crowded') => void, onSkip: () => void,
 * }} props
 */
export function VisitBar({ step, busy, bottom, onYes, onNo, onClose, onCrowd, onSkip }) {
  const reduce = useReducedMotion();
  const late = step?.kind === 'late' ? step : null;
  return (
    <AnimatePresence>
      {step && (
        <motion.section
          key={step.kind === 'crowd' ? `${step.puja.id}-crowd` : step.puja.id}
          className="jg-visit-bar"
          style={{ bottom }}
          role="dialog"
          aria-live="polite"
          aria-label={
            step.kind === 'ask'
              ? 'Are you visiting this puja?'
              : late
                ? `Have you visited this puja?${late.total > 1 ? ` ${late.i + 1} of ${late.total}` : ''}`
                : 'Crowd report'
          }
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12 }}
          animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: 12 }}
          transition={{ duration: 0.2 }}
        >
          <div className="jg-visit-head">
            <p className="jg-visit-q">
              {step.kind === 'ask' && (
                <>
                  Are you visiting <strong>{step.puja.n}</strong>?
                </>
              )}
              {late && (
                <>
                  Have you visited <strong>{step.puja.n}</strong>?
                </>
              )}
              {step.kind === 'crowd' && 'How is the crowd right now?'}
            </p>
            <button
              type="button"
              className="jg-visit-x"
              aria-label={step.kind === 'crowd' ? 'Skip crowd report' : 'Close, ask me later'}
              onClick={step.kind === 'crowd' ? onSkip : onClose}
            >
              <Icon name="x" size={20} />
            </button>
          </div>
          {late && <p className="jg-visit-sub">{late.line}</p>}
          <div className="jg-visit-btns">
            {step.kind === 'crowd' ? (
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
            ) : (
              <>
                <button type="button" className="jg-visit-btn" onClick={onNo} disabled={busy}>
                  No
                </button>
                <button type="button" className="jg-visit-btn" onClick={onYes} disabled={busy}>
                  Yes
                </button>
              </>
            )}
          </div>
          {late && late.total > 1 && (
            <div className="jg-visit-dots" aria-hidden="true">
              {Array.from({ length: late.total }, (_, k) => (
                <i key={k} className={k === late.i ? 'cur' : k < late.i ? 'past' : ''} />
              ))}
            </div>
          )}
        </motion.section>
      )}
    </AnimatePresence>
  );
}

/**
 * The first-time question, as a card at the top of the puja list (never over the map): "Are you visiting Chandannagar?"
 * Both answers are plain statements, so a local never has to press "No".
 * @param {{ onLocal: () => void, onVisitor: () => void, onSkip: () => void }} props
 */
export function WhoCard({ onLocal, onVisitor, onSkip }) {
  return (
    <section className="jg-who-card" aria-label="Are you visiting Chandannagar?">
      <div className="jg-visit-head">
        <div className="jg-who-q">
          <p className="jg-visit-q">Are you visiting Chandannagar?</p>
          <p className="jg-meta">Mankundu and Bhadreswar count as home.</p>
        </div>
        <button type="button" className="jg-visit-x" aria-label="Not now" onClick={onSkip}>
          <Icon name="x" size={20} />
        </button>
      </div>
      <div className="jg-visit-btns">
        <button type="button" className="jg-visit-btn" onClick={onVisitor}>
          I'm visiting
        </button>
        <button type="button" className="jg-visit-btn" onClick={onLocal}>
          I live here
        </button>
      </div>
    </section>
  );
}
