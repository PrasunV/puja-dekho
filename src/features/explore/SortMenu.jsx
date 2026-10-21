import { useEffect, useRef, useState } from 'react';
import { useApp } from '../../context/AppContext.js';
import { Icon } from '../../components/ui/Icon.jsx';
import { SORT_LABELS } from '../../hooks/usePujaFilters.js';

/**
 * "Sort: Nearest": a grey, filled drop-down button at the right of the "All Pujas" heading. It opens the choices just under it.
 * The choices are radios: one is always picked. Sorting changes the list only, never the map.
 */
export default function SortMenu() {
  const { filters } = useApp();
  const [open, setOpen] = useState(false);
  const wrap = useRef(/** @type {HTMLDivElement | null} */ (null));
  const button = useRef(/** @type {HTMLButtonElement | null} */ (null));

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (/** @type {KeyboardEvent} */ event) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      button.current?.focus();
    };
    const onPointer = (/** @type {PointerEvent} */ event) => {
      if (wrap.current && !wrap.current.contains(/** @type {Node} */ (event.target))) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
    };
  }, [open]);

  const choose = (/** @type {string} */ key) => {
    filters.setSort(key);
    setOpen(false);
    button.current?.focus();
  };
  return (
    <div className="sort" ref={wrap}>
      <button ref={button} type="button" className="sort-btn" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span>{`Sort: ${SORT_LABELS[filters.sort]}`}</span>
        <Icon name="chevron" size={18} />
      </button>
      {open && (
        <div className="sort-list" role="menu" aria-label="Sort the list">
          {filters.sortOptions.map((key) => (
            <button
              key={key}
              type="button"
              role="menuitemradio"
              aria-checked={filters.sort === key}
              className="sort-item"
              onClick={() => choose(key)}
            >
              {SORT_LABELS[key]}
              {filters.sort === key && <span aria-hidden="true">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
