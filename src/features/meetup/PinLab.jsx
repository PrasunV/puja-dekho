import { useState } from 'react';
import { PIN_STYLES } from '../../data/meetup.js';
import { pinLabEnabled, usePinStyle } from './usePinStyle.js';

/** Preview-only switcher for the three pin looks (shown with `?pinlab`, or in the preview). */
export default function PinLab() {
  const [style, choose] = usePinStyle();
  const [open, setOpen] = useState(false);
  if (!pinLabEnabled()) return null;
  const current = PIN_STYLES.find((s) => s.id === style) ?? PIN_STYLES[0];
  return (
    <div className="pin-lab" data-no-sheet-drag>
      <button type="button" className="pin-lab-chip" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        Pin: {current.label} {open ? '▴' : '▾'}
      </button>
      {open && (
        <div className="pin-lab-menu" role="radiogroup" aria-label="Pin look">
          {PIN_STYLES.map((s) => (
            // eslint-disable-next-line jsx-a11y/label-has-associated-control -- the text is in the nested span
            <label key={s.id} className={s.id === style ? 'on' : ''}>
              <input
                type="radio"
                name="pin-style"
                checked={s.id === style}
                onChange={() => {
                  choose(s.id);
                  setOpen(false);
                }}
              />
              <span>
                <b>{s.label}</b>
                <small>{s.note}</small>
              </span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
