import { useApp } from '../../context/AppContext.js';
import { Icon } from '../../components/ui/Icon.jsx';
import { AREA_RADIUS_M, PAGE_SIZE, RADIUS_STEPS } from '../../config.js';
import { formatBand } from '../../lib/geo.js';
import { zoneName } from '../../hooks/usePujaFilters.js';
import { headline } from '../../lib/headline.js';
import PopularStrip from './PopularStrip.jsx';
import SortMenu from './SortMenu.jsx';
import PujaCard from './PujaCard.jsx';

/** Header text for the Browse state, used by the screen and by the peek line. */
export function useBrowseHeadline() {
  const { filters, position, station } = useApp();
  return headline({
    located: position != null,
    count: filters.nearCount,
    radius: filters.radius,
    filterCount: filters.filterCount,
    stationName: station?.name ?? null,
    zoneText: filters.zones.length ? zoneName(filters.zones) : null,
    defaultRadius: RADIUS_STEPS[0],
  });
}

/**
 * The location card (doc 01): one text column and a button with its icon inside. Shown under the heading until
 * location is allowed; it is also the one passive error state, so it says what happened, then what to do.
 */
function LocationBanner() {
  const { locationStatus, locationFailure, locationRetries, locate } = useApp();
  // Allowed, or far away (the visitor chip says so): no card.
  if (locationStatus === 'on' || locationStatus === 'far') return null;
  const finding = locationStatus === 'asking';
  const failed = locationStatus === 'denied';
  const noSignal = failed && locationFailure === 'nosignal';
  const content = noSignal
    ? { head: "Couldn't find your location", body: 'Check that GPS is on, then retry.', button: 'Retry' }
    : failed
      ? {
          head: 'Location is blocked for this site',
          body: locationRetries > 0 ? 'Still blocked. Check site settings.' : 'Allow it in site settings, then retry.',
          button: 'Retry',
        }
      : { head: 'Find pujas near you in Kolkata', body: 'Your location never leaves your phone.', button: 'Show pujas near me' };
  return (
    <div className="loc-card" role="status" data-state={finding ? 'finding' : failed ? (noSignal ? 'nosignal' : 'blocked') : 'default'}>
      <div className="loc-card-head">{content.head}</div>
      <div className="loc-card-body">{content.body}</div>
      <button type="button" className="loc-card-btn" aria-busy={finding} disabled={finding} onClick={() => locate()}>
        <Icon name="locate" size={16} />
        {finding ? 'Finding you…' : content.button}
      </button>
    </div>
  );
}

/** The Browse state: header, banner, Popular strip and the puja list. */
export default function Explore() {
  const { filters, position, setStation, locationStatus } = useApp();
  const { results, nearCount, radius, radiusActive, nextRadius, filterCount, appliedText, visibleCount, showMore } = filters;
  const title = useBrowseHeadline();
  const clearFilters = () => {
    filters.clearOthers();
    setStation(null);
  };
  const { areaCentre, areaPujas, clearArea } = filters;
  // With an area searched, its pujas lead under their own heading and the rest follow without repeating them.
  const inArea = new Set(areaPujas.map((puja) => puja.id));
  const rest = areaCentre ? results.filter((puja) => !inArea.has(puja.id)) : results;
  const shown = rest.slice(0, visibleCount);
  // The "Farther than" divider only makes sense while the list runs nearest first.
  const dividerAt = !areaCentre && filters.sort === 'nearest' && radiusActive && nearCount < results.length ? nearCount : -1;
  return (
    <div className="stack">
      <div className="head" data-sheet-head>
        <div>
          <h2>{title}</h2>
          {appliedText && <div className="sub">{appliedText}</div>}
        </div>
        <div className="head-actions">
          {filterCount > 0 && (
            <button type="button" className="btn text" onClick={clearFilters}>
              Clear all
            </button>
          )}
        </div>
      </div>
      <LocationBanner />
      {radiusActive && nearCount === 0 && results.length > 0 && (
        <div className="notice">
          <b>No pujas within {formatBand(radius)}</b>
          {nextRadius && (
            <button type="button" className="btn small dark mt8" onClick={() => filters.chooseRadius(nextRadius)}>
              Show pujas within {formatBand(nextRadius)}
            </button>
          )}
        </div>
      )}
      {!areaCentre && <PopularStrip />}
      {areaCentre && (
        <section aria-label="Pujas in this area" data-testid="area-section">
          <div className="area-head">
            <h3>
              Pujas in this area <span className="num">{areaPujas.length}</span>
            </h3>
            <button type="button" className="btn text" onClick={clearArea}>
              Clear area
            </button>
          </div>
          <div className="sub">{`Within about ${AREA_RADIUS_M / 1000} km of the middle of the map.`}</div>
          {areaPujas.length === 0 ? (
            <div className="notice">
              <b>No pujas within {AREA_RADIUS_M / 1000} km of here</b>
              <div className="sub">Pan the map and search again, or see every puja below.</div>
            </div>
          ) : (
            areaPujas.map((puja, i) => (
              <div key={puja.id} className="prow">
                <PujaCard puja={puja} index={i} />
              </div>
            ))
          )}
          {rest.length > 0 && <div className="divider-row">Everywhere else</div>}
        </section>
      )}
      {results.length > 0 && (
        <div className="all-head">
          <h3>All Pujas</h3>
          {results.length > 1 && <SortMenu />}
        </div>
      )}
      {results.length === 0 ? (
        <div className="empty">
          <h3>No pujas match</h3>
          <div>These filters together leave nothing. Clear them to see the pujas again.</div>
          <button type="button" className="btn small dark mt12" onClick={clearFilters}>
            Clear all
          </button>
        </div>
      ) : (
        <div>
          {shown.map((puja, i) => (
            <div key={puja.id} className="prow">
              {i === dividerAt && <div className="divider-row">{`Farther than ${formatBand(radius)}`}</div>}
              <PujaCard puja={puja} index={i} />
            </div>
          ))}
          {rest.length > shown.length && (
            <button type="button" className="btn block mt12" onClick={showMore}>
              {`Show ${Math.min(PAGE_SIZE, rest.length - shown.length)} more`}
            </button>
          )}
        </div>
      )}
      {!position && !filters.curated && locationStatus !== 'asking' && results.length > 0 && (
        <div className="sub">Turn on location to sort by distance.</div>
      )}
    </div>
  );
}
