import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useApp } from '../../context/AppContext.js';
import { Icon } from '../../components/ui/Icon.jsx';
import { WALK_DETOUR_FACTOR, WALK_METRES_PER_MIN, formatDistance, haversine, walkMinutes } from '../../lib/geo.js';
import { LINE_NAME, LINE_ORDER, MAPPED_LINES } from '../../lib/metro.js';
import { buildDirectionLinks, nearestToStation, orderStops } from '../../lib/tour.js';
import { useToast } from '../../context/ToastContext.jsx';
import { CrowdLabel } from '../puja/labels.jsx';

const MIN_BUILD_STOPS = 3;
const MAX_BUILD_STOPS = 12;
const DEFAULT_BUILD_STOPS = 6;

/** Station dropdown grouped by line. */
/**
 * @param {{ id?: string, value: string, onChange: (value: string) => void, withStartChoices?: boolean }} props
 */
function StationSelect({ id, value, onChange, withStartChoices = false }) {
  const { data } = useApp();
  return (
    <select id={id} value={value} onChange={(e) => onChange(e.target.value)} aria-label="Station">
      {withStartChoices && (
        <>
          <option value="free">Start at the first stop</option>
          <option value="me">Start at my location</option>
        </>
      )}
      {MAPPED_LINES.map((line) => (
        <optgroup key={line} label={LINE_NAME[line]}>
          {LINE_ORDER[line]
            .flatMap((stationId) => data.stById.get(stationId) ?? [])
            .map((station) => (
              <option key={`${line}-${station.id}`} value={station.id}>
                {station.name}
              </option>
            ))}
        </optgroup>
      ))}
    </select>
  );
}

/** Walking legs between stops, with the straight-line distance scaled by the detour factor. */
function useLegs(stops, startPoint) {
  return useMemo(() => {
    const points = startPoint ? [startPoint, ...stops] : stops;
    const offset = startPoint ? 0 : 1; // without a start there is no leg into the first stop
    const legs = stops.map((_, index) => {
      const from = points[index - offset];
      const to = stops[index];
      return from ? haversine(from.la, from.lo, to.la, to.lo) * WALK_DETOUR_FACTOR : null;
    });
    return { legs, total: legs.reduce((sum, leg) => sum + (leg ?? 0), 0) };
  }, [stops, startPoint]);
}

/** Tour planner: pick a start, order stops for the shortest walk, open Google Maps directions. */
export default function Tour() {
  const { data, tour, setTour, tourStart, setTourStart, startPoint, position, locationStatus, locate, openPuja, toggleTour, backToList } =
    useApp();
  const toast = useToast();
  const [builderStation, setBuilderStation] = useState('kalighat');
  const [builderCount, setBuilderCount] = useState(DEFAULT_BUILD_STOPS);

  const stops = useMemo(() => tour.flatMap((id) => data.byId.get(id) ?? []), [tour, data]);
  const { legs, total } = useLegs(stops, startPoint);
  const links = useMemo(() => buildDirectionLinks(startPoint, stops), [startPoint, stops]);

  const move = (index, delta) =>
    setTour((ids) => {
      const target = index + delta;
      if (target < 0 || target >= ids.length) return ids;
      const next = ids.slice();
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });

  const buildFromStation = () => {
    const station = data.stById.get(builderStation);
    if (!station) return;
    const count = Math.max(MIN_BUILD_STOPS, Math.min(MAX_BUILD_STOPS, Number(builderCount) || DEFAULT_BUILD_STOPS));
    setTourStart(station.id);
    setTour(orderStops(nearestToStation(data.pujas, station, count), { la: station.lat, lo: station.lng }, data.byId));
  };

  const summary = tour.length
    ? `${tour.length} stops · about ${formatDistance(total)} on foot${startPoint ? ` from ${startPoint.name}` : ''} · ${Math.round(total / WALK_METRES_PER_MIN)} min walking`
    : 'Add pujas to plan the shortest walk';

  return (
    <div className="stack">
      <button type="button" className="back" onClick={backToList}>
        <Icon name="back" />
        All pujas
      </button>
      <div className="head">
        <div>
          <h2>Your tour</h2>
          <div className="sub">{summary}</div>
        </div>
        {tour.length > 0 && (
          <button type="button" className="btn small" onClick={() => setTour([])}>
            Clear
          </button>
        )}
      </div>
      <div className="stack tight">
        <label className="sub" htmlFor="tour-start">
          Starting point
        </label>
        <StationSelect
          id="tour-start"
          value={tourStart}
          withStartChoices
          onChange={(value) => {
            setTourStart(value);
            if (value === 'me' && !position && locationStatus !== 'far') locate();
          }}
        />
        <button
          type="button"
          className="btn primary block"
          disabled={tour.length < 2}
          onClick={() => {
            setTour(orderStops(tour, startPoint, data.byId));
            toast('Reordered for the shortest walk', 'ok');
          }}
        >
          <Icon name="route" />
          Plan the shortest walk
        </button>
      </div>
      {!tour.length && (
        <>
          <div className="card stack">
            <h3>Build a tour from a metro station</h3>
            <div className="sub">We pick the closest pujas to the station and put them in the shortest walking order.</div>
            <StationSelect value={builderStation} onChange={setBuilderStation} />
            <div className="row">
              <label className="sub" htmlFor="build-count">
                Pujas
              </label>
              <input
                id="build-count"
                className="narrow"
                type="number"
                min={MIN_BUILD_STOPS}
                max={MAX_BUILD_STOPS}
                value={builderCount}
                inputMode="numeric"
                onChange={(e) => setBuilderCount(Number(e.target.value))}
              />
            </div>
            <button type="button" className="btn dark block" onClick={buildFromStation}>
              Build tour
            </button>
          </div>
          <div className="empty">
            <h3>Nothing here yet</h3>Open any puja and tap Add to tour, or build one from a metro station above.
          </div>
        </>
      )}
      <div>
        <AnimatePresence initial={false}>
          {stops.map((stop, index) => (
            <motion.div
              key={stop.id}
              layout
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
            >
              {legs[index] != null && (
                <div className="leg num">{`${formatDistance(legs[index])} · ${walkMinutes(legs[index] / WALK_DETOUR_FACTOR)} min walk`}</div>
              )}
              <div className="stop">
                <span className="n">{index + 1}</span>
                <button type="button" className="grow plain" onClick={() => openPuja(stop.id)}>
                  <div className="pname">{stop.n}</div>
                  <div className="pmeta">
                    <CrowdLabel puja={stop} />
                  </div>
                </button>
                <button type="button" className="icon-btn" aria-label="Move up" disabled={index === 0} onClick={() => move(index, -1)}>
                  <Icon name="up" />
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  aria-label="Move down"
                  disabled={index === stops.length - 1}
                  onClick={() => move(index, 1)}
                >
                  <Icon name="down" />
                </button>
                <button type="button" className="icon-btn" aria-label="Remove" onClick={() => toggleTour(stop.id)}>
                  <Icon name="x" />
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      {tour.length > 0 && (
        <div className="stack tight">
          {links.map((url, index) => (
            <a key={url} className="btn block" target="_blank" rel="noopener noreferrer" href={url}>
              <Icon name="nav" />
              {links.length > 1 ? `Walking directions, part ${index + 1} of ${links.length}` : 'Walking directions in Google Maps'}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
