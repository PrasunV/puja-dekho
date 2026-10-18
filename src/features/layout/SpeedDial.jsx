import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Icon } from '../../components/ui/Icon.jsx';

/**
 * Speed-dial button, the same pattern as the Google Drive "+": tap to fan out the actions,
 * tap again (or the dimmed map, or Escape) to close.
 *
 * @param {{ bottom: string | number, tourCount: number, view: string, onMetro: () => void, onTour: () => void }} props
 */
export default function SpeedDial({ bottom, tourCount, view, onMetro, onTour }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onKey = (event) => event.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  /** @type {{ key: string, label: string, icon: import('../../components/ui/Icon.jsx').IconName, active: boolean, run: () => void }[]} */
  const actions = [
    { key: 'metro', label: 'Metro nearby', icon: 'train', active: view === 'metro', run: onMetro },
    { key: 'tour', label: tourCount ? `Plan a tour (${tourCount})` : 'Plan a tour', icon: 'route', active: view === 'tour', run: onTour },
  ];
  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            className="dial-scrim"
            onClick={() => setOpen(false)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
        )}
      </AnimatePresence>
      <div className="dial" style={{ bottom }}>
        <AnimatePresence>
          {open &&
            actions
              .map((action, index) => (
                <motion.div
                  key={action.key}
                  className="dial-item"
                  initial={{ opacity: 0, y: 18, scale: 0.85 }}
                  animate={{ opacity: 1, y: 0, scale: 1, transition: { delay: index * 0.05, type: 'spring', stiffness: 420, damping: 26 } }}
                  exit={{ opacity: 0, y: 12, scale: 0.9, transition: { duration: 0.1 } }}
                >
                  <span className="dial-label">{action.label}</span>
                  <button
                    type="button"
                    className={`fab dial-mini${action.active ? ' on' : ''}`}
                    aria-label={action.label}
                    onClick={() => {
                      setOpen(false);
                      action.run();
                    }}
                  >
                    <Icon name={action.icon} />
                  </button>
                </motion.div>
              ))
              .reverse()}
        </AnimatePresence>
        <motion.button
          type="button"
          className="dial-main"
          aria-label={open ? 'Close menu' : 'Open menu: metro and tour'}
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
          whileTap={{ scale: 0.92 }}
        >
          <motion.span
            className="dial-icon"
            animate={{ rotate: open ? 135 : 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 22 }}
          >
            <Icon name="plus" size={26} />
          </motion.span>
          {!open && tourCount > 0 && <span className="dial-count">{tourCount}</span>}
        </motion.button>
      </div>
    </>
  );
}
