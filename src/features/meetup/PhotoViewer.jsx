import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../../components/ui/Icon.jsx';

const MAX_ZOOM = 4;
const clamp = (/** @type {number} */ v, /** @type {number} */ lo, /** @type {number} */ hi) => Math.min(hi, Math.max(lo, v));

/**
 * One slide: the photo, which can be pinched (two fingers), double-tapped, dragged when zoomed, and wheel-zoomed.
 * The view is a scale and an offset applied straight to the image so it follows the fingers without re-rendering.
 */
function Slide({ photo, active, onZoom }) {
  const img = useRef(/** @type {HTMLImageElement | null} */ (null));
  const view = useRef({ s: 1, x: 0, y: 0 });
  const pts = useRef(new Map());
  const start = useRef({ dist: 0, s: 1, x: 0, y: 0, cx: 0, cy: 0 });
  const lastTap = useRef(0);

  const apply = useCallback(
    (animate = false) => {
      const el = img.current;
      if (!el) return;
      const v = view.current;
      el.style.transition = animate ? 'transform 0.2s ease' : 'none';
      el.style.transform = `translate(${v.x}px, ${v.y}px) scale(${v.s})`;
      onZoom(v.s > 1.01);
    },
    [onZoom],
  );

  /** Keeps the photo from being dragged off the screen. */
  const limit = useCallback(() => {
    const el = img.current;
    const v = view.current;
    if (!el) return;
    const w = el.clientWidth * v.s;
    const h = el.clientHeight * v.s;
    const maxX = Math.max(0, (w - el.parentElement.clientWidth) / 2);
    const maxY = Math.max(0, (h - el.parentElement.clientHeight) / 2);
    v.x = clamp(v.x, -maxX, maxX);
    v.y = clamp(v.y, -maxY, maxY);
    if (v.s <= 1.01) {
      v.s = 1;
      v.x = 0;
      v.y = 0;
    }
  }, []);

  useEffect(() => {
    if (!active && view.current.s !== 1) {
      view.current = { s: 1, x: 0, y: 0 };
      apply();
    }
  }, [active, apply]);

  const zoomAt = (/** @type {number} */ s, /** @type {number} */ px, /** @type {number} */ py) => {
    const box = img.current?.parentElement?.getBoundingClientRect();
    if (!box) return;
    const v = view.current;
    const ox = px - (box.left + box.width / 2);
    const oy = py - (box.top + box.height / 2);
    const k = s / v.s;
    v.x = ox - (ox - v.x) * k;
    v.y = oy - (oy - v.y) * k;
    v.s = s;
    limit();
  };

  const down = (/** @type {import('react').PointerEvent} */ e) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const v = view.current;
    const list = [...pts.current.values()];
    start.current = {
      dist: list.length === 2 ? Math.hypot(list[0].x - list[1].x, list[0].y - list[1].y) : 0,
      s: v.s,
      x: v.x,
      y: v.y,
      cx: e.clientX,
      cy: e.clientY,
    };
    if (list.length === 1 && e.pointerType !== 'mouse') {
      const now = Date.now();
      if (now - lastTap.current < 280) {
        if (v.s > 1.01) {
          view.current = { s: 1, x: 0, y: 0 };
        } else zoomAt(2.5, e.clientX, e.clientY);
        apply(true);
        lastTap.current = 0;
      } else lastTap.current = now;
    }
  };

  const move = (/** @type {import('react').PointerEvent} */ e) => {
    if (!pts.current.has(e.pointerId)) return;
    pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const list = [...pts.current.values()];
    const v = view.current;
    if (list.length === 2 && start.current.dist) {
      const dist = Math.hypot(list[0].x - list[1].x, list[0].y - list[1].y);
      const mid = { x: (list[0].x + list[1].x) / 2, y: (list[0].y + list[1].y) / 2 };
      zoomAt(clamp((start.current.s * dist) / start.current.dist, 1, MAX_ZOOM), mid.x, mid.y);
      apply();
    } else if (list.length === 1 && v.s > 1.01) {
      v.x = start.current.x + (e.clientX - start.current.cx);
      v.y = start.current.y + (e.clientY - start.current.cy);
      limit();
      apply();
    }
  };

  const up = (/** @type {import('react').PointerEvent} */ e) => {
    pts.current.delete(e.pointerId);
    const list = [...pts.current.values()];
    if (list.length === 1) {
      const v = view.current;
      start.current = { ...start.current, dist: 0, s: v.s, x: v.x, y: v.y, cx: list[0].x, cy: list[0].y };
    }
    if (!pts.current.size) {
      limit();
      apply(true);
    }
  };

  return (
    <div
      className="pv-slide"
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      onDoubleClick={(e) => {
        if (e.nativeEvent.pointerType === 'touch') return;
        if (view.current.s > 1.01) view.current = { s: 1, x: 0, y: 0 };
        else zoomAt(2.5, e.clientX, e.clientY);
        apply(true);
      }}
      onWheel={(e) => {
        zoomAt(clamp(view.current.s * Math.exp(-e.deltaY / 400), 1, MAX_ZOOM), e.clientX, e.clientY);
        apply();
      }}
    >
      <img ref={img} src={photo.src} alt={photo.alt} draggable="false" data-testid="pv-img" />
    </div>
  );
}

/**
 * Full-screen photo viewer: swipe between photos, pinch or double-tap to zoom, X, Escape or the Back button to close.
 *
 * @param {{ photos: { src: string, alt: string }[], index: number, onClose: () => void }} props
 */
export default function PhotoViewer({ photos, index, onClose }) {
  const [at, setAt] = useState(index);
  const [zoomed, setZoomed] = useState(false);
  const track = useRef(/** @type {HTMLDivElement | null} */ (null));
  const closeRef = useRef(/** @type {HTMLButtonElement | null} */ (null));
  const closed = useRef(false);

  // Opens on the tapped photo.
  useEffect(() => {
    const el = track.current;
    if (el) el.scrollLeft = index * el.clientWidth;
  }, [index]);

  // The phone's Back button closes the viewer instead of leaving the meetup.
  useEffect(() => {
    history.pushState({ ...history.state, viewer: true }, '');
    const onPop = () => {
      closed.current = true;
      onClose();
    };
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
      if (!closed.current && history.state?.viewer) history.back();
    };
  }, [onClose]);

  useEffect(() => {
    const opener = /** @type {HTMLElement | null} */ (document.activeElement);
    closeRef.current?.focus();
    const key = (/** @type {KeyboardEvent} */ e) => {
      const el = track.current;
      if (e.key === 'Escape') onClose();
      else if (el && e.key === 'ArrowRight') el.scrollBy({ left: el.clientWidth, behavior: 'smooth' });
      else if (el && e.key === 'ArrowLeft') el.scrollBy({ left: -el.clientWidth, behavior: 'smooth' });
    };
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('keydown', key);
      opener?.focus?.();
    };
  }, [onClose]);

  return createPortal(
    <div className="pv" role="dialog" aria-modal="true" aria-label="Photo viewer" data-testid="photo-viewer">
      <div className="pv-top">
        <span className="pv-count num" aria-live="polite" data-testid="pv-count">
          {at + 1} / {photos.length}
        </span>
        <button ref={closeRef} type="button" className="pv-close" aria-label="Close photo" onClick={onClose} data-testid="pv-close">
          <Icon name="x" size={24} />
        </button>
      </div>
      <div
        ref={track}
        className={`pv-track${zoomed ? ' locked' : ''}`}
        onScroll={(e) => {
          const el = e.currentTarget;
          setAt(clamp(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)), 0, photos.length - 1));
        }}
      >
        {photos.map((photo, i) => (
          <Slide key={photo.src} photo={photo} active={i === at} onZoom={i === at ? setZoomed : () => {}} />
        ))}
      </div>
    </div>,
    document.body,
  );
}
