import { useEffect, useRef, useState } from 'react';
import { BASE, SHARE_MESSAGE, SITE_URL } from './config.js';
import LazyImage from './loader/LazyImage.jsx';
import { createReveal } from './shareReveal.js';
import { ModalSheet } from './ui.jsx';

const LABEL = 'Share with friends';
const CARD_URL = `${BASE}/share-card.jpg`;

/** True once the splash is gone (it hides itself and announces it). */
export function useSplashGone() {
  const [gone, setGone] = useState(() => !document.getElementById('pd-splash'));
  useEffect(() => {
    const onGone = () => setGone(true);
    window.addEventListener('pd-splash-gone', onGone);
    return () => window.removeEventListener('pd-splash-gone', onGone);
  }, []);
  return gone;
}

/** True while any modal dialog is open (sheets, the welcome card, the badge screens). They all mount on <body>. */
export function useAnyModalOpen() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const check = () => setOpen(document.querySelector('[role="dialog"][aria-modal="true"]') != null);
    check();
    const watch = new MutationObserver(check);
    watch.observe(document.body, { childList: true });
    return () => watch.disconnect();
  }, []);
  return open;
}

/**
 * Drives the share button. `blocked` is true while the person is busy with the map, the sheet, search or another sheet.
 * @param {boolean} ready
 * @param {boolean} blocked
 */
export function useShareReveal(ready, blocked) {
  const [state, setState] = useState({ shown: false, expanded: false });
  const control = useRef(/** @type {ReturnType<typeof createReveal> | null} */ (null));
  useEffect(() => {
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const c = createReveal({ onChange: setState, reduced });
    control.current = c;
    return () => c.destroy();
  }, []);
  useEffect(() => control.current?.setReady(ready), [ready]);
  useEffect(() => control.current?.setBlocked(blocked), [blocked]);
  return state;
}

function ShareIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="M8.6 10.5l6.8-4M8.6 13.5l6.8 4" />
    </svg>
  );
}

/**
 * The share button above the location button: the icon, or the icon with its words.
 * @param {{ reveal: { shown: boolean, expanded: boolean }, onOpen: () => void }} props
 */
export function ShareFab({ reveal, onOpen }) {
  return (
    <button
      type="button"
      className="jg-sharefab"
      data-shown={reveal.shown || undefined}
      data-expanded={reveal.expanded || undefined}
      aria-label={LABEL}
      {...(!reveal.shown && { inert: '' })}
      onClick={onOpen}
    >
      <span className="jg-sharefab-label" aria-hidden="true">
        <span>
          <span>{LABEL}</span>
        </span>
      </span>
      <span className="jg-sharefab-ic">
        <ShareIcon />
      </span>
    </button>
  );
}

const textOf = () => `${SHARE_MESSAGE}\n${SITE_URL}`;

/** @param {Blob} blob @param {string} name */
function download(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

const Svg = (/** @type {{ children: import('react').ReactNode }} */ { children }) => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {children}
  </svg>
);

/**
 * The sheet behind the share button: the card, the message that goes with it, and where to send it.
 * @param {{ open: boolean, online: boolean, onClose: () => void, toast: (t: string) => void }} props
 */
export function ShareSheet({ open, online, onClose, toast }) {
  const [busy, setBusy] = useState(false);
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  const run = async (/** @type {() => Promise<void>} */ fn) => {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
      onClose();
    } catch (e) {
      if (/** @type {any} */ (e)?.name !== 'AbortError') toast("Couldn't share. Try Copy link instead");
    } finally {
      setBusy(false);
    }
  };
  const card = async () => {
    const res = await fetch(CARD_URL);
    if (!res.ok) throw new Error('no_card');
    return new File([await res.blob()], 'puja-dekho-jagadhatri-puja-26.jpg', { type: 'image/jpeg' });
  };

  const onWhatsApp = () =>
    run(async () => {
      window.open(`https://wa.me/?text=${encodeURIComponent(textOf())}`, '_blank', 'noopener');
    });
  const onCopy = () =>
    run(async () => {
      await navigator.clipboard.writeText(SITE_URL);
      toast('Link copied');
    });
  // The phone's own share menu: the card and the message together, or the message and link if the card can't go along.
  const onMore = () =>
    run(async () => {
      const text = textOf();
      try {
        const file = await card();
        if (navigator.canShare?.({ files: [file], text })) return await navigator.share({ files: [file], text });
      } catch (e) {
        if (/** @type {any} */ (e)?.name === 'AbortError') throw e;
      }
      return await navigator.share({ text: SHARE_MESSAGE, url: SITE_URL });
    });
  const onSave = () =>
    run(async () => {
      const file = await card();
      download(file, file.name);
      toast('Image downloaded');
    });

  return (
    <ModalSheet open={open} title={LABEL} onClose={onClose} className="jg-share-sheet">
      <div className="jg-sharesheet">
        <div className="jg-sharecard">
          <LazyImage src={CARD_URL} alt="Puja Dekho, Jagadhatri Puja’26 guide map" width="1200" height="630" />
        </div>
        <div className="jg-share-msg">
          <p className="jg-body">{SHARE_MESSAGE}</p>
          <p className="jg-caption">{SITE_URL.replace('https://', '')}</p>
        </div>
        <div className="jg-share-tiles" role="group" aria-label="Share to">
          <button type="button" className="jg-share-tile" onClick={onWhatsApp} disabled={!online || busy} data-autofocus>
            <Svg>
              <path d="M4 20l1.3-4A8 8 0 1 1 8 18.7L4 20z" />
            </Svg>
            WhatsApp
          </button>
          <button type="button" className="jg-share-tile" onClick={onCopy} disabled={busy}>
            <Svg>
              <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
            </Svg>
            Copy link
          </button>
          {canShare ? (
            <button type="button" className="jg-share-tile" onClick={onMore} disabled={!online || busy}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <circle cx="5" cy="12" r="2" />
                <circle cx="12" cy="12" r="2" />
                <circle cx="19" cy="12" r="2" />
              </svg>
              More
            </button>
          ) : (
            <button type="button" className="jg-share-tile" onClick={onSave} disabled={!online || busy}>
              <Svg>
                <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />
              </Svg>
              Save image
            </button>
          )}
        </div>
        {!online && <p className="jg-caption">You&apos;re offline. Copy the link now and share it later.</p>}
      </div>
    </ModalSheet>
  );
}
