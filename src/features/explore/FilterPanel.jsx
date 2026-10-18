import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { useApp } from '../../context/AppContext.js';
import { Dot } from '../../components/ui/Dot.jsx';
import { Icon } from '../../components/ui/Icon.jsx';
import { RADIUS_STEPS } from '../../config.js';
import { CROWD_NOTE } from '../../lib/crowd.js';
import { formatBand } from '../../lib/geo.js';

const FOCUSABLE = 'button:not([disabled]), input, [href], select, [tabindex]:not([tabindex="-1"])';

/** Keeps Escape and Tab inside the open panel. */
function usePanelKeys(panelRef, onClose) {
  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') {
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !panelRef.current) return;
      const items = [...panelRef.current.querySelectorAll(FOCUSABLE)];
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [panelRef, onClose]);
}

/** Radius steps, or a plain reason they are off. */
function RadiusSection() {
  const { filters, position, locationStatus, locate, station } = useApp();
  const asking = locationStatus === 'asking';
  const denied = locationStatus === 'denied';
  const far = locationStatus === 'far';
  return (
    <section className="sheet-sec" aria-labelledby="fp-radius">
      <h3 id="fp-radius">Radius</h3>
      {position ? (
        <>
          <div className="sub">
            {station ? `Not used while ${station.name} is chosen.` : 'Straight-line distance from where you are now.'}
          </div>
          <div className="chip-wrap" role="group" aria-label="Radius from you">
            {RADIUS_STEPS.map((metres) => (
              <button
                key={metres}
                type="button"
                className="chip"
                disabled={Boolean(station)}
                aria-pressed={filters.radius === metres}
                onClick={() => filters.chooseRadius(metres)}
              >
                {formatBand(metres)}
              </button>
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="sub">
            {far
              ? "You're outside Kolkata, so the radius is off. Pick a station or an area below."
              : denied
                ? 'Location is blocked for this site. Allow it in your browser settings to use the radius.'
                : 'Turn on your location to see the pujas within walking distance. It never leaves your phone.'}
          </div>
          {!denied && !far && (
            <button type="button" className="btn small dark" aria-busy={asking} onClick={() => locate()}>
              <Icon name="locate" size={18} />
              {asking ? 'Finding you…' : 'Turn on location'}
            </button>
          )}
        </>
      )}
    </section>
  );
}

/** A searchable list of every metro station; picking one shows the pujas near it. */
function StationSection() {
  const { data, station, setStation, position } = useApp();
  const [search, setSearch] = useState('');
  const stations = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const all = data.stations.filter((s) => s.lines.length);
    return (needle ? all.filter((s) => s.name.toLowerCase().includes(needle)) : all).sort((a, b) => a.name.localeCompare(b.name));
  }, [data, search]);
  return (
    <section className="sheet-sec" aria-labelledby="fp-station">
      <h3 id="fp-station">Metro station</h3>
      <div className="sub">Pick a station to see the pujas within 1 km of it (up to 5 km if there are none). It replaces the radius.</div>
      <input
        type="search"
        className="mb8"
        value={search}
        placeholder="Search for a station"
        aria-label="Search for a station"
        autoComplete="off"
        onChange={(e) => setSearch(e.target.value)}
      />
      <div className="chip-wrap" role="group" aria-label="Metro stations">
        {stations.map((s) => (
          <button
            key={s.id}
            type="button"
            className="chip compact"
            aria-pressed={station?.id === s.id}
            onClick={() => setStation(station?.id === s.id ? null : s.id)}
          >
            {s.lines
              .filter((line) => line === 'blue' || line === 'green')
              .map((line) => (
                <Dot key={line} tone={line} />
              ))}
            {s.name}
          </button>
        ))}
      </div>
      {stations.length === 0 && <div className="sub">No station called “{search}”. Try fewer letters.</div>}
      {!position && <div className="sub mt8">Without your location the stations are listed A to Z.</div>}
    </section>
  );
}

/** The ten nearest areas (A to Z without a location); search finds any other. One can be picked. */
function AreaSection() {
  const { filters, position } = useApp();
  const { area, setArea, areas, nearbyAreas } = filters;
  const [search, setSearch] = useState('');
  const shown = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (needle) return areas.filter((entry) => entry.name.toLowerCase().includes(needle));
    // The picked area stays visible even when it is not one of the nearest.
    const picked = area ? areas.find((entry) => entry.name === area) : null;
    return position ? (picked && !nearbyAreas.includes(picked) ? [picked, ...nearbyAreas] : nearbyAreas) : areas;
  }, [areas, nearbyAreas, area, position, search]);
  return (
    <section className="sheet-sec" aria-labelledby="fp-area">
      <h3 id="fp-area">Nearby area</h3>
      <div className="sub">
        {position ? 'The 10 areas nearest to you, closest first. ' : ''}Search for any other area. The number is how many pujas it has.
      </div>
      <input
        type="search"
        className="mb8"
        value={search}
        placeholder="Search for an area"
        aria-label="Search for an area"
        autoComplete="off"
        onChange={(e) => setSearch(e.target.value)}
      />
      <div className="chip-wrap" role="group" aria-label="Areas">
        {shown.map((entry) => (
          <button
            key={entry.name}
            type="button"
            className="chip compact"
            aria-pressed={area === entry.name}
            onClick={() => setArea(area === entry.name ? null : entry.name)}
          >
            {entry.name}
            <span className="chip-n">{entry.count}</span>
          </button>
        ))}
      </div>
      {shown.length === 0 && <div className="sub">No area called “{search}”. Try fewer letters.</div>}
    </section>
  );
}

/** The Less crowded toggle, with the plain-words note that it is not live data. */
function CrowdSection() {
  const { filters } = useApp();
  return (
    <section className="sheet-sec" aria-labelledby="fp-crowd">
      <h3 id="fp-crowd">Crowd</h3>
      {/* eslint-disable-next-line jsx-a11y/label-has-associated-control -- the switch is nested in the label */}
      <label className="switch-row">
        <span>
          <b>Less crowded</b>
          <span className="sub block">{CROWD_NOTE}</span>
        </span>
        <input type="checkbox" role="switch" checked={filters.lessCrowded} onChange={(e) => filters.setLessCrowded(e.target.checked)} />
      </label>
    </section>
  );
}

/**
 * Filters panel, full height (PRD flow F). Changes apply live and the sticky button always says how many
 * pujas match, so nobody has to guess what a tap did. "Clear all" sits beside it.
 * @param {{ onClose: () => void }} props
 */
export default function FilterPanel({ onClose }) {
  const { filters, setStation } = useApp();
  const panelRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const closeRef = useRef(/** @type {HTMLButtonElement | null} */ (null));
  usePanelKeys(panelRef, onClose);
  useEffect(() => closeRef.current?.focus(), []);

  const count = filters.nearCount;
  const dirty = filters.filterCount > 0 || filters.radius !== RADIUS_STEPS[0];
  return (
    <motion.div className="sheet-scrim full" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div
        ref={panelRef}
        className="sheet full"
        role="dialog"
        aria-modal="true"
        aria-labelledby="fp-title"
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 60, opacity: 0 }}
        transition={/** @type {const} */ ({ type: 'spring', stiffness: 420, damping: 38 })}
      >
        <div className="sheet-head">
          <h2 id="fp-title">Filters</h2>
          <button ref={closeRef} type="button" className="icon-btn" aria-label="Close filters" onClick={onClose}>
            <Icon name="x" />
          </button>
        </div>
        <div className="sheet-body">
          <RadiusSection />
          <StationSection />
          <AreaSection />
          <CrowdSection />
        </div>
        <div className="sheet-foot">
          <button
            type="button"
            className="btn text"
            disabled={!dirty}
            onClick={() => {
              filters.clearAll();
              setStation(null);
            }}
          >
            Clear all
          </button>
          <button type="button" className="btn dark" onClick={onClose}>
            {`Show ${count} ${count === 1 ? 'puja' : 'pujas'}`}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
