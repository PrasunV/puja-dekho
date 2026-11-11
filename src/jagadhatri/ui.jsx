import { AnimatePresence, motion, useDragControls, useReducedMotion } from 'motion/react';
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../components/ui/Icon.jsx';
import { formatRadius, pujas as pujaCount, search } from './lib.js';

/**
 * The person's Google photo, or their initials when there is none or it fails to load.
 * @param {{ user: { name: string, picture: string | null }, size?: number }} props
 */
export function Avatar({ user, size = 40 }) {
  const [broken, setBroken] = useState(false);
  const initials =
    user.name
      .split(/\s+/)
      // First letter of the first two words that start with a letter, so "Prasun (demo)" or "Ria 🌸" stay clean.
      .map((w) => w.match(/\p{L}/u)?.[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase() || '?';
  return (
    <span className="jg-face" style={{ width: size, height: size, fontSize: Math.round(size * 0.4) }} aria-hidden="true">
      {user.picture && !broken ? (
        <img src={user.picture} alt="" width={size} height={size} referrerPolicy="no-referrer" onError={() => setBroken(true)} />
      ) : (
        initials
      )}
    </span>
  );
}

const SHEET_EASE = /** @type {const} */ ([0.25, 1, 0.5, 1]);

/**
 * A choosing sheet (Puja type, Stations & ghats, More, the location question): a bottom sheet over a dimmed screen,
 * one level deep. Drag down, the handle, the close button, Escape or a tap on the dim closes it.
 * @param {{ open: boolean, title: string, onClose: () => void, footer?: import('react').ReactNode, children: import('react').ReactNode, strong?: boolean, label?: string, className?: string, onBodyScroll?: (e: import('react').UIEvent<HTMLDivElement>) => void }} props
 */
export function ModalSheet({ open, title, onClose, footer, children, strong = false, label, className = '', onBodyScroll }) {
  const reduce = useReducedMotion();
  const controls = useDragControls();
  const titleId = useId();
  const ref = useRef(/** @type {HTMLDivElement | null} */ (null));
  useEffect(() => {
    if (!open) return undefined;
    const back = /** @type {HTMLElement | null} */ (document.activeElement);
    const t = setTimeout(() => ref.current?.focus(), 30);
    const onKey = (/** @type {KeyboardEvent} */ e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(t);
      document.removeEventListener('keydown', onKey);
      back?.focus?.();
    };
  }, [open, onClose]);
  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="scrim"
            className={`jg-scrim${strong ? ' strong' : ''}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />
          <motion.div
            key="sheet"
            ref={ref}
            className={`jg-modal ${className}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-label={label}
            tabIndex={-1}
            initial={reduce ? { opacity: 0 } : { y: '100%' }}
            animate={reduce ? { opacity: 1 } : { y: 0 }}
            exit={reduce ? { opacity: 0 } : { y: '100%' }}
            transition={{ duration: 0.24, ease: SHEET_EASE }}
            drag={reduce ? false : 'y'}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            dragListener={false}
            dragControls={controls}
            onDragEnd={(_, info) => {
              if (info.offset.y > 90 || info.velocity.y > 600) onClose();
            }}
          >
            <DragHandle onClose={onClose} onPointerDown={(e) => controls.start(e)} />
            <div className="jg-modal-head">
              <h2 id={titleId} className="jg-title">
                {title}
              </h2>
              <button type="button" className="jg-icon-btn" aria-label="Close" onClick={onClose}>
                <Icon name="x" />
              </button>
            </div>
            <div className="jg-modal-body" onScroll={onBodyScroll}>
              {children}
            </div>
            {footer && <div className="jg-modal-foot">{footer}</div>}
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}

/** The handle at the top of a choosing sheet. Tap closes; it also works as the drag start. */
function DragHandle({ onClose, onPointerDown }) {
  return (
    <button type="button" className="jg-handle" aria-label="Close" onClick={onClose} onPointerDown={onPointerDown}>
      <span />
    </button>
  );
}

/**
 * A row in a choosing sheet: name, secondary count, a tick when selected.
 * @param {{ label: string, count?: string, selected: boolean, onClick: () => void, disabled?: boolean, note?: string, icon?: import('../components/ui/Icon.jsx').IconName }} props
 */
export function ChoiceRow({ label, count, selected, onClick, disabled = false, note, icon }) {
  return (
    <button type="button" className="jg-choice" aria-pressed={selected} onClick={onClick} disabled={disabled}>
      {icon && <Icon name={icon} size={20} />}
      <span className="jg-choice-text">
        <span className="jg-choice-label">{label}</span>
        {(count != null || note) && <span className="jg-choice-count">{note ?? count}</span>}
      </span>
      <span className="jg-choice-tick" aria-hidden="true">
        {selected && <Icon name="check" size={20} />}
      </span>
    </button>
  );
}

/**
 * The radius trigger "500 m ▾" and its menu (design 7.10): each option with its count, rows 44 visual in a 48 hit.
 * The menu opens under the trigger in a portal, so the sheet's scroll never clips it; a tap outside closes it.
 * @param {{ radius: number, steps: readonly number[], counts: Record<number, number>, onChange: (m: number) => void }} props
 */
export function RadiusTrigger({ radius, steps, counts, onChange }) {
  const [open, setOpen] = useState(false);
  const [box, setBox] = useState(/** @type {{ left: number, top: number } | null} */ (null));
  const button = useRef(/** @type {HTMLButtonElement | null} */ (null));
  const menu = useRef(/** @type {HTMLUListElement | null} */ (null));
  const id = useId();
  useLayoutEffect(() => {
    if (!open || !button.current) return;
    const r = button.current.getBoundingClientRect();
    const below = r.bottom + 4;
    const height = steps.length * 48 + 8;
    const top = below + height > window.innerHeight - 8 ? Math.max(8, r.top - 4 - height) : below;
    setBox({ left: Math.max(8, Math.min(r.left, window.innerWidth - 196)), top });
  }, [open, steps.length]);
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (/** @type {PointerEvent} */ e) => {
      const t = /** @type {Node} */ (e.target);
      if (!menu.current?.contains(t) && !button.current?.contains(t)) setOpen(false);
    };
    const onKey = (/** @type {KeyboardEvent} */ e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpen(false);
        button.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [open]);
  return (
    <>
      <button
        ref={button}
        type="button"
        className="jg-radius"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={id}
        aria-label={`Distance: ${formatRadius(radius)}. Change distance`}
        onClick={() => setOpen((o) => !o)}
      >
        {formatRadius(radius)}
        <Icon name="chevron" size={16} />
      </button>
      {open &&
        box &&
        createPortal(
          <ul ref={menu} id={id} className="jg-menu" role="listbox" style={{ left: box.left, top: box.top }}>
            {steps.map((m) => (
              <li key={m} role="option" aria-selected={m === radius}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(m);
                    setOpen(false);
                    button.current?.focus();
                  }}
                >
                  <span className="jg-menu-label">{formatRadius(m)}</span>
                  <span className="jg-menu-count">{pujaCount(counts[m] ?? 0)}</span>
                  {m === radius && <Icon name="check" size={16} />}
                </button>
              </li>
            ))}
          </ul>,
          document.body,
        )}
    </>
  );
}

/**
 * The floating search bar and its panel (design 7.1, 7.2): favicon (opens About), the field, a search icon or a cross,
 * and the profile avatar beside it. The panel has two tabs, Pujas and Ghat & Stations.
 *
 * @param {object} props
 * @param {import('./lib.js').JgPuja[]} props.popular
 * @param {import('./lib.js').JgStation[]} props.stations
 * @param {ReturnType<typeof import('./lib.js').makeIndex>} props.pujaIndex
 * @param {ReturnType<typeof import('./lib.js').makeIndex>} props.stationIndex
 * @param {{ name: string } | null} props.picked
 * @param {boolean} props.open
 * @param {(open: boolean) => void} props.onOpen
 * @param {(kind: 'puja' | 'station', id: string) => void} props.onPick
 * @param {() => void} props.onClear
 * @param {() => void} props.onAbout
 * @param {() => void} props.onProfile
 * @param {() => void} props.onSeePopular
 * @param {{ name: string, picture: string | null } | null} [props.user]  Signed-in person, shown as their photo
 * @param {import('react').Ref<HTMLDivElement>} [props.rowRef]  Measured so the full sheet can stop under it
 */
export function SearchBar({
  popular,
  stations,
  pujaIndex,
  stationIndex,
  picked,
  open,
  onOpen,
  onPick,
  onClear,
  onAbout,
  onProfile,
  onSeePopular,
  user = null,
  rowRef,
}) {
  const [text, setText] = useState('');
  const [tab, setTab] = useState(/** @type {'pujas' | 'stations'} */ ('pujas'));
  const input = useRef(/** @type {HTMLInputElement | null} */ (null));
  const listId = useId();
  const typing = text.trim().length > 0;
  const results = useMemo(
    () => (typing ? search(/** @type {any} */ (tab === 'pujas' ? pujaIndex : stationIndex), text, 5) : []),
    [typing, tab, text, pujaIndex, stationIndex],
  );
  const placeholder = tab === 'pujas' ? 'Search Bagbazar' : 'Search Rani Ghat';

  // Closing the panel clears what was typed.
  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (!open) setText('');
  }

  const pick = (/** @type {'puja' | 'station'} */ kind, /** @type {string} */ id) => {
    input.current?.blur();
    onPick(kind, id);
  };

  return (
    <div className="jg-search-wrap">
      <div className="jg-search-row" ref={rowRef}>
        <div className={`jg-search${open ? ' open' : ''}`}>
          <button type="button" className="jg-fav" aria-label="About Puja Dekho" onClick={onAbout}>
            <img src="/icon.svg" width="36" height="36" alt="" />
          </button>
          {picked && !open ? (
            <button type="button" className="jg-search-picked" onClick={() => onOpen(true)}>
              {picked.name}
            </button>
          ) : (
            <input
              ref={input}
              type="search"
              className="jg-search-input"
              value={text}
              placeholder={placeholder}
              aria-label={tab === 'pujas' ? 'Search pujas' : 'Search stations and ghats'}
              autoComplete="off"
              enterKeyHint="search"
              role="combobox"
              aria-expanded={open}
              aria-controls={listId}
              onFocus={() => onOpen(true)}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && results[0]) pick(tab === 'pujas' ? 'puja' : 'station', /** @type {any} */ (results[0]).id);
                if (e.key === 'Escape') {
                  input.current?.blur();
                  onOpen(false);
                }
              }}
            />
          )}
          {picked && !open ? (
            <button type="button" className="jg-icon-btn" aria-label={`Clear ${picked.name}`} onClick={onClear}>
              <Icon name="x" />
            </button>
          ) : typing ? (
            <button
              type="button"
              className="jg-icon-btn"
              aria-label="Clear search text"
              onClick={() => {
                setText('');
                input.current?.focus();
              }}
            >
              <Icon name="x" />
            </button>
          ) : (
            <span className="jg-search-ic" aria-hidden="true">
              <Icon name="search" />
            </span>
          )}
        </div>
        <button type="button" className="jg-avatar" aria-label={user ? 'Your profile' : 'Sign in'} onClick={onProfile}>
          {user ? <Avatar user={user} size={40} /> : <Icon name="user" />}
        </button>
      </div>

      {open && (
        <div className="jg-search-panel" id={listId}>
          <div className="jg-tabs" role="tablist" aria-label="Search in">
            {[
              ['pujas', 'Pujas'],
              ['stations', 'Ghat & Stations'],
            ].map(([k, label]) => (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={tab === k}
                className="jg-tab"
                onClick={() => {
                  setTab(/** @type {any} */ (k));
                  input.current?.focus();
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {!typing && tab === 'pujas' && (
            <>
              <p className="jg-label">Popular pujas</p>
              {popular.map((p) => (
                <SuggestionRow key={p.id} title={p.n} meta={p.t} icon="pin" onPick={() => pick('puja', p.id)} onCopy={() => setText(p.n)} />
              ))}
            </>
          )}
          {!typing && tab === 'stations' && (
            <>
              {['station', 'ghat'].map((kind) => (
                <div key={kind}>
                  <p className="jg-label">{kind === 'station' ? 'Stations' : 'Ghats'}</p>
                  <div className="jg-chip-wrap">
                    {stations
                      .filter((s) => s.kind === kind)
                      .map((s) => (
                        <button key={s.id} type="button" className="chip compact jg-chip" onClick={() => pick('station', s.id)}>
                          <Icon name={kind === 'ghat' ? 'boat' : 'train'} size={16} />
                          {s.name}
                        </button>
                      ))}
                  </div>
                </div>
              ))}
            </>
          )}
          {typing && results.length > 0 && (
            <div role="listbox" aria-label="Suggestions">
              {results.map((r) => {
                const item = /** @type {any} */ (r);
                return tab === 'pujas' ? (
                  <SuggestionRow
                    key={item.id}
                    title={item.n}
                    meta={item.t}
                    icon="pin"
                    onPick={() => pick('puja', item.id)}
                    onCopy={() => setText(item.n)}
                  />
                ) : (
                  <SuggestionRow
                    key={item.id}
                    title={item.name}
                    meta={item.kind === 'ghat' ? 'Ferry ghat' : 'Railway station'}
                    icon={item.kind === 'ghat' ? 'boat' : 'train'}
                    onPick={() => pick('station', item.id)}
                    onCopy={() => setText(item.name)}
                  />
                );
              })}
            </div>
          )}
          {typing && results.length === 0 && (
            <div className="jg-empty" role="status">
              <p>{`No ${tab === 'pujas' ? 'pujas' : 'stations or ghats'} match ‘${text.trim()}’.`}</p>
              <button
                type="button"
                className="btn dark small"
                onClick={() => {
                  input.current?.blur();
                  onSeePopular();
                }}
              >
                See popular pujas
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SuggestionRow({ title, meta, icon, onPick, onCopy }) {
  return (
    <div className="jg-suggest">
      <button type="button" className="jg-suggest-main" role="option" aria-selected="false" onClick={onPick}>
        <span className="jg-suggest-ic" aria-hidden="true">
          <Icon name={icon} size={20} />
        </span>
        <span className="jg-suggest-text">
          <span className="jg-suggest-title">{title}</span>
          <span className="jg-suggest-meta">{meta}</span>
        </span>
      </button>
      <button type="button" className="jg-icon-btn jg-copy" aria-label={`Put ${title} in the search box`} onClick={onCopy}>
        <Icon name="arrowNE" size={20} />
      </button>
    </div>
  );
}
