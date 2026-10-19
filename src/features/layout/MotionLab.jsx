import { useEffect, useState } from 'react';
import { SHEET_MOTIONS, chooseSheetMotion, motionLabEnabled, sheetMotionKey } from './sheetMotion.js';

/**
 * Test-only switcher for how the bottom sheet moves. It shows only when the address has `?motionlab` (or the
 * preview sets it). It lists the motion styles, applies a choice to the very next gesture, and prints what the last
 * gesture did, so a sheet that "didn't respond" can be explained from a screenshot.
 */
export default function MotionLab() {
  const enabled = motionLabEnabled();
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState(sheetMotionKey);
  const [last, setLast] = useState(/** @type {Record<string, any> | null} */ (null));
  useEffect(() => {
    if (!enabled) return undefined;
    const onGesture = (/** @type {Event} */ e) => setLast(/** @type {CustomEvent} */ (e).detail);
    window.addEventListener('pd-sheet', onGesture);
    return () => window.removeEventListener('pd-sheet', onGesture);
  }, [enabled]);
  if (!enabled) return null;
  return (
    <div className="motion-lab" data-no-sheet-drag>
      <button type="button" className="motion-lab-chip" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        Motion: {SHEET_MOTIONS[key].label} {open ? '▴' : '▾'}
      </button>
      {open && (
        <div className="motion-lab-menu" role="radiogroup" aria-label="Sheet motion">
          {Object.entries(SHEET_MOTIONS).map(([id, m]) => (
            // eslint-disable-next-line jsx-a11y/label-has-associated-control -- the text is in the nested span
            <label key={id} className={id === key ? 'on' : ''}>
              <input
                type="radio"
                name="sheet-motion"
                checked={id === key}
                onChange={() => {
                  chooseSheetMotion(id);
                  setKey(id);
                  setOpen(false);
                }}
              />
              <span>
                <b>{m.label}</b>
                <small>{m.note}</small>
              </span>
            </label>
          ))}
        </div>
      )}
      <output className="motion-lab-read" aria-live="off">
        {last
          ? `${last.what}${last.v != null ? ` · ${last.v} px/ms` : ''}${last.to ? ` → ${last.to}` : ''}${last.ms != null ? ` · ${last.ms} ms` : ''}`
          : 'Drag the sheet to see what it did'}
      </output>
    </div>
  );
}
