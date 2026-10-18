import { motion } from 'motion/react';
import { Icon } from '../../components/ui/Icon.jsx';

/**
 * Shown once, the first time someone opens the app from outside Kolkata: how many pujas the city has and
 * how far away they are. After that a small banner in the sheet carries the same message.
 * @param {{ km: number, count: number, onClose: () => void, onShowKolkata: () => void }} props
 */
export default function OutsideCard({ km, count, onClose, onShowKolkata }) {
  return (
    <motion.div className="sheet-scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div
        className="sheet explainer outside"
        role="dialog"
        aria-modal="true"
        aria-labelledby="out-title"
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 60, opacity: 0 }}
      >
        <div className="explainer-body">
          <span className="explainer-icon" aria-hidden="true">
            <Icon name="myloc" size={32} />
          </span>
          <h2 id="out-title">{count} pujas in Kolkata</h2>
          <p>
            You are about {km} km from the city, so distances and “near me” are switched off. The map shows Kolkata and where you are.
            Browse the pujas by area or metro station.
          </p>
        </div>
        <div className="sheet-foot stacked">
          {/* eslint-disable-next-line jsx-a11y/no-autofocus -- a modal dialog moves focus to its main action */}
          <button type="button" className="btn dark block" autoFocus onClick={onShowKolkata}>
            Show Kolkata
          </button>
          <button type="button" className="btn text" onClick={onClose}>
            Keep both in view
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
