import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { useApp } from '../../context/AppContext.js';
import { Dot } from '../../components/ui/Dot.jsx';
import { Icon } from '../../components/ui/Icon.jsx';
import { RADIUS_STEPS } from '../../config.js';
// Less crowded chip is switched off for now (see the commented block in FilterBar below).
// import { CROWD_NOTE } from '../../lib/crowd.js';
import { formatBand } from '../../lib/geo.js';
import { ZONES } from '../../hooks/usePujaFilters.js';
import FilterPanel from './FilterPanel.jsx';

/**
 * A quick-filter chip: tap to select, a cross slides in, tap again to remove.
 * @param {{ label: string, name: string, selected: boolean, onToggle: () => void, tone?: string }} props
 */
function ToggleChip({ label, selected, onToggle, tone, name }) {
  return (
    <button
      type="button"
      className="chip compact"
      aria-pressed={selected}
      aria-label={`${name}${selected ? ', selected. Tap to remove' : ''}`}
      onClick={onToggle}
    >
      {tone && <Dot tone={tone} />}
      {label}
      <AnimatePresence initial={false}>
        {selected && (
          <motion.span
            key="cross"
            className="chip-x"
            aria-hidden="true"
            initial={{ width: 0, marginLeft: -8, opacity: 0, scale: 0.6 }}
            animate={{ width: 18, marginLeft: 0, opacity: 1, scale: 1 }}
            exit={{ width: 0, marginLeft: -8, opacity: 0, scale: 0.6 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
          >
            <Icon name="x" size={16} />
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
}

/**
 * The radius chip: a dropdown of radius steps. The list opens in a portal under the chip because the
 * chip row scrolls sideways and would clip a menu drawn inside it.
 */
function RadiusChip() {
  const { filters, position, locationStatus, station } = useApp();
  const [open, setOpen] = useState(false);
  const [box, setBox] = useState(/** @type {{ left: number, top: number } | null} */ (null));
  const buttonRef = useRef(/** @type {HTMLButtonElement | null} */ (null));
  const menuRef = useRef(/** @type {HTMLUListElement | null} */ (null));

  useLayoutEffect(() => {
    if (!open || !buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    setBox({ left: Math.max(8, Math.min(rect.left, window.innerWidth - 188)), top: rect.bottom + 6 });
  }, [open]);
  useEffect(() => {
    if (!open) return undefined;
    const close = () => setOpen(false);
    const onPress = (/** @type {PointerEvent} */ event) => {
      const target = /** @type {Node} */ (event.target);
      if (!menuRef.current?.contains(target) && !buttonRef.current?.contains(target)) close();
    };
    const onKey = (/** @type {KeyboardEvent} */ event) => {
      if (event.key !== 'Escape') return;
      close();
      buttonRef.current?.focus();
    };
    document.addEventListener('pointerdown', onPress);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPress);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const disabled = !position || Boolean(station) || filters.zones.length > 0;
  const hint = station
    ? 'A metro station is chosen, so the radius is not used'
    : filters.zones.length
      ? 'An area is chosen, so the radius is not used'
      : locationStatus === 'far'
        ? "You're outside Kolkata, so there is no radius"
        : 'Turn on location to use the radius';
  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="chip compact dist-chip"
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        title={disabled ? hint : 'Radius from you'}
        onClick={() => setOpen(!open)}
      >
        <Icon name="locate" size={18} />
        {formatBand(filters.radius)}
        <Icon name="chevron" size={16} />
      </button>
      {open &&
        box &&
        createPortal(
          <ul
            ref={menuRef}
            className="menu"
            role="listbox"
            aria-label="Radius from you"
            style={{ position: 'fixed', left: box.left, top: box.top }}
          >
            {RADIUS_STEPS.map((metres) => (
              <li key={metres} role="option" aria-selected={filters.radius === metres}>
                <button
                  type="button"
                  className={filters.radius === metres ? 'on' : ''}
                  onClick={() => {
                    filters.chooseRadius(metres);
                    setOpen(false);
                  }}
                >
                  <span>{formatBand(metres)}</span>
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
 * Top bar (PRD section 3): Filters on the left, then chips that scroll sideways: radius first, then
 * the five area chips (South to Other), Blue line and Green line. Chips are quick filters and their state is always visible.
 */
export default function FilterBar() {
  const { filters, nav, setLines, toggleZone } = useApp();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef(/** @type {HTMLButtonElement | null} */ (null));
  const close = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };
  const toggleLine = (line) => setLines(nav.lines.includes(line) ? nav.lines.filter((l) => l !== line) : [...nav.lines, line]);
  return (
    <>
      <div className="bar-chips" role="toolbar" aria-label="Filters and metro lines">
        <button
          ref={triggerRef}
          type="button"
          className="chip compact"
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => setOpen(true)}
        >
          <Icon name="sliders" size={18} />
          Filters
          {filters.filterCount > 0 && <span className="badge">{filters.filterCount}</span>}
        </button>
        <RadiusChip />
        {/* Less crowded chip: switched off for now, kept for when crowd data covers every zone.
        <button
          type="button"
          className="chip compact"
          aria-pressed={filters.lessCrowded}
          title={CROWD_NOTE}
          onClick={() => {
            filters.setLessCrowded(!filters.lessCrowded);
            if (!filters.lessCrowded) toast(CROWD_NOTE);
          }}
        >
          Less crowded
        </button>
        */}
        {ZONES.map((zone) => (
          <ToggleChip
            key={zone.id}
            name={`${zone.label} Kolkata`}
            label={zone.label}
            selected={filters.zones.includes(zone.id)}
            onToggle={() => toggleZone(zone.id)}
          />
        ))}
        {['blue', 'green'].map((line) => (
          <ToggleChip
            key={line}
            name={`${line === 'blue' ? 'Blue' : 'Green'} line`}
            label={line === 'blue' ? 'Blue line' : 'Green line'}
            tone={line}
            selected={nav.lines.includes(line)}
            onToggle={() => toggleLine(line)}
          />
        ))}
      </div>
      {createPortal(<AnimatePresence>{open && <FilterPanel onClose={close} />}</AnimatePresence>, document.body)}
    </>
  );
}
