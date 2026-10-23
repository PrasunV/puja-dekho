import { motion } from 'motion/react';
import { Icon } from '../../components/ui/Icon.jsx';
import GreetingMedia from '../greeting/GreetingMedia.jsx';
import { bhasanActive } from '../../data/bhasan.js';

/**
 * A short explainer shown before the browser's own location prompt (PRD flow A). The browser prompt can
 * only be shown once, so we say why first and let the person say "Not now" without spending it.
 * @param {{ onAllow: () => void, onLater: () => void }} props
 */
export default function Explainer({ onAllow, onLater }) {
  // The Bijoya wish runs while the Bhasan special does (to the end of 24 Oct 2026, India time); after that, the regular words.
  const bijoya = bhasanActive();
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
          <GreetingMedia
            slot="explainer"
            fallback={
              <span className="explainer-icon" aria-hidden="true">
                <Icon name="myloc" size={32} />
              </span>
            }
          />
          <h2 id="ex-title">{bijoya ? 'Shubho Bijoya!' : 'See pujas near you'}</h2>
          <p>
            {bijoya
              ? 'Wishing you joy and sweet moments this Bijoya. Turn on your location to see the pujas near you and the pandals people visited in 2026. Your location stays on your phone.'
              : 'Turn on your location to see the pujas close to you and how far each one is. Your location stays on your phone.'}
          </p>
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
