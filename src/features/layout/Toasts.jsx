import { AnimatePresence, motion } from 'motion/react';
import { useToastList } from '../../context/ToastContext.jsx';

/** Transient messages. A polite live region, so screen readers announce them without interrupting. */
export default function Toasts() {
  const toasts = useToastList();
  return (
    <div className="toasts" role="status" aria-live="polite">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            className={`toast ${toast.kind}`}
            layout
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8 }}
          >
            <span>{toast.message}</span>
            {toast.action && (
              <button type="button" className="toast-action" onClick={toast.action.onClick}>
                {toast.action.label}
              </button>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
