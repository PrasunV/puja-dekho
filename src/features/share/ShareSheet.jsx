import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../../components/ui/Icon.jsx';
import { shareLink, whatsappLink } from './shareItems.js';

function WhatsAppMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.700 6.700 0 0 1-3.300-2.900c-.2-.4.2-.4.700-1.200.1-.2 0-.3 0-.5l-.8-1.800c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.300 3 3 0 0 0-.9 2.200 5.300 5.300 0 0 0 1.100 2.800 12 12 0 0 0 4.600 4c1.700.7 2.400.8 3.200.7.500-.1 1.500-.6 1.700-1.200.2-.6.2-1.100.2-1.200-.1-.1-.3-.2-.5-.3Z"
      />
    </svg>
  );
}

/**
 * The share sheet: a picture and title the way the link will look in a chat, and two buttons.
 * It opens from a long press or the small share icon, and closes by Close, swipe down, tapping outside, or Escape.
 * @param {{ item: import('./shareItems.js').ShareItem | null, onClose: () => void }} props
 */
export default function ShareSheet({ item, onClose }) {
  const [copied, setCopied] = useState(/** @type {'idle' | 'ok' | 'fail'} */ ('idle'));
  const firstButton = useRef(/** @type {HTMLAnchorElement | null} */ (null));
  const [broken, setBroken] = useState(false);
  useEffect(() => {
    setCopied('idle');
    setBroken(false);
    if (!item) return undefined;
    const previous = document.activeElement;
    const frame = requestAnimationFrame(() => firstButton.current?.focus());
    const onKey = (/** @type {KeyboardEvent} */ event) => event.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('keydown', onKey);
      if (previous instanceof HTMLElement) previous.focus();
    };
  }, [item, onClose]);
  useEffect(() => {
    if (copied === 'idle') return undefined;
    const timer = setTimeout(() => setCopied('idle'), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shareLink(item, 'cp'));
      setCopied('ok');
    } catch {
      setCopied('fail');
    }
  };

  return createPortal(
    <AnimatePresence>
      {item && (
        <motion.div className="share-root" key="share" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
          <div className="share-scrim" data-testid="share-scrim" onClick={onClose} />
          <motion.section
            className="share-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="share-h"
            data-testid="share-sheet"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'tween', ease: [0.25, 1, 0.5, 1], duration: 0.26 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, info) => (info.offset.y > 80 || info.velocity.y > 500) && onClose()}
          >
            <div className="share-grab" aria-hidden="true" />
            <div className="share-head">
              <h2 id="share-h">{item.sheetTitle}</h2>
              <button type="button" className="back back-btn" aria-label="Close" onClick={onClose}>
                <Icon name="x" size={22} />
              </button>
            </div>
            <div className="share-preview" data-testid="share-preview">
              <div className="share-img">{!broken && <img src={item.image} alt="" onError={() => setBroken(true)} />}</div>
              <div className="share-meta">
                <b className="share-title">{item.previewTitle}</b>
                <span className="share-sub">{item.previewSub}</span>
                <span className="share-site">puja-dekho.vercel.app</span>
              </div>
            </div>
            <p className="share-msg">{item.message}</p>
            <div className="share-actions">
              <a ref={firstButton} className="btn share-wa" href={whatsappLink(item)} target="_blank" rel="noopener noreferrer" onClick={() => setTimeout(onClose, 150)}>
                Post on
                <WhatsAppMark />
              </a>
              <button type="button" className="btn share-copy" onClick={copy} aria-live="polite">
                {copied === 'ok' ? 'Link copied' : copied === 'fail' ? "Couldn't copy" : 'Copy link'}
                <Icon name="copy" size={18} />
              </button>
            </div>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
