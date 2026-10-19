import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { REPORT_HINT_AFTER_MS, REPORT_HINT_SHOW_MS } from '../../config.js';
import { storage } from '../../lib/storage.js';
import { Dot } from '../../components/ui/Dot.jsx';
import { Icon } from '../../components/ui/Icon.jsx';
import { CountRoll } from '../../components/ui/CountRoll.jsx';
import { PhraseSwap } from '../../components/ui/PhraseSwap.jsx';

const LAYER_OPTIONS = [
  ['stations', 'Metro stations'],
  ['lines', 'Blue and Green line tracks'],
  ['roads', 'Road reports'],
  ['crowd', 'Queue colours on pins'],
  ['other', 'Yellow and Orange line stations'],
];

/** Look and label of the location button for each state, like Google Maps. */
const LOCATION_BUTTON = {
  idle: { icon: 'myloc', className: '', label: 'Show my location' },
  asking: { icon: 'myloc', className: 'asking', label: 'Finding your location' },
  on: { icon: 'myloc', className: 'on', label: 'Go to my location' },
  centred: { icon: 'myloc', className: 'centred', label: 'You are here. Tap to follow me' },
  following: { icon: 'myloc', className: 'following', label: 'Following you. Tap to stop' },
  denied: { icon: 'myloc-off', className: 'off', label: 'Location is off. Tap for help' },
};

/**
 * Three round buttons ride on top of the sheet (PRD section 3): current location, Metro, Report issue.
 * They follow the sheet while it moves and fade out as it reaches full height. The location button is a crosshair that turns blue when the
 * map is centred on you, grey when you have panned away; it never changes the radius.
 * @param {{ locationStatus: 'idle' | 'asking' | 'on' | 'denied' | 'far', centred: boolean, following: boolean, metroOpen: boolean, bottom: string | number, reportUrl: string, online: boolean, onLocate: () => void, onMetro: () => void, onOfflineReport: () => void }} props
 */
export function MapTools({ locationStatus, centred, following, metroOpen, bottom, reportUrl, online, onLocate, onMetro, onOfflineReport }) {
  // After a minute in the app, a small tooltip names the Report button for a moment: the first time ever, then never again.
  const [hint, setHint] = useState(false);
  useEffect(() => {
    const after = (window.__PD_E2E__ && window.__PD_E2E_HINT_MS__) || REPORT_HINT_AFTER_MS;
    if (storage.get('reportHintSeen', false)) return undefined;
    let hideTimer = 0;
    const showTimer = setTimeout(() => {
      if (document.visibilityState === 'hidden') return;
      setHint(true);
      storage.set('reportHintSeen', true);
      hideTimer = window.setTimeout(() => setHint(false), REPORT_HINT_SHOW_MS);
    }, after);
    return () => {
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
    };
  }, []);
  const look =
    LOCATION_BUTTON[
      following ? 'following' : locationStatus === 'on' && centred ? 'centred' : locationStatus === 'far' ? 'on' : locationStatus
    ];
  return (
    <div className="map-tools" style={{ bottom }}>
      <button type="button" className="fab" aria-label="Metro stations near you" title="Metro" aria-pressed={metroOpen} onClick={onMetro}>
        <Icon name="train" />
      </button>
      <span className="fab-wrap">
        <AnimatePresence>
          {hint && (
            <motion.span
              className="fab-hint"
              aria-hidden="true"
              initial={{ opacity: 0, x: 6 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 6 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
            >
              Report an issue
            </motion.span>
          )}
        </AnimatePresence>
        <a
          className="fab"
          href={reportUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Report an issue"
          title="Report an issue"
          onClick={(event) => {
            setHint(false);
            if (!online) {
              event.preventDefault();
              onOfflineReport();
            }
          }}
        >
          <Icon name="flag" />
        </a>
      </span>
      <button
        type="button"
        className={`fab loc ${look.className}`}
        aria-label={look.label}
        title={look.label}
        aria-busy={locationStatus === 'asking'}
        onClick={onLocate}
      >
        <Icon name={/** @type {import('../../components/ui/Icon.jsx').IconName} */ (look.icon)} size={24} />
      </button>
    </div>
  );
}

/** "You're offline" badge over the map. The list and details still work from the saved data. */
export function OfflineBadge({ online }) {
  if (online) return null;
  return (
    <div className="offline-badge" role="status">
      <Icon name="offline" size={18} />
      You're offline
    </div>
  );
}

/**
 * Layer checkboxes.
 * @param {{ layers: Record<string, boolean>, onChange: (key: string, on: boolean) => void }} props
 */
export function LayersPopover({ layers, onChange }) {
  return (
    <div className="pop" role="dialog" aria-label="Map layers">
      <h3>Map layers</h3>
      {LAYER_OPTIONS.map(([key, label]) => (
        <label key={key}>
          <input type="checkbox" checked={Boolean(layers[key])} onChange={(e) => onChange(key, e.target.checked)} />
          {label}
        </label>
      ))}
    </div>
  );
}

/** Colour key for metro lines and queue levels. */
export function Legend() {
  return (
    <div className="legend" aria-label="Map legend">
      <span>
        <Dot tone="blue" />
        Blue Line
      </span>
      <span>
        <Dot tone="green" />
        Green Line
      </span>
      <span>
        <Dot tone="q1" />
        Short queue
      </span>
      <span>
        <Dot tone="q2" />
        Medium
      </span>
      <span>
        <Dot tone="q3" />
        Long
      </span>
    </div>
  );
}

/**
 * "Search this area": appears after the person moves the map, like Google Maps and Airbnb.
 * @param {{ visible: boolean, onSearch: () => void }} props
 */
export function SearchAreaPill({ visible, onSearch }) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.button
          type="button"
          className="chip compact search-area"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.15 }}
          onClick={onSearch}
        >
          <Icon name="search" size={18} />
          Search this area
        </motion.button>
      )}
    </AnimatePresence>
  );
}

/**
 * For people outside Kolkata: one tap to frame the city alone. Always on the map, so it works with the sheet at its lowest.
 * @param {{ visible: boolean, onClick: () => void }} props
 */
export function ShowKolkata({ visible, onClick }) {
  if (!visible) return null;
  return (
    <button type="button" className="show-kolkata" onClick={onClick}>
      <Icon name="myloc" size={16} />
      Show Kolkata
    </button>
  );
}

/** "Users" glyph for the viewer pill (Phosphor, 256 grid). */
const USERS_PATH =
  'M117.25,157.92a60,60,0,1,0-66.5,0A95.83,95.83,0,0,0,3.53,195.63a8,8,0,1,0,13.4,8.74,80,80,0,0,1,134.14,0,8,8,0,0,0,13.4-8.74A95.83,95.83,0,0,0,117.25,157.92ZM40,108a44,44,0,1,1,44,44A44.05,44.05,0,0,1,40,108Zm210.14,98.7a8,8,0,0,1-11.07-2.33A79.83,79.83,0,0,0,172,168a8,8,0,0,1,0-16,44,44,0,1,0-16.34-84.87,8,8,0,1,1-5.94-14.85,60,60,0,0,1,55.53,105.64,95.83,95.83,0,0,1,47.22,37.71A8,8,0,0,1,250.14,206.7Z';

/** How long "N people viewed" stays before it rolls over to "exploring now", and how long "exploring now" stays. */
const HOLD_MS = 9000;
/** Tests shorten the hold with window.__PD_PILL_HOLD_MS__. */
const holdMs = () => Number(/** @type {any} */ (globalThis).__PD_PILL_HOLD_MS__) || HOLD_MS;

/**
 * Small pill at the top-left corner of the list sheet. It opens on how many people have viewed the app, rolls over
 * to how many are exploring right now (a green dot appears), then rolls back, and so on. It only says "exploring
 * now" while somebody else has used the app in the last 2 hours, so a quiet app never claims to be busy; otherwise
 * it stays on "viewed". The pill eases to the width of its text. Always on screen: it rides above the sheet, and
 * sits in the sheet's own corner when the sheet is full height.
 * @param {{ visits: number | null, live: { count: number, recent: number } | null, bottom: string | number, full: boolean }} props
 */
export function ViewCount({ visits, live, bottom, full }) {
  const haveVisits = visits != null;
  const active = live != null && live.recent >= 1;
  // Alternate only when there are two things to show; each time the crowd goes quiet, start again on "viewed".
  const alternate = active && haveVisits;
  const [exploring, setExploring] = useState(false);
  const [wasAlternating, setWasAlternating] = useState(alternate);
  if (wasAlternating !== alternate) {
    setWasAlternating(alternate);
    setExploring(false);
  }
  useEffect(() => {
    if (!alternate) return undefined;
    const t = setTimeout(() => setExploring((now) => !now), holdMs());
    return () => clearTimeout(t);
  }, [alternate, exploring]);

  const showLive = active && (haveVisits ? exploring : true);
  const count = showLive ? live.count : visits;
  if (count == null) return null;
  const noun = count === 1 ? 'person' : 'people';
  const state = showLive ? 'exploring now' : 'viewed';
  const number = count.toLocaleString('en-IN');
  return (
    <div className={`view-pill${full ? ' on-sheet' : ''}`} style={{ bottom }} role="img" aria-label={`${number} ${noun} ${state}`}>
      <span className="view-icon" aria-hidden="true">
        <svg width="16" height="16" viewBox="0 0 256 256" fill="currentColor">
          <path d={USERS_PATH} />
        </svg>
        <i className={`live-dot${showLive ? ' on' : ''}`} />
      </span>
      <span className="view-text">
        <CountRoll value={count} />
        <PhraseSwap text={`${noun} ${state}`} />
      </span>
    </div>
  );
}
