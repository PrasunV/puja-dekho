import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../components/ui/Icon.jsx';

/** @typedef {{ id: string, name: string, icon: 'train' | 'boat' | 'locate', note?: string, disabled?: boolean }} PickOption */

/** Rows are 48 high. The list (220 px in the CSS) shows four and a 28 px peek of the fifth, so the cut-off row says there is more. */
const ROW = 48;
const MENU_MIN = 232;
const GAP = 8;

/**
 * Anchored picker (design 7.22): a row showing the current choice that opens a small menu right under it. The menu has
 * a quiet question, plain rows and a tick on the picked one. It sits in a portal, so the sheet never clips it or
 * scrolls because of it, and opens above the row when there is no room below. Only its list scrolls.
 * @param {{ label: string, question: string, value: string, options: PickOption[], onPick: (id: string) => void }} props
 */
export function PickerField({ label, question, value, options, onPick }) {
  const [open, setOpen] = useState(false);
  const [box, setBox] = useState(/** @type {{ left: number, top: number, width: number } | null} */ (null));
  const trigger = useRef(/** @type {HTMLButtonElement | null} */ (null));
  const menu = useRef(/** @type {HTMLDivElement | null} */ (null));
  /** Under the row, right-aligned to it; above the row when the menu does not fit below. */
  const place = useCallback(() => {
    const t = trigger.current;
    const m = menu.current;
    if (!t || !m) return;
    const r = t.getBoundingClientRect();
    const width = Math.min(window.innerWidth - 2 * GAP, Math.max(MENU_MIN, r.width - 48));
    const left = Math.max(GAP, Math.min(r.right - width, window.innerWidth - GAP - width));
    const h = m.offsetHeight;
    const below = r.bottom - GAP;
    const fitsBelow = below + h <= window.innerHeight - GAP;
    const above = r.top + GAP - h;
    setBox({ left, width, top: fitsBelow || above < GAP ? below : above });
  }, []);

  /** Measure the menu as it mounts, so it opens in the right place with no jump. */
  const menuRef = useCallback(
    (/** @type {HTMLDivElement | null} */ node) => {
      menu.current = node;
      if (node) place();
    },
    [place],
  );
  const list = useRef(/** @type {HTMLUListElement | null} */ (null));
  const id = useId();
  const current = options.find((o) => o.id === value) ?? options[0];

  /** Fade only on an edge that has more rows behind it. */
  const fade = () => {
    const l = list.current;
    if (!l) return;
    const max = l.scrollHeight - l.clientHeight;
    l.toggleAttribute('data-more-above', l.scrollTop > 2);
    l.toggleAttribute('data-more-below', max - l.scrollTop > 2);
  };

  // Once placed: bring the picked row into view, focus it, and set the fades.
  const placed = box != null;
  useEffect(() => {
    if (!open || !placed) return;
    const l = list.current;
    const picked = /** @type {HTMLElement | null} */ (l?.querySelector('[aria-selected="true"] button'));
    if (l && picked && picked.offsetTop + ROW > l.clientHeight) l.scrollTop = Math.max(0, picked.offsetTop - 2 * ROW);
    (picked ?? /** @type {HTMLElement | null} */ (l?.querySelector('button:not(:disabled)')))?.focus({ preventScroll: true });
    fade();
  }, [open, placed]);

  useEffect(() => {
    if (!open) return undefined;
    const close = (/** @type {boolean} */ refocus) => {
      setOpen(false);
      if (refocus) trigger.current?.focus();
    };
    const onDown = (/** @type {PointerEvent} */ e) => {
      const t = /** @type {Node} */ (e.target);
      if (!menu.current?.contains(t) && !trigger.current?.contains(t)) close(false);
    };
    const onKey = (/** @type {KeyboardEvent} */ e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        close(true);
      } else if (e.key === 'Tab') close(false);
      else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        const rows = /** @type {HTMLElement[]} */ ([...(list.current?.querySelectorAll('button:not(:disabled)') ?? [])]);
        if (!rows.length) return;
        e.preventDefault();
        const i = rows.indexOf(/** @type {HTMLElement} */ (document.activeElement));
        const next = rows[(i + (e.key === 'ArrowDown' ? 1 : -1) + rows.length) % rows.length];
        next.focus({ preventScroll: true });
        const l = /** @type {HTMLElement} */ (list.current);
        if (next.offsetTop < l.scrollTop) l.scrollTop = next.offsetTop;
        else if (next.offsetTop + ROW > l.scrollTop + l.clientHeight) l.scrollTop = next.offsetTop + ROW - l.clientHeight;
      }
    };
    const onMove = () => place();
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey, true);
    window.addEventListener('resize', onMove);
    window.addEventListener('scroll', onMove, true);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey, true);
      window.removeEventListener('resize', onMove);
      window.removeEventListener('scroll', onMove, true);
    };
  }, [open, place]);

  return (
    <>
      <button
        ref={trigger}
        type="button"
        className="jg-pick"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => {
          setBox(null);
          setOpen((o) => !o);
        }}
      >
        <span className="jg-pick-label">{label}</span>
        <span className="jg-pick-value">
          <Icon name={current.icon} size={18} />
          <span className="jg-pick-text">{current.name}</span>
        </span>
        <Icon name="chevron" size={20} />
      </button>
      {open &&
        createPortal(
          <div
            ref={menuRef}
            className="jg-pick-menu"
            style={box ? { left: box.left, top: box.top, width: box.width } : { left: 0, top: 0, visibility: 'hidden' }}
          >
            <p className="jg-pick-q" aria-hidden="true">
              {question}
            </p>
            <ul ref={list} id={id} className="jg-pick-list" role="listbox" aria-label={label} onScroll={fade}>
              {options.map((o) => (
                <li key={o.id} role="option" aria-selected={o.id === value}>
                  <button
                    type="button"
                    disabled={o.disabled}
                    onClick={() => {
                      onPick(o.id);
                      setOpen(false);
                      trigger.current?.focus();
                    }}
                  >
                    <span className="jg-pick-row-text">
                      {o.name}
                      {o.note && <span className="jg-pick-note">{` · ${o.note}`}</span>}
                    </span>
                    {o.id === value && <Icon name="check" size={16} />}
                  </button>
                </li>
              ))}
            </ul>
          </div>,
          document.body,
        )}
    </>
  );
}
