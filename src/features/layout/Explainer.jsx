import { motion } from 'motion/react';
import { Icon } from '../../components/ui/Icon.jsx';

/**
 * A short explainer shown before the browser's own location prompt (PRD flow A). The browser prompt can
 * only be shown once, so we say why first and let the person say "Not now" without spending it.
 * @param {{ onAllow: () => void, onLater: () => void }} props
 */
export default function Explainer({ onAllow, onLater }) {
  return (
    <motion.div className="sheet-scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div
        className="sheet explainer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ex-title"
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 60, opacity: 0 }}
      >
        <div className="explainer-body">
          <span className="explainer-icon" aria-hidden="true">
            <Icon name="myloc" size={32} />
          </span>
          <h2 id="ex-title">See pujas around you</h2>
          <p>Allow your location to see the pujas close to where you are standing. It stays on your phone and is never sent anywhere.</p>
        </div>
        <div className="sheet-foot stacked">
          {/* eslint-disable-next-line jsx-a11y/no-autofocus -- a modal dialog moves focus to its main action */}
          <button type="button" className="btn dark block" autoFocus onClick={onAllow}>
            Allow
          </button>
          <button type="button" className="btn text" onClick={onLater}>
            Not now
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
