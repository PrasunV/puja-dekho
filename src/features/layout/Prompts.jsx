import { useState } from 'react';
import { motion } from 'motion/react';
import { Dot } from '../../components/ui/Dot.jsx';
import { CLOSURE_KINDS } from '../../lib/pujas.js';

const SLIDE = { initial: { opacity: 0, y: 30 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: 30 } };

/**
 * "Is it crowded right now?" card shown after the person has stayed near a puja for a while.
 * @param {{ puja: import('../../lib/types.js').Puja, levels: readonly import('../../lib/types.js').QueueLevel[], onAnswer: (level: number) => void, onDismiss: () => void }} props
 */
export function CrowdPrompt({ puja, levels, onAnswer, onDismiss }) {
  return (
    <motion.div className="prompt" role="dialog" aria-label="Queue question" {...SLIDE}>
      <div className="stack tight">
        <h3>Is {puja.n} crowded right now?</h3>
        <div className="sub">You have been here a while. One tap helps the next person plan.</div>
        <div className="levels">
          {levels.map((level) => (
            <button key={level.n} type="button" className="level" onClick={() => onAnswer(level.n)}>
              <Dot tone={`q${level.n}`} />
              {level.label}
            </button>
          ))}
        </div>
        <button type="button" className="btn small" onClick={onDismiss}>
          Not now
        </button>
      </div>
    </motion.div>
  );
}

/**
 * "What is happening here?" card shown after the person taps a spot in road-report mode.
 * @param {{ onSend: (type: string, note: string) => void, onCancel: () => void }} props
 */
export function RoadPrompt({ onSend, onCancel }) {
  const [note, setNote] = useState('');
  return (
    <motion.div className="prompt" role="dialog" aria-label="Report a road" {...SLIDE}>
      <div className="stack tight">
        <h3>What is happening here?</h3>
        <div className="levels">
          {Object.entries(CLOSURE_KINDS).map(([type, [label, glyph]]) => (
            <button key={type} type="button" className="level" onClick={() => onSend(type, note)}>
              <b>{glyph}</b>
              {label}
            </button>
          ))}
        </div>
        <input
          type="text"
          maxLength={80}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Optional: which road, which direction"
          aria-label="Note"
        />
        <button type="button" className="btn small" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </motion.div>
  );
}
